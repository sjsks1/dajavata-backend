import os
import asyncio
from playwright.async_api import async_playwright
import requests
from dotenv import load_dotenv

# Import data modules
from report_data import index_summary
from report_data import investor_flow
from report_data import theme_etf
from report_data import large_cap
from report_data import sector_analysis
from report_data import us_calendar

load_dotenv()
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CARDS_DIR = os.path.join(BASE_DIR, 'report_cards')
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')

os.makedirs(OUTPUT_DIR, exist_ok=True)

def format_color(val):
    if val > 0: return 'up'
    elif val < 0: return 'down'
    return 'flat'

def get_sign(val):
    if val > 0: return '▲'
    elif val < 0: return '▼'
    return '-'

def format_number(val, decimal=2, is_currency=False):
    if val is None: return "-"
    if is_currency:
        return f"{val:,.0f}"
    return f"{val:,.{decimal}f}"

async def render_image(html_content, output_path):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(device_scale_factor=2) # High res
        await page.set_content(html_content)
        
        # Wait for the card container
        card = await page.wait_for_selector('.card-container')
        
        # Take a screenshot of just the card container
        await card.screenshot(path=output_path)
        await browser.close()

async def generate_index_card():
    data = index_summary.get_index_summary()
    with open(os.path.join(CARDS_DIR, 'card_index.html'), 'r', encoding='utf-8') as f:
        html = f.read()
    
    kospi = data.get('KOSPI', {})
    kosdaq = data.get('KOSDAQ', {})
    usd = data.get('USD_KRW', {})
    
    html = html.replace('{KOSPI_CLOSE}', format_number(kospi.get('close')))
    html = html.replace('{KOSPI_CHANGE}', f"{get_sign(kospi.get('change_rate', 0))} {abs(kospi.get('change_val', 0)):.2f}")
    html = html.replace('{KOSPI_RATE}', format_number(abs(kospi.get('change_rate', 0))))
    html = html.replace('{KOSPI_COLOR}', format_color(kospi.get('change_rate', 0)))
    
    html = html.replace('{KOSDAQ_CLOSE}', format_number(kosdaq.get('close')))
    html = html.replace('{KOSDAQ_CHANGE}', f"{get_sign(kosdaq.get('change_rate', 0))} {abs(kosdaq.get('change_val', 0)):.2f}")
    html = html.replace('{KOSDAQ_RATE}', format_number(abs(kosdaq.get('change_rate', 0))))
    html = html.replace('{KOSDAQ_COLOR}', format_color(kosdaq.get('change_rate', 0)))
    
    html = html.replace('{USD_CLOSE}', format_number(usd.get('close'), is_currency=True))
    html = html.replace('{USD_CHANGE}', f"{get_sign(usd.get('change_val', 0))} {abs(usd.get('change_val', 0)):.1f}")
    html = html.replace('{USD_RATE}', format_number(abs(usd.get('change_rate', 0))))
    html = html.replace('{USD_COLOR}', format_color(usd.get('change', 0))) # 환율은 등락률 부호 반대로 많이 쓰지만, 일단 그대로
    
    out_path = os.path.join(OUTPUT_DIR, 'card_index.png')
    await render_image(html, out_path)
    return out_path

async def generate_flow_card():
    data = investor_flow.get_investor_flow()
    with open(os.path.join(CARDS_DIR, 'card_flow.html'), 'r', encoding='utf-8') as f:
        html = f.read()
        
    kospi = data.get('KOSPI', {})
    kosdaq = data.get('KOSDAQ', {})
    
    for market, m_data in [('KOSPI', kospi), ('KOSDAQ', kosdaq)]:
        for inv, key in [('retail', 'RET'), ('foreigner', 'FOR'), ('institution', 'INS')]:
            val = m_data.get(inv, 0)
            sign = "+" if val > 0 else ""
            html = html.replace(f'{{{market}_{key}}}', f"{sign}{val:,.0f}")
            html = html.replace(f'{{{market}_{key}_COLOR}}', format_color(val))
            
    out_path = os.path.join(OUTPUT_DIR, 'card_flow.png')
    await render_image(html, out_path)
    return out_path

async def generate_theme_etf_card():
    data = theme_etf.get_theme_etf_flows()
    with open(os.path.join(CARDS_DIR, 'card_theme_etf.html'), 'r', encoding='utf-8') as f:
        html = f.read()
        
    boxes = ""
    for item in data:
        name = item.get('etf_name', item.get('theme', ''))
        rate = item.get('change_rate', 0)
        color = format_color(rate)
        sign = "+" if rate > 0 else ""
        boxes += f'''
        <div class="box">
            <div class="box-title">{name}</div>
            <div class="box-change {color}">{sign}{rate:.2f}%</div>
        </div>
        '''
    
    html = html.replace('{THEME_ETF_BOXES}', boxes)
    out_path = os.path.join(OUTPUT_DIR, 'card_theme_etf.png')
    await render_image(html, out_path)
    return out_path

async def generate_large_cap_card():
    result = large_cap.get_large_cap_heatmap()
    data = result.get('stocks', [])
    issues = result.get('special_issues', [])
    with open(os.path.join(CARDS_DIR, 'card_largecap.html'), 'r', encoding='utf-8') as f:
        html = f.read()
        
    boxes = ""
    for item in data:
        name = item.get('name', '')
        rate = item.get('change_rate', 0)
        
        # Heatmap color logic
        if rate >= 3: c_class = "c-up-strong"
        elif rate >= 1: c_class = "c-up"
        elif rate > 0: c_class = "c-up-weak"
        elif rate <= -3: c_class = "c-down-strong"
        elif rate <= -1: c_class = "c-down"
        elif rate < 0: c_class = "c-down-weak"
        else: c_class = "c-flat"
        
        sign = "+" if rate > 0 else ""
        
        boxes += f'''
        <div class="box {c_class}">
            <div class="box-title">{name}</div>
            <div class="box-change">{sign}{rate:.1f}%</div>
        </div>
        '''
        
    issues_html = ""
    for item in issues:
        issues_html += f'''
        <div class="issue-item"><span class="issue-stock">{item['stock']}:</span> {item['issue']}</div>
        '''
        
    html = html.replace('{LARGECAP_BOXES}', boxes)
    html = html.replace('{SPECIAL_ISSUES}', issues_html)
    
    out_path = os.path.join(OUTPUT_DIR, 'card_largecap.png')
    await render_image(html, out_path)
    return out_path

async def generate_sector_card():
    data = sector_analysis.get_strong_sectors()
    with open(os.path.join(CARDS_DIR, 'card_sector.html'), 'r', encoding='utf-8') as f:
        html = f.read()
        
    boxes = ""
    for item in data:
        boxes += f'''
        <div class="box">
            <div class="box-title">{item['sector']}</div>
            <div class="box-change">+{item['change_rate']:.2f}%</div>
            <div class="box-stocks">{item['rep_stocks']}</div>
        </div>
        '''
        
    html = html.replace('{SECTOR_BOXES}', boxes)
    
    out_path = os.path.join(OUTPUT_DIR, 'card_sector.png')
    await render_image(html, out_path)
    return out_path
    
async def generate_calendar_card():
    data = us_calendar.get_us_calendar()
    with open(os.path.join(CARDS_DIR, 'card_us_calendar.html'), 'r', encoding='utf-8') as f:
        html = f.read()
        
    list_html = ""
    for item in data:
        list_html += f'''
        <div class="list-item">
            <div class="item-header">
                <span class="item-time">{item['time']}</span>
                <span class="item-event">{item['event']}</span>
            </div>
            <div class="item-impact">{item['impact']}</div>
        </div>
        '''
        
    html = html.replace('{CALENDAR_LIST}', list_html)
    
    out_path = os.path.join(OUTPUT_DIR, 'card_us_calendar.png')
    await render_image(html, out_path)
    return out_path

def send_telegram_media_group(chat_id, token, media_paths, caption=""):
    url = f"https://api.telegram.org/bot{token}/sendMediaGroup"
    
    files = {}
    media = []
    
    for i, path in enumerate(media_paths):
        name = f"photo_{i}"
        files[name] = open(path, 'rb')
        item = {
            "type": "photo",
            "media": f"attach://{name}"
        }
        if i == 0 and caption:
            item["caption"] = caption
            item["parse_mode"] = "HTML"
        media.append(item)
        
    data = {'chat_id': chat_id, 'media': str(media).replace("'", '"')}
    
    response = requests.post(url, data=data, files=files)
    
    for f in files.values():
        f.close()
        
    return response.json()

async def main():
    print("Generating report cards...")
    
    paths = await asyncio.gather(
        generate_index_card(),
        generate_flow_card(),
        generate_theme_etf_card(),
        generate_large_cap_card(),
        generate_sector_card(),
        generate_calendar_card()
    )
    
    print(f"Cards generated at: {paths}")
    
    if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
        print("Sending to Telegram...")
        caption = "📊 <b>오늘의 증시 마감 브리핑</b>\n\n📌 <b>주요 내용</b>\n- 지수 마감 및 수급 현황\n- 테마 ETF 및 강세 섹터\n- 대형주 흐름 및 특징주\n- 미국 증시 주요 일정"
        res = send_telegram_media_group(TELEGRAM_CHAT_ID, TELEGRAM_BOT_TOKEN, paths, caption)
        print("Telegram response received (status ok).")
    else:
        print("Telegram credentials not found in .env, skipping upload.")

if __name__ == "__main__":
    asyncio.run(main())
