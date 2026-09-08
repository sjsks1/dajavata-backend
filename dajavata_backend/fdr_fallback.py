import pandas as pd
import requests

def StockListing(market='KRX'):
    """
    Fallback for FinanceDataReader.StockListing() which is currently broken
    due to KRX blocking the requests.
    """
    if market == 'KRX-DESC':
        url = 'http://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13'
        try:
            df = pd.read_html(url, header=0, encoding='euc-kr')[0]
            df = df[['회사명', '종목코드', '업종', '주요제품']]
            df = df.rename(columns={'회사명': 'Name', '종목코드': 'Code', '업종': 'Sector', '주요제품': 'Industry'})
            df['Code'] = df['Code'].astype(str).str.zfill(6)
            return df
        except Exception as e:
            print(f"Error fetching KRX-DESC: {e}")
            return pd.DataFrame(columns=['Name', 'Code', 'Sector', 'Industry'])

    markets = ['KOSPI', 'KOSDAQ']
    if market in ['KOSPI', 'KOSDAQ']:
        markets = [market]
    
    all_data = []
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    for m in markets:
        page = 1
        page_size = 100
        while True:
            url = f'https://m.stock.naver.com/api/stocks/marketValue/{m}?page={page}&pageSize={page_size}'
            r = requests.get(url, headers=headers)
            try:
                res = r.json()
            except Exception as e:
                print(f"Error fetching Naver API page {page}: {r.text[:200]}")
                break
                
            stocks = res.get('stocks', [])
            if not stocks:
                break
            
            for s in stocks:
                try:
                    fluctuationsRatio = float(s.get('fluctuationsRatio', 0))
                except (ValueError, TypeError):
                    fluctuationsRatio = 0.0
                    
                all_data.append({
                    'Code': s.get('itemCode'),
                    'Name': s.get('stockName'),
                    'Market': m,
                    'ChagesRatio': fluctuationsRatio, # Note: deliberate typo ChagesRatio to match FDR
                    'Marcap': int(s.get('marketValueRaw', 0) or 0),
                    'Close': int(s.get('closePriceRaw', 0) or 0)
                })
                
            total_count = res.get('totalCount', 0)
            if page * page_size >= total_count:
                break
            page += 1
            
    df = pd.DataFrame(all_data)
    return df
