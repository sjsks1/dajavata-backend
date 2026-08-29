import sys
import os
import datetime
import uvicorn
import pandas as pd
import FinanceDataReader as fdr
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Dajavata Server")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Theme mapping to represent them as ETFs
THEME_ETF_MAP = {
    "2차전지": "305540",      # TIGER 2차전지테마
    "반도체 장비": "091160",   # KODEX 반도체
    "의료AI": "447770",       # KODEX K-로봇액티브 (의료AI/로봇 공통 프록시)
    "로봇": "447770",        # KODEX K-로봇액티브
    "우주항공": "439250",     # ARIRANG 우주항공&UAM iSelect
    "바이오/제약": "143860",   # TIGER 헬스케어
    "IT": "139260",         # TIGER IT
    "자동차": "091180",       # KODEX 자동차
    "건설": "117700",       # TIGER 건설건자재
    "엔터테인먼트": "157500",  # TIGER 미디어컨텐츠
}

def calculate_rsi(df, period=14):
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
            rsi_d = calculate_rsi(df, period=14)
            
            # Resample needs datetime index
            if 'Date' in df.columns:
                df_time = df.set_index('Date')
            else:
                df_time = df
                
            df_w = df_time.resample('W').last()
            rsi_w = calculate_rsi(df_w, period=14)
            
            df_m = df_time.resample('ME').last()
            rsi_m = calculate_rsi(df_m, period=14)
            
            # Expected Return (Mock logic based on neglect index or RSI)
            exp_return = max(0, neglect_52w * 1.5 - (rsi_d if rsi_d else 50) * 0.5)
            
            results.append({
                "name": s_name,
                "desc": f"{s_name} 관련 펀드(ETF: {ticker}) 성과입니다.",
                "day1": f"{day1_change:+.2f}%",
                "day1Pos": day1_change >= 0,
                "day3": f"{day3_change:+.2f}%",
                "day3Pos": day3_change >= 0,
                "high52": f"{high_52w_pct:+.1f}%",
                "high52Pos": high_52w_pct >= 0,
                "low52": f"{low_52w_pct:+.1f}%",
                "low52Pos": low_52w_pct >= 0,
                "neglect52": str(neglect_52w),
                "high3y": f"{high_3y_pct:+.1f}%",
                "high3yPos": high_3y_pct >= 0,
                "low3y": f"{low_3y_pct:+.1f}%",
                "low3yPos": low_3y_pct >= 0,
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
    themes = calculate_theme_metrics()
    return {"themes": themes}

# Mount static files from dajavata folder
DAJAVATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dajavata")

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(DAJAVATA_DIR, "index.html"))

app.mount("/", StaticFiles(directory=DAJAVATA_DIR), name="static")

if __name__ == "__main__":
    uvicorn.run("dajavata_server:app", host="0.0.0.0", port=8001, reload=True)
