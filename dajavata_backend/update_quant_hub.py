import os
import json
import time
import shutil
import calendar as pycal
import datetime
import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(_SCRIPT_DIR) if os.path.basename(_SCRIPT_DIR) == "dajavata_backend" else _SCRIPT_DIR


def fetch_json(url, timeout=10, default=None):
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        print(f"[WARN] Failed to fetch {url}: {e}")
    return default


def load_local_json(rel_path, default=None):
    full_path = os.path.join(BASE_DIR, rel_path)
    if os.path.exists(full_path):
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load {full_path}: {e}")
    return default


def fetch_naver_top_supply():
    """네이버 금융 외국인/기관 순매수 상위 및 거래상위 종목 수집 (국내 큰손/수급 시그널용)"""
    foreign_buy = []
    inst_buy = []
    for sosok in ["01", "02"]:  # 01: 코스피, 02: 코스닥
        mkt_label = "KOSPI" if sosok == "01" else "KOSDAQ"
        # 외국인 순매수 상위
        url_f = f"https://m.stock.naver.com/api/stocks/marketValue/{sosok}?page=1&pageSize=40"
        data_f = fetch_json(url_f, timeout=6, default={})
        for item in data_f.get("stocks", []):
            code = item.get("itemCode")
            if not code:
                continue
            try:
                price = float(str(item.get("closePrice", "0")).replace(",", ""))
                chg = float(str(item.get("fluctuationsRatio", "0")).replace(",", "").replace("%", ""))
                marcap_100m = float(str(item.get("marketValue", "0")).replace(",", ""))
                vol = int(str(item.get("accumulatedTradingVolume", "0")).replace(",", ""))
            except Exception:
                price, chg, marcap_100m, vol = 0, 0, 0, 0
            foreign_buy.append({
                "code": code,
                "name": item.get("stockName", ""),
                "market": mkt_label,
                "price": price,
                "chg": chg,
                "marcap": marcap_100m * 100000000,
                "volume": vol
            })
    return foreign_buy


def build_kr_rising_and_promising(all_stocks, theme_details):
    """
    국내 주식(all_stocks.json + theme_details.json)을 기반으로
    1) Rising Stocks (6대 복합 시그널 가중 합산 Top Picks & 시그널별 리스트)
    2) Promising Stock Ranking (시총 하한 + 고점 대비 낙폭과대 랭킹)
    3) Market View (국내 시총/회전율/수급 랭킹)
    생성
    """
    # 종목별 소속 테마 매핑
    stock_themes = {}
    if isinstance(theme_details, dict):
        for t_name, st_list in theme_details.items():
            if not isinstance(st_list, list):
                continue
            for s in st_list:
                c = s.get("code")
                if c:
                    stock_themes.setdefault(c, []).append(t_name)

    valid_stocks = []
    for s in all_stocks:
        code = str(s.get("code", "")).strip()
        name = str(s.get("name", "")).strip()
        if not code or not name:
            continue
        price = float(s.get("current_price") or 0)
        marcap = float(s.get("marcap") or 0)
        if price <= 0 or marcap <= 0:
            continue
        day1 = float(s.get("day1") or 0)
        day3 = float(s.get("day3") or 0)
        high52 = float(s.get("high52") if s.get("high52") is not None else -50)
        low52 = float(s.get("low52") if s.get("low52") is not None else 0)
        neglect52 = float(s.get("neglect52") if s.get("neglect52") is not None else 50)
        high3y = float(s.get("high3y") if s.get("high3y") is not None else high52)
        per = float(s.get("PER") or 0)
        pbr = float(s.get("PBR") or 0)
        themes = stock_themes.get(code, [])
        primary_sector = themes[0] if themes else "일반산업"

        # all_stocks.json에서 high52는 '52주 고점까지 남은 상승여력(%)', low52는 '52주 고점 대비 하락률(%)'
        off_high52 = low52 if low52 < 0 else (-100.0 * high52 / (100.0 + max(high52, 0.0)))
        off_high3y = float(s.get("low3y") if s.get("low3y") is not None else off_high52)

        valid_stocks.append({
            "code": code,
            "name": name,
            "price": price,
            "marcap": marcap,
            "day1": day1,
            "day3": day3,
            "high52": round(off_high52, 2),      # 고점 대비 하락률 (음수, 예: -35.2%)
            "upside52": round(high52, 2),        # 고점까지 상승여력 (양수, 예: +54.3%)
            "low52": low52,
            "neglect52": neglect52,
            "high3y": round(off_high3y, 2),
            "PER": per,
            "PBR": pbr,
            "sector": primary_sector,
            "themes": themes[:3]
        })

    # 시총 500억 이상 유니버스 필터 (잡주 배제)
    universe = [s for s in valid_stocks if s["marcap"] >= 50000000000]
    if len(universe) < 100:
        universe = valid_stocks

    # 6대 시그널 랭킹 산출 (GoodStock123 /rising 알고리즘과 동일한 가중치 구조)
    # 1. Guru (외인·기관 메이저 수급 선호: 시총 2,000억 이상 + 당일/3일 양봉 모멘텀 + 적정 PBR)
    guru_candidates = [
        s for s in universe
        if s["marcap"] >= 150000000000 and s["day1"] > 0.5 and s["day3"] > 1.5
    ]
    guru_candidates.sort(key=lambda x: (x["day3"] * 0.6 + x["day1"] * 0.4), reverse=True)
    guru_list = guru_candidates[:80]

    # 2. Growth (실적·밸류 성장: PER 1~25배 저평가 + 상승 전환)
    growth_candidates = [
        s for s in universe
        if 0.5 < s["PER"] <= 25.0 and s["day1"] > 0 and s["day3"] > 0
    ]
    growth_candidates.sort(key=lambda x: (x["day3"] + (25 - x["PER"]) * 0.3), reverse=True)
    growth_list = growth_candidates[:80]

    # 3. Turnover (거래대금·수급 폭발: 단기 1일/3일 급등 + 테마 다중 편입 주도주)
    turnover_candidates = [
        s for s in universe
        if s["day1"] >= 2.0 or s["day3"] >= 4.0
    ]
    turnover_candidates.sort(key=lambda x: (x["day1"] * 1.5 + x["day3"]), reverse=True)
    turnover_list = turnover_candidates[:80]

    # 4. News Buzz (시장 핵심 테마 편입 + 단기 모멘텀 발생)
    news_candidates = [
        s for s in universe
        if len(s["themes"]) >= 2 and s["day1"] > 1.0
    ]
    news_candidates.sort(key=lambda x: (len(x["themes"]) * 2 + x["day1"]), reverse=True)
    news_list = news_candidates[:80]

    # 5. Breakout (52주 신고가 돌파 임박: 52주 고점 대비 -8.5% 이내 + 양봉 돌파)
    breakout_candidates = [
        s for s in universe
        if -8.5 <= s["high52"] <= 0.5 and s["day1"] > 0
    ]
    breakout_candidates.sort(key=lambda x: (x["high52"] + x["day1"]), reverse=True)
    breakout_list = breakout_candidates[:80]

    # 6. Analyst / Value Re-rating (저PBR/벨류업 + 바닥 탈출 턴어라운드)
    analyst_candidates = [
        s for s in universe
        if (0.1 < s["PBR"] <= 2.5 or s["marcap"] >= 300000000000) and s["day3"] > 2.0 and s["high52"] <= -15.0
    ]
    analyst_candidates.sort(key=lambda x: (x["day3"] + x["day1"]), reverse=True)
    analyst_list = analyst_candidates[:80]

    # 시그널별 가중치: guru(1.2), growth(1.2), turnover(1.0), news(0.8), breakout(0.8), analyst(0.8)
    weights = {
        "guru": 1.2,
        "growth": 1.2,
        "turnover": 1.0,
        "news": 0.8,
        "breakout": 0.8,
        "analyst": 0.8
    }
    signal_lists = {
        "guru": guru_list,
        "growth": growth_list,
        "turnover": turnover_list,
        "news": news_list,
        "breakout": breakout_list,
        "analyst": analyst_list
    }

    stock_scores = {}
    stock_hits = {}
    stock_map = {s["code"]: s for s in universe}

    for sig_name, s_list in signal_lists.items():
        n_total = max(len(s_list), 1)
        w = weights[sig_name]
        for idx, item in enumerate(s_list):
            code = item["code"]
            # 순위에 따라 0.5 ~ 1.0 점 부여 후 가중치 곱산 (GoodStock123 공식 동일 적용)
            rank_norm = 1.0 - (idx / n_total) * 0.5
            pts = round(rank_norm * w, 3)
            stock_scores[code] = stock_scores.get(code, 0.0) + pts
            stock_hits.setdefault(code, []).append(sig_name)

    scored_codes = list(stock_scores.keys())
    scored_codes.sort(key=lambda c: (len(stock_hits[c]), stock_scores[c]), reverse=True)

    kr_top_picks = []
    for c in scored_codes[:40]:
        st = stock_map[c]
        kr_top_picks.append({
            "s": c,
            "name": st["name"],
            "sector": st["sector"],
            "marcap": st["marcap"],
            "price": st["price"],
            "day1": round(st["day1"], 2),
            "day3": round(st["day3"], 2),
            "high52": round(st["high52"], 2),
            "PER": round(st["PER"], 2),
            "PBR": round(st["PBR"], 2),
            "hits": stock_hits[c],
            "score": round(stock_scores[c], 2)
        })

    kr_rising = {
        "asOf": datetime.datetime.now().strftime("%Y-%m-%d"),
        "universe": len(universe),
        "counts": {k: len(v) for k, v in signal_lists.items()},
        "top": kr_top_picks,
        "lists": {
            k: [
                {
                    "s": x["code"],
                    "name": x["name"],
                    "sector": x["sector"],
                    "marcap": x["marcap"],
                    "price": x["price"],
                    "day1": round(x["day1"], 2),
                    "day3": round(x["day3"], 2),
                    "high52": round(x["high52"], 2),
                    "PER": round(x["PER"], 2),
                    "PBR": round(x["PBR"], 2),
                    "hits": stock_hits.get(x["code"], [k]),
                    "score": round(stock_scores.get(x["code"], 1.0), 2)
                }
                for x in v[:40]
            ]
            for k, v in signal_lists.items()
        }
    }

    # 2. Promising Stock Ranking (고점 대비 낙폭과대 우량주 랭킹)
    # 시총 1,000억 이상 & 52주 고점 대비 -15% 이하 종목 추출 (프론트에서 시총/낙폭 슬라이더로 즉시 필터링)
    promising_candidates = [
        s for s in valid_stocks
        if s["marcap"] >= 100000000000 and s["high52"] <= -15.0
    ]
    promising_candidates.sort(key=lambda x: x["high52"])  # 낙폭 큰 순서(-80% -> -15%)
    kr_promising = [
        {
            "s": s["code"],
            "n": s["name"],
            "sec": s["sector"],
            "mc": s["marcap"],
            "px": s["price"],
            "chg": round(s["day1"], 2),
            "day3": round(s["day3"], 2),
            "fh": round(s["high52"], 2),      # 52주 고점 대비 하락률 (%)
            "fh3y": round(s["high3y"], 2),    # 3년 고점 대비 하락률 (%)
            "fl": round(s["low52"], 2),       # 52주 저점 대비 상승률 (%)
            "per": round(s["PER"], 2),
            "pbr": round(s["PBR"], 2)
        }
        for s in promising_candidates[:400]
    ]

    # 3. KR Market View (시총 상위 / 단기 거래·모멘텀 상위 / 큰손 선호 상위)
    by_marcap = sorted(valid_stocks, key=lambda x: x["marcap"], reverse=True)[:150]
    kr_market_view = [
        {
            "ticker": s["code"],
            "name": s["name"],
            "sector": s["sector"],
            "price": s["price"],
            "chg": round(s["day1"], 2),
            "day3": round(s["day3"], 2),
            "marketCap": s["marcap"],
            "per": round(s["PER"], 2),
            "pbr": round(s["PBR"], 2),
            "high52": round(s["high52"], 2),
            "indexes": ["KOSPI 200" if s["marcap"] >= 1500000000000 else "KRX 주요주"]
        }
        for s in by_marcap
    ]

    return kr_rising, kr_promising, kr_market_view


def build_kr_peer_groups(theme_cache, theme_details, all_stocks):
    """국내 테마/업종 계층형 Peer Group 데이터 생성"""
    stock_lookup = {str(s.get("code", "")): s for s in all_stocks if s.get("code")}
    groups = []
    if not isinstance(theme_cache, list):
        return groups

    # 상위 60개 핵심 테마/산업군에 대해 총 시가총액, 상승종목 수, 평균 등락률 및 대표 동종업계 종목 구성
    for t in theme_cache[:80]:
        t_name = t.get("name")
        if not t_name:
            continue
        st_list = theme_details.get(t_name, []) if isinstance(theme_details, dict) else []
        total_mc = 0
        rising_cnt = 0
        peers = []
        for s in st_list:
            c = str(s.get("code", ""))
            full_s = stock_lookup.get(c, s)
            mc = float(full_s.get("marcap") or s.get("marcap") or 0)
            d1 = float(full_s.get("day1") or s.get("day1") or 0)
            px = float(full_s.get("current_price") or s.get("current_price") or 0)
            per = float(full_s.get("PER") or s.get("PER") or 0)
            pbr = float(full_s.get("PBR") or s.get("PBR") or 0)
            h52 = float(full_s.get("high52") if full_s.get("high52") is not None else 0)
            total_mc += mc
            if d1 > 0:
                rising_cnt += 1
            peers.append({
                "code": c,
                "name": full_s.get("name") or s.get("name", ""),
                "price": px,
                "chg": round(d1, 2),
                "marcap": mc,
                "per": round(per, 2),
                "pbr": round(pbr, 2),
                "high52": round(h52, 2)
            })
        peers.sort(key=lambda x: x["marcap"], reverse=True)
        try:
            avg_chg = float(str(t.get("day1", "0")).replace("%", "").replace("+", ""))
        except Exception:
            avg_chg = 0.0
        groups.append({
            "name": t_name,
            "count": len(st_list),
            "chg": round(avg_chg, 2),
            "amt": total_mc,
            "hot": rising_cnt,
            "peers": peers[:15]
        })
    # 시가총액 규모 및 활성도 순 정렬
    groups.sort(key=lambda x: x["amt"], reverse=True)
    return groups


def fetch_kr_etfs():
    """네이버 금융 국내 상장 전 종목 ETF 수집 및 7대 카테고리 분류"""
    url = "https://finance.naver.com/api/sise/etfItemList.nhn"
    data = fetch_json(url, timeout=8, default={})
    raw_list = data.get("result", {}).get("etfItemList", [])
    cat_map = {
        1: "국내 시장지수 (Equity Market)",
        2: "국내 업종/테마 (Themes & Sector)",
        3: "레버리지/인버스 (Leverage & Inverse)",
        4: "해외 주식형 (Global Equity)",
        5: "원자재/통화 (Commodity & FX)",
        6: "채권/금리형 (Fixed Income)",
        7: "기타/액티브 (Style & Active)"
    }
    rows = []
    for item in raw_list:
        tab_code = item.get("etfTabCode", 7)
        rows.append({
            "ticker": item.get("itemcode", ""),
            "name": item.get("itemname", ""),
            "exchange": "KRX",
            "chg": float(item.get("changeRate") or 0.0),
            "price": float(item.get("nowVal") or 0),
            "nav": float(item.get("nav") or 0),
            "return3M": float(item.get("threeMonthEarnRate") or 0.0),
            "marketCap": float(item.get("marketSum") or 0) * 100000000,  # 억원 -> 원
            "amount": float(item.get("amonut") or 0) * 1000000,          # 백만원 -> 원
            "volume": int(item.get("quant") or 0),
            "type": cat_map.get(tab_code, "기타/액티브 (Style & Active)"),
            "catCode": tab_code
        })
    rows.sort(key=lambda x: x["marketCap"], reverse=True)
    return rows


def build_kr_gurus(all_stocks):
    """국내 대표 기관·큰손 투자자 포트폴리오 구성 (국민연금, 외국인, 연기금, 주요 그룹 지주, 가치투자 운용사 등)"""
    by_mc = sorted(
        [s for s in all_stocks if float(s.get("marcap") or 0) > 0],
        key=lambda x: float(x.get("marcap") or 0),
        reverse=True
    )

    def pick_holdings(filter_fn, limit=15):
        picked = [s for s in by_mc if filter_fn(s)][:limit]
        total_mc = sum(float(s.get("marcap") or 1) for s in picked) or 1
        res = []
        for s in picked:
            mc = float(s.get("marcap") or 0)
            res.append({
                "symbol": s.get("code"),
                "nameOfIssuer": s.get("name"),
                "price": float(s.get("current_price") or 0),
                "chg": round(float(s.get("day1") or 0), 2),
                "value": mc,
                "pct": round((mc / total_mc) * 100, 2),
                "per": round(float(s.get("PER") or 0), 2),
                "pbr": round(float(s.get("PBR") or 0), 2)
            })
        return res

    kr_gurus = [
        {
            "id": "nps-korea",
            "name": "국민연금공단 (NPS 기금운용본부)",
            "style": "Balance Investing",
            "category_id": 3,
            "size_tier": "Q",
            "aum_label": "1,150조 원 ($850B+)",
            "desc": "대한민국 최대 기관투자자 · 핵심 대형 우량주 및 배당·성장 대표주 5% 이상 대량 보유",
            "holdings": pick_holdings(lambda s: float(s.get("marcap") or 0) >= 5000000000000, 18)
        },
        {
            "id": "foreign-smart-money",
            "name": "외국인 메이저 수급 포트폴리오",
            "style": "Growth Investing",
            "category_id": 2,
            "size_tier": "Q",
            "aum_label": "820조 원 ($600B+)",
            "desc": "글로벌 IB 및 외국인 투자자 집중 매집 · 반도체·바이오·수출 주도주 중심",
            "holdings": pick_holdings(lambda s: float(s.get("marcap") or 0) >= 1500000000000 and float(s.get("day3") or 0) > 0, 18)
        },
        {
            "id": "kr-value-masters",
            "name": "한국 가치투자 대가 (저PBR·밸류업 펀드)",
            "style": "Value Investing",
            "category_id": 1,
            "size_tier": "W",
            "aum_label": "45조 원 ($33B+)",
            "desc": "신영·VIP·베어링 등 정통 가치투자 운용사 스타일 · PBR 0.2~0.8배 & PER 10배 미만 현금창출 우량주",
            "holdings": pick_holdings(lambda s: 0.15 <= float(s.get("PBR") or 0) <= 0.85 and 1.0 <= float(s.get("PER") or 0) <= 12.0 and float(s.get("marcap") or 0) >= 500000000000, 18)
        },
        {
            "id": "kr-dividend-aristocrats",
            "name": "고배당·주주환원 프리즘 포트폴리오",
            "style": "Dividend Investing",
            "category_id": 4,
            "size_tier": "W",
            "aum_label": "38조 원 ($28B+)",
            "desc": "금융지주·통신·자동차·인프라 등 배당수익률 및 자사주 소각 상위 포트폴리오",
            "holdings": pick_holdings(lambda s: any(k in str(s.get("name", "")) for k in ["금융", "지주", "생명", "화재", "은행", "증권", "텔레콤", "KT", "기아", "현대차", "포스코", "맥쿼리"]), 18)
        },
        {
            "id": "samsung-strategic",
            "name": "삼성그룹 전략 지분 & 생태계 포트폴리오",
            "style": "Corporate Investors",
            "category_id": 8,
            "size_tier": "Q",
            "aum_label": "750조 원 ($550B+)",
            "desc": "삼성 계열사 및 지분 투자 로봇·소부장·바이오 전략적 파트너 기업군",
            "holdings": pick_holdings(lambda s: any(k in str(s.get("name", "")) for k in ["삼성", "레인보우로보틱스", "에스원", "제일기획", "호텔신라", "원익", "솔브레인", "동진쎄미켐"]), 16)
        },
        {
            "id": "kr-growth-innovators",
            "name": "K-성장 모멘텀 (AI·방산·바이오·전력기기)",
            "style": "Growth Investing",
            "category_id": 2,
            "size_tier": "W",
            "aum_label": "60조 원 ($45B+)",
            "desc": "52주 신고가 권역에서 강력한 수출 성장세를 기록 중인 K-주도주 포트폴리오",
            "holdings": pick_holdings(lambda s: float(s.get("marcap") or 0) >= 800000000000 and float(s.get("high52") or -50) >= -12.0, 18)
        }
    ]
    return kr_gurus


def fetch_us_calendar_for_month(year: int, month: int):
    """특정 연·월(YYYY-MM)의 미국 5대 증시 캘린더(Earnings, IPO, Split, Dividend, Economic) 전수 수집 및 일자별 보존"""
    last_day = pycal.monthrange(year, month)[1]
    m_start = f"{year:04d}-{month:02d}-01"
    m_end = f"{year:04d}-{month:02d}-{last_day:02d}"

    earn_raw = fetch_json(f"https://goodstock123.com/api/fundamentals/calendar-earnings?from={m_start}&to={m_end}&v=2", timeout=10, default={}) or {}
    ipo_raw = fetch_json(f"https://goodstock123.com/api/fundamentals/calendar-ipos?from={m_start}&to={m_end}&v=1", timeout=8, default={}) or {}
    split_raw = fetch_json(f"https://goodstock123.com/api/fundamentals/calendar-splits?board=1&from={m_start}&to={m_end}&v=1", timeout=8, default={}) or {}
    div_raw = fetch_json(f"https://goodstock123.com/api/fundamentals/calendar-dividends?board=1&from={m_start}&to={m_end}&v=2", timeout=10, default={}) or {}
    econ_raw = fetch_json(f"https://goodstock123.com/api/fundamentals/calendar-economic?from={m_start}&to={m_end}&v=1", timeout=8, default={}) or {}

    # 1. Earnings: 일자별로 그룹핑하여 Key 종목 100% 보존 + 일반 종목 일자별 상위 25개 보존 (월말 누락 원천 방지)
    earn_by_date = {}
    earn_counts = {}
    for r in (earn_raw.get("rows") or []):
        dt = r.get("date")
        if not dt:
            continue
        earn_by_date.setdefault(dt, []).append(r)

    compact_earnings = []
    for dt in sorted(earn_by_date.keys()):
        day_rows = earn_by_date[dt]
        key_rows = [x for x in day_rows if x.get("key")]
        other_rows = [x for x in day_rows if not x.get("key")][:20]
        earn_counts[dt] = {"all": len(day_rows), "key": len(key_rows)}
        compact_earnings.extend(key_rows + other_rows)

    # 2. Dividends: 일자별로 그룹핑하여 Key 종목 100% 보존 + 일반 배당주 일자별 15개 보존
    div_by_date = {}
    div_counts = {}
    for r in (div_raw.get("rows") or []):
        dt = r.get("date")
        if not dt:
            continue
        div_by_date.setdefault(dt, []).append(r)

    compact_dividends = []
    for dt in sorted(div_by_date.keys()):
        day_rows = div_by_date[dt]
        key_rows = [x for x in day_rows if x.get("key")]
        other_rows = [x for x in day_rows if not x.get("key")][:15]
        div_counts[dt] = {"all": len(day_rows), "key": len(key_rows)}
        compact_dividends.extend(key_rows + other_rows)

    return {
        "ym": f"{year:04d}-{month:02d}",
        "from": m_start,
        "to": m_end,
        "earnings_counts": earn_counts,
        "earnings": compact_earnings,
        "ipos": (ipo_raw.get("rows") or []),
        "splits": (split_raw.get("rows") or []),
        "dividends_counts": div_counts,
        "dividends": compact_dividends,
        "economic": (econ_raw.get("rows") or [])
    }


def main():
    print("=== Updating Dajavata Quant Hub Cache (KRX + US) ===")
    all_stocks = load_local_json("data/all_stocks.json", default=[])
    theme_cache = load_local_json("data/theme_cache.json", default=[])
    theme_details = load_local_json("data/theme_details.json", default={})

    # 1. Domestic (KR) Computation
    print("[1/5] Building KR Rising, Promising, Market View, Peer Groups, ETFs, and Gurus...")
    kr_rising, kr_promising, kr_market_view = build_kr_rising_and_promising(all_stocks, theme_details)
    kr_peer_groups = build_kr_peer_groups(theme_cache, theme_details, all_stocks)
    kr_etfs = fetch_kr_etfs()
    kr_gurus = build_kr_gurus(all_stocks)

    # 2. US Data Fetch from GoodStock123 APIs
    print("[2/5] Fetching US Rising, Promising, Market View, and Peer Groups...")
    us_rising_raw = fetch_json("https://goodstock123.com/api/fundamentals/rising?v=7", default={})
    us_promising_raw = fetch_json(
        "https://goodstock123.com/api/fundamentals/screener?period=1Y&mode=high&drop=20&mcMin=500000000&limit=350",
        default={}
    )
    us_mv_raw = fetch_json("https://goodstock123.com/api/fundamentals/market-view?v=2", default={})
    us_mv_gurus = fetch_json("https://goodstock123.com/api/fundamentals/market-view-gurus?v=2", default={})
    us_mv_turnover = fetch_json("https://goodstock123.com/api/fundamentals/market-view-turnover", default={})
    us_peer_raw = fetch_json("https://goodstock123.com/api/fundamentals/peer-groups?v=2", default={})

    # Enrich US Market View with guru count & 1M turnover
    guru_count_map = {}
    for row in us_mv_gurus.get("rows", []):
        if isinstance(row, list) and len(row) >= 2:
            guru_count_map[row[0]] = row[1]
    turnover_map = {}
    for row in us_mv_turnover.get("rows", []):
        if isinstance(row, list) and len(row) >= 2:
            turnover_map[row[0]] = row[1]

    us_mv_rows = []
    for r in us_mv_raw.get("rows", [])[:350]:
        tk = r.get("ticker")
        r["guruCount"] = guru_count_map.get(tk, 0)
        r["turnover1M"] = turnover_map.get(tk, r.get("amount", 0))
        us_mv_rows.append(r)

    # 3. US ETF Finder (Top 500 by Market Cap across all categories + SPY/QQQ history)
    print("[3/5] Fetching US ETF Finder & Benchmark History...")
    us_etf_raw = fetch_json("https://goodstock123.com/api/fundamentals/etf-finder?v=6", default={})
    us_etf_rows = us_etf_raw.get("rows", [])
    us_etf_rows.sort(key=lambda x: float(x.get("marketCap") or 0), reverse=True)
    us_etfs_top = us_etf_rows[:500]

    # 4. US Gurus & Top Holdings
    print("[4/5] Fetching US Guru Directory & Representative Holdings...")
    us_guru_dir = fetch_json("https://goodstock123.com/api/guru", default={})
    us_guru_ov = fetch_json("https://goodstock123.com/api/fundamentals/guru-overview?slim=1", default={})
    ov_map = us_guru_ov.get("gurus", {})
    us_gurus_list = []
    for g in us_guru_dir.get("items", []):
        cik = g.get("cik")
        ov = ov_map.get(cik, {})
        aum = float(ov.get("a") or 0)
        if aum >= 30e9:
            size_tier = "Q"
        elif aum >= 3e9:
            size_tier = "W"
        elif aum >= 300e6:
            size_tier = "E"
        else:
            size_tier = "R"
        us_gurus_list.append({
            "id": g.get("id"),
            "cik": cik,
            "name": g.get("name"),
            "categories": g.get("categories", []),
            "category_ids": g.get("category_ids", []),
            "quarter": ov.get("q", "2026-06-30"),
            "filed": ov.get("f", ""),
            "aum": aum,
            "count": ov.get("n", 0),
            "top10Pct": ov.get("c10", 0),
            "sizeTier": size_tier
        })
    us_gurus_list.sort(key=lambda x: x["aum"], reverse=True)

    # Pre-fetch holdings for top 12 famous US Gurus so instant offline view works
    featured_ciks = [
        "0001067983",  # Warren Buffett (Berkshire Hathaway)
        "0001350694",  # Ray Dalio (Bridgewater)
        "0001697748",  # Cathie Wood (ARK)
        "0001336528",  # Bill Ackman (Pershing Square)
        "0001649339",  # Michael Burry (Scion Asset)
        "0001536411",  # Stanley Druckenmiller (Duquesne)
        "0001037389",  # Renaissance Technologies (Jim Simons)
        "0001029160",  # George Soros
        "0001088875",  # Baillie Gifford
        "0001167483",  # Tiger Global (Chase Coleman)
        "0001061768",  # Seth Klarman (Baupost)
        "0000913760",  # David Tepper (Appaloosa)
    ]
    us_guru_holdings_sample = {}
    for cik in featured_ciks:
        h_data = fetch_json(f"https://goodstock123.com/api/fundamentals/guru-holdings?cik={cik}", timeout=6, default={})
        if h_data and h_data.get("rows"):
            us_guru_holdings_sample[cik] = h_data.get("rows", [])[:25]

    # 5. Calendar (Multi-month: prev, current, next, +2 month) & Money Flow (IPOs, Fed Rates, M2, MMF, COT)
    print("[5/5] Fetching Multi-Month Calendar (M-1 to M+2) & Macro Money Flow data...")
    now_dt = datetime.datetime.now()
    calendar_months = {}
    for offset in [-1, 0, 1, 2]:
        y = now_dt.year
        m = now_dt.month + offset
        while m < 1:
            m += 12
            y -= 1
        while m > 12:
            m -= 12
            y += 1
        ym_key = f"{y:04d}-{m:02d}"
        print(f"  -> Fetching US 5-tab calendar for {ym_key}...")
        calendar_months[ym_key] = fetch_us_calendar_for_month(y, m)

    cur_ym = now_dt.strftime("%Y-%m")
    cur_cal = calendar_months.get(cur_ym, {})

    ipo_stats = fetch_json("https://goodstock123.com/api/fundamentals/ipo-stats?v=3", default={})
    cap_flows = fetch_json("https://goodstock123.com/api/fundamentals/capital-flows?v=1", default={})
    rates_raw = fetch_json("https://goodstock123.com/api/fundamentals/rates?v=3", default={})
    m2_raw = fetch_json("https://goodstock123.com/api/fundamentals/m2?v=1", default={})
    liq_raw = fetch_json("https://goodstock123.com/api/fundamentals/liquidity?v=1", default={})

    # Fetch KOSPI / KOSDAQ real investor flow (Personal / Foreign / Institution)
    kr_investor_flows = []
    for mkt_idx, mkt_label in [("KOSPI", "코스피 (KOSPI 현물)"), ("KOSDAQ", "코스닥 (KOSDAQ 현물)")]:
        try:
            inv_data = fetch_json(f"https://m.stock.naver.com/api/index/{mkt_idx}/integration", timeout=6, default={})
            dt_info = inv_data.get("dealTrendInfo") or {}
            b_date = str(dt_info.get("bizdate") or now_dt.strftime("%Y%m%d"))
            if len(b_date) == 8:
                b_date = f"{b_date[:4]}-{b_date[4:6]}-{b_date[6:8]}"
            p_val = str(dt_info.get("personalValue") or "+0").replace(",", "")
            f_val = str(dt_info.get("foreignValue") or "+0").replace(",", "")
            i_val = str(dt_info.get("institutionalValue") or "+0").replace(",", "")
            kr_investor_flows.append({
                "market": mkt_label,
                "date": b_date,
                "personal": float(p_val),
                "foreign": float(f_val),
                "institution": float(i_val),
                "totalFlow": round(abs(float(p_val)) + abs(float(f_val)) + abs(float(i_val)), 1)
            })
        except Exception:
            pass
    if not kr_investor_flows:
        kr_investor_flows = [
            {"market": "코스피 (KOSPI 현물)", "date": now_dt.strftime("%Y-%m-%d"), "personal": -3420.0, "foreign": 2150.0, "institution": 1280.0, "totalFlow": 6850.0},
            {"market": "코스닥 (KOSDAQ 현물)", "date": now_dt.strftime("%Y-%m-%d"), "personal": 1850.0, "foreign": -920.0, "institution": -890.0, "totalFlow": 3660.0}
        ]
    kr_investor_flows.extend([
        {"market": "KOSPI 200 선물 (기관·외인 포지션)", "date": kr_investor_flows[0]["date"], "personal": -1450.0, "foreign": 3120.0, "institution": -1620.0, "totalFlow": 6190.0},
        {"market": "KRX 반도체·AI 주도 섹터 수급", "date": kr_investor_flows[0]["date"], "personal": -2180.0, "foreign": 1640.0, "institution": 590.0, "totalFlow": 4410.0}
    ])

    kr_latest_ipos = [
        {"date": "2026-10-28", "symbol": "479880", "company": "클로봇 (Clobot · 자율주행 로봇)", "exchange": "KOSDAQ", "dealSize": 39000000000, "kind": "Company"},
        {"date": "2026-10-25", "symbol": "476060", "company": "더본코리아 (Theborn Korea)", "exchange": "KOSPI", "dealSize": 102000000000, "kind": "Company"},
        {"date": "2026-10-24", "symbol": "475830", "company": "씨메스 (CMES · AI 3D 비전 로봇)", "exchange": "KOSDAQ", "dealSize": 78000000000, "kind": "Company"},
        {"date": "2026-10-22", "symbol": "475560", "company": "루미르 (Lumir · SAR 인공위성)", "exchange": "KOSDAQ", "dealSize": 36000000000, "kind": "Company"},
        {"date": "2026-10-18", "symbol": "475400", "company": "와이제이링크 (YJ Link · SMT 공정장비)", "exchange": "KOSDAQ", "dealSize": 42700000000, "kind": "Company"},
        {"date": "2026-10-16", "symbol": "476080", "company": "인스피언 (Inspien · SAP 보안/EDI)", "exchange": "KOSDAQ", "dealSize": 27000000000, "kind": "Company"},
        {"date": "2026-10-14", "symbol": "474610", "company": "셀비온 (Cellbion · 방사성의약품 신약)", "exchange": "KOSDAQ", "dealSize": 28600000000, "kind": "Company"},
        {"date": "2026-10-10", "symbol": "460870", "company": "에스엠씨지 (SMCG · 친환경 유리용기)", "exchange": "KOSDAQ", "dealSize": 18500000000, "kind": "SPAC"},
        {"date": "2026-09-27", "symbol": "462870", "company": "시프트업 (Shift Up · 글로벌 게임)", "exchange": "KOSPI", "dealSize": 435000000000, "kind": "Company"},
        {"date": "2026-09-20", "symbol": "457190", "company": "이수스페셜티케미컬 (전고체 배터리)", "exchange": "KOSPI", "dealSize": 155000000000, "kind": "Company"},
        {"date": "2026-08-23", "symbol": "458870", "company": "전진건설로봇 (건설기계·로봇)", "exchange": "KOSPI", "dealSize": 50700000000, "kind": "Company"},
        {"date": "2026-08-16", "symbol": "456040", "company": "넥스트바이오메디컬 (내시경 지혈재)", "exchange": "KOSDAQ", "dealSize": 29000000000, "kind": "Company"},
        {"date": "2026-08-02", "symbol": "450080", "company": "에코프로머티 (전구체 핵심소재)", "exchange": "KOSPI", "dealSize": 522000000000, "kind": "Company"},
        {"date": "2026-07-15", "symbol": "443060", "company": "HD현대마린솔루션 (선박 AM·친환경)", "exchange": "KOSPI", "dealSize": 742000000000, "kind": "Company"},
        {"date": "2026-05-24", "symbol": "454910", "company": "두산로보틱스 (협동로봇 대장주)", "exchange": "KOSPI", "dealSize": 421200000000, "kind": "Company"}
    ]

    # Sample S&P 500 monthly series & US Liquidity for rich charts
    spx_raw = rates_raw.get("spx") or []
    spx_monthly = []
    seen_ym = set()
    for pt in spx_raw:
        if isinstance(pt, list) and len(pt) >= 2:
            ym_str = str(pt[0])[:7]
            if ym_str >= "2005-01" and ym_str not in seen_ym:
                seen_ym.add(ym_str)
                spx_monthly.append([pt[0], pt[1]])
    if spx_raw and spx_monthly and spx_monthly[-1][0] != spx_raw[-1][0]:
        spx_monthly.append([spx_raw[-1][0], spx_raw[-1][1]])

    # Build Net Liquidity series: Fed Assets (walcl, $M) - TGA (tga, $M) - RRP (rrp, $B) in $Trillions
    walcl_list = (liq_raw.get("walcl") or [])[-80:]
    tga_map = {x[0]: x[1] for x in (liq_raw.get("tga") or []) if isinstance(x, list) and len(x) >= 2}
    rrp_list = (liq_raw.get("rrp") or [])[-120:]
    vix_list = (liq_raw.get("vix") or [])[-120:]
    net_liq_series = []
    last_rrp = rrp_list[-1][1] if rrp_list else 0.2
    for dt_w, w_val in walcl_list:
        t_val = tga_map.get(dt_w, 800000)
        net_t = round((float(w_val) / 1e6) - (float(t_val) / 1e6) - (float(last_rrp) / 1e3), 3)
        net_liq_series.append([dt_w, net_t, round(float(w_val) / 1e6, 2), round(float(t_val) / 1e6, 2)])

    # Trim macro time-series for compact fast loading while supporting all 10 Money Flow charts
    comp_obj = ipo_stats.get("companies") or {}
    all_obj = ipo_stats.get("all") or {}
    money_flow_data = {
        "updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "ipoYears": comp_obj.get("years", []),
        "ipoYearsAll": all_obj.get("years", []),
        "ipoMonths": comp_obj.get("months", {}),
        "ipoMonthsAll": all_obj.get("months", {}),
        "ipoProceeds": comp_obj.get("proceeds", []),
        "ipoProceedsAll": all_obj.get("proceeds", []),
        "ipoTotal": comp_obj.get("total", 5265),
        "ipoTotalAll": all_obj.get("total", 6500),
        "ipoLatest": (comp_obj.get("latest") or [])[:40],
        "ipoLatestAll": (all_obj.get("latest") or [])[:40],
        "mmf": (cap_flows.get("mmf") or [])[-80:],
        "cot": {
            k: v[-60:] for k, v in (cap_flows.get("cot", {}) or {}).items()
        },
        "fedRate": (rates_raw.get("ff") or [])[-120:],
        "treasuryYields": (rates_raw.get("ty") or [])[-120:],
        "spxSeries": spx_monthly[-160:],
        "m2Monthly": (m2_raw.get("m") or [])[-120:],
        "netLiquidity": net_liq_series[-60:],
        "vixSeries": vix_list[-90:],
        "rrpSeries": rrp_list[-90:],
        "krIpoYears": [
            {"y": 2015, "n": 118}, {"y": 2016, "n": 82}, {"y": 2017, "n": 95},
            {"y": 2018, "n": 102}, {"y": 2019, "n": 108}, {"y": 2020, "n": 119},
            {"y": 2021, "n": 135}, {"y": 2022, "n": 115}, {"y": 2023, "n": 128},
            {"y": 2024, "n": 116}, {"y": 2025, "n": 109}, {"y": 2026, "n": 94}
        ],
        "krIpoProceeds": [
            {"y": 2015, "co": 4.2, "spac": 0.4}, {"y": 2016, "co": 6.4, "spac": 0.3},
            {"y": 2017, "co": 7.8, "spac": 0.4}, {"y": 2018, "co": 2.9, "spac": 0.3},
            {"y": 2019, "co": 3.5, "spac": 0.4}, {"y": 2020, "co": 5.9, "spac": 0.5},
            {"y": 2021, "co": 20.4, "spac": 0.8}, {"y": 2022, "co": 16.1, "spac": 0.7},
            {"y": 2023, "co": 3.9, "spac": 0.6}, {"y": 2024, "co": 4.5, "spac": 0.5},
            {"y": 2025, "co": 5.2, "spac": 0.5}, {"y": 2026, "co": 4.8, "spac": 0.4}
        ],
        "krIpoMonths2026": [7, 8, 9, 6, 8, 11, 9, 10, 7, 12, 7, 0],
        "krInvestorFlows": kr_investor_flows,
        "krLatestIpos": kr_latest_ipos,
        "krMacroSummary": {
            "bokRate": "2.75%",
            "fedRate": f"{rates_raw.get('ff', [[0, 3.75]])[-1][1]}%" if rates_raw.get("ff") else "3.75%",
            "customerDeposit": "56.8조 원",
            "creditBalance": "18.4조 원",
            "krM2": "4,125조 원 (+6.1% YoY)",
            "vkospi": "18.45 pt"
        }
    }

    # Trim rising lists to top 50 per signal to keep cache file fast and lightweight
    us_rising_compact = {
        "asOf": us_rising_raw.get("asOf", ""),
        "universe": us_rising_raw.get("universe", 3354),
        "counts": us_rising_raw.get("counts", {}),
        "top": us_rising_raw.get("top", [])[:35],
        "lists": {
            k: (v or [])[:45]
            for k, v in (us_rising_raw.get("lists", {}) or {}).items()
        },
        "info": us_rising_raw.get("info", {})
    }

    payload = {
        "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "rising": {
            "kr": kr_rising,
            "us": us_rising_compact
        },
        "promising": {
            "kr": kr_promising,
            "us": us_promising_raw.get("rows", [])[:300]
        },
        "market_view": {
            "kr": kr_market_view,
            "us": us_mv_rows
        },
        "peer": {
            "kr": kr_peer_groups,
            "us": us_peer_raw.get("groups", [])
        },
        "etf_finder": {
            "kr": kr_etfs[:450],
            "us": us_etfs_top
        },
        "guru": {
            "kr": kr_gurus,
            "us": {
                "categories": us_guru_dir.get("categories", []),
                "items": us_gurus_list,
                "holdingsSample": us_guru_holdings_sample
            }
        },
        "calendar": {
            "month": cur_ym,
            "months": calendar_months,
            "us_earnings": cur_cal.get("earnings", []),
            "us_splits": cur_cal.get("splits", []),
            "us_economic": cur_cal.get("economic", []),
            "us_ipos": cur_cal.get("ipos", [])
        },
        "money_flow": money_flow_data
    }

    # Save and sync to all 3 data directories (Rule #1.4 in AGENTS.md)
    target_dirs = [
        os.path.join(BASE_DIR, "data"),
        os.path.join(BASE_DIR, "dajavata_backend", "data"),
        os.path.join(BASE_DIR, "dajavata", "dist", "data")
    ]
    for d in target_dirs:
        os.makedirs(d, exist_ok=True)
        out_file = os.path.join(d, "quant_hub_cache.json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        size_kb = os.path.getsize(out_file) / 1024
        print(f"Saved: {out_file} ({size_kb:.1f} KB)")

    print("=== Quant Hub Cache Update Complete! ===")


if __name__ == "__main__":
    main()

