from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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
    print("!!! periodic_update 시작됨 !!!", flush=True)
    await asyncio.sleep(10)
    while True:
        try:
            print("Starting periodic background update (themes & stocks)...")
            await update_themes_main()
            print("Periodic background update finished.")
        except Exception as e:
            print(f"Error during periodic background update: {e}")
        
        await asyncio.sleep(3600)

@app.on_event("startup")
async def startup_event():
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, load_stocks_sync)

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

@app.get("/api/insights")
def get_insights():
    if not NOTION_TOKEN or not NOTION_DATABASE_ID:
        raise HTTPException(status_code=500, detail="Notion integration not configured.")
    
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
        r = requests.post(url, headers=headers, json=data)
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
            
        return {"posts": posts}
    except Exception as e:
        print(f"Notion API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

@app.get("/api/themes")
def get_themes():
    cache_file = 'data/theme_cache.json'
    if os.path.exists(cache_file):
        mtime = os.path.getmtime(cache_file)
        kst_dt = datetime.datetime.fromtimestamp(mtime, tz=datetime.timezone(datetime.timedelta(hours=9)))
        update_str = kst_dt.strftime("%m.%d %H:%M")
        updated_iso = kst_dt.strftime("%Y-%m-%d %H:%M:%S")

        with open(cache_file, 'r', encoding='utf-8') as f:
            raw_themes = json.load(f)
            
        formatted_themes = []
        for t in raw_themes:
            formatted_themes.append({
                "name": t["name"],
                "theme_id": t["theme_id"],
                "desc": f"{t['name']} 테마 구성종목 평균 데이터입니다.",
                "day1": f"{t['day1Pos']:+.2f}%" if pd.notna(t['day1Pos']) else "-",
                "day1Pos": bool(t['day1Pos'] >= 0) if pd.notna(t['day1Pos']) else True,
                "day3": f"{t['day3Pos']:+.2f}%" if pd.notna(t['day3Pos']) else "-",
                "day3Pos": bool(t['day3Pos'] >= 0) if pd.notna(t['day3Pos']) else True,
                "high52": f"{t['high52']:+.1f}%" if pd.notna(t['high52']) else "-",
                "high52Pos": bool(t['high52'] >= 0) if pd.notna(t['high52']) else True,
                "low52": f"{t['low52']:+.1f}%" if pd.notna(t['low52']) else "-",
                "low52Pos": bool(t['low52'] >= 0) if pd.notna(t['low52']) else True,
                "neglect52": f"{t['neglect52']:.0f}" if pd.notna(t['neglect52']) else "-",
                "high3y": f"{t['high3y']:+.1f}%" if pd.notna(t['high3y']) else "-",
                "high3yPos": bool(t['high3y'] >= 0) if pd.notna(t['high3y']) else True,
                "low3y": f"{t['low3y']:+.1f}%" if pd.notna(t['low3y']) else "-",
                "low3yPos": bool(t['low3y'] >= 0) if pd.notna(t['low3y']) else True,
                "neglect3y": f"{t['neglect3y']:.0f}" if pd.notna(t['neglect3y']) else "-",
                "expReturn": f"{t['expReturn']:.0f}%" if pd.notna(t['expReturn']) else "-",
                "rsi_d": "-",
                "rsi_w": "-",
                "rsi_m": "-",
                "update": t.get("update") or update_str,
                "score": t.get("score", 100)
            })
        return {"themes": sanitize(formatted_themes), "updated_at": updated_iso}
    else:
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
        '../data/all_stocks.json'
    ]
    file_path = None
    for p in candidate_paths:
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            file_path = p
            break

    if file_path:
        mtime = os.path.getmtime(file_path)
        kst_dt = datetime.datetime.fromtimestamp(mtime, tz=datetime.timezone(datetime.timedelta(hours=9)))
        update_str = kst_dt.strftime("%m.%d %H:%M")
        updated_iso = kst_dt.strftime("%Y-%m-%d %H:%M:%S")

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for s in data:
            if not s.get("update"):
                s["update"] = update_str
        
        result = {"stocks": sanitize(data), "updated_at": updated_iso}
        _live_fundamentals_cache = result
        _live_fundamentals_time = now
        return result
    raise HTTPException(status_code=404, detail="Stock data not found")

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
            # 네이버 해외 증권 포맷 후보 (.O = 나스닥, .N = 뉴욕, .K = 아르카)
            candidates = [f"{ticker}.O", f"{ticker}.N", f"{ticker}.K", ticker] if '.' not in ticker else [ticker]
            for cand in candidates:
                url = f"https://api.stock.naver.com/chart/foreign/item/{cand}?periodType={periodType}"
                try:
                    r = requests.get(url, headers=headers, timeout=5)
                    if r.status_code == 200:
                        data = r.json()
                        if data.get('priceInfos') and len(data['priceInfos']) > 0:
                            return data
                except Exception:
                    pass
            
            # 네이버 실패 시 FinanceDataReader 폴백
            try:
                import FinanceDataReader as fdr
                clean_ticker = ticker.split('.')[0]
                df = fdr.DataReader(clean_ticker)
                if not df.empty:
                    df = df.tail(120)
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

@app.get("/")
def read_root():
    return {"message": "DAJAVATA API Server is running!"}
