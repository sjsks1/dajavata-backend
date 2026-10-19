/**
 * ============================================================================
 * DAJAVATA SIGNAL LAB (AI 차트 스캐너) ENGINE v3
 * - 국내 주식(코스피/코스닥) 알고리즘 지지·저항 자동 작도 & 스캐너
 * - [신규] 기본 차트 높이 780px로 대폭 확장 + 마우스 드래그 상하 높이 자유 조절 (더블클릭 기본 복귀)
 * - [신규] 좌우 종목/차트 칸 폭 마우스 드래그 자유 조절 (더블클릭 기본 복귀)
 * - [신규] 차트 좌측 전문 드로잉 툴바 (추세선, 수평선, 박스, 측정자, 자석 스냅, 지우개 등)
 * - 15개 전 타임프레임 지원 (분봉 7종, 시봉 4종, 일/주/월/년봉)
 * - TradingView Lightweight Charts v4 + Canvas 고해상도 폴백
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
    // 2. 국내 주식 기술적 시그널 & 종목 메타데이터
    // -------------------------------------------------------------
    const SAMPLE_STOCKS = [
        {
            code: '000660',
            name: 'SK하이닉스',
            market: 'KOSPI',
            price: 186400,
            change: 3900,
            changeRate: 2.14,
            volume: '3.4M주',
            tradeAmount: '6,340억',
            strategy: 'support-bounce',
            strategyName: '추세 지지선 반등',
            theme: 'HBM3E / AI 반도체',
            pattern: 'up-trend',
            minPrice: 160000,
            maxPrice: 195000,
            signalStatus: 'good',
            signalText: '지지선 1.1% 근접 · 3회 반등',
            stopPrice: 181000,
            targetPrice: 204000,
            briefing: {
                reason: '중기 상승 채널의 하단 지지선(181,500원)을 3회 연속 지켜내며 20일선 위에서 강한 양봉 반등 시도가 포착되었습니다.',
                tradePlan: '현재가(186,400원) 매수 시 손절 기준 181,000원(-2.89%), 1차 목표 204,000원(+9.44%)으로 <strong>손익비 3.26:1</strong>의 매우 유리한 손익비 구간입니다.',
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
            strategy: 'breakout-retest',
            strategyName: '전고점 돌파 후 안착',
            theme: '바이오 플랫폼 (SC제형)',
            pattern: 'breakout',
            minPrice: 320000,
            maxPrice: 390000,
            signalStatus: 'good',
            signalText: '전고점 지지 전환 성공',
            stopPrice: 365000,
            targetPrice: 430000,
            briefing: {
                reason: '과거 강력한 저항선이었던 368,000원 매물대를 대량 거래량으로 상향 돌파한 뒤, 해당 라인에서 정확히 지지(리테스트)를 받고 재상승 중입니다.',
                tradePlan: '현재가(382,000원) 진입 시 손절가 365,000원(-4.45%), 1차 목표 430,000원(+12.5%)으로 <strong>손익비 2.8:1</strong> 구조입니다.',
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
            pattern: 'up-trend',
            minPrice: 125000,
            maxPrice: 155000,
            signalStatus: 'good',
            signalText: '추세 하단 양봉 전환',
            stopPrice: 138500,
            targetPrice: 162000,
            briefing: {
                reason: '8월 저점 이후 형성된 중기 상승 추세선의 바닥 자리(140,000원)에서 하락을 멈추고 5일선 골든크로스를 완성했습니다.',
                tradePlan: '현재가(143,500원) 매수 시 손절 138,500원(-3.48%), 1차 목표 162,000원(+12.89%)으로 <strong>손익비 3.7:1</strong> 타점입니다.',
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
            pattern: 'box-squeeze',
            minPrice: 235000,
            maxPrice: 258000,
            signalStatus: 'warn',
            signalText: '변동성 수축 3주차 (폭발 임박)',
            stopPrice: 241500,
            targetPrice: 272000,
            briefing: {
                reason: '일봉 볼린저 밴드 대역폭(Bandwidth)이 연중 최저치로 응축되며 244,000원 바닥을 단단히 지지하고 있습니다. 방향성 분출 직전입니다.',
                tradePlan: '현재가(248,500원) 분할 매수 시 박스권 하단 이탈 241,500원(-2.82%) 손절 기준, 상향 분출 시 272,000원(+9.45%) 목표치입니다.',
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
            strategyName: '기관·외인 쌍끌이 + 지지선',
            theme: '폐암 신약 렉라자',
            pattern: 'up-trend',
            minPrice: 132000,
            maxPrice: 162000,
            signalStatus: 'good',
            signalText: '쌍끌이 순매수 + 지지 반등',
            stopPrice: 148000,
            targetPrice: 178000,
            briefing: {
                reason: '기관과 외국인이 최근 3일간 동시 순매수를 기록하며 60일 이평선 및 지지선(149,000원)을 강력히 방어하고 직전 고점 돌파를 시도하고 있습니다.',
                tradePlan: '156,000원 매수 시 지지선 이탈 148,000원(-5.1%) 손절 기준, 전고점 돌파 178,000원(+14.1%) 목표로 <strong>손익비 2.76:1</strong>입니다.',
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
            strategyName: '이평선 수렴 & 정배열 초입',
            theme: '반도체 대형주',
            pattern: 'recovery',
            minPrice: 56000,
            maxPrice: 62000,
            signalStatus: 'good',
            signalText: '이평선 3선 수렴 후 반등',
            stopPrice: 58200,
            targetPrice: 65000,
            briefing: {
                reason: '역배열 하락세가 진정되며 5일선, 20일선이 58,800원에서 밀집 수렴한 뒤, 거래량을 동반한 우상향 골든크로스가 발생했습니다.',
                tradePlan: '현재가(59,800원) 매수 시 단기 지지선 58,200원(-2.67%) 손절 기준, 1차 목표가 65,000원(+8.69%)으로 <strong>손익비 3.25:1</strong> 구간입니다.',
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
            strategy: 'support-bounce',
            strategyName: '추세 지지선 반등',
            theme: 'TC본더 / 반도체 장비',
            pattern: 'up-trend',
            minPrice: 96000,
            maxPrice: 118000,
            signalStatus: 'good',
            signalText: '추세 하단 지지 성공',
            stopPrice: 106500,
            targetPrice: 126000,
            briefing: {
                reason: '상승 추세선 하단(108,000원)에서 아래꼬리를 달고 반등하며 기술적 매수 급소가 완성되었습니다.',
                tradePlan: '112,000원 매수 시 지지선 이탈 106,500원(-4.91%) 손절 기준, 1차 목표가 126,000원(+12.5%)으로 <strong>손익비 2.5:1</strong>입니다.',
                supplyFlow: '신규 고객사 수주 모멘텀이 이어지며 장비주 중 가장 빠른 지지선 반등을 보이고 있습니다.'
            }
        }
    ];

    // -------------------------------------------------------------
    // 3. 타임프레임별 캔들 & 지지선 데이터 생성 엔진
    // -------------------------------------------------------------
    function generateDataset(stock, tf) {
        const isMin = tf.endsWith('m');
        const isHour = tf.endsWith('h');

        const count = 55;
        const candles = [];
        const currentPrice = stock.price;
        const minP = stock.minPrice;
        const maxP = stock.maxPrice;
        const pattern = stock.pattern;

        const baseDate = new Date(2026, 9, 19, 15, 30, 0);
        let timeList = [];

        if (isMin) {
            const mins = parseInt(tf);
            for (let i = count - 1; i >= 0; i--) {
                const t = new Date(baseDate.getTime() - i * mins * 60 * 1000);
                timeList.push(Math.floor(t.getTime() / 1000));
            }
        } else if (isHour) {
            const hrs = parseInt(tf);
            for (let i = count - 1; i >= 0; i--) {
                const t = new Date(baseDate.getTime() - i * hrs * 3600 * 1000);
                timeList.push(Math.floor(t.getTime() / 1000));
            }
        } else if (tf === '1D') {
            for (let i = count - 1; i >= 0; i--) {
                const d = new Date(baseDate);
                d.setDate(d.getDate() - Math.floor(i * 1.45));
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                timeList.push(`${yyyy}-${mm}-${dd}`);
            }
        } else if (tf === '1W') {
            for (let i = count - 1; i >= 0; i--) {
                const d = new Date(baseDate);
                d.setDate(d.getDate() - i * 7);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                timeList.push(`${yyyy}-${mm}-${dd}`);
            }
        } else if (tf === '1M') {
            for (let i = count - 1; i >= 0; i--) {
                const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                timeList.push(`${yyyy}-${mm}-01`);
            }
        } else if (tf === '1Y') {
            const yearsCount = 10;
            for (let i = yearsCount - 1; i >= 0; i--) {
                const yyyy = baseDate.getFullYear() - i;
                timeList.push(`${yyyy}-01-01`);
            }
        }

        const effectiveCount = timeList.length;
        let p = minP * 1.05;
        const step = (currentPrice - p) / effectiveCount;

        for (let i = 0; i < effectiveCount; i++) {
            const timeVal = timeList[i];
            let open, close, high, low;

            if (pattern === 'up-trend') {
                const noise = (Math.sin(i * 0.4) + (Math.random() - 0.4)) * (currentPrice * 0.015);
                open = Math.round(p + noise);
                close = Math.round(open + (step * (Math.random() * 1.5 - 0.2)));
                if (i === effectiveCount - 1) close = currentPrice;
            } else if (pattern === 'breakout') {
                const breakoutIdx = Math.floor(effectiveCount * 0.75);
                if (i < breakoutIdx) {
                    open = Math.round(minP + (maxP - minP) * 0.5 + (Math.random() - 0.5) * (minP * 0.03));
                    close = Math.round(open + (Math.random() - 0.48) * (minP * 0.02));
                } else {
                    open = Math.round(minP + (maxP - minP) * 0.8 + (i - breakoutIdx) * step * 2);
                    close = Math.round(open + (Math.random() * 0.8) * step);
                    if (i === effectiveCount - 1) close = currentPrice;
                }
            } else {
                open = Math.round(p + (Math.random() - 0.5) * (currentPrice * 0.02));
                close = Math.round(open + (Math.random() - 0.48) * (currentPrice * 0.02));
                if (i === effectiveCount - 1) close = currentPrice;
            }

            const bodyHigh = Math.max(open, close);
            const bodyLow = Math.min(open, close);
            high = Math.round(bodyHigh + Math.random() * (currentPrice * 0.012));
            low = Math.round(bodyLow - Math.random() * (currentPrice * 0.012));

            candles.push({
                time: timeVal,
                open: open,
                high: high,
                low: low,
                close: close
            });

            p += step;
        }

        const supportLine = [];
        const idx1 = Math.floor(effectiveCount * 0.1);
        const idx2 = Math.floor(effectiveCount * 0.45);
        const idx3 = Math.floor(effectiveCount * 0.8);
        const idx4 = effectiveCount - 1;

        const supP1 = Math.round(stock.stopPrice * 0.94);
        const supP2 = Math.round(stock.stopPrice * 0.97);
        const supP3 = Math.round(stock.stopPrice * 1.005);
        const supP4 = Math.round(stock.stopPrice * 1.02);

        supportLine.push({ time: timeList[idx1], price: supP1 });
        supportLine.push({ time: timeList[idx2], price: supP2 });
        supportLine.push({ time: timeList[idx3], price: supP3 });
        supportLine.push({ time: timeList[idx4], price: supP4 });

        const touchPoints = [
            { time: timeList[idx2], text: '1차 지지' },
            { time: timeList[idx3], text: '2차 지지 확인' }
        ];

        return {
            candles: candles,
            supportLine: supportLine,
            touchPoints: touchPoints,
            isIntraday: isMin || isHour
        };
    }

    // -------------------------------------------------------------
    // 4. UI 상태 관리
    // -------------------------------------------------------------
    let state = {
        selectedStrategy: 'all',
        selectedStockCode: '000660',
        searchQuery: '',
        activeTimeframe: '1D',
        chartInstance: null,
        candlestickSeries: null,
        supportLineSeries: null,
        stoplossLineSeries: null,
        activeDrawTool: 'cursor', // 'cursor', 'trendline', 'horizontal', 'box', 'ruler', 'brush', 'text'
        isMagnet: false,
        userDrawings: [], // 사용자가 그린 작도 객체들
        isDrawingNow: false,
        drawStartPoint: null
    };

    function getTimeframeLabel(tf) {
        for (const grp of Object.values(TIMEFRAME_GROUPS)) {
            const found = grp.find(item => item.id === tf);
            if (found) return found.label;
        }
        return tf;
    }

    // -------------------------------------------------------------
    // 5. 메인 렌더링 함수
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
                            <span class="cs-title-badge">AI 차트 스캐너</span>
                            <p class="cs-subtitle">국내 주식(코스피·코스닥) 알고리즘 지지·저항 자동 작도 & 실시간 시그널</p>
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
                                        <div class="cs-tf-menu-header">분봉 주기</div>
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

                    <!-- 전략 필터 칩 바 -->
                    <div class="cs-strategy-bar" id="cs-strategy-bar">
                        <button class="cs-strategy-chip active" data-strategy="all">
                            전체 시그널 <span class="cs-strategy-count" id="count-all">7</span>
                        </button>
                        <button class="cs-strategy-chip" data-strategy="support-bounce">
                            🚀 추세 지지선 반등 <span class="cs-strategy-count" id="count-support-bounce">3</span>
                        </button>
                        <button class="cs-strategy-chip" data-strategy="breakout-retest">
                            🛡️ 전고점 돌파 후 안착 <span class="cs-strategy-count" id="count-breakout-retest">1</span>
                        </button>
                        <button class="cs-strategy-chip" data-strategy="ma-converge">
                            ⚡ 이평선 수렴 & 정배열 <span class="cs-strategy-count" id="count-ma-converge">1</span>
                        </button>
                        <button class="cs-strategy-chip" data-strategy="bb-squeeze">
                            🎯 볼린저 밴드 스퀴즈 <span class="cs-strategy-count" id="count-bb-squeeze">1</span>
                        </button>
                        <button class="cs-strategy-chip" data-strategy="dual-buying">
                            💎 외인·기관 쌍끌이 <span class="cs-strategy-count" id="count-dual-buying">1</span>
                        </button>
                    </div>
                </header>

                <!-- 메인 본문 (좌측 종목 피드 + 수평 스플리터 + 우측 차트 & 브리핑) -->
                <div class="cs-main-body" id="cs-main-body">
                    <!-- 좌측: 포착된 국내 종목 피드 -->
                    <aside class="cs-stock-panel" id="cs-stock-panel">
                        <div class="cs-stock-search-wrap">
                            <div class="cs-search-input-box">
                                <i class="ph ph-magnifying-glass"></i>
                                <input type="text" id="cs-search-input" placeholder="종목명, 코드, 테마 검색">
                            </div>
                            <div class="cs-stock-filter-meta">
                                <span>포착 종목 <strong id="cs-filtered-count">7</strong>개</span>
                                <span>정렬: 거래대금순</span>
                            </div>
                        </div>
                        <div class="cs-stock-list" id="cs-stock-list">
                            <!-- 종목 리스트 렌더링 -->
                        </div>
                    </aside>

                    <!-- [신규 기능 1] 좌우 스플리터: 종목 칸과 차트 칸 폭 마우스 드래그 조절 -->
                    <div class="cs-resizer-h" id="cs-resizer-h">
                        <div class="cs-splitter-tooltip" style="left: 12px; top: 40px;">
                            끌어서 종목 칸과 차트 칸의 폭을 바꿉니다. 두 번 누르면 기본 폭으로 복귀
                        </div>
                    </div>

                    <!-- 우측: 스마트 캔들 차트 & AI 시그널 브리핑 -->
                    <main class="cs-chart-panel" id="cs-chart-panel">
                        <!-- 종목 헤더 정보 -->
                        <div class="cs-stock-header" id="cs-stock-header">
                            <!-- 헤더 동적 렌더링 -->
                        </div>

                        <!-- 차트 범례 바 -->
                        <div class="cs-chart-legend-bar">
                            <div class="cs-legend-items">
                                <div class="cs-legend-item">
                                    <div class="cs-legend-line support"></div>
                                    <span>AI 자동 지지선 (하늘색)</span>
                                </div>
                                <div class="cs-legend-item">
                                    <div class="cs-legend-dot"></div>
                                    <span>지지 터치/반등 지점 (초록)</span>
                                </div>
                                <div class="cs-legend-item">
                                    <div class="cs-legend-line stoploss"></div>
                                    <span>원칙 손절 기준선 (빨강 점선)</span>
                                </div>
                                <div class="cs-legend-item" style="color: #60a5fa; font-weight: 700;">
                                    <i class="ph ph-clock"></i> <span id="cs-active-tf-badge">일봉 차트</span>
                                </div>
                            </div>
                            <div>
                                <span style="font-size: 11px; color: var(--cs-text-muted);">
                                    <i class="ph ph-arrows-out-line-vertical"></i> 하단 경계선을 끌어 차트 높이를 자유롭게 늘릴 수 있습니다.
                                </span>
                            </div>
                        </div>

                        <!-- [신규 기능 2] 세로 780px 시원한 차트 + 좌측 전문 드로잉 툴바 -->
                        <div class="cs-chart-wrapper" id="cs-chart-wrapper">
                            <!-- 차트 좌측 드로잉 툴바 (업로드 이미지 기반 전문 작도 도구) -->
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

                        <!-- [신규 기능 3] 상하 스플리터: 차트 높이 마우스 드래그 조절 바 -->
                        <div class="cs-resizer-v" id="cs-resizer-v">
                            <div class="cs-splitter-tooltip" style="bottom: 14px; left: 50%; transform: translateX(-50%);">
                                끌어서 차트 높이를 바꿉니다. 두 번 누르면 기본 높이(780px)로 복귀
                            </div>
                        </div>

                        <!-- 하단 AI 시그널 브리핑 카드 -->
                        <div class="cs-ai-briefing-wrap" id="cs-ai-briefing-wrap">
                            <!-- 브리핑 카드 동적 렌더링 -->
                        </div>
                    </main>
                </div>
            </div>
        `;

        // 1. 이벤트 바인딩
        bindEvents(container);

        // 2. 스플리터 (리사이저) 바인딩
        initSplitters(container);

        // 3. 드로잉 툴바 및 인터랙티브 작도 엔진 바인딩
        initDrawingEngine(container);

        // 4. 초기 종목 렌더링
        updateStockList();
        selectStock(state.selectedStockCode);
    }

    // -------------------------------------------------------------
    // 6. 스플리터 (리사이저) 엔진: 좌우 폭 & 상하 높이 드래그 조절
    // -------------------------------------------------------------
    function initSplitters(container) {
        const resizerH = container.querySelector('#cs-resizer-h');
        const resizerV = container.querySelector('#cs-resizer-v');
        const stockPanel = container.querySelector('#cs-stock-panel');
        const chartWrapper = container.querySelector('#cs-chart-wrapper');
        const chartCanvasBox = container.querySelector('#cs-chart-canvas-box');

        let isResizingH = false;
        let isResizingV = false;

        // --- 좌우 스플리터 ---
        if (resizerH && stockPanel) {
            resizerH.addEventListener('mousedown', (e) => {
                isResizingH = true;
                resizerH.classList.add('resizing');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
            });

            // 더블클릭 시 기본 폭(340px)으로 복원
            resizerH.addEventListener('dblclick', () => {
                stockPanel.style.width = '340px';
                syncChartDimensions();
            });
        }

        // --- 상하 스플리터 ---
        if (resizerV && chartWrapper) {
            resizerV.addEventListener('mousedown', (e) => {
                isResizingV = true;
                resizerV.classList.add('resizing');
                document.body.style.cursor = 'row-resize';
                document.body.style.userSelect = 'none';
            });

            // 더블클릭 시 기본 높이(780px)로 복원
            resizerV.addEventListener('dblclick', () => {
                chartWrapper.style.height = '780px';
                syncChartDimensions();
            });
        }

        // 마우스 이동 & 크기 조정
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
    // 7. 인터랙티브 드로잉 툴바 및 오버레이 작도 엔진
    // -------------------------------------------------------------
    function initDrawingEngine(container) {
        const toolbar = container.querySelector('#cs-drawing-toolbar');
        const overlay = container.querySelector('#cs-drawing-overlay');
        if (!toolbar || !overlay) return;

        resizeDrawingOverlay();

        // 도구 클릭 이벤트
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

                // 툴 변경
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

        // 캔버스 드로잉 마우스 이벤트
        overlay.addEventListener('mousedown', (e) => {
            if (state.activeTool === 'cursor') return;

            const rect = overlay.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            state.isDrawingNow = true;
            state.drawStartPoint = { x, y };

            if (state.activeTool === 'horizontal') {
                // 수평선은 클릭 즉시 완성
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

            // 드래그 중 임시 미리보기 렌더링
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

            // 거리 3px 이상이면 저장
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

        state.userDrawings.forEach(shape => {
            drawSingleShape(ctx, shape, false);
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

            // 끝점 포인트 동그라미
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
            // 측정 도구: 봉 높이 및 변동폭 표시
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
    // 8. 상단 이벤트 바인딩
    // -------------------------------------------------------------
    function bindEvents(container) {
        // 전략 필터 칩 클릭
        const chips = container.querySelectorAll('.cs-strategy-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.selectedStrategy = chip.getAttribute('data-strategy');
                updateStockList();
            });
        });

        // 1) 장기 주기 탭 (일봉, 주봉, 월봉, 년봉)
        const periodBtns = container.querySelectorAll('.cs-tf-pill-group .cs-tf-btn');
        periodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                clearTimeframeActiveStates();
                btn.classList.add('active');
                setTimeframe(btn.getAttribute('data-tf'));
            });
        });

        // 2) 분봉 & 시봉 드롭다운
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

        // 3) 검색창 이벤트
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
        const badge = document.getElementById('cs-active-tf-badge');
        if (badge) {
            badge.textContent = `${getTimeframeLabel(tf)} 차트`;
        }
        selectStock(state.selectedStockCode);
    }

    // -------------------------------------------------------------
    // 9. 종목 리스트 업데이트 & 렌더링
    // -------------------------------------------------------------
    function updateStockList() {
        const listContainer = document.getElementById('cs-stock-list');
        const countSpan = document.getElementById('cs-filtered-count');
        if (!listContainer) return;

        let filtered = SAMPLE_STOCKS.filter(stock => {
            if (state.selectedStrategy !== 'all' && stock.strategy !== state.selectedStrategy) {
                return false;
            }
            if (state.searchQuery) {
                const matchName = stock.name.toLowerCase().includes(state.searchQuery);
                const matchCode = stock.code.includes(state.searchQuery);
                const matchTheme = stock.theme.toLowerCase().includes(state.searchQuery);
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

            return `
                <div class="cs-stock-item ${isActive}" data-code="${stock.code}">
                    <div class="cs-stock-item-top">
                        <div class="cs-stock-item-name">
                            <span>${stock.name}</span>
                            <span class="cs-stock-market">${stock.market}</span>
                        </div>
                        <div class="cs-stock-item-price ${colorClass}">
                            ${stock.price.toLocaleString()}원
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
                        <span>거래대금 ${stock.tradeAmount}</span>
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
    // 10. 단일 종목 선택 & 차트/브리핑 갱신
    // -------------------------------------------------------------
    function selectStock(code) {
        state.selectedStockCode = code;
        const stock = SAMPLE_STOCKS.find(s => s.code === code);
        if (!stock) return;

        document.querySelectorAll('.cs-stock-item').forEach(item => {
            if (item.getAttribute('data-code') === code) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        renderStockHeader(stock);
        renderBriefingCard(stock);

        const dataset = generateDataset(stock, state.activeTimeframe);
        renderChart(stock, dataset);
        resizeDrawingOverlay();
    }

    function renderStockHeader(stock) {
        const headerEl = document.getElementById('cs-stock-header');
        if (!headerEl) return;

        const isUp = stock.changeRate >= 0;
        const colorClass = isUp ? 'text-up' : 'text-down';
        const sign = isUp ? '+' : '';
        const tfLabel = getTimeframeLabel(state.activeTimeframe);

        headerEl.innerHTML = `
            <div class="cs-sh-left">
                <span class="cs-sh-name">${stock.name}</span>
                <span class="cs-sh-code">${stock.code} · ${stock.market} [${tfLabel}]</span>
                <span class="cs-sh-price ${colorClass}">${stock.price.toLocaleString()}원</span>
                <span class="cs-sh-change ${colorClass}">(${sign}${stock.changeRate.toFixed(2)}%)</span>
                
                <div class="cs-sh-meta">
                    <span class="cs-sh-meta-item">거래대금 <strong>${stock.tradeAmount}</strong></span>
                    <span class="cs-sh-meta-item">테마 <strong>${stock.theme}</strong></span>
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

        console.log(`[Signal Lab] ${stock.name} 타점이 리스크 계산기로 전송되었습니다. (손절가: ${stock.stopPrice.toLocaleString()}원)`);
    }

    function renderBriefingCard(stock) {
        const briefingEl = document.getElementById('cs-ai-briefing-wrap');
        if (!briefingEl) return;

        const tfLabel = getTimeframeLabel(state.activeTimeframe);

        briefingEl.innerHTML = `
            <div class="cs-briefing-header">
                <div class="cs-briefing-title">
                    <i class="ph-fill ph-sparkle" style="color: var(--cs-accent-gold);"></i>
                    AI 시그널 분석 리포트 & 실전 매매 가이드 [${tfLabel}]
                </div>
                <div style="font-size: 12px; color: var(--cs-text-muted);">
                    기준 시점: 2026-10-19 15:30 KST 기준
                </div>
            </div>

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

                <!-- 2. 매매 타점 & 손익비 (1R) -->
                <div class="cs-briefing-card" style="border-color: rgba(245, 158, 11, 0.3);">
                    <div class="cs-card-label">
                        <i class="ph-fill ph-scales" style="color: var(--cs-accent-gold);"></i>
                        추천 매매 타점 및 손절 가이드
                    </div>
                    <div class="cs-card-value-big" style="color: var(--cs-accent-gold);">
                        손절가 ${stock.stopPrice.toLocaleString()}원
                    </div>
                    <div class="cs-card-desc">
                        ${stock.briefing.tradePlan}
                    </div>
                </div>

                <!-- 3. 수급 및 테마 동향 -->
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
        `;
    }

    function renderChart(stock, dataset) {
        const container = document.getElementById('cs-tv-chart');
        if (!container) return;

        container.innerHTML = '';

        if (window.LightweightCharts) {
            renderWithLightweightCharts(container, stock, dataset);
        } else {
            renderWithCanvasFallback(container, stock, dataset);
        }
    }

    function renderWithLightweightCharts(container, stock, dataset) {
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

            if (dataset.supportLine && dataset.supportLine.length >= 2) {
                const supportSeries = chart.addLineSeries({
                    color: '#38bdf8',
                    lineWidth: 2,
                    lineStyle: LightweightCharts.LineStyle.Solid,
                    title: 'AI 지지선'
                });
                supportSeries.setData(dataset.supportLine.map(pt => ({ time: pt.time, value: pt.price })));
            }

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

            if (dataset.touchPoints && dataset.touchPoints.length > 0) {
                const markers = dataset.touchPoints.map(tp => ({
                    time: tp.time,
                    position: 'belowBar',
                    color: '#10b981',
                    shape: 'arrowUp',
                    text: tp.text
                }));
                candlestickSeries.setMarkers(markers);
            }

            chart.timeScale().fitContent();

            window.addEventListener('resize', () => {
                if (container && chart) {
                    chart.applyOptions({ width: container.clientWidth });
                }
                resizeDrawingOverlay();
            });

        } catch (err) {
            console.warn('[LightweightCharts] 캔버스 폴백으로 전환:', err);
            renderWithCanvasFallback(container, stock, dataset);
        }
    }

    function renderWithCanvasFallback(container, stock, dataset) {
        const chartWrapper = document.getElementById('cs-chart-wrapper');
        const width = container.clientWidth || 800;
        const height = chartWrapper ? chartWrapper.clientHeight : 780;

        const canvas = document.createElement('canvas');
        canvas.width = width * 2;
        canvas.height = height * 2;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);

        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let y = 40; y < height - 30; y += 50) {
            ctx.beginPath();
            ctx.moveTo(40, y);
            ctx.lineTo(width - 60, y);
            ctx.stroke();
        }

        const candles = dataset.candles;
        if (!candles || candles.length === 0) return;

        let minPrice = Infinity;
        let maxPrice = -Infinity;
        candles.forEach(c => {
            if (c.low < minPrice) minPrice = c.low;
            if (c.high > maxPrice) maxPrice = c.high;
        });

        const padding = (maxPrice - minPrice) * 0.1;
        minPrice -= padding;
        maxPrice += padding;

        const chartLeft = 40;
        const chartRight = width - 70;
        const chartTop = 20;
        const chartBottom = height - 40;
        const candleWidth = (chartRight - chartLeft) / candles.length;

        function getY(price) {
            return chartBottom - ((price - minPrice) / (maxPrice - minPrice)) * (chartBottom - chartTop);
        }

        candles.forEach((c, idx) => {
            const x = chartLeft + idx * candleWidth + candleWidth / 2;
            const openY = getY(c.open);
            const closeY = getY(c.close);
            const highY = getY(c.high);
            const lowY = getY(c.low);
            const isUp = c.close >= c.open;

            ctx.strokeStyle = isUp ? '#ef4444' : '#3b82f6';
            ctx.fillStyle = isUp ? '#ef4444' : '#3b82f6';

            ctx.beginPath();
            ctx.moveTo(x, highY);
            ctx.lineTo(x, lowY);
            ctx.stroke();

            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
            ctx.fillRect(x - candleWidth * 0.35, bodyY, candleWidth * 0.7, bodyHeight);
        });

        if (dataset.supportLine && dataset.supportLine.length >= 2) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.5;
            ctx.beginPath();

            dataset.supportLine.forEach((pt, i) => {
                const candleIdx = candles.findIndex(c => c.time === pt.time);
                const x = candleIdx !== -1 ? chartLeft + candleIdx * candleWidth + candleWidth / 2 : chartLeft + (i / dataset.supportLine.length) * (chartRight - chartLeft);
                const y = getY(pt.price);

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText('AI 자동 지지선', chartRight - 80, getY(dataset.supportLine[dataset.supportLine.length - 1].price) - 8);
        }

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        const stopY = getY(stock.stopPrice);
        ctx.moveTo(chartLeft, stopY);
        ctx.lineTo(chartRight, stopY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`손절선 ${stock.stopPrice.toLocaleString()}원`, chartRight - 110, stopY - 5);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        for (let p = minPrice; p <= maxPrice; p += (maxPrice - minPrice) / 5) {
            const py = getY(p);
            ctx.fillText(Math.round(p).toLocaleString(), chartRight + 5, py + 3);
        }
    }

    // -------------------------------------------------------------
    // 11. 외부 노출 라우터
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
