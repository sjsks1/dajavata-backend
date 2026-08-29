import asyncio
import aiohttp
from bs4 import BeautifulSoup
import json
import time

async def fetch_themes_page(session, page):
    url = f"https://finance.naver.com/sise/theme.naver?&page={page}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    async with session.get(url, headers=headers) as res:
        html = await res.text(encoding='euc-kr')
        soup = BeautifulSoup(html, 'html.parser')
        
        themes = []
        table = soup.find('table', {'class': 'type_1 theme'})
        if not table:
            return themes
            
        for tr in table.find_all('tr'):
            td_col1 = tr.find('td', {'class': 'col_type1'})
            if td_col1 and td_col1.find('a'):
                a_tag = td_col1.find('a')
                name = a_tag.text.strip()
                href = a_tag['href']
                theme_no = href.split('no=')[-1]
                
                # Extract some stats if available
                tds = tr.find_all('td')
                day_change = tds[1].text.strip() if len(tds) > 1 else "0"
                
                themes.append({
                    'id': theme_no,
                    'name': name,
                    'day_change': day_change
                })
        return themes

async def fetch_all_themes():
    async with aiohttp.ClientSession() as session:
        all_themes = []
        for page in range(1, 8): # Usually 7 pages of themes
            themes = await fetch_themes_page(session, page)
            if not themes:
                break
            all_themes.extend(themes)
            await asyncio.sleep(0.5)
            
        print(f"Found {len(all_themes)} themes in total.")
        print(all_themes[:5])
        
        # Now fetch details for the first theme to test
        if all_themes:
            first_theme = all_themes[0]
            await fetch_theme_details(session, first_theme['id'])

async def fetch_theme_details(session, theme_no):
    url = f"https://finance.naver.com/sise/sise_group_detail.naver?type=theme&no={theme_no}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    async with session.get(url, headers=headers) as res:
        html = await res.text(encoding='euc-kr')
        soup = BeautifulSoup(html, 'html.parser')
        
        stocks = []
        table = soup.find('table', {'class': 'type_5'})
        if not table:
            return stocks
            
        for tr in table.find_all('tr'):
            td_name = tr.find('td', {'class': 'name'})
            if td_name and td_name.find('a'):
                name = td_name.find('a').text.strip()
                href = td_name.find('a')['href']
                code = href.split('code=')[-1]
                
                tds = tr.find_all('td')
                if len(tds) >= 10:
                    current_price = tds[2].text.strip()
                    day_change = tds[3].text.strip().replace('\n', '').replace('\t', '')
                    day_change_percent = tds[4].text.strip().replace('\n', '').replace('\t', '')
                    
                    stocks.append({
                        'code': code,
                        'name': name,
                        'current_price': current_price,
                        'day_change': day_change,
                        'day_change_percent': day_change_percent
                    })
                    
        print(f"Found {len(stocks)} stocks in theme {theme_no}")
        print(stocks[:3])

if __name__ == "__main__":
    asyncio.run(fetch_all_themes())
