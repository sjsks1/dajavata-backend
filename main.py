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

app = FastAPI()

# Cache for stock list
stock_list = []

@app.on_event("startup")
def load_stocks():
    global stock_list
    print("Loading KRX stock list...")
    try:
        kospi = fdr.StockListing('KOSPI')
        kosdaq = fdr.StockListing('KOSDAQ')
        df = pd.concat([kospi, kosdaq])
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/api/themes")
def get_themes():
    cache_file = 'data/theme_cache.json'
    if os.path.exists(cache_file):
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
                "update": "오늘",
                "score": t.get("score", 100)
            })
        return {"themes": formatted_themes}
    else:
        # Fallback to ETF calculation
        themes = calculate_theme_metrics()
        return {"themes": themes}

@app.get("/api/themes/{theme_name:path}")
def get_theme_details(theme_name: str):
    # theme_name이 path로 들어올 때, url decode는 starlette이 자동으로 해줌.
    # 만약 encodeURIComponent로 보낸 경우, '/'가 포함된 테마명도 안전하게 받을 수 있음.
    
    file_path = 'data/theme_details.json'
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Exact match
        if theme_name in data:
            return {"theme": theme_name, "stocks": data[theme_name]}
            
        raise HTTPException(status_code=404, detail=f"Theme '{theme_name}' not found")
    
    raise HTTPException(status_code=404, detail="Theme details data not found")

@app.get("/api/stocks")
def get_stocks():
    return stock_list

@app.get("/api/stocks/fundamentals")
def get_stocks_fundamentals():
    file_path = 'data/all_stocks.json'
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return {"stocks": data}
    raise HTTPException(status_code=404, detail="Stock data not found")

@app.get("/")
def read_root():
    return {"message": "DAJAVATA API Server is running!"}
