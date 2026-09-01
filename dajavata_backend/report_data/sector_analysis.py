import requests
from bs4 import BeautifulSoup

def get_strong_sectors(top_n=4):
    """
    네이버 금융에서 실시간으로 당일 상승률 상위 섹터(테마)를 가져옵니다.
    """
    url = "https://finance.naver.com/sise/theme.naver"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        res = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        table = soup.find('table', {'class': 'type_1 theme'})
        if not table:
            return []
            
        themes = []
        for tr in table.find_all('tr'):
            td_col1 = tr.find('td', {'class': 'col_type1'})
            if td_col1 and td_col1.find('a'):
                a_tag = td_col1.find('a')
                name = a_tag.text.strip()
                href = a_tag['href']
                
                tds = tr.find_all('td')
                day_change_str = tds[1].text.strip() if len(tds) > 1 else "0"
                try:
                    change_rate = float(day_change_str.replace('%', '').replace('+', ''))
                except:
                    change_rate = 0.0
                
                themes.append({
                    'name': name,
                    'change_rate': change_rate,
                    'url': 'https://finance.naver.com' + href
                })
        
        # 당일 상승률 기준 정렬
        themes.sort(key=lambda x: x['change_rate'], reverse=True)
        top_themes = themes[:top_n]
        
        results = []
        for t in top_themes:
            # 각 테마별 대표 종목 가져오기
            try:
                t_res = requests.get(t['url'], headers=headers, timeout=10)
                t_soup = BeautifulSoup(t_res.text, 'html.parser')
                t_table = t_soup.find('table', {'class': 'type_5'})
                
                stocks = []
                if t_table:
                    # 상위 3개 종목 (등락률 순으로 이미 정렬되어 있는 경우가 많음)
                    for tr in t_table.find_all('tr'):
                        td_name = tr.find('td', {'class': 'name'})
                        if td_name and td_name.find('a'):
                            stocks.append(td_name.find('a').text.strip())
                            
                rep_stocks = stocks[:3]
            except Exception as e:
                print(f"Error fetching stocks for {t['name']}: {e}")
                rep_stocks = []
                
            results.append({
                'sector': t['name'],
                'change_rate': t['change_rate'],
                'rep_stocks': ", ".join(rep_stocks)
            })
            
        return results
        
    except Exception as e:
        print(f"Error fetching strong sectors: {e}")
        return []

if __name__ == "__main__":
    import pprint
    pprint.pprint(get_strong_sectors())
