import requests
from bs4 import BeautifulSoup

def get_us_calendar():
    """
    네이버 해외증시 뉴스 또는 시황 뉴스를 분석하여 
    미국 증시 주요 일정 및 전망을 파악합니다.
    """
    # 네이버 금융 뉴스 - 해외증시 (section_id2=262)
    url = 'https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=262'
    try:
        res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        soup = BeautifulSoup(res.text, 'html.parser')
        links = soup.select('.articleSubject a')
        
        titles = [l.text.strip() for l in links]
        
        # '실적', '발표', '지수', '전망', '주목' 등이 포함된 기사 추출
        keywords = ['실적', '발표', '지수', '전망', '주목', '대기', '예상', '회의']
        events = []
        
        for title in titles:
            if any(k in title for k in keywords):
                events.append(title)
                
        # 최대 4개까지만 사용
        events = events[:4]
        
        results = []
        for evt in events:
            # 시간은 기사에서 정확히 추출하기 어려우므로 'Check' 등으로 표기하거나 
            # 텍스트 그대로 이벤트 란에 넣음
            clean_evt = evt.replace('[뉴욕증시]', '').replace('[글로벌 시황]', '').strip()
            
            results.append({
                "time": "Focus", 
                "event": clean_evt, 
                "impact": "글로벌 증시 주요 모멘텀 대기/주목"
            })
            
        if not results:
            results = [
                {"time": "22:30", "event": "미국 주요 경제지표 발표", "impact": "시장 변동성 확대 주의"},
                {"time": "장 마감 후", "event": "주요 기업 실적 발표", "impact": "실적 가이던스에 따른 주가 변동"}
            ]
            
        return results
        
    except Exception as e:
        print(f"미국 일정 수집 에러: {e}")
        return [
            {"time": "시스템", "event": "일정 로드 실패", "impact": "데이터를 불러오지 못했습니다."}
        ]

if __name__ == "__main__":
    import pprint
    pprint.pprint(get_us_calendar())
