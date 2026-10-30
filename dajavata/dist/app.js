document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('table-body');
    const headerTitle = document.querySelector('.header-title h1');
    const themeBadge = document.querySelector('.theme-badge');
    
    // 모바일 햄버거 메뉴 토글
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function openSidebar() {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('visible');
    }
    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('visible');
    }

    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', () => {
            sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
        });
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // 모바일에서 메뉴 항목을 클릭하면 사이드바 자동으로 닫기
    document.querySelectorAll('.menu-section li').forEach(li => {
        li.addEventListener('click', () => {
            if (window.innerWidth <= 768) closeSidebar();
        });
    });

    // API URL
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8001' : 'https://dajavata-backend.onrender.com';
    const API_URL = `${API_BASE}/api/themes`;
    const INSIGHTS_API_URL = `${API_BASE}/api/insights`;
    
    // Store fetched data globally for filtering
    window.allThemes = [];
    window.allStocks = [];
    window.allInsights = [];

    // =========================================================================
    // [SEO & Deep-Linking] URL 라우터 및 동적 메타태그 관리
    // =========================================================================
    const DEFAULT_SITE_TITLE = "DAJAVATA(다자바타) - 주식 테마 수급 분석 & AI 차트 스캐너";
    const DEFAULT_SITE_DESC = "실시간 국내외 주식 테마 수급 분석, AI 차트 스캐너, ICT 스마트 머니 시그널 및 심층 기업 분석 칼럼 제공";

    function setPageSeo(title, desc, canonicalUrl) {
        try {
            document.title = title ? `${title} | DAJAVATA(다자바타)` : DEFAULT_SITE_TITLE;
            
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.name = 'description';
                document.head.appendChild(metaDesc);
            }
            metaDesc.content = desc || DEFAULT_SITE_DESC;

            let ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle) ogTitle.content = document.title;
            
            let ogDesc = document.querySelector('meta[property="og:description"]');
            if (ogDesc) ogDesc.content = desc || DEFAULT_SITE_DESC;

            let ogUrl = document.querySelector('meta[property="og:url"]');
            if (ogUrl) ogUrl.content = canonicalUrl || window.location.href;

            let linkCanon = document.querySelector('link[rel="canonical"]');
            if (linkCanon) linkCanon.href = canonicalUrl || window.location.href;
        } catch (e) {
            console.warn('setPageSeo failed:', e);
        }
    }

    function updateUrlState(params, replace = false) {
        try {
            const url = new URL(window.location.href);
            Object.keys(params).forEach(k => {
                if (params[k] === null || params[k] === undefined || params[k] === '') {
                    url.searchParams.delete(k);
                } else {
                    url.searchParams.set(k, params[k]);
                }
            });
            if (replace) {
                window.history.replaceState({ ...params }, '', url.toString());
            } else {
                window.history.pushState({ ...params }, '', url.toString());
            }
        } catch (e) {
            console.warn('updateUrlState failed:', e);
        }
    }

    // 간단한 토스트 알림 헬퍼
    function showToast(message) {
        let toast = document.getElementById('dajavata-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'dajavata-toast';
            toast.style.cssText = 'position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.95); color:#fff; border:1px solid #3b82f6; padding:10px 22px; border-radius:8px; font-size:13px; font-weight:600; z-index:99999; box-shadow:0 8px 24px rgba(0,0,0,0.5); opacity:0; transition:opacity 0.2s ease; pointer-events:none;';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 2200);
    }

    // KST(한국시간 UTC+9) 변환 및 평일 08:15~20:15 매시 15분 정기 슬롯 동기화 헬퍼 함수
    function getRawKstDate(d) {
        if (typeof d === 'string') {
            const m = d.trim().match(/^(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})$/);
            if (m) {
                const curYear = new Date().getFullYear();
                return new Date(curYear, parseInt(m[1], 10) - 1, parseInt(m[2], 10), parseInt(m[3], 10), parseInt(m[4], 10));
            }
        }
        const base = d ? (d instanceof Date ? d : new Date(d)) : new Date();
        const valid = !isNaN(base.getTime()) ? base : new Date();
        const utc = valid.getTime() + (valid.getTimezoneOffset() * 60000);
        return new Date(utc + (9 * 3600000));
    }

    function getKstDate(d) {
        const parsed = getRawKstDate(d);
        const nowBase = new Date();
        const nowUtc = nowBase.getTime() + (nowBase.getTimezoneOffset() * 60000);
        const nowKst = new Date(nowUtc + (9 * 3600000));
        const day = nowKst.getDay(); // 0=일, 1=월 ~ 5=금, 6=토

        if (day >= 1 && day <= 5) {
            const hr = nowKst.getHours();
            const mi = nowKst.getMinutes();
            let slotKst = null;
            if (hr > 20 || (hr === 20 && mi >= 15)) {
                slotKst = new Date(nowKst.getFullYear(), nowKst.getMonth(), nowKst.getDate(), 20, 15, 0);
            } else if (hr > 8 || (hr === 8 && mi >= 15)) {
                const slotHr = mi >= 15 ? hr : (hr - 1);
                slotKst = new Date(nowKst.getFullYear(), nowKst.getMonth(), nowKst.getDate(), slotHr, 15, 0);
            }
            if (slotKst && slotKst.getTime() > parsed.getTime()) {
                return slotKst;
            }
        }
        return parsed;
    }

    function formatKstTime(rawVal, fallbackDate) {
        const activeDate = fallbackDate || window._themeUpdatedAt || window._stockUpdatedAt;
        if (!rawVal || rawVal === '오늘' || rawVal === '-') {
            const kst = getKstDate(activeDate);
            const mm = String(kst.getMonth() + 1).padStart(2, '0');
            const dd = String(kst.getDate()).padStart(2, '0');
            const hh = String(kst.getHours()).padStart(2, '0');
            const mi = String(kst.getMinutes()).padStart(2, '0');
            return `${mm}.${dd} ${hh}:${mi}`;
        }
        if (/^\d{2}\.\d{2} \d{2}:\d{2}$/.test(rawVal)) {
            if (activeDate) {
                const kstActive = getKstDate(activeDate);
                const rawParsed = getKstDate(rawVal);
                if (kstActive.getTime() > rawParsed.getTime()) {
                    const mm = String(kstActive.getMonth() + 1).padStart(2, '0');
                    const dd = String(kstActive.getDate()).padStart(2, '0');
                    const hh = String(kstActive.getHours()).padStart(2, '0');
                    const mi = String(kstActive.getMinutes()).padStart(2, '0');
                    return `${mm}.${dd} ${hh}:${mi}`;
                }
            }
            return rawVal;
        }
        const parsed = new Date(rawVal);
        if (!isNaN(parsed.getTime())) {
            const kst = getKstDate(parsed);
            if (activeDate) {
                const kstActive = getKstDate(activeDate);
                if (kstActive.getTime() > kst.getTime()) {
                    const mm = String(kstActive.getMonth() + 1).padStart(2, '0');
                    const dd = String(kstActive.getDate()).padStart(2, '0');
                    const hh = String(kstActive.getHours()).padStart(2, '0');
                    const mi = String(kstActive.getMinutes()).padStart(2, '0');
                    return `${mm}.${dd} ${hh}:${mi}`;
                }
            }
            const mm = String(kst.getMonth() + 1).padStart(2, '0');
            const dd = String(kst.getDate()).padStart(2, '0');
            const hh = String(kst.getHours()).padStart(2, '0');
            const mi = String(kst.getMinutes()).padStart(2, '0');
            return `${mm}.${dd} ${hh}:${mi}`;
        }
        const kst = getKstDate(activeDate);
        const mm = String(kst.getMonth() + 1).padStart(2, '0');
        const dd = String(kst.getDate()).padStart(2, '0');
        const hh = String(kst.getHours()).padStart(2, '0');
        const mi = String(kst.getMinutes()).padStart(2, '0');
        return `${mm}.${dd} ${hh}:${mi}`;
    }

    function formatFullKstHeader(fallbackDate) {
        const kst = getKstDate(fallbackDate || window._themeUpdatedAt || window._stockUpdatedAt);
        const yyyy = kst.getFullYear();
        const mm = String(kst.getMonth() + 1).padStart(2, '0');
        const dd = String(kst.getDate()).padStart(2, '0');
        const hh = String(kst.getHours()).padStart(2, '0');
        const mi = String(kst.getMinutes()).padStart(2, '0');
        return `최근 업데이트: ${yyyy}.${mm}.${dd} ${hh}:${mi} (KST)`;
    }

    function updateHeaderBadge() {
        const badgeText = document.getElementById('header-update-text');
        const badgeWrap = document.getElementById('header-update-badge');
        if (!badgeText) return;
        if (currentMode === 'insights') {
            if (badgeWrap) badgeWrap.style.display = 'none';
            return;
        }
        if (badgeWrap) badgeWrap.style.display = 'inline-flex';
        const targetDate = (currentMode === 'stocks') ? (window._stockUpdatedAt || window._themeUpdatedAt) : (window._themeUpdatedAt || window._stockUpdatedAt);
        badgeText.textContent = formatFullKstHeader(targetDate);
    }

    // 전체 종목 데이터를 로드하는 Promise (백엔드 API + 로컬/CDN 다단계 폴백)
    async function loadAllStocks() {
        // 1. 백엔드 API 시도
        try {
            const response = await fetch(`${API_BASE}/api/stocks/fundamentals`);
            if (response.ok) {
                const serverDate = response.headers.get('date');
                const data = await response.json();
                if (data && data.stocks && data.stocks.length > 50) {
                    window.allStocks = data.stocks;
                    if (data.updated_at) {
                        window._stockUpdatedAt = new Date(data.updated_at);
                    } else if (serverDate) {
                        window._stockUpdatedAt = new Date(serverDate);
                    }
                    updateHeaderBadge();
                    return window.allStocks;
                }
            }
        } catch (e) {
            console.warn('API fundamentals fetch failed, trying static fallbacks...', e);
        }

        // 2. 로컬 및 CDN 정적 JSON 폴백
        const fallbackUrls = [
            'data/all_stocks.json',
            '/data/all_stocks.json',
            'https://raw.githubusercontent.com/sjsks1/dajavata-backend/main/data/all_stocks.json',
            'https://cdn.jsdelivr.net/gh/sjsks1/dajavata-backend@main/data/all_stocks.json',
            'https://raw.githubusercontent.com/sjsks1/dajavata-backend/main/dajavata_backend/data/all_stocks.json'
        ];

        for (const url of fallbackUrls) {
            try {
                const res = await fetch(url, { cache: 'no-cache' });
                if (res.ok) {
                    const text = await res.text();
                    if (!text.trim().startsWith('<')) {
                        const parsed = JSON.parse(text);
                        const list = Array.isArray(parsed) ? parsed : (parsed.stocks || []);
                        if (list && list.length > 50) {
                            window.allStocks = list;
                            updateHeaderBadge();
                            return window.allStocks;
                        }
                    }
                }
            } catch (err) {}
        }

        return window.allStocks || [];
    }

    async function loadInsights() {
        // 0. 메모리 캐시 확인
        if (window.allInsights && window.allInsights.length > 0) {
            return window.allInsights;
        }

        // 1. 브라우저 로컬 저장소 우선 확인 (오프라인/즉시 렌더링)
        try {
            const localSaved = localStorage.getItem('dajavata_local_insights_db');
            if (localSaved) {
                const parsed = JSON.parse(localSaved);
                if (parsed && Array.isArray(parsed.posts) && parsed.posts.length > 0) {
                    window.allInsights = parsed.posts;
                }
            }
        } catch (e) {}

        // 2. 정적 JSON (data/insights_db.json) 다단계 캐시 로드 (0ms 초고속)
        const staticUrls = [
            'data/insights_db.json',
            '/data/insights_db.json',
            'https://raw.githubusercontent.com/sjsks1/dajavata-backend/main/data/insights_db.json'
        ];
        for (const url of staticUrls) {
            try {
                const res = await fetch(url, { cache: 'no-cache' });
                if (res.ok) {
                    const text = await res.text();
                    if (!text.trim().startsWith('<')) {
                        const data = JSON.parse(text);
                        if (data && Array.isArray(data.posts) && data.posts.length > 0) {
                            window.allInsights = data.posts;
                            return window.allInsights;
                        }
                    }
                }
            } catch (err) {}
        }

        // 3. 백엔드 API 시도
        try {
            const response = await fetch(INSIGHTS_API_URL, { cache: 'no-cache' });
            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data.posts) && data.posts.length > 0) {
                    window.allInsights = data.posts;
                    return window.allInsights;
                }
            }
        } catch (error) {
            console.warn('API insights fetch failed:', error);
        }

        return window.allInsights || [];
    }

    let allStocksPromise = loadAllStocks();

    // 테마 상세 저장소 백그라운드 사전 로드 (지연 시간 0ms 달성)
    let themeDetailsStorePromise = null;
    function getThemeDetailsStore() {
        if (window.globalThemeDetailsStore && Object.keys(window.globalThemeDetailsStore).length > 20) {
            return Promise.resolve(window.globalThemeDetailsStore);
        }
        if (themeDetailsStorePromise) return themeDetailsStorePromise;

        themeDetailsStorePromise = (async () => {
            const cdnUrls = [
                'data/theme_details.json',
                '/data/theme_details.json',
                'https://raw.githubusercontent.com/sjsks1/dajavata-backend/main/data/theme_details.json',
                'https://cdn.jsdelivr.net/gh/sjsks1/dajavata-backend@main/data/theme_details.json',
                'https://raw.githubusercontent.com/sjsks1/dajavata-backend/main/dajavata_backend/data/theme_details.json',
                'https://cdn.jsdelivr.net/gh/sjsks1/dajavata-backend@main/dajavata_backend/data/theme_details.json'
            ];
            for (const url of cdnUrls) {
                try {
                    const res = await fetch(url, { cache: 'no-cache' });
                    if (res.ok) {
                        const text = await res.text();
                        if (!text.trim().startsWith('<')) {
                            const parsed = JSON.parse(text);
                            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 20) {
                                window.globalThemeDetailsStore = parsed;
                                return parsed;
                            }
                        }
                    }
                } catch (e) {}
            }
            return null;
        })();
        return themeDetailsStorePromise;
    }
    // 즉시 백그라운드 프리페치 시작
    getThemeDetailsStore();

    // Pagination State
    let currentDataList = [];
    let currentMode = 'themes';
    let currentPage = 1;
    let isThemeDetail = false;
    const itemsPerPage = 50;

    let previousState = {
        dataList: [],
        mode: 'themes',
        headerTitle: '전체 테마',
        themeBadge: '테마',
        page: 1
    };

    const searchInput = document.querySelector('.search-box input');

    // =========================================================================
    // [Deep-Linking Router] URL 파라미터 기반 뷰 디스패처 & 브라우저 히스토리 연동
    // =========================================================================
    async function dispatchRouteFromUrl(isInitial = false) {
        try {
            const params = new URLSearchParams(window.location.search);
            const view = params.get('view');
            const id = params.get('id');
            const name = params.get('name');
            const tab = params.get('tab');
            const action = params.get('action');

            // 1. 특정 인사이트 글 단독 조회 (?view=insight&id=xxx)
            if (view === 'insight' && id) {
                showDefaultView();
                document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
                const insightLi = document.querySelector('#insight-menu-list li[data-action="insights"]');
                if (insightLi) insightLi.classList.add('active');

                tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px; color: var(--text-muted);">칼럼 본문을 불러오는 중입니다...</td></tr>';
                const insights = (window.allInsights && window.allInsights.length > 0) ? window.allInsights : await loadInsights();
                
                // ID 또는 종목코드/제목으로 일치하는 글 탐색
                const targetPost = insights.find(p => String(p.id) === String(id) || (p.title && p.title.includes(id)));
                if (targetPost) {
                    renderSingleInsight(targetPost, false);
                    return true;
                } else {
                    renderTable(insights, 'insights');
                    return true;
                }
            }

            // 2. 인사이트 목록 (?view=insights)
            if (view === 'insights') {
                showDefaultView();
                document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
                const insightLi = document.querySelector('#insight-menu-list li[data-action="insights"]');
                if (insightLi) insightLi.classList.add('active');

                headerTitle.textContent = "기업 개요 및 차트 분석";
                themeBadge.textContent = "인사이트";
                setPageSeo("기업 개요 및 차트 분석", "다자바타 종목 소개 및 시장 분석 칼럼");
                tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px; color: var(--text-muted);">노션에서 데이터를 불러오는 중입니다...</td></tr>';
                const insights = (window.allInsights && window.allInsights.length > 0) ? window.allInsights : await loadInsights();
                const thead = document.querySelector('#theme-table thead');
                if (thead) {
                    thead.innerHTML = `<tr><th style="width: 15%">작성일</th><th style="width: 85%">기업 개요 및 차트 분석</th></tr>`;
                }
                renderTable(insights, 'insights');
                return true;
            }

            // 3. 특정 테마 상세 (?view=theme&name=xxx)
            if (view === 'theme' && name) {
                showDefaultView();
                loadThemeDetails(decodeURIComponent(name));
                return true;
            }

            // 4. AI 차트 스캐너 (?view=scanner)
            if (view === 'scanner') {
                if (window.ChartScanner) {
                    window.ChartScanner.show();
                    setPageSeo("AI 차트 스캐너", "다자바타 AI 실시간 차트 분석 및 시그널 랩");
                    return true;
                }
            }

            // 5. 트레이더 룸 (?view=trader&tab=xxx)
            if (view === 'trader') {
                if (window.ChartScanner) window.ChartScanner.hide();
                if (window.TraderRoom) {
                    window.TraderRoom.navigate(tab || 'today');
                    setPageSeo("트레이더 룸", "다자바타 트레이더 맞춤형 매매 시나리오 및 리스크 관리 도구");
                    return true;
                }
            }
            if (view === 'quant' && window.QuantHub) {
                if (window.ChartScanner) window.ChartScanner.hide();
                const marketParam = params.get('market');
                if (marketParam === 'KR' || marketParam === 'US') window.QuantHub.market = marketParam;
                window.QuantHub.navigate(tab || 'quant-rising');
                setPageSeo("글로벌 퀀트 & 마켓 허브", "다자바타 국내주식(KRX) 및 미국주식(US) 8대 퀀트 스크리너");
                return true;
            }
        } catch (e) {
            console.warn('dispatchRouteFromUrl error:', e);
        }
        return false;
    }

    // 브라우저 뒤로가기 / 앞으로가기 이벤트 연동
    window.addEventListener('popstate', () => {
        dispatchRouteFromUrl(false);
    });

    tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px; color: var(--text-muted);">데이터를 불러오는 중입니다...<br><span style="font-size: 13px;">(무료 서버 특성상 첫 접속 시 최대 1분 정도 소요될 수 있습니다)</span></td></tr>';
    
    // 원시 theme_cache.json 항목을 프론트엔드 표 형식으로 변환
    function normalizeRawTheme(t, fallbackUpdate) {
        if (!t) return null;
        if (typeof t.day1 === 'string' && t.day1.includes('%')) return t;
        const fmtPct = (v, digits = 1) => (v !== null && v !== undefined && !isNaN(Number(v))) ? `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(digits)}%` : '-';
        const fmtInt = (v) => (v !== null && v !== undefined && !isNaN(Number(v))) ? `${Math.round(Number(v))}` : '-';
        const d1 = t.day1Pos !== undefined ? Number(t.day1Pos) : Number(t.day1 || 0);
        const d3 = t.day3Pos !== undefined ? Number(t.day3Pos) : Number(t.day3 || 0);
        const h52 = Number(t.high52);
        const l52 = Number(t.low52);
        const n52 = Number(t.neglect52);
        const h3y = Number(t.high3y);
        const l3y = Number(t.low3y);
        const n3y = Number(t.neglect3y);
        const exp = Number(t.expReturn);
        return {
            name: t.name || '',
            theme_id: t.theme_id || '',
            desc: t.desc || `${t.name || ''} 테마 구성종목 평균 데이터입니다.`,
            day1: fmtPct(d1, 2),
            day1Pos: !isNaN(d1) ? d1 >= 0 : true,
            day3: fmtPct(d3, 2),
            day3Pos: !isNaN(d3) ? d3 >= 0 : true,
            high52: fmtPct(h52, 1),
            high52Pos: !isNaN(h52) ? h52 >= 0 : true,
            low52: fmtPct(l52, 1),
            low52Pos: !isNaN(l52) ? l52 >= 0 : true,
            neglect52: fmtInt(n52),
            high3y: fmtPct(h3y, 1),
            high3yPos: !isNaN(h3y) ? h3y >= 0 : true,
            low3y: fmtPct(l3y, 1),
            low3yPos: !isNaN(l3y) ? l3y >= 0 : true,
            neglect3y: fmtInt(n3y),
            expReturn: !isNaN(exp) ? `${Math.round(exp)}%` : '-',
            rsi_d: t.rsi_d || '-',
            rsi_w: t.rsi_w || '-',
            rsi_m: t.rsi_m || '-',
            update: t.update || fallbackUpdate || '-',
            score: t.score || 100
        };
    }

    async function fetchThemesWithFallback(isBackgroundRefresh = false) {
        let bestThemes = [];
        let bestUpdatedAt = null;

        // 1. 백엔드 API 호출 (no-cache)
        try {
            const response = await fetch(API_URL, { cache: 'no-cache' });
            if (response.ok) {
                const serverDate = response.headers.get('date');
                const data = await response.json();
                if (data && Array.isArray(data.themes) && data.themes.length > 0) {
                    bestThemes = data.themes;
                    bestUpdatedAt = data.updated_at ? new Date(data.updated_at) : (serverDate ? new Date(serverDate) : new Date());
                }
            }
        } catch (err) {
            console.warn('Primary API_URL fetch failed, checking static/GitHub CDN...', err);
        }

        // 2. 로컬/GitHub Raw 최신 theme_cache.json 병행 비교 (더 최신 데이터가 있으면 즉시 교체)
        const rawUrls = [
            'data/theme_cache.json',
            'https://raw.githubusercontent.com/sjsks1/dajavata-backend/main/data/theme_cache.json'
        ];
        for (const rUrl of rawUrls) {
            try {
                const rRes = await fetch(rUrl, { cache: 'no-cache' });
                if (rRes.ok) {
                    const txt = await rRes.text();
                    if (!txt.trim().startsWith('<')) {
                        const rawArr = JSON.parse(txt);
                        if (Array.isArray(rawArr) && rawArr.length > 20) {
                            const sampleUpd = rawArr[0] && rawArr[0].update ? rawArr[0].update : null;
                            const rawDt = sampleUpd ? getRawKstDate(sampleUpd) : null;
                            const curDt = bestUpdatedAt ? getRawKstDate(bestUpdatedAt) : null;
                            if (!bestThemes.length || (rawDt && curDt && rawDt.getTime() > curDt.getTime())) {
                                bestThemes = rawArr.map(item => normalizeRawTheme(item, sampleUpd)).filter(Boolean);
                                if (rawDt) bestUpdatedAt = rawDt;
                            }
                            break;
                        }
                    }
                }
            } catch (e) {}
        }

        if (bestThemes.length > 0) {
            window.allThemes = bestThemes;
            window._themeUpdatedAt = getKstDate(bestUpdatedAt || new Date());
            updateHeaderBadge();
            if (!isBackgroundRefresh) {
                const dispatched = await dispatchRouteFromUrl(true);
                if (!dispatched) {
                    renderTable(window.allThemes, 'themes');
                }
            } else if (currentMode === 'themes' && !isThemeDetail) {
                currentDataList = window.allThemes;
                renderCurrentPage();
            }
        } else if (!isBackgroundRefresh) {
            tbody.innerHTML = '<tr><td colspan="15" class="center">데이터를 불러올 수 없습니다. API 연결을 확인해주세요.</td></tr>';
        }
    }

    fetchThemesWithFallback(false);

    // 5분 주기로 백그라운드 자동 동기화 (브라우저를 켜두어도 매시 15분 업데이트 즉시 반영)
    setInterval(() => {
        fetchThemesWithFallback(true);
    }, 5 * 60 * 1000);

    // 검색창 이벤트
    if (searchInput) {
        searchInput.addEventListener('input', async () => {
            currentPage = 1;

            // 아직 전체 종목 데이터가 없으면, 로딩 중임을 표시하고 완료될 때까지 기다렸다가 검색
            if (window.allStocks.length === 0) {
                tbody.innerHTML = '<tr><td colspan="15" class="center" style="padding:40px;">종목 데이터를 불러오는 중입니다... 잠시만 기다려주세요.</td></tr>';
                window.allStocks = await allStocksPromise;

                // 실패했을 경우 재시도 (다음 입력을 기다리지 않고 즉시 재시도)
                if (window.allStocks.length === 0) {
                    allStocksPromise = loadAllStocks();
                }
            }
            
            renderCurrentPage();
        });
    }

    // 테이블 렌더링 초기화 함수
    function renderTable(dataList, mode = 'themes', fromThemeDetail = false) {
        currentDataList = dataList;
        currentMode = mode;
        currentPage = 1;
        isThemeDetail = fromThemeDetail;
        if (searchInput) searchInput.value = ''; // 탭 전환 시 검색어 초기화
        updateHeaderBadge();
        renderCurrentPage();
    }

    // Helper functions for Notion Blocks
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function blocksToHtml(blocks) {
        if (!blocks || blocks.length === 0) {
            return '<p style="color: var(--text-muted);">본문 내용이 없습니다.</p>';
        }
        
        let html = '';
        let listBuffer = null; // 'ul' | 'ol' | null
        
        function closeList() {
            if (listBuffer) {
                html += listBuffer === 'ul' ? '</ul>' : '</ol>';
                listBuffer = null;
            }
        }
        
        blocks.forEach(block => {
            if (block.type === 'bulleted_list_item') {
                if (listBuffer !== 'ul') { closeList(); html += '<ul style="margin:8px 0 16px 20px; padding:0;">'; listBuffer = 'ul'; }
                html += `<li style="margin-bottom:6px; color:var(--text-main);">${escapeHtml(block.text)}</li>`;
                return;
            }
            if (block.type === 'numbered_list_item') {
                if (listBuffer !== 'ol') { closeList(); html += '<ol style="margin:8px 0 16px 20px; padding:0;">'; listBuffer = 'ol'; }
                html += `<li style="margin-bottom:6px; color:var(--text-main);">${escapeHtml(block.text)}</li>`;
                return;
            }
            
            closeList();
            
            if (block.type === 'heading') {
                const sizes = { 1: '24px', 2: '20px', 3: '17px' };
                html += `<h${block.level} style="font-size:${sizes[block.level] || '17px'}; margin:24px 0 12px; color:white;">${escapeHtml(block.text)}</h${block.level}>`;
            } else if (block.type === 'paragraph') {
                html += `<p style="margin-bottom:14px; line-height:1.7; color: var(--text-main);">${escapeHtml(block.text).replace(/\n/g, '<br>')}</p>`;
            } else if (block.type === 'image') {
                html += `<figure style="margin:16px 0;">
                            <img src="${escapeHtml(block.url)}" style="max-width:100%; border-radius:8px;">
                            ${block.caption ? `<figcaption style="font-size:12px; color:var(--text-muted); margin-top:8px; text-align:center;">${escapeHtml(block.caption)}</figcaption>` : ''}
                         </figure>`;
            } else if (block.type === 'table') {
                html += '<table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:14px; text-align:left;">';
                block.rows.forEach((row, i) => {
                    const isHeader = block.has_header && i === 0;
                    const tag = isHeader ? 'th' : 'td';
                    html += '<tr>';
                    row.forEach(cell => {
                        html += `<${tag} style="border:1px solid var(--border); padding:10px; color:var(--text-main);">${escapeHtml(cell)}</${tag}>`;
                    });
                    html += '</tr>';
                });
                html += '</table>';
            } else if (block.type === 'callout') {
                html += `<div class="editor-callout-box" style="background: rgba(59,130,246,0.08); border-left: 4px solid var(--primary); padding: 14px 16px; border-radius: 6px; margin: 18px 0; font-size: 14px; line-height: 1.6; color: var(--text-main);">${escapeHtml(block.text).replace(/\n/g, '<br>')}</div>`;
            } else if (block.type === 'quote') {
                html += `<blockquote style="border-left: 3px solid var(--accent); padding: 8px 16px; margin: 16px 0; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: 0 4px 4px 0;">${escapeHtml(block.text).replace(/\n/g, '<br>')}</blockquote>`;
            } else if (block.type === 'divider') {
                html += '<hr style="border:none; border-top:1px solid var(--border); margin:24px 0;">';
            }
        });
        
        closeList();
        return html;
    }

    function getBlocksText(blocks) {
        if (!blocks) return '';
        return blocks
            .filter(b => b.type === 'paragraph' || b.type === 'heading')
            .map(b => b.text)
            .join(' ');
    }

    // 현재 페이지 렌더링
    function renderCurrentPage() {
        const thead = document.querySelector('#theme-table thead');
        tbody.innerHTML = ''; // 초기화

        // 1. 검색 필터링
        let filteredList = currentDataList;
        let displayMode = currentMode;

        if (searchInput && searchInput.value.trim()) {
            const rawTerm = searchInput.value.trim();
            const term = rawTerm.toLowerCase();
            
            // 검색 시 헤더 타이틀 및 뱃지를 검색 모드로 즉각 갱신
            if (headerTitle) headerTitle.textContent = `"${rawTerm}" 검색 결과`;
            if (themeBadge) themeBadge.textContent = "검색";

            let themeResults = window.allThemes.filter(item => {
                const name = (item.name || '').toLowerCase();
                const desc = (item.desc || '').toLowerCase();
                return name.includes(term) || desc.includes(term);
            });
            
            let stockResults = (window.allStocks && window.allStocks.length > 0) 
                ? window.allStocks.filter(item => {
                    const name = (item.name || '').toLowerCase();
                    const code = (item.code || '').toLowerCase();
                    return name.includes(term) || code.includes(term);
                }) 
                : currentDataList.filter(item => {
                    const name = (item.name || '').toLowerCase();
                    const code = (item.code || '').toLowerCase();
                    return name.includes(term) || code.includes(term);
                });

            // 검색된 종목들의 주가를 globalThemeDetailsStore의 최신 실시간 시세로 동기화
            if (stockResults.length > 0 && window.globalThemeDetailsStore) {
                const freshMap = new Map();
                Object.values(window.globalThemeDetailsStore).forEach(arr => {
                    if (Array.isArray(arr)) {
                        arr.forEach(s => {
                            if (s.code && s.current_price != null && s.current_price > 0) freshMap.set(s.code, s);
                            if (s.name && s.current_price != null && s.current_price > 0) freshMap.set(s.name, s);
                        });
                    }
                });
                stockResults = stockResults.map(s => {
                    const fresh = freshMap.get(s.code) || freshMap.get(s.name);
                    if (fresh) {
                        return {
                            ...s,
                            current_price: fresh.current_price,
                            day1: fresh.day1 !== undefined && fresh.day1 !== null ? fresh.day1 : s.day1,
                            update: fresh.update || s.update
                        };
                    }
                    return s;
                });
            }
                
            if (themeResults.length > 0 && stockResults.length === 0) {
                filteredList = themeResults;
                displayMode = 'themes';
            } else if (stockResults.length > 0 && themeResults.length === 0) {
                filteredList = stockResults;
                displayMode = 'stocks';
            } else if (stockResults.length > 0 && themeResults.length > 0) {
                if (currentMode === 'themes') {
                    filteredList = themeResults;
                    displayMode = 'themes';
                } else {
                    filteredList = stockResults;
                    displayMode = 'stocks';
                }
            } else {
                filteredList = [];
                displayMode = currentMode;
            }
        } else {
            // 검색어가 없을 때 테마 상세가 아니면 기본 헤더 유지
            if (!isThemeDetail && headerTitle && previousState.headerTitle) {
                headerTitle.textContent = previousState.headerTitle;
                if (themeBadge && previousState.themeBadge) themeBadge.textContent = previousState.themeBadge;
            }
        }

        if (filteredList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px;">데이터가 없습니다.</td></tr>';
            return;
        }

        // 2. 페이지네이션 계산
        const totalPages = Math.ceil(filteredList.length / itemsPerPage);
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedList = filteredList.slice(startIndex, startIndex + itemsPerPage);

        // 3. 헤더 및 데이터 렌더링
        if (displayMode === 'themes') {
            thead.innerHTML = `
                <tr>
                    <th>테마명</th>
                    <th class="right">전일비</th>
                    <th class="right">3일합산</th>
                    <th class="right">52주 상승률</th>
                    <th class="right">52주 하락률</th>
                    <th class="center">52주 소외지수</th>
                    <th class="right">3년 상승률</th>
                    <th class="right">3년 하락률</th>
                    <th class="center">3년 소외지수</th>
                    <th class="center">업데이트</th>
                </tr>
            `;

            paginatedList.forEach(theme => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div class="theme-name-cell" title="${theme.desc}">
                            <a href="#" class="theme-link" data-theme-name="${theme.name}" style="text-decoration: none; color: inherit; cursor: pointer;">${theme.name}</a>
                            <i class="ph ph-info" style="color: var(--text-muted); margin-left: 4px; font-size: 14px; cursor: help;"></i>
                        </div>
                    </td>
                    <td class="right"><span class="${theme.day1Pos ? 'pos' : 'neg'} price-main">${theme.day1}</span></td>
                    <td class="right"><span class="${theme.day3Pos ? 'pos' : 'neg'} price-main">${theme.day3}</span></td>
                    <td class="right"><span class="${theme.high52Pos ? 'pos' : 'neg'} price-main">${theme.high52}</span></td>
                    <td class="right"><span class="${theme.low52Pos ? 'pos' : 'neg'} price-main">${theme.low52}</span></td>
                    <td class="center"><span class="price-main" style="color: var(--text-main); font-weight: 800;">${theme.neglect52}</span></td>
                    <td class="right"><span class="${theme.high3yPos ? 'pos' : 'neg'} price-main">${theme.high3y}</span></td>
                    <td class="right"><span class="${theme.low3yPos ? 'pos' : 'neg'} price-main">${theme.low3y}</span></td>
                    <td class="center"><span class="price-main" style="color: var(--text-main); font-weight: 800;">${theme.neglect3y}</span></td>
                    <td class="center" style="color: var(--text-muted); font-size: 12px;" title="데이터 업데이트 시간 (한국시간)">${formatKstTime(theme.update, window._themeUpdatedAt)}</td>
                `;
                tbody.appendChild(tr);
            });

            // 테마 이름 클릭 이벤트 바인딩
            document.querySelectorAll('.theme-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    
                    previousState = {
                        dataList: currentDataList,
                        mode: currentMode,
                        headerTitle: headerTitle.textContent,
                        themeBadge: themeBadge.textContent,
                        page: currentPage
                    };

                    const themeName = e.currentTarget.getAttribute('data-theme-name') || e.target.getAttribute('data-theme-name');
                    if (themeName) {
                        loadThemeDetails(themeName);
                    }
                });
            });

        } else if (displayMode === 'stocks') {
            thead.innerHTML = `
                <tr>
                    <th>종목명</th>
                    <th class="right">현재가격</th>
                    <th class="right">등락률</th>
                    <th class="right">3일합산</th>
                    <th class="right">52주 최고최저</th>
                    <th class="center">52주 소외지수</th>
                    <th class="right">3년 최고최저</th>
                    <th class="center">3년 소외지수</th>
                    <th class="right">PBR</th>
                    <th class="right">PER</th>
                    <th class="right">EPS</th>
                    <th class="right">시가총액</th>
                    <th class="center">업데이트</th>
                </tr>
            `;

            paginatedList.forEach(stock => {
                const tr = document.createElement('tr');
                tr.setAttribute('data-stock-code', stock.code);
                
                const price = new Intl.NumberFormat('ko-KR').format(stock.current_price || 0);
                const day1 = stock.day1 ? stock.day1.toFixed(2) : '0.00';
                const day1Class = stock.day1 >= 0 ? 'pos' : 'neg';
                const day1Sign = stock.day1 > 0 ? '+' : '';
                
                const day3 = stock.day3 ? stock.day3.toFixed(2) : '0.00';
                const day3Class = stock.day3 >= 0 ? 'pos' : 'neg';
                const day3Sign = stock.day3 > 0 ? '+' : '';
                
                const high52 = stock.high52 ? stock.high52.toFixed(1) : '0.0';
                const low52 = stock.low52 ? stock.low52.toFixed(1) : '0.0';
                const neglect52 = stock.neglect52 ? stock.neglect52.toFixed(0) : '0';
                
                const high3y = stock.high3y ? stock.high3y.toFixed(1) : '0.0';
                const low3y = stock.low3y ? stock.low3y.toFixed(1) : '0.0';
                const neglect3y = stock.neglect3y ? stock.neglect3y.toFixed(0) : '0';
                
                const pbr = stock.PBR ? stock.PBR.toFixed(2) : '-';
                const per = stock.PER ? stock.PER.toFixed(2) : '-';
                const eps = stock.EPS ? new Intl.NumberFormat('ko-KR').format(stock.EPS) : '-';
                
                let marcapStr = '-';
                if (stock.marcap) {
                    const jo = Math.floor(stock.marcap / 1000000000000);
                    const eok = Math.floor((stock.marcap % 1000000000000) / 100000000);
                    marcapStr = jo > 0 ? `${jo}조 ${eok}억원` : `${eok}억원`;
                }

                tr.classList.add('stock-clickable-row');
                tr.title = `${stock.name} (${stock.code}) 클릭 시 매수·매도 타점 차트 및 수급·테마·뉴스 종합 브리핑 열기`;
                tr.innerHTML = `
                    <td>
                        <div class="theme-name-cell">
                            <span class="stock-name" style="font-weight: 600;">${stock.name}</span>
                            <span style="font-size: 11px; color: var(--text-muted); margin-left: 5px;">${stock.code}</span>
                            <span class="stock-briefing-pill"><i class="ph ph-chart-line-up"></i> 타점·수급</span>
                        </div>
                    </td>
                    <td class="right"><span class="price-main cell-stock-price" style="color: white;">${price}</span></td>
                    <td class="right"><span class="${day1Class} price-main cell-stock-day1">${day1Sign}${day1}%</span></td>
                    <td class="right"><span class="${day3Class} price-main">${day3Sign}${day3}%</span></td>
                    <td class="right"><span class="price-main"><span class="pos">+${high52}%</span> / <span class="neg">${low52}%</span></span></td>
                    <td class="center"><span class="price-main" style="color: var(--text-main); font-weight: 800;">${neglect52}</span></td>
                    <td class="right"><span class="price-main"><span class="pos">+${high3y}%</span> / <span class="neg">${low3y}%</span></span></td>
                    <td class="center"><span class="price-main" style="color: var(--text-main); font-weight: 800;">${neglect3y}</span></td>
                    <td class="right"><span class="price-main">${pbr}</span></td>
                    <td class="right"><span class="price-main">${per}</span></td>
                    <td class="right"><span class="price-main">${eps}</span></td>
                    <td class="right"><span class="price-main" style="font-size: 12px; color: var(--text-muted);">${marcapStr}</span></td>
                    <td class="center" style="color: var(--text-muted); font-size: 12px;" title="데이터 업데이트 시간 (한국시간)">${formatKstTime(stock.update, window._stockUpdatedAt)}</td>
                `;
                tr.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (window.openStockBriefingModal) {
                        window.openStockBriefingModal(stock);
                    }
                });
                tbody.appendChild(tr);
            });

            // 네이버 실시간 호가/시세 동기화 (현재 15개 종목)
            syncRealtimeStockQuotes(paginatedList);
        } else if (displayMode === 'insights') {
            thead.innerHTML = `
                <tr>
                    <th style="width: 15%">작성일</th>
                    <th style="width: 85%">시장 인사이트 칼럼</th>
                </tr>
            `;

            paginatedList.forEach(post => {
                const tr = document.createElement('tr');
                
                let rawText = getBlocksText(post.blocks);
                const textPreview = rawText.length > 200 ? rawText.substring(0, 200) + '...' : rawText;
                const formattedContent = escapeHtml(textPreview).replace(/\n/g, '<br>');
                
                const adminBtnsHtml = window.isDajavataAdmin ? `
                    <button class="admin-edit-btn" data-id="${post.id}" style="margin-left: 8px; background: rgba(59,130,246,0.15); border: 1px solid #3b82f6; color: #60a5fa; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><i class="ph ph-pencil-simple"></i> 수정</button>
                    <button class="admin-delete-btn" data-id="${post.id}" style="margin-left: 6px; background: rgba(239,68,68,0.15); border: 1px solid #ef4444; color: #f87171; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><i class="ph ph-trash"></i> 삭제</button>
                ` : '';

                tr.innerHTML = `
                    <td style="vertical-align: top; padding-top: 20px; color: var(--text-muted);">${post.date}</td>
                    <td style="padding: 20px 10px;">
                        <h3 style="margin-top: 0; margin-bottom: 10px; color: var(--text-main); font-size: 1.2rem;">${post.title}</h3>
                        <div style="line-height: 1.6; color: var(--text-muted); font-size: 0.95rem;">${formattedContent}</div>
                        <div style="display: flex; align-items: center; margin-top: 15px;">
                            <button class="read-more-btn" data-id="${post.id}" style="background: transparent; border: 1px solid var(--border); color: var(--text-main); padding: 5px 15px; border-radius: 4px; cursor: pointer;">자세히 읽기</button>
                            ${adminBtnsHtml}
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Bind read more buttons
            document.querySelectorAll('.read-more-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    const post = window.allInsights.find(p => p.id === id);
                    if (post) {
                        renderSingleInsight(post);
                    }
                });
            });

            // Bind admin edit buttons
            document.querySelectorAll('.admin-edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    const post = (window.allInsights || []).find(p => String(p.id) === String(id));
                    if (post && window.openEditorModal) {
                        window.openEditorModal(post);
                    }
                });
            });

            // Bind admin delete buttons
            document.querySelectorAll('.admin-delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (window.deleteInsightPost) {
                        window.deleteInsightPost(id);
                    }
                });
            });
        }

        // 4. 하단 컨트롤 버튼 (뒤로가기 + 페이지네이션)
        if (totalPages > 1 || isThemeDetail) {
            const footerTr = document.createElement('tr');
            
            let backButtonHtml = '';
            if (isThemeDetail) {
                const backText = previousState.headerTitle ? `${previousState.headerTitle}로 돌아가기` : '테마 리스트로 돌아가기';
                backButtonHtml = `
                    <button id="back-to-themes" style="padding: 10px 20px; background: var(--bg-card); color: white; border: 1px solid var(--border); border-radius: 5px; cursor: pointer; font-family: inherit; margin-right: 20px;">
                        <i class="ph ph-arrow-left"></i> ${backText}
                    </button>
                `;
            }

            let paginationHtml = '';
            if (totalPages > 1) {
                paginationHtml += `<div class="pagination-container" style="display: inline-flex; align-items: center; gap: 5px; margin: 0; padding: 0; background: transparent; border: none; box-shadow: none;">`;
                paginationHtml += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="prev">이전</button>`;
                
                let startPage = Math.max(1, currentPage - 2);
                let endPage = Math.min(totalPages, startPage + 4);
                if (endPage - startPage < 4) {
                    startPage = Math.max(1, endPage - 4);
                }

                for (let i = startPage; i <= endPage; i++) {
                    paginationHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
                }
                
                paginationHtml += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="next">다음</button>`;
                paginationHtml += `</div>`;
            }

            footerTr.innerHTML = `
                <td colspan="15" class="center" style="padding: 20px 10px;">
                    <div style="display: flex; justify-content: center; align-items: center;">
                        ${backButtonHtml}
                        ${paginationHtml}
                    </div>
                </td>
            `;
            tbody.appendChild(footerTr);

            // 이벤트 바인딩
            const backBtn = document.getElementById('back-to-themes');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    updateUrlState({ view: null, name: null, id: null, tab: null, action: null });
                    setPageSeo();
                    headerTitle.textContent = previousState.headerTitle || "전체 테마";
                    themeBadge.textContent = previousState.themeBadge || "테마";
                    renderTable(previousState.dataList || window.allThemes, previousState.mode || 'themes', false);
                    currentPage = previousState.page || 1;
                    renderCurrentPage();
                });
            }

            footerTr.querySelectorAll('.page-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const page = e.target.getAttribute('data-page');
                    if (page === 'prev' && currentPage > 1) {
                        currentPage--;
                        renderCurrentPage();
                    } else if (page === 'next' && currentPage < totalPages) {
                        currentPage++;
                        renderCurrentPage();
                    } else if (!isNaN(page)) {
                        currentPage = parseInt(page);
                        renderCurrentPage();
                    }
                    
                    // 테이블 맨 위로 스크롤
                    const tableContainer = document.querySelector('.table-container');
                    if (tableContainer) tableContainer.scrollTop = 0;
                });
            });
        }
    }

    function renderSingleInsight(post, updateHistory = true) {
        if (!post) return;
        
        headerTitle.textContent = post.title;
        themeBadge.textContent = "칼럼 전문";
        const thead = document.querySelector('#theme-table thead');
        thead.innerHTML = '';
        
        tbody.innerHTML = '';
        const tr = document.createElement('tr');
        const formattedContent = blocksToHtml(post.blocks);
        
        // SEO 메타태그 및 딥링크 URL 갱신
        const summaryText = getBlocksText(post.blocks).substring(0, 140).replace(/\s+/g, ' ');
        setPageSeo(post.title, summaryText || `${post.title} - 다자바타 기업 분석 칼럼`);
        if (updateHistory) {
            updateUrlState({ view: 'insight', id: post.id });
        }

        tr.innerHTML = `
            <td colspan="10" style="padding: 24px 20px;">
                <div class="insight-article-container">
                    <!-- Google AdSense Top Slot (상단 배너 광고 공간) -->
                    <div class="dajavata-ad-slot ad-slot-top" id="ad-insight-top">
                        <!-- 구글 애드센스 승인 후 아래 주석 해제 및 코드 활성화 -->
                        <!--
                        <ins class="adsbygoogle"
                             style="display:block"
                             data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                             data-ad-slot="XXXXXXXXXX"
                             data-ad-format="auto"
                             data-full-width-responsive="true"></ins>
                        <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
                        -->
                    </div>

                    <div class="insight-meta-bar">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <i class="ph ph-calendar"></i>
                            <span>작성일: ${post.date || '-'}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <button id="copy-insight-link-btn" style="background:rgba(255,255,255,0.06); border:1px solid var(--border); color:var(--text-main); padding:4px 12px; border-radius:6px; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; gap:5px; transition:all 0.2s ease;">
                                <i class="ph ph-share-network"></i> 링크 복사
                            </button>
                            ${window.isDajavataAdmin ? `
                                <button id="single-admin-edit-btn" data-id="${post.id}" style="background:rgba(59,130,246,0.18); border:1px solid #3b82f6; color:#93c5fd; padding:4px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:5px; transition:all 0.2s ease;">
                                    <i class="ph ph-pencil-simple"></i> 칼럼 수정
                                </button>
                                <button id="single-admin-delete-btn" data-id="${post.id}" style="background:rgba(239,68,68,0.18); border:1px solid #ef4444; color:#fca5a5; padding:4px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:5px; transition:all 0.2s ease;">
                                    <i class="ph ph-trash"></i> 삭제
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <div class="insight-body-content">
                        ${formattedContent}
                    </div>

                    <!-- Google AdSense Bottom Slot (하단 피드 광고 공간) -->
                    <div class="dajavata-ad-slot ad-slot-bottom" id="ad-insight-bottom">
                        <!-- 구글 애드센스 승인 후 아래 주석 해제 및 코드 활성화 -->
                        <!--
                        <ins class="adsbygoogle"
                             style="display:block"
                             data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                             data-ad-slot="YYYYYYYYYY"
                             data-ad-format="auto"
                             data-full-width-responsive="true"></ins>
                        <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
                        -->
                    </div>

                    <!-- 법적 면책 고지 카드 (Google YMYL & 애드센스 필수 충족) -->
                    <div class="insight-disclaimer-card">
                        <div class="insight-disclaimer-header">
                            <i class="ph-bold ph-warning-circle"></i> 투자 유의사항 및 법적 면책 고지 (Disclaimer)
                        </div>
                        <p class="insight-disclaimer-text">
                            본 기업 분석 및 투자 인사이트는 금융감독원 전자공시시스템(DART), 한국IR협의회, 한국거래소(KRX) 공시 등 신뢰할 수 있는 공개 자료를 바탕으로 작성되었으나, 데이터의 완전성과 정확성을 100% 보장할 수는 없습니다.<br>
                            본 칼럼은 <strong>정보 제공 및 기술적 연구 목적으로만 제공</strong>되며, 특정 증권 또는 금융투자상품의 매수·매도를 추천하거나 투자 수익을 보장하지 않습니다. 모든 매매 판단과 그에 따른 투자 결과의 법적 책임은 <strong>투자자 본인</strong>에게 귀속됩니다.
                        </p>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);

        // 링크 복사 이벤트 바인딩
        const copyBtn = document.getElementById('copy-insight-link-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const currentUrl = window.location.href;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(currentUrl).then(() => {
                        showToast('칼럼 고유 링크가 클립보드에 복사되었습니다.');
                    }).catch(() => {
                        showToast('링크 복사에 실패했습니다.');
                    });
                } else {
                    showToast('링크 복사 기능이 지원되지 않는 브라우저입니다.');
                }
            });
        }

        // 관리자 전용 수정/삭제 버튼 이벤트 바인딩
        const singleEditBtn = document.getElementById('single-admin-edit-btn');
        if (singleEditBtn) {
            singleEditBtn.addEventListener('click', () => {
                if (window.openEditorModal) {
                    window.openEditorModal(post);
                }
            });
        }
        const singleDeleteBtn = document.getElementById('single-admin-delete-btn');
        if (singleDeleteBtn) {
            singleDeleteBtn.addEventListener('click', () => {
                if (window.deleteInsightPost) {
                    window.deleteInsightPost(post.id);
                }
            });
        }

        // Add back button
        const footerTr = document.createElement('tr');
        footerTr.innerHTML = `
            <td colspan="10" class="center" style="padding: 24px 10px 40px;">
                <button id="back-to-insights" style="padding: 10px 22px; background: var(--bg-card); color: white; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s ease;">
                    <i class="ph ph-arrow-left"></i> 목록으로 돌아가기
                </button>
            </td>
        `;
        tbody.appendChild(footerTr);

        document.getElementById('back-to-insights').addEventListener('click', () => {
            headerTitle.textContent = "기업 개요 및 차트 분석";
            themeBadge.textContent = "인사이트";
            updateUrlState({ view: 'insights', id: null });
            setPageSeo("기업 개요 및 차트 분석", "다자바타 종목 소개 및 시장 분석 칼럼");
            renderTable(window.allInsights, 'insights');
        });
    }

    // 테마 상세 로드 (3단계 장애 방지 캐싱 & 글로벌 프리페치 엔진)
    async function loadThemeDetails(themeName) {
        window.loadThemeDetails = loadThemeDetails;
        headerTitle.textContent = themeName + " 테마주";
        themeBadge.textContent = "테마상세";
        tbody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 40px; color: var(--text-muted);">해당 테마의 종목 데이터를 불러오는 중입니다...</td></tr>';

        // URL 및 SEO 갱신
        updateUrlState({ view: 'theme', name: themeName, id: null, tab: null, action: null });
        setPageSeo(`${themeName} 테마주 분석`, `${themeName} 관련 종목 실시간 수급 및 시세 지표`);

        // 0단계: 메모리 캐시 확인 (0ms 즉시 렌더링)
        if (window.themeDetailsCache && window.themeDetailsCache[themeName]) {
            renderTable(window.themeDetailsCache[themeName], 'stocks', true);
            return;
        }

        let stocks = null;

        // 1단계: 백엔드 API 시도
        const candidateUrls = [
            `${API_BASE}/api/themes/detail?name=${encodeURIComponent(themeName)}`,
            `${API_URL}/${encodeURIComponent(themeName)}`
        ];

        for (const url of candidateUrls) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.stocks && data.stocks.length > 0) {
                        stocks = data.stocks;
                        break;
                    }
                }
            } catch (e) {
                // 다음 시도
            }
        }

        // 2단계: 글로벌 프리페치 저장소 및 다단계 CDN 풀백
        if (!stocks) {
            try {
                const store = await getThemeDetailsStore();
                if (store) {
                    // 1) 정확한 키 일치
                    if (store[themeName]) {
                        stocks = store[themeName];
                    } else if (store[themeName.trim()]) {
                        stocks = store[themeName.trim()];
                    } else {
                        // 2) 공백/슬래시/특수문자/대소문자 정규화 일치
                        const cleanStr = s => (s || '').replace(/[\s\/\(\)\[\]\-_]/g, '').toLowerCase();
                        const normTarget = cleanStr(themeName);
                        for (const [key, val] of Object.entries(store)) {
                            if (cleanStr(key) === normTarget) {
                                stocks = val;
                                break;
                            }
                        }
                        // 3) 부분 포함 일치 (예: 미디어(방송/신문) vs 미디어)
                        if (!stocks) {
                            for (const [key, val] of Object.entries(store)) {
                                const normKey = cleanStr(key);
                                if (normKey.includes(normTarget) || normTarget.includes(normKey)) {
                                    stocks = val;
                                    break;
                                }
                            }
                        }
                    }
                }
            } catch (cdnErr) {
                console.warn('CDN theme details fallback error:', cdnErr);
            }
        }

        if (stocks && stocks.length > 0) {
            // 전체 종목(allStocks) 최신 데이터와 매핑하여 주가/등락률/지표 즉시 최신화
            if (!window.allStocks || window.allStocks.length === 0) {
                try {
                    window.allStocks = await allStocksPromise;
                } catch (e) {}
            }
            if (window.allStocks && window.allStocks.length > 0) {
                const stockMap = new Map();
                window.allStocks.forEach(s => {
                    if (s.code) stockMap.set(s.code, s);
                    if (s.name) stockMap.set(s.name, s);
                });
                stocks = stocks.map(item => {
                    const latest = stockMap.get(item.code) || stockMap.get(item.name);
                    // item이 이미 최신 실시간 시세(current_price > 0)를 가지고 있다면 구버전 latest로 덮어쓰지 않고 최우선 보존
                    const hasValidItemPrice = item.current_price != null && item.current_price > 0;
                    const hasValidItemDay1 = item.day1 != null;

                    if (latest) {
                        return {
                            ...latest,
                            ...item,
                            name: item.name || latest.name,
                            code: item.code || latest.code,
                            current_price: hasValidItemPrice ? item.current_price : (latest.current_price || item.current_price),
                            day1: hasValidItemDay1 ? item.day1 : (latest.day1 != null ? latest.day1 : item.day1),
                            day3: item.day3 != null ? item.day3 : latest.day3,
                            high52: latest.high52 !== undefined ? latest.high52 : item.high52,
                            low52: latest.low52 !== undefined ? latest.low52 : item.low52,
                            neglect52: latest.neglect52 !== undefined ? latest.neglect52 : item.neglect52,
                            high3y: latest.high3y !== undefined ? latest.high3y : item.high3y,
                            low3y: latest.low3y !== undefined ? latest.low3y : item.low3y,
                            neglect3y: latest.neglect3y !== undefined ? latest.neglect3y : item.neglect3y,
                            PBR: latest.PBR !== undefined ? latest.PBR : item.PBR,
                            PER: latest.PER !== undefined ? latest.PER : item.PER,
                            EPS: latest.EPS !== undefined ? latest.EPS : item.EPS,
                            marcap: latest.marcap !== undefined ? latest.marcap : item.marcap,
                            update: item.update || latest.update
                        };
                    }
                    return item;
                });
            }

            if (!window.themeDetailsCache) window.themeDetailsCache = {};
            window.themeDetailsCache[themeName] = stocks;
            renderTable(stocks, 'stocks', true);
        } else {
            console.error('Error fetching theme details for:', themeName);
            tbody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 40px; color: var(--danger);">상세 데이터를 불러오는 데 실패했습니다. 잠시 후 테마 목록으로 돌아갑니다.</td></tr>';
            
            setTimeout(() => {
                headerTitle.textContent = previousState.headerTitle || "전체 테마";
                themeBadge.textContent = previousState.themeBadge || "테마";
                renderTable(previousState.dataList || window.allThemes, previousState.mode || 'themes', false);
                currentPage = previousState.page || 1;
                renderCurrentPage();
            }, 2500);
        }
    }
    window.loadThemeDetails = loadThemeDetails;

    // 네이버 실시간 호가/시세 동기화 함수
    async function syncRealtimeStockQuotes(list) {
        if (!list || list.length === 0) return;
        const codes = list.map(s => s.code).filter(Boolean);
        if (codes.length === 0) return;

        try {
            const res = await fetch(`${API_BASE}/api/stocks/realtime?codes=${codes.join(',')}`);
            if (!res.ok) return;
            const data = await res.json();
            const realtimeMap = data.realtime || {};

            Object.keys(realtimeMap).forEach(code => {
                const info = realtimeMap[code];
                if (!info || info.current_price == null) return;

                // 1. 메모리 데이터 갱신
                const stock = currentDataList.find(s => s.code === code);
                if (stock) {
                    stock.current_price = info.current_price;
                    if (info.day1 != null) stock.day1 = info.day1;
                }

                // 2. 화면 행(Row) DOM 갱신
                const tr = tbody.querySelector(`tr[data-stock-code="${code}"]`);
                if (tr) {
                    const priceSpan = tr.querySelector('.cell-stock-price');
                    const day1Span = tr.querySelector('.cell-stock-day1');
                    if (priceSpan) {
                        priceSpan.textContent = new Intl.NumberFormat('ko-KR').format(info.current_price);
                    }
                    if (day1Span && info.day1 != null) {
                        const day1Class = info.day1 >= 0 ? 'pos' : 'neg';
                        const day1Sign = info.day1 > 0 ? '+' : '';
                        day1Span.className = `${day1Class} price-main cell-stock-day1`;
                        day1Span.textContent = `${day1Sign}${info.day1.toFixed(2)}%`;
                    }
                }
            });
        } catch (err) {
            // 조용히 통과 (오프라인/에러 시 기존 캐시 가격 유지)
        }
    }

    function showDefaultView() {
        const defaultView = document.getElementById('default-view-container');
        const workspace = document.getElementById('trader-workspace-container');
        const scanner = document.getElementById('chart-scanner-container');
        const quantHub = document.getElementById('quant-hub-container');
        if (defaultView) defaultView.style.display = 'flex';
        if (workspace) workspace.style.display = 'none';
        if (scanner) scanner.style.display = 'none';
        if (quantHub) quantHub.style.display = 'none';
    }

    // 테마 메뉴 클릭 이벤트
    const themeMenus = document.querySelectorAll('#theme-menu-list li');
    themeMenus.forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.preventDefault();
            showDefaultView();
            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            menu.classList.add('active');

            const action = menu.getAttribute('data-action');
            headerTitle.textContent = menu.textContent.trim();
            themeBadge.textContent = "테마";
            if (previousState) {
                previousState.headerTitle = headerTitle.textContent;
                previousState.themeBadge = themeBadge.textContent;
            }

            // URL 및 SEO 갱신
            updateUrlState({ view: null, id: null, name: null, tab: null, action: action === 'all' ? null : action });
            setPageSeo();

            if (window.allThemes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 40px; color: var(--text-muted);">데이터를 불러오는 중입니다...</td></tr>';
                return;
            }

            let filteredThemes = [...window.allThemes];
            if (action === 'rising') filteredThemes = filteredThemes.filter(t => t.day1Pos);
            else if (action === 'falling') filteredThemes = filteredThemes.filter(t => !t.day1Pos);
            else if (action === 'high-return') filteredThemes.sort((a, b) => parseFloat(b.expReturn) - parseFloat(a.expReturn));
            else if (action === 'neglected') filteredThemes.sort((a, b) => parseFloat(b.neglect52) - parseFloat(a.neglect52));

            renderTable(filteredThemes, 'themes');
        });
    });

    // 조건별 종목 메뉴 클릭 이벤트
    const stockMenus = document.querySelectorAll('#stock-menu-list li');
    stockMenus.forEach(menu => {
        menu.addEventListener('click', async (e) => {
            e.preventDefault();
            showDefaultView();
            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            menu.classList.add('active');

            const action = menu.getAttribute('data-action');
            headerTitle.textContent = menu.textContent.trim();
            themeBadge.textContent = "종목";
            if (previousState) {
                previousState.headerTitle = headerTitle.textContent;
                previousState.themeBadge = themeBadge.textContent;
            }

            // URL 및 SEO 갱신
            updateUrlState({ view: 'stocks', action: action, id: null, name: null, tab: null });
            setPageSeo(headerTitle.textContent, `다자바타 조건별 종목 분석 - ${headerTitle.textContent}`);

            tbody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 40px; color: var(--text-muted);">전 종목 데이터를 불러오는 중입니다...</td></tr>';

            try {
                let stocks = await loadAllStocks();
                if (!stocks || stocks.length === 0) {
                    throw new Error("No stocks loaded");
                }
                updateHeaderBadge();

                let filtered = [...stocks];
                if (action === 'stock-rising') {
                    filtered = filtered.filter(s => s.day3 > 0).sort((a, b) => b.day3 - a.day3);
                } else if (action === 'stock-falling') {
                    filtered = filtered.filter(s => s.day3 < 0).sort((a, b) => a.day3 - b.day3);
                } else if (action === 'stock-low-pbr') {
                    filtered = filtered.filter(s => s.PBR > 0).sort((a, b) => a.PBR - b.PBR);
                } else if (action === 'stock-low-per') {
                    filtered = filtered.filter(s => s.PER > 0).sort((a, b) => a.PER - b.PER);
                } else if (action === 'stock-high-marcap') {
                    filtered = filtered.sort((a, b) => (b.marcap || 0) - (a.marcap || 0));
                } else if (action === 'stock-high52') {
                    filtered = filtered.filter(s => s.high52 !== null && s.high52 < 5).sort((a, b) => (a.high52 || 0) - (b.high52 || 0));
                }
                
                renderTable(filtered, 'stocks');
            } catch (error) {
                console.error('Error fetching stock data:', error);
                tbody.innerHTML = `<tr><td colspan="12" class="center" style="padding: 40px;">
                    <div style="color: #ef4444; font-weight: 600; margin-bottom: 8px;">종목 데이터를 불러오는 데 실패했습니다.</div>
                    <button onclick="window.location.reload()" style="background: var(--primary, #3b82f6); color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px;">새로고침</button>
                </td></tr>`;
            }
        });
    });

    // 인사이트 메뉴 클릭 이벤트
    const insightMenus = document.querySelectorAll('#insight-menu-list li');
    insightMenus.forEach(menu => {
        menu.addEventListener('click', async (e) => {
            e.preventDefault();
            showDefaultView();
            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            menu.classList.add('active');

            const action = menu.getAttribute('data-action');
            headerTitle.textContent = menu.textContent.trim();
            themeBadge.textContent = "인사이트";
            if (previousState) {
                previousState.headerTitle = headerTitle.textContent;
                previousState.themeBadge = themeBadge.textContent;
            }

            // URL 및 SEO 갱신
            updateUrlState({ view: 'insights', id: null, name: null, tab: null, action: null });
            setPageSeo("기업 개요 및 차트 분석", "다자바타 종목 소개 및 시장 분석 칼럼");

            tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px; color: var(--text-muted);">노션에서 데이터를 불러오는 중입니다...</td></tr>';

            const insights = await loadInsights();

            // 헤더 먼저 업데이트
            const thead = document.querySelector('#theme-table thead');
            thead.innerHTML = `
                <tr>
                    <th style="width: 15%">작성일</th>
                    <th style="width: 85%">기업 개요 및 차트 분석</th>
                </tr>
            `;

            if (insights.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="center" style="padding: 40px;">등록된 글이 없거나 불러오지 못했습니다. 노션에 글을 작성해주세요.</td></tr>';
                return;
            }
            renderTable(insights, 'insights');
        });
    });

    // AI 차트 스캐너 메뉴 클릭 이벤트
    const scannerMenus = document.querySelectorAll('#scanner-menu-list li');
    scannerMenus.forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.preventDefault();
            updateUrlState({ view: 'scanner', id: null, name: null, tab: null, action: null });
            setPageSeo("AI 차트 스캐너", "다자바타 AI 실시간 차트 분석 및 시그널 랩");
            if (window.ChartScanner) {
                window.ChartScanner.show();
            }
        });
    });

    // 글로벌 퀀트 & 마켓 인텔리전스 메뉴 클릭 이벤트
    const quantMenus = document.querySelectorAll('#quant-menu-list li');
    quantMenus.forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.preventDefault();
            const action = menu.getAttribute('data-action');
            const mkt = (window.QuantHub && window.QuantHub.market) ? window.QuantHub.market : 'KR';
            updateUrlState({ view: 'quant', tab: action, market: mkt, id: null, name: null, action: null });
            setPageSeo(menu.textContent.trim(), "다자바타 국내주식(KRX) & 미국주식(US) 통합 퀀트 인텔리전스 허브");
            if (window.ChartScanner) {
                window.ChartScanner.hide();
            }
            if (window.QuantHub) {
                window.QuantHub.navigate(action);
            }
        });
    });

    // 트레이더 룸 메뉴 클릭 이벤트
    const traderMenus = document.querySelectorAll('#trader-menu-list li');
    traderMenus.forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.preventDefault();
            const action = menu.getAttribute('data-action');
            updateUrlState({ view: 'trader', tab: action, id: null, name: null, action: null });
            setPageSeo("트레이더 룸", "다자바타 트레이더 맞춤형 매매 시나리오 및 리스크 관리 도구");
            if (window.ChartScanner) {
                window.ChartScanner.hide();
            }
            if (window.TraderRoom) {
                window.TraderRoom.navigate(action);
            }
        });
    });

    // =============================================================
    // [신규] 글로벌 푸터 법적 정책 모달 & 테마 전환 이벤트 핸들러
    // =============================================================
    const legalModal = document.getElementById('dajavata-legal-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const footerLinkBtns = document.querySelectorAll('.footer-link-btn');
    const modalTabBtns = document.querySelectorAll('.modal-tab-btn');
    const modalPanes = document.querySelectorAll('.modal-tab-pane');
    const footerThemeToggle = document.getElementById('footer-theme-toggle');
    const footerThemeLabel = document.getElementById('footer-theme-label');

    function openLegalModal(tabId) {
        if (!legalModal) return;
        legalModal.style.display = 'flex';
        void legalModal.offsetWidth;
        legalModal.classList.add('active');
        switchLegalTab(tabId || 'terms');
    }

    function closeLegalModal() {
        if (!legalModal) return;
        legalModal.classList.remove('active');
        setTimeout(() => {
            if (!legalModal.classList.contains('active')) {
                legalModal.style.display = 'none';
            }
        }, 250);
    }

    function switchLegalTab(tabId) {
        modalTabBtns.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        modalPanes.forEach(pane => {
            if (pane.id === `pane-${tabId}`) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });
    }

    footerLinkBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = btn.getAttribute('data-legal');
            openLegalModal(tabId);
        });
    });

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeLegalModal);
    }

    if (legalModal) {
        legalModal.addEventListener('click', (e) => {
            if (e.target === legalModal) {
                closeLegalModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && legalModal && legalModal.classList.contains('active')) {
            closeLegalModal();
        }
    });

    modalTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchLegalTab(tabId);
        });
    });

    // 라이트/다크 테마 토글
    if (footerThemeToggle) {
        const savedTheme = localStorage.getItem('dajavata_theme') || 'dark';
        if (savedTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            document.body.classList.add('light-theme');
            if (footerThemeLabel) footerThemeLabel.textContent = '다크 테마로';
            const icon = footerThemeToggle.querySelector('i');
            if (icon) icon.className = 'ph ph-moon';
        }

        footerThemeToggle.addEventListener('click', () => {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            if (isLight) {
                document.documentElement.removeAttribute('data-theme');
                document.body.classList.remove('light-theme');
                localStorage.setItem('dajavata_theme', 'dark');
                if (footerThemeLabel) footerThemeLabel.textContent = '라이트 테마로';
                const icon = footerThemeToggle.querySelector('i');
                if (icon) icon.className = 'ph ph-sun';
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                document.body.classList.add('light-theme');
                localStorage.setItem('dajavata_theme', 'light');
                if (footerThemeLabel) footerThemeLabel.textContent = '다크 테마로';
                const icon = footerThemeToggle.querySelector('i');
                if (icon) icon.className = 'ph ph-moon';
            }
        });
    }

    // =========================================================================
    // [다자바타 자체 관리자 웹 에디터 (CMS)] 통합 컨트롤러
    // =========================================================================
    function canvasToBlocks(canvasEl) {
        const blocks = [];
        const children = Array.from(canvasEl.children);
        
        if (children.length === 0) {
            const raw = canvasEl.innerText.trim();
            if (raw.length > 0) {
                blocks.push({ type: 'paragraph', text: raw });
            }
            return blocks;
        }

        children.forEach(child => {
            const tag = child.tagName ? child.tagName.toLowerCase() : '';

            if (tag === 'h1') {
                blocks.push({ type: 'heading', level: 1, text: child.innerText.trim() });
            } else if (tag === 'h2') {
                blocks.push({ type: 'heading', level: 2, text: child.innerText.trim() });
            } else if (tag === 'h3') {
                blocks.push({ type: 'heading', level: 3, text: child.innerText.trim() });
            } else if (tag === 'hr') {
                blocks.push({ type: 'divider' });
            } else if (tag === 'ul') {
                child.querySelectorAll('li').forEach(li => {
                    const txt = li.innerText.trim();
                    if (txt) blocks.push({ type: 'bulleted_list_item', text: txt });
                });
            } else if (tag === 'ol') {
                child.querySelectorAll('li').forEach(li => {
                    const txt = li.innerText.trim();
                    if (txt) blocks.push({ type: 'numbered_list_item', text: txt });
                });
            } else if (tag === 'blockquote') {
                blocks.push({ type: 'quote', text: child.innerText.trim() });
            } else if (child.classList && child.classList.contains('editor-callout-box')) {
                blocks.push({ type: 'callout', text: child.innerText.trim() });
            } else if (tag === 'table') {
                const rows = [];
                let hasHeader = false;
                child.querySelectorAll('tr').forEach(tr => {
                    const rowCells = [];
                    tr.querySelectorAll('th, td').forEach(c => {
                        if (c.tagName.toLowerCase() === 'th') hasHeader = true;
                        rowCells.push(c.innerText.trim());
                    });
                    if (rowCells.length > 0) rows.push(rowCells);
                });
                if (rows.length > 0) {
                    blocks.push({ type: 'table', has_header: hasHeader || true, rows: rows });
                }
            } else if (tag === 'figure' || child.querySelector('img')) {
                const img = tag === 'img' ? child : child.querySelector('img');
                const figcaption = child.querySelector('figcaption');
                if (img && img.src) {
                    blocks.push({
                        type: 'image',
                        url: img.src,
                        caption: figcaption ? figcaption.innerText.trim() : ''
                    });
                }
            } else if (tag === 'img') {
                blocks.push({ type: 'image', url: child.src, caption: '' });
            } else {
                const txt = child.innerText.trim();
                if (txt.length > 0) {
                    blocks.push({ type: 'paragraph', text: txt });
                }
            }
        });

        return blocks;
    }

    function initAdminCMS() {
        const adminAuthModal = document.getElementById('dajavata-admin-auth-modal');
        const adminPinInput = document.getElementById('admin-pin-input');
        const adminAuthSubmitBtn = document.getElementById('admin-auth-submit-btn');
        const adminAuthCloseBtn = document.getElementById('admin-auth-close-btn');
        const adminAuthCancelBtn = document.getElementById('admin-auth-cancel-btn');
        const adminPinError = document.getElementById('admin-pin-error');

        const adminNewPostBtn = document.getElementById('admin-new-post-btn');
        const adminActiveBadge = document.getElementById('admin-active-badge');
        const footerAdminBtn = document.getElementById('footer-admin-btn');

        const editorModal = document.getElementById('dajavata-editor-modal');
        const editorModalCloseBtn = document.getElementById('editor-modal-close-btn');
        const editorModalTitle = document.getElementById('editor-modal-title');
        const editorDraftStatus = document.getElementById('editor-draft-status');
        const editorPostTitle = document.getElementById('editor-post-title');
        const editorPostDate = document.getElementById('editor-post-date');
        const editorPostTicker = document.getElementById('editor-post-ticker');
        const editorContentCanvas = document.getElementById('editor-content-canvas');
        const editorPreviewContainer = document.getElementById('editor-preview-container');
        const btnTogglePreview = document.getElementById('btn-toggle-preview');
        const btnDraftSave = document.getElementById('btn-draft-save');
        const btnEditorCancel = document.getElementById('btn-editor-cancel');
        const btnPublishPost = document.getElementById('btn-publish-post');
        const btnInsertTable = document.getElementById('btn-insert-table');
        const btnInsertCallout = document.getElementById('btn-insert-callout');
        const editorImageFileInput = document.getElementById('editor-image-file-input');

        let currentEditingPostId = null;
        let draftTimer = null;

        function updateAdminUI() {
            const isAdmin = (sessionStorage.getItem('dajavata_admin') === '1');
            window.isDajavataAdmin = isAdmin;
            if (adminNewPostBtn) adminNewPostBtn.style.display = isAdmin ? 'inline-flex' : 'none';
            if (adminActiveBadge) adminActiveBadge.style.display = isAdmin ? 'inline-flex' : 'none';
            if (footerAdminBtn) footerAdminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
            const footerAdminDot = document.getElementById('footer-admin-dot');
            if (footerAdminDot) footerAdminDot.style.display = isAdmin ? 'inline-block' : 'none';
        }
        updateAdminUI();

        // 1. PIN 인증 모달 (보안 및 무차별 대입 방지)
        function openAuthModal() {
            if (!adminAuthModal) return;
            if (adminPinInput) adminPinInput.value = '';
            if (adminPinError) {
                adminPinError.style.display = 'none';
                adminPinError.textContent = 'PIN 번호가 일치하지 않습니다.';
            }

            // 5회 연속 실패 락아웃 검사
            const lockoutUntil = parseInt(sessionStorage.getItem('dajavata_admin_lockout') || '0', 10);
            const now = Date.now();
            if (now < lockoutUntil) {
                const remainSec = Math.ceil((lockoutUntil - now) / 1000);
                if (adminPinError) {
                    adminPinError.textContent = `연속 5회 실패로 입력이 일시 제한되었습니다. (${remainSec}초 후 재시도)`;
                    adminPinError.style.display = 'block';
                }
            }

            adminAuthModal.style.display = 'flex';
            adminAuthModal.classList.add('active');
            setTimeout(() => { if (adminPinInput) adminPinInput.focus(); }, 120);
        }

        function closeAuthModal() {
            if (!adminAuthModal) return;
            adminAuthModal.classList.remove('active');
            adminAuthModal.style.display = 'none';
        }

        async function handleAuthSubmit() {
            const lockoutUntil = parseInt(sessionStorage.getItem('dajavata_admin_lockout') || '0', 10);
            const now = Date.now();
            if (now < lockoutUntil) {
                const remainSec = Math.ceil((lockoutUntil - now) / 1000);
                if (adminPinError) {
                    adminPinError.textContent = `비밀번호 5회 연속 오류로 입력이 차단되었습니다. (${remainSec}초 남음)`;
                    adminPinError.style.display = 'block';
                }
                return;
            }

            const pin = (adminPinInput ? adminPinInput.value : '').trim();
            if (pin === '4537') {
                sessionStorage.removeItem('dajavata_admin_fails');
                sessionStorage.removeItem('dajavata_admin_lockout');
                sessionStorage.setItem('dajavata_admin', '1');
                updateAdminUI();
                closeAuthModal();
                showToast('관리자 인증이 완료되었습니다.');
                if (currentMode === 'insights') {
                    renderTable(window.allInsights, 'insights');
                }
                return;
            }

            // 백엔드 API 보조 검증 (PIN 4537)
            try {
                const res = await fetch(`${API_BASE}/api/insights/verify-admin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: pin })
                });
                const data = await res.json();
                if (data.valid) {
                    sessionStorage.removeItem('dajavata_admin_fails');
                    sessionStorage.removeItem('dajavata_admin_lockout');
                    sessionStorage.setItem('dajavata_admin', '1');
                    updateAdminUI();
                    closeAuthModal();
                    showToast('관리자 인증이 완료되었습니다.');
                    if (currentMode === 'insights') {
                        renderTable(window.allInsights, 'insights');
                    }
                    return;
                }
            } catch (e) {}

            // 실패 카운트 증가 및 5회 실패 시 5분 차단
            let fails = parseInt(sessionStorage.getItem('dajavata_admin_fails') || '0', 10) + 1;
            if (fails >= 5) {
                sessionStorage.setItem('dajavata_admin_lockout', String(Date.now() + 5 * 60 * 1000));
                sessionStorage.setItem('dajavata_admin_fails', '0');
                if (adminPinError) {
                    adminPinError.textContent = '비밀번호를 5회 연속 잘못 입력하여 5분간 입력이 제한됩니다.';
                    adminPinError.style.display = 'block';
                }
            } else {
                sessionStorage.setItem('dajavata_admin_fails', String(fails));
                if (adminPinError) {
                    adminPinError.textContent = `PIN 번호가 일치하지 않습니다. (실패 ${fails}/5회)`;
                    adminPinError.style.display = 'block';
                }
                if (adminPinInput) adminPinInput.focus();
            }
        }

        if (adminAuthSubmitBtn) adminAuthSubmitBtn.addEventListener('click', handleAuthSubmit);
        if (adminPinInput) {
            adminPinInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleAuthSubmit();
            });
        }
        if (adminAuthCloseBtn) adminAuthCloseBtn.addEventListener('click', closeAuthModal);
        if (adminAuthCancelBtn) adminAuthCancelBtn.addEventListener('click', closeAuthModal);
        if (adminAuthModal) {
            adminAuthModal.addEventListener('click', (e) => {
                if (e.target === adminAuthModal) closeAuthModal();
            });
        }

        // 푸터 관리자 버튼 (로그인 상태에서만 로그아웃 버튼으로 작동)
        if (footerAdminBtn) {
            footerAdminBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.isDajavataAdmin) {
                    if (confirm('현재 관리자 모드입니다.\n관리자 모드를 종료(로그아웃)하시겠습니까?')) {
                        sessionStorage.removeItem('dajavata_admin');
                        updateAdminUI();
                        showToast('관리자 모드가 종료되었습니다.');
                        if (currentMode === 'insights') {
                            renderTable(window.allInsights, 'insights');
                        }
                    }
                } else {
                    openAuthModal();
                }
            });
        }

        // 비밀 진입 방법 1: 키보드 단축키 Ctrl+Shift+A (또는 Mac Cmd+Shift+A)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a' || e.code === 'KeyA')) {
                e.preventDefault();
                openAuthModal();
            }
        });

        // 비밀 진입 방법 2: URL ?admin=1 자동 감지
        try {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('admin') === '1' && !window.isDajavataAdmin) {
                openAuthModal();
            }
        } catch (e) {}

        // 2. 에디터 열기/닫기
        window.openEditorModal = function(post = null) {
            if (!editorModal) return;

            // 미리보기 모드 리셋
            if (editorPreviewContainer) editorPreviewContainer.style.display = 'none';
            if (editorContentCanvas) editorContentCanvas.style.display = 'block';
            if (btnTogglePreview) btnTogglePreview.innerHTML = '<i class="ph ph-eye"></i> 미리보기';

            if (post) {
                currentEditingPostId = post.id;
                if (editorModalTitle) editorModalTitle.textContent = '칼럼 수정';
                if (editorPostTitle) editorPostTitle.value = post.title || '';
                if (editorPostDate) editorPostDate.value = post.date || new Date().toISOString().slice(0, 10);
                
                const tickerMatch = (post.title || '').match(/\((\d{6})\)/);
                if (editorPostTicker) editorPostTicker.value = tickerMatch ? tickerMatch[1] : '';

                if (editorContentCanvas) {
                    editorContentCanvas.innerHTML = blocksToHtml(post.blocks);
                }
                if (editorDraftStatus) editorDraftStatus.textContent = '기존 칼럼 불러옴';
            } else {
                currentEditingPostId = null;
                if (editorModalTitle) editorModalTitle.textContent = '기업 분석 & 차트 칼럼 에디터';
                if (editorPostTitle) editorPostTitle.value = '';
                if (editorPostDate) editorPostDate.value = new Date().toISOString().slice(0, 10);
                if (editorPostTicker) editorPostTicker.value = '';

                // 임시저장 데이터 확인
                const savedDraft = localStorage.getItem('dajavata_post_draft');
                if (savedDraft) {
                    try {
                        const d = JSON.parse(savedDraft);
                        if (editorPostTitle) editorPostTitle.value = d.title || '';
                        if (editorPostDate && d.date) editorPostDate.value = d.date;
                        if (editorPostTicker) editorPostTicker.value = d.ticker || '';
                        if (editorContentCanvas) editorContentCanvas.innerHTML = d.html || '<p>이곳에 기업 분석 내용을 작성하세요...</p>';
                        if (editorDraftStatus) editorDraftStatus.textContent = `임시저장 복원됨 (${d.savedAt || ''})`;
                    } catch (e) {
                        if (editorContentCanvas) editorContentCanvas.innerHTML = '<p>이곳에 기업 분석 내용을 작성하세요...</p>';
                    }
                } else {
                    if (editorContentCanvas) editorContentCanvas.innerHTML = '<p>이곳에 기업 분석 및 차트 분석 내용을 작성하세요...</p>';
                    if (editorDraftStatus) editorDraftStatus.textContent = '새 작성 모드';
                }
            }

            editorModal.style.display = 'flex';
            editorModal.classList.add('active');
            setTimeout(() => {
                if (editorContentCanvas) editorContentCanvas.focus();
            }, 100);
        };

        function closeEditorModal() {
            if (!editorModal) return;
            editorModal.classList.remove('active');
            editorModal.style.display = 'none';
        }

        if (adminNewPostBtn) {
            adminNewPostBtn.addEventListener('click', () => {
                window.openEditorModal(null);
            });
        }
        if (editorModalCloseBtn) editorModalCloseBtn.addEventListener('click', closeEditorModal);
        if (btnEditorCancel) btnEditorCancel.addEventListener('click', closeEditorModal);

        // 3. 서식 툴바 (execCommand)
        document.querySelectorAll('.editor-tool-btn[data-cmd]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const cmd = btn.getAttribute('data-cmd');
                const val = btn.getAttribute('data-val') || null;
                if (editorContentCanvas) {
                    editorContentCanvas.focus();
                    document.execCommand(cmd, false, val);
                }
            });
        });

        // 4. 표 삽입
        if (btnInsertTable) {
            btnInsertTable.addEventListener('click', (e) => {
                e.preventDefault();
                const rowsInput = prompt('표의 행(Row) 개수를 입력하세요 (헤더 포함):', '4');
                if (!rowsInput) return;
                const colsInput = prompt('표의 열(Column) 개수를 입력하세요:', '3');
                if (!colsInput) return;

                const r = Math.max(1, Math.min(20, parseInt(rowsInput) || 4));
                const c = Math.max(1, Math.min(10, parseInt(colsInput) || 3));

                let tableHtml = '<table style="width:100%; border-collapse:collapse; margin:18px 0; font-size:14px; text-align:left;">';
                for (let i = 0; i < r; i++) {
                    tableHtml += '<tr>';
                    for (let j = 0; j < c; j++) {
                        if (i === 0) {
                            tableHtml += `<th style="border:1px solid var(--border); padding:10px; background:rgba(255,255,255,0.06); color:white;">구분 ${j + 1}</th>`;
                        } else {
                            tableHtml += `<td style="border:1px solid var(--border); padding:10px; color:var(--text-main);">내용</td>`;
                        }
                    }
                    tableHtml += '</tr>';
                }
                tableHtml += '</table><p><br></p>';

                if (editorContentCanvas) {
                    editorContentCanvas.focus();
                    document.execCommand('insertHTML', false, tableHtml);
                }
            });
        }

        // 5. 핵심 요약 박스 삽입
        if (btnInsertCallout) {
            btnInsertCallout.addEventListener('click', (e) => {
                e.preventDefault();
                const calloutHtml = `
                    <div class="editor-callout-box" style="background: rgba(59,130,246,0.08); border-left: 4px solid var(--primary); padding: 14px 16px; border-radius: 6px; margin: 18px 0; font-size: 14px; line-height: 1.6; color: var(--text-main);">
                        <strong>💡 핵심 요약:</strong> 핵심 투자 포인트 또는 리스크 요인을 입력하세요.
                    </div><p><br></p>
                `;
                if (editorContentCanvas) {
                    editorContentCanvas.focus();
                    document.execCommand('insertHTML', false, calloutHtml);
                }
            });
        }

        // 6. 이미지 WebP 캔버스 압축 & 본문 삽입 함수
        function processAndInsertImage(file) {
            if (!file || !file.type.startsWith('image/')) {
                showToast('이미지 파일만 삽입할 수 있습니다.');
                return;
            }
            showToast('이미지 고효율 WebP 압축 중...');
            const reader = new FileReader();
            reader.onload = function(evt) {
                const img = new Image();
                img.onload = function() {
                    const maxWidth = 1200;
                    let w = img.width;
                    let h = img.height;
                    if (w > maxWidth) {
                        h = Math.round((h * maxWidth) / w);
                        w = maxWidth;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    const webpDataUrl = canvas.toDataURL('image/webp', 0.82);

                    const figureHtml = `
                        <figure style="margin: 20px 0; text-align: center;">
                            <img src="${webpDataUrl}" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.3);">
                            <figcaption style="font-size: 12px; color: var(--text-muted); margin-top: 8px; text-align: center;">[사진 설명 입력]</figcaption>
                        </figure><p><br></p>
                    `;
                    if (editorContentCanvas) {
                        editorContentCanvas.focus();
                        document.execCommand('insertHTML', false, figureHtml);
                        showToast('이미지 삽입 완료 (WebP 고효율 압축)');
                    }
                };
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        }

        // 캔버스 내 클립보드 붙여넣기 (Ctrl+V) 핸들러
        if (editorContentCanvas) {
            editorContentCanvas.addEventListener('paste', (e) => {
                if (e.clipboardData && e.clipboardData.items) {
                    for (let i = 0; i < e.clipboardData.items.length; i++) {
                        const item = e.clipboardData.items[i];
                        if (item.type && item.type.indexOf('image') !== -1) {
                            e.preventDefault();
                            const blob = item.getAsFile();
                            processAndInsertImage(blob);
                            return;
                        }
                    }
                }
            });
        }

        // 파일 선택 인풋 핸들러
        if (editorImageFileInput) {
            editorImageFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    processAndInsertImage(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }

        // 7. 자동 임시저장 (Autosave)
        function autoSaveDraft() {
            if (currentEditingPostId) return; // 기존 글 수정 중에는 초안 덮어쓰기 방지
            const draft = {
                title: editorPostTitle ? editorPostTitle.value.trim() : '',
                date: editorPostDate ? editorPostDate.value : '',
                ticker: editorPostTicker ? editorPostTicker.value.trim() : '',
                html: editorContentCanvas ? editorContentCanvas.innerHTML : '',
                savedAt: new Date().toLocaleTimeString('ko-KR')
            };
            localStorage.setItem('dajavata_post_draft', JSON.stringify(draft));
            if (editorDraftStatus) {
                editorDraftStatus.textContent = `자동 임시저장 (${draft.savedAt})`;
            }
        }

        if (editorContentCanvas) {
            editorContentCanvas.addEventListener('input', () => {
                clearTimeout(draftTimer);
                draftTimer = setTimeout(autoSaveDraft, 1500);
            });
        }
        if (editorPostTitle) {
            editorPostTitle.addEventListener('input', () => {
                clearTimeout(draftTimer);
                draftTimer = setTimeout(autoSaveDraft, 1500);
            });
        }
        if (btnDraftSave) {
            btnDraftSave.addEventListener('click', () => {
                autoSaveDraft();
                showToast('초안이 브라우저에 임시저장되었습니다.');
            });
        }

        // 8. 실시간 미리보기 토글
        if (btnTogglePreview) {
            btnTogglePreview.addEventListener('click', () => {
                const isPreview = (editorPreviewContainer && editorPreviewContainer.style.display !== 'none');
                if (isPreview) {
                    editorPreviewContainer.style.display = 'none';
                    editorContentCanvas.style.display = 'block';
                    btnTogglePreview.innerHTML = '<i class="ph ph-eye"></i> 미리보기';
                } else {
                    const title = (editorPostTitle ? editorPostTitle.value.trim() : '') || '칼럼 제목 없음';
                    const date = (editorPostDate ? editorPostDate.value : '') || new Date().toISOString().slice(0, 10);
                    const bodyHtml = editorContentCanvas ? editorContentCanvas.innerHTML : '';

                    if (editorPreviewContainer) {
                        editorPreviewContainer.innerHTML = `
                            <div style="padding: 10px 0 20px;">
                                <h1 style="color: white; font-size: 24px; margin-bottom: 8px;">${escapeHtml(title)}</h1>
                                <div class="insight-meta-bar" style="margin-bottom: 20px;">
                                    <span>작성일: ${date}</span>
                                    <span style="color: var(--accent); font-weight: 600;">[실시간 미리보기]</span>
                                </div>
                                <div class="insight-body-content">
                                    ${bodyHtml}
                                </div>
                                <div class="insight-disclaimer-card" style="margin-top: 30px;">
                                    <div class="insight-disclaimer-header">
                                        <i class="ph-bold ph-warning-circle"></i> 투자 유의사항 및 법적 면책 고지 (미리보기)
                                    </div>
                                    <p class="insight-disclaimer-text">
                                        본 기업 분석은 정보 제공 목적으로 작성되었으며 모든 투자 판단의 최종 책임은 투자자 본인에게 귀속됩니다.
                                    </p>
                                </div>
                            </div>
                        `;
                        editorContentCanvas.style.display = 'none';
                        editorPreviewContainer.style.display = 'block';
                        btnTogglePreview.innerHTML = '<i class="ph ph-pencil-simple"></i> 에디터로 복귀';
                    }
                }
            });
        }

        // 9. 사이트에 즉시 발행 (Save & Publish)
        if (btnPublishPost) {
            btnPublishPost.addEventListener('click', async () => {
                let title = editorPostTitle ? editorPostTitle.value.trim() : '';
                if (!title) {
                    alert('칼럼 제목을 입력해주세요.');
                    if (editorPostTitle) editorPostTitle.focus();
                    return;
                }

                // 종목코드가 입력되어 있고 제목에 코드가 없는 경우 자동 결합 (예: 삼성전자(005930) 기업 분석)
                const ticker = editorPostTicker ? editorPostTicker.value.trim() : '';
                if (ticker && !title.includes(ticker)) {
                    title = `${title} (${ticker})`;
                }

                const date = (editorPostDate ? editorPostDate.value : '') || new Date().toISOString().slice(0, 10);
                const blocks = canvasToBlocks(editorContentCanvas);
                if (blocks.length === 0) {
                    alert('본문 내용을 입력해주세요.');
                    if (editorContentCanvas) editorContentCanvas.focus();
                    return;
                }

                const postId = currentEditingPostId || ('post-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6));
                const newPost = {
                    id: postId,
                    title: title,
                    date: date,
                    blocks: blocks,
                    updated_at: new Date().toISOString()
                };

                // 1단계: 브라우저 메모리 즉시 반영 (0ms)
                if (!window.allInsights) window.allInsights = [];
                const existingIdx = window.allInsights.findIndex(p => String(p.id) === String(postId));
                if (existingIdx !== -1) {
                    window.allInsights[existingIdx] = newPost;
                } else {
                    window.allInsights.unshift(newPost);
                }

                // 2단계: 브라우저 localStorage 로컬 DB 영구 보존
                const localDb = { posts: window.allInsights, updated_at: new Date().toISOString() };
                localStorage.setItem('dajavata_local_insights_db', JSON.stringify(localDb));
                localStorage.removeItem('dajavata_post_draft');

                // 3단계: 백엔드 API 영구 저장 시도
                try {
                    showToast('서버에 칼럼 저장 중...');
                    const res = await fetch(`${API_BASE}/api/insights/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pin: '4537',
                            post: newPost
                        })
                    });
                    if (res.ok) {
                        showToast('칼럼이 성공적으로 발행되었습니다!');
                    } else {
                        showToast('로컬에 안전하게 저장되었습니다.');
                    }
                } catch (err) {
                    console.warn('Backend save failed, saved locally:', err);
                    showToast('로컬 저장 완료 (오프라인 모드)');
                }

                closeEditorModal();
                headerTitle.textContent = "기업 개요 및 차트 분석";
                themeBadge.textContent = "인사이트";
                renderTable(window.allInsights, 'insights');
            });
        }

        // 10. 칼럼 삭제 핸들러
        window.deleteInsightPost = async function(id) {
            const post = (window.allInsights || []).find(p => String(p.id) === String(id));
            const postTitle = post ? post.title : '해당';
            if (!confirm(`"${postTitle}" 칼럼을 정말 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`)) {
                return;
            }

            // 1단계: 메모리 삭제
            window.allInsights = (window.allInsights || []).filter(p => String(p.id) !== String(id));

            // 2단계: 로컬 DB 반영
            const localDb = { posts: window.allInsights, updated_at: new Date().toISOString() };
            localStorage.setItem('dajavata_local_insights_db', JSON.stringify(localDb));

            // 3단계: 백엔드 API 삭제 호출
            try {
                await fetch(`${API_BASE}/api/insights/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: '4537', id: id })
                });
                showToast('칼럼이 삭제되었습니다.');
            } catch (e) {
                console.warn('Backend delete failed, updated locally:', e);
                showToast('로컬 목록에서 삭제되었습니다.');
            }

            // 4단계: 뷰 재렌더링
            renderTable(window.allInsights, 'insights');
        };
    }

    // =========================================================================
    // [방식 A] 개별 종목 실전 매수·매도 종합 브리핑 & 타점 분석 모달 엔진
    // =========================================================================
    function initStockBriefingModal() {
        if (document.getElementById('stock-briefing-modal-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'stock-briefing-modal-overlay';
        overlay.className = 'dajavata-modal-overlay';
        overlay.innerHTML = `
            <div class="sb-modal-card" id="sb-modal-card">
                <div class="sb-modal-header">
                    <div class="sb-title-group">
                        <span class="sb-market-badge" id="sb-market-badge">KRX</span>
                        <span class="sb-stock-name" id="sb-stock-name">종목명</span>
                        <span class="sb-stock-code" id="sb-stock-code">000000</span>
                        <span class="sb-price-hero" id="sb-price-hero">0원</span>
                        <span id="sb-change-hero" style="font-size:14px; font-weight:800;">0.00%</span>
                        <span class="sb-verdict-badge" id="sb-verdict-badge">AI 분석 중...</span>
                    </div>
                    <div class="sb-header-actions">
                        <button type="button" class="sb-action-btn primary" id="sb-btn-open-scanner" title="AI 차트 스캐너 전체화면에서 15종 작도 도구와 ICT 구름대로 정밀 분석">
                            <i class="ph ph-CornersOut"></i> AI 차트 스캐너 크게 열기
                        </button>
                        <button type="button" class="sb-action-btn calc" id="sb-btn-open-calc" title="현재가·손절가·목표가를 트레이더 룸 리스크 계산기로 즉시 전송하여 적정 매수 주식 수 계산">
                            <i class="ph ph-calculator"></i> 리스크 계산기로 타점 전송
                        </button>
                        <button type="button" class="sb-action-btn star" id="sb-btn-add-focus" title="트레이더 룸 [오늘의 매매] 관심종목 체크리스트에 즉시 추가">
                            <i class="ph ph-star"></i> 오늘의 관심종목 등록
                        </button>
                        <button type="button" class="sb-close-btn" id="sb-btn-close" title="닫기 (ESC)">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                </div>

                <div class="sb-modal-body">
                    <!-- 1. AI 매수/매도 핵심 타점 4단 매트릭스 -->
                    <div class="sb-target-grid">
                        <div class="sb-target-box" style="border-left: 3px solid #38bdf8;">
                            <div class="lbl"><span>🎯 추천 매수 진입 구간</span><span style="color:#38bdf8;">ENTRY</span></div>
                            <div class="val" id="sb-val-entry">-</div>
                            <div class="sub" id="sb-sub-entry">현재가 및 1차 눌림 지지선 기준</div>
                        </div>
                        <div class="sb-target-box" style="border-left: 3px solid #ef4444;">
                            <div class="lbl"><span>✂️ 원칙 손절가 (무효화선)</span><span style="color:#f87171;">STOP (-1R)</span></div>
                            <div class="val" id="sb-val-stop" style="color:#f87171;">-</div>
                            <div class="sub" id="sb-sub-stop">ATR 변동성 및 직전 스윙 저점</div>
                        </div>
                        <div class="sb-target-box" style="border-left: 3px solid #10b981;">
                            <div class="lbl"><span>🚀 1차 / 2차 익절 목표가</span><span style="color:#34d399;">TARGET (+2R)</span></div>
                            <div class="val" id="sb-val-target" style="color:#34d399;">-</div>
                            <div class="sub" id="sb-sub-target">손익비 1:2.0 및 전고점 매물대</div>
                        </div>
                        <div class="sb-target-box" style="border-left: 3px solid #f59e0b;">
                            <div class="lbl"><span>⚡ 기술적 체력 & 회전율</span><span style="color:#fbbf24;">MOMENTUM</span></div>
                            <div class="val" id="sb-val-tech" style="font-size:1.0rem;">-</div>
                            <div class="sub" id="sb-sub-tech">RSI(14) · 거래량 배수 · 소외지수</div>
                        </div>
                    </div>

                    <!-- 2. 인터랙티브 멀티 타임프레임 캔들 차트 + 타점 가이드라인 -->
                    <div class="sb-chart-panel">
                        <div class="sb-chart-toolbar">
                            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                                <span style="font-size:13px; font-weight:800; color:#e2e8f0;"><i class="ph ph-chart-candlestick" style="color:#38bdf8;"></i> 실전 타점 미니 차트 (이평선 · 매물대 · 손절/목표 라인)</span>
                                <div class="sb-tf-group" id="sb-tf-group">
                                    <button type="button" class="sb-tf-btn active" data-tf="dayCandle">일봉</button>
                                    <button type="button" class="sb-tf-btn" data-tf="weekCandle">주봉</button>
                                    <button type="button" class="sb-tf-btn" data-tf="minute60">60분봉</button>
                                    <button type="button" class="sb-tf-btn" data-tf="minute15">15분봉</button>
                                    <button type="button" class="sb-tf-btn" data-tf="minute5">5분봉</button>
                                </div>
                            </div>
                            <div class="sb-chart-legend">
                                <span><b style="color:#f59e0b;">━</b> 5선</span>
                                <span><b style="color:#ec4899;">━</b> 20선</span>
                                <span><b style="color:#10b981;">━</b> 60선</span>
                                <span><b style="color:#34d399;">┄</b> 1차목표(TP1)</span>
                                <span><b style="color:#38bdf8;">┄</b> AI지지선</span>
                                <span><b style="color:#f87171;">┄</b> 손절선(SL)</span>
                            </div>
                        </div>
                        <div class="sb-canvas-wrap">
                            <div class="sb-chart-tooltip" id="sb-chart-tooltip">차트에 마우스를 올리면 봉 상세 시세와 수급이 표시됩니다.</div>
                            <canvas id="sb-chart-canvas"></canvas>
                        </div>
                    </div>

                    <!-- 3. 소속 테마 & 테마 내 대장주 판별기 -->
                    <div class="sb-section-card">
                        <div class="sb-section-title">
                            <span><i class="ph ph-crown" style="color:#fbbf24;"></i> 소속 테마 & 테마 내 대장주 판별기 (클릭 시 해당 테마 또는 대장주로 즉시 이동)</span>
                            <span id="sb-theme-count-badge" style="font-size:11.5px; color:#94a3b8; font-weight:600;">연관 테마 탐색 중...</span>
                        </div>
                        <div class="sb-theme-chips" id="sb-theme-chips"></div>
                    </div>

                    <!-- 4. 하단 2단: 외국인·기관 수급 추이 + 실시간 특징주 뉴스/리포트 -->
                    <div class="sb-bottom-grid">
                        <!-- 좌측: 수급 & 투자지표 -->
                        <div class="sb-section-card">
                            <div class="sb-section-title">
                                <span><i class="ph ph-users-three" style="color:#38bdf8;"></i> 외국인·기관·개인 최근 수급 추이 & 핵심 투자지표</span>
                                <span id="sb-flow-summary-badge" style="font-size:11.5px; font-weight:700; color:#38bdf8;">수급 조회 중...</span>
                            </div>
                            <div id="sb-key-metrics-bar" style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px;"></div>
                            <div style="overflow-x:auto;">
                                <table class="sb-flow-table">
                                    <thead>
                                        <tr>
                                            <th>일자</th>
                                            <th>종가</th>
                                            <th>외국인 순매수</th>
                                            <th>기관 순매수</th>
                                            <th>개인 순매수</th>
                                            <th>외인보유율</th>
                                            <th>거래량</th>
                                        </tr>
                                    </thead>
                                    <tbody id="sb-flow-tbody">
                                        <tr><td colspan="7" style="text-align:center; padding:18px; color:#64748b;">투자자별 수급 데이터를 불러오는 중입니다...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- 우측: 실시간 특징주 뉴스 & 증권사 리포트 -->
                        <div class="sb-section-card">
                            <div class="sb-section-title">
                                <span><i class="ph ph-newspaper-clipping" style="color:#a855f7;"></i> 실시간 특징주 재료 뉴스 & 증권사 리포트</span>
                                <a id="sb-naver-External-link" href="#" target="_blank" rel="noopener" style="font-size:11.5px; color:#60a5fa; text-decoration:none; font-weight:700;">네이버 금융 원문 ↗</a>
                            </div>
                            <div id="sb-research-box" style="margin-bottom:10px;"></div>
                            <div class="sb-news-list" id="sb-news-list">
                                <div style="text-align:center; padding:18px; color:#64748b; font-size:12.5px;">실시간 종목 뉴스를 불러오는 중입니다...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        let activeStock = null;
        let activeTimeframe = 'dayCandle';
        let activeCandles = [];
        let activeTargets = { entry: 0, support: 0, stop: 0, tp1: 0, tp2: 0, market: 'KOSDAQ' };
        let hoverIndex = -1;

        function closeBriefingModal() {
            overlay.classList.remove('active');
        }

        document.getElementById('sb-btn-close').addEventListener('click', closeBriefingModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeBriefingModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) {
                closeBriefingModal();
            }
        });

        // 1. AI 차트 스캐너 전체화면 연동
        document.getElementById('sb-btn-open-scanner').addEventListener('click', () => {
            if (!activeStock) return;
            closeBriefingModal();
            if (window.openInDajavataScanner) {
                window.openInDajavataScanner(activeStock.code, activeStock.name);
            } else if (window.ChartScanner) {
                window.ChartScanner.show();
                window.ChartScanner.selectStock(activeStock.code, activeStock.name);
            }
        });

        // 2. 리스크 계산기로 타점 즉시 전송
        document.getElementById('sb-btn-open-calc').addEventListener('click', () => {
            if (!activeStock) return;
            closeBriefingModal();
            if (window.TraderRoom) {
                const price = Math.round(activeTargets.entry || activeStock.current_price || 0);
                const stopP = Math.round(activeTargets.stop || price * 0.96);
                const targetP = Math.round(activeTargets.tp1 || price * 1.08);
                window.TraderRoom.navigate('trader-calc', {
                    assetType: 'krx',
                    stockName: activeStock.name,
                    symbol: activeStock.name,
                    code: activeStock.code,
                    market: activeTargets.market || 'KOSDAQ',
                    entryPrice: price,
                    stopPrice: stopP,
                    targetPrice: targetP
                });
                setTimeout(() => {
                    const entryEl = document.getElementById('calc-entry-price');
                    const stopEl = document.getElementById('calc-stop-loss');
                    const targetEl = document.getElementById('calc-target-price');
                    const nameEl = document.getElementById('calc-item-name');
                    if (nameEl) nameEl.value = activeStock.name;
                    if (entryEl && price > 0) entryEl.value = price;
                    if (stopEl && stopP > 0) stopEl.value = stopP;
                    if (targetEl && targetP > 0) {
                        targetEl.value = targetP;
                        targetEl.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }, 80);
            }
        });

        // 3. 오늘의 매매 관심종목 등록
        document.getElementById('sb-btn-add-focus').addEventListener('click', () => {
            if (!activeStock) return;
            try {
                const dbKey = 'dajavata_trader_db_v1';
                const raw = localStorage.getItem(dbKey);
                const db = raw ? JSON.parse(raw) : { focusList: [] };
                if (!Array.isArray(db.focusList)) db.focusList = [];
                const fmt = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n || 0));
                const memoText = `[관심종목] ${activeStock.name}(${activeStock.code}) · 현재가 ${fmt(activeTargets.entry)}원 | 손절 ${fmt(activeTargets.stop)}원 | 1차목표 ${fmt(activeTargets.tp1)}원`;
                db.focusList.unshift({
                    id: Date.now(),
                    text: memoText,
                    done: false
                });
                localStorage.setItem(dbKey, JSON.stringify(db));
                showToast(`⭐ [${activeStock.name}] 종목이 트레이더 룸 '오늘의 매매' 체크리스트에 등록되었습니다!`);
            } catch (err) {
                showToast('관심종목 저장 중 오류가 발생했습니다.');
            }
        });

        // 타임프레임 탭 전환
        document.querySelectorAll('#sb-tf-group .sb-tf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#sb-tf-group .sb-tf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTimeframe = btn.getAttribute('data-tf') || 'dayCandle';
                if (activeStock) {
                    loadAndDrawChart(activeStock, activeTimeframe);
                }
            });
        });

        // 캔버스 마우스 크로스헤어 이벤트
        const canvas = document.getElementById('sb-chart-canvas');
        canvas.addEventListener('mousemove', (e) => {
            if (!activeCandles || activeCandles.length === 0) return;
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const padLeft = 12;
            const padRight = 86;
            const plotW = Math.max(10, rect.width - padLeft - padRight);
            if (mx < padLeft || mx > padLeft + plotW) {
                hoverIndex = -1;
                drawBriefingCanvas();
                return;
            }
            const idx = Math.min(activeCandles.length - 1, Math.max(0, Math.floor(((mx - padLeft) / plotW) * activeCandles.length)));
            if (idx !== hoverIndex) {
                hoverIndex = idx;
                drawBriefingCanvas();
            }
        });
        canvas.addEventListener('mouseleave', () => {
            hoverIndex = -1;
            drawBriefingCanvas();
        });

        function calcWilderRSI(candles, period = 14) {
            if (!candles || candles.length < period + 1) return 50;
            let avgGain = 0, avgLoss = 0;
            for (let i = 1; i <= period; i++) {
                const diff = candles[i].close - candles[i - 1].close;
                if (diff >= 0) avgGain += diff;
                else avgLoss -= diff;
            }
            avgGain /= period;
            avgLoss /= period;
            for (let i = period + 1; i < candles.length; i++) {
                const diff = candles[i].close - candles[i - 1].close;
                const gain = diff > 0 ? diff : 0;
                const loss = diff < 0 ? -diff : 0;
                avgGain = (avgGain * (period - 1) + gain) / period;
                avgLoss = (avgLoss * (period - 1) + loss) / period;
            }
            if (avgLoss === 0) return 100;
            const rs = avgGain / avgLoss;
            return 100 - (100 / (1 + rs));
        }

        function calcATR(candles, period = 14) {
            if (!candles || candles.length < 2) return 0;
            const trs = [];
            for (let i = 1; i < candles.length; i++) {
                const c = candles[i];
                const pc = candles[i - 1].close;
                const tr = Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
                trs.push(tr);
            }
            const recent = trs.slice(-period);
            return recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
        }

        async function loadAndDrawChart(stock, tf) {
            const tooltip = document.getElementById('sb-chart-tooltip');
            if (tooltip) tooltip.textContent = '차트 데이터를 불러오는 중입니다...';

            try {
                const res = await fetch(`${API_BASE}/api/chart/${stock.code}?periodType=${tf}`, { cache: 'no-cache' });
                if (res.ok) {
                    const data = await res.json();
                    const rawList = data.priceInfos || data.datas || [];
                    const parsed = rawList.map(it => {
                        const dt = String(it.localDate || it.localDateTime || it.dt || '');
                        const open = parseFloat(String(it.openPrice || it.open || 0).replace(/,/g, ''));
                        const high = parseFloat(String(it.highPrice || it.high || 0).replace(/,/g, ''));
                        const low = parseFloat(String(it.lowPrice || it.low || 0).replace(/,/g, ''));
                        const close = parseFloat(String(it.closePrice || it.close || 0).replace(/,/g, ''));
                        const volume = parseFloat(String(it.accumulatedTradingVolume || it.volume || 0).replace(/,/g, ''));
                        const frnRate = it.foreignRetentionRate !== undefined ? parseFloat(it.foreignRetentionRate) : null;
                        return { dt, open, high, low, close, volume, frnRate };
                    }).filter(c => c.close > 0 && c.high > 0 && c.low > 0);

                    if (parsed.length > 0) {
                        activeCandles = parsed.slice(-75);
                        if (tf === 'dayCandle') {
                            computeAndRenderTargets(stock, activeCandles);
                            renderChartFallbackFlowsIfNeeded(activeCandles);
                        }
                        drawBriefingCanvas();
                        return;
                    }
                }
            } catch (err) {
                console.warn('Chart fetch failed:', err);
            }
            if (tooltip) tooltip.textContent = '차트 데이터를 불러올 수 없습니다.';
        }

        function computeAndRenderTargets(stock, candles) {
            const fmt = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n || 0));
            const last = candles[candles.length - 1];
            const prev = candles.length >= 2 ? candles[candles.length - 2] : last;
            const curPrice = last ? last.close : (stock.current_price || 0);
            const atr = calcATR(candles, 14) || (curPrice * 0.035);
            const rsi = calcWilderRSI(candles, 14);

            // 이동평균선 계산
            const sliceAvg = (n) => {
                const sub = candles.slice(-n);
                return sub.reduce((acc, c) => acc + c.close, 0) / (sub.length || 1);
            };
            const ma5 = sliceAvg(5);
            const ma20 = sliceAvg(20);
            const ma60 = sliceAvg(60);

            // 최근 15봉 스윙 저점/고점
            const recent15 = candles.slice(-15);
            const swingLow = Math.min(...recent15.map(c => c.low));
            const swingHigh = Math.max(...recent15.map(c => c.high));

            // 1차 지지선 & 손절가 & 목표가 산출
            const support = Math.round(Math.max(swingLow, curPrice - atr * 1.15));
            let stopLoss = Math.round(Math.min(curPrice * 0.965, Math.max(curPrice * 0.91, curPrice - atr * 1.7)));
            if (stopLoss >= curPrice) stopLoss = Math.round(curPrice * 0.96);

            const riskPerShare = Math.max(curPrice - stopLoss, curPrice * 0.03);
            const tp1 = Math.round(curPrice + riskPerShare * 2.0);
            const tp2 = Math.round(Math.max(swingHigh, curPrice + riskPerShare * 3.2));

            activeTargets.entry = curPrice;
            activeTargets.support = support;
            activeTargets.stop = stopLoss;
            activeTargets.tp1 = tp1;
            activeTargets.tp2 = tp2;

            const stopPct = (((stopLoss - curPrice) / curPrice) * 100).toFixed(2);
            const tp1Pct = (((tp1 - curPrice) / curPrice) * 100).toFixed(2);
            const tp2Pct = (((tp2 - curPrice) / curPrice) * 100).toFixed(2);

            // 거래량 폭발 배수 (최근 20일 평균 대비 당일 거래량)
            const vol20 = candles.slice(-21, -1);
            const avgVol20 = vol20.length > 0 ? (vol20.reduce((a, b) => a + b.volume, 0) / vol20.length) : (last.volume || 1);
            const volRatio = avgVol20 > 0 ? Math.round((last.volume / avgVol20) * 100) : 100;

            const isAligned = curPrice >= ma20 && ma5 >= ma20;
            const alignText = (curPrice >= ma5 && ma5 >= ma20 && ma20 >= ma60)
                ? '정배열 강세'
                : (isAligned ? '단기 상승추세' : (curPrice < ma20 && curPrice >= support ? '눌림목 지지권' : '역배열/조정권'));

            // 상단 4개 타점 박스 업데이트
            document.getElementById('sb-val-entry').textContent = `${fmt(support)} ~ ${fmt(curPrice)}원`;
            document.getElementById('sb-sub-entry').textContent = `1차 핵심 지지선: ${fmt(support)}원 (20일선 ${fmt(ma20)}원)`;

            document.getElementById('sb-val-stop').textContent = `${fmt(stopLoss)}원 (${stopPct}%)`;
            document.getElementById('sb-sub-stop').textContent = `이탈 시 추세 무효화 · 1주 손실폭 ${fmt(curPrice - stopLoss)}원`;

            document.getElementById('sb-val-target').textContent = `1차 ${fmt(tp1)}원 (+${tp1Pct}%)`;
            document.getElementById('sb-sub-target').textContent = `2차 목표가: ${fmt(tp2)}원 (+${tp2Pct}%) · 손익비 1 : 2.0`;

            const neglect52 = stock.neglect52 !== undefined ? Math.round(stock.neglect52) : '-';
            document.getElementById('sb-val-tech').innerHTML = `RSI <span style="color:${rsi >= 70 ? '#f87171' : (rsi <= 35 ? '#38bdf8' : '#34d399')}">${rsi.toFixed(1)}</span> · 거래량 <span style="color:${volRatio >= 200 ? '#fbbf24' : '#e2e8f0'}">${volRatio}%</span>`;
            document.getElementById('sb-sub-tech').textContent = `${alignText} · 52주 바닥권 소외지수: ${neglect52}`;

            // 종합 매수/매도 AI 판정 배지
            const verdictEl = document.getElementById('sb-verdict-badge');
            if (verdictEl) {
                if (rsi >= 74) {
                    verdictEl.textContent = '⚠️ 단기 과열 구간 (추격매수 자제 · 분할 익절 권장)';
                    verdictEl.style.cssText = 'background:rgba(239,68,68,0.18); color:#f87171; border:1px solid rgba(239,68,68,0.45);';
                } else if (isAligned && volRatio >= 150 && rsi >= 50 && rsi < 74) {
                    verdictEl.textContent = '🔥 수급·거래량 유입 강세 (돌파 및 눌림 매수 유리)';
                    verdictEl.style.cssText = 'background:rgba(16,185,129,0.18); color:#34d399; border:1px solid rgba(16,185,129,0.45);';
                } else if (rsi <= 38 || (stock.neglect52 !== undefined && stock.neglect52 <= 20)) {
                    verdictEl.textContent = '🛡️ 과매도 바닥 지지권 (분할 저점 매수 · 손절선 엄수)';
                    verdictEl.style.cssText = 'background:rgba(56,189,248,0.18); color:#38bdf8; border:1px solid rgba(56,189,248,0.45);';
                } else if (isAligned) {
                    verdictEl.textContent = '📈 이평선 지지 양호 (지지선 손절 기준 스윙 적합)';
                    verdictEl.style.cssText = 'background:rgba(59,130,246,0.18); color:#60a5fa; border:1px solid rgba(59,130,246,0.45);';
                } else {
                    verdictEl.textContent = '⏳ 박스권·조정 탐색 구간 (20일선 돌파 또는 지지 확인 후 진입)';
                    verdictEl.style.cssText = 'background:rgba(148,163,184,0.16); color:#cbd5e1; border:1px solid rgba(148,163,184,0.35);';
                }
            }
        }

        function drawBriefingCanvas() {
            const canvas = document.getElementById('sb-chart-canvas');
            if (!canvas || !activeCandles || activeCandles.length === 0) return;

            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            const W = rect.width || 800;
            const H = rect.height || 290;
            canvas.width = W * dpr;
            canvas.height = H * dpr;

            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);

            // 배경 클리어
            ctx.fillStyle = '#090e1a';
            ctx.fillRect(0, 0, W, H);

            const padLeft = 12;
            const padRight = 86;
            const padTop = 16;
            const padBot = 24;
            const volH = 46;
            const priceH = H - padTop - padBot - volH - 8;
            const plotW = W - padLeft - padRight;

            const candles = activeCandles;
            const n = candles.length;

            // 가격 범위 산출 (타점 라인 포함)
            let minP = Math.min(...candles.map(c => c.low));
            let maxP = Math.max(...candles.map(c => c.high));
            if (activeTimeframe === 'dayCandle') {
                if (activeTargets.stop > 0) minP = Math.min(minP, activeTargets.stop * 0.99);
                if (activeTargets.tp1 > 0) maxP = Math.max(maxP, activeTargets.tp1 * 1.01);
            }
            const rangeP = Math.max(maxP - minP, minP * 0.02, 1);
            minP -= rangeP * 0.05;
            maxP += rangeP * 0.05;
            const finalRange = maxP - minP;

            const yOfPrice = (p) => padTop + (1 - (p - minP) / finalRange) * priceH;
            const maxVol = Math.max(...candles.map(c => c.volume || 0), 1);

            // 수평 그리드
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 4; i++) {
                const gy = padTop + (priceH / 4) * i;
                ctx.beginPath();
                ctx.moveTo(padLeft, gy);
                ctx.lineTo(padLeft + plotW, gy);
                ctx.stroke();

                const gp = maxP - (finalRange / 4) * i;
                ctx.fillStyle = '#64748b';
                ctx.font = '10.5px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(new Intl.NumberFormat('ko-KR').format(Math.round(gp)), padLeft + plotW + 6, gy + 3);
            }

            // ICT 매물대/FVG 구름대 (최근 상승/하락 FVG 자동 감지)
            for (let i = 2; i < n; i++) {
                const c0 = candles[i - 2];
                const c2 = candles[i];
                const xStart = padLeft + ((i - 2) / n) * plotW;
                if (c2.low > c0.high && (c2.low - c0.high) / c0.high > 0.008) {
                    const yTop = yOfPrice(c2.low);
                    const yBot = yOfPrice(c0.high);
                    ctx.fillStyle = 'rgba(16, 185, 129, 0.09)';
                    ctx.fillRect(xStart, yTop, padLeft + plotW - xStart, Math.max(2, yBot - yTop));
                } else if (c2.high < c0.low && (c0.low - c2.high) / c0.low > 0.008) {
                    const yTop = yOfPrice(c0.low);
                    const yBot = yOfPrice(c2.high);
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
                    ctx.fillRect(xStart, yTop, padLeft + plotW - xStart, Math.max(2, yBot - yTop));
                }
            }

            // 캔들 및 거래량 그리기
            const stepX = plotW / n;
            const candleW = Math.max(2, Math.min(12, stepX * 0.72));
            const volBaseY = H - padBot;

            for (let i = 0; i < n; i++) {
                const c = candles[i];
                const cx = padLeft + (i + 0.5) * stepX;
                const isUp = c.close >= c.open;
                const color = isUp ? '#ef4444' : '#3b82f6';

                // 심지
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(cx, yOfPrice(c.high));
                ctx.lineTo(cx, yOfPrice(c.low));
                ctx.stroke();

                // 몸통
                const yOpen = yOfPrice(c.open);
                const yClose = yOfPrice(c.close);
                const bodyTop = Math.min(yOpen, yClose);
                const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));
                ctx.fillStyle = color;
                ctx.fillRect(cx - candleW / 2, bodyTop, candleW, bodyH);

                // 거래량 바
                const vh = ((c.volume || 0) / maxVol) * (volH - 4);
                ctx.fillStyle = isUp ? 'rgba(239, 68, 68, 0.42)' : 'rgba(59, 130, 246, 0.42)';
                ctx.fillRect(cx - candleW / 2, volBaseY - vh, candleW, vh);
            }

            // 이동평균선 (5, 20, 60)
            const drawMA = (period, strokeColor) => {
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                let started = false;
                for (let i = 0; i < n; i++) {
                    if (i + 1 < period) continue;
                    let sum = 0;
                    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
                    const avg = sum / period;
                    const cx = padLeft + (i + 0.5) * stepX;
                    const cy = yOfPrice(avg);
                    if (!started) {
                        ctx.moveTo(cx, cy);
                        started = true;
                    } else {
                        ctx.lineTo(cx, cy);
                    }
                }
                ctx.stroke();
            };
            drawMA(5, '#f59e0b');
            drawMA(20, '#ec4899');
            drawMA(60, '#10b981');

            // 타점 수평 가이드라인 (일봉 기준 또는 가격 범위 내일 때)
            const drawPriceLine = (price, label, color, dash = [4, 4]) => {
                if (!price || price < minP || price > maxP) return;
                const py = yOfPrice(price);
                ctx.save();
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.2;
                ctx.setLineDash(dash);
                ctx.beginPath();
                ctx.moveTo(padLeft, py);
                ctx.lineTo(padLeft + plotW, py);
                ctx.stroke();
                ctx.setLineDash([]);

                // 우측 라벨 태그
                ctx.fillStyle = color;
                ctx.fillRect(padLeft + plotW + 2, py - 8, padRight - 4, 16);
                ctx.fillStyle = '#090e1a';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(label, padLeft + plotW + (padRight / 2), py + 3.5);
                ctx.restore();
            };

            const fmtCompact = (p) => new Intl.NumberFormat('ko-KR').format(Math.round(p));
            drawPriceLine(activeTargets.tp1, `TP1 ${fmtCompact(activeTargets.tp1)}`, '#34d399', [4, 3]);
            drawPriceLine(activeTargets.support, `지지 ${fmtCompact(activeTargets.support)}`, '#38bdf8', [3, 3]);
            drawPriceLine(activeTargets.stop, `손절 ${fmtCompact(activeTargets.stop)}`, '#f87171', [4, 3]);

            // X축 날짜 라벨
            ctx.fillStyle = '#64748b';
            ctx.font = '10.5px sans-serif';
            ctx.textAlign = 'center';
            const stepLabel = Math.max(1, Math.floor(n / 6));
            for (let i = 0; i < n; i += stepLabel) {
                const rawDt = candles[i].dt;
                const lbl = rawDt.length >= 8 ? `${rawDt.slice(4, 6)}.${rawDt.slice(6, 8)}` : rawDt;
                const cx = padLeft + (i + 0.5) * stepX;
                ctx.fillText(lbl, cx, H - 7);
            }

            // 마우스 오버 크로스헤어 & 상단 툴팁 업데이트
            const targetIdx = (hoverIndex >= 0 && hoverIndex < n) ? hoverIndex : (n - 1);
            const hc = candles[targetIdx];
            const prevC = targetIdx > 0 ? candles[targetIdx - 1] : hc;
            const chgPct = prevC.close > 0 ? (((hc.close - prevC.close) / prevC.close) * 100).toFixed(2) : '0.00';
            const fmt = (v) => new Intl.NumberFormat('ko-KR').format(Math.round(v || 0));

            if (hoverIndex >= 0 && hoverIndex < n) {
                const hx = padLeft + (hoverIndex + 0.5) * stepX;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(hx, padTop);
                ctx.lineTo(hx, H - padBot);
                ctx.stroke();
            }

            const tooltip = document.getElementById('sb-chart-tooltip');
            if (tooltip && hc) {
                const dtStr = hc.dt.length >= 8 ? `${hc.dt.slice(0, 4)}.${hc.dt.slice(4, 6)}.${hc.dt.slice(6, 8)}` : hc.dt;
                const frnStr = hc.frnRate != null && !isNaN(hc.frnRate) ? ` · 외인 ${hc.frnRate.toFixed(2)}%` : '';
                tooltip.innerHTML = `<b>${dtStr}</b> &nbsp; 시: ${fmt(hc.open)} &nbsp; 고: <span style="color:#f87171">${fmt(hc.high)}</span> &nbsp; 저: <span style="color:#60a5fa">${fmt(hc.low)}</span> &nbsp; 종: <b>${fmt(hc.close)}원 (${chgPct >= 0 ? '+' : ''}${chgPct}%)</b> &nbsp; 거래량: ${fmt(hc.volume)}${frnStr}`;
            }
        }

        // 소속 테마 & 대장주 순위 렌더링
        async function renderThemeLeadership(stock) {
            const chipsEl = document.getElementById('sb-theme-chips');
            const badgeEl = document.getElementById('sb-theme-count-badge');
            if (!chipsEl) return;

            const store = await getThemeDetailsStore();
            if (!store) {
                chipsEl.innerHTML = `<span style="color:#64748b; font-size:12.5px;">소속 테마 정보를 불러올 수 없습니다.</span>`;
                return;
            }

            const matchedThemes = [];
            Object.entries(store).forEach(([themeName, stockArr]) => {
                if (!Array.isArray(stockArr)) return;
                const foundIdx = stockArr.findIndex(s => s.code === stock.code || s.name === stock.name);
                if (foundIdx !== -1) {
                    const sorted = [...stockArr].sort((a, b) => (b.day1 || 0) - (a.day1 || 0));
                    const rank = sorted.findIndex(s => s.code === stock.code || s.name === stock.name) + 1;
                    const leader = sorted[0];
                    const avgDay1 = stockArr.reduce((acc, s) => acc + (s.day1 || 0), 0) / (stockArr.length || 1);
                    matchedThemes.push({
                        themeName,
                        rank,
                        total: stockArr.length,
                        avgDay1,
                        leader
                    });
                }
            });

            matchedThemes.sort((a, b) => a.rank - b.rank || b.avgDay1 - a.avgDay1);
            if (badgeEl) {
                badgeEl.textContent = matchedThemes.length > 0
                    ? `총 ${matchedThemes.length}개 핵심 테마 편입 (대장주 여부 즉시 판별)`
                    : `개별 이슈/독립 종목 (집계된 테마 없음)`;
            }

            if (matchedThemes.length === 0) {
                chipsEl.innerHTML = `<div style="color:#94a3b8; font-size:12.5px; padding:6px 0;">현재 네이버 테마 분류에 중복 편입된 테마가 없는 개별 모멘텀 종목입니다.</div>`;
                return;
            }

            chipsEl.innerHTML = matchedThemes.map(t => {
                const isLeader = t.rank === 1;
                const isSecond = t.rank === 2;
                const rankBadge = isLeader
                    ? `<span style="background:rgba(245,158,11,0.2); color:#fbbf24; border:1px solid rgba(245,158,11,0.5); padding:1px 7px; border-radius:4px; font-size:11px; font-weight:800;">👑 테마 내 1위 대장주</span>`
                    : (isSecond
                        ? `<span style="background:rgba(56,189,248,0.18); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); padding:1px 7px; border-radius:4px; font-size:11px; font-weight:800;">🥈 2위 부대장 (${t.rank}/${t.total})</span>`
                        : `<span style="background:rgba(148,163,184,0.15); color:#cbd5e1; padding:1px 6px; border-radius:4px; font-size:11px; font-weight:700;">테마 내 ${t.rank}위 / ${t.total}종목</span>`);
                const avgColor = t.avgDay1 >= 0 ? '#f87171' : '#60a5fa';
                const avgSign = t.avgDay1 > 0 ? '+' : '';
                const leaderDay1 = t.leader && t.leader.day1 !== undefined ? `${t.leader.day1 > 0 ? '+' : ''}${Number(t.leader.day1).toFixed(2)}%` : '';

                return `
                    <div class="sb-theme-card">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                            <a href="#" class="sb-jump-theme" data-theme="${escapeHtml(t.themeName)}" style="color:#ffffff; font-weight:800; font-size:13px; text-decoration:none;">
                                #${escapeHtml(t.themeName)} <span style="color:${avgColor}; font-size:12px;">(${avgSign}${t.avgDay1.toFixed(2)}%)</span>
                            </a>
                            ${rankBadge}
                        </div>
                        <div style="font-size:11.5px; color:#94a3b8; margin-top:3px;">
                            ${isLeader
                                ? `<span style="color:#fbbf24;">★ 현재 이 테마의 1등 주도주(대장주)입니다!</span>`
                                : `현재 1등 대장주: <a href="#" class="sb-jump-stock" data-code="${t.leader.code}" style="color:#60a5fa; font-weight:700; text-decoration:underline;">${escapeHtml(t.leader.name)} (${leaderDay1})</a>`
                            }
                        </div>
                    </div>
                `;
            }).join('');

            // 테마 클릭 시 해당 테마 상세로 이동
            chipsEl.querySelectorAll('.sb-jump-theme').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const tName = link.getAttribute('data-theme');
                    closeBriefingModal();
                    if (tName) loadThemeDetails(tName);
                });
            });

            // 대장주 클릭 시 해당 대장주 브리핑으로 즉시 전환
            chipsEl.querySelectorAll('.sb-jump-stock').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const code = link.getAttribute('data-code');
                    const found = (window.allStocks || []).find(s => s.code === code) || { code, name: link.textContent.split('(')[0].trim() };
                    window.openStockBriefingModal(found);
                });
            });
        }

        // 일봉 캔들의 외인소진율/거래량 기반 폴백 수급 표 (백엔드/프록시 응답 전 또는 실패 시 즉시 표시)
        function renderChartFallbackFlowsIfNeeded(candles) {
            const tbodyEl = document.getElementById('sb-flow-tbody');
            if (!tbodyEl || tbodyEl.getAttribute('data-loaded') === 'true') return;
            const recent = candles.slice(-6).reverse();
            const fmt = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n || 0));
            tbodyEl.innerHTML = recent.map((c, idx) => {
                const prev = recent[idx + 1] || c;
                const frnDiff = (c.frnRate != null && prev.frnRate != null) ? (c.frnRate - prev.frnRate) : 0;
                const frnDiffStr = frnDiff > 0 ? `<span class="pos">+${frnDiff.toFixed(2)}%p 유입</span>` : (frnDiff < 0 ? `<span class="neg">${frnDiff.toFixed(2)}%p 이탈</span>` : `<span style="color:#94a3b8;">보합</span>`);
                const dtFmt = c.dt.length >= 8 ? `${c.dt.slice(4, 6)}.${c.dt.slice(6, 8)}` : c.dt;
                return `
                    <tr>
                        <td>${dtFmt}</td>
                        <td style="color:#fff; font-weight:700;">${fmt(c.close)}원</td>
                        <td>${frnDiffStr}</td>
                        <td style="color:#94a3b8;">집계중</td>
                        <td style="color:#94a3b8;">집계중</td>
                        <td>${c.frnRate != null ? c.frnRate.toFixed(2) + '%' : '-'}</td>
                        <td>${fmt(c.volume)}</td>
                    </tr>
                `;
            }).join('');
        }

        // 수급·투자지표·뉴스·리포트 종합 로드 (백엔드 API + 브라우저 프록시 하이브리드)
        async function loadStockBriefingDetails(stock) {
            const tbodyEl = document.getElementById('sb-flow-tbody');
            const flowBadge = document.getElementById('sb-flow-summary-badge');
            const metricsBar = document.getElementById('sb-key-metrics-bar');
            const newsListEl = document.getElementById('sb-news-list');
            const researchBox = document.getElementById('sb-research-box');

            // 기본 펀더멘털 바 먼저 표시
            const fmt = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n || 0));
            let marcapStr = '-';
            if (stock.marcap) {
                const jo = Math.floor(stock.marcap / 1000000000000);
                const eok = Math.floor((stock.marcap % 1000000000000) / 100000000);
                marcapStr = jo > 0 ? `${jo}조 ${eok}억` : `${eok}억원`;
            }
            if (metricsBar) {
                metricsBar.innerHTML = `
                    <div style="background:rgba(30,41,59,0.6); padding:7px 10px; border-radius:7px;">
                        <div style="font-size:11px; color:#94a3b8;">시가총액</div>
                        <div style="font-size:13px; font-weight:800; color:#fff;" id="sb-m-marcap">${marcapStr}</div>
                    </div>
                    <div style="background:rgba(30,41,59,0.6); padding:7px 10px; border-radius:7px;">
                        <div style="font-size:11px; color:#94a3b8;">당일 거래대금</div>
                        <div style="font-size:13px; font-weight:800; color:#38bdf8;" id="sb-m-trval">집계중</div>
                    </div>
                    <div style="background:rgba(30,41,59,0.6); padding:7px 10px; border-radius:7px;">
                        <div style="font-size:11px; color:#94a3b8;">PER / PBR</div>
                        <div style="font-size:13px; font-weight:800; color:#fff;" id="sb-m-perpbr">${stock.PER ? stock.PER.toFixed(1) + '배' : '-'} / ${stock.PBR ? stock.PBR.toFixed(2) + '배' : '-'}</div>
                    </div>
                    <div style="background:rgba(30,41,59,0.6); padding:7px 10px; border-radius:7px;">
                        <div style="font-size:11px; color:#94a3b8;">목표주가 컨센서스</div>
                        <div style="font-size:13px; font-weight:800; color:#34d399;" id="sb-m-target">조회중</div>
                    </div>
                `;
            }

            let briefingData = null;

            // 1차: 백엔드 /api/stocks/briefing/{code} 호출
            try {
                const res = await fetch(`${API_BASE}/api/stocks/briefing/${stock.code}`, { cache: 'no-cache' });
                if (res.ok) {
                    briefingData = await res.json();
                }
            } catch (e) {}

            // 2차: 백엔드 미배포 시 브라우저 CORS 프록시로 네이버 모바일 API 직접 조회
            if (!briefingData || (!briefingData.dealTrends?.length && !briefingData.news?.length)) {
                const fetchViaProxy = async (targetUrl) => {
                    const proxies = [
                        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
                        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
                    ];
                    for (const pUrl of proxies) {
                        try {
                            const r = await fetch(pUrl);
                            if (r.ok) return await r.json();
                        } catch (err) {}
                    }
                    return null;
                };

                const [integJson, newsJson] = await Promise.all([
                    fetchViaProxy(`https://m.stock.naver.com/api/stock/${stock.code}/integration`),
                    fetchViaProxy(`https://m.stock.naver.com/api/news/stock/${stock.code}?pageSize=6&page=1`)
                ]);

                if (integJson || newsJson) {
                    const infoMap = {};
                    if (integJson && Array.isArray(integJson.totalInfos)) {
                        integJson.totalInfos.forEach(it => {
                            const k = it.code || it.key;
                            if (k) infoMap[k] = { label: it.key || k, value: it.value };
                        });
                    }
                    const newsItems = [];
                    if (Array.isArray(newsJson)) {
                        newsJson.forEach(grp => {
                            (grp.items || []).forEach(it => {
                                if (newsItems.length >= 6) return;
                                const dtRaw = String(it.datetime || '');
                                const dtFmt = dtRaw.length >= 12 ? `${dtRaw.slice(4, 6)}.${dtRaw.slice(6, 8)} ${dtRaw.slice(8, 10)}:${dtRaw.slice(10, 12)}` : dtRaw;
                                const oid = it.officeId || '';
                                const aid = it.articleId || '';
                                newsItems.push({
                                    title: it.titleFull || it.title || '',
                                    office: it.officeName || '',
                                    datetime: dtFmt,
                                    url: it.mobileNewsUrl || (oid && aid ? `https://n.news.naver.com/mnews/article/${oid}/${aid}` : '#')
                                });
                            });
                        });
                    }
                    briefingData = {
                        code: stock.code,
                        name: (integJson && integJson.stockName) || stock.name,
                        market: 'KRX',
                        totalInfos: infoMap,
                        dealTrends: (integJson && integJson.dealTrendInfos) ? integJson.dealTrendInfos.slice(0, 7) : [],
                        consensus: (integJson && integJson.consensusInfo) || {},
                        researches: (integJson && integJson.researches) ? integJson.researches.slice(0, 4) : [],
                        news: newsItems
                    };
                }
            }

            if (!briefingData) return;

            // 시장 배지 업데이트
            if (briefingData.market && briefingData.market !== 'KRX') {
                activeTargets.market = briefingData.market;
                const mBadge = document.getElementById('sb-market-badge');
                if (mBadge) mBadge.textContent = briefingData.market;
            }

            // 핵심 지표 바 업데이트
            const ti = briefingData.totalInfos || {};
            if (ti.accumulatedTradingValue && document.getElementById('sb-m-trval')) {
                document.getElementById('sb-m-trval').textContent = ti.accumulatedTradingValue.value || '-';
            }
            if (ti.marketValue && document.getElementById('sb-m-marcap')) {
                document.getElementById('sb-m-marcap').textContent = ti.marketValue.value || marcapStr;
            }
            const cnsTarget = briefingData.consensus && briefingData.consensus.priceTargetMean;
            if (document.getElementById('sb-m-target')) {
                document.getElementById('sb-m-target').textContent = cnsTarget ? `${cnsTarget}원` : '컨센서스 없음';
            }

            // 투자자별 매매동향 표 렌더링
            const trends = briefingData.dealTrends || [];
            if (trends.length > 0 && tbodyEl) {
                tbodyEl.setAttribute('data-loaded', 'true');
                let frnSum = 0, orgSum = 0;
                const parseQty = (s) => parseInt(String(s || '0').replace(/,/g, ''), 10) || 0;
                const fmtSigned = (rawStr) => {
                    const v = parseQty(rawStr);
                    const cls = v > 0 ? 'pos' : (v < 0 ? 'neg' : '');
                    const sign = v > 0 && !String(rawStr).startsWith('+') ? '+' : '';
                    return `<span class="${cls}" style="font-weight:700;">${sign}${rawStr || '0'}</span>`;
                };

                tbodyEl.innerHTML = trends.slice(0, 6).map(d => {
                    const bz = String(d.bizdate || '');
                    const dtStr = bz.length === 8 ? `${bz.slice(4, 6)}.${bz.slice(6, 8)}` : bz;
                    frnSum += parseQty(d.foreignerPureBuyQuant);
                    orgSum += parseQty(d.organPureBuyQuant);
                    return `
                        <tr>
                            <td>${dtStr}</td>
                            <td style="color:#fff; font-weight:700;">${d.closePrice || '-'}원</td>
                            <td>${fmtSigned(d.foreignerPureBuyQuant)}</td>
                            <td>${fmtSigned(d.organPureBuyQuant)}</td>
                            <td>${fmtSigned(d.individualPureBuyQuant)}</td>
                            <td>${d.foreignerHoldRatio || '-'}</td>
                            <td style="color:#cbd5e1;">${d.accumulatedTradingVolume || '-'}</td>
                        </tr>
                    `;
                }).join('');

                if (flowBadge) {
                    if (frnSum > 0 && orgSum > 0) {
                        flowBadge.textContent = '🔥 최근 외인·기관 동반 쌍끌이 순매수 유입!';
                        flowBadge.style.color = '#34d399';
                    } else if (frnSum > 0) {
                        flowBadge.textContent = '📈 최근 외국인 누적 순매수 우위';
                        flowBadge.style.color = '#38bdf8';
                    } else if (orgSum > 0) {
                        flowBadge.textContent = '🏛️ 최근 기관 누적 순매수 우위';
                        flowBadge.style.color = '#a855f7';
                    } else {
                        flowBadge.textContent = '⚠️ 최근 외인·기관 차익실현 매도 우위 (수급 확인 필요)';
                        flowBadge.style.color = '#f87171';
                    }
                }
            }

            // 증권사 리포트 렌더링
            const researches = briefingData.researches || [];
            if (researchBox) {
                if (researches.length > 0) {
                    researchBox.innerHTML = `
                        <div style="font-size:11.5px; color:#94a3b8; font-weight:700; margin-bottom:5px;">📊 최신 증권사 애널리스트 리포트</div>
                        ${researches.slice(0, 2).map(r => `
                            <div style="font-size:12px; padding:5px 8px; background:rgba(56,189,248,0.08); border-left:3px solid #38bdf8; border-radius:4px; margin-bottom:4px; display:flex; justify-content:space-between; gap:8px;">
                                <span style="color:#f8fafc; font-weight:600;">[${escapeHtml(r.bnm || '증권사')}] ${escapeHtml(r.tit || '')}</span>
                                <span style="color:#94a3b8; font-size:11px; white-space:nowrap;">${escapeHtml(r.wdt || '')}</span>
                            </div>
                        `).join('')}
                    `;
                } else {
                    researchBox.innerHTML = '';
                }
            }

            // 실시간 종목 뉴스 렌더링
            const news = briefingData.news || [];
            if (newsListEl) {
                if (news.length > 0) {
                    newsListEl.innerHTML = news.map(n => `
                        <a href="${escapeHtml(n.url)}" target="_blank" rel="noopener" class="sb-news-item">
                            <div style="font-size:12.5px; font-weight:700; color:#f8fafc; line-height:1.4; margin-bottom:3px;">${escapeHtml(n.title)}</div>
                            <div style="font-size:11px; color:#94a3b8; display:flex; justify-content:space-between;">
                                <span>${escapeHtml(n.office)}</span>
                                <span>${escapeHtml(n.datetime)}</span>
                            </div>
                        </a>
                    `).join('');
                } else {
                    newsListEl.innerHTML = `<div style="padding:14px; color:#94a3b8; font-size:12.5px; text-align:center;">최근 집계된 특징주 뉴스가 없습니다. 우측 상단 '네이버 금융 원문 ↗'에서 공시를 확인하세요.</div>`;
                }
            }
        }

        window.openStockBriefingModal = function(stock) {
            if (!stock || !stock.code) return;
            activeStock = stock;
            hoverIndex = -1;

            const fmt = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n || 0));
            const day1 = stock.day1 !== undefined ? Number(stock.day1) : 0;
            const day3 = stock.day3 !== undefined ? Number(stock.day3) : 0;

            document.getElementById('sb-stock-name').textContent = stock.name || stock.code;
            document.getElementById('sb-stock-code').textContent = stock.code;
            document.getElementById('sb-market-badge').textContent = stock.market || 'KRX';
            document.getElementById('sb-price-hero').textContent = `${fmt(stock.current_price)}원`;
            document.getElementById('sb-price-hero').style.color = day1 >= 0 ? '#f87171' : '#60a5fa';

            const chgEl = document.getElementById('sb-change-hero');
            if (chgEl) {
                const s1 = day1 > 0 ? '+' : '';
                const s3 = day3 > 0 ? '+' : '';
                chgEl.innerHTML = `<span class="${day1 >= 0 ? 'pos' : 'neg'}">${s1}${day1.toFixed(2)}%</span> <span style="color:#94a3b8; font-size:12px; font-weight:600; margin-left:4px;">(3일합산 ${s3}${day3.toFixed(2)}%)</span>`;
            }

            const extLink = document.getElementById('sb-naver-External-link');
            if (extLink) {
                extLink.href = `https://finance.naver.com/item/main.naver?code=${stock.code}`;
            }

            const tbodyEl = document.getElementById('sb-flow-tbody');
            if (tbodyEl) {
                tbodyEl.removeAttribute('data-loaded');
                tbodyEl.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:18px; color:#64748b;">투자자별 수급 데이터를 불러오는 중입니다...</td></tr>`;
            }

            // 기본 일봉 탭 활성화
            activeTimeframe = 'dayCandle';
            document.querySelectorAll('#sb-tf-group .sb-tf-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-tf') === 'dayCandle');
            });

            overlay.classList.add('active');

            // 1) 차트 및 타점 계산 로드
            loadAndDrawChart(stock, 'dayCandle');
            // 2) 소속 테마 & 대장주 판별 로드
            renderThemeLeadership(stock);
            // 3) 외인·기관 수급, 컨센서스, 뉴스 로드
            loadStockBriefingDetails(stock);
        };
    }

    initStockBriefingModal();

    // CMS 초기화 실행
    initAdminCMS();
});
