from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests
import xml.etree.ElementTree as ET
import json
import os
import pandas as pd
import numpy as np
import io
import matplotlib
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import FinanceDataReader as fdr
import datetime
import time
import asyncio
from dotenv import load_dotenv

from update_themes import main as update_themes_main

load_dotenv()

NOTION_TOKEN = os.getenv("NOTION_TOKEN")
NOTION_DATABASE_ID = os.getenv("NOTION_DATABASE_ID")

app = FastAPI()

background_task_ref = None

# Cache for stock list
stock_list = []

def load_stocks_sync():
    global stock_list
    print("Loading KRX stock list...")
    try:
        from fdr_fallback import StockListing
        df = StockListing('KRX')
        # Keep only standard stocks (filter out spacc, etc if needed, but for now take all)
        for _, row in df.iterrows():
            stock_list.append({
                "code": str(row['Code']),
                "name": str(row['Name']),
                "market": str(row['Market'])
            })
        print(f"Loaded {len(stock_list)} stocks.")
    except Exception as e:
        print("Failed to load stocks:", e)

async def periodic_update():
    print("!!! periodic_update 시작됨 (평일 08:15~20:15 매시 15분 자동 갱신) !!!", flush=True)
    await asyncio.sleep(5)
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

            # 캐시 파일 노후도 점검
            if is_weekday_active and not should_run:
                for cand in ['data/theme_cache.json', 'dajavata_backend/data/theme_cache.json', '../data/theme_cache.json']:
                    if os.path.exists(cand) and os.path.getsize(cand) > 100:
                        age_sec = time.time() - os.path.getmtime(cand)
                        if age_sec > 3500 and last_run_hour_key != hour_key:
                            should_run = True
                        break

            if should_run:
                last_run_hour_key = hour_key
                print(f"[{kst_now.strftime('%Y-%m-%d %H:%M:%S')} KST] Starting scheduled background update (themes & stocks)...", flush=True)
                await update_themes_main()
                print("Periodic background update finished.", flush=True)
        except Exception as e:
            print(f"Error during periodic background update: {e}", flush=True)
        
        await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    global background_task_ref
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, load_stocks_sync)
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
ADMIN_PIN = os.getenv("ADMIN_PIN", "4537")

def load_local_insights_db():
    """로컬 insights_db.json에서 칼럼 목록을 즉각 로드 (0ms 초고속 캐시)"""
    if os.path.exists(INSIGHTS_DB_PATH):
        try:
            with open(INSIGHTS_DB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data and isinstance(data.get("posts"), list) and len(data["posts"]) > 0:
                    return data
        except Exception as e:
            print(f"Error loading insights_db.json: {e}")
    return None

def save_local_insights_db(data):
    """insights_db.json에 칼럼 데이터를 안전하게 원자적 저장"""
    os.makedirs(os.path.dirname(INSIGHTS_DB_PATH), exist_ok=True)
    temp_path = INSIGHTS_DB_PATH + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    shutil.move(temp_path, INSIGHTS_DB_PATH)

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
    pin: str
    post: dict

class AdminDeletePostRequest(BaseModel):
    pin: str
    id: str

@app.post("/api/insights/verify-admin")
def verify_admin(req: AdminVerifyRequest):
    if req.pin == ADMIN_PIN:
        return {"success": True, "message": "Admin authenticated"}
    return {"success": False, "message": "Invalid PIN"}

@app.post("/api/insights/save")
def save_insight_post(req: AdminSavePostRequest):
    if req.pin != ADMIN_PIN:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    post = req.post
    if not post or not post.get("title"):
        raise HTTPException(status_code=400, detail="Title is required")

    db = load_local_insights_db() or {"posts": []}
    posts = db.get("posts", [])

    # 기존 글 수정 여부 확인 (id 기준)
    post_id = post.get("id")
    if not post_id:
        post_id = f"post_{int(time.time())}"
        post["id"] = post_id

    existing_idx = next((i for i, p in enumerate(posts) if str(p.get("id")) == str(post_id)), -1)
    if existing_idx >= 0:
        posts[existing_idx] = post
    else:
        posts.insert(0, post) # 최신 글을 맨 위에 추가

    db["posts"] = posts
    db["updated_at"] = datetime.datetime.now().isoformat()
    save_local_insights_db(db)

    return {"success": True, "post": post, "total": len(posts)}

@app.post("/api/insights/delete")
def delete_insight_post(req: AdminDeletePostRequest):
    if req.pin != ADMIN_PIN:
        raise HTTPException(status_code=403, detail="Unauthorized")

    db = load_local_insights_db() or {"posts": []}
    posts = db.get("posts", [])
    posts = [p for p in posts if str(p.get("id")) != str(req.id)]

    db["posts"] = posts
    db["updated_at"] = datetime.datetime.now().isoformat()
    save_local_insights_db(db)

    return {"success": True, "deleted_id": req.id, "total": len(posts)}

def setup_korean_font():
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
                "rsi_d": f"{rsi_d:.1f}" if pd.notna(rsi_d) else "-",
                "rsi_w": f"{rsi_w:.1f}" if pd.notna(rsi_w) else "-",
                "rsi_m": f"{rsi_m:.1f}" if pd.notna(rsi_m) else "-",
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
            candidate_slot = file_kst_dt

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
                            "day1": f"{d1:+.2f}%" if pd.notna(d1) else "-",
                            "day1Pos": bool(d1 >= 0) if pd.notna(d1) else True,
                            "day3": f"{d3:+.2f}%" if pd.notna(d3) else "-",
                            "day3Pos": bool(d3 >= 0) if pd.notna(d3) else True,
                            "high52": f"{h52:+.1f}%" if pd.notna(h52) else "-",
                            "high52Pos": bool(h52 >= 0) if pd.notna(h52) else True,
                            "low52": f"{l52:+.1f}%" if pd.notna(l52) else "-",
                            "low52Pos": bool(l52 >= 0) if pd.notna(l52) else True,
                            "neglect52": f"{n52:.0f}" if pd.notna(n52) else "-",
                            "high3y": f"{h3y:+.1f}%" if pd.notna(h3y) else "-",
                            "high3yPos": bool(h3y >= 0) if pd.notna(h3y) else True,
                            "low3y": f"{l3y:+.1f}%" if pd.notna(l3y) else "-",
                            "low3yPos": bool(l3y >= 0) if pd.notna(l3y) else True,
                            "neglect3y": f"{n3y:.0f}" if pd.notna(n3y) else "-",
                            "expReturn": f"{exp:.0f}%" if pd.notna(exp) else "-",
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
                            "day1": f"{d1:+.2f}%" if pd.notna(d1) else "-",
                            "day1Pos": bool(d1 >= 0) if pd.notna(d1) else True,
                            "day3": f"{d3:+.2f}%" if pd.notna(d3) else "-",
                            "day3Pos": bool(d3 >= 0) if pd.notna(d3) else True,
                            "high52": f"{h52:+.1f}%" if pd.notna(h52) else "-",
                            "high52Pos": bool(h52 >= 0) if pd.notna(h52) else True,
                            "low52": f"{l52:+.1f}%" if pd.notna(l52) else "-",
                            "low52Pos": bool(l52 >= 0) if pd.notna(l52) else True,
                            "neglect52": f"{n52:.0f}" if pd.notna(n52) else "-",
                            "high3y": f"{h3y:+.1f}%" if pd.notna(h3y) else "-",
                            "high3yPos": bool(h3y >= 0) if pd.notna(h3y) else True,
                            "low3y": f"{l3y:+.1f}%" if pd.notna(l3y) else "-",
                            "low3yPos": bool(l3y >= 0) if pd.notna(l3y) else True,
                            "neglect3y": f"{n3y:.0f}" if pd.notna(n3y) else "-",
                            "expReturn": f"{exp:.0f}%" if pd.notna(exp) else "-",
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
        "economic": econ_raw.get("rows") or []
    }
    _calendar_month_cache[ym_key] = {"ts": time.time(), "data": data}
    return data


@app.get("/")
def read_root():
    return {"message": "DAJAVATA API Server is running!"}
