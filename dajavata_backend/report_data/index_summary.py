import FinanceDataReader as fdr
import pandas as pd
from datetime import datetime, timedelta

def get_index_summary():
    """
    KOSPI, KOSDAQ, 환율 종가 및 등락률, 최근 20일 시세 데이터를 반환합니다.
    """
    end_date = datetime.today()
    start_date = end_date - timedelta(days=60) # 주말 포함 넉넉히 60일 (거래일 기준 20일 확보 위해)
    
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    
    indices = {
        'KOSPI': 'KS11',
        'KOSDAQ': 'KQ11',
        'USD_KRW': 'USD/KRW'
    }
    
    results = {}
    
    for key, symbol in indices.items():
        try:
            df = fdr.DataReader(symbol, start_str, end_str)
            if df.empty:
                continue
            
            # 최근 2일 데이터로 등락 계산
            last_close = float(df['Close'].iloc[-1])
            prev_close = float(df['Close'].iloc[-2]) if len(df) > 1 else last_close
            
            change_val = last_close - prev_close
            change_rate = (change_val / prev_close) * 100 if prev_close != 0 else 0
            
            # 거래대금 (환율은 거래대금 없음)
            volume = float(df['Volume'].iloc[-1]) if 'Volume' in df.columns else 0
            
            # 최근 20일 종가 리스트 (미니 차트용)
            recent_prices = df['Close'].tail(20).tolist()
            
            results[key] = {
                'close': last_close,
                'change_val': change_val,
                'change_rate': change_rate,
                'volume': volume,
                'recent_prices': recent_prices
            }
        except Exception as e:
            print(f"Error fetching {symbol}: {e}")
            
    return results

if __name__ == "__main__":
    print(get_index_summary())
