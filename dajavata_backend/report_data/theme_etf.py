import FinanceDataReader as fdr
import pandas as pd
from datetime import datetime, timedelta

THEME_ETF_MAP = {
    "2차전지": {"ticker": "305540", "name": "TIGER 2차전지테마"},
    "반도체": {"ticker": "091160", "name": "KODEX 반도체"},
    "의료AI/로봇": {"ticker": "447770", "name": "TIGER 글로벌의료AI"},
    "우주항공": {"ticker": "439250", "name": "ARIRANG 우주항공&UAM"},
    "바이오/제약": {"ticker": "143860", "name": "TIGER 헬스케어"},
    "IT": {"ticker": "139260", "name": "TIGER IT"},
    "자동차": {"ticker": "091180", "name": "KODEX 자동차"},
    "건설": {"ticker": "117700", "name": "TIGER 건설건자재"},
    "엔터테인먼트": {"ticker": "157500", "name": "TIGER K-게임"},
    "방산": {"ticker": "449450", "name": "PLUS K방산"},
    "원전": {"ticker": "432320", "name": "HANARO 원자력iSelect"},
    "금융": {"ticker": "091220", "name": "KODEX 은행"},
    "화장품": {"ticker": "228790", "name": "TIGER 화장품"},
}

def get_theme_etf_flows():
    """
    주요 테마별 ETF의 당일 등락률을 조회합니다.
    """
    end_date = datetime.today()
    start_date = end_date - timedelta(days=10) # 10일치 (전일비 계산용)
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    
    results = []
    
    for theme_name, info in THEME_ETF_MAP.items():
        ticker = info["ticker"]
        etf_name = info["name"]
        try:
            df = fdr.DataReader(ticker, start=start_str, end=end_str)
            if df.empty or len(df) < 2:
                continue
            
            last_close = float(df['Close'].iloc[-1])
            prev_close = float(df['Close'].iloc[-2])
            change_rate = ((last_close / prev_close) - 1) * 100
            
            results.append({
                'theme': theme_name,
                'etf_name': etf_name,
                'ticker': ticker,
                'change_rate': change_rate,
                'last_close': last_close
            })
        except Exception as e:
            print(f"Error fetching {theme_name} ({ticker}): {e}")
            
    # 등락률 순으로 정렬
    results.sort(key=lambda x: x['change_rate'], reverse=True)
    return results

if __name__ == "__main__":
    import pprint
    pprint.pprint(get_theme_etf_flows())
