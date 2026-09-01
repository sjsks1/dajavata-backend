import FinanceDataReader as fdr
import pandas as pd
import requests
from bs4 import BeautifulSoup

def get_special_issues():
    """네이버 금융 뉴스(시황/전망)에서 특징주 뉴스를 파싱합니다."""
    url = 'https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=258'
    try:
        res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        soup = BeautifulSoup(res.text, 'html.parser')
        links = soup.select('.articleSubject a')
        
        # 특징주 제목 추출
        features = [l.text.strip() for l in links if '특징주' in l.text]
        
        # 딕셔너리 형태로 변환 (최대 3~4개)
        issues = []
        for title in features[:4]:
            # 예: "[특징주] 삼성전자, 5만전자 붕괴..." -> stock="삼성전자", issue="5만전자 붕괴..."
            # 간단히 "]" 이후의 텍스트를 stock과 issue로 분리하거나 그대로 표출
            clean_title = title.replace('[특징주]', '').replace('[美특징주]', '').strip()
            
            # 쉼표나 띄어쓰기로 분리 시도
            parts = clean_title.split(',', 1)
            if len(parts) == 2:
                stock = parts[0].strip()
                issue = parts[1].strip()
            else:
                parts = clean_title.split(' ', 1)
                if len(parts) == 2:
                    stock = parts[0].strip()
                    issue = parts[1].strip()
                else:
                    stock = "특징주"
                    issue = clean_title
            
            issues.append({"stock": stock, "issue": issue})
            
        if not issues:
            issues = [{"stock": "-", "issue": "오늘의 특징주 뉴스가 없습니다."}]
            
        return issues
    except Exception as e:
        print(f"특징주 수집 에러: {e}")
        return [{"stock": "에러", "issue": "특징주 데이터를 불러오지 못했습니다."}]

def get_large_cap_heatmap(top_n=15):
    """
    코스피 시총 상위 N개 종목의 종가와 등락률을 반환합니다.
    """
    try:
        # 네이버 금융 시가총액 KOSPI 상위 페이지 스크래핑
        url = 'https://finance.naver.com/sise/sise_market_sum.naver'
        res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        dfs = pd.read_html(res.text)
        
        # 종목명 기준 유효한 데이터만 필터링
        df_kospi = dfs[1].dropna(subset=['종목명']).head(top_n)
        
        results = []
        for _, row in df_kospi.iterrows():
            code = str(row.get('종목코드', '')).zfill(6) # 코드값이 숫자로 파싱되었을 경우 대비
            name = row['종목명']
            close = float(row['현재가'])
            
            # 등락률 파싱 (예: "+1.17%")
            rate_str = str(row['등락률']).replace('%', '').replace('+', '').strip()
            try:
                change_rate = float(rate_str)
            except:
                change_rate = 0.0
                
            results.append({
                'code': code,
                'name': name,
                'close': close,
                'change_rate': change_rate
            })
            
        # 실제 뉴스 스크래핑
        special_issues = get_special_issues()
            
        return {'stocks': results, 'special_issues': special_issues}
        
    except Exception as e:
        print(f"Error fetching large cap data: {e}")
        return {'stocks': [], 'special_issues': []}

if __name__ == "__main__":
    import pprint
    pprint.pprint(get_large_cap_heatmap(15))
