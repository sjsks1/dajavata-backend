import asyncio
import aiohttp
from bs4 import BeautifulSoup
import json
import time
import os
import pandas as pd
import FinanceDataReader as fdr
import numpy as np
import math
import datetime

def clean_nan(obj):
    if isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan(v) for v in obj]
    elif isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj

# Create data directory if not exists
os.makedirs("data", exist_ok=True)

def safe_float(v):
    try:
        return float(str(v).replace(',', '').replace('%', '').replace('+', ''))
    except:
        return np.nan

async def fetch_themes_cursor(session, cursor=None):
    url = "https://stock.naver.com/api/stockSecurity/rankings/v2/domestic/themes?sortType=changeRate&size=100&period=daily"
    if cursor:
        url += f"&cursor={cursor}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        async with session.get(url, headers=headers, timeout=10) as res:
            data = await res.json()
            themes = []
            for item in data.get('items', []):
                themes.append({
                    'id': str(item['code']),
                    'name': item['name'],
                    'day1Pos': float(item.get('changeRate', 0))
                })
            next_cursor = data.get('cursor')
            return themes, next_cursor
    except Exception as e:
        print(f"Error fetching themes: {e}")
        return [], None

async def fetch_theme_stocks(session, theme_no, semaphore):
    url = f"https://stock.naver.com/api/domestic/market/theme/{theme_no}/stocklist?marketType=ALL&orderType=priceTop&startIdx=0&pageSize=100"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    async with semaphore:
        try:
            async with session.get(url, headers=headers, timeout=10) as res:
                data = await res.json()
                stocks = []
                for item in data:
                    stocks.append(str(item.get('itemcode', '')))
                return [s for s in stocks if s]
        except Exception as e:
            print(f"Failed to fetch theme stocks for {theme_no}: {e}")
            return []

async def fetch_stock_integration(session, code, semaphore):
    url = f"https://m.stock.naver.com/api/stock/{code}/integration"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    async with semaphore:
        try:
            async with session.get(url, headers=headers, timeout=5) as res:
                data = await res.json()
                result = {'code': code, 'PER': np.nan, 'PBR': np.nan, 'EPS': np.nan}
                if 'totalInfos' in data:
                    for info in data['totalInfos']:
                        key = info.get('key')
                        if key in ['PER', 'PBR', 'EPS']:
                            result[key] = safe_float(info.get('value').replace('배', '').replace('원', ''))
                return result
        except Exception as e:
            return {'code': code, 'PER': np.nan, 'PBR': np.nan, 'EPS': np.nan}

def calculate_stock_metrics(code, df_krx):
    try:
        # Fetch 3 years of daily data
        end_date = pd.Timestamp.today()
        start_date = end_date - pd.DateOffset(years=3)
        df = fdr.DataReader(code, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
        
        if df.empty or len(df) < 5:
            return None
            
        current_price = df['Close'].iloc[-1]
        
        # 1일 등락률
        day1 = ((current_price / df['Close'].iloc[-2]) - 1) * 100 if len(df) >= 2 else 0
        
        # 3일 합산
        day3 = ((current_price / df['Close'].iloc[-4]) - 1) * 100 if len(df) >= 4 else 0
        
        # 52주
        if len(df) > 250:
            cutoff = df.index.max() - pd.Timedelta(weeks=52)
            df_52w = df[df.index >= cutoff]
        else:
            df_52w = df
        high52 = df_52w['High'].max()
        low52 = df_52w['Low'].min()
        high52_change = ((high52 / current_price) - 1) * 100
        low52_change = ((low52 / current_price) - 1) * 100
        neglect52 = ((current_price - low52) / (high52 - low52)) * 100 if high52 != low52 else 0
        
        # 3년
        high3y = df['High'].max()
        low3y = df['Low'].min()
        high3y_change = ((high3y / current_price) - 1) * 100
        low3y_change = ((low3y / current_price) - 1) * 100
        neglect3y = ((current_price - low3y) / (high3y - low3y)) * 100 if high3y != low3y else 0
        
        # 기대수익률 (단순 예시)
        exp_return = max(0, high52_change)
        
        # Market Cap from KRX
        marcap = 0
        krx_row = df_krx[df_krx['Code'] == code]
        if not krx_row.empty:
            marcap = krx_row.iloc[0]['Marcap']
            name = krx_row.iloc[0]['Name']
        else:
            name = code
            
        return {
            'code': code,
            'name': name,
            'current_price': float(current_price),
            'day1': float(day1),
            'day3': float(day3),
            'high52': float(high52_change),
            'low52': float(low52_change),
            'neglect52': float(neglect52),
            'high3y': float(high3y_change),
            'low3y': float(low3y_change),
            'neglect3y': float(neglect3y),
            'expReturn': float(exp_return),
            'marcap': float(marcap)
        }
    except Exception as e:
        print(f"Error calculating metrics for {code}: {e}")
        return None

async def main():
    print("Starting theme data update pipeline...")
    
    # 1. Fetch KRX Listing for Market Cap and Names
    print("Fetching KRX listing...")
    from fdr_fallback import StockListing
    df_krx = StockListing('KRX')
    
    # 2. Fetch all themes
    print("Fetching themes list...")
    async with aiohttp.ClientSession() as session:
        all_themes = []
        cursor = None
        for i in range(5): # Safely limit to 5 pages
            themes, cursor = await fetch_themes_cursor(session, cursor)
            if not themes:
                break
            all_themes.extend(themes)
            if not cursor:
                break
            await asyncio.sleep(0.5)
            
    print(f"Found {len(all_themes)} themes.")
    
    # Use all themes
    themes_to_process = all_themes
    
    # 3. Fetch stocks for each theme
    print("Fetching stocks for each theme...")
    semaphore = asyncio.Semaphore(10)
    
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_theme_stocks(session, t['id'], semaphore) for t in themes_to_process]
        theme_stocks_results = await asyncio.gather(*tasks)
        
        for theme, stocks in zip(themes_to_process, theme_stocks_results):
            theme['stock_codes'] = stocks
            
    unique_codes = set(df_krx['Code'].tolist())
    for t in themes_to_process:
        unique_codes.update(t['stock_codes'])
        
    unique_codes = list(unique_codes)
    print(f"Found {len(unique_codes)} unique stocks.")
    
    # 4. Fetch PER/PBR/EPS for unique stocks
    print("Fetching PER/PBR/EPS...")
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_stock_integration(session, c, semaphore) for c in unique_codes]
        integration_results = await asyncio.gather(*tasks)
        
    integration_dict = {r['code']: r for r in integration_results}
    
    # 5. Calculate historical metrics for unique stocks (Run in ThreadPool to avoid blocking)
    print("Calculating historical metrics (this may take a while)...")
    stock_metrics_dict = {}
    
    loop = asyncio.get_running_loop()
    
    # Get current Korean Standard Time (KST)
    kst_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
    kst_update_str = kst_now.strftime("%m.%d %H:%M")

    # Process sequentially to avoid FDR rate limits
    for i, code in enumerate(unique_codes):
        if i % 10 == 0:
            print(f"Processed {i}/{len(unique_codes)} stocks...")
        metrics = await loop.run_in_executor(None, calculate_stock_metrics, code, df_krx)
        if metrics:
            metrics.update(integration_dict.get(code, {})) # merge PBR/PER
            metrics['update'] = kst_update_str
            stock_metrics_dict[code] = metrics

    print(f"Successfully calculated metrics for {len(stock_metrics_dict)}/{len(unique_codes)} stocks.")

    # 5.5. 네이버 실시간 호가/현재가 일괄 동기화 (100개씩 배치 호출하여 100% 실시간 시세 반영)
    print("Fetching live real-time prices & change rates from Naver Polling API...")
    async with aiohttp.ClientSession() as poll_session:
        batch_size = 100
        for i in range(0, len(unique_codes), batch_size):
            batch = unique_codes[i:i+batch_size]
            url = f"https://polling.finance.naver.com/api/realtime/domestic/stock/{','.join(batch)}"
            headers = {'User-Agent': 'Mozilla/5.0'}
            try:
                async with poll_session.get(url, headers=headers, timeout=10) as p_res:
                    if p_res.status == 200:
                        p_data = await p_res.json()
                        for item in p_data.get('datas', []):
                            c = item.get('itemCode')
                            if not c:
                                continue
                            close_raw = item.get('closePriceRaw') or item.get('closePrice')
                            ratio_raw = item.get('fluctuationsRatioRaw') or item.get('fluctuationsRatio')
                            try:
                                live_price = float(str(close_raw).replace(',', ''))
                            except:
                                live_price = None
                            try:
                                live_day1 = float(str(ratio_raw).replace('%', '').replace('+', ''))
                            except:
                                live_day1 = None
                            
                            if c in stock_metrics_dict:
                                if live_price is not None:
                                    stock_metrics_dict[c]['current_price'] = live_price
                                if live_day1 is not None:
                                    stock_metrics_dict[c]['day1'] = live_day1
                                stock_metrics_dict[c]['update'] = kst_update_str
                            else:
                                stock_name = item.get('stockName') or c
                                stock_metrics_dict[c] = {
                                    'code': c,
                                    'name': stock_name,
                                    'current_price': live_price if live_price is not None else 0,
                                    'day1': live_day1 if live_day1 is not None else 0,
                                    'day3': 0,
                                    'high52': 0,
                                    'low52': 0,
                                    'neglect52': 0,
                                    'high3y': 0,
                                    'low3y': 0,
                                    'neglect3y': 0,
                                    'expReturn': 0,
                                    'marcap': 0,
                                    'update': kst_update_str
                                }
            except Exception as pe:
                print(f"Error fetching live batch {i}: {pe}")

    print("Aggregating theme metrics...")
    final_themes = []
    theme_details = {}
    
    for theme in themes_to_process:
        codes = theme['stock_codes']
        theme_stock_data = [stock_metrics_dict[c] for c in codes if c in stock_metrics_dict]
        
        if not theme_stock_data:
            continue
            
        df_theme = pd.DataFrame(theme_stock_data)
        
        # Average metrics
        day3_avg = df_theme['day3'].mean()
        high52_avg = df_theme['high52'].mean()
        low52_avg = df_theme['low52'].mean()
        neglect52_avg = df_theme['neglect52'].mean()
        high3y_avg = df_theme['high3y'].mean()
        low3y_avg = df_theme['low3y'].mean()
        neglect3y_avg = df_theme['neglect3y'].mean()
        exp_return_avg = df_theme['expReturn'].mean()
        
        final_themes.append({
            'name': theme['name'],
            'theme_id': theme['id'],
            'day1Pos': theme['day1Pos'],
            'day3Pos': float(day3_avg),
            'high52': float(high52_avg),
            'low52': float(low52_avg),
            'neglect52': float(neglect52_avg),
            'high3y': float(high3y_avg),
            'low3y': float(low3y_avg),
            'neglect3y': float(neglect3y_avg),
            'expReturn': float(exp_return_avg),
            'score': 100, # Placeholder
            'update': kst_update_str
        })
        
        # Save details
        theme_details[theme['name']] = theme_stock_data

    # 7. Save to JSON (안전장치: 빈 데이터 덮어쓰기 방지)
    all_stocks_list = list(stock_metrics_dict.values())
    if not final_themes or len(theme_details) == 0 or len(all_stocks_list) == 0:
        print("⚠️ 테마 또는 종목 상세 데이터가 비어있어(0건) 파일 덮어쓰기를 건너뜁니다 (기존 데이터 100% 보존).")
    else:
        print("Saving to JSON files...")
        target_dirs = []
        for cand in ['data', '../data', 'dajavata_backend/data', 'dajavata/dist/data', '../dajavata/dist/data']:
            if os.path.exists(cand) or cand in ['data', 'dajavata_backend/data']:
                if cand not in target_dirs:
                    target_dirs.append(cand)
        
        for t_dir in target_dirs:
            os.makedirs(t_dir, exist_ok=True)
            with open(os.path.join(t_dir, 'theme_cache.json'), 'w', encoding='utf-8') as f:
                json.dump(clean_nan(final_themes), f, ensure_ascii=False, indent=2)
            with open(os.path.join(t_dir, 'theme_details.json'), 'w', encoding='utf-8') as f:
                json.dump(clean_nan(theme_details), f, ensure_ascii=False, indent=2)
            with open(os.path.join(t_dir, 'all_stocks.json'), 'w', encoding='utf-8') as f:
                json.dump(clean_nan(all_stocks_list), f, ensure_ascii=False, indent=2)
        print(f"Data saved successfully to {target_dirs} ({len(final_themes)} themes, {len(theme_details)} details, {len(all_stocks_list)} stocks).")
        
    print("Update complete! You can run this script daily.")

if __name__ == "__main__":
    asyncio.run(main())
