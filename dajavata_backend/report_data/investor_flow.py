import requests
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime

def get_investor_flow():
    """
    네이버 금융에서 당일 코스피, 코스닥의 투자자별 매매동향을 가져옵니다.
    """
    flow_data = {'KOSPI': {}, 'KOSDAQ': {}}
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    # 오늘 날짜
    today_str = datetime.today().strftime('%Y%m%d')
    
    def fetch_flow(sosok):
        url = f'https://finance.naver.com/sise/investorDealTrendDay.naver?bizdate={today_str}&sosok={sosok}&page=1'
        res = requests.get(url, headers=headers)
        soup = BeautifulSoup(res.text, 'html.parser')
        tables = soup.find_all('table')
        if not tables:
            return 0, 0, 0
            
        for tr in tables[0].find_all('tr'):
            tds = tr.find_all('td')
            if len(tds) >= 4:
                date_str = tds[0].text.strip()
                if not date_str or date_str == '': continue
                
                try:
                    retail = int(tds[1].text.replace(',', ''))
                    foreign = int(tds[2].text.replace(',', ''))
                    inst = int(tds[3].text.replace(',', ''))
                    return retail, foreign, inst
                except:
                    pass
        return 0, 0, 0
            
    # sosok: 01 (KOSPI), 02 (KOSDAQ)
    flow_data['KOSPI']['retail'], flow_data['KOSPI']['foreigner'], flow_data['KOSPI']['institution'] = fetch_flow('01')
    flow_data['KOSDAQ']['retail'], flow_data['KOSDAQ']['foreigner'], flow_data['KOSDAQ']['institution'] = fetch_flow('02')
    
    # 상승 하락 종목 수는 거래소 데이터가 필요하지만, 이미지상 네이버 금융에서 스크랩이 어려우면
    # 수급 요약 카드에는 매수/매도 동향만 넣거나, None으로 두겠습니다.
    flow_data['KOSPI']['adv'] = 0
    flow_data['KOSPI']['dec'] = 0
    flow_data['KOSDAQ']['adv'] = 0
    flow_data['KOSDAQ']['dec'] = 0
    
    return flow_data

if __name__ == "__main__":
    import pprint
    pprint.pprint(get_investor_flow())
