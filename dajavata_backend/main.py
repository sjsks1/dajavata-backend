from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import hashlib
import hmac
import secrets
import re
import shutil
import requests
import xml.etree.ElementTree as ET
import json
import os
import datetime
import time
import asyncio
from dotenv import load_dotenv

load_dotenv()

NOTION_TOKEN = os.getenv("NOTION_TOKEN")
NOTION_DATABASE_ID = os.getenv("NOTION_DATABASE_ID")

app = FastAPI()

background_task_ref = None

# Cache for stock list
stock_list = []

def load_stocks_sync():
    global stock_list
    print("Loading KRX stock list...", flush=True)
    # 1차: 로컬 all_stocks.json 캐시에서 0.01초 만에 초고속 로드 (Render 부팅 시 포트 바인딩 지연 원천 차단)
    for cand in [
        os.path.join(os.path.dirname(__file__), "data", "all_stocks.json"),
        "data/all_stocks.json",
        "dajavata_backend/data/all_stocks.json",
        "../data/all_stocks.json"
    ]:
        if os.path.exists(cand) and os.path.getsize(cand) > 1000:
            try:
                with open(cand, "r", encoding="utf-8") as f:
                    cached_stocks = json.load(f)
                if isinstance(cached_stocks, list) and len(cached_stocks) > 100:
                    stock_list = [
                        {
                            "code": str(s.get("code", "")),
                            "name": str(s.get("name", "")),
                            "market": str(s.get("market", "KRX"))
                        }
                        for s in cached_stocks if s.get("code")
                    ]
                    print(f"Loaded {len(stock_list)} stocks instantly from local cache ({cand}).", flush=True)
                    return
            except Exception as ce:
                print(f"Local stock cache read warning ({cand}): {ce}", flush=True)

    # 2차: 캐시 파일이 없을 때만 네트워크 API 폴백
    try:
        from fdr_fallback import StockListing
        df = StockListing('KRX')
        for _, row in df.iterrows():
            stock_list.append({
                "code": str(row['Code']),
                "name": str(row['Name']),
                "market": str(row['Market'])
            })
        print(f"Loaded {len(stock_list)} stocks from API.", flush=True)
    except Exception as e:
        print("Failed to load stocks:", e, flush=True)

async def periodic_update():
    print("!!! periodic_update 대기 시작 (Render 포트 스캔 통과를 위해 부팅 후 180초 대기) !!!", flush=True)
    await asyncio.sleep(180)
    # Render 무료 인스턴스(512MB RAM)에서는 무거운 전체 크롤링(update_themes.py)을 GitHub Actions에 위임하여 OOM 및 타임아웃 방지
    if os.getenv("RENDER"):
        print("[Render Mode] Heavy batch updates are delegated to GitHub Actions; keeping web worker lightweight.", flush=True)
        return

    last_run_hour_key = None
    while True:
        try:
            kst_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
            # 평일(월=0 ~ 금=4) 08시 ~ 21시 사이 매시 15분 도달 시 또는 캐시가 55분 이상 경과 시 실행
            is_weekday_active = (kst_now.weekday() < 5) and (8 <= kst_now.hour <= 21)
            hour_key = kst_now.strftime("%Y%m%d_%H")
            should_run = False

            if is_weekday_active and kst_now.minute >= 15 and last_run_hour_key != hour_key:
                should_run = True

            # 캐시 파일 노후도 점검 (theme_cache.json 또는 quant_hub_cache.json 중 하나라도 55분 이상 경과 시 실행)
            if is_weekday_active and not should_run:
                for cand in ['data/theme_cache.json', 'dajavata_backend/data/theme_cache.json', '../data/theme_cache.json']:
                    if os.path.exists(cand) and os.path.getsize(cand) > 100:
                        age_sec = time.time() - os.path.getmtime(cand)
                        if age_sec > 3500 and last_run_hour_key != hour_key:
                            should_run = True
                        break
                if not should_run:
                    for qcand in ['data/quant_hub_cache.json', 'dajavata_backend/data/quant_hub_cache.json', '../data/quant_hub_cache.json']:
                        if os.path.exists(qcand) and os.path.getsize(qcand) > 500:
                            q_age = time.time() - os.path.getmtime(qcand)
                            if q_age > 7200 and last_run_hour_key != hour_key:
                                should_run = True
                            break

            if should_run:
                last_run_hour_key = hour_key
                print(f"[{kst_now.strftime('%Y-%m-%d %H:%M:%S')} KST] Starting scheduled background update (themes, stocks & quant hub)...", flush=True)
                from update_themes import main as update_themes_main
                await update_themes_main()
                try:
                    from update_quant_hub import main as update_quant_hub_main
                    loop = asyncio.get_running_loop()
                    await loop.run_in_executor(None, update_quant_hub_main)
                except Exception as qe:
                    print(f"[QuantHub] Background update warning: {qe}", flush=True)
                print("Periodic background update finished.", flush=True)
        except Exception as e:
            print(f"Error during periodic background update: {e}", flush=True)
        
        await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    global background_task_ref
    print(">>> DAJAVATA FastAPI Server Ready & Listening on Port! <<<", flush=True)
    loop = asyncio.get_running_loop()
    loop.call_later(2.0, lambda: loop.run_in_executor(None, load_stocks_sync))
    background_task_ref = asyncio.create_task(periodic_update())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def fetch_block_children(block_id: str) -> list:
    """블록의 하위 블록(children)을 전부 가져온다 (페이지네이션 포함)."""
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
    }
    results = []
    cursor = None
    while True:
        url = f"https://api.notion.com/v1/blocks/{block_id}/children?page_size=100"
        if cursor:
            url += f"&start_cursor={cursor}"
        r = requests.get(url, headers=headers)
        r.raise_for_status()
        data = r.json()
        results.extend(data.get("results", []))
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
    return results

def rich_text_to_str(rich_text: list) -> str:
    return "".join([t.get("plain_text", "") for t in rich_text])

def render_block(block) -> dict:
    """블록 하나를 프론트에서 그리기 쉬운 딕셔너리로 변환."""
    block_type = block.get("type")
    block_data = block.get(block_type, {})
    
    if block_type == "image":
        image_obj = block_data.get("file") or block_data.get("external") or {}
        url = image_obj.get("url", "")
        caption = rich_text_to_str(block_data.get("caption", []))
        if not url:
            return None
        return {"type": "image", "url": url, "caption": caption}
        
    if block_type == "table":
        rows = fetch_block_children(block.get("id"))
        table_rows = []
        for row in rows:
            cells = row.get("table_row", {}).get("cells", [])
            table_rows.append([rich_text_to_str(cell) for cell in cells])
        if not table_rows:
            return None
        has_header = block_data.get("has_column_header", False)
        return {"type": "table", "rows": table_rows, "has_header": has_header}
        
    if block_type in ("heading_1", "heading_2", "heading_3"):
        text = rich_text_to_str(block_data.get("rich_text", []))
        if not text:
            return None
        return {"type": "heading", "level": int(block_type[-1]), "text": text}
        
    if block_type == "bulleted_list_item":
        text = rich_text_to_str(block_data.get("rich_text", []))
        if not text:
            return None
        return {"type": "bulleted_list_item", "text": text}
        
    if block_type == "numbered_list_item":
        text = rich_text_to_str(block_data.get("rich_text", []))
        if not text:
            return None
        return {"type": "numbered_list_item", "text": text}
        
    if block_type == "divider":
        return {"type": "divider"}
        
    # paragraph 등 나머지는 일반 텍스트로 처리
    text = rich_text_to_str(block_data.get("rich_text", []))
    if not text:
        return None
    return {"type": "paragraph", "text": text}

def get_page_blocks(page_id: str) -> list:
    """페이지 본문을 블록(문단/제목/표/이미지) 리스트로 가져온다."""
    try:
        blocks = fetch_block_children(page_id)
        rendered = [render_block(b) for b in blocks]
        return [b for b in rendered if b]
    except Exception as e:
        print(f"Error fetching page blocks for {page_id}: {e}")
        return []

INSIGHTS_DB_PATH = os.path.join(os.path.dirname(__file__), "data", "insights_db.json")

# 관리자 PIN SHA-256 단방향 해시 (기본 PIN 해시값, 소스코드 평문 노출 방지)
DEFAULT_ADMIN_PIN_HASH = "131927c002782b5d68ee2f9519ff55a72f9b969b9afaf37cc39127486d01af2e"
env_pin = os.getenv("ADMIN_PIN")
if env_pin:
    TARGET_ADMIN_PIN_HASH = hashlib.sha256(env_pin.encode("utf-8")).hexdigest()
else:
    TARGET_ADMIN_PIN_HASH = os.getenv("ADMIN_PIN_HASH", DEFAULT_ADMIN_PIN_HASH)

# 서버 측 무차별 대입(Brute-force) 방어 상태 저장소 (IP별 5회 실패 시 5분 차단)
ADMIN_AUTH_ATTEMPTS = {}

# 인증 완료된 1회용 세션 토큰 저장소 (유효시간 4시간)
ACTIVE_ADMIN_TOKENS = {}

def get_client_ip(request: Request) -> str:
    """프록시(Render / Nginx 등) 환경을 고려한 클라이언트 실제 IP 추출"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def verify_pin_secure(input_pin: str) -> bool:
    if not input_pin:
        return False
    input_hash = hashlib.sha256(input_pin.encode("utf-8")).hexdigest()
    return hmac.compare_digest(input_hash, TARGET_ADMIN_PIN_HASH)

def is_authorized_admin(token: Optional[str] = None, pin: Optional[str] = None) -> bool:
    """세션 토큰 또는 PIN 해시를 통한 관리자 인가 확인"""
    now = time.time()
    if token and token in ACTIVE_ADMIN_TOKENS:
        if now < ACTIVE_ADMIN_TOKENS[token]:
            return True
        else:
            del ACTIVE_ADMIN_TOKENS[token]
            
    if pin and verify_pin_secure(pin):
        return True
        
    return False

def sanitize_html_content(raw_html: str) -> str:
    """Stored XSS 방어를 위한 위험 태그 및 이벤트 핸들러 살균"""
    if not raw_html:
        return ""
    cleaned = re.sub(r'<\s*(script|iframe|object|embed|applet)[^>]*>.*?<\s*/\s*\1\s*>', '', str(raw_html), flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r'<\s*(script|iframe|object|embed|applet)[^>]*>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\bon\w+\s*=\s*(["\']).*?\1', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\bon\w+\s*=\s*[^\s>]+', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'href\s*=\s*(["\'])\s*javascript:[^"\']*\1', 'href="#"', cleaned, flags=re.IGNORECASE)
    return cleaned

def sanitize_insight_post(post: dict) -> dict:
    """칼럼 데이터 내 텍스트/HTML 및 블록 XSS 살균"""
    if not isinstance(post, dict):
        return post
    post["title"] = sanitize_html_content(str(post.get("title", ""))).strip()
    blocks = post.get("blocks", [])
    if isinstance(blocks, list):
        sanitized_blocks = []
        for b in blocks:
            if not isinstance(b, dict):
                continue
            b_copy = dict(b)
            if "text" in b_copy:
                raw_text = b_copy.get("text")
                if raw_text is not None and str(raw_text).strip() not in ("None", "null"):
                    b_copy["text"] = sanitize_html_content(str(raw_text))
                elif raw_text is None:
                    b_copy["text"] = ""
            if "html" in b_copy:
                raw_html = b_copy.get("html")
                if raw_html is not None and str(raw_html).strip() not in ("None", "null", ""):
                    b_copy["html"] = sanitize_html_content(str(raw_html))
                else:
                    b_copy.pop("html", None)
            if "url" in b_copy:
                url_str = str(b_copy["url"]).strip()
                if not (url_str.startswith("http://") or url_str.startswith("https://") or url_str.startswith("data:image/")):
                    b_copy["url"] = ""
                else:
                    b_copy["url"] = url_str
            sanitized_blocks.append(b_copy)
        post["blocks"] = sanitized_blocks
    return post

def load_local_insights_db():
    """로컬 insights_db.json에서 칼럼 목록을 즉각 로드 (0ms 초고속 캐시)"""
    if os.path.exists(INSIGHTS_DB_PATH):
        try:
            with open(INSIGHTS_DB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data and isinstance(data.get("posts"), list):
                    return data
        except Exception as e:
            print(f"Error loading insights_db.json: {e}")
    return None

def save_local_insights_db(data):
    """insights_db.json에 칼럼 데이터를 안전하게 원자적 저장 및 3개 디렉터리 동기화"""
    os.makedirs(os.path.dirname(INSIGHTS_DB_PATH), exist_ok=True)
    temp_path = INSIGHTS_DB_PATH + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    shutil.move(temp_path, INSIGHTS_DB_PATH)

    try:
        root_data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "insights_db.json"))
        dist_data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dajavata", "dist", "data", "insights_db.json"))
        for target_p in [root_data_path, dist_data_path]:
            if os.path.exists(os.path.dirname(target_p)):
                with open(target_p, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as sync_e:
        print(f"Error syncing insights_db: {sync_e}")

@app.get("/api/insights")
def get_insights():
    # 1. 자체 관리자 DB(insights_db.json)가 존재하면 0ms 즉시 반환!
    cached = load_local_insights_db()
    if cached:
        return cached

    # 2. 로컬 DB가 아직 없을 경우 노션 API Fallback
    if not NOTION_TOKEN or not NOTION_DATABASE_ID:
        return {"posts": []}
    
    try:
        url = f"https://api.notion.com/v1/databases/{NOTION_DATABASE_ID}/query"
        headers = {
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        }
        data = {
            "sorts": [
                {
                    "timestamp": "created_time",
                    "direction": "descending"
                }
            ]
        }
        r = requests.post(url, headers=headers, json=data, timeout=8)
        r.raise_for_status()
        response = r.json()
        
        posts = []
        for page in response.get("results", []):
            props = page.get("properties", {})
            title = "Untitled"
            for k, v in props.items():
                if v.get("type") == "title":
                    title_arr = v.get("title", [])
                    if title_arr:
                        title = title_arr[0].get("plain_text", "Untitled")
                    break
            
            blocks = get_page_blocks(page.get("id"))
            
            created_at = page.get("created_time", "").split("T")[0]
            for k, v in props.items():
                if v.get("type") == "date":
                    date_obj = v.get("date")
                    if date_obj and date_obj.get("start"):
                        created_at = date_obj.get("start")
                    break

            posts.append({
                "id": page.get("id"),
                "title": title,
                "blocks": blocks,
                "date": created_at
            })
            
        result = {"posts": posts}
        save_local_insights_db(result)
        return result
    except Exception as e:
        print(f"Notion API Error: {e}")
        return {"posts": []}

class AdminVerifyRequest(BaseModel):
    pin: str

class AdminSavePostRequest(BaseModel):
    pin: Optional[str] = None
    token: Optional[str] = None
    post: dict

class AdminDeletePostRequest(BaseModel):
    pin: Optional[str] = None
    token: Optional[str] = None
    id: str

@app.post("/api/insights/verify-admin")
def verify_admin(req: AdminVerifyRequest, request: Request):
    ip = get_client_ip(request)
    now = time.time()
    
    # 1. IP 기반 무차별 대입(Brute-force) 락아웃 검사
    attempt = ADMIN_AUTH_ATTEMPTS.get(ip, {"fails": 0, "lockout_until": 0.0})
    if now < attempt["lockout_until"]:
        remain = int(attempt["lockout_until"] - now)
        raise HTTPException(
            status_code=429, 
            detail=f"비밀번호 연속 5회 오류로 차단되었습니다. {remain}초 후 다시 시도해주세요."
        )
        
    # 2. PIN 해시 비교
    if verify_pin_secure(req.pin):
        ADMIN_AUTH_ATTEMPTS[ip] = {"fails": 0, "lockout_until": 0.0}
        token = secrets.token_hex(24)
        ACTIVE_ADMIN_TOKENS[token] = now + (4 * 3600)
        return {"success": True, "token": token, "message": "Admin authenticated"}
        
    # 3. 실패 시 카운트 증가
    fails = attempt["fails"] + 1
    if fails >= 5:
        ADMIN_AUTH_ATTEMPTS[ip] = {"fails": 0, "lockout_until": now + 300.0}
        raise HTTPException(
            status_code=429, 
            detail="비밀번호를 5회 연속 잘못 입력하여 5분간 입력이 제한됩니다."
        )
    else:
        ADMIN_AUTH_ATTEMPTS[ip] = {"fails": fails, "lockout_until": 0.0}
        raise HTTPException(
            status_code=401, 
            detail=f"PIN 번호가 일치하지 않습니다. (실패 {fails}/5회)"
        )

@app.post("/api/insights/save")
def save_insight_post(req: AdminSavePostRequest):
    if not is_authorized_admin(token=req.token, pin=req.pin):
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    post = req.post
    if not post or not post.get("title"):
        raise HTTPException(status_code=400, detail="Title is required")

    post = sanitize_insight_post(post)

    db = load_local_insights_db() or {"posts": []}
    posts = db.get("posts", [])

    post_id = post.get("id")
    if not post_id:
        post_id = f"post_{int(time.time())}"
        post["id"] = post_id

    existing_idx = next((i for i, p in enumerate(posts) if str(p.get("id")) == str(post_id)), -1)
    if existing_idx >= 0:
        posts[existing_idx] = post
    else:
        posts.insert(0, post)

    db["posts"] = posts
    db["updated_at"] = datetime.datetime.now().isoformat()
    save_local_insights_db(db)

    # 3개 디렉터리 동기화 (루트 data, dist data)
    try:
        root_data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "insights_db.json"))
        dist_data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dajavata", "dist", "data", "insights_db.json"))
        for target_p in [root_data_path, dist_data_path]:
            if os.path.exists(os.path.dirname(target_p)):
                with open(target_p, "w", encoding="utf-8") as f:
                    json.dump(db, f, ensure_ascii=False, indent=2)
    except Exception as sync_e:
        print(f"Error syncing insights_db: {sync_e}")

    return {"success": True, "post": post, "total": len(posts)}

@app.post("/api/insights/delete")
def delete_insight_post(req: AdminDeletePostRequest):
    if not is_authorized_admin(token=req.token, pin=req.pin):
        raise HTTPException(status_code=403, detail="Unauthorized")

    db = load_local_insights_db() or {"posts": []}
    posts = db.get("posts", [])
    posts = [p for p in posts if str(p.get("id")) != str(req.id)]

    db["posts"] = posts
    db["updated_at"] = datetime.datetime.now().isoformat()
    save_local_insights_db(db)

    # 3개 디렉터리 동기화
    try:
        root_data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "insights_db.json"))
        dist_data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dajavata", "dist", "data", "insights_db.json"))
        for target_p in [root_data_path, dist_data_path]:
            if os.path.exists(os.path.dirname(target_p)):
                with open(target_p, "w", encoding="utf-8") as f:
                    json.dump(db, f, ensure_ascii=False, indent=2)
    except Exception as sync_e:
        print(f"Error syncing insights_db: {sync_e}")

    return {"success": True, "deleted_id": req.id, "total": len(posts)}

# ==============================================================================
# 기업 개요 및 차트 분석 전용 독립 DB & API (자체 CMS & 3-디렉터리 동기화)
# ==============================================================================
COMPANY_DB_PATH = os.path.join(os.path.dirname(__file__), "data", "company_db.json")

def load_local_company_db():
    """로컬 company_db.json에서 기업개요/차트분석 목록을 즉각 로드 (0ms 초고속 캐시)"""
    if os.path.exists(COMPANY_DB_PATH):
        try:
            with open(COMPANY_DB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data and isinstance(data.get("posts"), list):
                    return data
        except Exception as e:
            print(f"Error loading company_db.json: {e}")
    return {"posts": []}

def save_local_company_db(data):
    """company_db.json에 기업개요 데이터를 안전하게 원자적 저장 및 3개 디렉터리 동기화"""
    os.makedirs(os.path.dirname(COMPANY_DB_PATH), exist_ok=True)
    temp_path = COMPANY_DB_PATH + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    shutil.move(temp_path, COMPANY_DB_PATH)

    try:
        root_data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "company_db.json"))
        dist_data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dajavata", "dist", "data", "company_db.json"))
        for target_p in [root_data_path, dist_data_path]:
            if os.path.exists(os.path.dirname(target_p)):
                with open(target_p, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as sync_e:
        print(f"Error syncing company_db: {sync_e}")

@app.get("/api/company")
def get_company():
    return load_local_company_db()

@app.post("/api/company/save")
def save_company_post(req: AdminSavePostRequest):
    if not is_authorized_admin(token=req.token, pin=req.pin):
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    post = req.post
    if not post or not post.get("title"):
        raise HTTPException(status_code=400, detail="Title is required")

    post = sanitize_insight_post(post)

    db = load_local_company_db()
    posts = db.get("posts", [])

    post_id = post.get("id")
    if not post_id:
        post_id = f"comp_{int(time.time())}"
        post["id"] = post_id

    existing_idx = next((i for i, p in enumerate(posts) if str(p.get("id")) == str(post_id)), -1)
    if existing_idx >= 0:
        posts[existing_idx] = post
    else:
        posts.insert(0, post)

    db["posts"] = posts
    db["updated_at"] = datetime.datetime.now().isoformat()
    save_local_company_db(db)

    return {"success": True, "post": post, "total": len(posts)}

@app.post("/api/company/delete")
def delete_company_post(req: AdminDeletePostRequest):
    if not is_authorized_admin(token=req.token, pin=req.pin):
        raise HTTPException(status_code=403, detail="Unauthorized")

    db = load_local_company_db()
    posts = db.get("posts", [])
    posts = [p for p in posts if str(p.get("id")) != str(req.id)]
    db["posts"] = posts
    db["updated_at"] = datetime.datetime.now().isoformat()
    save_local_company_db(db)

    return {"success": True, "deleted_id": req.id, "total": len(posts)}

# ==============================================================================
# 학습 자료 (Learning Hub) 전용 독립 DB & API (노션 완전 분리)
# ==============================================================================
LEARNING_DB_PATH = os.path.join(os.path.dirname(__file__), "data", "learning_db.json")

def load_local_learning_db():
    """로컬 learning_db.json에서 학습 자료 목록을 즉각 로드 (0ms 초고속 캐시)"""
    if os.path.exists(LEARNING_DB_PATH):
        try:
            with open(LEARNING_DB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data and isinstance(data.get("posts"), list):
                    return data
        except Exception as e:
            print(f"Error loading learning_db.json: {e}")
    return {"posts": []}

def save_local_learning_db(data):
    """learning_db.json에 학습 자료 데이터를 안전하게 원자적 저장 및 3개 디렉터리 동기화"""
    os.makedirs(os.path.dirname(LEARNING_DB_PATH), exist_ok=True)
    temp_path = LEARNING_DB_PATH + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    shutil.move(temp_path, LEARNING_DB_PATH)

    try:
        root_data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "learning_db.json"))
        dist_data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dajavata", "dist", "data", "learning_db.json"))
        for target_p in [root_data_path, dist_data_path]:
            if os.path.exists(os.path.dirname(target_p)):
                with open(target_p, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as sync_e:
        print(f"Error syncing learning_db: {sync_e}")

@app.get("/api/learning")
def get_learning():
    return load_local_learning_db()

@app.post("/api/learning/save")
def save_learning_post(req: AdminSavePostRequest):
    if not is_authorized_admin(token=req.token, pin=req.pin):
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    post = req.post
    if not post or not post.get("title"):
        raise HTTPException(status_code=400, detail="Title is required")

    post = sanitize_insight_post(post)

    db = load_local_learning_db()
    posts = db.get("posts", [])

    post_id = post.get("id")
    if not post_id:
        post_id = f"learn_{int(time.time())}"
        post["id"] = post_id

    existing_idx = next((i for i, p in enumerate(posts) if str(p.get("id")) == str(post_id)), -1)
    if existing_idx >= 0:
        posts[existing_idx] = post
    else:
        posts.insert(0, post)

    db["posts"] = posts
    db["updated_at"] = datetime.datetime.now().isoformat()
    save_local_learning_db(db)

    return {"success": True, "post": post, "total": len(posts)}

@app.post("/api/learning/delete")
def delete_learning_post(req: AdminDeletePostRequest):
    if not is_authorized_admin(token=req.token, pin=req.pin):
        raise HTTPException(status_code=403, detail="Unauthorized")

    db = load_local_learning_db()
    posts = db.get("posts", [])
    posts = [p for p in posts if str(p.get("id")) != str(req.id)]

    db["posts"] = posts
    db["updated_at"] = datetime.datetime.now().isoformat()
    save_local_learning_db(db)

    return {"success": True, "deleted_id": req.id, "total": len(posts)}

def is_valid_num(val):
    if val is None:
        return False
    try:
        f = float(val)
        return not (math.isnan(f) or math.isinf(f))
    except Exception:
        return False

def setup_korean_font():
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm
    font_names = ['Malgun Gothic', '맑은 고딕', 'NanumGothic', '나눔고딕', 'AppleGothic', 'DejaVu Sans']
    system_fonts = [f.name for f in fm.fontManager.ttflist]
    selected_font = None
    for name in font_names:
        if name in system_fonts:
            selected_font = name
            break
    if selected_font:
        plt.rc('font', family=selected_font)
    else:
        plt.rc('font', family='sans-serif')
    plt.rc('axes', unicode_minus=False)
    return selected_font

def fetch_stock_data(symbol: str, count: int = 300):
    import pandas as pd
    url = f"https://fchart.stock.naver.com/sise.nhn?symbol={symbol}&timeframe=day&count={count}&requestType=0"
    res = requests.get(url, timeout=5)
    res.raise_for_status()

    root = ET.fromstring(res.text)
    items = root.findall('.//item')

    if not items:
        return None

    data = []
    for item in items:
        val = item.attrib['data'].split('|')
        data.append({
            'Date': pd.to_datetime(val[0]),
            'Open': float(val[1]),
            'High': float(val[2]),
            'Low': float(val[3]),
            'Close': float(val[4]),
            'Volume': float(val[5])
        })

    df = pd.DataFrame(data)
    df.sort_values('Date', inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df

def compute_hts_rsi(series, period=14):
    delta = series.diff()
    u = delta.clip(lower=0)
    d = (-delta).clip(lower=0)
    avg_u = u.ewm(alpha=1/period, min_periods=period, adjust=False).mean()
    avg_d = d.ewm(alpha=1/period, min_periods=period, adjust=False).mean()
    rs = avg_u / avg_d
    rsi = 100 - (100 / (1 + rs))
    return rsi

@app.get("/api/chart/smc")
def get_smc_data(symbol: str):
    import numpy as np
    df = fetch_stock_data(symbol, count=300)
    if df is None:
        raise HTTPException(status_code=404, detail="Stock not found")

    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['MA60'] = df['Close'].rolling(window=60).mean()
    df['MA120'] = df['Close'].rolling(window=120).mean()

    # Bollinger Bands (20, 2)
    std20 = df['Close'].rolling(window=20).std()
    df['BB_Upper'] = df['MA20'] + (std20 * 2)
    df['BB_Lower'] = df['MA20'] - (std20 * 2)

    df['RSI'] = compute_hts_rsi(df['Close'], period=14)
    df['RSI_MA9'] = df['RSI'].rolling(window=9).mean()

    df['Vol_MA20'] = df['Volume'].rolling(window=20).mean()

    # Find Buy/Sell signals
    rsi_crossup = (df['RSI'] > df['RSI_MA9']) & (df['RSI'].shift(1) <= df['RSI_MA9'].shift(1))
    df['Buy_Signal'] = (df['RSI'] < 60) & rsi_crossup

    rsi_crossdown = (df['RSI'] < df['RSI_MA9']) & (df['RSI'].shift(1) >= df['RSI_MA9'].shift(1))
    df['Sell_Signal'] = (df['RSI'] > 60) & rsi_crossdown

    # Replace NaNs with None for JSON serialization
    df = df.replace({np.nan: None})
    
    # We will format this to a structure ECharts can consume easily
    dates = df['Date'].dt.strftime('%Y-%m-%d').tolist()
    # ECharts candlestick data format: [open, close, lowest, highest]
    ohlc = df[['Open', 'Close', 'Low', 'High']].values.tolist()
    volumes = df['Volume'].tolist()
    ma20 = df['MA20'].tolist()
    ma60 = df['MA60'].tolist()
    bb_up = df['BB_Upper'].tolist()
    bb_low = df['BB_Lower'].tolist()
    rsi = df['RSI'].tolist()
    rsi_ma = df['RSI_MA9'].tolist()
    
    # Buy/Sell markers
    buy_signals = []
    sell_signals = []
    for idx, row in df.iterrows():
        if row['Buy_Signal']:
            buy_signals.append({'coord': [dates[idx], row['Low']], 'value': 'Buy', 'rsi': row['RSI']})
        if row['Sell_Signal']:
            sell_signals.append({'coord': [dates[idx], row['High']], 'value': 'Sell', 'rsi': row['RSI']})
            
    return {
        "dates": dates,
        "ohlc": ohlc,
        "volumes": volumes,
        "ma20": ma20,
        "ma60": ma60,
        "bb_up": bb_up,
        "bb_low": bb_low,
        "rsi": rsi,
        "rsi_ma": rsi_ma,
        "buy_signals": buy_signals,
        "sell_signals": sell_signals,
        "symbol": symbol
    }

def get_zigzags(df, pct_change=0.15):
    zigzags = []
    last_high = df['High'].iloc[0]
    last_low = df['Low'].iloc[0]
    last_high_idx = 0
    last_low_idx = 0
    mode = 1 
    
    for i in range(1, len(df)):
        if mode == 1:
            if df['High'].iloc[i] > last_high:
                last_high = df['High'].iloc[i]
                last_high_idx = i
            elif df['Close'].iloc[i] < last_high * (1 - pct_change):
                zigzags.append({'index': last_high_idx, 'type': 'high', 'val': last_high})
                mode = -1
                last_low = df['Low'].iloc[i]
                last_low_idx = i
        else:
            if df['Low'].iloc[i] < last_low:
                last_low = df['Low'].iloc[i]
                last_low_idx = i
            elif df['Close'].iloc[i] > last_low * (1 + pct_change):
                zigzags.append({'index': last_low_idx, 'type': 'low', 'val': last_low})
                mode = 1
                last_high = df['High'].iloc[i]
                last_high_idx = i
                
    if mode == 1:
        zigzags.append({'index': last_high_idx, 'type': 'high', 'val': last_high})
    else:
        zigzags.append({'index': last_low_idx, 'type': 'low', 'val': last_low})
        
    return zigzags

@app.get("/api/chart/auto")
def get_auto_chart(symbol: str):
    import io
    import matplotlib
    import matplotlib.pyplot as plt
    df = fetch_stock_data(symbol, count=400)
    if df is None:
        raise HTTPException(status_code=404, detail="Stock not found")

    setup_korean_font()
    matplotlib.use('Agg')
    
    fig = plt.figure(figsize=(14, 8), facecolor='#0B0F19')
    ax1 = fig.add_subplot(111)
    
    ax1.set_facecolor('#111827')
    ax1.grid(True, color='#1F2937', linestyle='--', linewidth=0.7, alpha=0.7)
    ax1.tick_params(colors='#9CA3AF', labelsize=10)
    for spine in ax1.spines.values():
        spine.set_color('#374151')

    ax1.plot(df['Date'], df['Close'], color='#38BDF8', linewidth=1.8, label='종가 (Close)')
    
    zigzags = get_zigzags(df, pct_change=0.15)
    zz_dates = [df['Date'].iloc[z['index']] for z in zigzags]
    zz_vals = [z['val'] for z in zigzags]
    
    ax1.plot(zz_dates, zz_vals, color='#F59E0B', linestyle='-', linewidth=2.0, marker='o', markersize=6, label='Elliott Waves (ZigZag)')
    
    wave_labels = ['1', '2', '3', '4', '5', 'A', 'B', 'C']
    
    if len(zigzags) >= 8:
        recent_zz = zigzags[-8:]
        for i, z in enumerate(recent_zz):
            date = df['Date'].iloc[z['index']]
            val = z['val']
            offset = 1.04 if z['type'] == 'high' else 0.94
            color = '#10B981' if i < 5 else '#EF4444'
            ax1.text(date, val * offset, wave_labels[i], color=color, 
                     fontsize=15, fontweight='bold', ha='center', va='center',
                     bbox=dict(boxstyle='circle,pad=0.3', facecolor='#1F2937', edgecolor=color, alpha=0.8))
    else:
        for i, z in enumerate(zigzags):
            date = df['Date'].iloc[z['index']]
            val = z['val']
            offset = 1.04 if z['type'] == 'high' else 0.94
            ax1.text(date, val * offset, str(i), color='#10B981', fontsize=12, fontweight='bold', ha='center', va='center',
                     bbox=dict(boxstyle='circle,pad=0.3', facecolor='#1F2937', edgecolor='#10B981', alpha=0.8))

    ax1.set_title(f"{symbol} 일봉 차트 자동 작도 분석", fontsize=18, fontweight='bold', color='#F9FAFB', pad=20, loc='left')
    ax1.set_ylabel("주가 (KRW)", fontsize=11, color='#D1D5DB', labelpad=10)
    ax1.legend(loc='upper left', facecolor='#1F2937', edgecolor='#374151', labelcolor='#E5E7EB', fontsize=11)
    ax1.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda x, p: f"{int(x):,}"))

    latest = df.iloc[-1]
    info_text = f"현재가: {latest['Close']:,.0f} KRW | 기준일자: {latest['Date'].strftime('%Y-%m-%d')}"
    ax1.text(0.98, 0.95, info_text, transform=ax1.transAxes, fontsize=11,
             color='#E5E7EB', horizontalalignment='right', verticalalignment='top',
             bbox=dict(boxstyle='round,pad=0.6', facecolor='#1F2937', edgecolor='#374151', alpha=0.9))

    fig.autofmt_xdate(bottom=0.08, rotation=15, ha='right')
    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=200, bbox_inches='tight', facecolor=fig.get_facecolor())
    buf.seek(0)
    plt.close(fig)

    return StreamingResponse(buf, media_type="image/png")

# --- Theme calculation logic ---
THEME_ETF_MAP = {
    "2차전지": "305540",      # TIGER 2차전지테마
    "반도체 장비": "091160",   # KODEX 반도체
    "의료AI": "447770",       # KODEX K-로봇액티브
    "로봇": "447770",        # KODEX K-로봇액티브
    "우주항공": "439250",     # ARIRANG 우주항공&UAM iSelect
    "바이오/제약": "143860",   # TIGER 헬스케어
    "IT": "139260",         # TIGER IT
    "자동차": "091180",       # KODEX 자동차
    "건설": "117700",       # TIGER 건설건자재
    "엔터테인먼트": "157500",  # TIGER 미디어컨텐츠
}

def calculate_rsi_for_theme(df, period=14):
    if df is None or len(df) < 2:
        return None
    period = min(period, len(df) - 1)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period, min_periods=1).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period, min_periods=1).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    rsi = rsi.fillna(50)
    return rsi.iloc[-1]

def calculate_theme_metrics():
    """
    Fetches data using FinanceDataReader (No API Key Required) and calculates metrics for the frontend table.
    """
    import pandas as pd
    import FinanceDataReader as fdr
    results = []
    
    # Fetch 3 years of data
    start_date = (datetime.datetime.today() - datetime.timedelta(days=1095)).strftime("%Y-%m-%d")
    
    for s_name, ticker in THEME_ETF_MAP.items():
        try:
            # Fetch data from Naver Finance / KRX
            df = fdr.DataReader(ticker, start=start_date)
            if df is None or df.empty:
                continue
                
            # Reset index to make 'Date' a column if it's the index
            if df.index.name == 'Date':
                df = df.reset_index()
                
            # Ensure required columns exist
            if 'Close' not in df.columns:
                continue
                
            # Get latest close
            latest = df.iloc[-1]
            latest_price = latest['Close']
            
            # Calculate metrics
            day1_price = df.iloc[-2]['Close'] if len(df) >= 2 else latest_price
            day3_price = df.iloc[-4]['Close'] if len(df) >= 4 else day1_price
            
            day1_change = (latest_price - day1_price) / day1_price * 100
            day3_change = (latest_price - day3_price) / day3_price * 100
            
            # 52 weeks (approx 252 trading days)
            df_52w = df.tail(252)
            high_52w = df_52w['Close'].max()
            low_52w = df_52w['Close'].min()
            
            high_52w_pct = (latest_price - low_52w) / low_52w * 100 if low_52w > 0 else 0
            low_52w_pct = (latest_price - high_52w) / high_52w * 100 if high_52w > 0 else 0
            neglect_52w = int(100 - ((latest_price - low_52w) / (high_52w - low_52w) * 100)) if high_52w != low_52w else 50
            
            # 3 years (approx 756 trading days)
            high_3y = df['Close'].max()
            low_3y = df['Close'].min()
            
            high_3y_pct = (latest_price - low_3y) / low_3y * 100 if low_3y > 0 else 0
            low_3y_pct = (latest_price - high_3y) / high_3y * 100 if high_3y > 0 else 0
            neglect_3y = int(100 - ((latest_price - low_3y) / (high_3y - low_3y) * 100)) if high_3y != low_3y else 50
            
            # RSI
            rsi_d = calculate_rsi_for_theme(df, period=14)
            
            # Resample needs datetime index
            if 'Date' in df.columns:
                df_time = df.set_index('Date')
            else:
                df_time = df
                
            df_w = df_time.resample('W').last()
            rsi_w = calculate_rsi_for_theme(df_w, period=14)
            
            df_m = df_time.resample('ME').last()
            rsi_m = calculate_rsi_for_theme(df_m, period=14)
            
            # Expected Return (Mock logic based on neglect index or RSI)
            exp_return = max(0, neglect_52w * 1.5 - (rsi_d if rsi_d else 50) * 0.5)
            
            results.append({
                "name": s_name,
                "desc": f"{s_name} 관련 펀드(ETF: {ticker}) 성과입니다.",
                "day1": f"{day1_change:+.2f}%",
                "day1Pos": bool(day1_change >= 0),
                "day3": f"{day3_change:+.2f}%",
                "day3Pos": bool(day3_change >= 0),
                "high52": f"{high_52w_pct:+.1f}%",
                "high52Pos": bool(high_52w_pct >= 0),
                "low52": f"{low_52w_pct:+.1f}%",
                "low52Pos": bool(low_52w_pct >= 0),
                "neglect52": str(neglect_52w),
                "high3y": f"{high_3y_pct:+.1f}%",
                "high3yPos": bool(high_3y_pct >= 0),
                "low3y": f"{low_3y_pct:+.1f}%",
                "low3yPos": bool(low_3y_pct >= 0),
                "neglect3y": str(neglect_3y),
                "expReturn": f"{exp_return:.0f}%",
                "rsi_d": f"{rsi_d:.1f}" if is_valid_num(rsi_d) else "-",
                "rsi_w": f"{rsi_w:.1f}" if is_valid_num(rsi_w) else "-",
                "rsi_m": f"{rsi_m:.1f}" if is_valid_num(rsi_m) else "-",
                "update": datetime.datetime.now().strftime("%m.%d")
            })
        except Exception as e:
            print(f"Error processing {s_name}: {e}")
            continue
            
    return results

import math

def sanitize(obj):
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize(v) for v in obj]
    elif isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj

_live_naver_theme_cache = {"time": 0, "map": {}}

def fetch_live_naver_theme_rankings():
    """네이버 금융 실시간 테마 등락률을 0.4초 내에 조회 (3분 메모리 캐시)"""
    now_ts = time.time()
    if _live_naver_theme_cache["map"] and (now_ts - _live_naver_theme_cache["time"] < 180):
        return _live_naver_theme_cache["map"]

    theme_map = {}
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    cursor = None
    try:
        for _ in range(4):
            url = "https://stock.naver.com/api/stockSecurity/rankings/v2/domestic/themes?sortType=changeRate&size=100&period=daily"
            if cursor:
                url += f"&cursor={cursor}"
            res = requests.get(url, headers=headers, timeout=3)
            if res.status_code != 200:
                break
            data = res.json()
            items = data.get("items", [])
            if not items:
                break
            for idx, item in enumerate(items):
                t_name = item.get("name")
                t_code = str(item.get("code", ""))
                try:
                    chg = float(item.get("changeRate", 0))
                except Exception:
                    chg = 0.0
                if t_name:
                    theme_map[t_name] = {"code": t_code, "day1Pos": chg}
            cursor = data.get("cursor")
            if not cursor:
                break
        if theme_map:
            _live_naver_theme_cache["map"] = theme_map
            _live_naver_theme_cache["time"] = now_ts
    except Exception as e:
        print(f"[Live Theme Overlay] Error: {e}")
    return theme_map

def get_effective_kst_slot(file_kst_dt):
    """
    평일 08:15 ~ 20:15 매시 15분 정기 업데이트 슬롯과 파일 수정 시각 중 더 최신 시각을 산출
    """
    kst_tz = datetime.timezone(datetime.timedelta(hours=9))
    now_kst = datetime.datetime.now(kst_tz)
    slot_dt = file_kst_dt

    # 평일(월~금) 기준 가장 최근의 08:15 ~ 20:15 매시 15분 슬롯 계산
    if now_kst.weekday() < 5:
        if now_kst.hour > 20 or (now_kst.hour == 20 and now_kst.minute >= 15):
            candidate_slot = now_kst.replace(hour=20, minute=15, second=0, microsecond=0)
        elif now_kst.hour > 8 or (now_kst.hour == 8 and now_kst.minute >= 15):
            target_hr = now_kst.hour if now_kst.minute >= 15 else (now_kst.hour - 1)
            candidate_slot = now_kst.replace(hour=target_hr, minute=15, second=0, microsecond=0)
        else:
            # 평일 00:00 ~ 08:14 사이: 전 영업일 20:15 최종 마감 정산 슬롯 반영
            days_back = 3 if now_kst.weekday() == 0 else 1
            prev_date = now_kst - datetime.timedelta(days=days_back)
            candidate_slot = prev_date.replace(hour=20, minute=15, second=0, microsecond=0)

        if candidate_slot > slot_dt:
            slot_dt = candidate_slot
    else:
        # 주말(토, 일): 직전 금요일 20:15 마감 슬롯 적용
        days_back = 2 if now_kst.weekday() == 6 else 1
        prev_date = now_kst - datetime.timedelta(days=days_back)
        candidate_slot = prev_date.replace(hour=20, minute=15, second=0, microsecond=0)
        if candidate_slot > slot_dt:
            slot_dt = candidate_slot

    return slot_dt

@app.get("/api/themes")
def get_themes():
    cache_candidates = [
        'data/theme_cache.json',
        '../data/theme_cache.json',
        'dajavata_backend/data/theme_cache.json',
        os.path.join(os.path.dirname(__file__), 'data', 'theme_cache.json'),
        os.path.join(os.path.dirname(__file__), '..', 'data', 'theme_cache.json'),
    ]
    
    # 1. theme_cache.json 파일 후보군 중 가장 최신 파일 우선 검증
    existing_caches = [f for f in cache_candidates if os.path.exists(f) and os.path.getsize(f) > 10]
    existing_caches.sort(key=lambda x: os.path.getmtime(x), reverse=True)
    for cache_file in existing_caches:
            try:
                mtime = os.path.getmtime(cache_file)
                kst_tz = datetime.timezone(datetime.timedelta(hours=9))
                kst_dt = datetime.datetime.fromtimestamp(mtime, tz=kst_tz)

                with open(cache_file, 'r', encoding='utf-8') as f:
                    raw_themes = json.load(f)
                    
                if raw_themes and len(raw_themes) > 0:
                    effective_dt = get_effective_kst_slot(kst_dt)
                    # 파일이 최근 정기 슬롯보다 오래된 경우 네이버 실시간 테마 등락률 즉시 동기화
                    if effective_dt > kst_dt or (time.time() - mtime > 1200):
                        live_map = fetch_live_naver_theme_rankings()
                        if live_map:
                            for t in raw_themes:
                                t_name = t.get("name", "")
                                if t_name in live_map:
                                    t["day1Pos"] = live_map[t_name]["day1Pos"]
                                    if not t.get("theme_id") and live_map[t_name]["code"]:
                                        t["theme_id"] = live_map[t_name]["code"]
                            raw_themes.sort(key=lambda x: x.get("day1Pos") if x.get("day1Pos") is not None else -999, reverse=True)

                    update_str = effective_dt.strftime("%m.%d %H:%M")
                    updated_iso = effective_dt.strftime("%Y-%m-%d %H:%M:%S")

                    formatted_themes = []
                    for t in raw_themes:
                        d1 = t.get('day1Pos')
                        d3 = t.get('day3Pos')
                        h52 = t.get('high52')
                        l52 = t.get('low52')
                        n52 = t.get('neglect52')
                        h3y = t.get('high3y')
                        l3y = t.get('low3y')
                        n3y = t.get('neglect3y')
                        exp = t.get('expReturn')
                        formatted_themes.append({
                            "name": t.get("name", ""),
                            "theme_id": t.get("theme_id", ""),
                            "desc": f"{t.get('name', '')} 테마 구성종목 평균 데이터입니다.",
                            "day1": f"{d1:+.2f}%" if is_valid_num(d1) else "-",
                            "day1Pos": bool(d1 >= 0) if is_valid_num(d1) else True,
                            "day3": f"{d3:+.2f}%" if is_valid_num(d3) else "-",
                            "day3Pos": bool(d3 >= 0) if is_valid_num(d3) else True,
                            "high52": f"{h52:+.1f}%" if is_valid_num(h52) else "-",
                            "high52Pos": bool(h52 >= 0) if is_valid_num(h52) else True,
                            "low52": f"{l52:+.1f}%" if is_valid_num(l52) else "-",
                            "low52Pos": bool(l52 >= 0) if is_valid_num(l52) else True,
                            "neglect52": f"{n52:.0f}" if is_valid_num(n52) else "-",
                            "high3y": f"{h3y:+.1f}%" if is_valid_num(h3y) else "-",
                            "high3yPos": bool(h3y >= 0) if is_valid_num(h3y) else True,
                            "low3y": f"{l3y:+.1f}%" if is_valid_num(l3y) else "-",
                            "low3yPos": bool(l3y >= 0) if is_valid_num(l3y) else True,
                            "neglect3y": f"{n3y:.0f}" if is_valid_num(n3y) else "-",
                            "expReturn": f"{exp:.0f}%" if is_valid_num(exp) else "-",
                            "rsi_d": "-",
                            "rsi_w": "-",
                            "rsi_m": "-",
                            "update": update_str,
                            "score": t.get("score", 100)
                        })
                    return {"themes": sanitize(formatted_themes), "updated_at": updated_iso}
            except Exception as e:
                print(f"[Themes] Error reading {cache_file}:", e)
                
    # 2. theme_details.json 기반 실시간 복구 Fallback
    detail_candidates = [
        'data/theme_details.json',
        '../data/theme_details.json',
        'dajavata_backend/data/theme_details.json',
        os.path.join(os.path.dirname(__file__), 'data', 'theme_details.json'),
        os.path.join(os.path.dirname(__file__), '..', 'data', 'theme_details.json'),
    ]
    existing_details = [f for f in detail_candidates if os.path.exists(f) and os.path.getsize(f) > 10]
    existing_details.sort(key=lambda x: os.path.getmtime(x), reverse=True)
    for detail_file in existing_details:
            try:
                mtime = os.path.getmtime(detail_file)
                kst_dt = datetime.datetime.fromtimestamp(mtime, tz=datetime.timezone(datetime.timedelta(hours=9)))
                update_str = kst_dt.strftime("%m.%d %H:%M")
                updated_iso = kst_dt.strftime("%Y-%m-%d %H:%M:%S")
                with open(detail_file, 'r', encoding='utf-8') as f:
                    theme_details_map = json.load(f)
                if theme_details_map and len(theme_details_map) > 0:
                    formatted_themes = []
                    import pandas as pd
                    for t_name, stocks in theme_details_map.items():
                        if not stocks:
                            continue
                        df_s = pd.DataFrame(stocks)
                        d1 = df_s['day1'].mean() if 'day1' in df_s else 0
                        d3 = df_s['day3'].mean() if 'day3' in df_s else 0
                        h52 = df_s['high52'].mean() if 'high52' in df_s else 0
                        l52 = df_s['low52'].mean() if 'low52' in df_s else 0
                        n52 = df_s['neglect52'].mean() if 'neglect52' in df_s else 0
                        h3y = df_s['high3y'].mean() if 'high3y' in df_s else 0
                        l3y = df_s['low3y'].mean() if 'low3y' in df_s else 0
                        n3y = df_s['neglect3y'].mean() if 'neglect3y' in df_s else 0
                        exp = df_s['expReturn'].mean() if 'expReturn' in df_s else 0
                        formatted_themes.append({
                            "name": t_name,
                            "theme_id": "",
                            "desc": f"{t_name} 테마 구성종목 평균 데이터입니다.",
                            "day1": f"{d1:+.2f}%" if is_valid_num(d1) else "-",
                            "day1Pos": bool(d1 >= 0) if is_valid_num(d1) else True,
                            "day3": f"{d3:+.2f}%" if is_valid_num(d3) else "-",
                            "day3Pos": bool(d3 >= 0) if is_valid_num(d3) else True,
                            "high52": f"{h52:+.1f}%" if is_valid_num(h52) else "-",
                            "high52Pos": bool(h52 >= 0) if is_valid_num(h52) else True,
                            "low52": f"{l52:+.1f}%" if is_valid_num(l52) else "-",
                            "low52Pos": bool(l52 >= 0) if is_valid_num(l52) else True,
                            "neglect52": f"{n52:.0f}" if is_valid_num(n52) else "-",
                            "high3y": f"{h3y:+.1f}%" if is_valid_num(h3y) else "-",
                            "high3yPos": bool(h3y >= 0) if is_valid_num(h3y) else True,
                            "low3y": f"{l3y:+.1f}%" if is_valid_num(l3y) else "-",
                            "low3yPos": bool(l3y >= 0) if is_valid_num(l3y) else True,
                            "neglect3y": f"{n3y:.0f}" if is_valid_num(n3y) else "-",
                            "expReturn": f"{exp:.0f}%" if is_valid_num(exp) else "-",
                            "rsi_d": "-",
                            "rsi_w": "-",
                            "rsi_m": "-",
                            "update": update_str,
                            "score": 100
                        })
                    if formatted_themes:
                        return {"themes": sanitize(formatted_themes), "updated_at": updated_iso}
            except Exception as e:
                print(f"[Themes Fallback] Error reading {detail_file}:", e)
                
    # 3. 최후 수단: calculate_theme_metrics()
    themes = calculate_theme_metrics()
    now_kst = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
    return {"themes": sanitize(themes), "updated_at": now_kst.strftime("%Y-%m-%d %H:%M:%S")}

def resolve_theme_details(theme_name: str):
    import urllib.parse
    cleaned_names = [
        theme_name,
        urllib.parse.unquote(theme_name),
        theme_name.strip(),
        urllib.parse.unquote(theme_name).strip()
    ]
    
    file_candidates = [
        'data/theme_details.json',
        '../data/theme_details.json',
        'dajavata_backend/data/theme_details.json'
    ]
    
    for file_path in file_candidates:
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if not data or len(data) == 0:
                    continue
                
                # 1. Exact match
                for name in cleaned_names:
                    if name in data:
                        return {"theme": name, "stocks": sanitize(data[name])}
                
                # 2. Case-insensitive / whitespace-stripped match
                for name in cleaned_names:
                    norm_target = name.replace(' ', '').lower()
                    for k in data.keys():
                        if k.replace(' ', '').lower() == norm_target:
                            return {"theme": k, "stocks": sanitize(data[k])}
            except Exception as e:
                print(f"[Theme Detail] Error reading {file_path}:", e)
                
    raise HTTPException(status_code=404, detail=f"Theme '{theme_name}' not found")

@app.get("/api/themes/detail")
def get_theme_detail_query(name: str):
    return resolve_theme_details(name)

@app.get("/api/themes/{theme_name:path}")
def get_theme_details(theme_name: str):
    return resolve_theme_details(theme_name)

@app.get("/api/stocks")
def get_stocks():
    return stock_list

_live_fundamentals_cache = None
_live_fundamentals_time = 0

@app.get("/api/stocks/fundamentals")
def get_stocks_fundamentals():
    global _live_fundamentals_cache, _live_fundamentals_time
    now = time.time()
    if _live_fundamentals_cache and (now - _live_fundamentals_time < 30):
        return _live_fundamentals_cache

    candidate_paths = [
        'data/all_stocks.json',
        'dajavata_backend/data/all_stocks.json',
        '../data/all_stocks.json',
        os.path.join(os.path.dirname(__file__), 'data', 'all_stocks.json'),
        os.path.join(os.path.dirname(__file__), '..', 'data', 'all_stocks.json')
    ]
    existing_stock_files = [p for p in candidate_paths if os.path.exists(p) and os.path.getsize(p) > 1000]
    existing_stock_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
    file_path = existing_stock_files[0] if existing_stock_files else None

    if file_path:
        try:
            mtime = os.path.getmtime(file_path)
            kst_dt = datetime.datetime.fromtimestamp(mtime, tz=datetime.timezone(datetime.timedelta(hours=9)))
            effective_dt = get_effective_kst_slot(kst_dt)
            update_str = effective_dt.strftime("%m.%d %H:%M")
            updated_iso = effective_dt.strftime("%Y-%m-%d %H:%M:%S")

            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            for s in data:
                s["update"] = update_str
            
            result = {"stocks": sanitize(data), "updated_at": updated_iso}
            _live_fundamentals_cache = result
            _live_fundamentals_time = now
            return result
        except Exception as e:
            print(f"[Fundamentals] Error reading {file_path}:", e)

    # Fallback: extract unique stocks from theme_details.json
    detail_candidates = [
        'data/theme_details.json',
        'dajavata_backend/data/theme_details.json',
        '../data/theme_details.json',
        os.path.join(os.path.dirname(__file__), 'data', 'theme_details.json')
    ]
    for d_path in detail_candidates:
        if os.path.exists(d_path) and os.path.getsize(d_path) > 1000:
            try:
                mtime = os.path.getmtime(d_path)
                kst_dt = datetime.datetime.fromtimestamp(mtime, tz=datetime.timezone(datetime.timedelta(hours=9)))
                update_str = kst_dt.strftime("%m.%d %H:%M")
                updated_iso = kst_dt.strftime("%Y-%m-%d %H:%M:%S")
                with open(d_path, 'r', encoding='utf-8') as f:
                    theme_map = json.load(f)
                seen_codes = set()
                stocks_extracted = []
                for t_name, st_list in theme_map.items():
                    for s in st_list:
                        c = s.get('code')
                        if c and c not in seen_codes:
                            seen_codes.add(c)
                            s_copy = dict(s)
                            if not s_copy.get('update'):
                                s_copy['update'] = update_str
                            stocks_extracted.append(s_copy)
                if stocks_extracted:
                    result = {"stocks": sanitize(stocks_extracted), "updated_at": updated_iso}
                    _live_fundamentals_cache = result
                    _live_fundamentals_time = now
                    return result
            except Exception as e:
                print(f"[Fundamentals Fallback] Error reading {d_path}:", e)

    now_kst = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
    fallback_stocks = [{"code": s.get("code"), "name": s.get("name"), "current_price": 0, "day1": 0, "day3": 0, "marcap": 0, "update": now_kst.strftime("%m.%d %H:%M")} for s in stock_list]
    return {"stocks": sanitize(fallback_stocks), "updated_at": now_kst.strftime("%Y-%m-%d %H:%M:%S")}

@app.get("/api/stocks/realtime")
def get_stocks_realtime(codes: str):
    """
    네이버 실시간 폴링 API 프록시: 종목코드 목록(쉼표 구분)을 받아 현재가 및 당일 등락률을 실시간 반환
    """
    clean_codes = ",".join([c.strip().upper() for c in codes.split(",") if c.strip()])
    if not clean_codes:
        return {"realtime": {}}
    
    url = f"https://polling.finance.naver.com/api/realtime/domestic/stock/{clean_codes}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://finance.naver.com'
    }
    try:
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            data = r.json()
            realtime_map = {}
            for item in data.get("datas", []):
                code = item.get("itemCode")
                if code:
                    close_raw = item.get("closePriceRaw") or item.get("closePrice")
                    try:
                        price = float(str(close_raw).replace(",", ""))
                    except Exception:
                        price = None
                    ratio_raw = item.get("fluctuationsRatioRaw") or item.get("fluctuationsRatio")
                    try:
                        ratio = float(str(ratio_raw).replace("%", ""))
                    except Exception:
                        ratio = None
                    realtime_map[code] = {
                        "code": code,
                        "name": item.get("stockName"),
                        "current_price": price,
                        "day1": ratio,
                        "market_status": item.get("marketStatus"),
                        "traded_at": item.get("localTradedAt")
                    }
            return {"realtime": realtime_map}
    except Exception as e:
        print(f"[Realtime API Error]: {e}")
    return {"realtime": {}}

_stock_briefing_cache = {}

@app.get("/api/stocks/briefing/{code}")
def get_stock_briefing(code: str):
    """
    개별 종목 클릭 시 매수/매도 판단에 필요한 종합 브리핑(외인·기관 수급, 핵심 투자지표, 목표주가, 증권사 리포트, 실시간 특징주 뉴스)을 반환
    """
    clean_code = code.strip().upper()
    now_ts = time.time()
    cached = _stock_briefing_cache.get(clean_code)
    if cached and (now_ts - cached["ts"] < 120):
        return cached["data"]

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://m.stock.naver.com/'
    }
    result = {
        "code": clean_code,
        "name": clean_code,
        "market": "KRX",
        "closePrice": None,
        "fluctuationsRatio": None,
        "totalInfos": {},
        "dealTrends": [],
        "consensus": {},
        "researches": [],
        "news": []
    }

    try:
        r_basic = requests.get(f"https://m.stock.naver.com/api/stock/{clean_code}/basic", headers=headers, timeout=4)
        if r_basic.status_code == 200:
            b_data = r_basic.json()
            result["name"] = b_data.get("stockName") or clean_code
            result["market"] = b_data.get("stockExchangeName") or b_data.get("sosok") or "KRX"
            result["closePrice"] = b_data.get("closePrice")
            result["fluctuationsRatio"] = b_data.get("fluctuationsRatio")
    except Exception as e:
        print(f"[Briefing Basic Error] {clean_code}: {e}")

    try:
        r_integ = requests.get(f"https://m.stock.naver.com/api/stock/{clean_code}/integration", headers=headers, timeout=4)
        if r_integ.status_code == 200:
            i_data = r_integ.json()
            if i_data.get("stockName"):
                result["name"] = i_data.get("stockName")
            info_map = {}
            for item in i_data.get("totalInfos", []):
                k = item.get("code") or item.get("key")
                if k:
                    info_map[k] = {
                        "label": item.get("key") or k,
                        "value": item.get("value")
                    }
            result["totalInfos"] = info_map
            result["dealTrends"] = i_data.get("dealTrendInfos", [])[:10]
            result["consensus"] = i_data.get("consensusInfo") or {}
            result["researches"] = i_data.get("researches", [])[:5]
    except Exception as e:
        print(f"[Briefing Integration Error] {clean_code}: {e}")

    try:
        r_news = requests.get(f"https://m.stock.naver.com/api/news/stock/{clean_code}?pageSize=6&page=1", headers=headers, timeout=4)
        if r_news.status_code == 200:
            n_data = r_news.json()
            news_items = []
            for group in (n_data if isinstance(n_data, list) else []):
                for it in group.get("items", []):
                    dt_raw = str(it.get("datetime", ""))
                    dt_fmt = f"{dt_raw[4:6]}.{dt_raw[6:8]} {dt_raw[8:10]}:{dt_raw[10:12]}" if len(dt_raw) >= 12 else dt_raw
                    oid = it.get("officeId", "")
                    aid = it.get("articleId", "")
                    url = it.get("mobileNewsUrl") or (f"https://n.news.naver.com/mnews/article/{oid}/{aid}" if oid and aid else "#")
                    news_items.append({
                        "title": it.get("titleFull") or it.get("title") or "",
                        "office": it.get("officeName") or "",
                        "datetime": dt_fmt,
                        "body": (it.get("body") or "")[:140],
                        "url": url
                    })
                    if len(news_items) >= 6:
                        break
                if len(news_items) >= 6:
                    break
            result["news"] = news_items
    except Exception as e:
        print(f"[Briefing News Error] {clean_code}: {e}")

    _stock_briefing_cache[clean_code] = {"ts": now_ts, "data": result}
    return result

@app.get("/api/chart/{code}")
def get_stock_chart(code: str, periodType: str = "dayCandle"):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        # 해외 주식 판별 (한국 6자리 종목코드 예: 005930, 0233A0는 국내 주식)
        clean_code = code.strip().upper()
        is_korean = (len(clean_code) == 6 and any(ch.isdigit() for ch in clean_code[:3])) or clean_code.isdigit()
        is_overseas = not is_korean
        if is_overseas:
            ticker = clean_code
            base_ticker = ticker.split('.')[0] if ticker.endswith(('.O', '.N', '.K', '.A')) else ticker
            yf_ticker = base_ticker.replace('.', '-')

            # 1차: Yahoo Finance v8 Chart API (전 세계 모든 미국 주식·ETF 6,000+ 실시간 지원)
            yf_interval = "1d"
            yf_range = "1y"
            if periodType in ("weekCandle", "week"):
                yf_interval = "1wk"
                yf_range = "5y"
            elif periodType in ("monthCandle", "month"):
                yf_interval = "1mo"
                yf_range = "10y"
            elif periodType in ("yearCandle", "year"):
                yf_interval = "3mo"
                yf_range = "max"
            elif periodType in ("1m", "2m", "5m", "15m", "30m", "60m", "1h"):
                yf_interval = "60m" if periodType == "1h" else periodType
                yf_range = "5d" if yf_interval in ("1m", "2m", "5m") else "1mo"
            elif periodType == "day":
                yf_interval = "5m"
                yf_range = "5d"

            for yf_host in ("query1.finance.yahoo.com", "query2.finance.yahoo.com"):
                yf_url = f"https://{yf_host}/v8/finance/chart/{yf_ticker}?interval={yf_interval}&range={yf_range}"
                try:
                    yr = requests.get(yf_url, headers=headers, timeout=5)
                    if yr.status_code == 200:
                        ydata = yr.json()
                        result_list = (ydata.get("chart") or {}).get("result") or []
                        if result_list:
                            res0 = result_list[0]
                            timestamps = res0.get("timestamp") or []
                            quote_list = ((res0.get("indicators") or {}).get("quote")) or []
                            if timestamps and quote_list:
                                q = quote_list[0]
                                opens = q.get("open") or []
                                highs = q.get("high") or []
                                lows = q.get("low") or []
                                closes = q.get("close") or []
                                vols = q.get("volume") or []
                                is_intra = yf_interval.endswith("m") or yf_interval.endswith("h")
                                priceInfos = []
                                seen_dates = set()
                                for idx_t, ts in enumerate(timestamps):
                                    if idx_t >= len(closes) or closes[idx_t] is None:
                                        continue
                                    c_val = float(closes[idx_t])
                                    o_val = float(opens[idx_t]) if (idx_t < len(opens) and opens[idx_t] is not None) else c_val
                                    h_val = float(highs[idx_t]) if (idx_t < len(highs) and highs[idx_t] is not None) else max(o_val, c_val)
                                    l_val = float(lows[idx_t]) if (idx_t < len(lows) and lows[idx_t] is not None) else min(o_val, c_val)
                                    v_val = int(vols[idx_t]) if (idx_t < len(vols) and vols[idx_t] is not None) else 0
                                    dt_obj = datetime.datetime.utcfromtimestamp(ts)
                                    if is_intra:
                                        priceInfos.append({
                                            "localDateTime": dt_obj.strftime("%Y%m%d%H%M"),
                                            "openPrice": round(o_val, 4),
                                            "highPrice": round(h_val, 4),
                                            "lowPrice": round(l_val, 4),
                                            "closePrice": round(c_val, 4),
                                            "volume": v_val
                                        })
                                    else:
                                        d_str = dt_obj.strftime("%Y%m%d")
                                        if d_str in seen_dates:
                                            continue
                                        seen_dates.add(d_str)
                                        priceInfos.append({
                                            "localDate": d_str,
                                            "openPrice": round(o_val, 4),
                                            "highPrice": round(h_val, 4),
                                            "lowPrice": round(l_val, 4),
                                            "closePrice": round(c_val, 4),
                                            "volume": v_val
                                        })
                                if len(priceInfos) >= 5:
                                    meta = res0.get("meta") or {}
                                    return {
                                        "symbol": base_ticker,
                                        "shortName": meta.get("shortName") or meta.get("longName") or base_ticker,
                                        "exchangeName": meta.get("exchangeName") or "US",
                                        "regularMarketPrice": meta.get("regularMarketPrice"),
                                        "priceInfos": priceInfos[-250:]
                                    }
                except Exception as ye:
                    pass

            # 2차: 네이버 해외 증권 포맷 후보 (.O = 나스닥, .N = 뉴욕, .A = 아멕스, .K = 아르카)
            naver_pt = periodType if periodType in ("dayCandle", "weekCandle", "monthCandle", "yearCandle", "day") else "dayCandle"
            candidates = [f"{base_ticker}.O", f"{base_ticker}.N", f"{base_ticker}.A", f"{base_ticker}.K", ticker]
            for cand in candidates:
                url = f"https://api.stock.naver.com/chart/foreign/item/{cand}?periodType={naver_pt}"
                try:
                    r = requests.get(url, headers=headers, timeout=4)
                    if r.status_code == 200:
                        data = r.json()
                        if data.get('priceInfos') and len(data['priceInfos']) > 0:
                            return data
                except Exception:
                    pass

            # 3차: GoodStock123 Price History API 폴백
            try:
                gs_url = f"https://goodstock123.com/api/fundamentals/price-history?symbol={base_ticker}&range=1Y"
                gr = requests.get(gs_url, headers=headers, timeout=5)
                if gr.status_code == 200:
                    gdata = gr.json()
                    pts = gdata.get("points") or gdata.get("rows") or gdata.get("prices") or []
                    if pts:
                        priceInfos = []
                        for idx_p, pt in enumerate(pts):
                            d_raw = str(pt.get("date") or pt.get("d") or "").replace("-", "")
                            c_p = pt.get("close") or pt.get("c") or pt.get("price")
                            if len(d_raw) == 8 and c_p is not None:
                                c_f = float(c_p)
                                prev_f = float(pts[idx_p - 1].get("close") or pts[idx_p - 1].get("c") or c_f) if idx_p > 0 else c_f
                                o_f = float(pt.get("open") or pt.get("o") or prev_f)
                                h_f = float(pt.get("high") or pt.get("h") or max(o_f, c_f) * 1.008)
                                l_f = float(pt.get("low") or pt.get("l") or min(o_f, c_f) * 0.992)
                                priceInfos.append({
                                    "localDate": d_raw,
                                    "openPrice": round(o_f, 4),
                                    "highPrice": round(h_f, 4),
                                    "lowPrice": round(l_f, 4),
                                    "closePrice": round(c_f, 4),
                                    "volume": int(pt.get("volume") or pt.get("v") or 0)
                                })
                        if priceInfos:
                            return {"priceInfos": priceInfos[-200:]}
            except Exception:
                pass
            
            # 4차: FinanceDataReader 폴백
            try:
                import FinanceDataReader as fdr
                clean_ticker = base_ticker
                df = fdr.DataReader(clean_ticker)
                if not df.empty:
                    df = df.tail(150)
                    priceInfos = []
                    for dt, row in df.iterrows():
                        priceInfos.append({
                            "localDate": dt.strftime('%Y%m%d'),
                            "openPrice": float(row['Open']),
                            "highPrice": float(row['High']),
                            "lowPrice": float(row['Low']),
                            "closePrice": float(row['Close']),
                            "volume": int(row['Volume']) if 'Volume' in row else 0
                        })
                    return {"priceInfos": priceInfos}
            except Exception as fe:
                print(f"[Chart API] FDR 해외 주식 조회 실패 ({ticker}):", fe)
        else:
            # 국내 주식 (코스피 / 코스닥)
            url = f"https://api.stock.naver.com/chart/domestic/item/{code}?periodType={periodType}"
            try:
                r = requests.get(url, headers=headers, timeout=6)
                if r.status_code == 200:
                    data = r.json()
                    if data.get('priceInfos') and len(data['priceInfos']) > 0:
                        return data
            except Exception:
                pass

            # 2차 네이버 fchart XML 폴백 (장애 방지)
            tf_map = {
                'dayCandle': 'day',
                'day': 'day',
                'weekCandle': 'week',
                'monthCandle': 'month',
                'yearCandle': 'month'
            }
            tf = tf_map.get(periodType, 'day')
            count = 120 if tf == 'month' else (250 if tf == 'week' else 300)
            fchart_url = f"https://fchart.stock.naver.com/sise.nhn?symbol={code}&timeframe={tf}&count={count}&requestType=0"
            try:
                fr = requests.get(fchart_url, timeout=5)
                if fr.status_code == 200:
                    root = ET.fromstring(fr.text)
                    items = root.findall('.//item')
                    if items:
                        priceInfos = []
                        for item in items:
                            parts = item.attrib['data'].split('|')
                            priceInfos.append({
                                "localDate": parts[0],
                                "openPrice": float(parts[1]),
                                "highPrice": float(parts[2]),
                                "lowPrice": float(parts[3]),
                                "closePrice": float(parts[4]),
                                "accumulatedTradingVolume": int(parts[5])
                            })
                        return {"priceInfos": priceInfos}
            except Exception as fe:
                print(f"[Chart API] fchart 폴백 실패 ({code}):", fe)

        raise HTTPException(status_code=404, detail="Chart data not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/quant/hub")
def get_quant_hub():
    """국내+미국 8대 퀀트·마켓 인텔리전스 통합 캐시 반환"""
    candidates = [
        "data/quant_hub_cache.json",
        "dajavata_backend/data/quant_hub_cache.json",
        "../data/quant_hub_cache.json",
        os.path.join(os.path.dirname(__file__), "data", "quant_hub_cache.json"),
        os.path.join(os.path.dirname(__file__), "..", "data", "quant_hub_cache.json"),
    ]
    for p in candidates:
        if os.path.exists(p) and os.path.getsize(p) > 500:
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[QuantHub API] Error reading {p}: {e}")
    return {"error": "Quant Hub cache not found"}


@app.get("/api/quant/guru-holdings")
def get_us_guru_holdings(cik: str):
    """특정 미국 구루(CIK)의 SEC 13F 포트폴리오 상세 보유종목 실시간 프록시"""
    clean_cik = "".join(ch for ch in str(cik) if ch.isdigit()).zfill(10)
    url = f"https://goodstock123.com/api/fundamentals/guru-holdings?cik={clean_cik}"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        r = requests.get(url, headers=headers, timeout=8)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        print(f"[QuantHub Guru API Error] {clean_cik}: {e}")
    return {"cik": clean_cik, "rows": []}


@app.get("/api/quant/peer-summary")
def get_us_peer_summary(symbol: str):
    """미국 특정 티커(symbol)의 동종업계 Peer 비교 및 기업 통계 프록시"""
    sym = symbol.strip().upper()
    headers = {"User-Agent": "Mozilla/5.0"}
    res_data = {"symbol": sym, "peer": {}, "stats": {}}
    try:
        r1 = requests.get(f"https://goodstock123.com/api/fundamentals/peer-summary?symbol={sym}", headers=headers, timeout=6)
        if r1.status_code == 200:
            res_data["peer"] = r1.json()
        r2 = requests.get(f"https://goodstock123.com/api/fundamentals/company-stats?symbol={sym}", headers=headers, timeout=6)
        if r2.status_code == 200:
            res_data["stats"] = r2.json()
    except Exception as e:
        print(f"[QuantHub Peer API Error] {sym}: {e}")
    return res_data


_calendar_month_cache = {}


@app.get("/api/quant/calendar")
def get_quant_calendar_month(year: int = None, month: int = None):
    """임의의 연·월(YYYY, MM)에 대한 5대 증시 캘린더(실적·IPO·분할·배당·거시경제) 실시간 조회"""
    import calendar as pycal
    now_dt = datetime.datetime.now()
    y = int(year or now_dt.year)
    m = int(month or now_dt.month)
    if m < 1:
        m = 1
    if m > 12:
        m = 12
    ym_key = f"{y:04d}-{m:02d}"

    cached = _calendar_month_cache.get(ym_key)
    if cached and (time.time() - cached["ts"] < 1800):
        return cached["data"]

    last_day = pycal.monthrange(y, m)[1]
    m_start = f"{y:04d}-{m:02d}-01"
    m_end = f"{y:04d}-{m:02d}-{last_day:02d}"
    headers = {"User-Agent": "Mozilla/5.0"}

    def _get(u):
        try:
            r = requests.get(u, headers=headers, timeout=8)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
        return {}

    earn_raw = _get(f"https://goodstock123.com/api/fundamentals/calendar-earnings?from={m_start}&to={m_end}&v=2")
    ipo_raw = _get(f"https://goodstock123.com/api/fundamentals/calendar-ipos?from={m_start}&to={m_end}&v=1")
    split_raw = _get(f"https://goodstock123.com/api/fundamentals/calendar-splits?board=1&from={m_start}&to={m_end}&v=1")
    div_raw = _get(f"https://goodstock123.com/api/fundamentals/calendar-dividends?board=1&from={m_start}&to={m_end}&v=2")
    econ_raw = _get(f"https://goodstock123.com/api/fundamentals/calendar-economic?from={m_start}&to={m_end}&v=1")

    earn_by_date = {}
    earn_counts = {}
    for r in (earn_raw.get("rows") or []):
        dt = r.get("date")
        if dt:
            earn_by_date.setdefault(dt, []).append(r)

    compact_earnings = []
    for dt in sorted(earn_by_date.keys()):
        day_rows = earn_by_date[dt]
        key_rows = [x for x in day_rows if x.get("key")]
        other_rows = [x for x in day_rows if not x.get("key")][:30]
        earn_counts[dt] = {"all": len(day_rows), "key": len(key_rows)}
        compact_earnings.extend(key_rows + other_rows)

    div_by_date = {}
    div_counts = {}
    for r in (div_raw.get("rows") or []):
        dt = r.get("date")
        if dt:
            div_by_date.setdefault(dt, []).append(r)

    compact_dividends = []
    for dt in sorted(div_by_date.keys()):
        day_rows = div_by_date[dt]
        key_rows = [x for x in day_rows if x.get("key")]
        other_rows = [x for x in day_rows if not x.get("key")][:20]
        div_counts[dt] = {"all": len(day_rows), "key": len(key_rows)}
        compact_dividends.extend(key_rows + other_rows)

    econ_dedup_map = {}
    econ_order = []
    for r in (econ_raw.get("rows") or []):
        t_str = str(r.get("t") or "")
        dt_part = t_str[:10]
        ev_name = str(r.get("event") or "").strip()
        if not dt_part or not ev_name:
            continue
        dedup_key = (dt_part, ev_name)
        if dedup_key not in econ_dedup_map:
            econ_dedup_map[dedup_key] = dict(r)
            econ_order.append(dedup_key)
        else:
            existing = econ_dedup_map[dedup_key]
            if r.get("actual") is not None and existing.get("actual") is None:
                merged = dict(r)
                if merged.get("previous") is None:
                    merged["previous"] = existing.get("previous")
                if merged.get("estimate") is None:
                    merged["estimate"] = existing.get("estimate")
                if not merged.get("unit"):
                    merged["unit"] = existing.get("unit")
                econ_dedup_map[dedup_key] = merged
            else:
                if existing.get("previous") is None and r.get("previous") is not None:
                    existing["previous"] = r.get("previous")
                if existing.get("estimate") is None and r.get("estimate") is not None:
                    existing["estimate"] = r.get("estimate")
                if not existing.get("unit") and r.get("unit"):
                    existing["unit"] = r.get("unit")

    deduped_economic = [econ_dedup_map[k] for k in econ_order]

    data = {
        "ym": ym_key,
        "from": m_start,
        "to": m_end,
        "earnings_counts": earn_counts,
        "earnings": compact_earnings,
        "ipos": ipo_raw.get("rows") or [],
        "splits": split_raw.get("rows") or [],
        "dividends_counts": div_counts,
        "dividends": compact_dividends,
        "economic": deduped_economic
    }
    _calendar_month_cache[ym_key] = {"ts": time.time(), "data": data}
    return data


@app.get("/")
def read_root():
    return {"message": "DAJAVATA API Server is running!"}


# ==============================================================================
# [신규] DAJAVATA 알파 라운지(커뮤니티·작도공유·등급/패스·클라우드 동기화) & 관리자 전용 방문자 분석 엔진
# ==============================================================================
COMMUNITY_DB_PATHS = [
    os.path.join(os.path.dirname(__file__), "data", "community_db.json"),
    "data/community_db.json",
    "../data/community_db.json",
    "../dajavata/dist/data/community_db.json",
]

ANALYTICS_DB_PATHS = [
    os.path.join(os.path.dirname(__file__), "data", "analytics_db.json"),
    "data/analytics_db.json",
    "../data/analytics_db.json",
]

TRADER_CLOUD_DB_PATHS = [
    os.path.join(os.path.dirname(__file__), "data", "trader_cloud_db.json"),
    "data/trader_cloud_db.json",
]


def _load_json_first(paths, default_factory):
    for p in paths:
        if os.path.exists(p) and os.path.getsize(p) > 10:
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    return default_factory()


def _save_json_all(paths, payload):
    for p in paths:
        try:
            d = os.path.dirname(p)
            if d:
                os.makedirs(d, exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except Exception:
            pass


def _recompute_user_tiers(profiles_map: dict):
    """기여 포인트(AP) 기반 5단계 알파 티어 자동 산정 (Lv5 알파 마스터는 40 AP 이상 중 상위 10%)"""
    eligible_top = []
    for uid, prof in profiles_map.items():
        if uid == "official_desk" or int(prof.get("tier") or 1) == 9:
            prof["tier"] = 9
            continue
        ap = int(prof.get("ap") or 0)
        if ap >= 40:
            prof["tier"] = 4
            eligible_top.append((ap, uid))
        elif ap >= 15:
            prof["tier"] = 3
        elif ap >= 5:
            prof["tier"] = 2
        else:
            prof["tier"] = 1
    if eligible_top:
        eligible_top.sort(reverse=True)
        total_users = max(len([u for u in profiles_map.values() if int(u.get("tier") or 1) != 9]), 1)
        top_n = max(1, int(round(total_users * 0.10)))
        for _, uid in eligible_top[:top_n]:
            profiles_map[uid]["tier"] = 5


@app.get("/api/community/data")
def get_community_data(user_id: Optional[str] = None, is_admin: Optional[bool] = False):
    db = _load_json_first(COMMUNITY_DB_PATHS, lambda: {
        "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "profiles": {},
        "vaultItems": [],
        "loungePosts": [],
        "researchRequests": [],
        "supportTickets": [],
    })
    profiles = db.get("profiles") or {}
    _recompute_user_tiers(profiles)

    # 비밀 문의글 마스킹 보호 (작성자 본인 또는 관리자만 본문 열람 가능)
    safe_tickets = []
    for t in (db.get("supportTickets") or []):
        t_copy = dict(t)
        t_copy.pop("password", None)
        if t_copy.get("isSecret") and not is_admin and (not user_id or t_copy.get("authorId") != user_id):
            t_copy["body"] = "🔒 작성자와 다자바타 운영 데스크만 열람할 수 있는 비밀 문의글입니다."
            t_copy["locked"] = True
        else:
            t_copy["locked"] = False
        safe_tickets.append(t_copy)

    return {
        "updated_at": db.get("updated_at"),
        "profiles": profiles,
        "vaultItems": db.get("vaultItems") or [],
        "loungePosts": db.get("loungePosts") or [],
        "researchRequests": db.get("researchRequests") or [],
        "supportTickets": safe_tickets,
    }


@app.post("/api/community/action")
async def post_community_action(req: Request):
    body = await req.json()
    action = str(body.get("action") or "").strip()
    db = _load_json_first(COMMUNITY_DB_PATHS, lambda: {
        "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "profiles": {},
        "vaultItems": [],
        "loungePosts": [],
        "researchRequests": [],
        "supportTickets": [],
    })
    profiles = db.setdefault("profiles", {})
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    today_str = now_str[:10]

    if action == "register_profile":
        uid = str(body.get("userId") or "").strip()
        nick = sanitize_html_content(str(body.get("nickname") or "트레이더").strip())[:24]
        if not uid:
            raise HTTPException(status_code=400, detail="Missing userId")
        prof = profiles.get(uid)
        if not prof:
            prof = {
                "id": uid,
                "nickname": nick,
                "provider": str(body.get("provider") or "kakao"),
                "avatar": str(body.get("avatar") or ""),
                "ap": 1,
                "passes": 3,
                "tier": 1,
                "lastRefillDate": today_str,
                "joined_at": today_str,
            }
            profiles[uid] = prof
        else:
            if nick:
                prof["nickname"] = nick
            if body.get("avatar"):
                prof["avatar"] = str(body.get("avatar"))
            if prof.get("lastRefillDate") != today_str:
                prof["lastRefillDate"] = today_str
                if int(prof.get("passes") or 0) < 3:
                    prof["passes"] = 3
        _recompute_user_tiers(profiles)
        db["updated_at"] = now_str
        _save_json_all(COMMUNITY_DB_PATHS, db)
        return {"ok": True, "profile": profiles[uid]}

    elif action == "share_vault":
        uid = str(body.get("authorId") or "guest").strip()
        prof = profiles.setdefault(uid, {
            "id": uid,
            "nickname": sanitize_html_content(str(body.get("authorNick") or "트레이더"))[:24],
            "provider": "kakao",
            "ap": 1,
            "passes": 3,
            "tier": 1,
            "joined_at": today_str,
        })
        prof["ap"] = int(prof.get("ap") or 0) + 1
        prof["passes"] = int(prof.get("passes") or 0) + 1
        _recompute_user_tiers(profiles)

        new_item = {
            "id": f"vault-{int(time.time() * 1000)}",
            "kind": str(body.get("kind") or "chart"),
            "ticker": sanitize_html_content(str(body.get("ticker") or "005930").upper())[:12],
            "stockName": sanitize_html_content(str(body.get("stockName") or "종목"))[:40],
            "market": sanitize_html_content(str(body.get("market") or "KRX"))[:12],
            "timeframe": sanitize_html_content(str(body.get("timeframe") or "일봉 (1D)"))[:20],
            "stance": str(body.get("stance") or "BULL"),
            "title": sanitize_html_content(str(body.get("title") or ""))[:100],
            "summary": sanitize_html_content(str(body.get("summary") or ""))[:600],
            "entryPrice": float(body.get("entryPrice") or 0),
            "stopPrice": float(body.get("stopPrice") or 0),
            "targetPrice": float(body.get("targetPrice") or 0),
            "rrRatio": sanitize_html_content(str(body.get("rrRatio") or "1 : 2.5"))[:16],
            "authorId": uid,
            "authorNick": prof["nickname"],
            "authorTier": prof["tier"],
            "imports": 0,
            "likes": 0,
            "tags": [sanitize_html_content(str(t))[:16] for t in (body.get("tags") or [])[:6]],
            "created_at": now_str,
            "chartPreview": body.get("chartPreview") or {"candles": [100, 102, 101, 105, 108, 106, 111], "fibLevels": [0.382, 0.618]},
            "drawings": body.get("drawings") or [],
        }
        db.setdefault("vaultItems", []).insert(0, new_item)
        db["updated_at"] = now_str
        _save_json_all(COMMUNITY_DB_PATHS, db)
        return {"ok": True, "item": new_item, "profile": prof}

    elif action == "import_vault":
        item_id = str(body.get("itemId") or "")
        uid = str(body.get("userId") or "")
        for it in db.get("vaultItems") or []:
            if it.get("id") == item_id:
                it["imports"] = int(it.get("imports") or 0) + 1
                author_id = it.get("authorId")
                if author_id and author_id in profiles and author_id != uid:
                    profiles[author_id]["ap"] = int(profiles[author_id].get("ap") or 0) + 1
                if uid and uid in profiles and author_id != uid:
                    profiles[uid]["passes"] = max(0, int(profiles[uid].get("passes") or 0) - 1)
                _recompute_user_tiers(profiles)
                db["updated_at"] = now_str
                _save_json_all(COMMUNITY_DB_PATHS, db)
                return {"ok": True, "item": it, "profile": profiles.get(uid)}
        raise HTTPException(status_code=404, detail="Vault item not found")

    elif action == "create_post":
        uid = str(body.get("authorId") or "guest").strip()
        prof = profiles.get(uid) or {"nickname": sanitize_html_content(str(body.get("authorNick") or "트레이더"))[:24], "tier": 1}
        new_post = {
            "id": f"post-{int(time.time() * 1000)}",
            "channel": str(body.get("channel") or "kr-theme"),
            "ticker": sanitize_html_content(str(body.get("ticker") or "").upper())[:12],
            "stockName": sanitize_html_content(str(body.get("stockName") or ""))[:40],
            "stance": str(body.get("stance") or "BULL"),
            "title": sanitize_html_content(str(body.get("title") or ""))[:120],
            "body": sanitize_html_content(str(body.get("body") or ""))[:3000],
            "authorId": uid,
            "authorNick": prof.get("nickname", "트레이더"),
            "authorTier": prof.get("tier", 1),
            "likes": 0,
            "views": 1,
            "created_at": now_str,
            "comments": [],
        }
        db.setdefault("loungePosts", []).insert(0, new_post)
        db["updated_at"] = now_str
        _save_json_all(COMMUNITY_DB_PATHS, db)
        return {"ok": True, "post": new_post}

    elif action == "like_item":
        t_type = str(body.get("targetType") or "lounge")
        t_id = str(body.get("targetId") or "")
        arr = db.get("vaultItems") if t_type == "vault" else db.get("loungePosts")
        for it in (arr or []):
            if it.get("id") == t_id:
                it["likes"] = int(it.get("likes") or 0) + 1
                db["updated_at"] = now_str
                _save_json_all(COMMUNITY_DB_PATHS, db)
                return {"ok": True, "likes": it["likes"]}
        return {"ok": False}

    elif action == "add_comment":
        t_id = str(body.get("targetId") or "")
        c_body = sanitize_html_content(str(body.get("body") or "")).strip()[:1000]
        if not c_body:
            raise HTTPException(status_code=400, detail="Empty comment")
        for p in (db.get("loungePosts") or []):
            if p.get("id") == t_id:
                new_c = {
                    "id": f"c-{int(time.time() * 1000)}",
                    "authorNick": sanitize_html_content(str(body.get("authorNick") or "트레이더"))[:24],
                    "authorTier": int(body.get("authorTier") or 1),
                    "body": c_body,
                    "created_at": now_str,
                }
                p.setdefault("comments", []).append(new_c)
                db["updated_at"] = now_str
                _save_json_all(COMMUNITY_DB_PATHS, db)
                return {"ok": True, "comment": new_c}
        raise HTTPException(status_code=404, detail="Post not found")

    elif action == "create_request":
        uid = str(body.get("authorId") or "guest").strip()
        reward = max(0, min(5, int(body.get("rewardPass") or 1)))
        prof = profiles.get(uid)
        if prof and reward > 0:
            prof["passes"] = max(0, int(prof.get("passes") or 0) - reward)
        new_req = {
            "id": f"req-{int(time.time() * 1000)}",
            "status": "open",
            "ticker": sanitize_html_content(str(body.get("ticker") or "").upper())[:12],
            "stockName": sanitize_html_content(str(body.get("stockName") or ""))[:40],
            "title": sanitize_html_content(str(body.get("title") or ""))[:120],
            "body": sanitize_html_content(str(body.get("body") or ""))[:1500],
            "tags": [sanitize_html_content(str(t))[:16] for t in (body.get("tags") or [])[:6]],
            "rewardPass": reward,
            "authorId": uid,
            "authorNick": (prof and prof.get("nickname")) or sanitize_html_content(str(body.get("authorNick") or "트레이더"))[:24],
            "authorTier": (prof and prof.get("tier")) or 1,
            "created_at": now_str,
            "acceptedAnswerId": None,
            "answers": [],
        }
        db.setdefault("researchRequests", []).insert(0, new_req)
        db["updated_at"] = now_str
        _save_json_all(COMMUNITY_DB_PATHS, db)
        return {"ok": True, "request": new_req, "profile": prof}

    elif action == "submit_research_answer":
        req_id = str(body.get("requestId") or "")
        for rq in (db.get("researchRequests") or []):
            if rq.get("id") == req_id:
                ans = {
                    "id": f"ans-{int(time.time() * 1000)}",
                    "vaultItemId": str(body.get("vaultItemId") or ""),
                    "vaultTitle": sanitize_html_content(str(body.get("vaultTitle") or "리서치 분석 답변"))[:100],
                    "comment": sanitize_html_content(str(body.get("comment") or ""))[:800],
                    "authorId": str(body.get("authorId") or ""),
                    "authorNick": sanitize_html_content(str(body.get("authorNick") or "트레이더"))[:24],
                    "authorTier": int(body.get("authorTier") or 1),
                    "created_at": now_str,
                    "isAccepted": False,
                }
                rq.setdefault("answers", []).append(ans)
                db["updated_at"] = now_str
                _save_json_all(COMMUNITY_DB_PATHS, db)
                return {"ok": True, "answer": ans}
        raise HTTPException(status_code=404, detail="Request not found")

    elif action == "accept_research_answer":
        req_id = str(body.get("requestId") or "")
        ans_id = str(body.get("answerId") or "")
        for rq in (db.get("researchRequests") or []):
            if rq.get("id") == req_id and rq.get("status") == "open":
                for ans in (rq.get("answers") or []):
                    if ans.get("id") == ans_id:
                        ans["isAccepted"] = True
                        rq["status"] = "fulfilled"
                        rq["acceptedAnswerId"] = ans_id
                        ans_uid = ans.get("authorId")
                        if ans_uid and ans_uid in profiles:
                            profiles[ans_uid]["ap"] = int(profiles[ans_uid].get("ap") or 0) + 3
                            profiles[ans_uid]["passes"] = int(profiles[ans_uid].get("passes") or 0) + int(rq.get("rewardPass") or 1)
                            _recompute_user_tiers(profiles)
                        db["updated_at"] = now_str
                        _save_json_all(COMMUNITY_DB_PATHS, db)
                        return {"ok": True, "request": rq}
        raise HTTPException(status_code=400, detail="Cannot accept answer")

    elif action == "create_ticket":
        new_tkt = {
            "id": f"tkt-{int(time.time() * 1000)}",
            "category": str(body.get("category") or "feature"),
            "title": sanitize_html_content(str(body.get("title") or ""))[:120],
            "body": sanitize_html_content(str(body.get("body") or ""))[:2500],
            "contact": sanitize_html_content(str(body.get("contact") or ""))[:80],
            "authorId": str(body.get("authorId") or "guest"),
            "authorNick": sanitize_html_content(str(body.get("authorNick") or "방문자"))[:24],
            "authorTier": int(body.get("authorTier") or 1),
            "isSecret": bool(body.get("isSecret")),
            "password": str(body.get("password") or "")[:32],
            "status": "open",
            "created_at": now_str,
            "staffReply": None,
            "staffReplyAt": None,
        }
        db.setdefault("supportTickets", []).insert(0, new_tkt)
        db["updated_at"] = now_str
        _save_json_all(COMMUNITY_DB_PATHS, db)
        return {"ok": True, "ticket": new_tkt}

    elif action == "admin_reply_ticket":
        if not is_authorized_admin(token=body.get("token"), pin=body.get("pin")):
            raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
        tkt_id = str(body.get("ticketId") or "")
        reply_txt = sanitize_html_content(str(body.get("reply") or "")).strip()
        for t in (db.get("supportTickets") or []):
            if t.get("id") == tkt_id:
                t["staffReply"] = reply_txt
                t["staffReplyAt"] = now_str
                t["status"] = "answered"
                db["updated_at"] = now_str
                _save_json_all(COMMUNITY_DB_PATHS, db)
                return {"ok": True, "ticket": t}
        raise HTTPException(status_code=404, detail="Ticket not found")

    return {"ok": False, "detail": "Unknown action"}


# --- 카카오 계정 기반 트레이더 룸 & 차트 작도 클라우드 백업/복원 API ---
@app.post("/api/trader/cloud-sync")
async def post_trader_cloud_sync(req: Request):
    body = await req.json()
    uid = str(body.get("userId") or "").strip()
    mode = str(body.get("mode") or "pull").strip()
    if not uid:
        raise HTTPException(status_code=400, detail="Missing userId")
    cloud_db = _load_json_first(TRADER_CLOUD_DB_PATHS, lambda: {"users": {}})
    users_map = cloud_db.setdefault("users", {})
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if mode == "push":
        users_map[uid] = {
            "updated_at": now_str,
            "nickname": str(body.get("nickname") or ""),
            "traderDb": body.get("traderDb") or {},
            "scannerDrawings": body.get("scannerDrawings") or {},
        }
        _save_json_all(TRADER_CLOUD_DB_PATHS, cloud_db)
        return {"ok": True, "updated_at": now_str}
    else:
        record = users_map.get(uid)
        return {"ok": True, "hasBackup": bool(record), "record": record}


# --- 관리자 전용 방문자 수 & 유입 경로(Referrer/UTM) 트래킹 엔진 (일반 방문자에게는 100% 비공개) ---
def _classify_referrer(ref_url: str, utm_source: str = "") -> str:
    combined = f"{ref_url} {utm_source}".lower()
    if not ref_url.strip() and not utm_source.strip():
        return "직접 접속 / 북마크 (Direct)"
    if "cafe.naver" in combined or "blog.naver" in combined:
        return "네이버 카페 · 블로그"
    if "naver.com" in combined:
        return "네이버 검색 (Naver)"
    if "google." in combined:
        return "구글 검색 (Google)"
    if "kakao" in combined or "daum.net" in combined:
        return "카카오톡 · 다음 (Kakao)"
    if "youtube.com" in combined or "youtu.be" in combined:
        return "유튜브 (YouTube)"
    if "instagram" in combined or "threads" in combined or "t.co" in combined or "twitter" in combined or "facebook" in combined:
        return "SNS (인스타·X·쓰레드)"
    if "dcinside" in combined or "fmkorea" in combined or "clien" in combined or "tradingview" in combined:
        return "주식·투자 커뮤니티"
    if "dajavata.com" in combined or "localhost" in combined or "127.0.0.1" in combined:
        return "내부 메뉴 이동"
    return "기타 외부 링크 (Referral)"


@app.post("/api/analytics/track")
async def track_visitor_hit(req: Request):
    try:
        body = await req.json()
    except Exception:
        body = {}
    kst_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
    date_str = kst_now.strftime("%Y-%m-%d")
    hour_str = kst_now.strftime("%H")
    time_str = kst_now.strftime("%Y-%m-%d %H:%M:%S")

    client_ip = req.client.host if req.client else "0.0.0.0"
    ua = req.headers.get("user-agent", "")
    vid = str(body.get("visitorId") or hashlib.sha256(f"{client_ip}_{ua[:40]}_{date_str}".encode()).hexdigest()[:14])
    ref_raw = str(body.get("referrer") or "").strip()[:300]
    utm_raw = str(body.get("utmSource") or "").strip()[:80]
    view_name = str(body.get("view") or "전체 테마").strip()[:50]
    device_type = "Mobile / Tablet" if re.search(r"Mobile|Android|iPhone|iPad", ua, re.I) else "PC Desktop"
    source_cat = _classify_referrer(ref_raw, utm_raw)

    adb = _load_json_first(ANALYTICS_DB_PATHS, lambda: {
        "daily": {},
        "hourly": {f"{h:02d}": 0 for h in range(24)},
        "sources": {},
        "views": {},
        "devices": {"PC Desktop": 0, "Mobile / Tablet": 0},
        "recentVisits": [],
    })

    # 1. 일별 PV & UV(고유 방문자) 집계
    day_obj = adb.setdefault("daily", {}).setdefault(date_str, {"pv": 0, "uv_list": []})
    day_obj["pv"] = int(day_obj.get("pv") or 0) + 1
    is_new_uv = False
    if vid not in day_obj.setdefault("uv_list", []):
        day_obj["uv_list"].append(vid)
        is_new_uv = True

    # 2. 시간대별 집계
    hr_map = adb.setdefault("hourly", {})
    hr_map[hour_str] = int(hr_map.get(hour_str) or 0) + 1

    # 3. 유입 경로(Source) 집계 (세션 최초 유입이거나 신규 UV이고 내부 이동이 아닐 때만 1회 집계)
    is_entry = bool(body.get("isEntry", is_new_uv))
    if (is_entry or is_new_uv) and source_cat != "내부 메뉴 이동":
        src_map = adb.setdefault("sources", {})
        src_map[source_cat] = int(src_map.get(source_cat) or 0) + 1

    # 4. 인기 메뉴/뷰 집계
    vw_map = adb.setdefault("views", {})
    vw_map[view_name] = int(vw_map.get(view_name) or 0) + 1

    # 5. 기기별 집계 (방문자 세션 진입 기준으로 집계)
    if is_entry or is_new_uv:
        dv_map = adb.setdefault("devices", {"PC Desktop": 0, "Mobile / Tablet": 0})
        dv_map[device_type] = int(dv_map.get(device_type) or 0) + 1

    # 6. 최근 실시간 방문 로그 (최신 80건 유지)
    recent = adb.setdefault("recentVisits", [])
    recent.insert(0, {
        "time": time_str,
        "visitorId": vid[:8],
        "source": source_cat,
        "referrer": ref_raw or "(직접 주소 입력 / 북마크)",
        "view": view_name,
        "device": device_type,
    })
    adb["recentVisits"] = recent[:80]

    _save_json_all(ANALYTICS_DB_PATHS, adb)
    return {"ok": True}


@app.post("/api/analytics/admin-summary")
async def get_admin_analytics_summary(req: Request):
    """오직 관리자(PIN/세션 토큰 인증 완료자)만 조회할 수 있는 방문자 수 & 유입 경로 대시보드 API"""
    body = await req.json()
    if not is_authorized_admin(token=body.get("token"), pin=body.get("pin")):
        raise HTTPException(status_code=403, detail="관리자 전용 통계입니다. (권한 없음)")

    if body.get("reset") is True:
        empty_adb = {
            "daily": {},
            "hourly": {f"{h:02d}": 0 for h in range(24)},
            "sources": {},
            "views": {},
            "devices": {"PC Desktop": 0, "Mobile / Tablet": 0},
            "recentVisits": [],
        }
        _save_json_all(ANALYTICS_DB_PATHS, empty_adb)
        adb = empty_adb
    else:
        adb = _load_json_first(ANALYTICS_DB_PATHS, lambda: {
            "daily": {},
            "hourly": {},
            "sources": {},
            "views": {},
            "devices": {"PC Desktop": 0, "Mobile / Tablet": 0},
            "recentVisits": [],
        })

    kst_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
    today_str = kst_now.strftime("%Y-%m-%d")
    yest_str = (kst_now - datetime.timedelta(days=1)).strftime("%Y-%m-%d")

    daily_map = adb.get("daily") or {}
    daily_series = []
    uv_7d = 0
    pv_7d = 0
    uv_30d = 0
    pv_30d = 0

    for d_off in range(13, -1, -1):
        d_key = (kst_now - datetime.timedelta(days=d_off)).strftime("%Y-%m-%d")
        d_info = daily_map.get(d_key) or {"pv": 0, "uv_list": []}
        uv_c = len(d_info.get("uv_list") or [])
        pv_c = int(d_info.get("pv") or 0)
        daily_series.append({"date": d_key, "uv": uv_c, "pv": pv_c})

    for d_off in range(30):
        d_key = (kst_now - datetime.timedelta(days=d_off)).strftime("%Y-%m-%d")
        d_info = daily_map.get(d_key)
        if d_info:
            u_c = len(d_info.get("uv_list") or [])
            p_c = int(d_info.get("pv") or 0)
            uv_30d += u_c
            pv_30d += p_c
            if d_off < 7:
                uv_7d += u_c
                pv_7d += p_c

    today_info = daily_map.get(today_str) or {"pv": 0, "uv_list": []}
    yest_info = daily_map.get(yest_str) or {"pv": 0, "uv_list": []}

    return {
        "ok": True,
        "today": {"date": today_str, "uv": len(today_info.get("uv_list") or []), "pv": int(today_info.get("pv") or 0)},
        "yesterday": {"date": yest_str, "uv": len(yest_info.get("uv_list") or []), "pv": int(yest_info.get("pv") or 0)},
        "sum7d": {"uv": uv_7d, "pv": pv_7d},
        "sum30d": {"uv": uv_30d, "pv": pv_30d},
        "dailySeries": daily_series,
        "hourly": adb.get("hourly") or {},
        "sources": adb.get("sources") or {},
        "views": adb.get("views") or {},
        "devices": adb.get("devices") or {},
        "recentVisits": (adb.get("recentVisits") or [])[:50],
    }

