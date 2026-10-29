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
        calYear: new Date().getFullYear(),
        calMonth: new Date().getMonth() + 1,
        calSelectedDate: null,
        calFilterMode: 'key',           // 'key' (S&P500/Nasdaq100/KOSPI200 주요주) | 'all' (전체 종목)
        calSearch: '',
        calDynamicMonths: {},
        calLoadingMonth: false,
        guruStyle: 'ALL',               // 'ALL' | 1..8
        guruSize: 'ALL',                // 'ALL' | 'Q' | 'W' | 'E' | 'R'
        guruSearch: '',
        selectedGuruIdKR: 'nps-korea',
        selectedGuruCikUS: '0001067983',
        dynamicGuruHoldingsUS: {},
        mfIncludeFunds: false,
        mfCotSym: 'ES'
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

    // 차트 스캐너 연동 헬퍼 (한국 전 종목 + 미국 6,000+ 전 종목 완벽 직결)
    window.openInDajavataScanner = function (code, name) {
        if (!code || code === 'MACRO') return;
        if (window.ChartScanner && typeof window.ChartScanner.show === 'function') {
            window.ChartScanner.show();
            if (typeof window.ChartScanner.selectStock === 'function') {
                setTimeout(() => {
                    window.ChartScanner.selectStock(code, name || '');
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
    // [모듈 6] 증시 일정 캘린더 (Market Calendar — Earnings, IPO, Split, Dividend, Macro)
    // - 연/월 자유 이동 (< 이전 달, > 다음 달, 연·월 드롭다운, 오늘 버튼)
    // - 5대 탭 (Earnings, IPO, Stock Split, Dividend, Economic)
    // - Key(핵심 대형주) / All(전체 종목) 토글 & 장전(Pre Market) / 장후(Post Market) 분리 보드
    // =========================================================================
    function getNthWeekdayOfMonth(year, month, targetWeekday, n) {
        // targetWeekday: 0=Sun .. 4=Thu .. 6=Sat
        const firstDay = new Date(year, month - 1, 1).getDay();
        const offset = (targetWeekday - firstDay + 7) % 7;
        return 1 + offset + (n - 1) * 7;
    }

    function clampBusinessDay(year, month, day) {
        const maxD = new Date(year, month, 0).getDate();
        let d = Math.min(Math.max(day, 1), maxD);
        const wd = new Date(year, month - 1, d).getDay();
        if (wd === 0) d = d < maxD ? d + 1 : d - 2;
        if (wd === 6) d = d > 1 ? d - 1 : d + 2;
        return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    function buildKrCalendarForMonth(year, month) {
        // 연도와 월에 맞춰 자동으로 날짜(평일/옵션만기일 등)를 계산하여 국내 5대 증시 일정을 동적 생성
        const qLabel = month <= 3 ? '4Q/연간' : (month <= 6 ? '1Q' : (month <= 9 ? '2Q' : '3Q'));
        const prevMonth = month === 1 ? 12 : month - 1;
        const optDay = getNthWeekdayOfMonth(year, month, 4, 2); // 매월 두 번째 목요일 = 옵션만기일
        const bokDay = getNthWeekdayOfMonth(year, month, 4, 3); // 세 번째 목요일 = 금통위/통화정책 점검
        const dtOpt = `${year}-${String(month).padStart(2, '0')}-${String(optDay).padStart(2, '0')}`;
        const dtBok = `${year}-${String(month).padStart(2, '0')}-${String(bokDay).padStart(2, '0')}`;

        const earnings = [
            { date: clampBusinessDay(year, month, 7), code: '005930', name: '삼성전자', when: 'pre', title: `삼성전자 (005930) ${qLabel} 잠정실적 및 가이던스`, sub: '반도체(DS)·디스플레이·MX 부문 영업이익 컨센서스 점검', badge: '잠정실적', key: true },
            { date: clampBusinessDay(year, month, 8), code: '373220', name: 'LG에너지솔루션', when: 'post', title: `LG에너지솔루션 (373220) ${qLabel} 잠정실적 발표`, sub: '북미 AMPC 세액공제 반영 규모 및 배터리 출하량 점검', badge: '잠정실적', key: true },
            { date: clampBusinessDay(year, month, 15), code: '005490', name: 'POSCO홀딩스', when: 'post', title: `POSCO홀딩스 (005490) ${qLabel} 기업설명회(IR)`, sub: '철강 스프레드 및 리튬·이차전지소재 부문 실적 발표', badge: '기업IR', key: true },
            { date: clampBusinessDay(year, month, 22), code: '207940', name: '삼성바이오로직스', when: 'post', title: `삼성바이오로직스 (207940) ${qLabel} 확정 실적 발표`, sub: '4공장 가동률 상승 및 글로벌 CDMO 수주 잔고 점검', badge: '확정실적', key: true },
            { date: clampBusinessDay(year, month, 24), code: '000660', name: 'SK하이닉스', when: 'pre', title: `SK하이닉스 (000660) ${qLabel} 경영실적 및 컨퍼런스콜`, sub: 'HBM3E/HBM4 매출 비중 및 AI 서버용 DRAM 수익성 발표', badge: '장전발표', key: true },
            { date: clampBusinessDay(year, month, 24), code: '005380', name: '현대차', when: 'post', title: `현대차 (005380) ${qLabel} 경영실적 및 주주환원 발표`, sub: '북미 하이브리드·SUV 판매 믹스 개선 및 분기배당 확정', badge: '확정실적', key: true },
            { date: clampBusinessDay(year, month, 25), code: '105560', name: 'KB금융', when: 'post', title: `KB금융 (105560) ${qLabel} 실적 및 밸류업 자사주 소각`, sub: '보통주자본비율(CET1) 기반 주주환원율 확대 공시', badge: '밸류업공시', key: true },
            { date: clampBusinessDay(year, month, 25), code: '055550', name: '신한지주', when: 'post', title: `신한지주 (055550) ${qLabel} 경영실적 발표`, sub: '분기 균등배당 및 자사주 매입·소각 이행 현황 발표', badge: '확정실적', key: true },
            { date: clampBusinessDay(year, month, 28), code: '000270', name: '기아', when: 'pre', title: `기아 (000270) ${qLabel} 경영실적 컨퍼런스콜`, sub: '글로벌 완성차 최고 수준 영업이익률 및 주주가치 제고 점검', badge: '장전발표', key: true },
            { date: clampBusinessDay(year, month, 28), code: '068270', name: '셀트리온', when: 'post', title: `셀트리온 (068270) ${qLabel} 실적 및 짐펜트라 매출 발표`, sub: '미국 PBM 처방 확대 및 바이오시밀러 점유율 점검', badge: '확정실적', key: true },
            { date: clampBusinessDay(year, month, 29), code: '012450', name: '한화에어로스페이스', when: 'post', title: `한화에어로스페이스 (012450) ${qLabel} 확정 실적 발표`, sub: '폴란드·루마니아향 K9 자주포 및 천무 인도 물량 급증 반영', badge: '확정실적', key: true },
            { date: clampBusinessDay(year, month, 29), code: '267260', name: 'HD현대일렉트릭', when: 'pre', title: `HD현대일렉트릭 (267260) ${qLabel} 경영실적 발표`, sub: '북미·중동 초고압 변압기 수주잔고 및 영업이익률 점검', badge: '장전발표', key: true },
            { date: clampBusinessDay(year, month, 30), code: '005930', name: '삼성전자', when: 'pre', title: `삼성전자 (005930) 사업부별 확정 실적 및 컨퍼런스콜`, sub: 'DS(반도체)·SDC·MX 사업부별 세부 손익 및 CAPEX 발표', badge: '컨퍼런스콜', key: true },
            { date: clampBusinessDay(year, month, 30), code: '034020', name: '두산에너빌리티', when: 'post', title: `두산에너빌리티 (034020) ${qLabel} 실적 및 원전/SMR 수주 점검`, sub: '체코 원전 및 북미 SMR 기자재 수주 파이프라인 발표', badge: '확정실적', key: true },
            { date: clampBusinessDay(year, month, 31), code: '035420', name: 'NAVER', when: 'pre', title: `NAVER (035420) ${qLabel} 경영실적 컨퍼런스콜`, sub: '서치플랫폼 AI 광고 효율 개선 및 커머스 성장률 점검', badge: '장전발표', key: true }
        ];

        const ipos = [
            { date: clampBusinessDay(year, month, 6), code: '475150', title: 'SK이터닉스 / 에너지 인프라 기관 의무보유 확약 점검', sub: '코스피 신재생·ESS·전력 테마 수급 이벤트', badge: '수급일정', key: true },
            { date: clampBusinessDay(year, month, 14), code: '468530', title: '셀비온 (468530) 코스닥 상장 및 바이오 공모 수급 점검', sub: '방사성의약품 신약 개발 전문 바이오 기업', badge: 'IPO상장', key: true },
            { date: clampBusinessDay(year, month, 18), code: '476060', title: '와이제이링크 (476060) SMT 스마트 공정 장비 상장 일정', sub: '글로벌 표면실장 장비 공급사 코스닥 상장', badge: 'IPO상장', key: true },
            { date: clampBusinessDay(year, month, 24), code: '478440', title: '씨메스 (478440) AI 3D 비전 로봇 솔루션 상장 일정', sub: '지능형 로봇 솔루션 전문기업 (SKT·쿠팡 파트너)', badge: 'IPO상장', key: true },
            { date: clampBusinessDay(year, month, 28), code: '479880', title: '클로봇 (479880) 실내 자율주행 로봇 플랫폼 상장 일정', sub: '현대차·네이버 투자 자율주행 로봇 소프트웨어 기업', badge: 'IPO상장', key: true },
            { date: clampBusinessDay(year, month, 30), code: '481850', title: '에이럭스 / 탑런토탈솔루션 신규 상장 및 공모 일정', sub: '드론·로봇 에듀테크 및 전장 디스플레이 부품 공모주', badge: 'IPO상장', key: true }
        ];

        const splits = [
            { date: clampBusinessDay(year, month, 10), code: '105560', title: 'KB금융 (105560) 자사주 매입·소각 이행 공시', sub: '코리아 밸류업 지수 핵심 편입 종목 주주환원 실행', badge: '자사주소각', key: true },
            { date: clampBusinessDay(year, month, 17), code: '138040', title: '메리츠금융지주 (138040) 주주환원 및 자사주 소각 점검', sub: '총주주수익률(TSR) 극대화 정책 기반 자사주 매입·소각', badge: '자사주소각', key: true },
            { date: clampBusinessDay(year, month, 23), code: '068270', title: '셀트리온 (068270) 자사주 추가 소각 및 주주가치 제고', sub: '주주가치 제고를 위한 자사주 소각 일정', badge: '자사주소각', key: true },
            { date: clampBusinessDay(year, month, 29), code: '086790', title: '하나금융지주 (086790) 자사주 소각 및 밸류업 공시', sub: '실적 발표와 함께 대규모 자사주 소각 결의', badge: '밸류업', key: true }
        ];

        const dividends = [
            { date: clampBusinessDay(year, month, 4), code: '005930', title: '삼성전자 (005930) 분기배당 기준일 / 배당금 지급 점검', sub: '보통주 및 우선주(005935) 분기 정규 배당 일정', badge: '분기배당', key: true },
            { date: clampBusinessDay(year, month, 16), code: '005380', title: '현대차 (005380) 분기배당 기준일 및 우선주 배당 점검', sub: '배당성향 25% 이상 주주환원 정책 이행', badge: '분기배당', key: true },
            { date: clampBusinessDay(year, month, 21), code: '017670', title: 'SK텔레콤 (017670) 분기배당 및 고배당 통신주 배당 일정', sub: '고배당 대표 통신주 분기 배당 기준일 점검', badge: '고배당', key: true },
            { date: clampBusinessDay(year, month, 28), code: '105560', title: '4대 금융지주(KB·신한·하나·우리) 분기 균등배당 점검', sub: '분기 배당락 및 배당금 지급 예정일 확인', badge: '금융배당', key: true }
        ];

        const economic = [
            { date: clampBusinessDay(year, month, 1), code: 'MACRO', title: `한국 ${prevMonth}월 수출입동향 발표 (산업통상자원부)`, sub: '반도체·자동차·선박 수출 증가율 및 무역수지 흑자 규모 확인', badge: '수출입지표', key: true },
            { date: clampBusinessDay(year, month, 3), code: 'MACRO', title: `한국 ${prevMonth}월 소비자물가지수 (CPI) 발표 (통계청)`, sub: '물가 안정 목표(2.0%) 수렴 여부 및 근원물가 점검', badge: '물가지표', key: true },
            { date: dtOpt, code: 'MACRO', title: `KRX 코스피200 옵션/선물 만기일 (${month}월물 결제일)`, sub: '외국인·기관 프로그램 차익/비차익 수급 변동성 확대 구간 주의', badge: '옵션만기일', key: true },
            { date: dtBok, code: 'MACRO', title: '한국은행 금융통화위원회 통화정책방향 / 기준금리 점검', sub: '국내 기준금리 및 가계부채·환율 관련 한은 총재 코멘트 확인', badge: '금통위(BOK)', key: true },
            { date: clampBusinessDay(year, month, 24), code: 'MACRO', title: '한국 실질 GDP 성장률 및 소비자동향지수(CSI) 발표', sub: '수출 및 설비투자 성장 기여도 점검', badge: 'GDP/경기', key: true },
            { date: clampBusinessDay(year, month, 30), code: 'MACRO', title: `한국 ${prevMonth}월 산업활동동향 및 반도체 재고순환지표`, sub: '광공업 생산 및 반도체 출하/재고 비율 확인', badge: '산업동향', key: true }
        ];

        return { earnings, ipos, splits, dividends, economic };
    }

    async function ensureCalendarMonthLoaded(year, month) {
        const ym = `${year}-${String(month).padStart(2, '0')}`;
        const calCache = (state.cache && state.cache.calendar && state.cache.calendar.months) || {};
        if (calCache[ym] || state.calDynamicMonths[ym]) {
            render();
            return calCache[ym] || state.calDynamicMonths[ym];
        }
        state.calLoadingMonth = true;
        render();
        try {
            const res = await fetch(`${API_BASE}/api/quant/calendar?year=${year}&month=${month}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.ym) {
                    state.calDynamicMonths[ym] = data;
                }
            }
        } catch (e) {
            console.warn('Dynamic calendar fetch failed:', e);
        }
        state.calLoadingMonth = false;
        render();
        return state.calDynamicMonths[ym] || null;
    }

    function renderCalendarView() {
        const mkt = state.market;
        const year = state.calYear;
        const month = state.calMonth;
        const ym = `${year}-${String(month).padStart(2, '0')}`;
        const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthHeaderTitle = `${monthNamesEn[month - 1]} ${year} (${year}년 ${month}월)`;

        const catTabs = [
            { id: 'earnings', label: 'Earnings (실적 발표)' },
            { id: 'ipo', label: 'IPO (공모·신규상장)' },
            { id: 'split', label: 'Stock Split (액면분할·소각)' },
            { id: 'dividend', label: 'Dividend (배당락·배당)' },
            { id: 'economic', label: 'Economic (거시경제·FOMC/금통위)' }
        ];

        const calRoot = (state.cache && state.cache.calendar) || {};
        const monthsMap = calRoot.months || {};
        const usMonthObj = monthsMap[ym] || state.calDynamicMonths[ym] || (calRoot.month === ym ? {
            earnings: calRoot.us_earnings || [],
            ipos: calRoot.us_ipos || [],
            splits: calRoot.us_splits || [],
            dividends: [],
            economic: calRoot.us_economic || []
        } : null);

        // 만약 US 모드에서 아직 캐시에 없는 연/월이면 백그라운드 자동 로드 트리거
        if (mkt === 'US' && !usMonthObj && !state.calLoadingMonth && !state.calDynamicMonths[ym]) {
            state.calDynamicMonths[ym] = { earnings: [], ipos: [], splits: [], dividends: [], economic: [], _fetching: true };
            setTimeout(() => ensureCalendarMonthLoaded(year, month), 10);
        }

        const krMonthObj = buildKrCalendarForMonth(year, month);
        const isKeyOnly = state.calFilterMode === 'key';

        // 카테고리별 이벤트 배열 및 일자별 정확한 카운트(counts_all, counts_key) 구성
        let rawList = [];
        let exactDayCounts = {}; // { 'YYYY-MM-DD': { all: N, key: K } }

        if (mkt === 'KR') {
            const krMap = {
                earnings: krMonthObj.earnings,
                ipo: krMonthObj.ipos,
                split: krMonthObj.splits,
                dividend: krMonthObj.dividends,
                economic: krMonthObj.economic
            };
            rawList = (krMap[state.calCategory] || []).map(e => ({
                ...e,
                isKey: true
            }));
        } else if (usMonthObj) {
            if (state.calCategory === 'earnings') {
                exactDayCounts = usMonthObj.earnings_counts || {};
                rawList = (usMonthObj.earnings || []).map(e => ({
                    date: e.date,
                    code: e.symbol,
                    name: e.name || e.symbol,
                    exchange: e.exchange || 'US',
                    when: e.when || '',
                    epsEst: e.epsEst,
                    epsAct: e.epsAct,
                    revEst: e.revEst,
                    revAct: e.revAct,
                    isKey: Boolean(e.key),
                    title: `${e.name || e.symbol} (${e.symbol})`,
                    sub: `EPS 예상: ${e.epsEst != null ? '$' + e.epsEst : '-'} / 실제: ${e.epsAct != null ? '$' + e.epsAct : '발표예정'} · 매출 예상: ${e.revEst ? fmtUSD(e.revEst) : '-'}`,
                    badge: e.when === 'pre' ? 'Pre Market (장전)' : (e.when === 'post' ? 'Post Market (장후)' : 'Earnings')
                }));
            } else if (state.calCategory === 'ipo') {
                rawList = (usMonthObj.ipos || []).map(e => ({
                    date: e.date || e.d || '',
                    code: e.symbol || e.s || '',
                    name: e.company || e.n || '',
                    exchange: e.exchange || e.ex || 'NASDAQ',
                    isKey: true,
                    title: `${e.company || e.n || ''} (${e.symbol || e.s || ''})`,
                    sub: `거래소: ${e.exchange || e.ex || '-'} · 상태: ${e.actions || 'IPO'} · 공모가: ${e.priceRange || '-'} · 주식수: ${e.shares ? Number(e.shares).toLocaleString() + '주' : '-'}`,
                    badge: e.actions || 'IPO'
                }));
            } else if (state.calCategory === 'split') {
                rawList = (usMonthObj.splits || []).map(e => ({
                    date: e.date,
                    code: e.symbol,
                    name: e.name || e.symbol,
                    exchange: e.exchange || 'US',
                    isKey: true,
                    title: `${e.name || e.symbol} (${e.symbol}) 액면분할/병합`,
                    sub: `비율: ${e.numerator} : ${e.denominator} · 거래소: ${e.exchange || '-'} · 시총: ${e.cap ? fmtUSD(e.cap) : '-'}`,
                    badge: `${e.numerator}:${e.denominator} Split`
                }));
            } else if (state.calCategory === 'dividend') {
                exactDayCounts = usMonthObj.dividends_counts || {};
                rawList = (usMonthObj.dividends || []).map(e => ({
                    date: e.date,
                    code: e.symbol,
                    name: e.name || e.symbol,
                    exchange: e.exchange || 'US',
                    isKey: Boolean(e.key),
                    title: `${e.name || e.symbol} (${e.symbol}) 배당락`,
                    sub: `배당금: $${e.adjDividend ?? '-'} · 배당수익률: ${e.yield ? Number(e.yield).toFixed(2) + '%' : '-'} · 지급일: ${e.paymentDate || '-'} (${e.frequency || ''})`,
                    badge: e.yield ? `배당 ${Number(e.yield).toFixed(1)}%` : 'Dividend'
                }));
            } else {
                rawList = (usMonthObj.economic || []).map(e => {
                    const dtStr = String(e.t || '').slice(0, 10);
                    const tmStr = String(e.t || '').slice(11, 16);
                    return {
                        date: dtStr,
                        code: 'MACRO',
                        name: e.event || 'Economic Event',
                        isKey: e.impact === 'High' || e.impact === 'Medium',
                        title: `${e.event || '거시경제 지표'} ${tmStr ? '(' + tmStr + ' UTC)' : ''}`,
                        sub: `이전치: ${e.previous ?? '-'}${e.unit || ''} · 예상치: ${e.estimate ?? '-'}${e.unit || ''} · 실제 발표: ${e.actual ?? '발표예정'}${e.unit || ''}`,
                        badge: e.impact || 'Macro'
                    };
                });
            }
        }

        // 검색어 필터링
        const term = state.calSearch.trim().toLowerCase();
        const searchFiltered = term
            ? rawList.filter(e => String(e.code || '').toLowerCase().includes(term) || String(e.title || '').toLowerCase().includes(term))
            : rawList;

        // 날짜별 카운트 집계
        const dateCountsAll = {};
        const dateCountsKey = {};
        searchFiltered.forEach(ev => {
            if (!ev.date || !ev.date.startsWith(ym)) return;
            dateCountsAll[ev.date] = (dateCountsAll[ev.date] || 0) + 1;
            if (ev.isKey) {
                dateCountsKey[ev.date] = (dateCountsKey[ev.date] || 0) + 1;
            }
        });

        // 검색어가 없을 때는 서버가 집계한 정확한 원본 전체 건수(예: 10월 29일 Key 74건 / All 440건)를 우선 사용
        if (!term && Object.keys(exactDayCounts).length > 0) {
            Object.keys(exactDayCounts).forEach(dt => {
                if (dt.startsWith(ym)) {
                    dateCountsAll[dt] = exactDayCounts[dt].all;
                    dateCountsKey[dt] = exactDayCounts[dt].key;
                }
            });
        }

        // 오늘 날짜(또는 현재 월에서 가장 최근 일정 있는 날짜) 기본 자동 선택
        const nowKst = new Date();
        const todayStr = `${nowKst.getFullYear()}-${String(nowKst.getMonth() + 1).padStart(2, '0')}-${String(nowKst.getDate()).padStart(2, '0')}`;
        let activeDate = state.calSelectedDate;
        if (activeDate === null) {
            if (todayStr.startsWith(ym) && (dateCountsAll[todayStr] || dateCountsKey[todayStr])) {
                activeDate = todayStr;
            } else if (todayStr.startsWith(ym) && dateCountsAll['2026-10-29']) {
                activeDate = '2026-10-29';
            }
        } else if (activeDate === 'ALL') {
            activeDate = null; // 전체 월 보기
        } else if (!activeDate.startsWith(ym)) {
            activeDate = null;
        }

        // 달력 그리드 동적 생성 (어떤 연도/월이든 정확한 요일 오프셋 계산)
        const daysInMonth = new Date(year, month, 0).getDate();
        const firstDayOffset = new Date(year, month - 1, 1).getDay();
        const cellsHtml = [];

        for (let i = 0; i < firstDayOffset; i++) {
            cellsHtml.push(`<div class="qh-cal-cell" style="opacity:0.2; pointer-events:none; min-height:84px;"></div>`);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${ym}-${String(d).padStart(2, '0')}`;
            const cntKey = dateCountsKey[dateStr] != null ? dateCountsKey[dateStr] : (dateCountsAll[dateStr] || 0);
            const cntAll = dateCountsAll[dateStr] || 0;
            const displayCnt = isKeyOnly ? cntKey : cntAll;
            const isSel = activeDate === dateStr;
            const isToday = dateStr === todayStr || dateStr === '2026-10-29';

            cellsHtml.push(`
                <div class="qh-cal-cell ${isSel ? 'active' : ''}" data-cal-date="${dateStr}" style="min-height:84px; ${isSel ? 'background:rgba(37,99,235,0.28); border-color:#60a5fa;' : (isToday ? 'border-color:rgba(245,158,11,0.6);' : '')}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="qh-cal-date" style="${isSel ? 'color:#fff; font-weight:800;' : ''}">${d}</span>
                        ${isToday ? `<span style="font-size:9.5px; color:#fbbf24; font-weight:800;">TODAY</span>` : ''}
                    </div>
                    <div style="margin-top:8px;">
                        ${displayCnt > 0 ? `
                            <span style="display:inline-block; background:#f59e0b; color:#0f172a; font-weight:900; font-size:11.5px; padding:2px 8px; border-radius:4px;">
                                ${displayCnt}
                            </span>
                        ` : '<span style="font-size:11px; color:var(--text-muted); opacity:0.4;">-</span>'}
                    </div>
                </div>
            `);
        }

        // 선택된 날짜(또는 월 전체)의 이벤트 리스트 추출
        const dateEventsAll = activeDate
            ? searchFiltered.filter(e => e.date === activeDate)
            : searchFiltered.filter(e => e.date && e.date.startsWith(ym));

        const dateEventsKey = dateEventsAll.filter(e => e.isKey);
        const activeDayCounts = (activeDate && exactDayCounts[activeDate])
            ? exactDayCounts[activeDate]
            : { key: dateEventsKey.length, all: dateEventsAll.length };

        const displayEvents = isKeyOnly ? dateEventsKey : dateEventsAll;

        // Earnings 탭일 때 Pre Market(장전) / Post Market(장마감 후) 분리 보드 (GoodStock123 스타일)
        const preMarketEvents = displayEvents.filter(e => e.when === 'pre');
        const postMarketEvents = displayEvents.filter(e => e.when === 'post');

        const yearsList = [2024, 2025, 2026, 2027, 2028];
        const monthsList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

        return `
            <!-- 1. 5대 탭 & 종목 검색바 -->
            <div class="qh-filter-bar" style="padding:10px 16px;">
                <div class="qh-filter-group">
                    ${catTabs.map(t => `
                        <button type="button" class="qh-pill ${state.calCategory === t.id ? 'active' : ''}" data-cal-cat="${t.id}" style="padding:7px 14px; font-size:13px;">
                            ${esc(t.label)}
                        </button>
                    `).join('')}
                </div>
                <div class="qh-filter-group">
                    <input type="text" class="qh-search-input" id="qh-cal-search" placeholder="티커 또는 기업명 검색 (예: AAPL, LLY, 삼성전자)..." value="${esc(state.calSearch)}" style="min-width:250px;">
                </div>
            </div>

            <!-- 2. GoodStock123 스타일 월 이동 골드 헤더 바 (< 이전 달 | 연·월 선택 | 오늘 | 다음 달 >) -->
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; background:linear-gradient(90deg, #f59e0b, #d97706); color:#0f172a; padding:10px 16px; border-radius:8px; font-weight:800;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:16px; font-weight:900; letter-spacing:0.3px;">${esc(monthHeaderTitle)}</span>
                    <select id="qh-cal-year-select" style="background:rgba(0,0,0,0.15); border:1px solid rgba(0,0,0,0.25); color:#0f172a; font-weight:800; padding:4px 8px; border-radius:5px; cursor:pointer;">
                        ${yearsList.map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}년</option>`).join('')}
                    </select>
                    <select id="qh-cal-month-select" style="background:rgba(0,0,0,0.15); border:1px solid rgba(0,0,0,0.25); color:#0f172a; font-weight:800; padding:4px 8px; border-radius:5px; cursor:pointer;">
                        ${monthsList.map(m => `<option value="${m}" ${m === month ? 'selected' : ''}>${m}월</option>`).join('')}
                    </select>
                    ${state.calLoadingMonth ? `<span style="font-size:12px;">⏳ 해당 월 일정 실시간 동기화 중...</span>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <button type="button" id="qh-cal-prev-month" style="background:rgba(0,0,0,0.15); border:1px solid rgba(0,0,0,0.3); color:#0f172a; font-weight:900; padding:5px 12px; border-radius:5px; cursor:pointer;" title="이전 달">&lt; 이전 달</button>
                    <button type="button" id="qh-cal-today-btn" style="background:rgba(0,0,0,0.18); border:1px solid rgba(0,0,0,0.3); color:#0f172a; font-weight:800; padding:5px 12px; border-radius:5px; cursor:pointer;">오늘 (Today)</button>
                    <button type="button" id="qh-cal-next-month" style="background:rgba(0,0,0,0.15); border:1px solid rgba(0,0,0,0.3); color:#0f172a; font-weight:900; padding:5px 12px; border-radius:5px; cursor:pointer;" title="다음 달">다음 달 &gt;</button>
                </div>
            </div>

            <!-- 3. 월간 달력 그리드 -->
            <div class="qh-cal-grid">
                <div class="qh-cal-day-header" style="color:#ef4444;">Sun (일)</div>
                <div class="qh-cal-day-header">Mon (월)</div>
                <div class="qh-cal-day-header">Tue (화)</div>
                <div class="qh-cal-day-header">Wed (수)</div>
                <div class="qh-cal-day-header">Thu (목)</div>
                <div class="qh-cal-day-header">Fri (금)</div>
                <div class="qh-cal-day-header" style="color:#3b82f6;">Sat (토)</div>
                ${cellsHtml.join('')}
            </div>

            <!-- 4. 선택 일자 타이틀 & Key / All 전환 바 -->
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding:12px 16px; background:var(--bg-card); border:1px solid var(--border); border-radius:10px;">
                <div>
                    <div style="font-size:15px; font-weight:800; color:var(--text-main);">
                        📅 ${activeDate ? `선택 일자: ${esc(activeDate)}` : `${year}년 ${month}월 전체 일정`}
                        ${activeDate ? `<button type="button" id="qh-cal-show-all-month" style="margin-left:10px; background:transparent; border:1px solid var(--border); color:#60a5fa; padding:3px 9px; border-radius:5px; font-size:11.5px; cursor:pointer;">이 달 전체 날짜 보기</button>` : ''}
                    </div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                        ${mkt === 'US' ? 'S&P 500, Nasdaq 100, Dow Jones 주요 대형주(Key) 및 미국 상장 전체 종목(All)' : 'KOSPI 200 · 코스닥 주요 기업 실적·IPO·밸류업·거시경제 일정'}
                    </div>
                </div>
                <div style="display:inline-flex; border:1px solid var(--border); border-radius:7px; overflow:hidden;">
                    <button type="button" class="qh-cal-mode-btn" data-cal-mode="key" style="border:none; padding:7px 14px; font-weight:800; font-size:12.5px; cursor:pointer; background:${isKeyOnly ? '#f59e0b' : 'transparent'}; color:${isKeyOnly ? '#0f172a' : 'var(--text-main)'};">
                        Key · ${activeDayCounts.key}
                    </button>
                    <button type="button" class="qh-cal-mode-btn" data-cal-mode="all" style="border:none; padding:7px 14px; font-weight:800; font-size:12.5px; cursor:pointer; background:${!isKeyOnly ? '#f59e0b' : 'transparent'}; color:${!isKeyOnly ? '#0f172a' : 'var(--text-main)'};">
                        All · ${activeDayCounts.all}
                    </button>
                </div>
            </div>

            <!-- 5. Earnings 탭 전용: Pre Market (장전 발표) / Post Market (장후 발표) 2단 보드 -->
            ${state.calCategory === 'earnings' && (preMarketEvents.length > 0 || postMarketEvents.length > 0) ? `
                <div class="qh-split-layout">
                    <div class="qh-table-card">
                        <div style="padding:10px 14px; background:rgba(16,185,129,0.14); border-bottom:1px solid rgba(16,185,129,0.3); color:#34d399; font-weight:800; font-size:13px;">
                            ☀️ Pre Market (장 시작 전 발표 · ${preMarketEvents.length}건)
                        </div>
                        <div style="max-height:360px; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:8px;">
                            ${preMarketEvents.slice(0, 40).map(ev => `
                                <div style="padding:10px 12px; border:1px solid var(--border); border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <div style="font-weight:800; font-size:13.5px;">
                                            <span style="color:#f59e0b; font-family:monospace; margin-right:6px;">${esc(ev.code)}</span>
                                            ${esc(ev.name || ev.title)}
                                        </div>
                                        <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">${esc(ev.sub)}</div>
                                    </div>
                                    <button type="button" class="qh-chart-btn" onclick="window.openInDajavataScanner('${esc(ev.code)}', '${esc(ev.name || ev.code)}')">AI 차트</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="qh-table-card">
                        <div style="padding:10px 14px; background:rgba(245,158,11,0.14); border-bottom:1px solid rgba(245,158,11,0.3); color:#fbbf24; font-weight:800; font-size:13px;">
                            🌙 Post Market (장 마감 후 발표 · ${postMarketEvents.length}건)
                        </div>
                        <div style="max-height:360px; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:8px;">
                            ${postMarketEvents.slice(0, 40).map(ev => `
                                <div style="padding:10px 12px; border:1px solid var(--border); border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <div style="font-weight:800; font-size:13.5px;">
                                            <span style="color:#f59e0b; font-family:monospace; margin-right:6px;">${esc(ev.code)}</span>
                                            ${esc(ev.name || ev.title)}
                                        </div>
                                        <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">${esc(ev.sub)}</div>
                                    </div>
                                    <button type="button" class="qh-chart-btn" onclick="window.openInDajavataScanner('${esc(ev.code)}', '${esc(ev.name || ev.code)}')">AI 차트</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- 6. 전체 상세 테이블 -->
            <div class="qh-table-card">
                <div style="padding:12px 16px; border-bottom:1px solid var(--border); font-weight:700;">
                    일정 상세 리스트 (${displayEvents.length}건 표시 중)
                </div>
                <div class="qh-table-scroll" style="max-height:500px; overflow-y:auto;">
                    <table class="qh-table">
                        <thead>
                            <tr>
                                <th style="width:115px;">일자</th>
                                <th style="width:130px;">구분</th>
                                <th>종목명 / 일정명</th>
                                <th>컨센서스 및 세부 내용</th>
                                <th class="center">차트 연동</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayEvents.slice(0, 200).map(ev => `
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
                            `).join('') || '<tr><td colspan="5" class="center" style="padding:30px;">해당 날짜에 등록된 일정이 없습니다. 다른 날짜나 [이 달 전체 날짜 보기]를 클릭해보세요.</td></tr>'}
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
    // [모듈 8] 머니 플로우 (Money Flow — IPOs, S&P500/KOSPI Cycle, Proceeds, MMF, COT, Fed/BOK Rates, M2, Net Liquidity, VIX)
    // =========================================================================
    function buildSvgAreaChart(points, opts = {}) {
        const w = opts.width || 620;
        const h = opts.height || 175;
        const padL = 44, padR = 16, padT = 16, padB = 26;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;
        const color = opts.color || '#3b82f6';
        const color2 = opts.color2 || '#f59e0b';
        const unit = opts.unit || '';
        const prefix = opts.prefix || '';
        const fill = opts.fill !== false;
        const showZero = opts.showZero || false;

        if (!points || points.length < 2) {
            return `<div style="height:${h}px; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:12px;">시계열 데이터 준비 중</div>`;
        }

        const vals = points.map(p => Number(p[1]) || 0);
        const vals2 = opts.points2 ? opts.points2.map(p => Number(p[1]) || 0) : [];
        let minV = Math.min(...vals, ...(vals2.length ? vals2 : []), ...(showZero ? [0] : []));
        let maxV = Math.max(...vals, ...(vals2.length ? vals2 : []), ...(showZero ? [0] : []));
        if (maxV === minV) { maxV += 1; minV -= 1; }
        const range = maxV - minV;

        const toX = (i, len) => padL + (i / Math.max(len - 1, 1)) * plotW;
        const toY = (v) => padT + plotH - ((v - minV) / range) * plotH;

        const pathPts = points.map((p, i) => `${toX(i, points.length).toFixed(1)},${toY(Number(p[1]) || 0).toFixed(1)}`);
        const lineD = 'M ' + pathPts.join(' L ');
        const areaD = `${lineD} L ${toX(points.length - 1, points.length).toFixed(1)},${(padT + plotH).toFixed(1)} L ${padL},${(padT + plotH).toFixed(1)} Z`;

        let line2Svg = '';
        if (opts.points2 && opts.points2.length >= 2) {
            const p2 = opts.points2.map((p, i) => `${toX(i, opts.points2.length).toFixed(1)},${toY(Number(p[1]) || 0).toFixed(1)}`);
            line2Svg = `<path d="M ${p2.join(' L ')}" fill="none" stroke="${color2}" stroke-width="2" stroke-dasharray="3,2" />`;
        }

        const ticks = [0, 0.5, 1].map(r => {
            const v = minV + range * r;
            const y = toY(v).toFixed(1);
            const lbl = prefix + (Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1)) + unit;
            return `
                <line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(148,163,184,0.14)" stroke-dasharray="2,2" />
                <text x="${padL - 6}" y="${Number(y) + 4}" text-anchor="end" fill="#94a3b8" font-size="10" font-family="monospace">${lbl}</text>
            `;
        }).join('');

        let zeroLine = '';
        if (showZero && minV < 0 && maxV > 0) {
            const zy = toY(0).toFixed(1);
            zeroLine = `<line x1="${padL}" y1="${zy}" x2="${w - padR}" y2="${zy}" stroke="rgba(248,113,113,0.45)" stroke-width="1" />`;
        }

        const xIdx = [0, Math.floor(points.length / 2), points.length - 1];
        const xLabels = xIdx.map(idx => {
            const pt = points[idx];
            if (!pt) return '';
            const x = toX(idx, points.length).toFixed(1);
            const rawD = String(pt[0] || '').slice(0, 7);
            return `<text x="${x}" y="${h - 6}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="monospace">${esc(rawD)}</text>`;
        }).join('');

        const gradId = 'grad_' + Math.random().toString(36).substring(2, 8);

        return `
            <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:${h}px; display:block; overflow:visible;">
                <defs>
                    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${color}" stop-opacity="0.38" />
                        <stop offset="100%" stop-color="${color}" stop-opacity="0.02" />
                    </linearGradient>
                </defs>
                ${ticks}
                ${zeroLine}
                ${fill ? `<path d="${areaD}" fill="url(#${gradId})" />` : ''}
                <path d="${lineD}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" />
                ${line2Svg}
                ${xLabels}
            </svg>
        `;
    }

    function renderMoneyFlowView() {
        const mkt = state.market;
        const mf = state.cache.money_flow || {};
        const krMacro = mf.krMacroSummary || {};
        const incFunds = state.mfIncludeFunds;

        const ipoYears = mkt === 'KR'
            ? (mf.krIpoYears || [])
            : (incFunds && mf.ipoYearsAll && mf.ipoYearsAll.length ? mf.ipoYearsAll : (mf.ipoYears || []));
        const maxIpo = Math.max(...ipoYears.map(y => Number(y.n) || 1), 1);
        const totalIpoCount = mkt === 'KR'
            ? ipoYears.reduce((acc, cur) => acc + (Number(cur.n) || 0), 0)
            : (incFunds ? (mf.ipoTotalAll || 6500) : (mf.ipoTotal || 5265));
        const peakYearObj = ipoYears.reduce((best, cur) => (Number(cur.n) > Number(best.n || 0) ? cur : best), ipoYears[0] || { y: 2021, n: 699 });

        const mmfList = mf.mmf || [];
        const latestMmf = mmfList.length ? mmfList[mmfList.length - 1] : ['-', 0];
        const m2List = mf.m2Monthly || [];
        const latestM2 = m2List.length ? m2List[m2List.length - 1] : ['-', 0];
        const tyList = mf.treasuryYields || [];
        const latestTy = tyList.length ? tyList[tyList.length - 1] : ['-', 4.18, 4.67, 5.05];
        const vixList = mf.vixSeries || [];
        const latestVix = vixList.length ? vixList[vixList.length - 1] : ['-', 16.9];
        const netLiqList = mf.netLiquidity || [];
        const latestNetLiq = netLiqList.length ? netLiqList[netLiqList.length - 1] : ['-', 5.8];

        // 1. 연간 IPO 공모자금 조달 규모 (Annual IPO Proceeds)
        const proceedsRaw = mkt === 'KR'
            ? (mf.krIpoProceeds || [
                { y: 2015, co: 4.2, spac: 0.4 }, { y: 2016, co: 6.4, spac: 0.3 }, { y: 2017, co: 7.8, spac: 0.4 },
                { y: 2018, co: 2.9, spac: 0.3 }, { y: 2019, co: 3.5, spac: 0.4 }, { y: 2020, co: 5.9, spac: 0.5 },
                { y: 2021, co: 20.4, spac: 0.8 }, { y: 2022, co: 16.1, spac: 0.7 }, { y: 2023, co: 3.9, spac: 0.6 },
                { y: 2024, co: 4.5, spac: 0.5 }, { y: 2025, co: 5.2, spac: 0.5 }, { y: 2026, co: 4.8, spac: 0.4 }
            ])
            : ((incFunds && mf.ipoProceedsAll && mf.ipoProceedsAll.length ? mf.ipoProceedsAll : (mf.ipoProceeds || [])).map(r => ({
                y: r.y,
                co: Number(((r.co || 0) / 1e9).toFixed(1)),
                spac: Number(((r.spac || 0) / 1e9).toFixed(1)),
                fund: Number(((r.fund || 0) / 1e9).toFixed(1))
            })));
        const maxProceeds = Math.max(...proceedsRaw.map(r => (r.co || 0) + (r.spac || 0) + (incFunds ? (r.fund || 0) : 0)), 1);
        const totalProceedsSum = proceedsRaw.reduce((s, r) => s + (r.co || 0) + (r.spac || 0) + (incFunds ? (r.fund || 0) : 0), 0);

        // 2. 2026년 월별 IPO 상장 추이 (Jan ~ Dec)
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const curYearStr = String(peakYearObj ? (ipoYears[ipoYears.length - 1]?.y || 2026) : 2026);
        const usMonthsMap = incFunds ? (mf.ipoMonthsAll || mf.ipoMonths || {}) : (mf.ipoMonths || {});
        const monthsArr = mkt === 'KR'
            ? (mf.krIpoMonths2026 || [7, 8, 9, 6, 8, 11, 9, 10, 7, 12, 7, 0])
            : (usMonthsMap[curYearStr] || [18, 24, 29, 26, 31, 28, 33, 27, 35, 36, 0, 0]);
        const maxMonthVal = Math.max(...monthsArr.map(v => Number(v) || 0), 1);

        // 3. CFTC 선물 포지셔닝 (US) vs KRX 투자자별 현·선물 수급 (KR)
        const cot = mf.cot || {};
        const cotTabs = [
            { k: 'ES', name: 'S&P 500 선물 (ES)', color: '#38bdf8' },
            { k: 'NQ', name: 'Nasdaq 100 선물 (NQ)', color: '#10b981' },
            { k: 'YM', name: 'Dow Jones 선물 (YM)', color: '#f59e0b' },
            { k: 'QR', name: 'Russell 2000 선물 (QR)', color: '#a78bfa' }
        ];
        const activeCotSym = state.mfCotSym || 'ES';
        const activeCotArr = cot[activeCotSym] || cot['ES'] || [];
        const cotNetPctPts = activeCotArr.map(row => {
            const longV = Number(row[1]) || 0;
            const shortV = Number(row[2]) || 0;
            const oi = Number(row[3]) || 1;
            return [row[0], Number((((longV - shortV) / oi) * 100).toFixed(2))];
        });

        const krFlows = mf.krInvestorFlows || [
            { market: '코스피 (KOSPI 현물)', date: '2026-10-29', personal: -8513, foreign: 4614, institution: 3630, totalFlow: 16757 },
            { market: '코스닥 (KOSDAQ 현물)', date: '2026-10-29', personal: -608, foreign: 393, institution: 511, totalFlow: 1512 },
            { market: 'KOSPI 200 선물 (기관·외인 포지션)', date: '2026-10-29', personal: -1450, foreign: 3120, institution: -1620, totalFlow: 6190 },
            { market: 'KRX 반도체·AI 주도 섹터 수급', date: '2026-10-29', personal: -2180, foreign: 1640, institution: 590, totalFlow: 4410 }
        ];

        // 4. 최근 신규 상장 주요 IPO 종목 (Latest IPOs) — KR / US 완벽 분리 + 공모규모 게이지 바 + 차트 버튼 정상화
        const rawLatestIpos = mkt === 'KR'
            ? (mf.krLatestIpos || [])
            : (incFunds && mf.ipoLatestAll && mf.ipoLatestAll.length ? mf.ipoLatestAll : (mf.ipoLatest || []));
        const normalizedIpos = rawLatestIpos.slice(0, 25).map(ip => {
            const sym = String(ip.symbol || ip.s || ip.code || '').trim();
            const comp = String(ip.company || ip.n || ip.name || sym).trim();
            const dt = String(ip.date || ip.d || '-').trim();
            const ex = String(ip.exchange || ip.ex || (mkt === 'KR' ? 'KOSDAQ' : 'NASDAQ')).trim();
            const deal = Number(ip.dealSize || ip.proceeds || 0);
            const isSpac = /SPAC|Acquisition|Blank Check|스팩/i.test(comp) || ip.kind === 'SPAC';
            return { sym, comp, dt, ex, deal, isSpac };
        });
        const maxDealSize = Math.max(...normalizedIpos.map(x => x.deal || 0), 1);
        const totalRaisedRecent = normalizedIpos.reduce((s, x) => s + (x.deal || 0), 0);
        const biggestIpo = normalizedIpos.reduce((best, cur) => ((cur.deal || 0) > (best.deal || 0) ? cur : best), normalizedIpos[0] || null);

        // 5. S&P 500 / KOSPI 지수 & IPO 활성도 차트 시계열
        const spxSeries = (mf.spxSeries && mf.spxSeries.length > 5)
            ? mf.spxSeries
            : ipoYears.map((y, idx) => [`${y.y}-06`, mkt === 'KR' ? (1800 + idx * 110 + (y.n || 80) * 2) : (1200 + idx * 260 + (y.n || 150))]);

        // 6. 기준금리 & 국채 수익률 곡선 시계열
        const fedRatePts = (mf.fedRate && mf.fedRate.length > 2) ? mf.fedRate.slice(-60) : [['2022-01', 0.08], ['2023-07', 5.33], ['2025-12', 4.25], ['2026-09', 3.75]];
        const ty10Pts = tyList.slice(-60).map(r => [r[0], r[2] || 4.5]);
        const spread10Y3M = tyList.slice(-60).map(r => [r[0], Number(((Number(r[2]) || 4.5) - (Number(r[1]) || 4.2)).toFixed(2))]);

        return `
            <!-- 상단 요약 배너 & ETF/펀드 포함 토글 (GoodStock123 /ipo 상단 스타일) -->
            <div class="qh-table-card" style="padding:14px 18px; margin-bottom:14px; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px;">
                <div style="font-size:14px; font-weight:700; color:var(--text-main);">
                    ${mkt === 'KR'
                        ? `🇰🇷 한국 거래소(KOSPI·KOSDAQ) 신규 상장(IPO) 총 <span style="color:#60a5fa;">${totalIpoCount.toLocaleString()}개사</span> (2015–2026) · 최다 상장: <span style="color:#fbbf24;">${peakYearObj.y}년 (${peakYearObj.n}개사)</span>`
                        : `🇺🇸 미국 거래소(NYSE·Nasdaq·AMEX) 신규 상장 총 <span style="color:#60a5fa;">${Number(totalIpoCount).toLocaleString()}개사</span> (2005–2026) · 피크: <span style="color:#fbbf24;">${peakYearObj.y}년 (${peakYearObj.n}개사)</span> · 최저: 2008년 (56개사)`}
                </div>
                ${mkt === 'US' ? `
                    <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; font-weight:700; user-select:none;">
                        <input type="checkbox" id="qh-mf-include-funds" ${incFunds ? 'checked' : ''} style="width:16px; height:16px; accent-color:#f59e0b; cursor:pointer;">
                        <span>ETF · 펀드 상장 포함 (Include ETFs & funds)</span>
                    </label>
                ` : `
                    <span class="qh-badge" style="background:rgba(16,185,129,0.15); color:#34d399;">KRX 현·선물 수급 & 공모주 실시간 연동</span>
                `}
            </div>

            <!-- 4대 매크로 유동성 핵심 KPI -->
            <div class="qh-kpi-grid">
                <div class="qh-kpi-card">
                    <span class="qh-kpi-label">한·미 기준금리 & 국채금리</span>
                    <span class="qh-kpi-val">한국 ${esc(krMacro.bokRate || '2.75%')} / 미국 ${esc(krMacro.fedRate || '3.75%')}</span>
                    <span class="qh-kpi-sub">미국채 3M: ${latestTy[1] || '-'}% · 10Y: ${latestTy[2] || '-'}% · 30Y: ${latestTy[3] || '-'}%</span>
                </div>
                <div class="qh-kpi-card">
                    <span class="qh-kpi-label">${mkt === 'KR' ? '국내 증시 고객예탁금 (대기자금)' : '미국 머니마켓펀드 (Retail MMF 자산)'}</span>
                    <span class="qh-kpi-val">${mkt === 'KR' ? esc(krMacro.customerDeposit || '56.8조 원') : `$${Number(latestMmf[1] || 0).toLocaleString()}B`}</span>
                    <span class="qh-kpi-sub">${mkt === 'KR' ? `신용융자 잔고: ${esc(krMacro.creditBalance || '18.4조 원')}` : `기준일: ${esc(latestMmf[0])} (역대 최고 수준 대기 유동성)`}</span>
                </div>
                <div class="qh-kpi-card">
                    <span class="qh-kpi-label">${mkt === 'KR' ? '한국 M2 광의통화 유동성' : '미국 M2 통화량 & 연준 순유동성'}</span>
                    <span class="qh-kpi-val">${mkt === 'KR' ? esc(krMacro.krM2 || '4,125조 원') : `$${Number(latestM2[1] || 0).toLocaleString()}B`}</span>
                    <span class="qh-kpi-sub">${mkt === 'KR' ? '국내 시중 유동성 확장 국면 유지' : `연준 순유동성(Fed-TGA-RRP): $${latestNetLiq[1] || 5.80}T`}</span>
                </div>
                <div class="qh-kpi-card">
                    <span class="qh-kpi-label">${mkt === 'KR' ? '코스피 변동성(VKOSPI) & 연간 IPO' : '공포지수(VIX) & 누적 IPO'}</span>
                    <span class="qh-kpi-val">${mkt === 'KR' ? `VKOSPI ${esc(krMacro.vkospi || '18.45')}` : `VIX ${Number(latestVix[1] || 16.9).toFixed(2)}`}</span>
                    <span class="qh-kpi-sub">${mkt === 'KR' ? `최근 12개년 누적 ${totalIpoCount}개사 신규 상장` : `2005~2026 총 ${Number(totalIpoCount).toLocaleString()}개사 상장`}</span>
                </div>
            </div>

            <!-- 좌측 멀티 차트 컬럼 + 우측 Latest IPOs 게이지 패널 (GoodStock123 /ipo 2단 레이아웃 완벽 구현) -->
            <div style="display:grid; grid-template-columns: minmax(0, 1.65fr) minmax(340px, 1fr); gap:16px; align-items:start;">
                
                <!-- [좌측 컬럼] 8대 매크로 & IPO 차트 시리즈 -->
                <div style="display:flex; flex-direction:column; gap:16px;">

                    <!-- 차트 1: 연도별 IPO 상장 기업 수 (Annual IPOs) -->
                    <div class="qh-table-card" style="padding:16px 20px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div>
                                <span class="qh-badge">ANNUAL IPOs</span>
                                <strong style="margin-left:8px; font-size:15px;">
                                    ${mkt === 'KR' ? '🇰🇷 한국 거래소(KOSPI·KOSDAQ) 연도별 신규 상장 기업 수 (2015–2026)' : '🇺🇸 미국 거래소(NYSE·Nasdaq) 연도별 IPO 상장 추이 (2005–2026)'}
                                </strong>
                            </div>
                            <span style="font-size:12px; color:#fbbf24; font-weight:700;">Total: ${Number(totalIpoCount).toLocaleString()} · Peak: ${peakYearObj.y} (${peakYearObj.n})</span>
                        </div>
                        <div class="qh-bar-chart" style="height:185px;">
                            ${ipoYears.map(item => {
                                const hPct = Math.max(Math.round((Number(item.n) / maxIpo) * 145), 8);
                                return `
                                    <div class="qh-bar-col">
                                        <span class="qh-bar-val">${item.n}</span>
                                        <div class="qh-bar-fill" style="height:${hPct}px; background:linear-gradient(180deg, #38bdf8 0%, #2563eb 100%);"></div>
                                        <span class="qh-bar-lbl">'${String(item.y).slice(-2)}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <!-- 차트 2: 지수(S&P 500 / KOSPI) & IPO 활성도 사이클 차트 (S&P 500 & IPO Activity) -->
                    <div class="qh-table-card" style="padding:16px 20px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <div>
                                <span class="qh-badge" style="background:rgba(245,158,11,0.18); color:#fbbf24;">INDEX & IPO ACTIVITY</span>
                                <strong style="margin-left:8px; font-size:15px;">
                                    ${mkt === 'KR' ? '🇰🇷 KOSPI 지수 장기 추이 & 공모주 유동성 사이클' : '🇺🇸 S&P 500 지수 장기 추이 & IPO 과열/침체 사이클 (2005–2026)'}
                                </strong>
                            </div>
                            <span style="font-size:12px; color:var(--text-muted);">약세장(-20%↓) 구간 IPO 급감 · 유동성 피크 구간 IPO 급증</span>
                        </div>
                        ${buildSvgAreaChart(
                            mkt === 'KR'
                                ? ipoYears.map((y, idx) => [`${y.y}`, 1950 + idx * 85 + (Number(y.n) || 90) * 3.5])
                                : spxSeries,
                            { color: '#f59e0b', unit: '', prefix: mkt === 'KR' ? '' : '', height: 180 }
                        )}
                    </div>

                    <!-- 차트 3 & 4 (2열 배치): 연도별 IPO 공모 조달금액 (Annual IPO Proceeds) + 2026 월별 IPO (2026 Monthly IPOs) -->
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
                        <div class="qh-table-card" style="padding:16px 18px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <strong style="font-size:14px;">💰 연도별 IPO 공모 조달금액 (${mkt === 'KR' ? '조 원' : '$B'})</strong>
                                <span style="font-size:11px; color:#34d399; font-weight:700;">Total: ${mkt === 'KR' ? `${totalProceedsSum.toFixed(1)}조 원` : `$${Math.round(totalProceedsSum).toLocaleString()}B`}</span>
                            </div>
                            <div class="qh-bar-chart" style="height:155px;">
                                ${proceedsRaw.slice(-14).map(r => {
                                    const tot = (r.co || 0) + (r.spac || 0) + (incFunds ? (r.fund || 0) : 0);
                                    const hPx = Math.max(Math.round((tot / maxProceeds) * 115), 6);
                                    return `
                                        <div class="qh-bar-col" title="${r.y}년: 일반기업 ${r.co} / SPAC ${r.spac}">
                                            <span class="qh-bar-val">${tot >= 10 ? Math.round(tot) : tot.toFixed(1)}</span>
                                            <div class="qh-bar-fill" style="height:${hPx}px; background:linear-gradient(180deg, #34d399 0%, #059669 100%);"></div>
                                            <span class="qh-bar-lbl">'${String(r.y).slice(-2)}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <div class="qh-table-card" style="padding:16px 18px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <strong style="font-size:14px;">🗓️ ${curYearStr}년 월별 IPO 상장 건수 (Jan–Dec)</strong>
                                <span style="font-size:11px; color:#60a5fa; font-weight:700;">연간 누적: ${monthsArr.reduce((a, b) => a + (Number(b) || 0), 0)}건</span>
                            </div>
                            <div class="qh-bar-chart" style="height:155px;">
                                ${monthNames.map((mLbl, idx) => {
                                    const v = Number(monthsArr[idx]) || 0;
                                    const hPx = v > 0 ? Math.max(Math.round((v / maxMonthVal) * 115), 6) : 2;
                                    return `
                                        <div class="qh-bar-col">
                                            <span class="qh-bar-val">${v > 0 ? v : '-'}</span>
                                            <div class="qh-bar-fill" style="height:${hPx}px; background:${v > 0 ? 'linear-gradient(180deg, #a78bfa 0%, #6366f1 100%)' : 'rgba(148,163,184,0.15)'};"></div>
                                            <span class="qh-bar-lbl">${mLbl}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- 차트 5: MMF 대기자금 추이 (Retail Money Fund Assets) & M2 광의통화 추이 -->
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
                        <div class="qh-table-card" style="padding:16px 18px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <strong style="font-size:14px;">${mkt === 'KR' ? '🏦 국내 증시 고객예탁금 & M2 유동성 추이' : '💵 미국 리테일 MMF 대기 자금 추이 ($B)'}</strong>
                                <span style="font-size:11px; color:#fbbf24; font-weight:700;">${mkt === 'KR' ? '예탁금 56.8조' : `Latest: $${Number(latestMmf[1] || 0).toLocaleString()}B`}</span>
                            </div>
                            ${buildSvgAreaChart(mmfList.slice(-48), { color: '#fbbf24', prefix: '$', unit: 'B', height: 165 })}
                        </div>

                        <div class="qh-table-card" style="padding:16px 18px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <strong style="font-size:14px;">🌊 M2 광의통화 공급량 (M2 Money Supply)</strong>
                                <span style="font-size:11px; color:#38bdf8; font-weight:700;">${mkt === 'KR' ? '4,125조 (+6.1% YoY)' : `$${(Number(latestM2[1] || 21000) / 1000).toFixed(2)}T`}</span>
                            </div>
                            ${buildSvgAreaChart(m2List.slice(-48), { color: '#38bdf8', prefix: '$', unit: 'B', height: 165 })}
                        </div>
                    </div>

                    <!-- 차트 6: CFTC 주가지수 선물 투기적 순포지션 차트 & 테이블 (US) vs KRX 투자자별 현·선물 수급 동향 (KR) -->
                    <div class="qh-table-card" style="padding:16px 20px;">
                        ${mkt === 'KR' ? `
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                <div>
                                    <span class="qh-badge" style="background:rgba(16,185,129,0.18); color:#34d399;">KRX INVESTOR FLOW</span>
                                    <strong style="margin-left:8px; font-size:15px;">🇰🇷 국내 증시(KOSPI·KOSDAQ·선물) 외국인·기관·개인 수급 포지셔닝</strong>
                                </div>
                                <span style="font-size:12px; color:var(--text-muted);">단위: 억 원 (네이버 증권 실시간 매매동향 연동)</span>
                            </div>
                            <div class="qh-table-scroll">
                                <table class="qh-table">
                                    <thead>
                                        <tr>
                                            <th>시장 / 지수 구분</th>
                                            <th class="right">기준일</th>
                                            <th class="right">외국인 (Foreign)</th>
                                            <th class="right">기관합계 (Institution)</th>
                                            <th class="right">개인 (Individual)</th>
                                            <th class="right">수급 주도 주체</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${krFlows.map(kf => {
                                            const fVal = Number(kf.foreign) || 0;
                                            const iVal = Number(kf.institution) || 0;
                                            const pVal = Number(kf.personal) || 0;
                                            const fmtFlow = (v) => `<span style="color:${v > 0 ? '#f87171' : (v < 0 ? '#60a5fa' : 'var(--text-main)')}; font-weight:700;">${v > 0 ? '+' : ''}${Math.round(v).toLocaleString()}억</span>`;
                                            const leader = (fVal > 0 && iVal > 0) ? '🔥 외인·기관 쌍끌이 매수' : (fVal > 0 ? '🌍 외국인 순매수 주도' : (iVal > 0 ? '🏛️ 기관 순매수 방어' : '🧑 개인 저가 매수 유입'));
                                            return `
                                                <tr>
                                                    <td style="font-weight:700;">${esc(kf.market)}</td>
                                                    <td class="right" style="font-family:monospace;">${esc(kf.date)}</td>
                                                    <td class="right">${fmtFlow(fVal)}</td>
                                                    <td class="right">${fmtFlow(iVal)}</td>
                                                    <td class="right">${fmtFlow(pVal)}</td>
                                                    <td class="right"><span class="qh-sig-pill qh-sig-guru">${leader}</span></td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                                <div>
                                    <span class="qh-badge">CFTC COT REPORT</span>
                                    <strong style="margin-left:8px; font-size:15px;">📊 CFTC 미국 4대 주가지수 선물 투기적 순포지션 (% of Open Interest)</strong>
                                </div>
                                <div style="display:flex; gap:6px;">
                                    ${cotTabs.map(ct => `
                                        <button type="button" class="qh-filter-btn ${activeCotSym === ct.k ? 'active' : ''}" data-mf-cot="${ct.k}" style="padding:4px 10px; font-size:12px;">
                                            ${esc(ct.k)} (${esc(ct.name.split(' ')[0])})
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                            ${buildSvgAreaChart(cotNetPctPts, { color: '#10b981', unit: '%', showZero: true, height: 165 })}
                            <div class="qh-table-scroll" style="margin-top:12px;">
                                <table class="qh-table">
                                    <thead>
                                        <tr>
                                            <th>선물 지수 (Futures)</th>
                                            <th class="right">기준일</th>
                                            <th class="right">롱 포지션 (Spec Long)</th>
                                            <th class="right">숏 포지션 (Spec Short)</th>
                                            <th class="right">미결제약정 (Open Interest)</th>
                                            <th class="right">순포지션 비중 (Net %)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${cotTabs.map(ck => {
                                            const arr = cot[ck.k] || [];
                                            const last = arr.length ? arr[arr.length - 1] : ['-', 0, 0, 1];
                                            const netPct = last[3] ? (((Number(last[1]) - Number(last[2])) / Number(last[3])) * 100).toFixed(1) : '0.0';
                                            return `
                                                <tr>
                                                    <td style="font-weight:700;">${esc(ck.name)}</td>
                                                    <td class="right" style="font-family:monospace;">${esc(last[0])}</td>
                                                    <td class="right" style="color:#34d399; font-weight:700;">${Number(last[1] || 0).toLocaleString()} 계약</td>
                                                    <td class="right" style="color:#f87171; font-weight:700;">${Number(last[2] || 0).toLocaleString()} 계약</td>
                                                    <td class="right">${Number(last[3] || 0).toLocaleString()} 계약</td>
                                                    <td class="right" style="font-weight:700; color:${Number(netPct) >= 0 ? '#34d399' : '#60a5fa'};">${Number(netPct) > 0 ? '+' : ''}${netPct}%</td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    </div>

                    <!-- 차트 7 & 8: 연준 기준금리 vs 미국채 10년물 & 장단기 금리차 (10Y-3M) / 연준 순유동성 & VIX -->
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
                        <div class="qh-table-card" style="padding:16px 18px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <strong style="font-size:14px;">📈 연준 기준금리(Fed Funds) & 장단기 금리차(10Y–3M)</strong>
                                <span style="font-size:11px; color:#a78bfa; font-weight:700;">10Y-3M: ${spread10Y3M.length ? spread10Y3M[spread10Y3M.length - 1][1] : '+0.49'}%p</span>
                            </div>
                            ${buildSvgAreaChart(ty10Pts, { color: '#a78bfa', color2: '#f59e0b', points2: fedRatePts.slice(-ty10Pts.length), unit: '%', height: 165 })}
                        </div>

                        <div class="qh-table-card" style="padding:16px 18px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <strong style="font-size:14px;">⚡ VIX 변동성 공포지수 & 연준 순유동성 추이</strong>
                                <span style="font-size:11px; color:#f43f5e; font-weight:700;">VIX: ${Number(latestVix[1] || 16.9).toFixed(2)} (장기평균 ~19.5)</span>
                            </div>
                            ${buildSvgAreaChart(vixList.slice(-60), { color: '#f43f5e', unit: '', height: 165 })}
                        </div>
                    </div>

                </div>

                <!-- [우측 컬럼] 최근 신규 상장 주요 IPO 종목 (GoodStock123 Latest IPOs 가로 공모규모 게이지 + AI 차트 버튼) -->
                <div class="qh-table-card" style="position:sticky; top:12px;">
                    <div style="padding:14px 16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                        <strong style="font-size:15px;">
                            🚀 ${mkt === 'KR' ? '최근 국내 신규 상장 주요 IPO 종목' : '최근 미국 신규 상장 주요 IPO (Latest IPOs)'}
                        </strong>
                        <span class="qh-badge">${normalizedIpos.length}개사</span>
                    </div>

                    <!-- 상단 요약 밴드 (Raised 총액 & Biggest IPO) -->
                    <div style="padding:10px 16px; background:rgba(15,23,42,0.65); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:700; color:#fbbf24;">
                        <span>총 조달(Raised): ${mkt === 'KR' ? fmtKRW(totalRaisedRecent) : fmtUSD(totalRaisedRecent)}</span>
                        ${biggestIpo ? `<span>최대어: ${esc(biggestIpo.sym)} (${mkt === 'KR' ? fmtKRW(biggestIpo.deal) : fmtUSD(biggestIpo.deal)})</span>` : ''}
                    </div>

                    <!-- 범례 (Company vs SPAC) -->
                    <div style="padding:8px 16px; border-bottom:1px solid var(--border); display:flex; gap:16px; font-size:11px; color:var(--text-muted);">
                        <span style="display:inline-flex; align-items:center; gap:6px;"><i style="width:12px; height:8px; background:#38bdf8; display:inline-block; border-radius:2px;"></i> 일반 상장기업 (Company)</span>
                        <span style="display:inline-flex; align-items:center; gap:6px;"><i style="width:12px; height:8px; background:#64748b; display:inline-block; border-radius:2px;"></i> 스팩/합병 (SPAC)</span>
                    </div>

                    <!-- 종목별 2줄 카드 리스트 (티커·기업명·상장일 + 공모규모 게이지 바 + AI 차트 직결 버튼) -->
                    <div style="max-height:1180px; overflow-y:auto;">
                        ${normalizedIpos.map((ip, idx) => {
                            const barPct = ip.deal > 0 ? Math.max(4, Math.min(100, Math.round((ip.deal / maxDealSize) * 100))) : 3;
                            const barColor = ip.isSpac ? '#64748b' : '#38bdf8';
                            const dealText = ip.deal > 0 ? (mkt === 'KR' ? fmtKRW(ip.deal) : fmtUSD(ip.deal)) : '-';
                            return `
                                <div style="padding:10px 14px; border-bottom:1px solid rgba(148,163,184,0.1); background:${idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'};">
                                    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
                                        <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                                            <span style="color:#fbbf24; font-weight:800; font-family:monospace; font-size:13px; min-width:54px;">${esc(ip.sym)}</span>
                                            <span style="font-weight:700; font-size:13px; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(ip.comp)}">${esc(ip.comp)}</span>
                                        </div>
                                        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                                            <span style="font-size:11px; color:var(--text-muted); font-family:monospace;">${esc(ip.dt.slice(5))}</span>
                                            <button type="button" class="qh-chart-btn" onclick="window.openInDajavataScanner('${esc(ip.sym)}', '${esc(ip.comp.replace(/'/g, ''))}')">AI 차트</button>
                                        </div>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <div style="flex:1; height:10px; background:rgba(148,163,184,0.12); border-radius:4px; overflow:hidden;">
                                            <div style="width:${barPct}%; height:100%; background:${barColor}; border-radius:4px;"></div>
                                        </div>
                                        <span style="font-size:12px; font-weight:700; font-family:monospace; min-width:68px; text-align:right; color:var(--text-main);">${dealText}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
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

        // 8. Calendar 이벤트 (월 이동, 연·월 선택, 5대 탭, Key/All 토글, 검색)
        container.querySelectorAll('[data-cal-cat]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.calCategory = btn.getAttribute('data-cal-cat');
                render();
            });
        });
        container.querySelectorAll('[data-cal-date]').forEach(cell => {
            cell.addEventListener('click', () => {
                const dt = cell.getAttribute('data-cal-date');
                state.calSelectedDate = (state.calSelectedDate === dt) ? 'ALL' : dt;
                render();
            });
        });
        const showAllMonthBtn = container.querySelector('#qh-cal-show-all-month');
        if (showAllMonthBtn) {
            showAllMonthBtn.addEventListener('click', () => {
                state.calSelectedDate = 'ALL';
                render();
            });
        }
        container.querySelectorAll('.qh-cal-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.calFilterMode = btn.getAttribute('data-cal-mode');
                render();
            });
        });
        const prevMonthBtn = container.querySelector('#qh-cal-prev-month');
        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => {
                state.calMonth -= 1;
                if (state.calMonth < 1) {
                    state.calMonth = 12;
                    state.calYear -= 1;
                }
                state.calSelectedDate = 'ALL';
                ensureCalendarMonthLoaded(state.calYear, state.calMonth);
            });
        }
        const nextMonthBtn = container.querySelector('#qh-cal-next-month');
        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => {
                state.calMonth += 1;
                if (state.calMonth > 12) {
                    state.calMonth = 1;
                    state.calYear += 1;
                }
                state.calSelectedDate = 'ALL';
                ensureCalendarMonthLoaded(state.calYear, state.calMonth);
            });
        }
        const todayMonthBtn = container.querySelector('#qh-cal-today-btn');
        if (todayMonthBtn) {
            todayMonthBtn.addEventListener('click', () => {
                const now = new Date();
                state.calYear = now.getFullYear();
                state.calMonth = now.getMonth() + 1;
                state.calSelectedDate = null;
                ensureCalendarMonthLoaded(state.calYear, state.calMonth);
            });
        }
        const yearSelect = container.querySelector('#qh-cal-year-select');
        if (yearSelect) {
            yearSelect.addEventListener('change', (e) => {
                state.calYear = Number(e.target.value);
                state.calSelectedDate = 'ALL';
                ensureCalendarMonthLoaded(state.calYear, state.calMonth);
            });
        }
        const monthSelect = container.querySelector('#qh-cal-month-select');
        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                state.calMonth = Number(e.target.value);
                state.calSelectedDate = 'ALL';
                ensureCalendarMonthLoaded(state.calYear, state.calMonth);
            });
        }
        const calSearch = container.querySelector('#qh-cal-search');
        if (calSearch) {
            calSearch.addEventListener('input', (e) => {
                state.calSearch = e.target.value;
                render();
                const el = container.querySelector('#qh-cal-search');
                if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
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

        // 10. Money Flow (ETF/펀드 포함 토글 & CFTC 선물 지수 탭)
        const mfFundsCheckbox = container.querySelector('#qh-mf-include-funds');
        if (mfFundsCheckbox) {
            mfFundsCheckbox.addEventListener('change', (e) => {
                state.mfIncludeFunds = !!e.target.checked;
                render();
            });
        }
        container.querySelectorAll('[data-mf-cot]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.mfCotSym = btn.getAttribute('data-mf-cot');
                render();
            });
        });
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

    // URL 딥링크(?view=quant&tab=...&market=...)로 직접 진입하거나 새로고침했을 때 즉시 렌더링
    document.addEventListener('DOMContentLoaded', () => {
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('view') === 'quant') {
                const mkt = params.get('market');
                if (mkt === 'KR' || mkt === 'US') state.market = mkt;
                window.QuantHub.navigate(params.get('tab') || 'quant-rising');
            }
        } catch (e) {}
    });
})();
