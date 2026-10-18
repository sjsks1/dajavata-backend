/**
 * DAJAVATA TRADER ROOM (트레이더 룸) - CORE LOGIC & VIEWS
 * 국내 주식(코스피/코스닥) 전용 리스크 계산기, 매매 시나리오, 매매일지, 성과 분석 및 Local-First 저장소
 */

(function () {
    'use strict';

    const DB_KEY = 'dajavata_trader_db_v1';

    // 기본 초기 데이터 (최초 접속 시 빈 화면 대신 실전 가이드용 데이터 제공)
    const DEFAULT_DATA = {
        profile: {
            accountBalance: 10000000, // 기본 예수금 1천만원
            defaultRiskPercent: 1.0,  // 거래당 1R = 1% (10만원)
            taxRate: 0.18,            // 국내 주식 거래세 0.18%
            feeRate: 0.015,           // 증권사 위탁수수료 0.015%
            nextFocusTask: "손절 원칙 엄수 및 1회 거래당 1R(10만원) 리스크 한도 준수하기"
        },
        focusList: [
            { id: 1, text: "장 시작 전 코스피/코스닥 지수 흐름 및 외인·기관 수급 확인", done: true },
            { id: 2, text: "진입 전 반드시 손절 기준가와 손익비(최소 1:2 이상) 먼저 계산", done: false },
            { id: 3, text: "돌파 매매 시 5분봉 거래대금 실린 거래 확인 후 진입", done: false },
            { id: 4, text: "1일 최대 허용 손실(2R) 도달 시 당일 모든 HTS/MTS 끄고 종료", done: false }
        ],
        sessionNotes: "코스피 2,600선 지지 테스트 중. 반도체 및 2차전지 주도 섹터 수급 전환 여부 관찰.",
        plans: [
            {
                id: "plan-sample-1",
                createdAt: new Date().toISOString(),
                market: "KOSDAQ",
                stockName: "원익IPS",
                stockCode: "240810",
                direction: "Long",
                timeframe: "스윙 (1~2주)",
                keyLevel: "32,500원 주요 지지대",
                setup: "눌림목 반등",
                invalidation: "31,800원 이탈 시 기계적 손절",
                entryTrigger: "32,800원 부근 거래량 실린 양봉 마감 시",
                thesis: "반도체 장비 사이클 턴어라운드 및 전고점 돌파 후 1차 지지선 테스트 구간",
                version: "v1",
                status: "진행중", // 초안, 진행중, 완료, 취소
                locked: true,
                checklist: [
                    { label: "상위 타임프레임(일봉/주봉) 추세 일치 여부", checked: true },
                    { label: "주요 매물대 및 지지/저항 라인 확인", checked: true },
                    { label: "손익비 최소 1:2 이상 확보", checked: true },
                    { label: "1회 거래당 1R 리스크 한도(10만원) 준수", checked: true }
                ],
                riskCalc: {
                    entryPrice: 32800,
                    stopLoss: 31800,
                    targetPrice: 35500,
                    capital: 10000000,
                    riskPercent: 1.0,
                    riskAmount: 100000,
                    shares: 100,
                    totalAmount: 3280000,
                    portfolioPercent: 32.8,
                    rrRatio: 2.7
                }
            }
        ],
        journal: [
            {
                id: "journal-sample-1",
                entryDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
                exitDate: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
                stockName: "SK하이닉스",
                stockCode: "000660",
                market: "KOSPI",
                setup: "신고점 돌파",
                entryPrice: 185000,
                exitPrice: 194000,
                stopLoss: 181000,
                shares: 25,
                pnlAmount: 225000,
                realizedR: 2.25,
                ruleCompliance: "Yes", // Yes, Partial, No
                mistakes: [],
                notes: "HBM 수급 지속 확인 후 돌파 구간에 정석 진입. 1차 목표가 도달 시 계획대로 분할 익절 완료.",
                reviewed: true
            }
        ],
        skipLogs: [
            {
                id: "skip-sample-1",
                date: new Date().toISOString().split('T')[0],
                stockName: "삼천당제약",
                intendedSetup: "시초가 갭상승 추격",
                reason: "시초 갭이 +7% 이상 과도하게 떠서 손절폭 대비 손익비가 1:1도 나오지 않아 뇌동매매를 참고 비진입함.",
                marketContext: "외인 선물 매도세 강한 장세"
            }
        ]
    };

    // -------------------------------------------------------------
    // STORAGE ENGINE (Local-First via LocalStorage)
    // -------------------------------------------------------------
    const Storage = {
        load() {
            try {
                const raw = localStorage.getItem(DB_KEY);
                if (!raw) {
                    this.save(DEFAULT_DATA);
                    return DEFAULT_DATA;
                }
                const parsed = JSON.parse(raw);
                return Object.assign({}, DEFAULT_DATA, parsed);
            } catch (e) {
                console.error("Storage load error, returning default data:", e);
                return DEFAULT_DATA;
            }
        },
        save(data) {
            try {
                localStorage.setItem(DB_KEY, JSON.stringify(data));
                return true;
            } catch (e) {
                console.error("Storage save error:", e);
                alert("로컬 저장 공간이 부족하거나 저장이 제한되어 있습니다.");
                return false;
            }
        },
        exportJSON() {
            const data = this.load();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
            a.href = url;
            a.download = `dajavata_trading_backup_${dateStr}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },
        importJSON(file, onSuccess) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (parsed && (parsed.plans || parsed.journal || parsed.profile)) {
                        this.save(parsed);
                        alert("데이터가 성공적으로 복원되었습니다!");
                        if (onSuccess) onSuccess();
                    } else {
                        alert("올바른 다자바타 백업 파일 형식이 아닙니다.");
                    }
                } catch (err) {
                    alert("파일을 읽는 중 오류가 발생했습니다: " + err.message);
                }
            };
            reader.readAsText(file);
        },
        exportCSV() {
            const data = this.load();
            const list = data.journal || [];
            if (list.length === 0) {
                alert("내보낼 매매일지 기록이 없습니다.");
                return;
            }
            let csv = "\uFEFF진입일,청산일,종목명,종목코드,시장,매매기법,매수가,청산가,수량,실현손익(원),실현R값,원칙준수여부,복기노트\n";
            list.forEach(j => {
                const row = [
                    j.entryDate || '',
                    j.exitDate || '',
                    `"${(j.stockName || '').replace(/"/g, '""')}"`,
                    j.stockCode || '',
                    j.market || '',
                    `"${(j.setup || '').replace(/"/g, '""')}"`,
                    j.entryPrice || 0,
                    j.exitPrice || 0,
                    j.shares || 0,
                    j.pnlAmount || 0,
                    j.realizedR || 0,
                    j.ruleCompliance || '',
                    `"${(j.notes || '').replace(/"/g, '""')}"`
                ];
                csv += row.join(',') + '\n';
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
            a.href = url;
            a.download = `dajavata_trade_journal_${dateStr}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        },
        async requestPersist() {
            if (navigator.storage && navigator.storage.persist) {
                const isPersisted = await navigator.storage.persist();
                if (isPersisted) {
                    alert("✅ 브라우저 영구 저장소 권한이 허용되었습니다! (캐시 청소 시에도 데이터가 보호됩니다)");
                } else {
                    alert("ℹ️ 브라우저 정책에 의해 권한이 자동 유지되지 않을 수 있습니다. 중요한 기록은 주기적으로 [JSON 백업]을 다운로드하세요.");
                }
            } else {
                alert("현재 브라우저는 저장소 영구 유지 API를 지원하지 않습니다. 주기적인 JSON 백업을 권장합니다.");
            }
        }
    };

    // -------------------------------------------------------------
    // KOREAN STOCK RISK CALCULATOR LOGIC
    // -------------------------------------------------------------
    const Calculator = {
        calculate(params) {
            const capital = parseFloat(params.capital) || 0;
            const isPercent = params.riskMode === 'percent';
            const riskValue = parseFloat(params.riskValue) || 0;
            const entryPrice = parseFloat(params.entryPrice) || 0;
            const stopLoss = parseFloat(params.stopLoss) || 0;
            const targetPrice = parseFloat(params.targetPrice) || 0;
            const includeFees = !!params.includeFees;

            if (capital <= 0 || entryPrice <= 0 || stopLoss <= 0) {
                return null;
            }

            // 1회 허용 손실금(1R)
            const allowedRisk = isPercent ? (capital * (riskValue / 100)) : riskValue;
            
            // 1주당 손절폭
            const lossPerShare = entryPrice - stopLoss;
            if (lossPerShare <= 0) {
                return {
                    error: "손절가는 매수가보다 낮아야 합니다 (Long 기준)."
                };
            }
            const lossPercent = (lossPerShare / entryPrice) * 100;

            // 적정 매수 수량 (국내주식 1주 단위 정수 내림)
            let shares = Math.floor(allowedRisk / lossPerShare);
            if (shares < 1) shares = 0;

            // 총 매수 필요 금액
            const totalCost = shares * entryPrice;
            const portfolioPercent = capital > 0 ? (totalCost / capital) * 100 : 0;

            // 목표가 관련 손익비(RR)
            let gainPerShare = 0;
            let gainPercent = 0;
            let targetProfit = 0;
            let rrRatio = 0;

            if (targetPrice > entryPrice) {
                gainPerShare = targetPrice - entryPrice;
                gainPercent = (gainPerShare / entryPrice) * 100;
                targetProfit = shares * gainPerShare;
                rrRatio = gainPerShare / lossPerShare;
            }

            // 세금/수수료 (거래세 0.18% + 수수료 약 0.015% = 약 0.2% 매도/매수 시)
            let feeCost = 0;
            let netProfit = targetProfit;
            let netLoss = shares * lossPerShare;
            if (includeFees && shares > 0) {
                // 매수금액 * 0.00015 + 매도금액 * (0.0018 + 0.00015)
                const buyFee = totalCost * 0.00015;
                const targetSellFee = (shares * targetPrice) * 0.00195;
                const stopSellFee = (shares * stopLoss) * 0.00195;
                feeCost = buyFee + targetSellFee;
                netProfit = Math.max(0, targetProfit - (buyFee + targetSellFee));
                netLoss = (shares * lossPerShare) + (buyFee + stopSellFee);
            }

            // 안전 경고 체크
            const warnings = [];
            if (totalCost > capital) {
                warnings.push("⚠️ 계좌 총 예수금을 초과하는 비중입니다! 손절폭을 좁히거나 리스크 비율(%)을 낮추세요.");
            }
            if (targetPrice > 0 && rrRatio < 1.5) {
                warnings.push("⚠️ 손익비가 1:1.5 미만입니다. 최소 1:2 이상의 유리한 자리를 기다리는 것을 권장합니다.");
            }
            if (lossPercent > 10) {
                warnings.push("ℹ️ 1회 손절폭이 -10% 이상으로 큽니다. 변동성 대비 포지션 진입 시점을 다시 점검해보세요.");
            }

            return {
                allowedRisk,
                lossPerShare,
                lossPercent,
                shares,
                totalCost,
                portfolioPercent,
                gainPerShare,
                gainPercent,
                targetProfit,
                netProfit,
                netLoss,
                rrRatio,
                feeCost,
                warnings
            };
        }
    };

    // -------------------------------------------------------------
    // UTILITIES
    // -------------------------------------------------------------
    function formatKRW(val) {
        if (isNaN(val) || val === null || val === undefined) return "0원";
        return Math.round(val).toLocaleString() + "원";
    }

    function formatNumber(val, decimals = 1) {
        if (isNaN(val) || val === null || val === undefined) return "0";
        return Number(val).toFixed(decimals);
    }

    function getGreeting() {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 11) return "상쾌한 아침입니다 ☀️";
        if (hour >= 11 && hour < 14) return "활기찬 점심시간입니다 🍱";
        if (hour >= 14 && hour < 18) return "장 마감 점검 시간입니다 📈";
        if (hour >= 18 && hour < 22) return "좋은 저녁입니다 🌙";
        return "차분한 심야 복기 시간입니다 🌌";
    }

    function getKSTDateString() {
        const d = new Date();
        const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const date = d.getDate();
        const day = days[d.getDay()];
        return `${year}년 ${month}월 ${date}일 ${day}`;
    }

    // -------------------------------------------------------------
    // VIEW RENDERERS
    // -------------------------------------------------------------
    const Views = {
        // 1. 오늘의 매매 (Trading Room Dashboard)
        renderToday(container) {
            const db = Storage.load();
            const plans = db.plans || [];
            const activePlans = plans.filter(p => p.status === '진행중' || p.status === '초안');
            const journal = db.journal || [];
            const unreviewedTrades = journal.filter(j => !j.reviewed);
            
            // 주간/전체 요약 통계 계산
            const totalTrades = journal.length;
            const netR = journal.reduce((acc, cur) => acc + (parseFloat(cur.realizedR) || 0), 0);
            const compliantTrades = journal.filter(j => j.ruleCompliance === 'Yes').length;
            const complianceRate = totalTrades > 0 ? Math.round((compliantTrades / totalTrades) * 100) : 100;
            
            // 가장 빈번한 실수 집계
            const mistakeCounts = {};
            journal.forEach(j => {
                (j.mistakes || []).forEach(m => {
                    mistakeCounts[m] = (mistakeCounts[m] || 0) + 1;
                });
            });
            let topMistake = "아직 기록된 실수 없음 (원칙 준수 중)";
            let maxCount = 0;
            for (let [k, v] of Object.entries(mistakeCounts)) {
                if (v > maxCount) {
                    maxCount = v;
                    topMistake = `${k} (${v}회)`;
                }
            }

            container.innerHTML = `
                <div class="tw-header">
                    <div class="tw-header-left">
                        <div class="tw-eyebrow"><i class="ph ph-shield-check"></i> DAJAVATA TRADING ROOM</div>
                        <h1>${getGreeting()}</h1>
                        <p class="tw-desc">"계획하고, 리스크를 통제하고, 차분하게 복기하세요."</p>
                    </div>
                    <div class="tw-header-right">
                        <div class="tw-date-badge"><i class="ph ph-calendar-blank"></i> ${getKSTDateString()}</div>
                        <button class="tw-btn tw-btn-primary tw-btn-sm" id="btn-quick-new-plan">
                            <i class="ph ph-plus-circle"></i> 새 시나리오 작성
                        </button>
                    </div>
                </div>

                <!-- Next Step 가이드 배너 -->
                <div class="tw-next-step-card">
                    <div class="tw-next-step-info">
                        <h4>NEXT ACTION • 오늘의 핵심 원칙</h4>
                        <p>${db.profile.nextFocusTask || "진입 전 손절 기준을 먼저 정하고, 1R 리스크 한도를 반드시 지키세요."}</p>
                    </div>
                    <div>
                        <button class="tw-btn tw-btn-primary tw-btn-sm" id="btn-edit-next-focus">과제 수정</button>
                    </div>
                </div>

                <!-- 퀵 액션 카드 4종 -->
                <div class="tw-quick-grid">
                    <div class="tw-quick-card" data-nav="trader-calc">
                        <div class="tw-quick-card-top">
                            <i class="ph ph-calculator icon"></i>
                            <i class="ph ph-arrow-up-right arrow"></i>
                        </div>
                        <div class="tw-quick-card-body">
                            <h3>포지션 & 비중 계산기</h3>
                            <p>계좌 예수금과 손절폭에 맞는 최적 매수 수량 및 손익비 산출</p>
                        </div>
                    </div>
                    <div class="tw-quick-card" data-nav="trader-plan">
                        <div class="tw-quick-card-top">
                            <i class="ph ph-notepad icon"></i>
                            <i class="ph ph-arrow-up-right arrow"></i>
                        </div>
                        <div class="tw-quick-card-body">
                            <h3>새 매매 시나리오</h3>
                            <p>진입 전 무효화(손절) 기준과 진입 트리거를 먼저 잠그세요</p>
                        </div>
                    </div>
                    <div class="tw-quick-card" data-nav="trader-plan">
                        <div class="tw-quick-card-top">
                            <i class="ph ph-clock-countdown icon"></i>
                            <i class="ph ph-arrow-up-right arrow"></i>
                        </div>
                        ${activePlans.length > 0 ? `<div class="tw-quick-card-badge">${activePlans.length}건</div>` : ''}
                        <div class="tw-quick-card-body">
                            <h3>진행 중 시나리오</h3>
                            <p>기획되어 감시 중이거나 체결을 기다리는 매매 계획</p>
                        </div>
                    </div>
                    <div class="tw-quick-card" data-nav="trader-journal">
                        <div class="tw-quick-card-top">
                            <i class="ph ph-book-open icon"></i>
                            <i class="ph ph-arrow-up-right arrow"></i>
                        </div>
                        ${unreviewedTrades.length > 0 ? `<div class="tw-quick-card-badge">${unreviewedTrades.length}건</div>` : ''}
                        <div class="tw-quick-card-body">
                            <h3>복기 대기 노트</h3>
                            <p>청산 완료 후 실전 피드백 및 배운 점 작성을 기다리는 거래</p>
                        </div>
                    </div>
                </div>

                <!-- 주간 핵심 KPI 바 -->
                <div class="tw-kpi-bar">
                    <div class="tw-kpi-item">
                        <div class="label"><i class="ph ph-trend-up"></i> 누적 Net R (손익비 합계)</div>
                        <div class="val ${netR >= 0 ? 'pos' : 'neg'}">${netR >= 0 ? '+' : ''}${formatNumber(netR, 2)} R</div>
                        <div class="sub">1R = ${formatKRW(db.profile.accountBalance * (db.profile.defaultRiskPercent / 100))}</div>
                    </div>
                    <div class="tw-kpi-item">
                        <div class="label"><i class="ph ph-check-circle"></i> 원칙 준수율</div>
                        <div class="val ${complianceRate >= 80 ? 'pos' : ''}">${complianceRate}%</div>
                        <div class="sub">평가된 거래 기준 (Yes 비율)</div>
                    </div>
                    <div class="tw-kpi-item">
                        <div class="label"><i class="ph ph-chart-bar"></i> 총 완료 매매</div>
                        <div class="val">${totalTrades}건</div>
                        <div class="sub">복기 완료 ${journal.filter(j=>j.reviewed).length}건</div>
                    </div>
                    <div class="tw-kpi-item">
                        <div class="label"><i class="ph ph-warning-circle"></i> 가장 반복된 실수</div>
                        <div class="val" style="font-size:15px; margin-top:4px;">${topMistake}</div>
                        <div class="sub">복기 노트에서 분석된 취약점</div>
                    </div>
                </div>

                <!-- 2단 메인 대시보드 레이아웃 -->
                <div class="tw-dashboard-split">
                    <!-- 좌측: 진행 중 시나리오 & 최근 거래 -->
                    <div class="tw-dashboard-main">
                        <div class="tw-section-card">
                            <div class="tw-section-title">
                                <h3><i class="ph ph-notepad"></i> 진행 중인 매매 시나리오</h3>
                                <button class="tw-btn-link" id="link-go-plan">전체보기 <i class="ph ph-caret-right"></i></button>
                            </div>
                            <div id="today-plans-container">
                                ${activePlans.length === 0 ? `
                                    <div class="tw-empty-box">
                                        <i class="ph ph-file-dashed"></i>
                                        현재 진행 중인 시나리오가 없습니다.<br>
                                        [새 시나리오 작성] 버튼을 눌러 다음 매매 계획을 먼저 수립하세요.
                                    </div>
                                ` : `
                                    <table class="tw-table">
                                        <thead>
                                            <tr>
                                                <th>종목명</th>
                                                <th>셋업 기법</th>
                                                <th>타임프레임</th>
                                                <th>목표 손익비</th>
                                                <th>상태</th>
                                                <th>관리</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${activePlans.map(p => `
                                                <tr>
                                                    <td>
                                                        <strong style="color:#fff;">${p.stockName}</strong> 
                                                        <span style="font-size:11px; color:var(--text-muted);">${p.stockCode || ''}</span>
                                                    </td>
                                                    <td>${p.setup || '-'}</td>
                                                    <td>${p.timeframe || '-'}</td>
                                                    <td><strong class="pos">1 : ${p.riskCalc ? formatNumber(p.riskCalc.rrRatio, 1) : '-'}</strong></td>
                                                    <td><span class="tw-badge tw-badge-status-active">${p.status}</span></td>
                                                    <td>
                                                        <button class="tw-btn tw-btn-secondary tw-btn-sm btn-open-plan" data-id="${p.id}">열기</button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                `}
                            </div>
                        </div>

                        <div class="tw-section-card">
                            <div class="tw-section-title">
                                <h3><i class="ph ph-clock-counter-clockwise"></i> 최근 매매일지</h3>
                                <button class="tw-btn-link" id="link-go-journal">매매일지 전체보기 <i class="ph ph-caret-right"></i></button>
                            </div>
                            <div id="today-recent-trades">
                                ${journal.length === 0 ? `
                                    <div class="tw-empty-box">
                                        <i class="ph ph-book-open"></i>
                                        아직 등록된 매매일지가 없습니다.
                                    </div>
                                ` : `
                                    <table class="tw-table">
                                        <thead>
                                            <tr>
                                                <th>청산일</th>
                                                <th>종목명</th>
                                                <th>매매기법</th>
                                                <th>실현 손익</th>
                                                <th>실현 R</th>
                                                <th>원칙 준수</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${journal.slice(0, 4).map(j => `
                                                <tr>
                                                    <td>${j.exitDate || j.entryDate}</td>
                                                    <td><strong style="color:#fff;">${j.stockName}</strong></td>
                                                    <td>${j.setup || '-'}</td>
                                                    <td class="${j.pnlAmount >= 0 ? 'pos' : 'neg'}"><strong>${j.pnlAmount >= 0 ? '+' : ''}${formatKRW(j.pnlAmount)}</strong></td>
                                                    <td class="${j.realizedR >= 0 ? 'pos' : 'neg'}"><strong>${j.realizedR >= 0 ? '+' : ''}${formatNumber(j.realizedR, 2)}R</strong></td>
                                                    <td>
                                                        <span class="tw-badge ${j.ruleCompliance === 'Yes' ? 'tw-badge-status-active' : 'tw-badge-status-cancel'}">
                                                            ${j.ruleCompliance === 'Yes' ? '원칙 준수' : '원칙 미준수'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                `}
                            </div>
                        </div>
                    </div>

                    <!-- 우측: 오늘의 Focus & 비진입 기록 & 세션 노트 -->
                    <div class="tw-dashboard-sidebar">
                        <!-- 오늘의 Focus -->
                        <div class="tw-section-card">
                            <div class="tw-section-title">
                                <h3><i class="ph ph-check-square-offset"></i> 오늘의 매매 Focus</h3>
                            </div>
                            <div id="focus-checklist-container">
                                ${(db.focusList || []).map(f => `
                                    <div class="tw-focus-item ${f.done ? 'done' : ''}" data-id="${f.id}">
                                        <div class="tw-focus-item-left">
                                            <input type="checkbox" class="focus-chk" ${f.done ? 'checked' : ''}>
                                            <span>${f.text}</span>
                                        </div>
                                        <div class="tw-focus-item-actions">
                                            <button class="tw-icon-btn btn-del-focus" title="삭제"><i class="ph ph-trash"></i></button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="tw-focus-add-box">
                                <input type="text" id="input-new-focus" placeholder="새 체크리스트 항목 입력...">
                                <button class="tw-btn tw-btn-secondary tw-btn-sm" id="btn-add-focus"><i class="ph ph-plus"></i></button>
                            </div>
                        </div>

                        <!-- 비진입 기록 (뇌동방지) -->
                        <div class="tw-section-card">
                            <div class="tw-section-title">
                                <h3><i class="ph ph-hand-palm"></i> 비진입 기록 (뇌동 방지)</h3>
                            </div>
                            <p style="font-size:12px; color:var(--text-muted); line-height:1.45; margin-bottom:12px;">
                                "비진입도 훌륭한 투자 결정입니다. 뇌동매매를 참고 진입하지 않은 이유를 남겨보세요."
                            </p>
                            <button class="tw-btn tw-btn-secondary" style="width:100%;" id="btn-quick-skip-log">
                                <i class="ph ph-shield"></i> + 비진입 사유 기록하기
                            </button>
                        </div>

                        <!-- 장중 세션 노트 -->
                        <div class="tw-section-card">
                            <div class="tw-section-title">
                                <h3><i class="ph ph-pencil-simple-line"></i> 장중 관찰 노트</h3>
                                <span style="font-size:11px; color:var(--text-muted);" id="note-save-status">자동 저장됨</span>
                            </div>
                            <textarea class="tw-note-textarea" id="today-session-notes" placeholder="당일 주요 시장 변곡점, 섹터 흐름, 지지/저항 반응 등을 메모하세요...">${db.sessionNotes || ''}</textarea>
                        </div>
                    </div>
                </div>
            `;

            // 이벤트 바인딩
            this.bindTodayEvents(container);
        },

        bindTodayEvents(container) {
            // 퀵 카드 클릭 네비게이션
            container.querySelectorAll('.tw-quick-card').forEach(card => {
                card.addEventListener('click', () => {
                    const nav = card.getAttribute('data-nav');
                    if (nav && window.TraderRoom) window.TraderRoom.navigate(nav);
                });
            });

            const linkPlan = container.querySelector('#link-go-plan');
            if (linkPlan) linkPlan.addEventListener('click', () => window.TraderRoom.navigate('trader-plan'));

            const linkJournal = container.querySelector('#link-go-journal');
            if (linkJournal) linkJournal.addEventListener('click', () => window.TraderRoom.navigate('trader-journal'));

            const btnNewPlan = container.querySelector('#btn-quick-new-plan');
            if (btnNewPlan) btnNewPlan.addEventListener('click', () => window.TraderRoom.navigate('trader-plan', { action: 'new' }));

            // 시나리오 열기
            container.querySelectorAll('.btn-open-plan').forEach(btn => {
                btn.addEventListener('click', () => {
                    const planId = btn.getAttribute('data-id');
                    window.TraderRoom.navigate('trader-plan', { viewPlanId: planId });
                });
            });

            // Focus 체크리스트 토글 & 추가 & 삭제
            const focusContainer = container.querySelector('#focus-checklist-container');
            if (focusContainer) {
                focusContainer.addEventListener('change', (e) => {
                    if (e.target.classList.contains('focus-chk')) {
                        const itemEl = e.target.closest('.tw-focus-item');
                        const id = parseInt(itemEl.getAttribute('data-id'), 10);
                        const db = Storage.load();
                        const target = (db.focusList || []).find(f => f.id === id);
                        if (target) {
                            target.done = e.target.checked;
                            Storage.save(db);
                            itemEl.classList.toggle('done', target.done);
                        }
                    }
                });

                focusContainer.addEventListener('click', (e) => {
                    const delBtn = e.target.closest('.btn-del-focus');
                    if (delBtn) {
                        const itemEl = delBtn.closest('.tw-focus-item');
                        const id = parseInt(itemEl.getAttribute('data-id'), 10);
                        const db = Storage.load();
                        db.focusList = (db.focusList || []).filter(f => f.id !== id);
                        Storage.save(db);
                        itemEl.remove();
                    }
                });
            }

            const inputNewFocus = container.querySelector('#input-new-focus');
            const btnAddFocus = container.querySelector('#btn-add-focus');
            const addFocusItem = () => {
                const text = (inputNewFocus.value || '').trim();
                if (!text) return;
                const db = Storage.load();
                db.focusList = db.focusList || [];
                const newItem = { id: Date.now(), text: text, done: false };
                db.focusList.push(newItem);
                Storage.save(db);
                inputNewFocus.value = '';
                this.renderToday(container);
            };
            if (btnAddFocus) btnAddFocus.addEventListener('click', addFocusItem);
            if (inputNewFocus) {
                inputNewFocus.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') addFocusItem();
                });
            }

            // 세션 노트 자동 저장
            const notesTextarea = container.querySelector('#today-session-notes');
            const saveStatus = container.querySelector('#note-save-status');
            let noteTimer = null;
            if (notesTextarea) {
                notesTextarea.addEventListener('input', () => {
                    if (saveStatus) saveStatus.textContent = "저장 중...";
                    clearTimeout(noteTimer);
                    noteTimer = setTimeout(() => {
                        const db = Storage.load();
                        db.sessionNotes = notesTextarea.value;
                        Storage.save(db);
                        if (saveStatus) saveStatus.textContent = "자동 저장됨";
                    }, 500);
                });
            }

            // 비진입 모달
            const btnSkipLog = container.querySelector('#btn-quick-skip-log');
            if (btnSkipLog) {
                btnSkipLog.addEventListener('click', () => {
                    this.showSkipLogModal(container);
                });
            }

            // 핵심 과제 수정
            const btnEditFocus = container.querySelector('#btn-edit-next-focus');
            if (btnEditFocus) {
                btnEditFocus.addEventListener('click', () => {
                    const db = Storage.load();
                    const current = db.profile.nextFocusTask || "";
                    const promptVal = prompt("오늘 집중할 단 하나의 원칙 과제를 입력하세요:", current);
                    if (promptVal !== null) {
                        db.profile.nextFocusTask = promptVal.trim();
                        Storage.save(db);
                        this.renderToday(container);
                    }
                });
            }
        },

        // 비진입 기록 모달
        showSkipLogModal(container) {
            const modal = document.createElement('div');
            modal.className = 'tw-modal-overlay';
            modal.innerHTML = `
                <div class="tw-modal">
                    <div class="tw-modal-header">
                        <h3><i class="ph ph-hand-palm" style="color:var(--pos);"></i> 뇌동 방지 비진입 기록</h3>
                        <button class="tw-icon-btn btn-close-modal"><i class="ph ph-x"></i></button>
                    </div>
                    <div class="tw-modal-body">
                        <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
                            충동적으로 매수하고 싶었지만 원칙에 의해 진입을 참은 이유를 기록하세요.
                        </p>
                        <div class="tw-form-group">
                            <label>종목명 <span class="req">*</span></label>
                            <div class="tw-input-wrapper">
                                <input type="text" id="modal-skip-stock" placeholder="예: 삼천당제약">
                            </div>
                        </div>
                        <div class="tw-form-group">
                            <label>원래 진입하려 했던 유혹/이유</label>
                            <div class="tw-input-wrapper">
                                <input type="text" id="modal-skip-intent" placeholder="예: 급등 vi 발동 후 호가창에 거래량이 몰려서">
                            </div>
                        </div>
                        <div class="tw-form-group">
                            <label>매수를 참아낸 원칙적 이유 <span class="req">*</span></label>
                            <textarea class="tw-note-textarea" id="modal-skip-reason" placeholder="예: 당일 손절폭 대비 기대 손익비가 1:1도 안 나오는 위험한 추격 자리였음."></textarea>
                        </div>
                    </div>
                    <div class="tw-modal-footer">
                        <button class="tw-btn tw-btn-secondary btn-close-modal">취소</button>
                        <button class="tw-btn tw-btn-primary" id="btn-save-skip">비진입 결정 저장</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const closeModal = () => modal.remove();
            modal.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', closeModal));

            const saveBtn = modal.querySelector('#btn-save-skip');
            saveBtn.addEventListener('click', () => {
                const stock = modal.querySelector('#modal-skip-stock').value.trim();
                const intent = modal.querySelector('#modal-skip-intent').value.trim();
                const reason = modal.querySelector('#modal-skip-reason').value.trim();

                if (!stock || !reason) {
                    alert("종목명과 참아낸 이유는 필수 입력입니다.");
                    return;
                }

                const db = Storage.load();
                db.skipLogs = db.skipLogs || [];
                db.skipLogs.unshift({
                    id: "skip-" + Date.now(),
                    date: new Date().toISOString().split('T')[0],
                    stockName: stock,
                    intendedSetup: intent,
                    reason: reason,
                    marketContext: ""
                });
                Storage.save(db);
                alert("비진입 결정이 성공적으로 기록되었습니다! 원칙 준수 훌륭합니다.");
                closeModal();
            });
        },

        // 2. 국내 주식 포지션 & 비중 계산기 (Risk Calculator View)
        renderCalculator(container, initialParams = {}) {
            const db = Storage.load();
            const profile = db.profile || {};

            const defaultCapital = initialParams.capital || profile.accountBalance || 10000000;
            const defaultRisk = initialParams.riskValue || profile.defaultRiskPercent || 1.0;
            const defaultEntry = initialParams.entryPrice || "";
            const defaultStop = initialParams.stopLoss || "";
            const defaultTarget = initialParams.targetPrice || "";
            const defaultStock = initialParams.stockName || "원익IPS";

            container.innerHTML = `
                <div class="tw-header">
                    <div class="tw-header-left">
                        <div class="tw-eyebrow"><i class="ph ph-shield"></i> RISK MANAGEMENT</div>
                        <h1>국내 주식 포지션 & 비중 계산기</h1>
                        <p class="tw-desc">"진입보다 먼저, 1회 거래에 감수할 최대 허용 손실(1R)을 정하세요."</p>
                    </div>
                    <div class="tw-header-right">
                        <button class="tw-btn tw-btn-secondary tw-btn-sm" id="btn-reset-calc">
                            <i class="ph ph-arrows-counter-clockwise"></i> 초기화
                        </button>
                    </div>
                </div>

                <div class="tw-calc-grid">
                    <!-- 좌측 입력 폼 -->
                    <div class="tw-calc-form-container">
                        <div class="tw-section-card">
                            <div class="tw-section-title">
                                <h3><i class="ph ph-sliders-horizontal"></i> 계좌 및 거래 조건 입력</h3>
                            </div>

                            <div class="tw-input-grid-2">
                                <div class="tw-form-group">
                                    <label>시장 구분</label>
                                    <div class="tw-input-wrapper">
                                        <select id="calc-market">
                                            <option value="KOSPI">코스피 (KOSPI)</option>
                                            <option value="KOSDAQ" selected>코스닥 (KOSDAQ)</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="tw-form-group">
                                    <label>종목명 (또는 종목코드)</label>
                                    <div class="tw-input-wrapper">
                                        <input type="text" id="calc-stock-name" value="${defaultStock}" placeholder="예: 원익IPS">
                                    </div>
                                </div>
                            </div>

                            <div class="tw-form-group">
                                <label>총 계좌 예수금 (KRW) <span class="req">*</span></label>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="calc-capital" value="${defaultCapital}" step="100000">
                                    <span class="tw-input-unit">원</span>
                                </div>
                            </div>

                            <div class="tw-form-group">
                                <label>1회 거래당 최대 허용 손실 (1R)</label>
                                <div class="tw-toggle-group">
                                    <button class="tw-toggle-btn active" data-mode="percent" id="btn-mode-pct">계좌 비율 (%)</button>
                                    <button class="tw-toggle-btn" data-mode="fixed" id="btn-mode-fixed">고정 금액 (원)</button>
                                </div>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="calc-risk-val" value="${defaultRisk}" step="0.5">
                                    <span class="tw-input-unit" id="calc-risk-unit">%</span>
                                </div>
                                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                                    * 실전 매매에서는 1회 거래당 계좌의 1% ~ 2% 이내 손실 설정을 강력히 권장합니다.
                                </div>
                            </div>

                            <hr style="border:none; border-top:1px solid rgba(255,255,255,0.06); margin: 20px 0;">

                            <div class="tw-input-grid-3">
                                <div class="tw-form-group">
                                    <label>매수 예정가 (진입가) <span class="req">*</span></label>
                                    <div class="tw-input-wrapper">
                                        <input type="number" id="calc-entry-price" value="${defaultEntry}" placeholder="예: 32800" step="100">
                                        <span class="tw-input-unit">원</span>
                                    </div>
                                </div>
                                <div class="tw-form-group">
                                    <label>원칙 손절가 <span class="req">*</span></label>
                                    <div class="tw-input-wrapper">
                                        <input type="number" id="calc-stop-loss" value="${defaultStop}" placeholder="예: 31800" step="100">
                                        <span class="tw-input-unit">원</span>
                                    </div>
                                </div>
                                <div class="tw-form-group">
                                    <label>목표 익절가 (1차)</label>
                                    <div class="tw-input-wrapper">
                                        <input type="number" id="calc-target-price" value="${defaultTarget}" placeholder="예: 35500" step="100">
                                        <span class="tw-input-unit">원</span>
                                    </div>
                                </div>
                            </div>

                            <div class="tw-form-group" style="margin-bottom:0;">
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                    <input type="checkbox" id="calc-include-fees" checked>
                                    <span>국내 주식 세금(0.18%) 및 위탁수수료(0.015%) 실질 손익 반영</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- 우측 결과창 (YOUR POSITION) -->
                    <div class="tw-calc-result-container">
                        <div class="tw-calc-result-card" id="calc-result-box">
                            <!-- JS 실시간 렌더링 -->
                        </div>
                    </div>
                </div>
            `;

            this.bindCalcEvents(container);
        },

        bindCalcEvents(container) {
            let riskMode = 'percent';

            const capitalInput = container.querySelector('#calc-capital');
            const riskValInput = container.querySelector('#calc-risk-val');
            const riskUnit = container.querySelector('#calc-risk-unit');
            const entryInput = container.querySelector('#calc-entry-price');
            const stopInput = container.querySelector('#calc-stop-loss');
            const targetInput = container.querySelector('#calc-target-price');
            const feeCheck = container.querySelector('#calc-include-fees');
            const resultBox = container.querySelector('#calc-result-box');

            const btnPct = container.querySelector('#btn-mode-pct');
            const btnFixed = container.querySelector('#btn-mode-fixed');

            btnPct.addEventListener('click', () => {
                riskMode = 'percent';
                btnPct.classList.add('active');
                btnFixed.classList.remove('active');
                riskUnit.textContent = "%";
                riskValInput.value = "1.0";
                recalc();
            });

            btnFixed.addEventListener('click', () => {
                riskMode = 'fixed';
                btnFixed.classList.add('active');
                btnPct.classList.remove('active');
                riskUnit.textContent = "원";
                riskValInput.value = "100000";
                recalc();
            });

            const recalc = () => {
                const params = {
                    capital: capitalInput.value,
                    riskMode: riskMode,
                    riskValue: riskValInput.value,
                    entryPrice: entryInput.value,
                    stopLoss: stopInput.value,
                    targetPrice: targetInput.value,
                    includeFees: feeCheck.checked
                };

                const res = Calculator.calculate(params);
                if (!res || res.error) {
                    resultBox.innerHTML = `
                        <div style="text-align:center; padding: 30px 10px;">
                            <div class="tw-calc-hero-badge"><i class="ph ph-shield"></i> POSITION SIZING</div>
                            <h3 style="font-size:16px; margin: 12px 0 6px; color:#fff;">진입보다 먼저, 리스크를 정하세요</h3>
                            <p style="font-size:12px; color:var(--text-muted); line-height:1.5;">
                                ${res && res.error ? `<span style="color:var(--pos);">${res.error}</span>` : '예수금, 매수가, 손절가를 입력하면 계좌 기준 최적의 매수 주수와 손익비를 계산합니다.'}
                            </p>
                            <div style="margin-top:20px; font-size:11px; color:var(--text-muted); background:rgba(255,255,255,0.03); padding:10px; border-radius:6px;">
                                계산 공식: 허용 손실금(1R) ÷ 1주당 손절폭 = 매수 수량(주)
                            </div>
                        </div>
                    `;
                    return;
                }

                resultBox.innerHTML = `
                    <div class="tw-calc-hero-badge"><i class="ph ph-check-circle"></i> 계산 완료 • 추천 포지션</div>
                    <h3 style="font-size:18px; color:#fff; margin-bottom:14px;">
                        ${container.querySelector('#calc-stock-name').value || '선택 종목'}
                    </h3>

                    <div class="tw-calc-result-row highlight">
                        <span class="k" style="font-weight:700; color:#fff;">추천 매수 수량</span>
                        <span class="v">${res.shares.toLocaleString()} 주</span>
                    </div>

                    <div class="tw-calc-result-row">
                        <span class="k">총 매수 금액 (계좌 비중)</span>
                        <span class="v">${formatKRW(res.totalCost)} (${formatNumber(res.portfolioPercent, 1)}%)</span>
                    </div>

                    <div class="tw-calc-result-row">
                        <span class="k">1주당 손절폭</span>
                        <span class="v neg">-${formatKRW(res.lossPerShare)} (-${formatNumber(res.lossPercent, 2)}%)</span>
                    </div>

                    <div class="tw-calc-result-row">
                        <span class="k">손절 시 최대 손실 (1R)</span>
                        <span class="v neg">-${formatKRW(res.allowedRisk)}</span>
                    </div>

                    ${res.rrRatio > 0 ? `
                        <div class="tw-calc-result-row">
                            <span class="k">목표 손익비 (RR)</span>
                            <span class="v ${res.rrRatio >= 2 ? 'pos' : ''}"><strong>1 : ${formatNumber(res.rrRatio, 2)}</strong></span>
                        </div>
                        <div class="tw-calc-result-row">
                            <span class="k">목표 익절 시 예상 수익</span>
                            <span class="v pos">+${formatKRW(res.targetProfit)} (+${formatNumber(res.rrRatio, 2)}R)</span>
                        </div>
                    ` : ''}

                    ${res.feeCost > 0 ? `
                        <div class="tw-calc-result-row">
                            <span class="k">예상 세금 및 수수료</span>
                            <span class="v" style="color:var(--text-muted); font-size:12px;">약 ${formatKRW(res.feeCost)}</span>
                        </div>
                    ` : ''}

                    <!-- 경고 목록 -->
                    ${res.warnings.map(w => `
                        <div class="tw-alert-box tw-alert-warning">
                            <div>${w}</div>
                        </div>
                    `).join('')}

                    <div style="margin-top:20px;">
                        <button class="tw-btn tw-btn-primary" style="width:100%;" id="btn-apply-to-plan">
                            <i class="ph ph-file-plus"></i> 이 계산으로 시나리오 작성하기
                        </button>
                    </div>
                `;

                // 시나리오 연계 버튼
                const applyBtn = resultBox.querySelector('#btn-apply-to-plan');
                if (applyBtn) {
                    applyBtn.addEventListener('click', () => {
                        window.TraderRoom.navigate('trader-plan', {
                            action: 'newFromCalc',
                            calcData: {
                                stockName: container.querySelector('#calc-stock-name').value,
                                market: container.querySelector('#calc-market').value,
                                entryPrice: parseFloat(entryInput.value),
                                stopLoss: parseFloat(stopInput.value),
                                targetPrice: parseFloat(targetInput.value),
                                shares: res.shares,
                                capital: parseFloat(capitalInput.value),
                                riskAmount: res.allowedRisk,
                                totalAmount: res.totalCost,
                                portfolioPercent: res.portfolioPercent,
                                rrRatio: res.rrRatio
                            }
                        });
                    });
                }
            };

            // 입력 변경 시 실시간 재계산
            [capitalInput, riskValInput, entryInput, stopInput, targetInput].forEach(inp => {
                inp.addEventListener('input', recalc);
            });
            feeCheck.addEventListener('change', recalc);

            // 초기 실행
            if (entryInput.value && stopInput.value) recalc();
            else recalc();

            // 초기화 버튼
            const resetBtn = container.querySelector('#btn-reset-calc');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    entryInput.value = "";
                    stopInput.value = "";
                    targetInput.value = "";
                    recalc();
                });
            }
        },

        // 3. 매매 시나리오 (Trade Plan View)
        renderPlan(container, options = {}) {
            const db = Storage.load();
            const plans = db.plans || [];

            // 작성 모달/화면 토글
            if (options.action === 'new' || options.action === 'newFromCalc') {
                this.renderPlanEditor(container, options.calcData || null);
                return;
            }

            if (options.viewPlanId) {
                const target = plans.find(p => p.id === options.viewPlanId);
                if (target) {
                    this.renderPlanDetail(container, target);
                    return;
                }
            }

            container.innerHTML = `
                <div class="tw-header">
                    <div class="tw-header-left">
                        <div class="tw-eyebrow"><i class="ph ph-notepad"></i> TRADE PLAN</div>
                        <h1>매매 시나리오 수립</h1>
                        <p class="tw-desc">"시나리오와 무효화(손절) 기준을 정하고, 실행 전 계획을 먼저 잠그세요."</p>
                    </div>
                    <div class="tw-header-right">
                        <button class="tw-btn tw-btn-primary tw-btn-sm" id="btn-create-plan">
                            <i class="ph ph-plus-circle"></i> + 새 매매 시나리오
                        </button>
                    </div>
                </div>

                <div class="tw-section-card">
                    <div class="tw-section-title">
                        <h3><i class="ph ph-list-dashes"></i> 작성된 매매 시나리오 목록 (${plans.length}건)</h3>
                    </div>

                    ${plans.length === 0 ? `
                        <div class="tw-empty-box">
                            <i class="ph ph-notepad"></i>
                            아직 작성된 매매 시나리오가 없습니다.<br>
                            우측 상단의 [+ 새 매매 시나리오] 버튼을 눌러 첫 계획을 작성해보세요.
                        </div>
                    ` : `
                        <table class="tw-table">
                            <thead>
                                <tr>
                                    <th>종목명</th>
                                    <th>시장</th>
                                    <th>셋업 전략</th>
                                    <th>포지션</th>
                                    <th>목표 손익비</th>
                                    <th>버전</th>
                                    <th>상태</th>
                                    <th>관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${plans.map(p => `
                                    <tr>
                                        <td>
                                            <strong style="color:#fff;">${p.stockName}</strong>
                                            <div style="font-size:11px; color:var(--text-muted);">${p.stockCode || ''}</div>
                                        </td>
                                        <td>${p.market || '국내주식'}</td>
                                        <td>${p.setup || '-'}</td>
                                        <td><span class="tw-badge tw-badge-long">${p.direction || 'Long'}</span></td>
                                        <td><strong class="pos">1 : ${p.riskCalc ? formatNumber(p.riskCalc.rrRatio, 1) : '-'}</strong></td>
                                        <td><span style="font-size:12px; color:var(--text-muted);">${p.version || 'v1'}</span></td>
                                        <td>
                                            <select class="plan-status-select tw-input-wrapper" data-id="${p.id}" style="padding:4px 8px; font-size:12px; width:auto; display:inline-block;">
                                                <option value="초안" ${p.status === '초안' ? 'selected' : ''}>초안</option>
                                                <option value="진행중" ${p.status === '진행중' ? 'selected' : ''}>진행중</option>
                                                <option value="완료" ${p.status === '완료' ? 'selected' : ''}>완료</option>
                                                <option value="취소" ${p.status === '취소' ? 'selected' : ''}>취소</option>
                                            </select>
                                        </td>
                                        <td>
                                            <button class="tw-btn tw-btn-secondary tw-btn-sm btn-view-plan" data-id="${p.id}">상세보기</button>
                                            <button class="tw-btn tw-btn-danger tw-btn-sm btn-del-plan" data-id="${p.id}"><i class="ph ph-trash"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            `;

            // 이벤트 바인딩
            const createBtn = container.querySelector('#btn-create-plan');
            if (createBtn) {
                createBtn.addEventListener('click', () => {
                    this.renderPlanEditor(container);
                });
            }

            container.querySelectorAll('.btn-view-plan').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const target = plans.find(p => p.id === id);
                    if (target) this.renderPlanDetail(container, target);
                });
            });

            container.querySelectorAll('.btn-del-plan').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (confirm("이 매매 시나리오를 삭제하시겠습니까?")) {
                        const id = btn.getAttribute('data-id');
                        const updated = Storage.load();
                        updated.plans = (updated.plans || []).filter(p => p.id !== id);
                        Storage.save(updated);
                        this.renderPlan(container);
                    }
                });
            });

            container.querySelectorAll('.plan-status-select').forEach(sel => {
                sel.addEventListener('change', () => {
                    const id = sel.getAttribute('data-id');
                    const updated = Storage.load();
                    const target = (updated.plans || []).find(p => p.id === id);
                    if (target) {
                        target.status = sel.value;
                        Storage.save(updated);
                    }
                });
            });
        },

        // 시나리오 작성기 (3단계 프로세스)
        renderPlanEditor(container, calcData = null) {
            container.innerHTML = `
                <div class="tw-header">
                    <div class="tw-header-left">
                        <div class="tw-eyebrow"><i class="ph ph-arrow-left"></i> <a href="#" id="link-back-plans" style="color:inherit; text-decoration:none;">시나리오 목록으로</a></div>
                        <h1>새 매매 시나리오 수립</h1>
                        <p class="tw-desc">"감정을 배제하고 진입 조건과 무효화 기준을 먼저 문서화하세요."</p>
                    </div>
                </div>

                <div class="tw-section-card">
                    <div class="tw-tab-nav" id="editor-tab-nav">
                        <div class="tw-tab-item active" data-tab="tab-plan-info">01. 시나리오 및 조건</div>
                        <div class="tw-tab-item" data-tab="tab-plan-risk">02. 리스크 & 비중 요약</div>
                        <div class="tw-tab-item" data-tab="tab-plan-lock">03. 원칙 체크 및 시나리오 잠금</div>
                    </div>

                    <!-- 탭 1: 시나리오 조건 -->
                    <div class="editor-tab-content" id="tab-plan-info">
                        <div class="tw-input-grid-2">
                            <div class="tw-form-group">
                                <label>시장 구분</label>
                                <div class="tw-input-wrapper">
                                    <select id="plan-market">
                                        <option value="KOSPI" ${calcData && calcData.market === 'KOSPI' ? 'selected' : ''}>코스피 (KOSPI)</option>
                                        <option value="KOSDAQ" ${calcData && calcData.market === 'KOSDAQ' ? 'selected' : ''}>코스닥 (KOSDAQ)</option>
                                    </select>
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>종목명 <span class="req">*</span></label>
                                <div class="tw-input-wrapper">
                                    <input type="text" id="plan-stock-name" value="${calcData ? calcData.stockName : ''}" placeholder="예: 원익IPS">
                                </div>
                            </div>
                        </div>

                        <div class="tw-input-grid-3">
                            <div class="tw-form-group">
                                <label>매매 타임프레임</label>
                                <div class="tw-input-wrapper">
                                    <select id="plan-timeframe">
                                        <option value="스윙 (1~2주)">스윙 (1~2주)</option>
                                        <option value="단기 데이트레이딩">단기 데이트레이딩</option>
                                        <option value="중장기 포지션">중장기 포지션</option>
                                    </select>
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>셋업 기법 모델</label>
                                <div class="tw-input-wrapper">
                                    <select id="plan-setup">
                                        <option value="눌림목 반등">눌림목 반등</option>
                                        <option value="신고가 돌파">신고가 돌파</option>
                                        <option value="박스권 하단 매수">박스권 하단 매수</option>
                                        <option value="거래대금 주도주 매매">거래대금 주도주 매매</option>
                                        <option value="52주 소외 테마 반등">52주 소외 테마 반등</option>
                                    </select>
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>주요 가격대 (Key Level)</label>
                                <div class="tw-input-wrapper">
                                    <input type="text" id="plan-key-level" placeholder="예: 32,500원 전고점 지지대">
                                </div>
                            </div>
                        </div>

                        <div class="tw-form-group">
                            <label>원칙 손절 기준 (무효화 조건) <span class="req">*</span></label>
                            <div class="tw-input-wrapper">
                                <input type="text" id="plan-invalidation" value="${calcData && calcData.stopLoss ? calcData.stopLoss + '원 이탈 시 손절' : ''}" placeholder="어떤 조건이나 가격을 이탈하면 시나리오를 폐기하고 손절할 것인가?">
                            </div>
                        </div>

                        <div class="tw-form-group">
                            <label>매수 확정 타점 (진입 트리거) <span class="req">*</span></label>
                            <div class="tw-input-wrapper">
                                <input type="text" id="plan-trigger" placeholder="예: 32,800원 부근 거래량 실린 5분봉 양봉 마감 시">
                            </div>
                        </div>

                        <div class="tw-form-group">
                            <label>매매 근거 / Thesis</label>
                            <textarea class="tw-note-textarea" id="plan-thesis" placeholder="진입 배경, 섹터 수급 동향, 기대 상승 요인 등을 구체적으로 서술하세요..."></textarea>
                        </div>
                    </div>

                    <!-- 탭 2: 리스크 요약 -->
                    <div class="editor-tab-content" id="tab-plan-risk" style="display:none;">
                        <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
                            리스크 계산기에서 계산된 결과를 입력하거나 직접 수치를 지정하세요.
                        </p>
                        <div class="tw-input-grid-3">
                            <div class="tw-form-group">
                                <label>매수 예정가 (원)</label>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="plan-calc-entry" value="${calcData ? calcData.entryPrice : ''}">
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>원칙 손절가 (원)</label>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="plan-calc-stop" value="${calcData ? calcData.stopLoss : ''}">
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>목표 익절가 (원)</label>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="plan-calc-target" value="${calcData ? calcData.targetPrice : ''}">
                                </div>
                            </div>
                        </div>
                        <div class="tw-input-grid-2">
                            <div class="tw-form-group">
                                <label>매수 수량 (주)</label>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="plan-calc-shares" value="${calcData ? calcData.shares : ''}">
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>목표 손익비 (RR)</label>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="plan-calc-rr" step="0.1" value="${calcData ? formatNumber(calcData.rrRatio, 1) : '2.0'}">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 탭 3: 시나리오 잠금 -->
                    <div class="editor-tab-content" id="tab-plan-lock" style="display:none;">
                        <div class="tw-alert-box tw-alert-warning" style="margin-bottom:20px;">
                            <div>
                                <strong>🔒 시나리오 불변성(Lock) 규칙</strong><br>
                                작성 완료 후 시나리오를 잠그면 원본 조건이 고정됩니다. 뇌동매매를 방지하기 위해 장중 임의 수정은 금지되며, 조건이 바뀌면 수정본(v2)을 생성해야 합니다.
                            </div>
                        </div>

                        <div class="tw-form-group">
                            <label>진입 전 필수 원칙 체크리스트</label>
                            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:16px;">
                                <label style="display:flex; align-items:center; gap:10px; margin-bottom:10px; cursor:pointer;">
                                    <input type="checkbox" id="chk-rule-1" checked>
                                    <span>상위 타임프레임(일봉/주봉) 추세와 순방향인가?</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:10px; margin-bottom:10px; cursor:pointer;">
                                    <input type="checkbox" id="chk-rule-2" checked>
                                    <span>손익비가 최소 1:2 이상 보장되는 자리인가?</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:10px; margin-bottom:10px; cursor:pointer;">
                                    <input type="checkbox" id="chk-rule-3" checked>
                                    <span>1회 거래 허용 손실(1R)을 초과하지 않는 비중인가?</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                                    <input type="checkbox" id="chk-rule-4" checked>
                                    <span>충동이나 조급함이 아닌, 사전에 준비된 타점인가?</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:24px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.08);">
                        <button class="tw-btn tw-btn-secondary" id="btn-cancel-editor">취소</button>
                        <button class="tw-btn tw-btn-primary" id="btn-save-plan">
                            <i class="ph ph-lock-key"></i> 계획 확정 및 잠금(Commit)
                        </button>
                    </div>
                </div>
            `;

            // 탭 전환
            const nav = container.querySelector('#editor-tab-nav');
            nav.querySelectorAll('.tw-tab-item').forEach(tab => {
                tab.addEventListener('click', () => {
                    nav.querySelectorAll('.tw-tab-item').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const targetId = tab.getAttribute('data-tab');
                    container.querySelectorAll('.editor-tab-content').forEach(c => c.style.display = 'none');
                    container.querySelector('#' + targetId).style.display = 'block';
                });
            });

            // 뒤로가기 & 취소
            const backBtn = container.querySelector('#link-back-plans');
            const cancelBtn = container.querySelector('#btn-cancel-editor');
            const goBack = () => this.renderPlan(container);
            if (backBtn) backBtn.addEventListener('click', (e) => { e.preventDefault(); goBack(); });
            if (cancelBtn) cancelBtn.addEventListener('click', goBack);

            // 계획 저장
            const saveBtn = container.querySelector('#btn-save-plan');
            saveBtn.addEventListener('click', () => {
                const stockName = container.querySelector('#plan-stock-name').value.trim();
                const invalidation = container.querySelector('#plan-invalidation').value.trim();
                const trigger = container.querySelector('#plan-trigger').value.trim();

                if (!stockName || !invalidation || !trigger) {
                    alert("종목명, 손절 기준(무효화), 매수 타점은 필수 입력 항목입니다.");
                    return;
                }

                const newPlan = {
                    id: "plan-" + Date.now(),
                    createdAt: new Date().toISOString(),
                    market: container.querySelector('#plan-market').value,
                    stockName: stockName,
                    stockCode: "",
                    direction: "Long",
                    timeframe: container.querySelector('#plan-timeframe').value,
                    setup: container.querySelector('#plan-setup').value,
                    keyLevel: container.querySelector('#plan-key-level').value,
                    invalidation: invalidation,
                    entryTrigger: trigger,
                    thesis: container.querySelector('#plan-thesis').value,
                    version: "v1",
                    status: "진행중",
                    locked: true,
                    checklist: [
                        { label: "상위 추세 순방향", checked: container.querySelector('#chk-rule-1').checked },
                        { label: "손익비 1:2 이상", checked: container.querySelector('#chk-rule-2').checked },
                        { label: "1R 리스크 한도 준수", checked: container.querySelector('#chk-rule-3').checked },
                        { label: "충동 배제 타점", checked: container.querySelector('#chk-rule-4').checked }
                    ],
                    riskCalc: {
                        entryPrice: parseFloat(container.querySelector('#plan-calc-entry').value) || 0,
                        stopLoss: parseFloat(container.querySelector('#plan-calc-stop').value) || 0,
                        targetPrice: parseFloat(container.querySelector('#plan-calc-target').value) || 0,
                        shares: parseInt(container.querySelector('#plan-calc-shares').value, 10) || 0,
                        rrRatio: parseFloat(container.querySelector('#plan-calc-rr').value) || 0
                    }
                };

                const db = Storage.load();
                db.plans = db.plans || [];
                db.plans.unshift(newPlan);
                Storage.save(db);

                alert("매매 시나리오가 확정 및 잠금되었습니다! 원칙대로 차분하게 대응하세요.");
                this.renderPlan(container);
            });
        },

        // 시나리오 상세 보기
        renderPlanDetail(container, plan) {
            container.innerHTML = `
                <div class="tw-header">
                    <div class="tw-header-left">
                        <div class="tw-eyebrow"><i class="ph ph-arrow-left"></i> <a href="#" id="link-back-plans" style="color:inherit; text-decoration:none;">시나리오 목록으로</a></div>
                        <h1>${plan.stockName} 매매 시나리오 상세 (${plan.version || 'v1'})</h1>
                        <p class="tw-desc">작성일시: ${new Date(plan.createdAt).toLocaleString()} | 상태: <strong style="color:#fff;">${plan.status}</strong></p>
                    </div>
                    <div class="tw-header-right">
                        <button class="tw-btn tw-btn-primary tw-btn-sm" id="btn-convert-to-journal">
                            <i class="ph ph-arrow-fat-right"></i> 실제 체결 및 일지 기록으로 전환
                        </button>
                    </div>
                </div>

                <div class="tw-section-card">
                    <div class="tw-alert-box tw-alert-success" style="margin-bottom:20px;">
                        <div>🔒 <strong>계획 잠금 활성화됨:</strong> 뇌동매매 방지를 위해 원본 시나리오는 수정할 수 없습니다.</div>
                    </div>

                    <div class="tw-calc-result-row">
                        <span class="k">시장 / 전략 기법</span>
                        <span class="v">${plan.market} | ${plan.setup}</span>
                    </div>
                    <div class="tw-calc-result-row">
                        <span class="k">타임프레임</span>
                        <span class="v">${plan.timeframe}</span>
                    </div>
                    <div class="tw-calc-result-row">
                        <span class="k">주요 가격대 (Key Level)</span>
                        <span class="v">${plan.keyLevel || '-'}</span>
                    </div>
                    <div class="tw-calc-result-row highlight">
                        <span class="k" style="color:#fff; font-weight:700;">원칙 손절 기준 (무효화 조건)</span>
                        <span class="v" style="color:var(--pos);">${plan.invalidation}</span>
                    </div>
                    <div class="tw-calc-result-row">
                        <span class="k">매수 확정 타점 (진입 트리거)</span>
                        <span class="v">${plan.entryTrigger}</span>
                    </div>
                    ${plan.riskCalc ? `
                        <div class="tw-calc-result-row">
                            <span class="k">계획 수량 및 손익비</span>
                            <span class="v">${plan.riskCalc.shares ? plan.riskCalc.shares.toLocaleString() + '주' : '-'} (목표 손익비 1 : ${formatNumber(plan.riskCalc.rrRatio, 1)})</span>
                        </div>
                    ` : ''}

                    <div style="margin-top:20px;">
                        <h4 style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">매매 근거 / Thesis</h4>
                        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:14px; border-radius:8px; font-size:13px; line-height:1.5;">
                            ${plan.thesis ? plan.thesis.replace(/\n/g, '<br>') : '기록된 근거 없음'}
                        </div>
                    </div>
                </div>
            `;

            const backBtn = container.querySelector('#link-back-plans');
            if (backBtn) backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.renderPlan(container);
            });

            const convertBtn = container.querySelector('#btn-convert-to-journal');
            if (convertBtn) {
                convertBtn.addEventListener('click', () => {
                    window.TraderRoom.navigate('trader-journal', {
                        action: 'newFromPlan',
                        plan: plan
                    });
                });
            }
        },

        // 4. 매매일지 & 복기노트 (Trading Journal View)
        renderJournal(container, options = {}) {
            const db = Storage.load();
            const journal = db.journal || [];

            if (options.action === 'new' || options.action === 'newFromPlan') {
                this.renderJournalEditor(container, options.plan || null);
                return;
            }

            container.innerHTML = `
                <div class="tw-header">
                    <div class="tw-header-left">
                        <div class="tw-eyebrow"><i class="ph ph-book-open"></i> JOURNAL & REVIEW</div>
                        <h1>매매일지 & 복기노트</h1>
                        <p class="tw-desc">"솔직하게 기록하고, 차분하게 복기해야 비로소 성장합니다."</p>
                    </div>
                    <div class="tw-header-right">
                        <button class="tw-btn tw-btn-primary tw-btn-sm" id="btn-create-journal">
                            <i class="ph ph-plus-circle"></i> + 새 매매 기록
                        </button>
                    </div>
                </div>

                <div class="tw-tab-nav" id="journal-tab-nav">
                    <div class="tw-tab-item active" data-tab="tab-all-journal">전체 매매 (${journal.length}건)</div>
                    <div class="tw-tab-item" data-tab="tab-unreviewed">복기 대기 (${journal.filter(j => !j.reviewed).length}건)</div>
                    <div class="tw-tab-item" data-tab="tab-skip-logs">비진입 기록 (${(db.skipLogs || []).length}건)</div>
                    <div class="tw-tab-item" data-tab="tab-calendar">매매 캘린더</div>
                </div>

                <!-- 탭 1: 전체 매매 -->
                <div class="journal-tab-content" id="tab-all-journal">
                    <div class="tw-section-card">
                        ${journal.length === 0 ? `
                            <div class="tw-empty-box">
                                <i class="ph ph-book-open"></i>
                                아직 기록된 매매일지가 없습니다.<br>
                                [+ 새 매매 기록] 버튼을 눌러 첫 거래를 복기해보세요.
                            </div>
                        ` : `
                            <table class="tw-table">
                                <thead>
                                    <tr>
                                        <th>진입일 / 청산일</th>
                                        <th>종목명</th>
                                        <th>시장/셋업</th>
                                        <th>매수가 / 청산가</th>
                                        <th>수량</th>
                                        <th>실현 손익</th>
                                        <th>실현 R</th>
                                        <th>원칙 준수</th>
                                        <th>복기</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${journal.map(j => `
                                        <tr>
                                            <td>${j.entryDate} ~ ${j.exitDate || '-'}</td>
                                            <td><strong style="color:#fff;">${j.stockName}</strong></td>
                                            <td>${j.setup || '-'}</td>
                                            <td>${formatKRW(j.entryPrice)} → ${formatKRW(j.exitPrice)}</td>
                                            <td>${(j.shares || 0).toLocaleString()}주</td>
                                            <td class="${j.pnlAmount >= 0 ? 'pos' : 'neg'}"><strong>${j.pnlAmount >= 0 ? '+' : ''}${formatKRW(j.pnlAmount)}</strong></td>
                                            <td class="${j.realizedR >= 0 ? 'pos' : 'neg'}"><strong>${j.realizedR >= 0 ? '+' : ''}${formatNumber(j.realizedR, 2)}R</strong></td>
                                            <td>
                                                <span class="tw-badge ${j.ruleCompliance === 'Yes' ? 'tw-badge-status-active' : 'tw-badge-status-cancel'}">
                                                    ${j.ruleCompliance === 'Yes' ? '준수' : '미준수'}
                                                </span>
                                            </td>
                                            <td>
                                                <button class="tw-btn tw-btn-secondary tw-btn-sm btn-view-review" data-id="${j.id}">
                                                    ${j.reviewed ? '복기 보기' : '복기 작성'}
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>

                <!-- 탭 2: 복기 대기 -->
                <div class="journal-tab-content" id="tab-unreviewed" style="display:none;">
                    <div class="tw-section-card">
                        ${journal.filter(j => !j.reviewed).length === 0 ? `
                            <div class="tw-empty-box">
                                <i class="ph ph-check-circle" style="color:var(--pos);"></i>
                                모든 매매의 복기가 완료되었습니다! 성실한 복기는 트레이더의 가장 강력한 무기입니다.
                            </div>
                        ` : `
                            <table class="tw-table">
                                <thead>
                                    <tr>
                                        <th>청산일</th>
                                        <th>종목명</th>
                                        <th>실현 손익</th>
                                        <th>상태</th>
                                        <th>관리</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${journal.filter(j => !j.reviewed).map(j => `
                                        <tr>
                                            <td>${j.exitDate}</td>
                                            <td><strong style="color:#fff;">${j.stockName}</strong></td>
                                            <td class="${j.pnlAmount >= 0 ? 'pos' : 'neg'}">${j.pnlAmount >= 0 ? '+' : ''}${formatKRW(j.pnlAmount)}</td>
                                            <td><span class="tw-badge tw-badge-status-draft">복기 필요</span></td>
                                            <td>
                                                <button class="tw-btn tw-btn-primary tw-btn-sm btn-view-review" data-id="${j.id}">지금 복기하기</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>

                <!-- 탭 3: 비진입 기록 -->
                <div class="journal-tab-content" id="tab-skip-logs" style="display:none;">
                    <div class="tw-section-card">
                        <div class="tw-section-title">
                            <h3><i class="ph ph-hand-palm"></i> 뇌동매매 방지 비진입 기록</h3>
                            <button class="tw-btn tw-btn-secondary tw-btn-sm" id="btn-add-skip-journal">+ 비진입 기록</button>
                        </div>
                        ${(db.skipLogs || []).length === 0 ? `
                            <div class="tw-empty-box">
                                <i class="ph ph-shield"></i>
                                아직 기록된 비진입 사유가 없습니다.
                            </div>
                        ` : `
                            <table class="tw-table">
                                <thead>
                                    <tr>
                                        <th>일자</th>
                                        <th>종목명</th>
                                        <th>사려 했던 이유</th>
                                        <th>매수를 참은 원칙적 이유</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${db.skipLogs.map(s => `
                                        <tr>
                                            <td>${s.date}</td>
                                            <td><strong style="color:#fff;">${s.stockName}</strong></td>
                                            <td style="color:var(--text-muted);">${s.intendedSetup || '-'}</td>
                                            <td><strong>${s.reason}</strong></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>

                <!-- 탭 4: 매매 캘린더 -->
                <div class="journal-tab-content" id="tab-calendar" style="display:none;">
                    <div class="tw-section-card">
                        <div class="tw-calendar-header">
                            <h3 id="cal-month-title">${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월</h3>
                            <div style="font-size:12px; color:var(--text-muted);">
                                일자별 실현 손익 및 거래 횟수
                            </div>
                        </div>
                        <div class="tw-calendar-grid" id="calendar-grid-box">
                            <!-- 캘린더 동적 생성 -->
                        </div>
                    </div>
                </div>
            `;

            // 탭 이벤트
            const nav = container.querySelector('#journal-tab-nav');
            nav.querySelectorAll('.tw-tab-item').forEach(tab => {
                tab.addEventListener('click', () => {
                    nav.querySelectorAll('.tw-tab-item').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const targetId = tab.getAttribute('data-tab');
                    container.querySelectorAll('.journal-tab-content').forEach(c => c.style.display = 'none');
                    container.querySelector('#' + targetId).style.display = 'block';

                    if (targetId === 'tab-calendar') {
                        this.renderCalendarGrid(container.querySelector('#calendar-grid-box'), journal);
                    }
                });
            });

            const createBtn = container.querySelector('#btn-create-journal');
            if (createBtn) createBtn.addEventListener('click', () => this.renderJournalEditor(container));

            const skipBtn = container.querySelector('#btn-add-skip-journal');
            if (skipBtn) skipBtn.addEventListener('click', () => this.showSkipLogModal(container));

            // 복기 버튼
            container.querySelectorAll('.btn-view-review').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const target = journal.find(j => j.id === id);
                    if (target) this.showReviewModal(container, target);
                });
            });
        },

        // 매매일지 작성기
        renderJournalEditor(container, plan = null) {
            const todayStr = new Date().toISOString().split('T')[0];

            container.innerHTML = `
                <div class="tw-header">
                    <div class="tw-header-left">
                        <div class="tw-eyebrow"><i class="ph ph-arrow-left"></i> <a href="#" id="link-back-journal" style="color:inherit; text-decoration:none;">매매일지 목록으로</a></div>
                        <h1>실전 매매 기록 등록</h1>
                        <p class="tw-desc">체결된 거래의 매수가, 손절가, 청산가를 솔직하게 기록하세요.</p>
                    </div>
                </div>

                <div class="tw-section-card">
                    <div class="tw-input-grid-2">
                        <div class="tw-form-group">
                            <label>종목명 <span class="req">*</span></label>
                            <div class="tw-input-wrapper">
                                <input type="text" id="j-stock-name" value="${plan ? plan.stockName : ''}" placeholder="예: SK하이닉스">
                            </div>
                        </div>
                        <div class="tw-form-group">
                            <label>시장 구분</label>
                            <div class="tw-input-wrapper">
                                <select id="j-market">
                                    <option value="KOSPI">코스피 (KOSPI)</option>
                                    <option value="KOSDAQ">코스닥 (KOSDAQ)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="tw-input-grid-2">
                        <div class="tw-form-group">
                            <label>진입일자</label>
                            <div class="tw-input-wrapper">
                                <input type="date" id="j-entry-date" value="${todayStr}">
                            </div>
                        </div>
                        <div class="tw-form-group">
                            <label>청산일자</label>
                            <div class="tw-input-wrapper">
                                <input type="date" id="j-exit-date" value="${todayStr}">
                            </div>
                        </div>
                    </div>

                    <div class="tw-input-grid-3">
                        <div class="tw-form-group">
                            <label>실제 매수가 (원) <span class="req">*</span></label>
                            <div class="tw-input-wrapper">
                                <input type="number" id="j-entry-price" value="${plan && plan.riskCalc ? plan.riskCalc.entryPrice : ''}" placeholder="예: 185000">
                            </div>
                        </div>
                        <div class="tw-form-group">
                            <label>원칙 손절가 (1R 기준) <span class="req">*</span></label>
                            <div class="tw-input-wrapper">
                                <input type="number" id="j-stop-loss" value="${plan && plan.riskCalc ? plan.riskCalc.stopLoss : ''}" placeholder="예: 181000">
                            </div>
                        </div>
                        <div class="tw-form-group">
                            <label>실제 청산가 (원) <span class="req">*</span></label>
                            <div class="tw-input-wrapper">
                                <input type="number" id="j-exit-price" placeholder="예: 194000">
                            </div>
                        </div>
                    </div>

                    <div class="tw-input-grid-2">
                        <div class="tw-form-group">
                            <label>체결 수량 (주) <span class="req">*</span></label>
                            <div class="tw-input-wrapper">
                                <input type="number" id="j-shares" value="${plan && plan.riskCalc ? plan.riskCalc.shares : ''}" placeholder="예: 25">
                            </div>
                        </div>
                        <div class="tw-form-group">
                            <label>적용된 셋업 전략</label>
                            <div class="tw-input-wrapper">
                                <input type="text" id="j-setup" value="${plan ? plan.setup : ''}" placeholder="예: 신고점 돌파">
                            </div>
                        </div>
                    </div>

                    <div class="tw-form-group">
                        <label>원칙 준수 평가</label>
                        <div class="tw-toggle-group">
                            <button class="tw-toggle-btn active" data-rule="Yes" id="btn-rule-yes">원칙 완벽 준수 (Yes)</button>
                            <button class="tw-toggle-btn" data-rule="Partial" id="btn-rule-partial">일부 타협 (Partial)</button>
                            <button class="tw-toggle-btn" data-rule="No" id="btn-rule-no">원칙 미준수/뇌동 (No)</button>
                        </div>
                    </div>

                    <div class="tw-form-group">
                        <label>복기 메모 & 배운 점</label>
                        <textarea class="tw-note-textarea" id="j-notes" placeholder="진입 및 청산 과정에서의 심리 상태, 개선점 등을 기록하세요..."></textarea>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:24px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.08);">
                        <button class="tw-btn tw-btn-secondary" id="btn-cancel-journal">취소</button>
                        <button class="tw-btn tw-btn-primary" id="btn-save-journal">
                            <i class="ph ph-check"></i> 매매일지 저장
                        </button>
                    </div>
                </div>
            `;

            let ruleCompliance = 'Yes';
            const btnYes = container.querySelector('#btn-rule-yes');
            const btnPart = container.querySelector('#btn-rule-partial');
            const btnNo = container.querySelector('#btn-rule-no');

            [btnYes, btnPart, btnNo].forEach(btn => {
                btn.addEventListener('click', () => {
                    [btnYes, btnPart, btnNo].forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    ruleCompliance = btn.getAttribute('data-rule');
                });
            });

            const goBack = () => this.renderJournal(container);
            container.querySelector('#link-back-journal').addEventListener('click', (e) => { e.preventDefault(); goBack(); });
            container.querySelector('#btn-cancel-journal').addEventListener('click', goBack);

            container.querySelector('#btn-save-journal').addEventListener('click', () => {
                const stockName = container.querySelector('#j-stock-name').value.trim();
                const entryPrice = parseFloat(container.querySelector('#j-entry-price').value) || 0;
                const stopLoss = parseFloat(container.querySelector('#j-stop-loss').value) || 0;
                const exitPrice = parseFloat(container.querySelector('#j-exit-price').value) || 0;
                const shares = parseInt(container.querySelector('#j-shares').value, 10) || 0;

                if (!stockName || entryPrice <= 0 || stopLoss <= 0 || exitPrice <= 0 || shares <= 0) {
                    alert("모든 필수 가격(매수가, 손절가, 청산가)과 수량을 올바르게 입력해주세요.");
                    return;
                }

                const riskPerShare = entryPrice - stopLoss;
                const gainPerShare = exitPrice - entryPrice;
                const pnlAmount = shares * gainPerShare;
                const realizedR = riskPerShare > 0 ? (gainPerShare / riskPerShare) : 0;

                const newTrade = {
                    id: "journal-" + Date.now(),
                    entryDate: container.querySelector('#j-entry-date').value,
                    exitDate: container.querySelector('#j-exit-date').value,
                    stockName: stockName,
                    stockCode: "",
                    market: container.querySelector('#j-market').value,
                    setup: container.querySelector('#j-setup').value,
                    entryPrice: entryPrice,
                    exitPrice: exitPrice,
                    stopLoss: stopLoss,
                    shares: shares,
                    pnlAmount: pnlAmount,
                    realizedR: realizedR,
                    ruleCompliance: ruleCompliance,
                    mistakes: [],
                    notes: container.querySelector('#j-notes').value,
                    reviewed: true
                };

                const db = Storage.load();
                db.journal = db.journal || [];
                db.journal.unshift(newTrade);
                Storage.save(db);

                alert("매매일지가 성공적으로 저장되었습니다!");
                this.renderJournal(container);
            });
        },

        // 복기 상세/작성 모달
        showReviewModal(container, trade) {
            const modal = document.createElement('div');
            modal.className = 'tw-modal-overlay';
            modal.innerHTML = `
                <div class="tw-modal">
                    <div class="tw-modal-header">
                        <h3><i class="ph ph-note-pencil" style="color:var(--pos);"></i> 매매 복기: ${trade.stockName}</h3>
                        <button class="tw-icon-btn btn-close-modal"><i class="ph ph-x"></i></button>
                    </div>
                    <div class="tw-modal-body">
                        <div class="tw-calc-result-row">
                            <span class="k">실현 손익 / 실현 R</span>
                            <span class="v ${trade.pnlAmount >= 0 ? 'pos' : 'neg'}">
                                ${trade.pnlAmount >= 0 ? '+' : ''}${formatKRW(trade.pnlAmount)} (${formatNumber(trade.realizedR, 2)}R)
                            </span>
                        </div>
                        <div class="tw-calc-result-row">
                            <span class="k">매수가 → 청산가 (수량)</span>
                            <span class="v">${formatKRW(trade.entryPrice)} → ${formatKRW(trade.exitPrice)} (${trade.shares}주)</span>
                        </div>

                        <div class="tw-form-group" style="margin-top:16px;">
                            <label>반복된 실수 태그 (해당 사항 선택)</label>
                            <div style="display:flex; flex-wrap:wrap; gap:8px;" id="review-mistake-tags">
                                ${['추격 매수', '손절 지연', '조기 익절(공포)', '과도한 비중', '원칙 없는 뇌동진입', '장마감 전 충동매매', '물타기'].map(tag => `
                                    <button class="tw-btn tw-btn-secondary tw-btn-sm btn-tag ${(trade.mistakes || []).includes(tag) ? 'active' : ''}" data-tag="${tag}">
                                        ${tag}
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <div class="tw-form-group">
                            <label>이번 거래에서 배운 핵심 교훈 (Key Takeaway)</label>
                            <textarea class="tw-note-textarea" id="review-notes-input" placeholder="다음 매매를 위해 개선할 점을 솔직하게 기록하세요...">${trade.notes || ''}</textarea>
                        </div>
                    </div>
                    <div class="tw-modal-footer">
                        <button class="tw-btn tw-btn-secondary btn-close-modal">닫기</button>
                        <button class="tw-btn tw-btn-primary" id="btn-save-review-detail">복기 완료 저장</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', () => modal.remove()));

            // 태그 토글
            modal.querySelectorAll('.btn-tag').forEach(tagBtn => {
                tagBtn.addEventListener('click', () => {
                    tagBtn.classList.toggle('active');
                    if (tagBtn.classList.contains('active')) {
                        tagBtn.style.background = 'rgba(249, 77, 93, 0.2)';
                        tagBtn.style.borderColor = 'var(--pos)';
                    } else {
                        tagBtn.style.background = '';
                        tagBtn.style.borderColor = '';
                    }
                });
            });

            modal.querySelector('#btn-save-review-detail').addEventListener('click', () => {
                const activeTags = [];
                modal.querySelectorAll('.btn-tag.active').forEach(b => activeTags.push(b.getAttribute('data-tag')));
                const notes = modal.querySelector('#review-notes-input').value;

                const db = Storage.load();
                const target = (db.journal || []).find(j => j.id === trade.id);
                if (target) {
                    target.mistakes = activeTags;
                    target.notes = notes;
                    target.reviewed = true;
                    Storage.save(db);
                }
                modal.remove();
                this.renderJournal(container);
            });
        },

        // 매매 캘린더 그리드 렌더러
        renderCalendarGrid(container, journal) {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth(); // 0-indexed

            const firstDay = new Date(year, month, 1).getDay();
            const lastDate = new Date(year, month + 1, 0).getDate();

            // 일별 거래 맵 매핑
            const dateMap = {};
            journal.forEach(j => {
                const dateKey = j.exitDate || j.entryDate;
                if (dateKey) {
                    if (!dateMap[dateKey]) dateMap[dateKey] = [];
                    dateMap[dateKey].push(j);
                }
            });

            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            let html = dayNames.map(d => `<div class="tw-cal-day-name">${d}</div>`).join('');

            // 이전 달 빈칸
            for (let i = 0; i < firstDay; i++) {
                html += `<div class="tw-cal-cell other-month"></div>`;
            }

            // 이번 달 날짜들
            const todayDate = now.getDate();
            for (let d = 1; d <= lastDate; d++) {
                const monthStr = String(month + 1).padStart(2, '0');
                const dateStr = String(d).padStart(2, '0');
                const fullKey = `${year}-${monthStr}-${dateStr}`;
                const trades = dateMap[fullKey] || [];
                const isToday = d === todayDate;

                let dayNetR = 0;
                let dayPnL = 0;
                trades.forEach(t => {
                    dayNetR += (parseFloat(t.realizedR) || 0);
                    dayPnL += (parseFloat(t.pnlAmount) || 0);
                });

                html += `
                    <div class="tw-cal-cell ${isToday ? 'today' : ''}">
                        <div class="tw-cal-date-num">${d}</div>
                        ${trades.length > 0 ? `
                            <div class="tw-cal-trades-badge ${dayNetR >= 0 ? 'win' : 'loss'}">
                                ${trades.length}건 (${dayNetR >= 0 ? '+' : ''}${formatNumber(dayNetR, 1)}R)
                            </div>
                        ` : ''}
                    </div>
                `;
            }

            container.innerHTML = html;
        },

        // 5. 성과 분석실 (Performance Analytics View)
        renderAnalytics(container) {
            const db = Storage.load();
            const journal = db.journal || [];

            const totalTrades = journal.length;
            const wins = journal.filter(j => (j.pnlAmount || 0) > 0);
            const losses = journal.filter(j => (j.pnlAmount || 0) < 0);
            const winRate = totalTrades > 0 ? Math.round((wins.length / totalTrades) * 100) : 0;

            const netR = journal.reduce((acc, cur) => acc + (parseFloat(cur.realizedR) || 0), 0);
            const totalProfit = wins.reduce((acc, cur) => acc + (parseFloat(cur.pnlAmount) || 0), 0);
            const totalLoss = Math.abs(losses.reduce((acc, cur) => acc + (parseFloat(cur.pnlAmount) || 0), 0));
            const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : (totalProfit > 0 ? "∞" : "0.00");
            const expectancy = totalTrades > 0 ? (netR / totalTrades).toFixed(2) : "0.00";

            container.innerHTML = `
                <div class="tw-header">
                    <div class="tw-header-left">
                        <div class="tw-eyebrow"><i class="ph ph-chart-line-up"></i> PERFORMANCE & AUDIT</div>
                        <h1>매매 원칙 & 성과 분석실</h1>
                        <p class="tw-desc">"단순 손익을 넘어, 원칙 준수율과 기대값을 과학적으로 분석합니다."</p>
                    </div>
                </div>

                <!-- 6대 고정 KPI 카드 -->
                <div class="tw-analytics-grid-6">
                    <div class="tw-analytics-card">
                        <div class="title">누적 Net R</div>
                        <div class="number ${netR >= 0 ? 'pos' : 'neg'}">${netR >= 0 ? '+' : ''}${formatNumber(netR, 2)} R</div>
                    </div>
                    <div class="tw-analytics-card">
                        <div class="title">승률 (Win Rate)</div>
                        <div class="number">${winRate}%</div>
                    </div>
                    <div class="tw-analytics-card">
                        <div class="title">거래당 기대값 (Expectancy)</div>
                        <div class="number">${expectancy} R</div>
                    </div>
                    <div class="tw-analytics-card">
                        <div class="title">수익 팩터 (Profit Factor)</div>
                        <div class="number">${profitFactor}</div>
                    </div>
                    <div class="tw-analytics-card">
                        <div class="title">원칙 준수율</div>
                        <div class="number">${totalTrades > 0 ? Math.round((journal.filter(j=>j.ruleCompliance==='Yes').length / totalTrades)*100) : 100}%</div>
                    </div>
                    <div class="tw-analytics-card">
                        <div class="title">총 완료 매매</div>
                        <div class="number">${totalTrades}건</div>
                    </div>
                </div>

                <!-- 분석 인사이트 & 피드백 루프 -->
                <div class="tw-section-card">
                    <div class="tw-section-title">
                        <h3><i class="ph ph-lightbulb"></i> 핵심 인사이트 & 다음 집중 과제</h3>
                    </div>

                    <div class="tw-alert-box tw-alert-success" style="margin-bottom:20px;">
                        <div>
                            <strong>💡 다자바타 매매 진단:</strong>
                            ${totalTrades >= 3 ? 
                                `현재 ${totalTrades}건의 기록 분석 결과, 원칙 준수 거래(Yes)의 평균 손익비가 우수합니다. 실수를 줄이고 진입 전 1R 손익비를 사전 계산하는 루틴을 계속 유지하세요.` : 
                                `기록이 누적되면(최소 5건 이상) 반복된 실수 패턴과 유리한 셋업 기법을 자동으로 진단해 드립니다.`}
                        </div>
                    </div>

                    <div class="tw-form-group">
                        <label>다음 매매에서 반드시 개선할 단 하나의 과제 (Refine)</label>
                        <div style="display:flex; gap:10px;">
                            <input type="text" id="analytics-next-focus" class="tw-input-wrapper" style="flex:1;" value="${db.profile.nextFocusTask || ''}" placeholder="예: 뇌동 추격 매수 금지, 손절가 무조건 지키기">
                            <button class="tw-btn tw-btn-primary" id="btn-save-analytics-focus">집중 과제 저장</button>
                        </div>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:6px;">
                            * 여기에 저장된 과제는 '트레이딩 룸' 메인 상단 배너에 실시간으로 표시됩니다.
                        </div>
                    </div>
                </div>
            `;

            container.querySelector('#btn-save-analytics-focus').addEventListener('click', () => {
                const val = container.querySelector('#analytics-next-focus').value.trim();
                const db = Storage.load();
                db.profile.nextFocusTask = val;
                Storage.save(db);
                alert("다음 집중 과제가 성공적으로 저장되었습니다!");
            });
        },

        // 6. 데이터 보관함 & 설정 (Local-First Data Vault)
        renderVault(container) {
            const db = Storage.load();
            const plansCount = (db.plans || []).length;
            const journalCount = (db.journal || []).length;
            const skipCount = (db.skipLogs || []).length;

            container.innerHTML = `
                <div class="tw-header">
                    <div class="tw-header-left">
                        <div class="tw-eyebrow"><i class="ph ph-hard-drive"></i> DATA VAULT</div>
                        <h1>데이터 보관함 & 백업 설정</h1>
                        <p class="tw-desc">"기록은 오직 고객님의 브라우저 내부에만 안전하게 저장됩니다."</p>
                    </div>
                </div>

                <div class="tw-section-card">
                    <div class="tw-section-title">
                        <h3><i class="ph ph-shield-check"></i> 로컬 퍼스트(Local-First) 저장 상태</h3>
                    </div>

                    <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin-bottom:16px;">
                        다자바타 트레이더 룸은 개인의 민감한 자산 및 매매 내역을 외부 서버로 전송하지 않습니다.<br>
                        모든 데이터는 브라우저 내부 독립 저장소(LocalStorage)에 안전하게 보관됩니다.
                    </p>

                    <div class="tw-calc-result-row">
                        <span class="k">저장된 매매 시나리오</span>
                        <span class="v">${plansCount} 건</span>
                    </div>
                    <div class="tw-calc-result-row">
                        <span class="k">저장된 실전 매매일지</span>
                        <span class="v">${journalCount} 건</span>
                    </div>
                    <div class="tw-calc-result-row">
                        <span class="k">저장된 뇌동 방지 비진입 기록</span>
                        <span class="v">${skipCount} 건</span>
                    </div>

                    <div style="margin-top:20px;">
                        <button class="tw-btn tw-btn-secondary tw-btn-sm" id="btn-request-persist">
                            <i class="ph ph-lock-key"></i> 브라우저 영구 저장소 권한 요청
                        </button>
                    </div>
                </div>

                <div class="tw-section-card">
                    <div class="tw-section-title">
                        <h3><i class="ph ph-floppy-disk"></i> 데이터 백업 및 복구</h3>
                    </div>

                    <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin-bottom:16px;">
                        인터넷 사용 기록 삭제나 기기 변경 시에도 기록을 잃어버리지 않도록 정기적으로 JSON 백업 파일을 다운로드하세요.
                    </p>

                    <div style="display:flex; flex-wrap:wrap; gap:12px;">
                        <button class="tw-btn tw-btn-primary" id="btn-export-json">
                            <i class="ph ph-download-simple"></i> JSON 전체 백업 다운로드
                        </button>

                        <button class="tw-btn tw-btn-secondary" id="btn-export-csv">
                            <i class="ph ph-file-csv"></i> 엑셀용 CSV 매매일지 내보내기
                        </button>

                        <label class="tw-btn tw-btn-secondary" style="margin:0; cursor:pointer;">
                            <i class="ph ph-upload-simple"></i> JSON 백업 파일 복원
                            <input type="file" id="input-import-json" accept=".json" style="display:none;">
                        </label>
                    </div>
                </div>

                <div class="tw-section-card" style="border-color: rgba(249, 77, 93, 0.3);">
                    <div class="tw-section-title">
                        <h3 style="color:var(--pos);"><i class="ph ph-warning-octagon"></i> 데이터 초기화</h3>
                    </div>
                    <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
                        브라우저에 저장된 모든 매매 계획, 일지, 체크리스트를 완전히 삭제하고 초기 상태로 되돌립니다.
                    </p>
                    <button class="tw-btn tw-btn-danger tw-btn-sm" id="btn-reset-all">
                        <i class="ph ph-trash"></i> 모든 로컬 매매 데이터 삭제
                    </button>
                </div>
            `;

            container.querySelector('#btn-request-persist').addEventListener('click', () => Storage.requestPersist());
            container.querySelector('#btn-export-json').addEventListener('click', () => Storage.exportJSON());
            container.querySelector('#btn-export-csv').addEventListener('click', () => Storage.exportCSV());

            const fileInp = container.querySelector('#input-import-json');
            fileInp.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    Storage.importJSON(e.target.files[0], () => {
                        this.renderVault(container);
                    });
                }
            });

            container.querySelector('#btn-reset-all').addEventListener('click', () => {
                if (confirm("정말로 모든 로컬 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                    localStorage.removeItem(DB_KEY);
                    alert("모든 데이터가 초기화되었습니다.");
                    this.renderVault(container);
                }
            });
        }
    };

    // -------------------------------------------------------------
    // CONTROLLER & ROUTER
    // -------------------------------------------------------------
    window.TraderRoom = {
        currentView: 'trader-today',

        navigate(viewAction, params = {}) {
            this.currentView = viewAction;

            const workspace = document.getElementById('trader-workspace-container');
            const defaultView = document.getElementById('default-view-container');

            if (!workspace || !defaultView) return;

            // 기존 테마 테이블 뷰는 감추고, 트레이더 룸 표시
            defaultView.style.display = 'none';
            workspace.style.display = 'flex';

            // 사이드바 활성 상태 동기화
            document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active'));
            const activeMenuItem = document.querySelector(`.menu-section li[data-action="${viewAction}"]`);
            if (activeMenuItem) activeMenuItem.classList.add('active');

            // 뷰 렌더링
            switch (viewAction) {
                case 'trader-today':
                    Views.renderToday(workspace);
                    break;
                case 'trader-plan':
                    Views.renderPlan(workspace, params);
                    break;
                case 'trader-calc':
                    Views.renderCalculator(workspace, params);
                    break;
                case 'trader-journal':
                    Views.renderJournal(workspace, params);
                    break;
                case 'trader-analytics':
                    Views.renderAnalytics(workspace);
                    break;
                case 'trader-vault':
                    Views.renderVault(workspace);
                    break;
                default:
                    Views.renderToday(workspace);
            }
        }
    };

})();
