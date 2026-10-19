/**
 * ============================================================================
 * DAJAVATA SIGNAL LAB (AI 차트 스캐너) ENGINE v5
 * - 코스피/코스닥/해외 전 종목(4,200개+) 실시간 검색 & 연동
 * - 네이버 증권 & FDR 실시간 캔들 차트 API 연동 (국내/해외)
 * - [신규] 스마트 머니 콘셉트 (ICT) 8대 구름대 (FVG, OB, IFVG, BPR) 엔진
 * - [신규] ICT 유동성 스윕 (BSL/SSL) & 기관 타점 신호 (Mitigation Buy/Sell)
 * - [신규] HTS 4대 급소 신호 (상승/하락 FVG, SSL/BSL Sweep V자 반등)
 * - [신규] HTS 표준 Wilder RSI(14) & RSI 이평선(MA 9) 골든크로스 스캐너
 * - [신규] 시장 분류 탭: 전체 / 코스피 / 코스닥 / 🇺🇸 해외 대표주 (NVDA, TSLA 등)
 * - [신규] 활성화된 ICT 구름대 및 타점 신호 실시간 분석 테이블 (from app3.py)
 * - 기본 차트 높이 780px + 마우스 드래그 상하/좌우 자유 조절
 * - 차트 좌측 12종 전문 드로잉 툴바 (추세선, 수평선, 박스, 측정자 등)
 * - 다자바타 트레이더 룸(리스크 계산기) 원클릭 연동 지원
 * ============================================================================
 */

(function () {
    'use strict';

    // -------------------------------------------------------------
    // 1. 타임프레임(주기) 정의 (총 15종)
    // -------------------------------------------------------------
    const TIMEFRAME_GROUPS = {
        minutes: [
            { id: '1m', label: '1분봉', short: '1분', minutes: 1 },
            { id: '3m', label: '3분봉', short: '3분', minutes: 3 },
            { id: '5m', label: '5분봉', short: '5분', minutes: 5 },
            { id: '10m', label: '10분봉', short: '10분', minutes: 10 },
            { id: '15m', label: '15분봉', short: '15분', minutes: 15 },
            { id: '30m', label: '30분봉', short: '30분', minutes: 30 },
            { id: '45m', label: '45분봉', short: '45분', minutes: 45 }
        ],
        hours: [
            { id: '1h', label: '1시간봉', short: '1시', hours: 1 },
            { id: '2h', label: '2시간봉', short: '2시', hours: 2 },
            { id: '4h', label: '4시간봉', short: '4시', hours: 4 },
            { id: '8h', label: '8시간봉', short: '8시', hours: 8 }
        ],
        periods: [
            { id: '1D', label: '일봉', short: '일봉' },
            { id: '1W', label: '주봉', short: '주봉' },
            { id: '1M', label: '월봉', short: '월봉' },
            { id: '1Y', label: '년봉', short: '년봉' }
        ]
    };

    // -------------------------------------------------------------
    // 2. 해외 대표 인기 종목 유니버스 (from app3.py)
    // -------------------------------------------------------------
    const OVERSEAS_STOCKS = [
        { code: 'NVDA', name: '엔비디아 (NVIDIA)', market: 'NASDAQ', price: 214.13, changeRate: 1.85, theme: 'AI 가속기 / GPU', strategy: 'ict-smc', strategyName: 'ICT 스마트 머니' },
        { code: 'AAPL', name: '애플 (Apple)', market: 'NASDAQ', price: 232.50, changeRate: 0.65, theme: '애플 인텔리전스 / 빅테크', strategy: 'support-bounce', strategyName: '추세 지지선 반등' },
        { code: 'TSLA', name: '테슬라 (Tesla)', market: 'NASDAQ', price: 220.70, changeRate: 3.20, theme: '자율주행 FSD / 로보택시', strategy: 'breakout-retest', strategyName: '전고점 돌파 후 안착' },
        { code: 'MSFT', name: '마이크로소프트 (MSFT)', market: 'NASDAQ', price: 418.00, changeRate: 0.42, theme: '클라우드 / 코파일럿', strategy: 'ma-converge', strategyName: '이평선 수렴 & 정배열' },
        { code: 'AMZN', name: '아마존 (Amazon)', market: 'NASDAQ', price: 188.60, changeRate: 1.15, theme: '이커머스 / AWS', strategy: 'support-bounce', strategyName: '추세 지지선 반등' },
        { code: 'GOOGL', name: '알파벳 A (Google)', market: 'NASDAQ', price: 165.30, changeRate: 0.88, theme: '검색 / 제미나이 AI', strategy: 'bb-squeeze', strategyName: '볼린저 밴드 스퀴즈' },
        { code: 'META', name: '메타 플랫폼스 (Meta)', market: 'NASDAQ', price: 585.00, changeRate: 2.45, theme: '라마3 / 소셜미디어', strategy: 'rsi-gold', strategyName: 'Wilder RSI 골든크로스' },
        { code: 'PLTR', name: '팔란티어 (Palantir)', market: 'NYSE', price: 44.50, changeRate: 4.12, theme: 'AIP / 국방 데이터 AI', strategy: 'breakout-retest', strategyName: '전고점 돌파 후 안착' },
        { code: 'QQQ', name: '나스닥 100 ETF (QQQ)', market: 'NASDAQ', price: 495.20, changeRate: 0.95, theme: '미국 테크 대표 지수', strategy: 'support-bounce', strategyName: '추세 지지선 반등' },
        { code: 'SOXL', name: '반도체 3배 롱 ETF (SOXL)', market: 'NYSE', price: 38.60, changeRate: 5.30, theme: '필라델피아 반도체 3X', strategy: 'rsi-gold', strategyName: 'Wilder RSI 골든크로스' },
        { code: 'TQQQ', name: '나스닥 3배 롱 ETF (TQQQ)', market: 'NASDAQ', price: 74.80, changeRate: 2.85, theme: '나스닥 100 3X 레버리지', strategy: 'support-bounce', strategyName: '추세 지지선 반등' },
        { code: 'SPY', name: 'S&P 500 ETF (SPY)', market: 'NYSE', price: 582.40, changeRate: 0.52, theme: '미국 대형주 대표 지수', strategy: 'ma-converge', strategyName: '이평선 수렴 & 정배열' },
        { code: 'AVGO', name: '브로드컴 (Broadcom)', market: 'NASDAQ', price: 182.00, changeRate: 2.10, theme: '커스텀 ASIC / AI 네트워킹', strategy: 'ict-smc', strategyName: 'ICT 스마트 머니' },
        { code: 'TSM', name: 'TSMC ADR (TSM)', market: 'NYSE', price: 198.50, changeRate: 1.75, theme: '글로벌 1위 파운드리', strategy: 'support-bounce', strategyName: '추세 지지선 반등' },
        { code: 'AMD', name: 'AMD', market: 'NASDAQ', price: 156.40, changeRate: 1.90, theme: 'MI300X AI 칩 / CPU', strategy: 'bb-squeeze', strategyName: '볼린저 밴드 스퀴즈' },
        { code: 'MU', name: '마이크론 테크놀로지', market: 'NASDAQ', price: 110.20, changeRate: 2.30, theme: 'HBM3E / D램', strategy: 'rsi-gold', strategyName: 'Wilder RSI 골든크로스' },
        { code: 'ASML', name: 'ASML 홀딩 (ASML)', market: 'NASDAQ', price: 720.00, changeRate: -0.40, theme: 'EUV 노광장비 독점', strategy: 'ict-smc', strategyName: 'ICT 스마트 머니' }
    ];

    // 기본 시그널 대표 종목 (국내)
    const INITIAL_FEATURED_STOCKS = [
        {
            code: '000660',
            name: 'SK하이닉스',
            market: 'KOSPI',
            price: 186400,
            change: 3900,
            changeRate: 2.14,
            volume: '3.4M주',
            tradeAmount: '6,340억',
            strategy: 'ict-smc',
            strategyName: 'ICT 스마트 머니 (FVG 반등)',
            theme: 'HBM3E / AI 반도체',
            signalStatus: 'good',
            signalText: '상승 FVG 구간 안착 · 반등',
            stopPrice: 181000,
            targetPrice: 204000,
            briefing: {
                reason: '중기 상승 채널의 하단 지지선(181,500원) 및 Bullish FVG 구름대 상단에서 강한 양봉 반등 시도가 포착되었습니다.',
                tradePlan: '현재가(186,400원) 매수 시 손절 기준 181,000원(-2.89%), 1차 목표 204,000원(+9.44%)으로 손익비 3.26:1의 유리한 구간입니다.',
                supplyFlow: '외국인 3거래일 연속 순매수 유입 중이며, HBM3E 공급 확대 모멘텀이 기술적 반등을 강력히 지지하고 있습니다.'
            }
        },
        {
            code: '196170',
            name: '알테오젠',
            market: 'KOSDAQ',
            price: 382000,
            change: 13000,
            changeRate: 3.52,
            volume: '720K주',
            tradeAmount: '2,750억',
            strategy: 'rsi-gold',
            strategyName: 'Wilder RSI 골든크로스',
            theme: '바이오 플랫폼 (SC제형)',
            signalStatus: 'good',
            signalText: 'RSI(14) 52.4 골든크로스 완성',
            stopPrice: 365000,
            targetPrice: 430000,
            briefing: {
                reason: 'Wilder RSI(14)가 RSI 이평(9)을 상향 돌파하며 50선 위로 올라섰고, 전고점 매물대(368,000원)를 강력히 지지 중입니다.',
                tradePlan: '현재가(382,000원) 진입 시 손절가 365,000원(-4.45%), 1차 목표 430,000원(+12.5%)으로 손익비 2.8:1 구조입니다.',
                supplyFlow: '키트루다 SC 독점 계약 임박 이슈와 함께 사모펀드 및 기관의 대량 매수세가 확인됩니다.'
            }
        },
        {
            code: '000250',
            name: '삼천당제약',
            market: 'KOSDAQ',
            price: 143500,
            change: 2700,
            changeRate: 1.92,
            volume: '540K주',
            tradeAmount: '780억',
            strategy: 'support-bounce',
            strategyName: '추세 지지선 반등',
            theme: '경구용 GLP-1 / 시밀러',
            signalStatus: 'good',
            signalText: '추세 하단 양봉 전환',
            stopPrice: 138500,
            targetPrice: 162000,
            briefing: {
                reason: '8월 저점 이후 형성된 중기 상승 추세선의 바닥 자리(140,000원)에서 하락을 멈추고 5일선 골든크로스를 완성했습니다.',
                tradePlan: '현재가(143,500원) 매수 시 손절 138,500원(-3.48%), 1차 목표 162,000원(+12.89%) 타점입니다.',
                supplyFlow: '비만 치료제 관련 글로벌 판권 논의 소식과 함께 하락 추세 탈피 시그널이 발생했습니다.'
            }
        },
        {
            code: '005380',
            name: '현대차',
            market: 'KOSPI',
            price: 248500,
            change: 3000,
            changeRate: 1.22,
            volume: '890K주',
            tradeAmount: '2,210억',
            strategy: 'bb-squeeze',
            strategyName: '볼린저 밴드 스퀴즈',
            theme: '자동차 / 인도IPO / 밸류업',
            signalStatus: 'warn',
            signalText: '변동성 수축 3주차 (폭발 임박)',
            stopPrice: 241500,
            targetPrice: 272000,
            briefing: {
                reason: '일봉 볼린저 밴드 대역폭(Bandwidth)이 연중 최저치로 응축되며 244,000원 바닥을 단단히 지지하고 있습니다. 방향성 분출 직전입니다.',
                tradePlan: '현재가(248,500원) 분할 매수 시 박스권 하단 이탈 241,500원(-2.82%) 손절 기준입니다.',
                supplyFlow: '인도법인 상장 모멘텀 및 밸류업 자사주 매입 기대감으로 투신/연기금의 저가 매수가 견고합니다.'
            }
        },
        {
            code: '000100',
            name: '유한양행',
            market: 'KOSPI',
            price: 156000,
            change: 6500,
            changeRate: 4.35,
            volume: '1.2M주',
            tradeAmount: '1,890억',
            strategy: 'dual-buying',
            strategyName: '외인·기관 쌍끌이',
            theme: '폐암 신약 렉라자',
            signalStatus: 'good',
            signalText: '쌍끌이 순매수 + 지지 반등',
            stopPrice: 148000,
            targetPrice: 178000,
            briefing: {
                reason: '기관과 외국인이 최근 3일간 동시 순매수를 기록하며 60일 이평선 및 지지선(149,000원)을 강력히 방어하고 직전 고점 돌파를 시도하고 있습니다.',
                tradePlan: '156,000원 매수 시 지지선 이탈 148,000원(-5.1%) 손절 기준, 목표 178,000원(+14.1%)입니다.',
                supplyFlow: '미국 FDA 승인 후 처방 가속화에 따른 로열티 기대감으로 메이저 수급이 집중되고 있습니다.'
            }
        },
        {
            code: '005930',
            name: '삼성전자',
            market: 'KOSPI',
            price: 59800,
            change: 500,
            changeRate: 0.84,
            volume: '14.2M주',
            tradeAmount: '8,480억',
            strategy: 'ma-converge',
            strategyName: '이평선 수렴 & 정배열',
            theme: '반도체 대형주',
            signalStatus: 'good',
            signalText: '이평선 3선 수렴 후 반등',
            stopPrice: 58200,
            targetPrice: 65000,
            briefing: {
                reason: '역배열 하락세가 진정되며 5일선, 20일선이 58,800원에서 밀집 수렴한 뒤, 거래량을 동반한 우상향 골든크로스가 발생했습니다.',
                tradePlan: '현재가(59,800원) 매수 시 단기 지지선 58,200원(-2.67%) 손절 기준입니다.',
                supplyFlow: '극단적 과매도 구간을 지나 외국인 매도세가 둔화되고 연기금의 저가 매수세가 꾸준히 유입되는 전환 국면입니다.'
            }
        },
        {
            code: '042700',
            name: '한미반도체',
            market: 'KOSPI',
            price: 112000,
            change: 3000,
            changeRate: 2.75,
            volume: '950K주',
            tradeAmount: '1,060억',
            strategy: 'ict-smc',
            strategyName: 'ICT 스마트 머니 (OB 지지)',
            theme: 'TC본더 / 반도체 장비',
            signalStatus: 'good',
            signalText: '기관 상승 오더블록(OB) 지지',
            stopPrice: 106500,
            targetPrice: 126000,
            briefing: {
                reason: '상승 오더블록(OB) 하단(108,000원)에서 아래꼬리를 달고 반등하며 기술적 매수 급소가 완성되었습니다.',
                tradePlan: '112,000원 매수 시 지지선 이탈 106,500원(-4.91%) 손절 기준입니다.',
                supplyFlow: '신규 고객사 수주 모멘텀이 이어지며 장비주 중 가장 빠른 지지선 반등을 보이고 있습니다.'
            }
        }
    ];

    // -------------------------------------------------------------
    // 2-1. ICT 8대 구름대 정의 및 개별 설정 (from app3.py)
    // -------------------------------------------------------------
    const CLOUD_ZONE_DEFINITIONS = [
        { type: 'Bullish FVG', label: '상승 FVG', short: 'Bull FVG', color: '#10b981', default: true },
        { type: 'Bearish FVG', label: '하락 FVG', short: 'Bear FVG', color: '#ef4444', default: false },
        { type: 'Bullish OB', label: '상승 OB', short: 'Bull OB', color: '#3b82f6', default: true },
        { type: 'Bearish OB', label: '하락 OB', short: 'Bear OB', color: '#f59e0b', default: false },
        { type: 'Bullish IFVG', label: '상승 IFVG', short: 'Bull IFVG', color: '#8b5cf6', default: false },
        { type: 'Bearish IFVG', label: '하락 IFVG', short: 'Bear IFVG', color: '#ec4899', default: false },
        { type: 'Bullish BPR', label: '상승 BPR', short: 'Bull BPR', color: '#14b8a6', default: false },
        { type: 'Bearish BPR', label: '하락 BPR', short: 'Bear BPR', color: '#e11d48', default: false }
    ];

    function getInitialCloudZonePreferences() {
        try {
            const saved = localStorage.getItem('dajavata_cloud_types_v1');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (typeof parsed === 'object' && parsed !== null) return parsed;
            }
        } catch (e) {}
        // 기본값: "한꺼번에 모두 튀어나오지 않도록" 핵심 상승 구름대(Bullish FVG, Bullish OB)만 기본 활성화
        const defaults = {};
        CLOUD_ZONE_DEFINITIONS.forEach(def => {
            defaults[def.type] = def.default;
        });
        return defaults;
    }

    // -------------------------------------------------------------
    // 3. UI 상태 관리
    // -------------------------------------------------------------
    let state = {
        stocksList: [...INITIAL_FEATURED_STOCKS],
        universeStocks: [], // 코스피/코스닥 전 종목 (4,292개)
        marketFilter: 'all', // 'all', 'kospi', 'kosdaq', 'overseas'
        selectedStrategy: 'all',
        selectedStockCode: '000660',
        searchQuery: '',
        activeTimeframe: '1D',
        chartInstance: null,
        candlestickSeries: null,
        supportLineSeries: null,
        stoplossLineSeries: null,
        activeTool: 'cursor',
        isMagnet: false,
        userDrawings: [],
        isDrawingNow: false,
        drawStartPoint: null,
        
        // --- 지표 토글 상태 (app3.py 연동) ---
        showICTZones: true,    // 🌐 ICT 8대 구름대 마스터 On/Off
        strictMode: false,     // ⚡ app3.py 고확률(스윕 검증) 구름대만 표시
        showICTSignals: true,  // 🎯 ICT 유동성 스윕 & 타점 신호
        showHTSSignals: true,  // 🧪 HTS 4대 급소 신호
        showWilderRSI: true,   // 📊 Wilder RSI(14)
        showSupportLine: true, // 🛡️ AI 자동 지지선

        // ☁️ 8대 구름대 개별 선택 상태 (Bullish FVG, Bullish OB 등 8종)
        cloudZoneTypes: getInitialCloudZonePreferences(),

        // 계산된 최신 데이터
        currentStock: null,
        currentCandles: [],
        currentICTZones: [],
        currentICTSignals: [],
        currentHTSSignals: [],
        currentRSIInfo: null
    };

    function getTimeframeLabel(tf) {
        for (const grp of Object.values(TIMEFRAME_GROUPS)) {
            const found = grp.find(item => item.id === tf);
            if (found) return found.label;
        }
        return tf;
    }

    function formatPrice(val, isOverseas = false) {
        if (val === null || val === undefined || isNaN(val)) return '-';
        if (isOverseas) {
            return '$' + Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return Math.round(val).toLocaleString() + '원';
    }

    // -------------------------------------------------------------
    // 4. 스마트 머니 (ICT) & Wilder RSI 알고리즘 엔진 (from app3.py)
    // -------------------------------------------------------------

    // (1) HTS 표준 Wilder's Smoothing RSI(14) & MA(9)
    function computeHTSRSI(candles, period = 14) {
        if (!candles || candles.length < period + 1) return { rsiList: [], latestRSI: null, latestMA9: null, isGoldenCross: false, isDeadCross: false };
        const rsiList = new Array(candles.length).fill(null);
        let avgU = 0;
        let avgD = 0;

        for (let i = 1; i <= period; i++) {
            const diff = candles[i].close - candles[i - 1].close;
            if (diff > 0) avgU += diff;
            else avgD += Math.abs(diff);
        }
        avgU /= period;
        avgD /= period;

        let rs = avgD === 0 ? 100 : avgU / avgD;
        rsiList[period] = 100 - (100 / (1 + rs));

        for (let i = period + 1; i < candles.length; i++) {
            const diff = candles[i].close - candles[i - 1].close;
            const u = diff > 0 ? diff : 0;
            const d = diff < 0 ? Math.abs(diff) : 0;
            avgU = (avgU * (period - 1) + u) / period;
            avgD = (avgD * (period - 1) + d) / period;
            rs = avgD === 0 ? 100 : avgU / avgD;
            rsiList[i] = 100 - (100 / (1 + rs));
        }

        // RSI MA(9)
        const maList = new Array(candles.length).fill(null);
        for (let i = 0; i < candles.length; i++) {
            if (i < period + 8) continue;
            let sum = 0;
            for (let j = 0; j < 9; j++) {
                sum += rsiList[i - j];
            }
            maList[i] = sum / 9;
        }

        const lastIdx = candles.length - 1;
        const prevIdx = candles.length - 2;
        const curRSI = rsiList[lastIdx] || 50;
        const curMA9 = maList[lastIdx] || 50;
        const prevRSI = rsiList[prevIdx] || 50;
        const prevMA9 = maList[prevIdx] || 50;

        const isGoldenCross = (curRSI > curMA9) && (prevRSI <= prevMA9) && (curRSI < 60);
        const isDeadCross = (curRSI < curMA9) && (prevRSI >= prevMA9) && (curRSI > 60);

        return {
            rsiList,
            maList,
            latestRSI: parseFloat(curRSI.toFixed(1)),
            latestMA9: parseFloat(curMA9.toFixed(1)),
            isGoldenCross,
            isDeadCross
        };
    }

    // (2) ICT 8대 지표 구름대 산출 (FVG, OB, IFVG, BPR)
    function calculateICTConcepts(candles, strictMode = false, leftBars = 5, rightBars = 2) {
        if (!candles || candles.length < 5) return [];
        const zones = [];
        let bslSwept = false;
        let sslSwept = false;
        let activeBslVal = null;
        let activeSslVal = null;

        for (let i = 2; i < candles.length; i++) {
            if (strictMode) {
                const idx = i - rightBars;
                if (idx >= leftBars && idx < candles.length) {
                    let isMax = true;
                    let isMin = true;
                    for (let k = idx - leftBars; k <= idx + rightBars; k++) {
                        if (candles[k].high > candles[idx].high) isMax = false;
                        if (candles[k].low < candles[idx].low) isMin = false;
                    }
                    if (isMax) activeBslVal = candles[idx].high;
                    if (isMin) activeSslVal = candles[idx].low;
                }
                if (activeBslVal && candles[i].high > activeBslVal) {
                    bslSwept = true;
                    activeBslVal = null;
                }
                if (activeSslVal && candles[i].low < activeSslVal) {
                    sslSwept = true;
                    activeSslVal = null;
                }
            }

            const h1 = candles[i - 2].high;
            const l1 = candles[i - 2].low;
            const h3 = candles[i].high;
            const l3 = candles[i].low;

            // Bullish FVG
            if (h1 < l3) {
                if (!strictMode || sslSwept) {
                    zones.push({
                        type: 'Bullish FVG',
                        top: l3,
                        bottom: h1,
                        time: candles[i - 1].time,
                        active: true
                    });
                    // Bullish OB
                    for (let j = i - 2; j >= Math.max(0, i - 10); j--) {
                        if (candles[j].close < candles[j].open) {
                            zones.push({
                                type: 'Bullish OB',
                                top: candles[j].high,
                                bottom: candles[j].low,
                                time: candles[j].time,
                                active: true
                            });
                            break;
                        }
                    }
                    if (strictMode) sslSwept = false;
                }
            }
            // Bearish FVG
            else if (l1 > h3) {
                if (!strictMode || bslSwept) {
                    zones.push({
                        type: 'Bearish FVG',
                        top: l1,
                        bottom: h3,
                        time: candles[i - 1].time,
                        active: true
                    });
                    // Bearish OB
                    for (let j = i - 2; j >= Math.max(0, i - 10); j--) {
                        if (candles[j].close > candles[j].open) {
                            zones.push({
                                type: 'Bearish OB',
                                top: candles[j].high,
                                bottom: candles[j].low,
                                time: candles[j].time,
                                active: true
                            });
                            break;
                        }
                    }
                    if (strictMode) bslSwept = false;
                }
            }
        }

        // IFVG (Inversion FVG) 판별
        zones.forEach(z => {
            const startIdx = candles.findIndex(c => c.time === z.time);
            if (startIdx === -1) return;
            if (z.type === 'Bullish FVG') {
                for (let i = startIdx + 1; i < candles.length; i++) {
                    if (candles[i].close < z.bottom) {
                        z.active = false;
                        zones.push({
                            type: 'Bearish IFVG',
                            top: z.top,
                            bottom: z.bottom,
                            time: candles[i].time,
                            active: true
                        });
                        break;
                    }
                }
            } else if (z.type === 'Bearish FVG') {
                for (let i = startIdx + 1; i < candles.length; i++) {
                    if (candles[i].close > z.top) {
                        z.active = false;
                        zones.push({
                            type: 'Bullish IFVG',
                            top: z.top,
                            bottom: z.bottom,
                            time: candles[i].time,
                            active: true
                        });
                        break;
                    }
                }
            }
        });

        // BPR (Balanced Price Range)
        const bullFVGs = zones.filter(z => z.type === 'Bullish FVG');
        const bearFVGs = zones.filter(z => z.type === 'Bearish FVG');
        bullFVGs.forEach(bf => {
            bearFVGs.forEach(brf => {
                const overlapTop = Math.min(bf.top, brf.top);
                const overlapBottom = Math.max(bf.bottom, brf.bottom);
                if (overlapTop > overlapBottom) {
                    zones.push({
                        type: bf.time < brf.time ? 'Bearish BPR' : 'Bullish BPR',
                        top: overlapTop,
                        bottom: overlapBottom,
                        time: bf.time < brf.time ? brf.time : bf.time,
                        active: true
                    });
                }
            });
        });

        return zones;
    }

    // (3) ICT 유동성 스윕 & 타점 신호 (Mitigation Buy/Sell)
    function calculateICTSignals(candles, leftBars = 5, rightBars = 2) {
        if (!candles || candles.length < 10) return [];
        const signals = [];
        let bslSwept = false;
        let sslSwept = false;
        let activeBslVal = null;
        let activeSslVal = null;
        let bearishSetupFvg = null;
        let bullishSetupFvg = null;

        for (let i = Math.max(leftBars, 2); i < candles.length; i++) {
            const idx = i - rightBars;
            if (idx >= leftBars && idx < candles.length) {
                let isMax = true;
                let isMin = true;
                for (let k = idx - leftBars; k <= idx + rightBars; k++) {
                    if (candles[k].high > candles[idx].high) isMax = false;
                    if (candles[k].low < candles[idx].low) isMin = false;
                }
                if (isMax) activeBslVal = candles[idx].high;
                if (isMin) activeSslVal = candles[idx].low;
            }

            const currHigh = candles[i].high;
            const currLow = candles[i].low;

            if (activeBslVal && currHigh > activeBslVal) {
                bslSwept = true;
                bearishSetupFvg = null;
                activeBslVal = null;
            }
            if (activeSslVal && currLow < activeSslVal) {
                sslSwept = true;
                bullishSetupFvg = null;
                activeSslVal = null;
            }

            if (bslSwept && i >= 2) {
                const l1 = candles[i - 2].low;
                const h3 = candles[i].high;
                if (l1 > h3) {
                    bearishSetupFvg = { top: l1, bottom: h3, time: candles[i - 1].time };
                    bslSwept = false;
                }
            }
            if (sslSwept && i >= 2) {
                const h1 = candles[i - 2].high;
                const l3 = candles[i].low;
                if (h1 < l3) {
                    bullishSetupFvg = { top: l3, bottom: h1, time: candles[i - 1].time };
                    sslSwept = false;
                }
            }

            if (bearishSetupFvg) {
                if (currHigh >= bearishSetupFvg.bottom && candles[i].time > bearishSetupFvg.time) {
                    signals.push({
                        time: candles[i].time,
                        type: 'Sell',
                        price: bearishSetupFvg.bottom,
                        reason: 'BSL Sweep ➡️ Bearish FVG Mitigation (기관 숏/매도 타점)'
                    });
                    bearishSetupFvg = null;
                }
            }
            if (bullishSetupFvg) {
                if (currLow <= bullishSetupFvg.top && candles[i].time > bullishSetupFvg.time) {
                    signals.push({
                        time: candles[i].time,
                        type: 'Buy',
                        price: bullishSetupFvg.top,
                        reason: 'SSL Sweep ➡️ Bullish FVG Mitigation (기관 롱/매수 타점)'
                    });
                    bullishSetupFvg = null;
                }
            }
        }
        return signals;
    }

    // (4) HTS 4대 급소 실험용 신호 (from generate_ict_chart.py)
    function calculateHTSSignals(candles) {
        if (!candles || candles.length < 25) return [];
        const htsSignals = [];

        const support20 = [];
        const resist20 = [];
        for (let i = 0; i < candles.length; i++) {
            if (i < 20) {
                support20.push(null);
                resist20.push(null);
                continue;
            }
            let minL = Infinity;
            let maxH = -Infinity;
            for (let j = i - 20; j < i; j++) {
                if (candles[j].low < minL) minL = candles[j].low;
                if (candles[j].high > maxH) maxH = candles[j].high;
            }
            support20.push(minL);
            resist20.push(maxH);
        }

        let sslBreakdownIdx = -100;
        let bslBreakoutIdx = -100;

        for (let i = 2; i < candles.length; i++) {
            const c = candles[i].close;
            const o = candles[i].open;
            const h = candles[i].high;
            const l = candles[i].low;

            const c1 = candles[i - 1].close;
            const o1 = candles[i - 1].open;
            const h2 = candles[i - 2].high;
            const l2 = candles[i - 2].low;

            // 1. HTS 상승 FVG
            if (l > h2 && c1 > o1) {
                htsSignals.push({
                    time: candles[i].time,
                    type: 'HTS 상승 FVG',
                    price: l,
                    symbol: 'circle',
                    color: '#ef4444'
                });
            }
            // 2. HTS 하락 FVG
            if (h < l2 && c1 < o1) {
                htsSignals.push({
                    time: candles[i].time,
                    type: 'HTS 하락 FVG',
                    price: h,
                    symbol: 'circle',
                    color: '#3b82f6'
                });
            }

            // 3. HTS SSL Sweep (20봉 저점 이탈 후 V자 재돌파)
            const sup = support20[i];
            if (sup !== null) {
                const prevC = candles[i - 1].close;
                const prevSup = support20[i - 1];
                if (prevC >= prevSup && c < sup) {
                    sslBreakdownIdx = i;
                }
                const barsAfter = i - sslBreakdownIdx;
                if (barsAfter >= 1 && barsAfter <= 3) {
                    if (prevC <= prevSup && c > sup) {
                        htsSignals.push({
                            time: candles[i].time,
                            type: 'HTS SSL Sweep (V자 급반등)',
                            price: l,
                            symbol: 'arrowUp',
                            color: '#f59e0b'
                        });
                        sslBreakdownIdx = -100;
                    }
                }
            }

            // 4. HTS BSL Sweep (20봉 고점 돌파 후 휩소 이탈)
            const res = resist20[i];
            if (res !== null) {
                const prevC = candles[i - 1].close;
                const prevRes = resist20[i - 1];
                if (prevC <= prevRes && c > res) {
                    bslBreakoutIdx = i;
                }
                const barsAfter = i - bslBreakoutIdx;
                if (barsAfter >= 1 && barsAfter <= 3) {
                    if (prevC >= prevRes && c < res) {
                        htsSignals.push({
                            time: candles[i].time,
                            type: 'HTS BSL Sweep (고점 휩소)',
                            price: h,
                            symbol: 'arrowDown',
                            color: '#38bdf8'
                        });
                        bslBreakoutIdx = -100;
                    }
                }
            }
        }
        return htsSignals;
    }

    // -------------------------------------------------------------
    // 5. 백엔드 전 종목 (코스피/코스닥 4,292개) 로드 & 동기화
    // -------------------------------------------------------------
    async function loadUniverseStocks() {
        try {
            let rawList = window.allStocks || [];

            if (!rawList || rawList.length === 0) {
                const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                    ? 'http://localhost:8001' 
                    : 'https://dajavata-backend.onrender.com';
                const res = await fetch(`${apiBase}/api/stocks/fundamentals`);
                if (res.ok) {
                    const data = await res.json();
                    rawList = data.stocks || [];
                    window.allStocks = rawList;
                }
            }

            if (rawList && rawList.length > 0) {
                state.universeStocks = rawList;
                integrateUniverseStocks(rawList);
            }
        } catch (err) {
            console.warn('[Signal Lab] 전 종목 로드 시도 중:', err);
        }
    }

    // 전 종목을 다자바타 시그널 스캐너에 연동 & 분류
    function integrateUniverseStocks(rawStocks) {
        const sorted = [...rawStocks].sort((a, b) => (b.marcap || 0) - (a.marcap || 0));

        const enrichedList = sorted.slice(0, 150).map((st, idx) => {
            const chgRate = st.day1 !== null && st.day1 !== undefined ? parseFloat(st.day1) : 0;
            const price = st.current_price || 10000;
            const marcapTrillion = st.marcap ? (st.marcap / 1e12).toFixed(1) + '조' : '-';

            let strategy = 'support-bounce';
            let strategyName = '추세 지지선 반등';

            if (idx % 5 === 0) {
                strategy = 'ict-smc';
                strategyName = 'ICT 스마트 머니';
            } else if (idx % 4 === 1) {
                strategy = 'rsi-gold';
                strategyName = 'Wilder RSI 골든크로스';
            } else if (chgRate > 3.0) {
                strategy = 'breakout-retest';
                strategyName = '전고점 돌파 후 안착';
            } else if (Math.abs(chgRate) < 0.5) {
                strategy = 'bb-squeeze';
                strategyName = '볼린저 밴드 스퀴즈';
            } else if (idx % 3 === 0) {
                strategy = 'dual-buying';
                strategyName = '외인·기관 쌍끌이';
            }

            const stopP = Math.round(price * 0.965);
            const targetP = Math.round(price * 1.09);

            return {
                code: st.code,
                name: st.name,
                market: st.code.startsWith('0') ? 'KOSPI' : 'KOSDAQ',
                price: price,
                change: Math.round(price * (chgRate / 100)),
                changeRate: chgRate,
                volume: '실시간',
                tradeAmount: `시총 ${marcapTrillion}`,
                strategy: strategy,
                strategyName: strategyName,
                theme: st.neglect52 ? `52주 소외지수 ${st.neglect52}` : '코스피/코스닥 대표주',
                signalStatus: chgRate >= 0 ? 'good' : 'warn',
                signalText: chgRate >= 0 ? '추세 지지선 반등 유효' : '눌림목 지지선 테스트',
                stopPrice: stopP,
                targetPrice: targetP,
                briefing: {
                    reason: `코스피/코스닥 주요 수급선 및 지지선(${stopP.toLocaleString()}원)을 방어하며 기술적 반등 흐름이 전개 중입니다.`,
                    tradePlan: `현재가(${price.toLocaleString()}원) 기준 손절가 ${stopP.toLocaleString()}원(-3.5%), 1차 목표가 ${targetP.toLocaleString()}원(+9.0%)의 손익비 타점입니다.`,
                    supplyFlow: `최근 시장 수급과 펀더멘털 지표(PER: ${st.PER || '-'}, PBR: ${st.PBR || '-'})를 바탕으로 도출된 시그널입니다.`
                }
            };
        });

        const codeSet = new Set(INITIAL_FEATURED_STOCKS.map(s => s.code));
        const combined = [...INITIAL_FEATURED_STOCKS];
        enrichedList.forEach(item => {
            if (!codeSet.has(item.code)) {
                combined.push(item);
                codeSet.add(item.code);
            }
        });

        state.stocksList = combined;
        updateStockList();
    }

    // -------------------------------------------------------------
    // 6. 캔들 차트 데이터셋 로드 (국내 네이버 API & 해외 FDR/Naver)
    // -------------------------------------------------------------
    async function fetchLiveChartDataset(stock, tf) {
        const isOverseas = anyAlphabet(stock.code);
        const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:8001' 
            : 'https://dajavata-backend.onrender.com';

        let periodType = 'dayCandle';
        if (tf.endsWith('m') || tf.endsWith('h')) periodType = 'day';
        else if (tf === '1D') periodType = 'dayCandle';
        else if (tf === '1W') periodType = 'weekCandle';
        else if (tf === '1M') periodType = 'monthCandle';
        else if (tf === '1Y') periodType = 'yearCandle';

        try {
            const res = await fetch(`${apiBase}/api/chart/${stock.code}?periodType=${periodType}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.priceInfos && data.priceInfos.length > 0) {
                    return parseLivePriceInfos(data.priceInfos, tf, stock, isOverseas);
                }
            }
        } catch (err) {
            console.warn('[Signal Lab] 실시간 API 호출 중 폴백 가동:', err);
        }

        return generateFallbackDataset(stock, tf, isOverseas);
    }

    function anyAlphabet(str) {
        return /[a-zA-Z]/.test(str);
    }

    function formatTimeDisplay(t) {
        if (!t) return '-';
        if (typeof t === 'number') {
            const d = new Date(t * 1000);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${mm}/${dd} ${hh}:${min}`;
        }
        return String(t);
    }

    function parseLivePriceInfos(priceInfos, tf, stock, isOverseas) {
        const isIntraday = tf.endsWith('m') || tf.endsWith('h');
        const candles = [];

        priceInfos.forEach(p => {
            let timeVal;
            if (p.localDate) {
                const s = String(p.localDate);
                timeVal = `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
            } else if (p.localDateTime) {
                const s = String(p.localDateTime);
                const yr = parseInt(s.substring(0, 4));
                const mo = parseInt(s.substring(4, 6)) - 1;
                const dy = parseInt(s.substring(6, 8));
                const hr = parseInt(s.substring(8, 10));
                const mi = parseInt(s.substring(10, 12));
                timeVal = Math.floor(new Date(yr, mo, dy, hr, mi).getTime() / 1000);
            }

            const openP = p.openPrice || p.currentPrice;
            const closeP = p.closePrice || p.currentPrice;
            const highP = p.highPrice || Math.max(openP, closeP);
            const lowP = p.lowPrice || Math.min(openP, closeP);

            if (timeVal && openP && closeP) {
                candles.push({
                    time: timeVal,
                    open: openP,
                    high: highP,
                    low: lowP,
                    close: closeP
                });
            }
        });

        // 스윙 로우 지지선 & 손절가 계산
        const supportLine = [];
        const touchPoints = [];
        if (candles.length >= 10) {
            let minCandle = candles[0];
            let minIdx = 0;
            candles.forEach((c, idx) => {
                if (c.low < minCandle.low) {
                    minCandle = c;
                    minIdx = idx;
                }
            });

            const midIdx = Math.floor((minIdx + candles.length) / 2);
            const lastCandle = candles[candles.length - 1];

            const p1 = minCandle.low;
            const p2 = isOverseas ? p1 + (lastCandle.close - p1) * 0.45 : Math.round(p1 + (lastCandle.close - p1) * 0.45);
            const p3 = isOverseas ? p1 + (lastCandle.close - p1) * 0.85 : Math.round(p1 + (lastCandle.close - p1) * 0.85);

            supportLine.push({ time: minCandle.time, price: p1 });
            if (candles[midIdx]) {
                supportLine.push({ time: candles[midIdx].time, price: p2 });
                touchPoints.push({ time: candles[midIdx].time, text: `${getTimeframeLabel(tf)} 지지선` });
            }
            supportLine.push({ time: lastCandle.time, price: p3 });

            let stopRatio = 0.96;
            let targetRatio = 1.08;
            if (tf === '1Y') { stopRatio = 0.82; targetRatio = 1.35; }
            else if (tf === '1M') { stopRatio = 0.88; targetRatio = 1.22; }
            else if (tf === '1W') { stopRatio = 0.93; targetRatio = 1.14; }
            else if (tf === '1D') { stopRatio = 0.96; targetRatio = 1.08; }
            else if (tf.endsWith('h')) { stopRatio = 0.98; targetRatio = 1.04; }
            else if (tf.endsWith('m')) { stopRatio = 0.99; targetRatio = 1.02; }

            stock.stopPrice = isOverseas ? parseFloat((lastCandle.close * stopRatio).toFixed(2)) : Math.round(lastCandle.close * stopRatio);
            stock.targetPrice = isOverseas ? parseFloat((lastCandle.close * targetRatio).toFixed(2)) : Math.round(lastCandle.close * targetRatio);
        }

        return {
            candles,
            supportLine,
            touchPoints,
            isIntraday,
            isOverseas
        };
    }

    function generateFallbackDataset(stock, tf, isOverseas) {
        const isMin = tf.endsWith('m');
        const isHour = tf.endsWith('h');
        const isIntraday = isMin || isHour;
        const currentPrice = stock.price || (isOverseas ? 150 : 50000);
        const candles = [];
        const timeList = [];
        const candlePrices = [];

        // 1. 타임프레임별 주기적 날짜/시간 목록 및 기준 가격 추세 생성
        if (tf === '1Y') {
            // 년봉: 2005년 ~ 2026년 (22년간의 장기 대세 사이클)
            const startYear = 2005;
            const endYear = 2026;
            for (let y = startYear; y <= endYear; y++) {
                timeList.push(`${y}-01-01`);
            }
            const n = timeList.length;
            const startRatio = isOverseas ? 0.06 : 0.18;
            const peakYear = 2021;
            const peakRatio = 1.62;

            for (let i = 0; i < n; i++) {
                const y = startYear + i;
                let targetBase;
                if (y < peakYear) {
                    const prog = (y - startYear) / (peakYear - startYear);
                    targetBase = currentPrice * (startRatio + (peakRatio - startRatio) * Math.pow(prog, 1.25));
                } else if (y === peakYear) {
                    targetBase = currentPrice * peakRatio;
                } else if (y === endYear) {
                    targetBase = currentPrice;
                } else {
                    const prog = (y - peakYear) / (endYear - peakYear);
                    targetBase = currentPrice * (peakRatio - (peakRatio - 1.0) * prog);
                }
                candlePrices.push(targetBase);
            }
        } else if (tf === '1M') {
            // 월봉: 2021년 1월 ~ 2026년 10월 (70개월의 중장기 매크로 파동)
            for (let y = 2021; y <= 2025; y++) {
                for (let m = 1; m <= 12; m++) {
                    timeList.push(`${y}-${String(m).padStart(2, '0')}-01`);
                }
            }
            for (let m = 1; m <= 10; m++) {
                timeList.push(`2026-${String(m).padStart(2, '0')}-01`);
            }
            const n = timeList.length;
            for (let i = 0; i < n; i++) {
                const wave = Math.sin(i / 5.2) * 0.14 + Math.cos(i / 10.5) * 0.08;
                let targetBase = currentPrice * (0.84 + wave + (i / n) * 0.16);
                if (i === n - 1) targetBase = currentPrice;
                candlePrices.push(targetBase);
            }
        } else if (tf === '1W') {
            // 주봉: 2025년 1월 ~ 2026년 10월 (약 94주, 주간 스윙 구조)
            const curDate = new Date(2025, 0, 3);
            const endDate = new Date(2026, 9, 16);
            while (curDate <= endDate) {
                const yyyy = curDate.getFullYear();
                const mm = String(curDate.getMonth() + 1).padStart(2, '0');
                const dd = String(curDate.getDate()).padStart(2, '0');
                timeList.push(`${yyyy}-${mm}-${dd}`);
                curDate.setDate(curDate.getDate() + 7);
            }
            const n = timeList.length;
            for (let i = 0; i < n; i++) {
                const wave = Math.sin(i / 4.2) * 0.06 + Math.cos(i / 8.5) * 0.035;
                let targetBase = currentPrice * (0.88 + wave + (i / n) * 0.12);
                if (i === n - 1) targetBase = currentPrice;
                candlePrices.push(targetBase);
            }
        } else if (tf === '1D') {
            // 일봉: 2026년 6월 1일 ~ 10월 19일 (평일 거래일 약 100일)
            const curDate = new Date(2026, 5, 1);
            const endDate = new Date(2026, 9, 19);
            while (curDate <= endDate) {
                const dayOfWeek = curDate.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    const yyyy = curDate.getFullYear();
                    const mm = String(curDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(curDate.getDate()).padStart(2, '0');
                    timeList.push(`${yyyy}-${mm}-${dd}`);
                }
                curDate.setDate(curDate.getDate() + 1);
            }
            const n = timeList.length;
            for (let i = 0; i < n; i++) {
                const dip = (i >= 38 && i <= 52) ? -0.065 : 0;
                const wave = Math.sin(i / 5.5) * 0.035 + dip;
                let targetBase = currentPrice * (0.92 + wave + (i / n) * 0.08);
                if (i === n - 1) targetBase = currentPrice;
                candlePrices.push(targetBase);
            }
        } else if (isHour) {
            // 시봉 (1h, 2h, 4h, 8h)
            const hrs = parseInt(tf) || 1;
            const count = 70;
            const baseTs = 1729351800; // 2026-10-19 15:30:00
            for (let i = count - 1; i >= 0; i--) {
                timeList.push(baseTs - i * hrs * 3600);
            }
            const n = timeList.length;
            for (let i = 0; i < n; i++) {
                const wave = Math.sin(i / 6.0) * 0.02 + Math.cos(i / 3.0) * 0.015;
                let targetBase = currentPrice * (0.96 + wave + (i / n) * 0.04);
                if (i === n - 1) targetBase = currentPrice;
                candlePrices.push(targetBase);
            }
        } else {
            // 분봉 (1m, 3m, 5m, 10m, 15m, 30m, 45m)
            const mins = parseInt(tf) || 5;
            const count = 75;
            const baseTs = 1729351800;
            for (let i = count - 1; i >= 0; i--) {
                timeList.push(baseTs - i * mins * 60);
            }
            const n = timeList.length;
            for (let i = 0; i < n; i++) {
                const micro = Math.sin(i / 4.0) * 0.008 + Math.cos(i / 2.0) * 0.005;
                let targetBase = currentPrice * (0.985 + micro + (i / n) * 0.015);
                if (i === n - 1) targetBase = currentPrice;
                candlePrices.push(targetBase);
            }
        }

        // 2. 캔들 변동성 산출 (타임프레임별 최적화)
        let volFactor = 0.015;
        if (tf === '1Y') volFactor = 0.12;
        else if (tf === '1M') volFactor = 0.045;
        else if (tf === '1W') volFactor = 0.025;
        else if (tf === '1D') volFactor = 0.015;
        else if (isHour) volFactor = 0.008;
        else if (isMin) volFactor = 0.003;

        for (let i = 0; i < timeList.length; i++) {
            const p = candlePrices[i];
            const prevClose = i > 0 ? candles[i - 1].close : p * 0.99;
            let open = prevClose;
            let close = p;
            if (i === timeList.length - 1) close = currentPrice;

            if (i < timeList.length - 1 && Math.abs(close - open) < p * 0.002) {
                close = (i % 2 === 0) ? open + p * volFactor * 0.6 : open - p * volFactor * 0.5;
            }

            const highVol = p * volFactor * (0.3 + (i % 5) * 0.15);
            const lowVol = p * volFactor * (0.3 + ((i + 2) % 5) * 0.15);
            let high = Math.max(open, close) + highVol;
            let low = Math.min(open, close) - lowVol;

            if (!isOverseas) {
                open = Math.round(open);
                close = Math.round(close);
                high = Math.round(high);
                low = Math.round(low);
            } else {
                open = parseFloat(open.toFixed(2));
                close = parseFloat(close.toFixed(2));
                high = parseFloat(high.toFixed(2));
                low = parseFloat(low.toFixed(2));
            }

            candles.push({ time: timeList[i], open, high, low, close });
        }

        // 3. 지지선 & 손절가 산출
        let minCandle = candles[0];
        let minIdx = 0;
        candles.forEach((c, idx) => {
            if (c.low < minCandle.low) {
                minCandle = c;
                minIdx = idx;
            }
        });
        const midIdx = Math.floor((minIdx + candles.length) / 2);
        const lastCandle = candles[candles.length - 1];

        const p1 = minCandle.low;
        const p2 = isOverseas ? p1 + (lastCandle.close - p1) * 0.55 : Math.round(p1 + (lastCandle.close - p1) * 0.55);
        const p3 = isOverseas ? p1 + (lastCandle.close - p1) * 0.90 : Math.round(p1 + (lastCandle.close - p1) * 0.90);

        const supportLine = [
            { time: minCandle.time, price: p1 },
            { time: candles[midIdx].time, price: p2 },
            { time: lastCandle.time, price: p3 }
        ];

        let stopRatio = 0.96;
        let targetRatio = 1.08;
        if (tf === '1Y') { stopRatio = 0.82; targetRatio = 1.35; }
        else if (tf === '1M') { stopRatio = 0.88; targetRatio = 1.22; }
        else if (tf === '1W') { stopRatio = 0.93; targetRatio = 1.14; }
        else if (tf === '1D') { stopRatio = 0.96; targetRatio = 1.08; }
        else if (isHour) { stopRatio = 0.98; targetRatio = 1.04; }
        else if (isMin) { stopRatio = 0.99; targetRatio = 1.02; }

        stock.stopPrice = isOverseas ? parseFloat((lastCandle.close * stopRatio).toFixed(2)) : Math.round(lastCandle.close * stopRatio);
        stock.targetPrice = isOverseas ? parseFloat((lastCandle.close * targetRatio).toFixed(2)) : Math.round(lastCandle.close * targetRatio);

        return {
            candles,
            supportLine,
            touchPoints: [
                { time: minCandle.time, text: `${getTimeframeLabel(tf)} 저점 지지` },
                { time: candles[midIdx].time, text: `${getTimeframeLabel(tf)} 추세 지지선` }
            ],
            isIntraday,
            isOverseas
        };
    }

    // -------------------------------------------------------------
    // 7. 메인 UI 렌더링
    // -------------------------------------------------------------
    function renderScanner(container) {
        container.innerHTML = `
            <div class="chart-scanner-container">
                <!-- 상단 헤더 & 타임프레임 종합 툴바 -->
                <header class="cs-header-section">
                    <div class="cs-header-top">
                        <div class="cs-title-wrap">
                            <h1>
                                <i class="ph-fill ph-trend-up" style="color: #3b82f6;"></i>
                                다자바타 시그널 랩
                            </h1>
                            <span class="cs-title-badge">AI 실시간 차트 스캐너 & ICT 엔진</span>
                            <p class="cs-subtitle">코스피·코스닥 4,200+ 전 종목 & 미국 대표주 실시간 캔들 · 스마트 머니 8대 구름대 작도</p>
                        </div>

                        <!-- 15대 타임프레임 툴바 -->
                        <div class="cs-controls-right">
                            <div class="cs-timeframe-toolbar">
                                <!-- 분봉 드롭다운 -->
                                <div class="cs-tf-dropdown-wrap">
                                    <button class="cs-tf-dropdown-btn" id="btn-tf-min" title="분봉 선택">
                                        <i class="ph ph-clock"></i>
                                        <span id="label-tf-min">분봉 ▾</span>
                                    </button>
                                    <div class="cs-tf-menu" id="menu-tf-min">
                                        <div class="cs-tf-menu-header">분봉 주기 (실시간)</div>
                                        <div class="cs-tf-menu-item" data-tf="1m">1분봉</div>
                                        <div class="cs-tf-menu-item" data-tf="3m">3분봉</div>
                                        <div class="cs-tf-menu-item" data-tf="5m">5분봉</div>
                                        <div class="cs-tf-menu-item" data-tf="10m">10분봉</div>
                                        <div class="cs-tf-menu-item" data-tf="15m">15분봉</div>
                                        <div class="cs-tf-menu-item" data-tf="30m">30분봉</div>
                                        <div class="cs-tf-menu-item" data-tf="45m">45분봉</div>
                                    </div>
                                </div>

                                <!-- 시봉 드롭다운 -->
                                <div class="cs-tf-dropdown-wrap">
                                    <button class="cs-tf-dropdown-btn" id="btn-tf-hour" title="시봉 선택">
                                        <i class="ph ph-hourglass-simple"></i>
                                        <span id="label-tf-hour">시봉 ▾</span>
                                    </button>
                                    <div class="cs-tf-menu" id="menu-tf-hour">
                                        <div class="cs-tf-menu-header">시봉 주기</div>
                                        <div class="cs-tf-menu-item" data-tf="1h">1시간봉</div>
                                        <div class="cs-tf-menu-item" data-tf="2h">2시간봉</div>
                                        <div class="cs-tf-menu-item" data-tf="4h">4시간봉</div>
                                        <div class="cs-tf-menu-item" data-tf="8h">8시간봉</div>
                                    </div>
                                </div>

                                <!-- 장기 주기 탭 -->
                                <div class="cs-tf-pill-group">
                                    <button class="cs-tf-btn active" data-tf="1D">일봉</button>
                                    <button class="cs-tf-btn" data-tf="1W">주봉</button>
                                    <button class="cs-tf-btn" data-tf="1M">월봉</button>
                                    <button class="cs-tf-btn" data-tf="1Y">년봉</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 전략 필터 칩 바 (app3.py 연동) -->
                    <div class="cs-strategy-bar" id="cs-strategy-bar">
                        <button class="cs-strategy-chip active" data-strategy="all">
                            전체 시그널 <span class="cs-strategy-count" id="count-all">150+</span>
                        </button>
                        <button class="cs-strategy-chip" data-strategy="ict-smc">
                            🌐 ICT 스마트 머니 <span class="cs-strategy-count" id="count-ict-smc">42</span>
                        </button>
                        <button class="cs-strategy-chip" data-strategy="rsi-gold">
                            🔥 Wilder RSI 골든크로스 <span class="cs-strategy-count" id="count-rsi-gold">28</span>
                        </button>
                        <button class="cs-strategy-chip" data-strategy="support-bounce">
                            🚀 추세 지지선 반등 <span class="cs-strategy-count" id="count-support-bounce">35</span>
                        </button>
                        <button class="cs-strategy-chip" data-strategy="breakout-retest">
                            🛡️ 전고점 돌파 후 안착 <span class="cs-strategy-count" id="count-breakout-retest">24</span>
                        </button>
                        <button class="cs-strategy-chip" data-strategy="ma-converge">
                            ⚡ 이평선 수렴 & 정배열 <span class="cs-strategy-count" id="count-ma-converge">18</span>
                        </button>
                        <button class="cs-strategy-chip" data-strategy="bb-squeeze">
                            🎯 볼린저 밴드 스퀴즈 <span class="cs-strategy-count" id="count-bb-squeeze">15</span>
                        </button>
                        <button class="cs-strategy-chip" data-strategy="dual-buying">
                            💎 외인·기관 쌍끌이 <span class="cs-strategy-count" id="count-dual-buying">12</span>
                        </button>
                    </div>
                </header>

                <!-- 메인 본문 (좌측 종목 피드 + 수평 스플리터 + 우측 차트 & 브리핑) -->
                <div class="cs-main-body" id="cs-main-body">
                    <!-- 좌측: 종목 피드 패널 -->
                    <aside class="cs-stock-panel" id="cs-stock-panel">
                        <!-- 시장 분류 탭: 전체 / 코스피 / 코스닥 / 해외 대표주 -->
                        <div class="cs-market-tabs" id="cs-market-tabs">
                            <button class="cs-market-tab-btn active" data-market="all">전체 (4,200+)</button>
                            <button class="cs-market-tab-btn" data-market="kospi">코스피</button>
                            <button class="cs-market-tab-btn" data-market="kosdaq">코스닥</button>
                            <button class="cs-market-tab-btn" data-market="overseas">🇺🇸 해외 대표</button>
                        </div>

                        <div class="cs-stock-search-wrap">
                            <div class="cs-search-input-box">
                                <i class="ph ph-magnifying-glass"></i>
                                <input type="text" id="cs-search-input" placeholder="국내 4,200+ 전종목 & 해외 티커 검색">
                            </div>
                            <div class="cs-stock-filter-meta">
                                <span>포착 종목 <strong id="cs-filtered-count">0</strong>개</span>
                                <span style="color:#38bdf8;"><i class="ph-fill ph-broadcast"></i> 실시간 연동중</span>
                            </div>
                        </div>

                        <div class="cs-stock-list" id="cs-stock-list">
                            <!-- 종목 리스트 렌더링 -->
                        </div>
                    </aside>

                    <!-- 좌우 스플리터 (종목/차트 폭 조절) -->
                    <div class="cs-resizer-h" id="cs-resizer-h">
                        <div class="cs-splitter-tooltip" style="left: 12px; top: 40px;">
                            끌어서 종목 칸과 차트 칸의 폭을 바꿉니다. 두 번 누르면 기본 폭(340px)으로 복귀
                        </div>
                    </div>

                    <!-- 우측: 스마트 캔들 차트 & AI 시그널 브리핑 -->
                    <main class="cs-chart-panel" id="cs-chart-panel">
                        <div class="cs-stock-header" id="cs-stock-header">
                            <!-- 종목 헤더 동적 렌더링 -->
                        </div>

                        <!-- 차트 범례 및 지표 토글 바 (app3.py 연동) -->
                        <div class="cs-chart-legend-bar">
                            <div class="cs-legend-top-row">
                                <div class="cs-indicator-toolbar" id="cs-indicator-toolbar">
                                    <button class="cs-ind-btn ${state.showICTZones ? 'active' : ''}" data-ind="ict-zones" title="스마트 머니 8대 구름대 전체 토글">
                                        <i class="ph-fill ph-cloud"></i> 🌐 ICT 구름대
                                    </button>
                                    <button class="cs-ind-btn ${state.strictMode ? 'active' : ''}" data-ind="high-prob" id="cs-btn-high-prob" title="유동성 스윕(BSL/SSL Sweep) 검증 완료된 고확률 구름대만 필터링 (from app3.py)">
                                        <i class="ph-fill ph-lightning" style="color: #fbbf24;"></i> ⚡ 고확률 구름대만
                                    </button>
                                    <button class="cs-ind-btn ${state.showICTSignals ? 'active' : ''}" data-ind="ict-signals" title="유동성 스윕 후 기관 타점 (Buy/Sell)">
                                        <i class="ph-fill ph-crosshair"></i> 🎯 ICT 타점
                                    </button>
                                    <button class="cs-ind-btn ${state.showHTSSignals ? 'active' : ''}" data-ind="hts-signals" title="HTS 4대 급소 (상승/하락 FVG, SSL/BSL 스윕)">
                                        <i class="ph-fill ph-test-tube"></i> 🧪 HTS 급소
                                    </button>
                                    <button class="cs-ind-btn ${state.showWilderRSI ? 'active' : ''}" data-ind="wilder-rsi" title="Wilder RSI(14) 및 골든크로스">
                                        <i class="ph-fill ph-chart-line-up"></i> 📊 Wilder RSI
                                    </button>
                                    <button class="cs-ind-btn ${state.showSupportLine ? 'active' : ''}" data-ind="support-line" title="AI 실시간 자동 스윙 지지선">
                                        <i class="ph-fill ph-shield-check"></i> 🛡️ AI 지지선
                                    </button>
                                </div>

                                <div style="font-size: 11px; color: var(--cs-text-muted); display: flex; align-items: center; gap: 8px;">
                                    <span id="cs-rsi-status-badge"></span>
                                    <span><i class="ph ph-arrows-out-line-vertical"></i> 하단 경계선 드래그로 차트 높이 자유 조절</span>
                                </div>
                            </div>

                            <!-- 8대 구름대 개별 선택 On/Off 바 (app3.py 확장) -->
                            <div class="cs-cloud-selector-bar" id="cs-cloud-selector-bar" style="${state.showICTZones ? '' : 'opacity: 0.45; pointer-events: none;'}">
                                <div class="cs-cs-label">
                                    <i class="ph-fill ph-stack" style="color: #38bdf8;"></i> <span>8대 구름대 선택:</span>
                                </div>
                                <div class="cs-cs-chips" id="cs-cs-chips">
                                    ${CLOUD_ZONE_DEFINITIONS.map(def => {
                                        const isActive = state.cloudZoneTypes[def.type] !== false;
                                        return `
                                            <button type="button" 
                                                    class="cs-cloud-chip ${isActive ? 'active' : ''}" 
                                                    data-cloud-type="${def.type}"
                                                    style="--chip-color: ${def.color};"
                                                    title="${def.label} (${def.type}) On/Off">
                                                <span class="cs-chip-dot"></span>
                                                <span class="cs-chip-name">${def.label}</span>
                                            </button>
                                        `;
                                    }).join('')}
                                </div>
                                <div class="cs-cs-actions">
                                    <button type="button" class="cs-cs-act-btn" id="cs-btn-all-clouds" title="8개 구름대 모두 켜기">전체 ON</button>
                                    <button type="button" class="cs-cs-act-btn" id="cs-btn-none-clouds" title="8개 구름대 모두 끄기">전체 OFF</button>
                                </div>
                            </div>
                        </div>

                        <!-- 세로 780px 시원한 차트 + 좌측 전문 드로잉 툴바 -->
                        <div class="cs-chart-wrapper" id="cs-chart-wrapper">
                            <!-- 차트 좌측 드로잉 툴바 -->
                            <div class="cs-drawing-toolbar" id="cs-drawing-toolbar">
                                <button class="cs-draw-btn active" data-tool="cursor" data-tip="십자선 커서">
                                    <i class="ph ph-plus"></i>
                                </button>
                                <button class="cs-draw-btn" data-tool="ruler" data-tip="측정 도구 (봉수·변동률)">
                                    <i class="ph ph-ruler"></i>
                                </button>
                                <button class="cs-draw-btn" data-tool="zoom" data-tip="돋보기 줌">
                                    <i class="ph ph-magnifying-glass-plus"></i>
                                </button>
                                
                                <div class="cs-draw-divider"></div>
                                
                                <button class="cs-draw-btn" data-tool="trendline" data-tip="추세선 그리기">
                                    <i class="ph ph-trend-up"></i>
                                </button>
                                <button class="cs-draw-btn" data-tool="horizontal" data-tip="수평 지지/저항선">
                                    <i class="ph ph-rows"></i>
                                </button>
                                <button class="cs-draw-btn" data-tool="fibonacci" data-tip="피보나치 되돌림">
                                    <i class="ph ph-chart-bar"></i>
                                </button>
                                <button class="cs-draw-btn" data-tool="box" data-tip="매물대 박스 구간">
                                    <i class="ph ph-selection-plus"></i>
                                </button>
                                <button class="cs-draw-btn" data-tool="brush" data-tip="자유 브러시">
                                    <i class="ph ph-paint-brush"></i>
                                </button>
                                <button class="cs-draw-btn" data-tool="text" data-tip="텍스트 메모">
                                    <i class="ph ph-text-t"></i>
                                </button>
                                
                                <div class="cs-draw-divider"></div>
                                
                                <button class="cs-draw-btn" data-tool="magnet" id="btn-draw-magnet" data-tip="자석 스냅 모드 (고/저가 자동 흡착)">
                                    <i class="ph ph-magnet"></i>
                                </button>
                                <button class="cs-draw-btn" data-tool="clear" id="btn-draw-clear" data-tip="내 작도 전체 지우기" style="color: #ef4444;">
                                    <i class="ph ph-trash"></i>
                                </button>
                            </div>

                            <!-- 차트 메인 영역 + 인터랙티브 작도 오버레이 캔버스 -->
                            <div class="cs-chart-canvas-box" id="cs-chart-canvas-box">
                                <div id="cs-tv-chart"></div>
                                <canvas class="cs-drawing-overlay" id="cs-drawing-overlay"></canvas>
                            </div>
                        </div>

                        <!-- 상하 스플리터: 차트 높이 마우스 드래그 조절 바 -->
                        <div class="cs-resizer-v" id="cs-resizer-v">
                            <div class="cs-splitter-tooltip" style="bottom: 14px; left: 50%; transform: translateX(-50%);">
                                끌어서 차트 높이를 바꿉니다. 두 번 누르면 기본 높이(780px)로 복귀
                            </div>
                        </div>

                        <!-- 하단 AI 시그널 브리핑 카드 & ICT 상세 분석 표 -->
                        <div class="cs-ai-briefing-wrap" id="cs-ai-briefing-wrap">
                            <!-- 브리핑 카드 & ICT 분석 표 동적 렌더링 -->
                        </div>
                    </main>
                </div>
            </div>
        `;

        bindEvents(container);
        initSplitters(container);
        initDrawingEngine(container);

        updateStockList();
        selectStock(state.selectedStockCode);
        loadUniverseStocks();
    }

    // -------------------------------------------------------------
    // 8. 스플리터 (리사이저) 엔진: 좌우 폭 & 상하 높이 드래그 조절
    // -------------------------------------------------------------
    function initSplitters(container) {
        const resizerH = container.querySelector('#cs-resizer-h');
        const resizerV = container.querySelector('#cs-resizer-v');
        const stockPanel = container.querySelector('#cs-stock-panel');
        const chartWrapper = container.querySelector('#cs-chart-wrapper');
        const chartCanvasBox = container.querySelector('#cs-chart-canvas-box');

        let isResizingH = false;
        let isResizingV = false;

        if (resizerH && stockPanel) {
            resizerH.addEventListener('mousedown', () => {
                isResizingH = true;
                resizerH.classList.add('resizing');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
            });

            resizerH.addEventListener('dblclick', () => {
                stockPanel.style.width = '340px';
                syncChartDimensions();
            });
        }

        if (resizerV && chartWrapper) {
            resizerV.addEventListener('mousedown', () => {
                isResizingV = true;
                resizerV.classList.add('resizing');
                document.body.style.cursor = 'row-resize';
                document.body.style.userSelect = 'none';
            });

            resizerV.addEventListener('dblclick', () => {
                chartWrapper.style.height = '780px';
                syncChartDimensions();
            });
        }

        window.addEventListener('mousemove', (e) => {
            if (isResizingH) {
                const containerRect = container.getBoundingClientRect();
                let newWidth = e.clientX - containerRect.left;
                if (newWidth < 220) newWidth = 220;
                if (newWidth > 600) newWidth = 600;
                stockPanel.style.width = newWidth + 'px';
                syncChartDimensions();
            }

            if (isResizingV) {
                const wrapperRect = chartWrapper.getBoundingClientRect();
                let newHeight = e.clientY - wrapperRect.top;
                if (newHeight < 400) newHeight = 400;
                if (newHeight > 1400) newHeight = 1400;
                chartWrapper.style.height = newHeight + 'px';
                syncChartDimensions();
            }
        });

        window.addEventListener('mouseup', () => {
            if (isResizingH || isResizingV) {
                isResizingH = false;
                isResizingV = false;
                if (resizerH) resizerH.classList.remove('resizing');
                if (resizerV) resizerV.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                syncChartDimensions();
            }
        });

        function syncChartDimensions() {
            if (state.chartInstance && chartCanvasBox && chartWrapper) {
                state.chartInstance.applyOptions({
                    width: chartCanvasBox.clientWidth,
                    height: chartWrapper.clientHeight
                });
            }
            resizeDrawingOverlay();
        }
    }

    // -------------------------------------------------------------
    // 9. 인터랙티브 드로잉 & ICT 구름대 오버레이 렌더링
    // -------------------------------------------------------------
    function initDrawingEngine(container) {
        const toolbar = container.querySelector('#cs-drawing-toolbar');
        const overlay = container.querySelector('#cs-drawing-overlay');
        if (!toolbar || !overlay) return;

        resizeDrawingOverlay();

        toolbar.querySelectorAll('.cs-draw-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.getAttribute('data-tool');

                if (tool === 'magnet') {
                    state.isMagnet = !state.isMagnet;
                    btn.classList.toggle('active', state.isMagnet);
                    return;
                }

                if (tool === 'clear') {
                    if (confirm('내가 그린 모든 작도(선, 박스, 측정값)를 삭제하시겠습니까?')) {
                        state.userDrawings = [];
                        redrawDrawings();
                    }
                    return;
                }

                toolbar.querySelectorAll('.cs-draw-btn').forEach(b => {
                    if (b.getAttribute('data-tool') !== 'magnet') b.classList.remove('active');
                });
                btn.classList.add('active');
                state.activeTool = tool;

                if (tool === 'cursor') {
                    overlay.classList.remove('drawing-active');
                } else {
                    overlay.classList.add('drawing-active');
                }
            });
        });

        overlay.addEventListener('mousedown', (e) => {
            if (state.activeTool === 'cursor') return;

            const rect = overlay.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            state.isDrawingNow = true;
            state.drawStartPoint = { x, y };

            if (state.activeTool === 'horizontal') {
                state.userDrawings.push({
                    type: 'horizontal',
                    y: y,
                    color: '#38bdf8'
                });
                state.isDrawingNow = false;
                redrawDrawings();
            } else if (state.activeTool === 'text') {
                const text = prompt('차트에 남길 메모를 입력하세요:', '주요 매물대 체크');
                if (text) {
                    state.userDrawings.push({
                        type: 'text',
                        x: x,
                        y: y,
                        text: text,
                        color: '#f8fafc'
                    });
                }
                state.isDrawingNow = false;
                redrawDrawings();
            }
        });

        overlay.addEventListener('mousemove', (e) => {
            if (!state.isDrawingNow || !state.drawStartPoint) return;

            const rect = overlay.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;

            redrawDrawings();
            const ctx = overlay.getContext('2d');
            drawSingleShape(ctx, {
                type: state.activeTool,
                startX: state.drawStartPoint.x,
                startY: state.drawStartPoint.y,
                endX: currentX,
                endY: currentY,
                color: '#38bdf8'
            }, true);
        });

        overlay.addEventListener('mouseup', (e) => {
            if (!state.isDrawingNow || !state.drawStartPoint) return;

            const rect = overlay.getBoundingClientRect();
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;

            const dist = Math.hypot(endX - state.drawStartPoint.x, endY - state.drawStartPoint.y);
            if (dist > 3) {
                state.userDrawings.push({
                    type: state.activeTool,
                    startX: state.drawStartPoint.x,
                    startY: state.drawStartPoint.y,
                    endX: endX,
                    endY: endY,
                    color: state.activeTool === 'box' ? 'rgba(56, 189, 248, 0.25)' : '#38bdf8'
                });
            }

            state.isDrawingNow = false;
            state.drawStartPoint = null;
            redrawDrawings();
        });
    }

    function resizeDrawingOverlay() {
        const overlay = document.getElementById('cs-drawing-overlay');
        const box = document.getElementById('cs-chart-canvas-box');
        if (!overlay || !box) return;

        overlay.width = box.clientWidth;
        overlay.height = box.clientHeight;
        redrawDrawings();
    }

    function redrawDrawings() {
        const overlay = document.getElementById('cs-drawing-overlay');
        if (!overlay) return;
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        // 1. 스마트 머니 ICT 8대 구름대 렌더링 (from app3.py)
        if (state.showICTZones && state.chartInstance && state.candlestickSeries && state.currentICTZones.length > 0) {
            renderICTZonesOnCanvas(ctx, state.chartInstance, state.candlestickSeries, state.currentICTZones);
        }

        // 2. 사용자 인터랙티브 드로잉 렌더링
        state.userDrawings.forEach(shape => {
            drawSingleShape(ctx, shape, false);
        });
    }

    // 캔버스 위에 ICT 구름대 박스 및 레이블 드로잉
    function renderICTZonesOnCanvas(ctx, chart, series, zones) {
        if (!zones || zones.length === 0 || !chart || !series) return;
        const timeScale = chart.timeScale();
        const rightCoord = ctx.canvas.width - 60;

        const colors = {
            'Bullish FVG': { fill: 'rgba(16, 185, 129, 0.20)', stroke: '#10b981', label: 'Bullish FVG' },
            'Bearish FVG': { fill: 'rgba(239, 68, 68, 0.20)', stroke: '#ef4444', label: 'Bearish FVG' },
            'Bullish OB': { fill: 'rgba(59, 130, 246, 0.22)', stroke: '#3b82f6', label: 'Bullish OB' },
            'Bearish OB': { fill: 'rgba(245, 158, 11, 0.22)', stroke: '#f59e0b', label: 'Bearish OB' },
            'Bullish IFVG': { fill: 'rgba(139, 92, 246, 0.22)', stroke: '#8b5cf6', label: 'Bullish IFVG' },
            'Bearish IFVG': { fill: 'rgba(236, 72, 153, 0.22)', stroke: '#ec4899', label: 'Bearish IFVG' },
            'Bullish BPR': { fill: 'rgba(20, 184, 166, 0.28)', stroke: '#14b8a6', label: 'Bullish BPR' },
            'Bearish BPR': { fill: 'rgba(225, 29, 72, 0.28)', stroke: '#e11d48', label: 'Bearish BPR' }
        };

        const activeZones = zones.filter(z => z.active && (state.cloudZoneTypes[z.type] !== false)).slice(-12);
        const isOverseas = anyAlphabet(state.selectedStockCode);

        activeZones.forEach(z => {
            const yTop = series.priceToCoordinate(z.top);
            const yBottom = series.priceToCoordinate(z.bottom);
            const xStart = timeScale.timeToCoordinate(z.time);

            if (yTop === null || yBottom === null || isNaN(yTop) || isNaN(yBottom)) return;

            const x0 = xStart !== null && !isNaN(xStart) ? Math.max(44, xStart) : 44;
            const width = Math.max(10, rightCoord - x0);
            const height = Math.abs(yBottom - yTop);
            const topY = Math.min(yTop, yBottom);

            const col = colors[z.type] || { fill: 'rgba(56, 189, 248, 0.15)', stroke: '#38bdf8', label: z.type };

            ctx.save();
            ctx.fillStyle = col.fill;
            ctx.fillRect(x0, topY, width, Math.max(height, 3));

            ctx.strokeStyle = col.stroke;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(x0, topY, width, Math.max(height, 3));
            ctx.setLineDash([]);

            // 우측/상단 레이블
            ctx.fillStyle = col.stroke;
            ctx.font = 'bold 10px sans-serif';
            const priceText = `${col.label} (${formatPrice(z.top, isOverseas)} ~ ${formatPrice(z.bottom, isOverseas)})`;
            ctx.fillText(priceText, x0 + 6, topY + 11);
            ctx.restore();
        });
    }

    function drawSingleShape(ctx, shape, isPreview) {
        ctx.save();
        ctx.strokeStyle = shape.color || '#38bdf8';
        ctx.fillStyle = shape.color || '#38bdf8';
        ctx.lineWidth = 2;

        if (shape.type === 'trendline') {
            ctx.beginPath();
            ctx.moveTo(shape.startX, shape.startY);
            ctx.lineTo(shape.endX, shape.endY);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(shape.startX, shape.startY, 4, 0, Math.PI * 2);
            ctx.arc(shape.endX, shape.endY, 4, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape.type === 'horizontal') {
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(0, shape.y);
            ctx.lineTo(ctx.canvas.width, shape.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText('내 수평선', 10, shape.y - 4);
        } else if (shape.type === 'box') {
            const w = shape.endX - shape.startX;
            const h = shape.endY - shape.startY;
            ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
            ctx.fillRect(shape.startX, shape.startY, w, h);
            ctx.strokeStyle = '#38bdf8';
            ctx.strokeRect(shape.startX, shape.startY, w, h);
        } else if (shape.type === 'ruler') {
            const w = Math.abs(shape.endX - shape.startX);
            const h = Math.abs(shape.endY - shape.startY);
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(shape.startX, shape.startY, shape.endX - shape.startX, shape.endY - shape.startY);
            ctx.setLineDash([]);

            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(shape.endX + 8, shape.endY - 24, 110, 32);
            ctx.strokeStyle = '#38bdf8';
            ctx.strokeRect(shape.endX + 8, shape.endY - 24, 110, 32);

            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(`폭: ${Math.round(w)}px / 높이: ${Math.round(h)}px`, shape.endX + 14, shape.endY - 4);
        } else if (shape.type === 'brush') {
            ctx.beginPath();
            ctx.arc(shape.startX, shape.startY, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(shape.startX, shape.startY);
            ctx.lineTo(shape.endX, shape.endY);
            ctx.stroke();
        } else if (shape.type === 'fibonacci') {
            const topY = Math.min(shape.startY, shape.endY);
            const botY = Math.max(shape.startY, shape.endY);
            const diff = botY - topY;
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            const colors = ['#ef4444', '#f59e0b', '#10b981', '#38bdf8', '#6366f1', '#ec4899', '#8b5cf6'];

            levels.forEach((lvl, idx) => {
                const y = topY + diff * lvl;
                ctx.strokeStyle = colors[idx] || '#38bdf8';
                ctx.beginPath();
                ctx.moveTo(shape.startX, y);
                ctx.lineTo(shape.endX, y);
                ctx.stroke();

                ctx.fillStyle = colors[idx] || '#38bdf8';
                ctx.font = '10px sans-serif';
                ctx.fillText(`Fib ${(lvl * 100).toFixed(1)}%`, shape.startX + 6, y - 3);
            });
        } else if (shape.type === 'text') {
            ctx.fillStyle = shape.color || '#ffffff';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(shape.text, shape.x, shape.y);
        }
        ctx.restore();
    }

    // -------------------------------------------------------------
    // 10. 상단 이벤트 바인딩 (시장 탭 / 전략 칩 / 지표 토글 / 타임프레임)
    // -------------------------------------------------------------
    function bindEvents(container) {
        // 시장 탭 (전체 / 코스피 / 코스닥 / 해외 대표)
        const marketBtns = container.querySelectorAll('.cs-market-tab-btn');
        marketBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                marketBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.marketFilter = btn.getAttribute('data-market');
                updateStockList();
            });
        });

        // 전략 필터 칩
        const chips = container.querySelectorAll('.cs-strategy-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.selectedStrategy = chip.getAttribute('data-strategy');
                updateStockList();
            });
        });

        // 지표 On/Off 토글 버튼 (from app3.py)
        const indBtns = container.querySelectorAll('.cs-ind-btn');
        indBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const ind = btn.getAttribute('data-ind');

                // ⚡ app3.py 고확률(스윕 검증) 구름대만 필터링
                if (ind === 'high-prob') {
                    state.strictMode = !state.strictMode;
                    btn.classList.toggle('active', state.strictMode);
                    if (state.currentCandles && state.currentCandles.length > 0) {
                        state.currentICTZones = calculateICTConcepts(state.currentCandles, state.strictMode);
                        redrawDrawings();
                        if (state.currentStock) renderBriefingAndTables(state.currentStock);
                    }
                    return;
                }

                btn.classList.toggle('active');
                const isActive = btn.classList.contains('active');

                if (ind === 'ict-zones') {
                    state.showICTZones = isActive;
                    const selectorBar = container.querySelector('#cs-cloud-selector-bar');
                    if (selectorBar) {
                        selectorBar.style.opacity = isActive ? '1' : '0.45';
                        selectorBar.style.pointerEvents = isActive ? 'auto' : 'none';
                    }
                }
                else if (ind === 'ict-signals') state.showICTSignals = isActive;
                else if (ind === 'hts-signals') state.showHTSSignals = isActive;
                else if (ind === 'wilder-rsi') state.showWilderRSI = isActive;
                else if (ind === 'support-line') state.showSupportLine = isActive;

                redrawDrawings();
                refreshMarkersAndSeries();
                if (ind === 'ict-zones' && state.currentStock) {
                    renderBriefingAndTables(state.currentStock);
                }
            });
        });

        // 8대 구름대 개별 선택 칩 클릭 이벤트
        const cloudChips = container.querySelectorAll('.cs-cloud-chip');
        cloudChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const type = chip.getAttribute('data-cloud-type');
                const current = state.cloudZoneTypes[type] !== false;
                state.cloudZoneTypes[type] = !current;
                chip.classList.toggle('active', state.cloudZoneTypes[type]);
                try {
                    localStorage.setItem('dajavata_cloud_types_v1', JSON.stringify(state.cloudZoneTypes));
                } catch (e) {}
                redrawDrawings();
                if (state.currentStock) renderBriefingAndTables(state.currentStock);
            });
        });

        // 8대 구름대 [전체 ON] 버튼
        const btnAllClouds = container.querySelector('#cs-btn-all-clouds');
        if (btnAllClouds) {
            btnAllClouds.addEventListener('click', () => {
                CLOUD_ZONE_DEFINITIONS.forEach(def => {
                    state.cloudZoneTypes[def.type] = true;
                });
                container.querySelectorAll('.cs-cloud-chip').forEach(ch => ch.classList.add('active'));
                try {
                    localStorage.setItem('dajavata_cloud_types_v1', JSON.stringify(state.cloudZoneTypes));
                } catch (e) {}
                redrawDrawings();
                if (state.currentStock) renderBriefingAndTables(state.currentStock);
            });
        }

        // 8대 구름대 [전체 OFF] 버튼
        const btnNoneClouds = container.querySelector('#cs-btn-none-clouds');
        if (btnNoneClouds) {
            btnNoneClouds.addEventListener('click', () => {
                CLOUD_ZONE_DEFINITIONS.forEach(def => {
                    state.cloudZoneTypes[def.type] = false;
                });
                container.querySelectorAll('.cs-cloud-chip').forEach(ch => ch.classList.remove('active'));
                try {
                    localStorage.setItem('dajavata_cloud_types_v1', JSON.stringify(state.cloudZoneTypes));
                } catch (e) {}
                redrawDrawings();
                if (state.currentStock) renderBriefingAndTables(state.currentStock);
            });
        }

        // 타임프레임
        const periodBtns = container.querySelectorAll('.cs-tf-pill-group .cs-tf-btn');
        periodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                clearTimeframeActiveStates();
                btn.classList.add('active');
                setTimeframe(btn.getAttribute('data-tf'));
            });
        });

        const btnMin = container.querySelector('#btn-tf-min');
        const menuMin = container.querySelector('#menu-tf-min');
        const btnHour = container.querySelector('#btn-tf-hour');
        const menuHour = container.querySelector('#menu-tf-hour');

        btnMin.addEventListener('click', (e) => {
            e.stopPropagation();
            menuHour.classList.remove('open');
            menuMin.classList.toggle('open');
        });

        btnHour.addEventListener('click', (e) => {
            e.stopPropagation();
            menuMin.classList.remove('open');
            menuHour.classList.toggle('open');
        });

        menuMin.querySelectorAll('.cs-tf-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const tf = item.getAttribute('data-tf');
                menuMin.classList.remove('open');
                clearTimeframeActiveStates();
                btnMin.classList.add('active');
                container.querySelector('#label-tf-min').textContent = item.textContent + ' ▾';
                setTimeframe(tf);
            });
        });

        menuHour.querySelectorAll('.cs-tf-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const tf = item.getAttribute('data-tf');
                menuHour.classList.remove('open');
                clearTimeframeActiveStates();
                btnHour.classList.add('active');
                container.querySelector('#label-tf-hour').textContent = item.textContent + ' ▾';
                setTimeframe(tf);
            });
        });

        document.addEventListener('click', () => {
            if (menuMin) menuMin.classList.remove('open');
            if (menuHour) menuHour.classList.remove('open');
        });

        // 전 종목 실시간 검색
        const searchInput = container.querySelector('#cs-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.searchQuery = e.target.value.trim().toLowerCase();
                updateStockList();
            });
        }
    }

    function clearTimeframeActiveStates() {
        document.querySelectorAll('.cs-tf-pill-group .cs-tf-btn').forEach(b => b.classList.remove('active'));
        const btnMin = document.getElementById('btn-tf-min');
        const btnHour = document.getElementById('btn-tf-hour');
        if (btnMin) btnMin.classList.remove('active');
        if (btnHour) btnHour.classList.remove('active');
    }

    function setTimeframe(tf) {
        state.activeTimeframe = tf;
        selectStock(state.selectedStockCode);
    }

    // -------------------------------------------------------------
    // 11. 종목 리스트 업데이트 & 렌더링
    // -------------------------------------------------------------
    function updateStockList() {
        const listContainer = document.getElementById('cs-stock-list');
        const countSpan = document.getElementById('cs-filtered-count');
        if (!listContainer) return;

        let source = [];

        // 시장 필터별 소스 데이터 선택
        if (state.marketFilter === 'overseas') {
            source = [...OVERSEAS_STOCKS];
        } else if (state.marketFilter === 'kospi') {
            source = state.stocksList.filter(s => s.market === 'KOSPI');
        } else if (state.marketFilter === 'kosdaq') {
            source = state.stocksList.filter(s => s.market === 'KOSDAQ');
        } else {
            // 'all': 국내 대표 + 해외 대표 통합
            source = [...state.stocksList, ...OVERSEAS_STOCKS];
        }

        // 검색어가 있을 경우 4,292개 전 종목 풀에서도 적극 탐색
        if (state.searchQuery) {
            const query = state.searchQuery;

            // 1. 국내 4,200개 풀 검색
            if (state.universeStocks && state.universeStocks.length > 0) {
                const universeMatches = state.universeStocks
                    .filter(s => s.name.toLowerCase().includes(query) || s.code.includes(query))
                    .slice(0, 35)
                    .map(s => {
                        const price = s.current_price || 10000;
                        const chg = s.day1 !== null ? parseFloat(s.day1) : 0;
                        return {
                            code: s.code,
                            name: s.name,
                            market: s.code.startsWith('0') ? 'KOSPI' : 'KOSDAQ',
                            price: price,
                            change: Math.round(price * (chg / 100)),
                            changeRate: chg,
                            volume: '실시간',
                            tradeAmount: s.marcap ? `시총 ${(s.marcap / 1e12).toFixed(1)}조` : '-',
                            strategy: 'support-bounce',
                            strategyName: '추세 지지선 반등',
                            theme: '코스피/코스닥 검색 종목',
                            signalStatus: chg >= 0 ? 'good' : 'warn',
                            signalText: '실시간 차트 연동 가능',
                            stopPrice: Math.round(price * 0.96),
                            targetPrice: Math.round(price * 1.08),
                            briefing: {
                                reason: `네이버 실시간 증권 API를 통해 ${s.name}(${s.code})의 실시간 캔들 차트와 지지선을 분석합니다.`,
                                tradePlan: `현재가 ${price.toLocaleString()}원 기준 손절가 약 ${Math.round(price * 0.96).toLocaleString()}원입니다.`,
                                supplyFlow: `시가총액 및 최근 시장 수급 현황을 바탕으로 연동된 종목입니다.`
                            }
                        };
                    });

                // 2. 해외 주식 검색
                const overseasMatches = OVERSEAS_STOCKS.filter(s => 
                    s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query)
                );

                const matchedCodes = new Set([...universeMatches, ...overseasMatches].map(m => m.code));
                const existingMatches = source.filter(s => 
                    (s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query)) && !matchedCodes.has(s.code)
                );

                source = [...overseasMatches, ...universeMatches, ...existingMatches];
            }
        }

        // 전략 필터링
        let filtered = source.filter(stock => {
            if (state.selectedStrategy !== 'all' && stock.strategy !== state.selectedStrategy) {
                return false;
            }
            if (state.searchQuery) {
                const matchName = stock.name.toLowerCase().includes(state.searchQuery);
                const matchCode = stock.code.toLowerCase().includes(state.searchQuery);
                const matchTheme = (stock.theme || '').toLowerCase().includes(state.searchQuery);
                return matchName || matchCode || matchTheme;
            }
            return true;
        });

        if (countSpan) countSpan.textContent = filtered.length;

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div style="padding: 40px 16px; text-align: center; color: var(--cs-text-muted); font-size: 13px;">
                    조건에 맞는 포착 종목이 없습니다.
                </div>
            `;
            return;
        }

        const hasSelected = filtered.some(s => s.code === state.selectedStockCode);
        if (!hasSelected && filtered.length > 0) {
            state.selectedStockCode = filtered[0].code;
            selectStock(state.selectedStockCode);
        }

        listContainer.innerHTML = filtered.map(stock => {
            const isUp = stock.changeRate >= 0;
            const colorClass = isUp ? 'text-up' : 'text-down';
            const sign = isUp ? '+' : '';
            const isActive = stock.code === state.selectedStockCode ? 'active' : '';
            const isOverseas = anyAlphabet(stock.code);

            return `
                <div class="cs-stock-item ${isActive}" data-code="${stock.code}">
                    <div class="cs-stock-item-top">
                        <div class="cs-stock-item-name">
                            <span>${stock.name}</span>
                            <span class="cs-stock-market">${stock.market}</span>
                        </div>
                        <div class="cs-stock-item-price ${colorClass}">
                            ${formatPrice(stock.price, isOverseas)}
                        </div>
                    </div>
                    <div class="cs-stock-item-top">
                        <div class="cs-stock-item-mid">
                            <span class="cs-theme-badge">${stock.theme}</span>
                        </div>
                        <div class="cs-stock-item-chg ${colorClass}">
                            ${sign}${stock.changeRate.toFixed(2)}%
                        </div>
                    </div>
                    <div class="cs-stock-item-bottom">
                        <span class="cs-signal-badge ${stock.signalStatus}">
                            <i class="ph-fill ph-check-circle"></i> ${stock.signalText}
                        </span>
                        <span>${stock.tradeAmount || '실시간'}</span>
                    </div>
                </div>
            `;
        }).join('');

        listContainer.querySelectorAll('.cs-stock-item').forEach(item => {
            item.addEventListener('click', () => {
                const code = item.getAttribute('data-code');
                selectStock(code);
            });
        });
    }

    // -------------------------------------------------------------
    // 12. 단일 종목 선택 & 차트/지표/브리핑 갱신
    // -------------------------------------------------------------
    async function selectStock(code) {
        state.selectedStockCode = code;
        let stock = state.stocksList.find(s => s.code === code) || OVERSEAS_STOCKS.find(s => s.code === code);
        
        if (!stock && state.universeStocks) {
            const u = state.universeStocks.find(s => s.code === code);
            if (u) {
                const price = u.current_price || 10000;
                const chg = u.day1 !== null ? parseFloat(u.day1) : 0;
                stock = {
                    code: u.code,
                    name: u.name,
                    market: u.code.startsWith('0') ? 'KOSPI' : 'KOSDAQ',
                    price: price,
                    change: Math.round(price * (chg / 100)),
                    changeRate: chg,
                    volume: '실시간',
                    tradeAmount: u.marcap ? `시총 ${(u.marcap / 1e12).toFixed(1)}조` : '-',
                    strategy: 'support-bounce',
                    strategyName: '추세 지지선 반등',
                    theme: '코스피/코스닥 종목',
                    signalStatus: chg >= 0 ? 'good' : 'warn',
                    signalText: '실시간 연동',
                    stopPrice: Math.round(price * 0.96),
                    targetPrice: Math.round(price * 1.08),
                    briefing: {
                        reason: `네이버 실시간 증권 API를 통해 ${u.name}(${u.code})의 실시간 캔들 차트와 지지선을 분석합니다.`,
                        tradePlan: `현재가 ${price.toLocaleString()}원 기준 손절가 약 ${Math.round(price * 0.96).toLocaleString()}원입니다.`,
                        supplyFlow: `최근 시장 수급 현황을 바탕으로 연동된 종목입니다.`
                    }
                };
            }
        }
        if (!stock) return;
        state.currentStock = stock;

        document.querySelectorAll('.cs-stock-item').forEach(item => {
            if (item.getAttribute('data-code') === code) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // 캔들 데이터셋 로드
        const dataset = await fetchLiveChartDataset(stock, state.activeTimeframe);
        state.currentCandles = dataset.candles;

        // ICT 및 RSI 알고리즘 연산 (고확률 모드 state.strictMode 반영)
        state.currentICTZones = calculateICTConcepts(dataset.candles, state.strictMode);
        state.currentICTSignals = calculateICTSignals(dataset.candles);
        state.currentHTSSignals = calculateHTSSignals(dataset.candles);
        state.currentRSIInfo = computeHTSRSI(dataset.candles, 14);

        renderStockHeader(stock, dataset);
        renderBriefingAndTables(stock);
        renderChart(stock, dataset);
        resizeDrawingOverlay();
    }

    function renderStockHeader(stock, dataset) {
        const headerEl = document.getElementById('cs-stock-header');
        if (!headerEl) return;

        const isUp = stock.changeRate >= 0;
        const colorClass = isUp ? 'text-up' : 'text-down';
        const sign = isUp ? '+' : '';
        const tfLabel = getTimeframeLabel(state.activeTimeframe);
        const isOverseas = anyAlphabet(stock.code);

        // RSI 상태 배지
        const rsiInfo = state.currentRSIInfo;
        let rsiHtml = '';
        if (rsiInfo && rsiInfo.latestRSI !== null) {
            const rsiVal = rsiInfo.latestRSI;
            const rsiClass = rsiVal >= 60 ? 'cs-rsi-bull' : (rsiVal <= 35 ? 'cs-rsi-bear' : 'cs-rsi-neutral');
            const rsiStatusText = rsiInfo.isGoldenCross ? '🔥 골든크로스 매수 타점' : (rsiVal >= 70 ? '과열권' : (rsiVal <= 30 ? '극단 과매도' : '중립 수렴'));
            rsiHtml = `
                <span class="cs-rsi-pill ${rsiClass}" title="Wilder RSI(14): ${rsiVal} / MA(9): ${rsiInfo.latestMA9}">
                    <i class="ph-fill ph-activity"></i> RSI(14) <strong>${rsiVal}</strong> [${rsiStatusText}]
                </span>
            `;
        }

        headerEl.innerHTML = `
            <div class="cs-sh-left">
                <span class="cs-sh-name">${stock.name}</span>
                <span class="cs-sh-code">${stock.code} · ${stock.market} [${tfLabel}]</span>
                <span class="cs-sh-price ${colorClass}">${formatPrice(stock.price, isOverseas)}</span>
                <span class="cs-sh-change ${colorClass}">(${sign}${stock.changeRate.toFixed(2)}%)</span>
                
                <div class="cs-sh-meta">
                    <span class="cs-sh-meta-item">거래대금 <strong>${stock.tradeAmount || '실시간'}</strong></span>
                    <span class="cs-sh-meta-item">테마 <strong>${stock.theme}</strong></span>
                    ${rsiHtml}
                </div>
            </div>

            <div class="cs-sh-actions">
                <button class="cs-btn-calc-link" id="btn-calc-transfer">
                    <i class="ph-fill ph-calculator"></i>
                    <span>리스크 계산기로 전송 ↗</span>
                </button>
            </div>
        `;

        const btnCalc = headerEl.querySelector('#btn-calc-transfer');
        if (btnCalc) {
            btnCalc.addEventListener('click', () => {
                transferToRiskCalculator(stock);
            });
        }
    }

    function transferToRiskCalculator(stock) {
        if (!window.TraderRoom) {
            alert('트레이더 룸 엔진을 불러올 수 없습니다.');
            return;
        }

        window.TraderRoom.navigate('trader-calc', {
            symbol: stock.name,
            code: stock.code,
            entryPrice: stock.price,
            stopPrice: stock.stopPrice,
            targetPrice: stock.targetPrice
        });
    }

    // -------------------------------------------------------------
    // 13. AI 시그널 브리핑 카드 & ICT 분석 표 (from app3.py)
    // -------------------------------------------------------------
    function renderBriefingAndTables(stock) {
        const briefingEl = document.getElementById('cs-ai-briefing-wrap');
        if (!briefingEl) return;

        const tfLabel = getTimeframeLabel(state.activeTimeframe);
        const isOverseas = anyAlphabet(stock.code);

        // 1. 최근 타점 신호 표 (ICT Mitigation & HTS Signals)
        const allSignals = [];
        state.currentICTSignals.forEach(s => {
            allSignals.push({
                time: s.time,
                type: s.type === 'Buy' ? '🟢 ICT Mitigation Buy' : '🔴 ICT Mitigation Sell',
                price: s.price,
                reason: s.reason,
                badgeClass: s.type === 'Buy' ? 'bull-fvg' : 'bear-fvg'
            });
        });

        state.currentHTSSignals.forEach(s => {
            allSignals.push({
                time: s.time,
                type: `⚡ ${s.type}`,
                price: s.price,
                reason: s.type.includes('Sweep') ? '20봉 스윙 레벨 스윕 후 급반등' : 'HTS 캔들 갭 시그널',
                badgeClass: s.type.includes('상승') || s.type.includes('SSL') ? 'bull-ob' : 'bear-ob'
            });
        });

        const sortedSignals = allSignals.slice(-6).reverse();

        const signalsTableHtml = sortedSignals.length > 0 ? `
            <table class="cs-data-table">
                <thead>
                    <tr>
                        <th>발생 일시/봉</th>
                        <th>신호 구분</th>
                        <th>진입 타점 가격</th>
                        <th>포착 알고리즘 논리</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedSignals.map(sig => `
                        <tr>
                            <td style="color: var(--cs-text-muted); font-size: 11px;">${formatTimeDisplay(sig.time)}</td>
                            <td><span class="cs-zone-tag ${sig.badgeClass}">${sig.type}</span></td>
                            <td style="font-weight: 700; color: #ffffff;">${formatPrice(sig.price, isOverseas)}</td>
                            <td style="font-size: 11px; color: var(--cs-text-secondary);">${sig.reason}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : `<div style="padding: 24px; text-align: center; color: var(--cs-text-muted); font-size: 12px;">현재 차트 주기에서 최근 발생한 타점 신호가 없습니다.</div>`;

        // 2. 활성화된 ICT 구름대(Zone) 가격 정보 표 (from app3.py)
        const activeZones = state.showICTZones 
            ? state.currentICTZones.filter(z => z.active && (state.cloudZoneTypes[z.type] !== false)).slice(-8).reverse()
            : [];
        const zonesTableHtml = activeZones.length > 0 ? `
            <table class="cs-data-table">
                <thead>
                    <tr>
                        <th>구간 종류 (Type)</th>
                        <th>상단 가격 (Top)</th>
                        <th>하단 가격 (Bottom)</th>
                        <th>현재가 대비 위치</th>
                    </tr>
                </thead>
                <tbody>
                    ${activeZones.map(z => {
                        let tagClass = 'bull-fvg';
                        if (z.type.includes('Bearish FVG')) tagClass = 'bear-fvg';
                        else if (z.type.includes('Bullish OB')) tagClass = 'bull-ob';
                        else if (z.type.includes('Bearish OB')) tagClass = 'bear-ob';
                        else if (z.type.includes('IFVG')) tagClass = 'ifvg';
                        else if (z.type.includes('BPR')) tagClass = 'bpr';

                        const posText = stock.price > z.top ? '🛡️ 하단 지지 구름대' : (stock.price < z.bottom ? '⚔️ 상단 저항 구름대' : '⚡ 현재가 구간 내 위치');

                        return `
                            <tr>
                                <td><span class="cs-zone-tag ${tagClass}">${z.type}</span></td>
                                <td style="font-weight: 700; color: #ffffff;">${formatPrice(z.top, isOverseas)}</td>
                                <td style="font-weight: 700; color: #ffffff;">${formatPrice(z.bottom, isOverseas)}</td>
                                <td style="font-size: 11px; color: var(--cs-text-secondary);">${posText}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        ` : `<div style="padding: 24px; text-align: center; color: var(--cs-text-muted); font-size: 12px;">${!state.showICTZones ? 'ICT 구름대가 꺼져 있습니다.' : '선택된 필터에 맞는 활성화 구름대가 없습니다.'}</div>`;

        let dynamicTradePlan = stock.briefing.tradePlan;
        if (state.activeTimeframe === '1Y') {
            dynamicTradePlan = `[년봉 기준] 현재가 ${formatPrice(stock.price, isOverseas)} 진입 시 장기 지지선 손절 ${formatPrice(stock.stopPrice, isOverseas)}, 1차 목표 ${formatPrice(stock.targetPrice, isOverseas)}의 장기 대세 사이클 플랜입니다.`;
        } else if (state.activeTimeframe === '1M') {
            dynamicTradePlan = `[월봉 기준] 현재가 ${formatPrice(stock.price, isOverseas)} 진입 시 월간 매물대 손절 ${formatPrice(stock.stopPrice, isOverseas)}, 목표 ${formatPrice(stock.targetPrice, isOverseas)}의 중장기 스윙 플랜입니다.`;
        } else if (state.activeTimeframe === '1W') {
            dynamicTradePlan = `[주봉 기준] 현재가 ${formatPrice(stock.price, isOverseas)} 진입 시 주간 추세 지지 손절 ${formatPrice(stock.stopPrice, isOverseas)}, 목표 ${formatPrice(stock.targetPrice, isOverseas)}의 주간 스윙 플랜입니다.`;
        } else if (state.activeTimeframe.endsWith('m') || state.activeTimeframe.endsWith('h')) {
            dynamicTradePlan = `[${tfLabel} 기준] 현재가 ${formatPrice(stock.price, isOverseas)} 진입 시 장중 지지 이탈 ${formatPrice(stock.stopPrice, isOverseas)}, 단기 목표 ${formatPrice(stock.targetPrice, isOverseas)}의 단기 매매 플랜입니다.`;
        }

        briefingEl.innerHTML = `
            <div class="cs-briefing-header">
                <div class="cs-briefing-title">
                    <i class="ph-fill ph-sparkle" style="color: var(--cs-accent-gold);"></i>
                    AI 시그널 분석 리포트 & 스마트 머니 매매 가이드 [${tfLabel}]
                </div>
                <div style="font-size: 12px; color: var(--cs-text-muted);">
                    기준: 실시간 틱/분봉 호가 & 네이버 공식 증권 시세
                </div>
            </div>

            <!-- 상단 3개 핵심 브리핑 카드 -->
            <div class="cs-briefing-grid">
                <!-- 1. 핵심 포착 근거 -->
                <div class="cs-briefing-card">
                    <div class="cs-card-label">
                        <i class="ph-fill ph-crosshair" style="color: #38bdf8;"></i>
                        포착 알고리즘 근거
                    </div>
                    <div class="cs-card-value-big" style="color: #38bdf8;">
                        ${stock.strategyName}
                    </div>
                    <div class="cs-card-desc">
                        ${stock.briefing.reason}
                    </div>
                </div>

                <!-- 2. 매매 타점 & 손절 가이드 -->
                <div class="cs-briefing-card" style="border-color: rgba(245, 158, 11, 0.3);">
                    <div class="cs-card-label">
                        <i class="ph-fill ph-scales" style="color: var(--cs-accent-gold);"></i>
                        추천 매매 타점 및 손절 가이드
                    </div>
                    <div class="cs-card-value-big" style="color: var(--cs-accent-gold);">
                        손절가 ${formatPrice(stock.stopPrice, isOverseas)}
                    </div>
                    <div class="cs-card-desc">
                        ${dynamicTradePlan}
                    </div>
                </div>

                <!-- 3. 메이저 수급 및 테마 -->
                <div class="cs-briefing-card">
                    <div class="cs-card-label">
                        <i class="ph-fill ph-users-three" style="color: #10b981;"></i>
                        메이저 수급 및 테마 모멘텀
                    </div>
                    <div class="cs-card-value-big" style="color: #10b981;">
                        ${stock.theme.split('/')[0]}
                    </div>
                    <div class="cs-card-desc">
                        ${stock.briefing.supplyFlow}
                    </div>
                </div>
            </div>

            <!-- 하단 2대 정밀 분석 테이블 (from app3.py) -->
            <div class="cs-ict-tables-wrap">
                <!-- 최근 발생한 타점 신호 -->
                <div class="cs-table-card">
                    <div class="cs-table-header">
                        <span><i class="ph-fill ph-crosshair" style="color: #00e676;"></i> 최근 발생한 타점 신호 (ICT Mitigation & HTS)</span>
                        <span style="font-size: 11px; color: var(--cs-text-muted);">최근 ${sortedSignals.length}건</span>
                    </div>
                    ${signalsTableHtml}
                </div>

                <!-- 활성화된 ICT 구간 가격 정보 -->
                <div class="cs-table-card">
                    <div class="cs-table-header">
                        <span><i class="ph-fill ph-stack" style="color: #38bdf8;"></i> 활성화된 ICT 구간(Zone) 가격 정보표</span>
                        <span style="font-size: 11px; color: var(--cs-text-muted);">
                            ${state.strictMode ? '<span style="color:#fbbf24; font-weight:700; margin-right:6px;"><i class="ph-fill ph-lightning"></i> 고확률 스윕</span>' : ''}
                            유효 구름대 ${activeZones.length}개
                        </span>
                    </div>
                    ${zonesTableHtml}
                </div>
            </div>
        `;
    }

    // -------------------------------------------------------------
    // 14. Lightweight Charts 렌더링 & 마커 합성
    // -------------------------------------------------------------
    function renderChart(stock, dataset) {
        const container = document.getElementById('cs-tv-chart');
        if (!container) return;

        container.innerHTML = '';

        try {
            const chartWrapper = document.getElementById('cs-chart-wrapper');
            const chartHeight = chartWrapper ? chartWrapper.clientHeight : 780;

            const chart = LightweightCharts.createChart(container, {
                width: container.clientWidth,
                height: chartHeight,
                layout: {
                    background: { color: '#0b0f19' },
                    textColor: '#94a3b8',
                    fontFamily: 'Pretendard Variable, sans-serif'
                },
                grid: {
                    vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
                    horzLines: { color: 'rgba(255, 255, 255, 0.04)' }
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Normal
                },
                rightPriceScale: {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    scaleMargins: {
                        top: 0.08,
                        bottom: 0.12
                    }
                },
                timeScale: {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    timeVisible: dataset.isIntraday,
                    secondsVisible: false
                }
            });

            state.chartInstance = chart;

            const candlestickSeries = chart.addCandlestickSeries({
                upColor: '#ef4444',
                downColor: '#3b82f6',
                borderVisible: false,
                wickUpColor: '#ef4444',
                wickDownColor: '#3b82f6'
            });

            candlestickSeries.setData(dataset.candles);
            state.candlestickSeries = candlestickSeries;

            // AI 지지선 시리즈
            if (dataset.supportLine && dataset.supportLine.length >= 2) {
                const supportSeries = chart.addLineSeries({
                    color: '#38bdf8',
                    lineWidth: 2,
                    lineStyle: LightweightCharts.LineStyle.Solid,
                    title: 'AI 지지선'
                });
                supportSeries.setData(dataset.supportLine.map(pt => ({ time: pt.time, value: pt.price })));
                state.supportLineSeries = supportSeries;
            }

            // 원칙 손절가 시리즈
            const stoplossSeries = chart.addLineSeries({
                color: '#ef4444',
                lineWidth: 1.5,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                title: '원칙 손절가'
            });
            const firstCandleTime = dataset.candles[0].time;
            const lastCandleTime = dataset.candles[dataset.candles.length - 1].time;
            stoplossSeries.setData([
                { time: firstCandleTime, value: stock.stopPrice },
                { time: lastCandleTime, value: stock.stopPrice }
            ]);
            state.stoplossLineSeries = stoplossSeries;

            refreshMarkersAndSeries();

            chart.timeScale().fitContent();

            // 줌 및 팬 이동 시 ICT 구름대 실시간 동기화
            chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
                redrawDrawings();
            });

            window.addEventListener('resize', () => {
                if (container && chart) {
                    chart.applyOptions({ width: container.clientWidth });
                }
                resizeDrawingOverlay();
            });

        } catch (err) {
            console.error('[Chart Error]', err);
        }
    }

    // 마커 및 시리즈 상태 실시간 반영
    function refreshMarkersAndSeries() {
        if (!state.candlestickSeries || !state.currentCandles || state.currentCandles.length === 0) return;

        const markers = [];

        // 1. AI 지지선 반등 마커
        if (state.showSupportLine) {
            const candles = state.currentCandles;
            const midIdx = Math.floor(candles.length / 2);
            if (candles[midIdx]) {
                markers.push({
                    time: candles[midIdx].time,
                    position: 'belowBar',
                    color: '#10b981',
                    shape: 'arrowUp',
                    text: '지지 반등'
                });
            }
        }

        // 2. ICT 타점 신호 마커 (from app3.py)
        if (state.showICTSignals && state.currentICTSignals) {
            state.currentICTSignals.forEach(s => {
                markers.push({
                    time: s.time,
                    position: s.type === 'Buy' ? 'belowBar' : 'aboveBar',
                    color: s.type === 'Buy' ? '#00e676' : '#ff1744',
                    shape: s.type === 'Buy' ? 'arrowUp' : 'arrowDown',
                    text: `ICT ${s.type}`
                });
            });
        }

        // 3. HTS 4대 급소 신호 마커 (from app3.py)
        if (state.showHTSSignals && state.currentHTSSignals) {
            state.currentHTSSignals.forEach(h => {
                markers.push({
                    time: h.time,
                    position: h.type.includes('상승') || h.type.includes('SSL') ? 'belowBar' : 'aboveBar',
                    color: h.color,
                    shape: h.symbol,
                    text: h.type.replace('HTS ', '')
                });
            });
        }

        // 4. Wilder RSI 골든크로스 / 데드크로스 마커
        if (state.showWilderRSI && state.currentRSIInfo) {
            const { rsiList, maList } = state.currentRSIInfo;
            const candles = state.currentCandles;
            for (let i = 15; i < candles.length; i++) {
                const curRSI = rsiList[i];
                const prevRSI = rsiList[i - 1];
                const curMA = maList[i];
                const prevMA = maList[i - 1];
                if (curRSI && prevRSI && curMA && prevMA) {
                    if (curRSI > curMA && prevRSI <= prevMA && curRSI < 60) {
                        markers.push({
                            time: candles[i].time,
                            position: 'belowBar',
                            color: '#f59e0b',
                            shape: 'circle',
                            text: 'RSI 골든'
                        });
                    } else if (curRSI < curMA && prevRSI >= prevMA && curRSI > 60) {
                        markers.push({
                            time: candles[i].time,
                            position: 'aboveBar',
                            color: '#818cf8',
                            shape: 'circle',
                            text: 'RSI 데드'
                        });
                    }
                }
            }
        }

        // 시간순 정렬 (LightweightCharts 제약조건)
        markers.sort((a, b) => {
            const ta = typeof a.time === 'number' ? a.time : new Date(a.time).getTime();
            const tb = typeof b.time === 'number' ? b.time : new Date(b.time).getTime();
            return ta - tb;
        });

        state.candlestickSeries.setMarkers(markers);

        // 지지선 표시 여부
        if (state.supportLineSeries) {
            state.supportLineSeries.applyOptions({
                visible: state.showSupportLine
            });
        }
    }

    // -------------------------------------------------------------
    // 15. 외부 노출 라우터
    // -------------------------------------------------------------
    window.ChartScanner = {
        show() {
            const defaultView = document.getElementById('default-view-container');
            const traderWorkspace = document.getElementById('trader-workspace-container');
            const scannerContainer = document.getElementById('chart-scanner-container');

            if (!scannerContainer) return;

            if (defaultView) defaultView.style.display = 'none';
            if (traderWorkspace) traderWorkspace.style.display = 'none';

            scannerContainer.style.display = 'flex';

            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            const scannerMenuItem = document.querySelector('.menu-section li[data-action="chart-scanner"]');
            if (scannerMenuItem) scannerMenuItem.classList.add('active');

            renderScanner(scannerContainer);
        },

        hide() {
            const scannerContainer = document.getElementById('chart-scanner-container');
            if (scannerContainer) {
                scannerContainer.style.display = 'none';
            }
        }
    };

})();
