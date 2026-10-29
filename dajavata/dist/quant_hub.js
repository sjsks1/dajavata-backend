/**
 * ============================================================================
 * DAJAVATA QUANT & GLOBAL MARKET INTELLIGENCE HUB (KRX + US) v1.0
 * - 국내주식(KRX) 및 미국주식(US) 양방향 전환 지원
 * - 8대 핵심 모듈:
 *   1. 급등 초입 포착 (quant-rising) — 6대 복합 시그널 가중 점수 Top Picks
 *   2. 낙폭과대 우량주 (quant-promising) — 시총 하한 & 고점 대비 낙폭 필터
 *   3. 글로벌 마켓 뷰 (quant-market-view) — 지수별 시총·거래대금(회전율)·큰손 보유 랭킹
 *   4. 섹터·동종업계 비교 (quant-peer) — 계층형 섹터/테마 자금 쏠림 & 1:1 Peer 비교
 *   5. 한·미 ETF 파인더 (quant-etf-finder) — 카테고리별 ETF 스크리너 & 비교
 *   6. 증시 일정 캘린더 (quant-calendar) — 실적·IPO·분할·배당·거시경제 월간 달력
 *   7. 대가·큰손 포트폴리오 (quant-guru) — 미국 338명 구루(13F) & 한국 6대 큰손 포트폴리오
 *   8. 머니 플로우 (quant-money-flow) — 연도별 IPO·기준금리·MMF/예탁금·선물 포지셔닝
 * ============================================================================
 */

(function () {
    'use strict';

    const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:8001'
        : 'https://dajavata-backend.onrender.com';

    const MODULE_META = {
        'quant-rising': {
            badge: 'MULTI-SIGNAL SCREENER',
            title: '급등 초입 포착 (Rising Stocks)',
            sub: '큰손 수급(×1.2) · 실적 성장(×1.2) · 거래대금 폭발(×1.0) · 뉴스(×0.8) · 신고가 돌파(×0.8) · 리레이팅(×0.8) 복합 시그널 교집합 포착'
        },
        'quant-promising': {
            badge: 'TURNAROUND SCREENER',
            title: '낙폭과대 우량주 랭킹 (Promising Stock Ranking)',
            sub: '시가총액 하한 필터로 부실 잡주를 배제하고, 고점 대비 과매도 구간에 진입한 우량 턴어라운드 후보군을 발굴합니다'
        },
        'quant-market-view': {
            badge: 'MARKET OVERVIEW',
            title: '글로벌 마켓 뷰 (Market View — 수급·회전율·시총)',
            sub: '주요 지수(KOSPI 200 · S&P 500 · Nasdaq 100 · Dow 30) 편입 종목의 시가총액, 거래대금 회전율, 구루/기관 보유 순위'
        },
        'quant-peer': {
            badge: 'SECTOR & PEER GROUP',
            title: '섹터·동종업계 비교 (Peer Group Analysis)',
            sub: '산업군·테마별 총 거래규모와 상승 종목 비중을 비교하고, 동일 섹터 내 경쟁사 간 펀더멘털을 1:1로 대조합니다'
        },
        'quant-etf-finder': {
            badge: 'ETF SCREENER',
            title: '한·미 ETF 파인더 (ETF Finder)',
            sub: '국내 상장 ETF(KODEX·TIGER·ACE) 및 미국 상장 5,700+ ETF를 카테고리·시총·수익률·배당률 기준으로 탐색합니다'
        },
        'quant-calendar': {
            badge: 'MARKET CALENDAR',
            title: '증시 일정 캘린더 (Earnings · IPO · Split · Dividend · Macro)',
            sub: '실적 발표, 신규 상장(IPO), 액면분할, 배당락, FOMC/금통위 거시경제 일정을 월간 인터랙티브 달력으로 확인합니다'
        },
        'quant-guru': {
            badge: 'GURU & SMART MONEY',
            title: '대가·큰손 포트폴리오 (Guru Portfolio — 338 Gurus & KRX 큰손)',
            sub: '워런 버핏·레이 달리오 등 월가 대가 338명(SEC 13F)과 국민연금·외국인·한국 가치투자 대가의 핵심 보유 종목 추적'
        },
        'quant-money-flow': {
            badge: 'MACRO LIQUIDITY',
            title: '머니 플로우 (Money Flow — IPO · 금리 · 통화량 · 선물 포지셔닝)',
            sub: '2005~2026 연도별 IPO 사이클, 한·미 기준금리 및 국채금리, M2 유동성·MMF 대기 자금, 기관 선물 포지셔닝 대시보드'
        }
    };

    const SIGNAL_LABELS = {
        guru: { label: 'Guru(큰손매집)', cls: 'qh-sig-guru', weight: '×1.2' },
        growth: { label: 'Growth(실적성장)', cls: 'qh-sig-growth', weight: '×1.2' },
        turnover: { label: 'Turnover(거래폭발)', cls: 'qh-sig-turnover', weight: '×1.0' },
        news: { label: 'News(뉴스버즈)', cls: 'qh-sig-news', weight: '×0.8' },
        breakout: { label: 'Breakout(돌파)', cls: 'qh-sig-breakout', weight: '×0.8' },
        analyst: { label: 'Analyst(리레이팅)', cls: 'qh-sig-analyst', weight: '×0.8' }
    };

    // 내부 상태 관리
    const state = {
        currentTab: 'quant-rising',
        market: 'KR', // 'KR' | 'US'
        cache: null,
        loading: false,
        // 탭별 세부 필터 상태
        risingSignal: 'top',
        risingSearch: '',
        promisingMinMcKR: 300000000000, // 기본 3,000억 이상
        promisingMinMcUS: 2000000000,   // 기본 $2B 이상
        promisingMinDrop: 30,           // 기본 -30% 이상 하락
        promisingSort: 'drop',          // 'drop' | 'mc' | 'chg'
        promisingSearch: '',
        mvIndexKR: 'ALL',
        mvIndexUS: 'ALL',
        mvSort: 'mc',                   // 'mc' | 'turnover' | 'guru'
        mvSearch: '',
        peerSelectedGroupIdx: 0,
        peerExpandedGroups: { 0: true, 1: true, 2: true },
        etfCategoryKR: 'ALL',
        etfCategoryUS: 'ALL',
        etfSearch: '',
        calCategory: 'earnings',        // 'earnings' | 'ipo' | 'split' | 'dividend' | 'economic'
        calSelectedDate: null,
        guruStyle: 'ALL',               // 'ALL' | 1..8
        guruSize: 'ALL',                // 'ALL' | 'Q' | 'W' | 'E' | 'R'
        guruSearch: '',
        selectedGuruIdKR: 'nps-korea',
        selectedGuruCikUS: '0001067983',
        dynamicGuruHoldingsUS: {}
    };

    // 숫자/통화 포맷 헬퍼
    function fmtKRW(val) {
        const n = Number(val) || 0;
        if (n >= 1e12) return (n / 1e12).toFixed(2) + '조 원';
        if (n >= 1e8) return Math.round(n / 1e8).toLocaleString('ko-KR') + '억 원';
        return n.toLocaleString('ko-KR') + '원';
    }

    function fmtUSD(val) {
        const n = Number(val) || 0;
        if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
        if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
        return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }

    function fmtPrice(val, mkt) {
        const n = Number(val) || 0;
        if (mkt === 'KR') return Math.round(n).toLocaleString('ko-KR') + '원';
        return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtPct(val) {
        if (val === null || val === undefined || isNaN(Number(val))) return '-';
        const n = Number(val);
        const sign = n > 0 ? '+' : '';
        const cls = n > 0 ? 'qh-pos' : (n < 0 ? 'qh-neg' : '');
        return `<span class="${cls}">${sign}${n.toFixed(2)}%</span>`;
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str == null ? '' : String(str);
        return d.innerHTML;
    }

    // 차트 스캐너 연동 헬퍼
    window.openInDajavataScanner = function (code, name) {
        if (window.ChartScanner && typeof window.ChartScanner.show === 'function') {
            window.ChartScanner.show();
            if (typeof window.ChartScanner.selectStock === 'function') {
                setTimeout(() => {
                    window.ChartScanner.selectStock(code);
                }, 80);
            }
        } else {
            const isKR = /^\d{6}$/.test(code);
            const url = isKR
                ? `https://finance.naver.com/item/main.naver?code=${code}`
                : `https://finance.yahoo.com/quote/${code}`;
            window.open(url, '_blank');
        }
    };

    // 데이터 로드 (정적 JSON 캐시 -> 백엔드 API 순차 폴백)
    async function ensureDataLoaded() {
        if (state.cache) return state.cache;
        state.loading = true;
        const urls = [
            'data/quant_hub_cache.json',
            '/data/quant_hub_cache.json',
            `${API_BASE}/api/quant/hub`,
            'https://raw.githubusercontent.com/sjsks1/dajavata-backend/main/data/quant_hub_cache.json',
            'https://cdn.jsdelivr.net/gh/sjsks1/dajavata-backend@main/data/quant_hub_cache.json'
        ];
        for (const u of urls) {
            try {
                const res = await fetch(u, { cache: 'no-cache' });
                if (res.ok) {
                    const txt = await res.text();
                    if (!txt.trim().startsWith('<')) {
                        const parsed = JSON.parse(txt);
                        if (parsed && parsed.rising) {
                            state.cache = parsed;
                            state.loading = false;
                            return state.cache;
                        }
                    }
                }
            } catch (e) {
                // 다음 폴백 시도
            }
        }
        state.loading = false;
        return null;
    }

    // 상단 공통 헤더 및 8대 모듈 네비게이션 렌더링
    function renderTopHeader() {
        const meta = MODULE_META[state.currentTab] || MODULE_META['quant-rising'];
        const updatedStr = (state.cache && state.cache.updated_at) ? state.cache.updated_at : '실시간 연동';

        const tabs = [
            { id: 'quant-rising', icon: 'ph-lightning', label: '급등 초입 포착' },
            { id: 'quant-promising', icon: 'ph-arrows-clockwise', label: '낙폭과대 우량주' },
            { id: 'quant-market-view', icon: 'ph-globe-hemisphere-west', label: '글로벌 마켓 뷰' },
            { id: 'quant-peer', icon: 'ph-tree-structure', label: '섹터·Peer 비교' },
            { id: 'quant-etf-finder', icon: 'ph-funnel', label: 'ETF 파인더' },
            { id: 'quant-calendar', icon: 'ph-calendar-check', label: '증시 캘린더' },
            { id: 'quant-guru', icon: 'ph-strategy', label: '대가·큰손 포트폴리오' },
            { id: 'quant-money-flow', icon: 'ph-currency-circle-dollar', label: '머니 플로우' }
        ];

        return `
            <div class="qh-topbar">
                <div class="qh-title-area">
                    <div class="qh-title-row">
                        <span class="qh-badge">${esc(meta.badge)}</span>
                        <h1>${esc(meta.title)}</h1>
                    </div>
                    <p class="qh-subtitle">${esc(meta.sub)} · <span style="opacity:0.8;">업데이트: ${esc(updatedStr)}</span></p>
                </div>
                <div class="qh-controls-right">
                    <div class="qh-market-switch" role="group" aria-label="시장 선택">
                        <button type="button" class="qh-mkt-btn ${state.market === 'KR' ? 'active' : ''}" data-mkt="KR">
                            🇰🇷 국내주식 (KRX)
                        </button>
                        <button type="button" class="qh-mkt-btn ${state.market === 'US' ? 'active' : ''}" data-mkt="US">
                            🇺🇸 미국주식 (US)
                        </button>
                    </div>
                </div>
            </div>

            <div class="qh-module-tabs">
                ${tabs.map(t => `
                    <button type="button" class="qh-mod-tab ${state.currentTab === t.id ? 'active' : ''}" data-tab="${t.id}">
                        <i class="ph ${t.icon}"></i> ${esc(t.label)}
                    </button>
                `).join('')}
            </div>
        `;
    }

    // =========================================================================
    // [모듈 1] 급등 초입 포착 (Rising Stocks — Multi-Signal Screener)
    // =========================================================================
    function renderRisingView() {
        const mkt = state.market;
        const data = mkt === 'KR' ? (state.cache.rising.kr || {}) : (state.cache.rising.us || {});
        const counts = data.counts || {};
        const infoMap = data.info || {};

        const sigButtons = [
            { id: 'top', label: '🔥 Top Picks (복합 시그널)', count: (data.top || []).length },
            { id: 'guru', label: mkt === 'KR' ? '메이저 수급(×1.2)' : 'Guru Buying(×1.2)', count: counts.guru || 0 },
            { id: 'growth', label: '실적·성장 급증(×1.2)', count: counts.growth || 0 },
            { id: 'turnover', label: '거래대금 폭발(×1.0)', count: counts.turnover || 0 },
            { id: 'news', label: '뉴스 버즈(×0.8)', count: counts.news || 0 },
            { id: 'breakout', label: '신고가 돌파(×0.8)', count: counts.breakout || 0 },
            { id: 'analyst', label: mkt === 'KR' ? '밸류 리레이팅(×0.8)' : 'Analyst 상향(×0.8)', count: counts.analyst || 0 }
        ];

        let rawRows = [];
        if (state.risingSignal === 'top') {
            rawRows = data.top || [];
        } else {
            rawRows = (data.lists && data.lists[state.risingSignal]) ? data.lists[state.risingSignal] : [];
        }

        // US 데이터 정규화 (info 딕셔너리와 결합)
        const normalized = rawRows.map((r, idx) => {
            const sym = r.s || r.ticker || r.code || '';
            if (mkt === 'KR') {
                return {
                    rank: idx + 1,
                    code: sym,
                    name: r.name || sym,
                    sector: r.sector || '-',
                    marcap: r.marcap || 0,
                    price: r.price || 0,
                    d1: r.day1 != null ? r.day1 : 0,
                    m1: r.day3 != null ? r.day3 : 0,
                    hits: r.hits || [state.risingSignal],
                    score: r.score || 1.0,
                    extra: r.PER ? `PER ${r.PER}배 · PBR ${r.PBR}배` : ''
                };
            } else {
                const inf = infoMap[sym] || {};
                const hits = r.hits || [state.risingSignal];
                let extraDetail = '';
                if (r.who && Array.isArray(r.who)) {
                    extraDetail = '주요 매수 구루: ' + r.who.slice(0, 2).map(w => `${w[0]}(${w[1]})`).join(', ');
                }
                return {
                    rank: idx + 1,
                    code: sym,
                    name: inf.n || r.name || sym,
                    sector: 'US Listed ($300M+)',
                    marcap: inf.c || r.marcap || 0,
                    price: inf.p || r.price || 0,
                    d1: inf.d != null ? inf.d : 0,
                    m1: inf.m1 != null ? inf.m1 : 0,
                    hits: hits,
                    score: r.score || 1.0,
                    extra: extraDetail
                };
            }
        });

        const term = state.risingSearch.trim().toLowerCase();
        const filtered = term
            ? normalized.filter(x => x.code.toLowerCase().includes(term) || x.name.toLowerCase().includes(term) || x.sector.toLowerCase().includes(term))
            : normalized;

        return `
            <div class="qh-kpi-grid">
                <div class="qh-kpi-card">
                    <span class="qh-kpi-label">스크리닝 대상 유니버스</span>
                    <span class="qh-kpi-val">${(data.universe || 0).toLocaleString()} 종목</span>
                    <span class="qh-kpi-sub">${mkt === 'KR' ? 'KRX 시총 500억 원 이상 우량주' : '미국 상장 시총 $300M 이상 종목'}</span>
                </div>
                <div class="qh-kpi-card">
                    <span class="qh-kpi-label">복합 시그널 Top Picks</span>
                    <span class="qh-kpi-val">${(data.top || []).length} 종목</span>
                    <span class="qh-kpi-sub">다중 시그널 동시 포착 최우선 순위</span>
                </div>
                <div class="qh-kpi-card">
                    <span class="qh-kpi-label">가중치 산정 공식</span>
                    <span class="qh-kpi-val" style="font-size:15px;">Guru·성장 ×1.2 / 거래 ×1.0</span>
                    <span class="qh-kpi-sub">뉴스·돌파·애널리스트 ×0.8 합산</span>
                </div>
            </div>

            <div class="qh-filter-bar">
                <div class="qh-filter-group">
                    <span class="qh-filter-label">시그널 필터:</span>
                    ${sigButtons.map(b => `
                        <button type="button" class="qh-pill ${state.risingSignal === b.id ? 'active' : ''}" data-rising-sig="${b.id}">
                            ${esc(b.label)} <span class="qh-count">(${b.count})</span>
                        </button>
                    `).join('')}
                </div>
                <input type="text" class="qh-search-input" id="qh-rising-search" placeholder="티커·종목명·테마 검색..." value="${esc(state.risingSearch)}">
            </div>

            <div class="qh-table-card">
                <div class="qh-table-scroll">
                    <table class="qh-table">
                        <thead>
                            <tr>
                                <th style="width:55px;">순위</th>
                                <th>종목명 (티커)</th>
                                <th>분류 / 핵심 요약</th>
                                <th class="right">시가총액</th>
                                <th class="right">현재가</th>
                                <th class="right">1일 등락</th>
                                <th class="right">${mkt === 'KR' ? '3일 합산' : '1개월 등락'}</th>
                                <th>포착된 시그널 (Signals)</th>
                                <th class="right">점수 (Points)</th>
                                <th class="center">차트·원문</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(item => `
                                <tr>
                                    <td class="center"><b>#${item.rank}</b></td>
                                    <td>
                                        <div style="font-weight:700; color:var(--text-main);">${esc(item.name)}</div>
                                        <div style="font-size:11.5px; color:var(--text-muted); font-family:monospace;">${esc(item.code)}</div>
                                    </td>
                                    <td>
                                        <div style="font-size:12px;">${esc(item.sector)}</div>
                                        ${item.extra ? `<div style="font-size:11px; color:#93c5fd; margin-top:2px;">${esc(item.extra)}</div>` : ''}
                                    </td>
                                    <td class="right">${mkt === 'KR' ? fmtKRW(item.marcap) : fmtUSD(item.marcap)}</td>
                                    <td class="right" style="font-weight:700;">${fmtPrice(item.price, mkt)}</td>
                                    <td class="right">${fmtPct(item.d1)}</td>
                                    <td class="right">${fmtPct(item.m1)}</td>
                                    <td>
                                        ${(item.hits || []).map(h => {
                                            const metaSig = SIGNAL_LABELS[h] || { label: h, cls: 'qh-sig-news' };
                                            return `<span class="qh-sig-badge ${metaSig.cls}">${esc(metaSig.label)}</span>`;
                                        }).join('')}
                                    </td>
                                    <td class="right"><span style="font-weight:800; color:#fbbf24;">${Number(item.score).toFixed(2)}</span></td>
                                    <td class="center">
                                        <button type="button" class="qh-chart-btn" onclick="window.openInDajavataScanner('${esc(item.code)}', '${esc(item.name)}')">
                                            <i class="ph-bold ph-chart-line-up"></i> AI 차트
                                        </button>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="10" class="center" style="padding:36px;">조건에 해당하는 종목이 없습니다.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // [모듈 2] 낙폭과대 우량주 랭킹 (Promising Stock Ranking — High-Drop Screener)
    // =========================================================================
    function renderPromisingView() {
        const mkt = state.market;
        const rawList = mkt === 'KR' ? (state.cache.promising.kr || []) : (state.cache.promising.us || []);

        const mcOptions = mkt === 'KR'
            ? [
                { val: 100000000000, label: '1,000억 원 이상' },
                { val: 300000000000, label: '3,000억 원 이상 (추천)' },
                { val: 1000000000000, label: '1조 원 이상 (대형주)' },
                { val: 5000000000000, label: '5조 원 이상 (초대형)' }
            ]
            : [
                { val: 500000000, label: '$500M 이상' },
                { val: 2000000000, label: '$2B 이상 (추천)' },
                { val: 10000000000, label: '$10B 이상 (Large Cap)' },
                { val: 50000000000, label: '$50B 이상 (Mega Cap)' }
            ];

        const dropOptions = [
            { val: 15, label: '-15% 이상 하락' },
            { val: 30, label: '-30% 이상 하락 (기본)' },
            { val: 50, label: '-50% 이상 하락 (반토막)' },
            { val: 65, label: '-65% 이상 극심한 과매도' }
        ];

        const curMinMc = mkt === 'KR' ? state.promisingMinMcKR : state.promisingMinMcUS;
        const term = state.promisingSearch.trim().toLowerCase();

        let filtered = rawList.filter(r => {
            const mc = Number(r.mc) || 0;
            const fh = Number(r.fh) || 0; // 음수 (예: -45.2)
            if (mc < curMinMc) return false;
            if (Math.abs(fh) < state.promisingMinDrop) return false;
            if (term) {
                const sMatch = String(r.s || '').toLowerCase().includes(term)
                    || String(r.n || '').toLowerCase().includes(term)
                    || String(r.sec || '').toLowerCase().includes(term);
                if (!sMatch) return false;
            }
            return true;
        });

        if (state.promisingSort === 'drop') {
            filtered.sort((a, b) => (Number(a.fh) || 0) - (Number(b.fh) || 0));
        } else if (state.promisingSort === 'mc') {
            filtered.sort((a, b) => (Number(b.mc) || 0) - (Number(a.mc) || 0));
        } else if (state.promisingSort === 'chg') {
            filtered.sort((a, b) => (Number(b.chg) || 0) - (Number(a.chg) || 0));
        }

        return `
            <div class="qh-filter-bar">
                <div class="qh-filter-group">
                    <span class="qh-filter-label">최소 시가총액:</span>
                    ${mcOptions.map(o => `
                        <button type="button" class="qh-pill ${curMinMc === o.val ? 'active' : ''}" data-prom-mc="${o.val}">
                            ${esc(o.label)}
                        </button>
                    `).join('')}
                </div>
                <div class="qh-filter-group">
                    <span class="qh-filter-label">고점 대비 낙폭:</span>
                    ${dropOptions.map(d => `
                        <button type="button" class="qh-pill ${state.promisingMinDrop === d.val ? 'active' : ''}" data-prom-drop="${d.val}">
                            ${esc(d.label)}
                        </button>
                    `).join('')}
                </div>
                <div class="qh-filter-group">
                    <span class="qh-filter-label">정렬:</span>
                    <button type="button" class="qh-pill ${state.promisingSort === 'drop' ? 'active' : ''}" data-prom-sort="drop">낙폭 큰 순</button>
                    <button type="button" class="qh-pill ${state.promisingSort === 'mc' ? 'active' : ''}" data-prom-sort="mc">시가총액 순</button>
                    <button type="button" class="qh-pill ${state.promisingSort === 'chg' ? 'active' : ''}" data-prom-sort="chg">당일 반등 순</button>
                    <input type="text" class="qh-search-input" id="qh-prom-search" placeholder="종목명·섹터 검색..." value="${esc(state.promisingSearch)}">
                </div>
            </div>

            <div class="qh-table-card">
                <div style="padding:12px 16px; border-bottom:1px solid var(--border); font-size:12.5px; color:var(--text-muted); display:flex; justify-content:space-between;">
                    <span>조건 충족 우량주: <b style="color:var(--text-main);">${filtered.length}종목</b> (시총 ${mkt === 'KR' ? fmtKRW(curMinMc) : fmtUSD(curMinMc)} 이상 & 52주 고점 대비 -${state.promisingMinDrop}% 이하)</span>
                    <span>💡 우측 [AI 차트] 버튼 클릭 시 ICT 지지 구간 및 반등 타점을 즉시 확인합니다</span>
                </div>
                <div class="qh-table-scroll">
                    <table class="qh-table">
                        <thead>
                            <tr>
                                <th style="width:55px;">순위</th>
                                <th>종목명 (티커)</th>
                                <th>섹터 / 대표 테마</th>
                                <th class="right">시가총액</th>
                                <th class="right">현재가</th>
                                <th class="right">당일 등락</th>
                                <th class="right">52주 고점 대비 (Off High)</th>
                                <th class="right">${mkt === 'KR' ? 'PER / PBR' : '최대 낙폭 (Max DD)'}</th>
                                <th class="center">차트 분석</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.slice(0, 200).map((r, i) => `
                                <tr>
                                    <td class="center"><b>#${i + 1}</b></td>
                                    <td>
                                        <div style="font-weight:700;">${esc(r.n)}</div>
                                        <div style="font-size:11.5px; color:var(--text-muted); font-family:monospace;">${esc(r.s)}</div>
                                    </td>
                                    <td>${esc(r.sec || r.ind || '-')}</td>
                                    <td class="right">${mkt === 'KR' ? fmtKRW(r.mc) : fmtUSD(r.mc)}</td>
                                    <td class="right" style="font-weight:700;">${fmtPrice(r.px, mkt)}</td>
                                    <td class="right">${fmtPct(r.chg)}</td>
                                    <td class="right">
                                        <span style="background:rgba(59,130,246,0.16); color:#60a5fa; border:1px solid rgba(59,130,246,0.4); padding:3px 8px; border-radius:5px; font-weight:800;">
                                            ${Number(r.fh).toFixed(1)}%
                                        </span>
                                    </td>
                                    <td class="right" style="font-size:12px; color:var(--text-muted);">
                                        ${mkt === 'KR'
                                            ? `PER ${r.per || '-'} · PBR ${r.pbr || '-'}`
                                            : (r.dd ? `-${Number(r.dd).toFixed(1)}%` : '-')}
                                    </td>
                                    <td class="center">
                                        <button type="button" class="qh-chart-btn" onclick="window.openInDajavataScanner('${esc(r.s)}', '${esc(r.n)}')">
                                            <i class="ph-bold ph-chart-line-up"></i> AI 차트
                                        </button>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="9" class="center" style="padding:36px;">해당 조건의 종목이 없습니다. 필터 범위를 완화해보세요.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // [모듈 3] 글로벌 마켓 뷰 (Market View — 시총·회전율·구루 보유 랭킹)
    // =========================================================================
    function renderMarketView() {
        const mkt = state.market;
        const rows = mkt === 'KR' ? (state.cache.market_view.kr || []) : (state.cache.market_view.us || []);

        const idxOptions = mkt === 'KR'
            ? [
                { id: 'ALL', label: '전체 대표주' },
                { id: 'KOSPI 200', label: 'KOSPI 200 대형주' },
                { id: 'KRX 주요주', label: '코스피/코스닥 중대형' }
            ]
            : [
                { id: 'ALL', label: 'All US' },
                { id: 'S&P 500', label: 'S&P 500' },
                { id: 'Nasdaq 100', label: 'Nasdaq 100' },
                { id: 'Dow Jones', label: 'Dow Jones 30' }
            ];

        const curIdx = mkt === 'KR' ? state.mvIndexKR : state.mvIndexUS;
        const term = state.mvSearch.trim().toLowerCase();

        let filtered = rows.filter(r => {
            if (curIdx !== 'ALL') {
                const indexes = r.indexes || [];
                if (!indexes.includes(curIdx)) return false;
            }
            if (term) {
                const match = String(r.ticker || '').toLowerCase().includes(term)
                    || String(r.name || '').toLowerCase().includes(term);
                if (!match) return false;
            }
            return true;
        });

        if (state.mvSort === 'mc') {
            filtered.sort((a, b) => (Number(b.marketCap) || 0) - (Number(a.marketCap) || 0));
        } else if (state.mvSort === 'turnover') {
            filtered.sort((a, b) => {
                const va = mkt === 'KR' ? Math.abs(Number(a.day3) || 0) : (Number(a.turnover1M) || Number(a.amount) || 0);
                const vb = mkt === 'KR' ? Math.abs(Number(b.day3) || 0) : (Number(b.turnover1M) || Number(b.amount) || 0);
                return vb - va;
            });
        } else if (state.mvSort === 'guru') {
            filtered.sort((a, b) => {
                const ga = mkt === 'KR' ? (Number(a.day1) || 0) : (Number(a.guruCount) || 0);
                const gb = mkt === 'KR' ? (Number(b.day1) || 0) : (Number(b.guruCount) || 0);
                return gb - ga;
            });
        }

        return `
            <div class="qh-filter-bar">
                <div class="qh-filter-group">
                    <span class="qh-filter-label">지수 분류:</span>
                    ${idxOptions.map(o => `
                        <button type="button" class="qh-pill ${curIdx === o.id ? 'active' : ''}" data-mv-idx="${o.id}">
                            ${esc(o.label)}
                        </button>
                    `).join('')}
                </div>
                <div class="qh-filter-group">
                    <span class="qh-filter-label">랭킹 기준:</span>
                    <button type="button" class="qh-pill ${state.mvSort === 'mc' ? 'active' : ''}" data-mv-sort="mc">시가총액 순</button>
                    <button type="button" class="qh-pill ${state.mvSort === 'turnover' ? 'active' : ''}" data-mv-sort="turnover">${mkt === 'KR' ? '단기 변동·모멘텀 순' : '1개월 거래대금(Turnover) 순'}</button>
                    <button type="button" class="qh-pill ${state.mvSort === 'guru' ? 'active' : ''}" data-mv-sort="guru">${mkt === 'KR' ? '당일 강세 순' : '구루 최다보유(Gurus) 순'}</button>
                    <input type="text" class="qh-search-input" id="qh-mv-search" placeholder="티커·종목명 검색..." value="${esc(state.mvSearch)}">
                </div>
            </div>

            <div class="qh-table-card">
                <div class="qh-table-scroll">
                    <table class="qh-table">
                        <thead>
                            <tr>
                                <th style="width:55px;">순위</th>
                                <th>티커 / 종목명</th>
                                <th>편입 지수 / 분류</th>
                                <th class="right">현재가</th>
                                <th class="right">1일 등락률</th>
                                <th class="right">시가총액</th>
                                <th class="right">${mkt === 'KR' ? 'PER / PBR' : '1개월 거래대금 (Turnover)'}</th>
                                <th class="right">${mkt === 'KR' ? '52주 고점비' : '보유 구루 수 (Gurus)'}</th>
                                <th class="center">차트 분석</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.slice(0, 150).map((r, i) => `
                                <tr>
                                    <td class="center"><b>#${i + 1}</b></td>
                                    <td>
                                        <div style="font-weight:700;">${esc(r.name)}</div>
                                        <div style="font-size:11.5px; color:var(--text-muted); font-family:monospace;">${esc(r.ticker)}</div>
                                    </td>
                                    <td>
                                        ${(r.indexes || []).map(ix => `<span class="qh-sig-badge qh-sig-news">${esc(ix)}</span>`).join(' ')}
                                        ${r.sector ? `<span style="font-size:11.5px; color:var(--text-muted);">${esc(r.sector)}</span>` : ''}
                                    </td>
                                    <td class="right" style="font-weight:700;">${fmtPrice(r.price, mkt)}</td>
                                    <td class="right">${fmtPct(r.chg)}</td>
                                    <td class="right">${mkt === 'KR' ? fmtKRW(r.marketCap) : fmtUSD(r.marketCap)}</td>
                                    <td class="right">
                                        ${mkt === 'KR'
                                            ? `PER ${r.per || '-'} · PBR ${r.pbr || '-'}`
                                            : fmtUSD(r.turnover1M || r.amount || 0)}
                                    </td>
                                    <td class="right">
                                        ${mkt === 'KR'
                                            ? fmtPct(r.high52)
                                            : `<span style="font-weight:800; color:#c084fc;">${r.guruCount || 0}명</span>`}
                                    </td>
                                    <td class="center">
                                        <button type="button" class="qh-chart-btn" onclick="window.openInDajavataScanner('${esc(r.ticker)}', '${esc(r.name)}')">
                                            <i class="ph-bold ph-chart-line-up"></i> AI 차트
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // [모듈 4] 섹터·동종업계 비교 (Peer Group Analysis)
    // =========================================================================
    function renderPeerView() {
        const mkt = state.market;
        const groups = mkt === 'KR' ? (state.cache.peer.kr || []) : (state.cache.peer.us || []);
        const selIdx = Math.min(state.peerSelectedGroupIdx, Math.max(groups.length - 1, 0));
        const selectedGroup = groups[selIdx] || {};

        return `
            <div class="qh-split-layout">
                <!-- 좌측: 섹터·테마 자금 쏠림 리스트 -->
                <div class="qh-table-card">
                    <div style="padding:13px 16px; border-bottom:1px solid var(--border); font-weight:800; display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="ph-fill ph-tree-structure" style="color:#3b82f6;"></i> ${mkt === 'KR' ? '국내 핵심 테마·산업군 자금 분포' : '미국 11대 섹터 & 세부 산업군 (Peer Groups)'}</span>
                        <span style="font-size:11.5px; color:var(--text-muted);">항목 클릭 시 우측 상세 비교</span>
                    </div>
                    <div class="qh-table-scroll" style="max-height:680px; overflow-y:auto;">
                        <table class="qh-table">
                            <thead>
                                <tr>
                                    <th>섹터 / 산업군명</th>
                                    <th class="right">종목 수</th>
                                    <th class="right">${mkt === 'KR' ? '합산 시총' : '일일 거래대금'}</th>
                                    <th class="right">상승 종목</th>
                                    <th class="right">평균 등락</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${groups.map((g, idx) => `
                                    <tr style="cursor:pointer; ${idx === selIdx ? 'background:rgba(37,99,235,0.16);' : ''}" data-peer-idx="${idx}">
                                        <td>
                                            <span style="font-weight:700; color:${idx === selIdx ? '#60a5fa' : 'var(--text-main)'};">
                                                [${idx === selIdx ? '-' : '+'}] ${esc(g.name)}
                                            </span>
                                        </td>
                                        <td class="right">${g.count || 0}</td>
                                        <td class="right" style="font-weight:700;">${mkt === 'KR' ? fmtKRW(g.amt) : fmtUSD(g.amt)}</td>
                                        <td class="right" style="color:#ef4444; font-weight:700;">${g.hot || 0}</td>
                                        <td class="right">${fmtPct(g.chg)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 우측: 선택된 섹터의 세부 산업군(US) 또는 동종업계 Peer 종목 비교(KR) -->
                <div class="qh-table-card">
                    <div style="padding:13px 16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <span class="qh-badge">PEER COMPARISON</span>
                            <strong style="margin-left:8px; font-size:15px;">${esc(selectedGroup.name || '선택된 그룹')}</strong>
                        </div>
                        <span style="font-size:12px; color:var(--text-muted);">
                            총 ${selectedGroup.count || 0}종목 · 평균 ${fmtPct(selectedGroup.chg)}
                        </span>
                    </div>
                    <div class="qh-table-scroll" style="max-height:680px; overflow-y:auto;">
                        ${mkt === 'KR' ? `
                            <table class="qh-table">
                                <thead>
                                    <tr>
                                        <th>동종업계 종목 (Peer)</th>
                                        <th class="right">현재가</th>
                                        <th class="right">등락률</th>
                                        <th class="right">시가총액 (섹터 내 비중)</th>
                                        <th class="right">PER / PBR</th>
                                        <th class="center">차트</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(selectedGroup.peers || []).map(p => {
                                        const share = selectedGroup.amt > 0 ? ((p.marcap / selectedGroup.amt) * 100).toFixed(1) : '0.0';
                                        return `
                                            <tr>
                                                <td>
                                                    <div style="font-weight:700;">${esc(p.name)}</div>
                                                    <div style="font-size:11px; color:var(--text-muted); font-family:monospace;">${esc(p.code)}</div>
                                                </td>
                                                <td class="right">${fmtPrice(p.price, 'KR')}</td>
                                                <td class="right">${fmtPct(p.chg)}</td>
                                                <td class="right">
                                                    <div>${fmtKRW(p.marcap)}</div>
                                                    <div style="font-size:10.5px; color:#60a5fa;">점유율 ${share}%</div>
                                                </td>
                                                <td class="right" style="font-size:12px;">${p.per || '-'}배 / ${p.pbr || '-'}배</td>
                                                <td class="center">
                                                    <button type="button" class="qh-chart-btn" onclick="window.openInDajavataScanner('${esc(p.code)}', '${esc(p.name)}')">차트</button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        ` : `
                            <table class="qh-table">
                                <thead>
                                    <tr>
                                        <th>세부 산업군 (Sub-Industry)</th>
                                        <th class="right">소속 종목 수</th>
                                        <th class="right">일일 거래대금 (Traded)</th>
                                        <th class="right">급등 종목 (Rising)</th>
                                        <th class="right">평균 등락 (%Chg)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(selectedGroup.items || []).map(sub => `
                                        <tr>
                                            <td style="font-weight:700;">${esc(sub.name)}</td>
                                            <td class="right">${sub.count || 0}</td>
                                            <td class="right" style="font-weight:700;">${fmtUSD(sub.amt)}</td>
                                            <td class="right" style="color:#ef4444; font-weight:700;">${sub.hot || 0}</td>
                                            <td class="right">${fmtPct(sub.chg)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // [모듈 5] 한·미 ETF 파인더 (ETF Finder)
    // =========================================================================
    function renderEtfFinderView() {
        const mkt = state.market;
        const rows = mkt === 'KR' ? (state.cache.etf_finder.kr || []) : (state.cache.etf_finder.us || []);

        const catOptions = mkt === 'KR'
            ? [
                { id: 'ALL', label: '전체 국내 ETF' },
                { id: '1', label: '국내 시장지수' },
                { id: '2', label: '국내 업종/테마' },
                { id: '3', label: '레버리지/인버스' },
                { id: '4', label: '해외 주식형' },
                { id: '5', label: '원자재/통화' },
                { id: '6', label: '채권/금리형' },
                { id: '7', label: '기타/액티브' }
            ]
            : [
                { id: 'ALL', label: 'All US ETFs' },
                { id: 'Market', label: 'Equity Market' },
                { id: 'Style', label: 'Style & Strategy' },
                { id: 'Theme', label: 'Themes & Sector' },
                { id: 'Leverage', label: 'Leverage & Inverse' },
                { id: 'Bond', label: 'Fixed Income (Bond)' },
                { id: 'Commodity', label: 'Commodity & Crypto' }
            ];

        const curCat = mkt === 'KR' ? state.etfCategoryKR : state.etfCategoryUS;
        const term = state.etfSearch.trim().toLowerCase();

        const filtered = rows.filter(r => {
            if (curCat !== 'ALL') {
                if (mkt === 'KR') {
                    if (String(r.catCode) !== curCat) return false;
                } else {
                    const t = String(r.type || '').toLowerCase();
                    const nm = String(r.name || '').toLowerCase();
                    if (curCat === 'Market' && !t.includes('market') && !t.includes('large') && !t.includes('blend')) return false;
                    if (curCat === 'Style' && !t.includes('value') && !t.includes('growth') && !t.includes('dividend')) return false;
                    if (curCat === 'Theme' && !t.includes('tech') && !t.includes('health') && !t.includes('sector') && !t.includes('semi')) return false;
                    if (curCat === 'Leverage' && !t.includes('leverag') && !t.includes('inverse') && !nm.includes('2x') && !nm.includes('3x') && !nm.includes('ultra')) return false;
                    if (curCat === 'Bond' && !t.includes('bond') && !t.includes('treasury') && !t.includes('fixed')) return false;
                    if (curCat === 'Commodity' && !t.includes('gold') && !t.includes('silver') && !t.includes('commod') && !t.includes('bitcoin') && !t.includes('crypto')) return false;
                }
            }
            if (term) {
                const m = String(r.ticker || '').toLowerCase().includes(term)
                    || String(r.name || '').toLowerCase().includes(term)
                    || String(r.type || '').toLowerCase().includes(term);
                if (!m) return false;
            }
            return true;
        });

        return `
            <div class="qh-filter-bar">
                <div class="qh-filter-group">
                    <span class="qh-filter-label">ETF 카테고리:</span>
                    ${catOptions.map(c => `
                        <button type="button" class="qh-pill ${curCat === c.id ? 'active' : ''}" data-etf-cat="${c.id}">
                            ${esc(c.label)}
                        </button>
                    `).join('')}
                </div>
                <input type="text" class="qh-search-input" id="qh-etf-search" placeholder="ETF 이름·티커 검색 (예: 반도체, 배당, QQQ, SOXL)..." value="${esc(state.etfSearch)}">
            </div>

            <div class="qh-table-card">
                <div class="qh-table-scroll">
                    <table class="qh-table">
                        <thead>
                            <tr>
                                <th style="width:55px;">순위</th>
                                <th>티커 / ETF 종목명</th>
                                <th>유형 분류 (Category)</th>
                                <th class="right">${mkt === 'KR' ? '현재가 (NAV)' : '거래소'}</th>
                                <th class="right">1일 등락률</th>
                                <th class="right">${mkt === 'KR' ? '3개월 수익률' : '배당수익률 (TTM)'}</th>
                                <th class="right">순자산총액 (AUM)</th>
                                <th class="right">${mkt === 'KR' ? '일일 거래대금' : '총보수 / 보유종목수'}</th>
                                <th class="center">차트 분석</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.slice(0, 150).map((r, i) => `
                                <tr>
                                    <td class="center"><b>#${i + 1}</b></td>
                                    <td>
                                        <div style="font-weight:700;">${esc(r.name)}</div>
                                        <div style="font-size:11.5px; color:var(--text-muted); font-family:monospace;">${esc(r.ticker)}</div>
                                    </td>
                                    <td><span class="qh-sig-badge qh-sig-news">${esc(r.type || '-')}</span></td>
                                    <td class="right">
                                        ${mkt === 'KR'
                                            ? `<b>${fmtPrice(r.price, 'KR')}</b><div style="font-size:10.5px; color:var(--text-muted);">NAV ${Math.round(r.nav || 0).toLocaleString()}</div>`
                                            : esc(r.exchange || 'NYSE/NASDAQ')}
                                    </td>
                                    <td class="right">${fmtPct(r.chg)}</td>
                                    <td class="right">
                                        ${mkt === 'KR'
                                            ? fmtPct(r.return3M)
                                            : (r.dividendYield != null ? `${Number(r.dividendYield).toFixed(2)}%` : '-')}
                                    </td>
                                    <td class="right" style="font-weight:700;">${mkt === 'KR' ? fmtKRW(r.marketCap) : fmtUSD(r.marketCap)}</td>
                                    <td class="right" style="font-size:12px;">
                                        ${mkt === 'KR'
                                            ? fmtKRW(r.amount)
                                            : `보수 ${r.expenseRatio != null ? r.expenseRatio + '%' : '-'} · ${r.holdings || '-'}종목`}
                                    </td>
                                    <td class="center">
                                        <button type="button" class="qh-chart-btn" onclick="window.openInDajavataScanner('${esc(r.ticker)}', '${esc(r.name)}')">
                                            <i class="ph-bold ph-chart-line-up"></i> AI 차트
                                        </button>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="9" class="center" style="padding:36px;">검색 조건에 맞는 ETF가 없습니다.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // [모듈 6] 증시 일정 캘린더 (Market Calendar — Earnings, IPO, Split, Macro)
    // =========================================================================
    const KR_CALENDAR_DATA = {
        earnings: [
            { date: '2026-10-08', code: '005930', title: '삼성전자 (005930) 잠정 실적 발표', sub: '영업이익 컨센서스 상회 여부 및 HBM3E/파운드리 가이던스 점검', badge: '잠정실적' },
            { date: '2026-10-08', code: '373220', title: 'LG에너지솔루션 (373220) 잠정 실적 발표', sub: '북미 AMPC 보조금 반영 규모 및 유럽향 출하량 점검', badge: '잠정실적' },
            { date: '2026-10-22', code: '207940', title: '삼성바이오로직스 (207940) 3Q 확정 실적', sub: '4공장 풀가동 효과 및 환율 수혜 반영 분기 최대 매출 기대', badge: '확정실적' },
            { date: '2026-10-24', code: '000660', title: 'SK하이닉스 (000660) 3Q 경영실적 및 컨퍼런스콜', sub: 'HBM 매출 비중 확대 및 차세대 HBM4 양산 로드맵 발표', badge: '장전발표' },
            { date: '2026-10-24', code: '005380', title: '현대차 (005380) 3Q 경영실적 및 주주환원 발표', sub: '북미 하이브리드 판매 호조 및 분기 배당 확정', badge: '확정실적' },
            { date: '2026-10-25', code: '105560', title: 'KB금융 (105560) 3Q 실적 및 밸류업 자사주 소각 공시', sub: 'CET1 비율 기반 주주환원율 확대 발표', badge: '밸류업공시' },
            { date: '2026-10-25', code: '055550', title: '신한지주 (055550) 3Q 경영실적 발표', sub: '분기 배당 및 자사주 매입·소각 규모 발표', badge: '확정실적' },
            { date: '2026-10-28', code: '000270', title: '기아 (000270) 3Q 경영실적 발표', sub: '글로벌 영업이익률 12%대 유지 및 고배당 기조 점검', badge: '확정실적' },
            { date: '2026-10-29', code: '012450', title: '한화에어로스페이스 (012450) 분기 실적 발표', sub: '폴란드·루마니아향 K9 자주포 및 천무 인도 물량 급증 반영', badge: '확정실적' },
            { date: '2026-10-30', code: '005930', title: '삼성전자 (005930) 사업부별 확정 실적 및 컨퍼런스콜', sub: 'DS(반도체)·SDC·MX 사업부별 세부 손익 및 설비투자(CAPEX) 발표', badge: '컨퍼런스콜' },
            { date: '2026-10-31', code: '035420', title: 'NAVER (035420) 분기 실적 발표', sub: '서치플랫폼 AI 광고 효율 개선 및 커머스 성장률 점검', badge: '장전발표' }
        ],
        ipo: [
            { date: '2026-10-06', code: '475150', title: 'SK이터닉스 / 신재생에너지 섹터 보호예수 해제 점검', sub: '코스피 신재생·ESS 테마 수급 점검', badge: '수급일정' },
            { date: '2026-10-14', code: '468530', title: '셀비온 (코스닥 신규 상장)', sub: '방사성의약품 신약 개발 전문 바이오 기업 코스닥 상장', badge: '신규상장' },
            { date: '2026-10-18', code: '476060', title: '와이제이링크 (코스닥 신규 상장)', sub: 'SMT 표면실장 스마트 공정 장비 전문기업 상장', badge: '신규상장' },
            { date: '2026-10-22', code: '475560', title: '더본코리아 일반투자자 공모주 청약', sub: '유가증권시장(KOSPI) 상장 앞두고 일반 청약 진행', badge: '공모청약' },
            { date: '2026-10-24', code: '478440', title: '씨메스 (코스닥 신규 상장)', sub: 'AI 3D 비전 로봇 솔루션 전문기업 (SKT·쿠팡 파트너)', badge: '신규상장' },
            { date: '2026-10-28', code: '479880', title: '클로봇 (코스닥 신규 상장)', sub: '실내 자율주행 로봇 소프트웨어 플랫폼 (현대차·네이버 투자)', badge: '신규상장' },
            { date: '2026-10-30', code: '481850', title: '에이럭스 / 탑런토탈솔루션 상장 일정', sub: '드론·로봇 에듀테크 및 전장 디스플레이 부품 신규 상장', badge: 'IPO일정' }
        ],
        split: [
            { date: '2026-10-10', code: '105560', title: 'KB금융 자사주 매입·소각 이행 공시', sub: '코리아 밸류업 지수 핵심 편입 종목 주주환원 실행', badge: '자사주소각' },
            { date: '2026-10-16', code: '005380', title: '현대차 분기배당 기준일 및 우선주 주주환원 점검', sub: '분기 배당락 및 밸류업 프로그램 이행', badge: '배당/환원' },
            { date: '2026-10-23', code: '068270', title: '셀트리온 자사주 추가 소각 및 합병 시너지 점검', sub: '주주가치 제고를 위한 자사주 소각 일정', badge: '자사주소각' },
            { date: '2026-10-29', code: '086790', title: '하나금융지주 분기배당 및 자사주 소각 결의', sub: '3분기 실적 발표와 함께 대규모 자사주 소각 발표', badge: '밸류업' }
        ],
        economic: [
            { date: '2026-10-01', code: 'MACRO', title: '한국 9월 수출입동향 발표 (산업통상자원부)', sub: '반도체·자동차·선박 수출 증가율 및 무역수지 흑자 규모 확인', badge: '국내지표' },
            { date: '2026-10-02', code: 'MACRO', title: '한국 9월 소비자물가지수 (CPI) 발표', sub: '물가 안정 목표(2.0%) 하회 여부 점검', badge: '물가지표' },
            { date: '2026-10-10', code: 'MACRO', title: 'KRX 코스피200 옵션 만기일 (수급 변동성 주의)', sub: '외국인·기관 프로그램 차익/비차익 매매 쏠림 체크', badge: '만기일' },
            { date: '2026-10-11', code: 'MACRO', title: '한국은행 금융통화위원회 기준금리 결정', sub: '국내 기준금리 결정 및 총재 기자간담회 통화정책 방향', badge: '금통위(BOK)' },
            { date: '2026-10-24', code: 'MACRO', title: '한국 3분기 실질 GDP 속보치 발표 (한국은행)', sub: '수출 및 내수 설비투자 성장 기여도 점검', badge: 'GDP속보' },
            { date: '2026-10-31', code: 'MACRO', title: '한국 9월 산업활동동향 및 반도체 재고순환지표', sub: '광공업 생산 및 반도체 출하/재고 비율 확인', badge: '산업동향' }
        ]
    };

    function renderCalendarView() {
        const mkt = state.market;
        const cal = state.cache.calendar || {};
        const catTabs = [
            { id: 'earnings', label: '📊 실적 발표 (Earnings)', icon: 'ph-chart-bar' },
            { id: 'ipo', label: '🚀 공모·신규상장 (IPO)', icon: 'ph-rocket-launch' },
            { id: 'split', label: mkt === 'KR' ? '💎 밸류업·배당·소각' : '✂️ 액면분할·증자 (Split)', icon: 'ph-scissors' },
            { id: 'economic', label: '🏛️ 거시경제·금통위/FOMC', icon: 'ph-bank' }
        ];

        let events = [];
        if (mkt === 'KR') {
            events = KR_CALENDAR_DATA[state.calCategory] || KR_CALENDAR_DATA.earnings;
        } else if (state.calCategory === 'earnings') {
            events = (cal.us_earnings || []).map(e => ({
                date: e.date,
                code: e.symbol,
                title: `${e.name} (${e.symbol}) 실적 발표`,
                sub: `EPS 예상: ${e.epsEst ?? '-'} / 실제: ${e.epsAct ?? '발표예정'} · 매출 예상: ${e.revEst ? fmtUSD(e.revEst) : '-'}`,
                badge: e.when === 'pre' ? '장전(Pre)' : (e.when === 'post' ? '장후(After)' : '실적')
            }));
        } else if (state.calCategory === 'ipo') {
            events = (cal.us_ipos || []).map(e => ({
                date: e.d || e.date || '2026-10',
                code: e.s || e.symbol || '',
                title: `${e.n || e.name || ''} (${e.s || ''}) 신규 상장`,
                sub: `거래소: ${e.ex || 'NASDAQ/NYSE'} · 공모 규모: ${e.p ? fmtUSD(e.p) : '공모 진행'}`,
                badge: 'IPO 상장'
            }));
        } else if (state.calCategory === 'split') {
            events = (cal.us_splits || []).map(e => ({
                date: e.date,
                code: e.symbol,
                title: `${e.symbol} 주식 분할 (${e.numerator} : ${e.denominator})`,
                sub: `비율: ${e.numerator} 대 ${e.denominator} 분할/병합 기준일`,
                badge: 'Split'
            }));
        } else {
            events = (cal.us_economic || []).map(e => ({
                date: String(e.t || '').slice(0, 10),
                code: 'MACRO',
                title: e.event || '거시경제 지표 발표',
                sub: `이전치: ${e.previous ?? '-'} · 예상치: ${e.estimate ?? '-'} · 실제: ${e.actual ?? '-'}`,
                badge: e.impact || 'Macro'
            }));
        }

        // 날짜별 이벤트 카운트 집계
        const dateCounts = {};
        events.forEach(ev => {
            if (ev.date) dateCounts[ev.date] = (dateCounts[ev.date] || 0) + 1;
        });

        const filteredEvents = state.calSelectedDate
            ? events.filter(e => e.date === state.calSelectedDate)
            : events;

        // 2026년 10월 달력 셀 생성 (1일 = 목요일 기준)
        const daysInMonth = 31;
        const firstDayOffset = 4; // 2026-10-01 is Thursday
        const cellsHtml = [];
        for (let i = 0; i < firstDayOffset; i++) {
            cellsHtml.push(`<div class="qh-cal-cell" style="opacity:0.25; pointer-events:none;"></div>`);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `2026-10-${String(d).padStart(2, '0')}`;
            const cnt = dateCounts[dateStr] || 0;
            const isSel = state.calSelectedDate === dateStr;
            cellsHtml.push(`
                <div class="qh-cal-cell ${isSel ? 'active' : ''}" data-cal-date="${dateStr}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="qh-cal-date">${d}일</span>
                        ${cnt > 0 ? `<span class="qh-sig-badge qh-sig-News" style="margin:0;">${cnt}건</span>` : ''}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:6px;">
                        ${cnt > 0 ? `${cnt}개 일정 보기 →` : '일정 없음'}
                    </div>
                </div>
            `);
        }

        return `
            <div class="qh-filter-bar">
                <div class="qh-filter-group">
                    <span class="qh-filter-label">일정 카테고리:</span>
                    ${catTabs.map(t => `
                        <button type="button" class="qh-pill ${state.calCategory === t.id ? 'active' : ''}" data-cal-cat="${t.id}">
                            ${esc(t.label)}
                        </button>
                    `).join('')}
                </div>
                ${state.calSelectedDate ? `
                    <button type="button" class="qh-pill active" id="qh-cal-clear-date">
                        선택 날짜: ${esc(state.calSelectedDate)} (전체 보기로 해제 ×)
                    </button>
                ` : '<span style="font-size:12px; color:var(--text-muted);">📅 달력에서 날짜를 클릭하면 해당 일자의 세부 일정을 필터링합니다</span>'}
            </div>

            <div class="qh-cal-grid">
                <div class="qh-cal-day-header" style="color:#ef4444;">일 (Sun)</div>
                <div class="qh-cal-day-header">월 (Mon)</div>
                <div class="qh-cal-day-header">화 (Tue)</div>
                <div class="qh-cal-day-header">수 (Wed)</div>
                <div class="qh-cal-day-header">목 (Thu)</div>
                <div class="qh-cal-day-header">금 (Fri)</div>
                <div class="qh-cal-day-header" style="color:#3b82f6;">토 (Sat)</div>
                ${cellsHtml.join('')}
            </div>

            <div class="qh-table-card">
                <div style="padding:12px 16px; border-bottom:1px solid var(--border); font-weight:700;">
                    일정 상세 내역 (${filteredEvents.length}건)
                </div>
                <div class="qh-table-scroll" style="max-height:480px; overflow-y:auto;">
                    <table class="qh-table">
                        <thead>
                            <tr>
                                <th style="width:120px;">일자</th>
                                <th style="width:110px;">구분</th>
                                <th>일정 및 종목명</th>
                                <th>상세 컨센서스 / 발표 수치</th>
                                <th class="center">차트 연동</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredEvents.slice(0, 150).map(ev => `
                                <tr>
                                    <td style="font-family:monospace; font-weight:700;">${esc(ev.date)}</td>
                                    <td><span class="qh-sig-badge qh-sig-turnover">${esc(ev.badge)}</span></td>
                                    <td style="font-weight:700;">${esc(ev.title)}</td>
                                    <td style="color:var(--text-muted); font-size:12.5px;">${esc(ev.sub)}</td>
                                    <td class="center">
                                        ${ev.code && ev.code !== 'MACRO' ? `
                                            <button type="button" class="qh-chart-btn" onclick="window.openInDajavataScanner('${esc(ev.code)}', '${esc(ev.title)}')">AI 차트</button>
                                        ` : '-'}
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="5" class="center" style="padding:30px;">해당 날짜에 등록된 일정이 없습니다.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // [모듈 7] 대가·큰손 포트폴리오 (Guru Portfolio — 338 US Gurus & KR 큰손)
    // =========================================================================
    function renderGuruView() {
        const mkt = state.market;
        const stylePills = [
            { id: 'ALL', kbd: 'ALL', label: '전체 대가' },
            { id: '1', kbd: '1', label: '가치투자 (Value)' },
            { id: '2', kbd: '2', label: '성장투자 (Growth)' },
            { id: '3', kbd: '3', label: '균형투자 (Balance)' },
            { id: '4', kbd: '4', label: '배당투자 (Dividend)' },
            { id: '5', kbd: '5', label: '대학기금 (University)' },
            { id: '7', kbd: '7', label: '네임드 대가 (Famous)' },
            { id: '8', kbd: '8', label: '기업/전략 (Corporate)' }
        ];
        const sizePills = [
            { id: 'ALL', kbd: 'ALL', label: '전체 규모' },
            { id: 'Q', kbd: 'Q', label: '$30B+ (초대형)' },
            { id: 'W', kbd: 'W', label: '$3B – $30B' },
            { id: 'E', kbd: 'E', label: '$300M – $3B' },
            { id: 'R', kbd: 'R', label: 'Under $300M' }
        ];

        if (mkt === 'KR') {
            const krGurus = state.cache.guru.kr || [];
            const activeGuru = krGurus.find(g => g.id === state.selectedGuruIdKR) || krGurus[0] || {};
            return `
                <div class="qh-split-layout">
                    <div>
                        <div style="margin-bottom:10px; font-weight:800; font-size:14px;">🇰🇷 대한민국 6대 메이저 큰손·기관 포트폴리오 (클릭하여 보유종목 확인)</div>
                        <div class="qh-guru-grid">
                            ${krGurus.map(g => `
                                <div class="qh-guru-card ${g.id === activeGuru.id ? 'active' : ''}" data-kr-guru="${esc(g.id)}">
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <span class="qh-sig-badge qh-sig-guru">${esc(g.style)}</span>
                                        <span style="font-size:11px; color:#fbbf24; font-weight:700;">${esc(g.aum_label)}</span>
                                    </div>
                                    <div style="font-weight:800; font-size:15px;">${esc(g.name)}</div>
                                    <div style="font-size:12px; color:var(--text-muted); line-height:1.45;">${esc(g.desc)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="qh-table-card">
                        <div style="padding:14px 16px; border-bottom:1px solid var(--border);">
                            <span class="qh-badge">PORTFOLIO HOLDINGS</span>
                            <h3 style="margin:6px 0 2px 0; font-size:16px;">${esc(activeGuru.name)} 핵심 보유 종목</h3>
                            <p style="margin:0; font-size:12px; color:var(--text-muted);">${esc(activeGuru.desc)}</p>
                        </div>
                        <div class="qh-table-scroll">
                            <table class="qh-table">
                                <thead>
                                    <tr>
                                        <th>종목명 (코드)</th>
                                        <th class="right">현재가</th>
                                        <th class="right">등락률</th>
                                        <th class="right">포트폴리오 비중</th>
                                        <th class="right">PER / PBR</th>
                                        <th class="center">차트</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(activeGuru.holdings || []).map(h => `
                                        <tr>
                                            <td>
                                                <div style="font-weight:700;">${esc(h.nameOfIssuer)}</div>
                                                <div style="font-size:11px; color:var(--text-muted); font-family:monospace;">${esc(h.symbol)}</div>
                                            </td>
                                            <td class="right">${fmtPrice(h.price, 'KR')}</td>
                                            <td class="right">${fmtPct(h.chg)}</td>
                                            <td class="right"><b style="color:#60a5fa;">${h.pct}%</b></td>
                                            <td class="right" style="font-size:12px;">${h.per}배 / ${h.pbr}배</td>
                                            <td class="center">
                                                <button type="button" class="qh-chart-btn" onclick="window.openInDajavataScanner('${esc(h.symbol)}', '${esc(h.nameOfIssuer)}')">AI 차트</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }

        // US 338 Gurus View
        const usData = state.cache.guru.us || {};
        const allGurus = usData.items || [];
        const term = state.guruSearch.trim().toLowerCase();

        const filteredGurus = allGurus.filter(g => {
            if (state.guruStyle !== 'ALL') {
                const cids = (g.category_ids || []).map(String);
                if (!cids.includes(String(state.guruStyle))) return false;
            }
            if (state.guruSize !== 'ALL' && g.sizeTier !== state.guruSize) return false;
            if (term && !String(g.name || '').toLowerCase().includes(term)) return false;
            return true;
        });

        const selectedGuru = allGurus.find(g => g.cik === state.selectedGuruCikUS) || filteredGurus[0] || allGurus[0] || {};
        const holdings = state.dynamicGuruHoldingsUS[selectedGuru.cik]
            || (usData.holdingsSample && usData.holdingsSample[selectedGuru.cik])
            || [];

        return `
            <div class="qh-filter-bar">
                <div class="qh-filter-group">
                    <span class="qh-filter-label">투자 스타일:</span>
                    ${stylePills.map(p => `
                        <button type="button" class="qh-pill ${state.guruStyle === p.id ? 'active' : ''}" data-guru-style="${p.id}">
                            <span class="qh-kbd">${p.kbd}</span> ${esc(p.label)}
                        </button>
                    `).join('')}
                </div>
                <div class="qh-filter-group">
                    <span class="qh-filter-label">자산 규모:</span>
                    ${sizePills.map(p => `
                        <button type="button" class="qh-pill ${state.guruSize === p.id ? 'active' : ''}" data-guru-size="${p.id}">
                            <span class="qh-kbd">${p.kbd}</span> ${esc(p.label)}
                        </button>
                    `).join('')}
                    <input type="text" class="qh-search-input" id="qh-guru-search" placeholder="구루 이름 검색 (예: Warren Buffett, Dalio)..." value="${esc(state.guruSearch)}">
                </div>
            </div>

            <div class="qh-split-layout">
                <!-- 좌측: 구루 카드 목록 -->
                <div class="qh-table-card" style="padding:14px; max-height:700px; overflow-y:auto;">
                    <div style="margin-bottom:10px; font-size:12.5px; color:var(--text-muted);">
                        검색된 월가 구루: <b style="color:var(--text-main);">${filteredGurus.length}명</b> / 전체 338명 (SEC 13F 공시 기준)
                    </div>
                    <div class="qh-guru-grid">
                        ${filteredGurus.slice(0, 90).map(g => `
                            <div class="qh-guru-card ${g.cik === selectedGuru.cik ? 'active' : ''}" data-us-guru-cik="${esc(g.cik)}">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span class="qh-sig-badge qh-sig-guru">${esc((g.categories && g.categories[0]) || 'Guru')}</span>
                                    <span class="qh-kbd">${esc(g.sizeTier)}</span>
                                </div>
                                <div style="font-weight:800; font-size:14.5px;">${esc(g.name)}</div>
                                <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-muted);">
                                    <span>운용규모: <b style="color:#fbbf24;">${fmtUSD(g.aum)}</b></span>
                                    <span>${g.count || 0}종목 (Top10 ${g.top10Pct || 0}%)</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- 우측: 선택된 구루의 SEC 13F 포트폴리오 보유 종목 -->
                <div class="qh-table-card">
                    <div style="padding:14px 16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <span class="qh-badge">SEC 13F PORTFOLIO</span>
                            <h3 style="margin:6px 0 2px 0; font-size:16px;">${esc(selectedGuru.name || '')} (CIK: ${esc(selectedGuru.cik || '')})</h3>
                            <p style="margin:0; font-size:12px; color:var(--text-muted);">
                                운용자산(AUM): <b>${fmtUSD(selectedGuru.aum)}</b> · 보유종목: <b>${selectedGuru.count || 0}개</b> · 기준분기: ${esc(selectedGuru.quarter || '2026-06-30')}
                            </p>
                        </div>
                    </div>
                    <div class="qh-table-scroll" style="max-height:620px; overflow-y:auto;">
                        <table class="qh-table">
                            <thead>
                                <tr>
                                    <th>티커 / 종목명</th>
                                    <th class="right">포트폴리오 비중</th>
                                    <th class="right">보유 평가액 (Value)</th>
                                    <th class="right">보유 주식수 (Shares)</th>
                                    <th class="center">차트 분석</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${holdings.map(h => `
                                    <tr>
                                        <td>
                                            <div style="font-weight:700;">${esc(h.nameOfIssuer)}</div>
                                            <div style="font-size:11.5px; color:var(--text-muted); font-family:monospace;">${esc(h.symbol)}</div>
                                        </td>
                                        <td class="right"><b style="color:#60a5fa;">${Number(h.pct || 0).toFixed(2)}%</b></td>
                                        <td class="right">${fmtUSD(h.value)}</td>
                                        <td class="right">${Number(h.shares || 0).toLocaleString()}주</td>
                                        <td class="center">
                                            ${h.symbol ? `
                                                <button type="button" class="qh-chart-btn" onclick="window.openInDajavataScanner('${esc(h.symbol)}', '${esc(h.nameOfIssuer)}')">AI 차트</button>
                                            ` : '-'}
                                        </td>
                                    </tr>
                                `).join('') || `
                                    <tr>
                                        <td colspan="5" class="center" style="padding:36px;">
                                            <button type="button" class="qh-chart-btn" id="qh-fetch-live-guru-btn" data-cik="${esc(selectedGuru.cik)}" style="padding:8px 16px; font-size:13px;">
                                                <i class="ph-bold ph-cloud-arrow-down"></i> ${esc(selectedGuru.name)} 13F 보유종목 실시간 불러오기
                                            </button>
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // [모듈 8] 머니 플로우 (Money Flow — IPOs, Fed/BOK Rates, M2, MMF, Futures COT)
    // =========================================================================
    function renderMoneyFlowView() {
        const mkt = state.market;
        const mf = state.cache.money_flow || {};
        const krMacro = mf.krMacroSummary || {};
        const ipoYears = mkt === 'KR' ? (mf.krIpoYears || []) : (mf.ipoYears || []);
        const maxIpo = Math.max(...ipoYears.map(y => Number(y.n) || 1), 1);

        const mmfList = mf.mmf || [];
        const latestMmf = mmfList.length ? mmfList[mmfList.length - 1] : ['-', 0];
        const m2List = mf.m2Monthly || [];
        const latestM2 = m2List.length ? m2List[m2List.length - 1] : ['-', 0];
        const tyList = mf.treasuryYields || [];
        const latestTy = tyList.length ? tyList[tyList.length - 1] : ['-', 4.1, 4.2, 4.4];

        const cot = mf.cot || {};
        const cotKeys = [
            { k: 'ES', name: 'S&P 500 E-Mini 선물 (ES)' },
            { k: 'NQ', name: 'Nasdaq 100 E-Mini 선물 (NQ)' },
            { k: 'YM', name: 'Dow Jones E-Mini 선물 (YM)' }
        ];

        return `
            <div class="qh-kpi-grid">
                <div class="qh-kpi-card">
                    <span class="qh-kpi-label">한·미 기준금리 비교</span>
                    <span class="qh-kpi-val">한국 ${esc(krMacro.bokRate || '2.75%')} / 미국 ${esc(krMacro.fedRate || '4.25%')}</span>
                    <span class="qh-kpi-sub">미국채 10년물: ${latestTy[2] || '-'}% · 30년물: ${latestTy[3] || '-'}%</span>
                </div>
                <div class="qh-kpi-card">
                    <span class="qh-kpi-label">${mkt === 'KR' ? '국내 증시 고객예탁금 (대기자금)' : '미국 머니마켓펀드 (MMF 대기자금)'}</span>
                    <span class="qh-kpi-val">${mkt === 'KR' ? esc(krMacro.customerDeposit || '56.8조 원') : `$${Number(latestMmf[1] || 0).toLocaleString()}B`}</span>
                    <span class="qh-kpi-sub">${mkt === 'KR' ? `신용융자 잔고: ${esc(krMacro.creditBalance || '18.4조 원')}` : `기준일: ${esc(latestMmf[0])}`}</span>
                </div>
                <div class="qh-kpi-card">
                    <span class="qh-kpi-label">M2 광의통화 유동성</span>
                    <span class="qh-kpi-val">${mkt === 'KR' ? esc(krMacro.krM2 || '4,125조 원') : `$${Number(latestM2[1] || 0).toLocaleString()}B`}</span>
                    <span class="qh-kpi-sub">시장 장기 상승을 뒷받침하는 핵심 통화량 지표</span>
                </div>
                <div class="qh-kpi-card">
                    <span class="qh-kpi-label">${mkt === 'KR' ? '국내 연간 신규상장(IPO) 추이' : '미국 누적 IPO 상장 (2005~2026)'}</span>
                    <span class="qh-kpi-val">${mkt === 'KR' ? '연평균 113개사' : `${Number(mf.ipoTotal || 5265).toLocaleString()}개사`}</span>
                    <span class="qh-kpi-sub">IPO 급증 구간 = 시장 유동성 과열 시그널</span>
                </div>
            </div>

            <!-- 연도별 IPO 흥행 추이 바 차트 -->
            <div class="qh-table-card" style="padding:16px 20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <span class="qh-badge">ANNUAL IPO CYCLE</span>
                        <strong style="margin-left:8px; font-size:15px;">
                            ${mkt === 'KR' ? '🇰🇷 한국 거래소(KOSPI·KOSDAQ) 연도별 신규 상장(IPO) 기업 수' : '🇺🇸 미국 거래소(NYSE·Nasdaq) 연도별 IPO 추이 (2005–2026)'}
                        </strong>
                    </div>
                    <span style="font-size:12px; color:var(--text-muted);">피크: 2021년 유동성 장세 · 침체: 2008년 금융위기</span>
                </div>
                <div class="qh-bar-chart">
                    ${ipoYears.map(item => {
                        const hPct = Math.max(Math.round((Number(item.n) / maxIpo) * 150), 8);
                        return `
                            <div class="qh-bar-col">
                                <span class="qh-bar-val">${item.n}</span>
                                <div class="qh-bar-fill" style="height:${hPct}px;"></div>
                                <span class="qh-bar-lbl">'${String(item.y).slice(-2)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- CFTC 주가지수 선물 기관 포지셔닝 & 최근 상장 IPO 리스트 -->
            <div class="qh-split-layout">
                <div class="qh-table-card">
                    <div style="padding:13px 16px; border-bottom:1px solid var(--border); font-weight:700;">
                        📊 CFTC 미국 3대 주가지수 선물 기관·헤지펀드 포지셔닝 (COT Report)
                    </div>
                    <div class="qh-table-scroll">
                        <table class="qh-table">
                            <thead>
                                <tr>
                                    <th>선물 지수</th>
                                    <th class="right">기준일</th>
                                    <th class="right">자산운용사 (Asset Mgr)</th>
                                    <th class="right">레버리지 펀드 (Hedge Fund)</th>
                                    <th class="right">미결제약정 (Open Interest)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${cotKeys.map(ck => {
                                    const arr = cot[ck.k] || [];
                                    const last = arr.length ? arr[arr.length - 1] : ['-', 0, 0, 0];
                                    return `
                                        <tr>
                                            <td style="font-weight:700;">${esc(ck.name)}</td>
                                            <td class="right" style="font-family:monospace;">${esc(last[0])}</td>
                                            <td class="right" style="color:#34d399; font-weight:700;">${Number(last[1] || 0).toLocaleString()} 계약</td>
                                            <td class="right" style="color:#60a5fa; font-weight:700;">${Number(last[2] || 0).toLocaleString()} 계약</td>
                                            <td class="right">${Number(last[3] || 0).toLocaleString()} 계약</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="qh-table-card">
                    <div style="padding:13px 16px; border-bottom:1px solid var(--border); font-weight:700;">
                        🚀 최근 신규 상장 주요 IPO 종목 (Latest IPOs)
                    </div>
                    <div class="qh-table-scroll" style="max-height:320px; overflow-y:auto;">
                        <table class="qh-table">
                            <thead>
                                <tr>
                                    <th>상장일</th>
                                    <th>티커 / 기업명</th>
                                    <th class="right">거래소</th>
                                    <th class="center">차트</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(mf.ipoLatest || []).slice(0, 20).map(ip => `
                                    <tr>
                                        <td style="font-family:monospace;">${esc(ip.d || ip.date || '-')}</td>
                                        <td>
                                            <div style="font-weight:700;">${esc(ip.n || ip.name || '')}</div>
                                            <div style="font-size:11px; color:var(--text-muted); font-family:monospace;">${esc(ip.s || ip.symbol || '')}</div>
                                        </td>
                                        <td class="right">${esc(ip.ex || 'NASDAQ')}</td>
                                        <td class="center">
                                            <button type="button" class="qh-chart-btn" onclick="window.openInDajavataScanner('${esc(ip.s || '')}', '${esc(ip.n || '')}')">차트</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    // 메인 컨테이너 렌더링 및 이벤트 바인딩
    async function render() {
        const container = document.getElementById('quant-hub-container');
        if (!container) return;

        if (!state.cache) {
            container.innerHTML = `
                <div style="padding:60px; text-align:center; color:var(--text-muted);">
                    <i class="ph ph-spinner ph-spin" style="font-size:32px; color:#3b82f6;"></i>
                    <p style="margin-top:12px; font-size:14px;">국내주식(KRX) 및 미국주식(US) 8대 퀀트 인텔리전스 데이터를 불러오는 중입니다...</p>
                </div>
            `;
            await ensureDataLoaded();
        }

        if (!state.cache) {
            container.innerHTML = `<div style="padding:40px; text-align:center; color:#ef4444;">데이터를 불러오지 못했습니다. 새로고침 해주세요.</div>`;
            return;
        }

        let bodyHtml = '';
        switch (state.currentTab) {
            case 'quant-rising':
                bodyHtml = renderRisingView();
                break;
            case 'quant-promising':
                bodyHtml = renderPromisingView();
                break;
            case 'quant-market-view':
                bodyHtml = renderMarketView();
                break;
            case 'quant-peer':
                bodyHtml = renderPeerView();
                break;
            case 'quant-etf-finder':
                bodyHtml = renderEtfFinderView();
                break;
            case 'quant-calendar':
                bodyHtml = renderCalendarView();
                break;
            case 'quant-guru':
                bodyHtml = renderGuruView();
                break;
            case 'quant-money-flow':
                bodyHtml = renderMoneyFlowView();
                break;
            default:
                bodyHtml = renderRisingView();
        }

        container.innerHTML = renderTopHeader() + bodyHtml;
        bindEvents(container);
    }

    function bindEvents(container) {
        // 1. KR / US 마켓 토글 버튼
        container.querySelectorAll('.qh-mkt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.market = btn.getAttribute('data-mkt');
                render();
            });
        });

        // 2. 상단 8대 모듈 퀵 탭 전환
        container.querySelectorAll('.qh-mod-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                window.QuantHub.navigate(tabId);
            });
        });

        // 3. Rising Stocks 시그널 필터 & 검색
        container.querySelectorAll('[data-rising-sig]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.risingSignal = btn.getAttribute('data-rising-sig');
                render();
            });
        });
        const risingSearch = container.querySelector('#qh-rising-search');
        if (risingSearch) {
            risingSearch.addEventListener('input', (e) => {
                state.risingSearch = e.target.value;
                render();
                const el = container.querySelector('#qh-rising-search');
                if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
            });
        }

        // 4. Promising Stock Ranking 필터
        container.querySelectorAll('[data-prom-mc]').forEach(btn => {
            btn.addEventListener('click', () => {
                const v = Number(btn.getAttribute('data-prom-mc'));
                if (state.market === 'KR') state.promisingMinMcKR = v;
                else state.promisingMinMcUS = v;
                render();
            });
        });
        container.querySelectorAll('[data-prom-drop]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.promisingMinDrop = Number(btn.getAttribute('data-prom-drop'));
                render();
            });
        });
        container.querySelectorAll('[data-prom-sort]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.promisingSort = btn.getAttribute('data-prom-sort');
                render();
            });
        });
        const promSearch = container.querySelector('#qh-prom-search');
        if (promSearch) {
            promSearch.addEventListener('input', (e) => {
                state.promisingSearch = e.target.value;
                render();
                const el = container.querySelector('#qh-prom-search');
                if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
            });
        }

        // 5. Market View 필터
        container.querySelectorAll('[data-mv-idx]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = btn.getAttribute('data-mv-idx');
                if (state.market === 'KR') state.mvIndexKR = idx;
                else state.mvIndexUS = idx;
                render();
            });
        });
        container.querySelectorAll('[data-mv-sort]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.mvSort = btn.getAttribute('data-mv-sort');
                render();
            });
        });
        const mvSearch = container.querySelector('#qh-mv-search');
        if (mvSearch) {
            mvSearch.addEventListener('input', (e) => {
                state.mvSearch = e.target.value;
                render();
                const el = container.querySelector('#qh-mv-search');
                if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
            });
        }

        // 6. Peer Group 선택
        container.querySelectorAll('[data-peer-idx]').forEach(tr => {
            tr.addEventListener('click', () => {
                state.peerSelectedGroupIdx = Number(tr.getAttribute('data-peer-idx'));
                render();
            });
        });

        // 7. ETF Finder 필터
        container.querySelectorAll('[data-etf-cat]').forEach(btn => {
            btn.addEventListener('click', () => {
                const c = btn.getAttribute('data-etf-cat');
                if (state.market === 'KR') state.etfCategoryKR = c;
                else state.etfCategoryUS = c;
                render();
            });
        });
        const etfSearch = container.querySelector('#qh-etf-search');
        if (etfSearch) {
            etfSearch.addEventListener('input', (e) => {
                state.etfSearch = e.target.value;
                render();
                const el = container.querySelector('#qh-etf-search');
                if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
            });
        }

        // 8. Calendar 이벤트
        container.querySelectorAll('[data-cal-cat]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.calCategory = btn.getAttribute('data-cal-cat');
                state.calSelectedDate = null;
                render();
            });
        });
        container.querySelectorAll('[data-cal-date]').forEach(cell => {
            cell.addEventListener('click', () => {
                const dt = cell.getAttribute('data-cal-date');
                state.calSelectedDate = (state.calSelectedDate === dt) ? null : dt;
                render();
            });
        });
        const calClearBtn = container.querySelector('#qh-cal-clear-date');
        if (calClearBtn) {
            calClearBtn.addEventListener('click', () => {
                state.calSelectedDate = null;
                render();
            });
        }

        // 9. Guru Portfolio 필터 및 구루 선택
        container.querySelectorAll('[data-kr-guru]').forEach(card => {
            card.addEventListener('click', () => {
                state.selectedGuruIdKR = card.getAttribute('data-kr-guru');
                render();
            });
        });
        container.querySelectorAll('[data-guru-style]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.guruStyle = btn.getAttribute('data-guru-style');
                render();
            });
        });
        container.querySelectorAll('[data-guru-size]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.guruSize = btn.getAttribute('data-guru-size');
                render();
            });
        });
        async function fetchGuruHoldingsByCik(cik) {
            const urls = [
                `${API_BASE}/api/quant/guru-holdings?cik=${cik}`,
                `https://goodstock123.com/api/fundamentals/guru-holdings?cik=${cik}`
            ];
            for (const u of urls) {
                try {
                    const r = await fetch(u);
                    if (r.ok) {
                        const d = await r.json();
                        if (d && d.rows && d.rows.length > 0) {
                            state.dynamicGuruHoldingsUS[cik] = d.rows.slice(0, 30);
                            render();
                            return;
                        }
                    }
                } catch (e) {}
            }
        }

        container.querySelectorAll('[data-us-guru-cik]').forEach(card => {
            card.addEventListener('click', async () => {
                const cik = card.getAttribute('data-us-guru-cik');
                state.selectedGuruCikUS = cik;
                render();
                const usData = state.cache.guru.us || {};
                if (!state.dynamicGuruHoldingsUS[cik] && !(usData.holdingsSample && usData.holdingsSample[cik])) {
                    await fetchGuruHoldingsByCik(cik);
                }
            });
        });

        const liveGuruBtn = container.querySelector('#qh-fetch-live-guru-btn');
        if (liveGuruBtn) {
            liveGuruBtn.addEventListener('click', async () => {
                const cik = liveGuruBtn.getAttribute('data-cik');
                liveGuruBtn.textContent = '13F 공시 데이터 불러오는 중...';
                await fetchGuruHoldingsByCik(cik);
            });
        }
        const guruSearch = container.querySelector('#qh-guru-search');
        if (guruSearch) {
            guruSearch.addEventListener('input', (e) => {
                state.guruSearch = e.target.value;
                render();
                const el = container.querySelector('#qh-guru-search');
                if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
            });
        }
    }

    // 외부 노출 인터페이스
    window.QuantHub = {
        get market() { return state.market; },
        set market(val) { state.market = val; },

        navigate(tabAction) {
            state.currentTab = tabAction || 'quant-rising';

            const defaultView = document.getElementById('default-view-container');
            const traderWorkspace = document.getElementById('trader-workspace-container');
            const scannerContainer = document.getElementById('chart-scanner-container');
            const quantHubContainer = document.getElementById('quant-hub-container');

            if (!quantHubContainer) return;

            if (defaultView) defaultView.style.display = 'none';
            if (traderWorkspace) traderWorkspace.style.display = 'none';
            if (scannerContainer) scannerContainer.style.display = 'none';
            quantHubContainer.style.display = 'flex';

            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            const activeLi = document.querySelector(`.menu-section li[data-action="${state.currentTab}"]`);
            if (activeLi) activeLi.classList.add('active');

            render();
        }
    };
})();
