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
    // GLOBAL MULTI-ASSET SPECIFICATIONS & PRESETS
    // -------------------------------------------------------------
    const FUTURES_SPECS = {
        // 미국 지수선물 (CME / CBOT INDEX)
        NQ: {
            symbol: "NQ",
            name: "E-mini Nasdaq-100",
            category: "미국 지수선물 (INDEX)",
            pointValue: 20,
            tickSize: 0.25,
            tickValue: 5.0,
            currency: "USD",
            minContract: 1,
            samplePrice: 20450,
            desc: "CME E-mini 나스닥 100 지수 ($20/pt, 0.25tick=$5)"
        },
        MNQ: {
            symbol: "MNQ",
            name: "Micro E-mini Nasdaq-100",
            category: "미국 지수선물 (INDEX)",
            pointValue: 2,
            tickSize: 0.25,
            tickValue: 0.5,
            currency: "USD",
            minContract: 1,
            samplePrice: 20450,
            desc: "CME Micro E-mini 나스닥 100 ($2/pt, 0.25tick=$0.5)"
        },
        ES: {
            symbol: "ES",
            name: "E-mini S&P 500",
            category: "미국 지수선물 (INDEX)",
            pointValue: 50,
            tickSize: 0.25,
            tickValue: 12.5,
            currency: "USD",
            minContract: 1,
            samplePrice: 5850,
            desc: "CME E-mini S&P 500 ($50/pt, 0.25tick=$12.5)"
        },
        MES: {
            symbol: "MES",
            name: "Micro E-mini S&P 500",
            category: "미국 지수선물 (INDEX)",
            pointValue: 5,
            tickSize: 0.25,
            tickValue: 1.25,
            currency: "USD",
            minContract: 1,
            samplePrice: 5850,
            desc: "CME Micro E-mini S&P 500 ($5/pt, 0.25tick=$1.25)"
        },
        YM: {
            symbol: "YM",
            name: "E-mini Dow Jones ($5)",
            category: "미국 지수선물 (INDEX)",
            pointValue: 5,
            tickSize: 1.0,
            tickValue: 5.0,
            currency: "USD",
            minContract: 1,
            samplePrice: 43200,
            desc: "CBOT E-mini 다우존스 ($5/pt, 1.0tick=$5)"
        },
        MYM: {
            symbol: "MYM",
            name: "Micro E-mini Dow Jones",
            category: "미국 지수선물 (INDEX)",
            pointValue: 0.5,
            tickSize: 1.0,
            tickValue: 0.5,
            currency: "USD",
            minContract: 1,
            samplePrice: 43200,
            desc: "CBOT Micro E-mini 다우존스 ($0.5/pt, 1.0tick=$0.5)"
        },
        RTY: {
            symbol: "RTY",
            name: "E-mini Russell 2000",
            category: "미국 지수선물 (INDEX)",
            pointValue: 50,
            tickSize: 0.1,
            tickValue: 5.0,
            currency: "USD",
            minContract: 1,
            samplePrice: 2260,
            desc: "CME E-mini 러셀 2000 ($50/pt, 0.1tick=$5)"
        },
        M2K: {
            symbol: "M2K",
            name: "Micro E-mini Russell 2000",
            category: "미국 지수선물 (INDEX)",
            pointValue: 5,
            tickSize: 0.1,
            tickValue: 0.5,
            currency: "USD",
            minContract: 1,
            samplePrice: 2260,
            desc: "CME Micro E-mini 러셀 ($5/pt, 0.1tick=$0.5)"
        },

        // 귀금속 및 원자재/에너지 (METALS & COMMODITY)
        GC: {
            symbol: "GC",
            name: "Gold (금 선물)",
            category: "귀금속 & 에너지 (METALS & ENERGY)",
            pointValue: 100,
            tickSize: 0.1,
            tickValue: 10.0,
            currency: "USD",
            minContract: 1,
            samplePrice: 2720,
            desc: "COMEX 골드 선물 ($100/pt, 0.1tick=$10)"
        },
        MGC: {
            symbol: "MGC",
            name: "Micro Gold (마이크로 골드)",
            category: "귀금속 & 에너지 (METALS & ENERGY)",
            pointValue: 10,
            tickSize: 0.1,
            tickValue: 1.0,
            currency: "USD",
            minContract: 1,
            samplePrice: 2720,
            desc: "COMEX 마이크로 골드 ($10/pt, 0.1tick=$1)"
        },
        SI: {
            symbol: "SI",
            name: "Silver (은 선물)",
            category: "귀금속 & 에너지 (METALS & ENERGY)",
            pointValue: 5000,
            tickSize: 0.005,
            tickValue: 25.0,
            currency: "USD",
            minContract: 1,
            samplePrice: 33.5,
            desc: "COMEX 실버 선물 ($5,000/pt, 0.005tick=$25)"
        },
        SIL: {
            symbol: "SIL",
            name: "Micro Silver (마이크로 실버)",
            category: "귀금속 & 에너지 (METALS & ENERGY)",
            pointValue: 1000,
            tickSize: 0.005,
            tickValue: 5.0,
            currency: "USD",
            minContract: 1,
            samplePrice: 33.5,
            desc: "COMEX 마이크로 실버 ($1,000/pt, 0.005tick=$5)"
        },
        CL: {
            symbol: "CL",
            name: "Crude Oil (WTI 원유)",
            category: "귀금속 & 에너지 (METALS & ENERGY)",
            pointValue: 1000,
            tickSize: 0.01,
            tickValue: 10.0,
            currency: "USD",
            minContract: 1,
            samplePrice: 70.5,
            desc: "NYMEX WTI 크루드 오일 ($1,000/pt, 0.01tick=$10)"
        },
        MCL: {
            symbol: "MCL",
            name: "Micro WTI Crude Oil",
            category: "귀금속 & 에너지 (METALS & ENERGY)",
            pointValue: 100,
            tickSize: 0.01,
            tickValue: 1.0,
            currency: "USD",
            minContract: 1,
            samplePrice: 70.5,
            desc: "NYMEX 마이크로 WTI 원유 ($100/pt, 0.01tick=$1)"
        },
        NG: {
            symbol: "NG",
            name: "Natural Gas (천연가스)",
            category: "귀금속 & 에너지 (METALS & ENERGY)",
            pointValue: 10000,
            tickSize: 0.001,
            tickValue: 10.0,
            currency: "USD",
            minContract: 1,
            samplePrice: 2.85,
            desc: "NYMEX 천연가스 ($10,000/pt, 0.001tick=$10)"
        },

        // 통화 선물 (FX CURRENCY)
        "6E": {
            symbol: "6E",
            name: "Euro FX Futures",
            category: "통화 선물 (FX CURRENCY)",
            pointValue: 125000,
            tickSize: 0.00005,
            tickValue: 6.25,
            currency: "USD",
            minContract: 1,
            samplePrice: 1.0850,
            desc: "CME 유로/달러 통화선물 (1pt = $125,000, 1tick = $6.25)"
        },
        M6E: {
            symbol: "M6E",
            name: "Micro Euro FX Futures",
            category: "통화 선물 (FX CURRENCY)",
            pointValue: 12500,
            tickSize: 0.0001,
            tickValue: 1.25,
            currency: "USD",
            minContract: 1,
            samplePrice: 1.0850,
            desc: "CME 마이크로 유로/달러 (1pt = $12,500, 1tick = $1.25)"
        },
        "6B": {
            symbol: "6B",
            name: "British Pound Futures",
            category: "통화 선물 (FX CURRENCY)",
            pointValue: 62500,
            tickSize: 0.0001,
            tickValue: 6.25,
            currency: "USD",
            minContract: 1,
            samplePrice: 1.3050,
            desc: "CME 영국 파운드/달러 (1pt = $62,500, 1tick = $6.25)"
        },
        M6B: {
            symbol: "M6B",
            name: "Micro British Pound",
            category: "통화 선물 (FX CURRENCY)",
            pointValue: 6250,
            tickSize: 0.0002,
            tickValue: 1.25,
            currency: "USD",
            minContract: 1,
            samplePrice: 1.3050,
            desc: "CME 마이크로 영국 파운드 (1pt = $6,250, 1tick = $1.25)"
        },
        "6J": {
            symbol: "6J",
            name: "Japanese Yen Futures",
            category: "통화 선물 (FX CURRENCY)",
            pointValue: 12500000,
            tickSize: 0.0000005,
            tickValue: 6.25,
            currency: "USD",
            minContract: 1,
            samplePrice: 0.006700,
            desc: "CME 일본 엔화/달러 (1pt = $12.5M, 1tick = $6.25)"
        },

        // 금리 & 채권 (TREASURY)
        ZN: {
            symbol: "ZN",
            name: "10-Year T-Note (10년물 국채)",
            category: "금리 & 국채 (TREASURY)",
            pointValue: 1000,
            tickSize: 0.015625,
            tickValue: 15.625,
            currency: "USD",
            minContract: 1,
            samplePrice: 110.5,
            desc: "CBOT 미국 10년물 국채선물 ($1,000/pt)"
        }
    };

    const CRYPTO_SPECS = {
        BTCUSDT: { symbol: "BTCUSDT", name: "Bitcoin (BTC/USDT)", step: 0.001, minQty: 0.001, tickSize: 0.1, samplePrice: 68500 },
        ETHUSDT: { symbol: "ETHUSDT", name: "Ethereum (ETH/USDT)", step: 0.01, minQty: 0.01, tickSize: 0.01, samplePrice: 2650 },
        SOLUSDT: { symbol: "SOLUSDT", name: "Solana (SOL/USDT)", step: 0.1, minQty: 0.1, tickSize: 0.01, samplePrice: 155 },
        XRPUSDT: { symbol: "XRPUSDT", name: "Ripple (XRP/USDT)", step: 1, minQty: 1, tickSize: 0.0001, samplePrice: 0.54 },
        DOGEUSDT: { symbol: "DOGEUSDT", name: "Dogecoin (DOGE/USDT)", step: 10, minQty: 10, tickSize: 0.00001, samplePrice: 0.14 }
    };

    // -------------------------------------------------------------
    // GLOBAL MULTI-ASSET RISK CALCULATOR ENGINE
    // -------------------------------------------------------------
    const Calculator = {
        calculate(params) {
            const assetType = params.assetType || 'krx'; // 'krx', 'us', 'futures', 'crypto', 'custom'
            const capital = parseFloat(params.capital) || 0;
            const isPercent = params.riskMode === 'percent';
            const riskValue = parseFloat(params.riskValue) || 0;
            const entryPrice = parseFloat(params.entryPrice) || 0;
            const stopLoss = parseFloat(params.stopLoss) || 0;
            const targetPrice = parseFloat(params.targetPrice) || 0;
            const customMultiplier = parseFloat(params.customMultiplier) || 1;
            const customTickSize = parseFloat(params.customTickSize) || 0.01;
            const includeFees = !!params.includeFees;
            const userDirection = params.direction || 'auto'; // 'auto', 'Long', 'Short'

            if (capital <= 0 || entryPrice <= 0 || stopLoss <= 0) {
                return null;
            }

            // 포지션 방향 감지 (손절가가 진입가보다 낮으면 Long, 높으면 Short)
            let direction = 'Long';
            if (userDirection === 'Long' || userDirection === 'Short') {
                direction = userDirection;
            } else {
                direction = stopLoss < entryPrice ? 'Long' : 'Short';
            }

            // 방향 정합성 검증
            if (direction === 'Long' && stopLoss >= entryPrice) {
                return {
                    error: "롱(매수) 포지션은 원칙 손절가가 진입가보다 낮아야 합니다."
                };
            }
            if (direction === 'Short' && stopLoss <= entryPrice) {
                return {
                    error: "숏(매도) 포지션은 원칙 손절가가 진입가보다 높아야 합니다."
                };
            }

            // 1회 허용 손실금(1R)
            const allowedRisk = isPercent ? (capital * (riskValue / 100)) : riskValue;
            if (allowedRisk <= 0) return null;

            // 가격 변동폭
            const priceDiff = Math.abs(entryPrice - stopLoss);
            if (priceDiff <= 0) {
                return { error: "손절가는 진입 예정가와 동일할 수 없습니다." };
            }
            const lossPercent = (priceDiff / entryPrice) * 100;

            let multiplier = 1;
            let tickSize = 1;
            let tickValue = 1;
            let unitName = "주";

            if (assetType === 'krx') {
                multiplier = 1;
                tickSize = 1;
                tickValue = 1;
                unitName = "주";
            } else if (assetType === 'us') {
                multiplier = 1;
                tickSize = 0.01;
                tickValue = 0.01;
                unitName = "주";
            } else if (assetType === 'futures') {
                const spec = FUTURES_SPECS[params.futuresSymbol] || FUTURES_SPECS['NQ'];
                multiplier = spec.pointValue;
                tickSize = spec.tickSize;
                tickValue = spec.tickValue || (spec.pointValue * spec.tickSize);
                unitName = "계약";
            } else if (assetType === 'crypto') {
                const cSpec = CRYPTO_SPECS[params.cryptoSymbol] || CRYPTO_SPECS['BTCUSDT'];
                multiplier = 1;
                tickSize = cSpec.tickSize || 0.1;
                tickValue = tickSize;
                unitName = (params.cryptoSymbol || 'BTC').replace('USDT', '');
            } else if (assetType === 'custom') {
                multiplier = customMultiplier > 0 ? customMultiplier : 1;
                tickSize = customTickSize > 0 ? customTickSize : 0.01;
                tickValue = multiplier * tickSize;
                unitName = params.customUnit || "단위";
            }

            // 단위당(1주/1계약/1코인당) 손실액
            const lossPerUnit = priceDiff * multiplier;
            if (lossPerUnit <= 0) return null;

            // 적정 매수/매도 수량
            let qty = 0;
            let isFractional = false;
            if (assetType === 'krx' || assetType === 'futures' || assetType === 'custom') {
                qty = Math.floor(allowedRisk / lossPerUnit);
                if (qty < 1) qty = 0;
            } else if (assetType === 'us') {
                if (params.allowFractional) {
                    qty = parseFloat((allowedRisk / lossPerUnit).toFixed(3));
                    isFractional = true;
                } else {
                    qty = Math.floor(allowedRisk / lossPerUnit);
                }
            } else if (assetType === 'crypto') {
                qty = parseFloat((allowedRisk / lossPerUnit).toFixed(4));
                isFractional = true;
            }

            // 총 포지션 가치 (Notional Value)
            const notionalValue = qty * entryPrice * multiplier;
            const portfolioPercent = capital > 0 ? (notionalValue / capital) * 100 : 0;

            // 틱 계산
            const stopTicks = tickSize > 0 ? Math.round(priceDiff / tickSize) : 0;

            // 목표가 관련 손익비(RR Ratio)
            let gainPerUnit = 0;
            let gainPercent = 0;
            let targetProfit = 0;
            let rrRatio = 0;
            let targetTicks = 0;

            if (targetPrice > 0) {
                let targetDiff = 0;
                if (direction === 'Long') {
                    if (targetPrice > entryPrice) {
                        targetDiff = targetPrice - entryPrice;
                    }
                } else {
                    if (targetPrice < entryPrice) {
                        targetDiff = entryPrice - targetPrice;
                    }
                }

                if (targetDiff > 0) {
                    gainPerUnit = targetDiff * multiplier;
                    gainPercent = (targetDiff / entryPrice) * 100;
                    targetProfit = qty * gainPerUnit;
                    rrRatio = targetDiff / priceDiff;
                    targetTicks = tickSize > 0 ? Math.round(targetDiff / tickSize) : 0;
                }
            }

            // 수수료 및 거래세 계산
            let feeCost = 0;
            let netProfit = targetProfit;
            let netLoss = qty * lossPerUnit;

            if (includeFees && qty > 0) {
                if (assetType === 'krx') {
                    // 매수 0.015% + 매도 0.195% (거래세 0.18% + 수수료 0.015%)
                    const buyFee = notionalValue * 0.00015;
                    const targetSellFee = (qty * (targetPrice || entryPrice)) * 0.00195;
                    const stopSellFee = (qty * stopLoss) * 0.00195;
                    feeCost = buyFee + targetSellFee;
                    netProfit = Math.max(0, targetProfit - (buyFee + targetSellFee));
                    netLoss = (qty * lossPerUnit) + (buyFee + stopSellFee);
                } else if (assetType === 'futures') {
                    // 선물 계약당 왕복 수수료 (약 $4.5)
                    feeCost = qty * 4.5;
                    netProfit = Math.max(0, targetProfit - feeCost);
                    netLoss = (qty * lossPerUnit) + feeCost;
                } else if (assetType === 'us') {
                    feeCost = Math.max(1, notionalValue * 0.0005);
                    netProfit = Math.max(0, targetProfit - feeCost);
                    netLoss = (qty * lossPerUnit) + feeCost;
                } else if (assetType === 'crypto') {
                    // 코인 선물 거래 수수료 (왕복 0.08%)
                    feeCost = notionalValue * 0.0008;
                    netProfit = Math.max(0, targetProfit - feeCost);
                    netLoss = (qty * lossPerUnit) + feeCost;
                }
            }

            // 안전 경고 체크
            const warnings = [];
            if (qty === 0) {
                if (assetType === 'futures') {
                    warnings.push(`⚠️ 최소 1계약 손절액($${Math.round(lossPerUnit).toLocaleString()})이 1회 허용 리스크($${Math.round(allowedRisk).toLocaleString()})를 초과합니다.`);
                    const curSym = params.futuresSymbol || 'NQ';
                    if (!curSym.startsWith('M')) {
                        warnings.push(`💡 조치 권장: 1/10 크기인 마이크로(Micro) 상품(예: MNQ, MES, MGC, MCL)으로 변경하시면 안전하게 진입하실 수 있습니다.`);
                    } else {
                        warnings.push(`💡 조치 권장: 손절 가격폭을 좁히거나, 계좌 허용 리스크(%)를 현실적으로 조정하세요.`);
                    }
                } else {
                    warnings.push("⚠️ 1주당 손절폭이 1회 허용 리스크를 초과하여 최소 1주도 진입할 수 없습니다. 손절가를 좁히거나 허용 리스크를 조정하세요.");
                }
            }

            if (notionalValue > capital && (assetType === 'krx' || assetType === 'us')) {
                warnings.push("⚠️ 계좌 총 예수금을 초과하는 포지션 규모입니다! (미수/신용 위험 주의)");
            }
            if (targetPrice > 0 && rrRatio > 0 && rrRatio < 1.5) {
                warnings.push("⚠️ 목표 손익비가 1:1.5 미만입니다. 최소 1:2 이상의 유리한 자리를 기다리는 것을 권장합니다.");
            }
            if (lossPercent > 10 && (assetType === 'krx' || assetType === 'us')) {
                warnings.push("ℹ️ 1회 손절폭이 -10% 이상으로 큽니다. 진입 타점 및 변동성 대응을 점검해보세요.");
            }

            return {
                assetType,
                direction,
                allowedRisk,
                lossPerUnit,
                priceDiff,
                lossPercent,
                multiplier,
                tickSize,
                tickValue,
                stopTicks,
                targetTicks,
                qty,
                unitName,
                isFractional,
                notionalValue,
                portfolioPercent,
                gainPerUnit,
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

    function formatUSD(val, decimals = 2) {
        if (isNaN(val) || val === null || val === undefined) return "$0";
        return "$" + Number(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }

    function formatAssetVal(val, assetType, decimals = 2) {
        if (assetType === 'krx') return formatKRW(val);
        if (assetType === 'crypto') return Number(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " USDT";
        return formatUSD(val, decimals);
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
        calYear: new Date().getFullYear(),
        calMonth: new Date().getMonth(),
        currentJournalTab: 'tab-all-journal',

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

        // 2. 글로벌 멀티자산 포지션 & 리스크 계산기 (Multi-Asset Risk Calculator View)
        renderCalculator(container, initialParams = {}) {
            const db = Storage.load();
            const profile = db.profile || {};

            let currentAsset = initialParams.assetType || 'krx'; // 'krx', 'us', 'futures', 'crypto', 'custom'

            container.innerHTML = `
                <div class="tw-header">
                    <div class="tw-header-left">
                        <div class="tw-eyebrow"><i class="ph ph-shield-check"></i> DAJAVATA RISK & SIZING ENGINE</div>
                        <h1 id="calc-main-title">포지션 & 리스크 사이징 계산기</h1>
                        <p class="tw-desc">"진입 버튼을 누르기 전, 1회 거래에 감수할 최대 손실(1R)과 최적 계약/주수를 확정하세요."</p>
                    </div>
                    <div class="tw-header-right">
                        <button class="tw-btn tw-btn-secondary tw-btn-sm" id="btn-reset-calc">
                            <i class="ph ph-arrows-counter-clockwise"></i> 초기화
                        </button>
                    </div>
                </div>

                <!-- 자산군 선택 세그먼트 (복붙 방지 다자바타 독자 탭) -->
                <div class="tw-market-tabs" id="calc-market-tabs">
                    <button class="tw-market-tab-btn active" data-asset="krx">
                        <span class="flag">🇰🇷</span>
                        <span class="name">국내 주식</span>
                        <span class="sub">KRX · 원화</span>
                    </button>
                    <button class="tw-market-tab-btn" data-asset="us">
                        <span class="flag">🇺🇸</span>
                        <span class="name">미국 주식</span>
                        <span class="sub">US Equity · USD</span>
                    </button>
                    <button class="tw-market-tab-btn" data-asset="futures">
                        <span class="flag">🌐</span>
                        <span class="name">해외선물 (CME)</span>
                        <span class="sub">Futures · 승수/틱</span>
                    </button>
                    <button class="tw-market-tab-btn" data-asset="crypto">
                        <span class="flag">🪙</span>
                        <span class="name">가상자산</span>
                        <span class="sub">Crypto · USDT</span>
                    </button>
                    <button class="tw-market-tab-btn" data-asset="custom">
                        <span class="flag">📐</span>
                        <span class="name">사용자 정의</span>
                        <span class="sub">Custom Multiplier</span>
                    </button>
                </div>

                <div class="tw-calc-grid">
                    <!-- 좌측 입력 폼 -->
                    <div class="tw-calc-form-container">
                        <div class="tw-section-card">
                            <!-- STEP 1: 시드 자산 & 허용 리스크 (1R) -->
                            <div class="tw-section-title">
                                <h3><i class="ph ph-wallet"></i> 1단계: 운용 자본금 & 1R 허용 리스크</h3>
                            </div>

                            <div class="tw-input-grid-2">
                                <div class="tw-form-group">
                                    <label id="label-calc-capital">총 계좌 운용 자산 <span class="req">*</span></label>
                                    <div class="tw-input-wrapper">
                                        <input type="number" id="calc-capital" value="${profile.accountBalance || 10000000}" step="100000">
                                        <span class="tw-input-unit" id="unit-calc-capital">원</span>
                                    </div>
                                </div>
                                <div class="tw-form-group">
                                    <label>1R 리스크 입력 모드</label>
                                    <div class="tw-toggle-group" style="margin-bottom:0;">
                                        <button class="tw-toggle-btn active" data-mode="percent" id="btn-mode-pct">자산 비율 (%)</button>
                                        <button class="tw-toggle-btn" data-mode="fixed" id="btn-mode-fixed">확정 금액</button>
                                    </div>
                                </div>
                            </div>

                            <div class="tw-form-group">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:7px;">
                                    <label style="margin-bottom:0;">1회 거래당 최대 감수 손실 (1R) <span class="req">*</span></label>
                                    <!-- 퀵 비율 버튼 -->
                                    <div class="tw-quick-risk-group" id="quick-risk-pills">
                                        <button type="button" class="tw-risk-pill" data-val="0.5">0.5%</button>
                                        <button type="button" class="tw-risk-pill active" data-val="1.0">1.0% (원칙)</button>
                                        <button type="button" class="tw-risk-pill" data-val="1.5">1.5%</button>
                                        <button type="button" class="tw-risk-pill" data-val="2.0">2.0%</button>
                                    </div>
                                </div>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="calc-risk-val" value="${profile.defaultRiskPercent || 1.0}" step="0.1">
                                    <span class="tw-input-unit" id="calc-risk-unit">%</span>
                                </div>
                                <div style="font-size:11px; color:var(--text-muted); margin-top:5px;" id="calc-risk-guide">
                                    * 실전 매매에서는 1회 거래당 총 자본의 1% ~ 2% 이내 손실 설정을 강력히 권장합니다.
                                </div>
                            </div>

                            <hr style="border:none; border-top:1px solid rgba(255,255,255,0.06); margin: 22px 0 18px;">

                            <!-- STEP 2: 대상 상품 & 계약 스펙 -->
                            <div class="tw-section-title">
                                <h3><i class="ph ph-cube"></i> 2단계: 거래 상품 & 계약 스펙</h3>
                            </div>

                            <!-- 동적 상품 영역 -->
                            <div id="calc-asset-dynamic-fields">
                                <!-- JS 동적 렌더링 -->
                            </div>

                            <hr style="border:none; border-top:1px solid rgba(255,255,255,0.06); margin: 22px 0 18px;">

                            <!-- STEP 3: 진입 전략 & 무효화(손절) 타점 -->
                            <div class="tw-section-title" style="display:flex; justify-content:space-between; align-items:center;">
                                <h3><i class="ph ph-crosshair"></i> 3단계: 진입 호가 & 원칙 손절 타점</h3>
                                <!-- 포지션 방향 토글러 -->
                                <div class="tw-pos-direction-toggle" id="calc-dir-toggle">
                                    <button type="button" class="tw-dir-btn active" data-dir="Long">
                                        <i class="ph ph-trend-up"></i> LONG (매수)
                                    </button>
                                    <button type="button" class="tw-dir-btn" data-dir="Short">
                                        <i class="ph ph-trend-down"></i> SHORT (매도)
                                    </button>
                                </div>
                            </div>

                            <div class="tw-input-grid-3">
                                <div class="tw-form-group">
                                    <label>진입 예정가 <span class="req">*</span></label>
                                    <div class="tw-input-wrapper">
                                        <input type="number" id="calc-entry-price" placeholder="예: 32800" step="any">
                                        <span class="tw-input-unit" id="unit-entry">원</span>
                                    </div>
                                    <div class="tw-field-sub-note" id="note-entry">계획 진입 목표가</div>
                                </div>
                                <div class="tw-form-group">
                                    <label>원칙 손절가 (무효화선) <span class="req">*</span></label>
                                    <div class="tw-input-wrapper">
                                        <input type="number" id="calc-stop-loss" placeholder="예: 31800" step="any">
                                        <span class="tw-input-unit" id="unit-stop">원</span>
                                    </div>
                                    <div class="tw-field-sub-note" id="note-stop">
                                        <span id="badge-stop-ticks" class="tw-tick-pill">손절폭: 0</span>
                                    </div>
                                </div>
                                <div class="tw-form-group">
                                    <label>목표 익절가 (1차 TP)</label>
                                    <div class="tw-input-wrapper">
                                        <input type="number" id="calc-target-price" placeholder="예: 35500" step="any">
                                        <span class="tw-input-unit" id="unit-target">원</span>
                                    </div>
                                    <div class="tw-field-sub-note" id="note-target">
                                        <span id="badge-target-ticks" class="tw-tick-pill">기대폭: 0</span>
                                    </div>
                                </div>
                            </div>

                            <!-- 세금 및 수수료 옵션 -->
                            <div class="tw-form-group" style="margin-bottom:0;" id="fee-option-wrapper">
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                    <input type="checkbox" id="calc-include-fees" checked>
                                    <span id="calc-fee-label">거래 세금 및 위탁수수료 실질 반영</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- 우측 결과창 (DAJAVATA POSITION MATRIX) -->
                    <div class="tw-calc-result-container">
                        <div class="tw-calc-result-card" id="calc-result-box">
                            <!-- JS 실시간 렌더링 -->
                        </div>
                    </div>
                </div>
            `;

            this.bindCalcEvents(container, initialParams);
        },

        bindCalcEvents(container, initialParams = {}) {
            let currentAsset = initialParams.assetType || 'krx';
            let riskMode = 'percent';
            let currentDirection = 'Long';

            const capitalInput = container.querySelector('#calc-capital');
            const capitalUnit = container.querySelector('#unit-calc-capital');
            const riskValInput = container.querySelector('#calc-risk-val');
            const riskUnit = container.querySelector('#calc-risk-unit');
            const entryInput = container.querySelector('#calc-entry-price');
            const stopInput = container.querySelector('#calc-stop-loss');
            const targetInput = container.querySelector('#calc-target-price');
            const unitEntry = container.querySelector('#unit-entry');
            const unitStop = container.querySelector('#unit-stop');
            const unitTarget = container.querySelector('#unit-target');
            const feeCheck = container.querySelector('#calc-include-fees');
            const feeLabel = container.querySelector('#calc-fee-label');
            const resultBox = container.querySelector('#calc-result-box');
            const dynamicFields = container.querySelector('#calc-asset-dynamic-fields');
            const badgeStopTicks = container.querySelector('#badge-stop-ticks');
            const badgeTargetTicks = container.querySelector('#badge-target-ticks');

            const btnPct = container.querySelector('#btn-mode-pct');
            const btnFixed = container.querySelector('#btn-mode-fixed');

            // 자산별 기본값 세팅 함수
            const renderDynamicFields = (asset) => {
                if (asset === 'krx') {
                    dynamicFields.innerHTML = `
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
                                    <input type="text" id="calc-item-name" value="${initialParams.stockName || '원익IPS'}" placeholder="예: 삼성전자, 원익IPS">
                                </div>
                            </div>
                        </div>
                    `;
                    feeLabel.textContent = "국내 주식 세금(0.18%) 및 위탁수수료(0.015%) 실질 손익 반영";
                    capitalUnit.textContent = "원";
                    unitEntry.textContent = "원";
                    unitStop.textContent = "원";
                    unitTarget.textContent = "원";
                    if (capitalInput.value === "10000" || capitalInput.value === "5000") {
                        capitalInput.value = "10000000";
                    }
                    entryInput.placeholder = "예: 32800";
                    stopInput.placeholder = "예: 31800";
                    targetInput.placeholder = "예: 35500";
                } else if (asset === 'us') {
                    dynamicFields.innerHTML = `
                        <div class="tw-input-grid-3">
                            <div class="tw-form-group">
                                <label>거래소</label>
                                <div class="tw-input-wrapper">
                                    <select id="calc-market">
                                        <option value="NASDAQ" selected>나스닥 (NASDAQ)</option>
                                        <option value="NYSE">뉴욕증권거래소 (NYSE)</option>
                                        <option value="ETF">미국 ETF</option>
                                    </select>
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>티커 / 종목명</label>
                                <div class="tw-input-wrapper">
                                    <input type="text" id="calc-item-name" value="NVDA" placeholder="예: NVDA, AAPL, TSLA">
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>주수 계산 단위</label>
                                <div class="tw-input-wrapper">
                                    <select id="calc-us-fractional">
                                        <option value="int" selected>1주 단위 정수 (기본)</option>
                                        <option value="frac">소수점 주수 (소수 3자리)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    `;
                    feeLabel.textContent = "미국 주식 현지 거래 수수료 및 SEC Fee 반영";
                    capitalUnit.textContent = "$";
                    unitEntry.textContent = "$";
                    unitStop.textContent = "$";
                    unitTarget.textContent = "$";
                    if (capitalInput.value === "10000000" || !capitalInput.value) {
                        capitalInput.value = "10000";
                    }
                    entryInput.placeholder = "예: 135.50";
                    stopInput.placeholder = "예: 130.00";
                    targetInput.placeholder = "예: 148.00";
                } else if (asset === 'futures') {
                    // 해외선물 카테고리별 옵션 구성
                    dynamicFields.innerHTML = `
                        <div class="tw-form-group">
                            <label>CME / 글로벌 선물 종목 선택 <span class="req">*</span></label>
                            <div class="tw-input-wrapper">
                                <select id="calc-futures-symbol" style="font-weight:600;">
                                    <optgroup label="🇺🇸 미국 대표 지수선물 (INDEX)">
                                        <option value="NQ" selected>NQ · E-mini Nasdaq-100 ($20/pt, 0.25tick=$5)</option>
                                        <option value="MNQ">MNQ · Micro E-mini Nasdaq-100 ($2/pt, 0.25tick=$0.5)</option>
                                        <option value="ES">ES · E-mini S&P 500 ($50/pt, 0.25tick=$12.5)</option>
                                        <option value="MES">MES · Micro E-mini S&P 500 ($5/pt, 0.25tick=$1.25)</option>
                                        <option value="YM">YM · E-mini Dow Jones ($5/pt, 1.0tick=$5)</option>
                                        <option value="MYM">MYM · Micro E-mini Dow Jones ($0.5/pt, 1.0tick=$0.5)</option>
                                        <option value="RTY">RTY · E-mini Russell 2000 ($50/pt, 0.1tick=$5)</option>
                                        <option value="M2K">M2K · Micro E-mini Russell 2000 ($5/pt, 0.1tick=$0.5)</option>
                                    </optgroup>
                                    <optgroup label="🥇 귀금속 및 원자재/에너지 (METALS & ENERGY)">
                                        <option value="GC">GC · Gold (금 선물) ($100/pt, 0.1tick=$10)</option>
                                        <option value="MGC">MGC · Micro Gold ($10/pt, 0.1tick=$1)</option>
                                        <option value="SI">SI · Silver (은 선물) ($5,000/pt, 0.005tick=$25)</option>
                                        <option value="SIL">SIL · Micro Silver ($1,000/pt, 0.005tick=$5)</option>
                                        <option value="CL">CL · WTI Crude Oil (크루드 오일) ($1,000/pt, 0.01tick=$10)</option>
                                        <option value="MCL">MCL · Micro WTI Crude Oil ($100/pt, 0.01tick=$1)</option>
                                        <option value="NG">NG · Natural Gas (천연가스) ($10,000/pt, 0.001tick=$10)</option>
                                    </optgroup>
                                    <optgroup label="💱 통화 선물 (FX CURRENCY)">
                                        <option value="6E">6E · Euro FX (유로/달러) ($125,000/pt, 0.00005tick=$6.25)</option>
                                        <option value="M6E">M6E · Micro Euro FX ($12,500/pt, 0.0001tick=$1.25)</option>
                                        <option value="6B">6B · British Pound (영국 파운드) ($62,500/pt, 0.0001tick=$6.25)</option>
                                        <option value="M6B">M6B · Micro British Pound ($6,250/pt, 0.0002tick=$1.25)</option>
                                        <option value="6J">6J · Japanese Yen (일본 엔화) ($12.5M/pt, tick=$6.25)</option>
                                    </optgroup>
                                    <optgroup label="🏛️ 금리 및 국채 (TREASURY)">
                                        <option value="ZN">ZN · 10-Year T-Note (미국 10년물 국채) ($1,000/pt)</option>
                                    </optgroup>
                                </select>
                            </div>
                        </div>

                        <!-- 선택된 선물 계약 스펙 배너 (다자바타 독창적 퀀트 카드) -->
                        <div class="tw-spec-banner" id="futures-spec-banner">
                            <!-- 동적 스펙 바인딩 -->
                        </div>
                    `;
                    feeLabel.textContent = "CME 브로커 선물 왕복 수수료 (계약당 약 $4.50) 반영";
                    capitalUnit.textContent = "$";
                    unitEntry.textContent = "pt";
                    unitStop.textContent = "pt";
                    unitTarget.textContent = "pt";
                    if (capitalInput.value === "10000000" || !capitalInput.value) {
                        capitalInput.value = "10000";
                    }

                    // 선물 스펙 배너 갱신
                    updateFuturesSpecBanner();
                } else if (asset === 'crypto') {
                    dynamicFields.innerHTML = `
                        <div class="tw-input-grid-2">
                            <div class="tw-form-group">
                                <label>가상자산 페어 (USDT 마진)</label>
                                <div class="tw-input-wrapper">
                                    <select id="calc-crypto-symbol" style="font-weight:600;">
                                        <option value="BTCUSDT" selected>BTC/USDT · 비트코인</option>
                                        <option value="ETHUSDT">ETH/USDT · 이더리움</option>
                                        <option value="SOLUSDT">SOL/USDT · 솔라나</option>
                                        <option value="XRPUSDT">XRP/USDT · 리플</option>
                                        <option value="DOGEUSDT">DOGE/USDT · 도지코인</option>
                                    </select>
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>레버리지 참고 설정</label>
                                <div class="tw-input-wrapper">
                                    <select id="calc-crypto-lev">
                                        <option value="1">1x (현물/무레버리지)</option>
                                        <option value="3">3x (보수적)</option>
                                        <option value="5" selected>5x (권장 안전 마진)</option>
                                        <option value="10">10x (주의)</option>
                                        <option value="20">20x (고위험)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    `;
                    feeLabel.textContent = "가상자산 무기한 선물 메이커/테이커 수수료(약 0.08%) 반영";
                    capitalUnit.textContent = "USDT";
                    unitEntry.textContent = "$";
                    unitStop.textContent = "$";
                    unitTarget.textContent = "$";
                    if (capitalInput.value === "10000000" || !capitalInput.value) {
                        capitalInput.value = "5000";
                    }
                    entryInput.placeholder = "예: 68500";
                    stopInput.placeholder = "예: 67200";
                    targetInput.placeholder = "예: 72000";
                } else if (asset === 'custom') {
                    dynamicFields.innerHTML = `
                        <div class="tw-input-grid-3">
                            <div class="tw-form-group">
                                <label>상품명</label>
                                <div class="tw-input-wrapper">
                                    <input type="text" id="calc-custom-name" value="Custom Asset" placeholder="예: 원유 CFD, 코스피200선물">
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>승수 (1포인트당 가치) <span class="req">*</span></label>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="calc-custom-mult" value="250000" step="1">
                                    <span class="tw-input-unit">원/pt</span>
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>최소 호가 틱 크기 (Tick Size)</label>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="calc-custom-tick" value="0.05" step="0.0001">
                                    <span class="tw-input-unit">pt</span>
                                </div>
                            </div>
                        </div>
                    `;
                    feeLabel.textContent = "사용자 정의 거래 수수료 반영";
                    capitalUnit.textContent = "단위";
                    unitEntry.textContent = "pt";
                    unitStop.textContent = "pt";
                    unitTarget.textContent = "pt";
                }

                // 이벤트 재바인딩
                bindDynamicEvents();
                recalc();
            };

            const updateFuturesSpecBanner = () => {
                const fSelect = container.querySelector('#calc-futures-symbol');
                const banner = container.querySelector('#futures-spec-banner');
                if (!fSelect || !banner) return;

                const sym = fSelect.value;
                const spec = FUTURES_SPECS[sym] || FUTURES_SPECS['NQ'];

                banner.innerHTML = `
                    <div class="tw-spec-item">
                        <span class="lbl">1포인트(pt) 가치</span>
                        <span class="val">$${spec.pointValue.toLocaleString()}</span>
                    </div>
                    <div class="tw-spec-item">
                        <span class="lbl">최소 틱 단위</span>
                        <span class="val">${spec.tickSize} pt</span>
                    </div>
                    <div class="tw-spec-item">
                        <span class="lbl">1틱(Tick) 가치</span>
                        <span class="val highlight">$${spec.tickValue ? spec.tickValue.toFixed(2) : (spec.pointValue * spec.tickSize).toFixed(2)}</span>
                    </div>
                    <div class="tw-spec-item">
                        <span class="lbl">최소 주문 단위</span>
                        <span class="val">1 계약 (승수 ${spec.pointValue})</span>
                    </div>
                    <div class="tw-spec-desc">
                        <i class="ph ph-info"></i> ${spec.desc}
                    </div>
                `;

                // 입력 예시 가이드
                if (!entryInput.value || entryInput.value === "32800") {
                    entryInput.value = spec.samplePrice || "";
                    if (spec.samplePrice) {
                        const defaultStopDiff = spec.samplePrice * 0.01;
                        stopInput.value = Number(spec.samplePrice - defaultStopDiff).toFixed(2);
                        targetInput.value = Number(spec.samplePrice + (defaultStopDiff * 2)).toFixed(2);
                    }
                }
            };

            const bindDynamicEvents = () => {
                const fSelect = container.querySelector('#calc-futures-symbol');
                if (fSelect) {
                    fSelect.addEventListener('change', () => {
                        updateFuturesSpecBanner();
                        recalc();
                    });
                }
                const cSelect = container.querySelector('#calc-crypto-symbol');
                if (cSelect) {
                    cSelect.addEventListener('change', () => {
                        const sym = cSelect.value;
                        const spec = CRYPTO_SPECS[sym];
                        if (spec) {
                            entryInput.value = spec.samplePrice;
                            stopInput.value = (spec.samplePrice * 0.98).toFixed(2);
                            targetInput.value = (spec.samplePrice * 1.04).toFixed(2);
                        }
                        recalc();
                    });
                }
                const customInputs = container.querySelectorAll('#calc-custom-mult, #calc-custom-tick, #calc-us-fractional');
                customInputs.forEach(inp => inp.addEventListener('input', recalc));
            };

            // 자산 탭 클릭 이벤트
            container.querySelectorAll('.tw-market-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    container.querySelectorAll('.tw-market-tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentAsset = btn.getAttribute('data-asset');
                    renderDynamicFields(currentAsset);
                });
            });

            // 포지션 방향 토글러 이벤트
            const dirToggle = container.querySelector('#calc-dir-toggle');
            if (dirToggle) {
                dirToggle.querySelectorAll('.tw-dir-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        dirToggle.querySelectorAll('.tw-dir-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        currentDirection = btn.getAttribute('data-dir');
                        recalc();
                    });
                });
            }

            // 1R 리스크 모드 토글 (비율 % vs 고정금액)
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
                riskUnit.textContent = currentAsset === 'krx' ? "원" : (currentAsset === 'crypto' ? "USDT" : "$");
                const cap = parseFloat(capitalInput.value) || 10000;
                riskValInput.value = currentAsset === 'krx' ? (cap * 0.01).toString() : (cap * 0.01).toFixed(0);
                recalc();
            });

            // 퀵 리스크 % 버튼 (0.5%, 1.0%, 1.5%, 2.0%)
            container.querySelectorAll('.tw-risk-pill').forEach(pill => {
                pill.addEventListener('click', () => {
                    container.querySelectorAll('.tw-risk-pill').forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    if (riskMode !== 'percent') {
                        riskMode = 'percent';
                        btnPct.classList.add('active');
                        btnFixed.classList.remove('active');
                        riskUnit.textContent = "%";
                    }
                    riskValInput.value = pill.getAttribute('data-val');
                    recalc();
                });
            });

            // 핵심 실시간 계산 로직
            const recalc = () => {
                const entryVal = parseFloat(entryInput.value) || 0;
                const stopVal = parseFloat(stopInput.value) || 0;
                const targetVal = parseFloat(targetInput.value) || 0;

                // 자동 포지션 방향 감지 (사용자가 명시하지 않았더라도 손절가 비교)
                if (entryVal > 0 && stopVal > 0) {
                    const detectedDir = stopVal < entryVal ? 'Long' : 'Short';
                    // 토글 버튼 상태 동기화
                    if (dirToggle) {
                        dirToggle.querySelectorAll('.tw-dir-btn').forEach(b => {
                            b.classList.toggle('active', b.getAttribute('data-dir') === detectedDir);
                        });
                    }
                    currentDirection = detectedDir;
                }

                // 틱/포인트 차이 뱃지 업데이트
                if (entryVal > 0 && stopVal > 0) {
                    const diff = Math.abs(entryVal - stopVal);
                    let tickSz = 1;
                    if (currentAsset === 'futures') {
                        const fSym = container.querySelector('#calc-futures-symbol')?.value || 'NQ';
                        tickSz = FUTURES_SPECS[fSym]?.tickSize || 0.25;
                    } else if (currentAsset === 'us') {
                        tickSz = 0.01;
                    }
                    const ticks = tickSz > 0 ? Math.round(diff / tickSz) : 0;
                    badgeStopTicks.textContent = `손절폭: ${diff.toFixed(2)} (${ticks.toLocaleString()} 틱)`;
                } else {
                    badgeStopTicks.textContent = `손절폭: 0`;
                }

                if (entryVal > 0 && targetVal > 0) {
                    const diff = Math.abs(targetVal - entryVal);
                    let tickSz = 1;
                    if (currentAsset === 'futures') {
                        const fSym = container.querySelector('#calc-futures-symbol')?.value || 'NQ';
                        tickSz = FUTURES_SPECS[fSym]?.tickSize || 0.25;
                    } else if (currentAsset === 'us') {
                        tickSz = 0.01;
                    }
                    const ticks = tickSz > 0 ? Math.round(diff / tickSz) : 0;
                    badgeTargetTicks.textContent = `기대폭: ${diff.toFixed(2)} (${ticks.toLocaleString()} 틱)`;
                } else {
                    badgeTargetTicks.textContent = `기대폭: 0`;
                }

                const params = {
                    assetType: currentAsset,
                    capital: capitalInput.value,
                    riskMode: riskMode,
                    riskValue: riskValInput.value,
                    entryPrice: entryInput.value,
                    stopLoss: stopInput.value,
                    targetPrice: targetInput.value,
                    direction: currentDirection,
                    includeFees: feeCheck.checked,
                    futuresSymbol: container.querySelector('#calc-futures-symbol')?.value || 'NQ',
                    cryptoSymbol: container.querySelector('#calc-crypto-symbol')?.value || 'BTCUSDT',
                    customMultiplier: container.querySelector('#calc-custom-mult')?.value || 1,
                    customTickSize: container.querySelector('#calc-custom-tick')?.value || 0.01,
                    allowFractional: container.querySelector('#calc-us-fractional')?.value === 'frac'
                };

                const res = Calculator.calculate(params);
                if (!res || res.error) {
                    resultBox.innerHTML = `
                        <div style="text-align:center; padding: 40px 15px;">
                            <div class="tw-calc-hero-badge"><i class="ph ph-shield"></i> RISK MANAGEMENT</div>
                            <h3 style="font-size:17px; margin: 14px 0 8px; color:#fff;">진입보다 먼저, 1R 리스크를 정하세요</h3>
                            <p style="font-size:13px; color:var(--text-muted); line-height:1.6;">
                                ${res && res.error ? `<span style="color:var(--pos); font-weight:600;">${res.error}</span>` : '운용 자본금, 진입가, 원칙 손절가를 입력하시면 1R 기준 최적의 진입 포지션과 손익비를 계산합니다.'}
                            </p>
                            <div style="margin-top:24px; font-size:12px; color:var(--text-muted); background:rgba(255,255,255,0.03); padding:12px; border-radius:8px; line-height:1.5;">
                                💡 <strong>핵심 공식:</strong> 1R 허용 손실금 ÷ (1단위당 손절폭 × 승수) = 적정 진입 수량
                            </div>
                        </div>
                    `;
                    return;
                }

                // 상품 표시 이름
                let displayName = "선택 종목";
                if (currentAsset === 'krx') {
                    displayName = container.querySelector('#calc-item-name')?.value || '국내주식';
                } else if (currentAsset === 'us') {
                    displayName = (container.querySelector('#calc-item-name')?.value || 'NVDA') + " (US)";
                } else if (currentAsset === 'futures') {
                    const fSym = container.querySelector('#calc-futures-symbol')?.value || 'NQ';
                    displayName = (FUTURES_SPECS[fSym]?.name || fSym) + ` [${fSym}]`;
                } else if (currentAsset === 'crypto') {
                    displayName = (container.querySelector('#calc-crypto-symbol')?.value || 'BTCUSDT');
                } else if (currentAsset === 'custom') {
                    displayName = container.querySelector('#calc-custom-name')?.value || 'Custom Asset';
                }

                resultBox.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <div class="tw-calc-hero-badge">
                            <i class="ph ph-check-circle"></i> DAJAVATA RISK REPORT
                        </div>
                        <span class="tw-badge ${res.direction === 'Long' ? 'tw-badge-status-active' : 'tw-badge-status-cancel'}">
                            ${res.direction === 'Long' ? '🟢 LONG 매수' : '🔴 SHORT 매도'}
                        </span>
                    </div>

                    <h3 style="font-size:18px; color:#fff; margin-bottom:14px; display:flex; align-items:center; gap:8px;">
                        ${displayName}
                    </h3>

                    <!-- 히어로 카드: 추천 진입 수량 -->
                    <div class="tw-calc-hero-qty-box">
                        <div class="lbl">추천 최적 포지션 규모</div>
                        <div class="qty-val">${res.qty.toLocaleString()} <span class="unit">${res.unitName}</span></div>
                        <div class="sub-val">총 포지션 가치: ${formatAssetVal(res.notionalValue, currentAsset)} (${formatNumber(res.portfolioPercent, 1)}%)</div>
                    </div>

                    <div class="tw-calc-result-row">
                        <span class="k">1회 거래 확정 손실 (1R)</span>
                        <span class="v neg">-${formatAssetVal(res.allowedRisk, currentAsset)}</span>
                    </div>

                    <div class="tw-calc-result-row">
                        <span class="k">단위당 손절 가격폭</span>
                        <span class="v neg">-${formatNumber(res.priceDiff, 2)} (${formatNumber(res.lossPercent, 2)}%)</span>
                    </div>

                    ${currentAsset === 'futures' ? `
                        <div class="tw-calc-result-row">
                            <span class="k">1계약당 틱 손실 / 틱 가치</span>
                            <span class="v" style="color:#fff;">${res.stopTicks} Ticks ($${(res.lossPerUnit).toLocaleString()})</span>
                        </div>
                    ` : ''}

                    ${res.rrRatio > 0 ? `
                        <div class="tw-calc-result-row">
                            <span class="k">목표 손익비 (Risk/Reward)</span>
                            <span class="v ${res.rrRatio >= 2 ? 'pos' : (res.rrRatio >= 1.5 ? '' : 'neg')}">
                                <strong>1 : ${formatNumber(res.rrRatio, 2)}</strong>
                                ${res.rrRatio >= 2 ? '<span style="font-size:11px; margin-left:4px;" class="tw-badge tw-badge-status-active">우수</span>' : ''}
                            </span>
                        </div>
                        <div class="tw-calc-result-row">
                            <span class="k">목표 익절 시 기대 순수익</span>
                            <span class="v pos">+${formatAssetVal(res.targetProfit, currentAsset)} (+${formatNumber(res.rrRatio, 2)}R)</span>
                        </div>
                    ` : ''}

                    ${res.feeCost > 0 ? `
                        <div class="tw-calc-result-row">
                            <span class="k">예상 수수료 / 거래세</span>
                            <span class="v" style="color:var(--text-muted); font-size:12px;">약 ${formatAssetVal(res.feeCost, currentAsset)}</span>
                        </div>
                    ` : ''}

                    <!-- 경고 및 퀀트 인사이트 박스 -->
                    ${res.warnings.map(w => `
                        <div class="tw-alert-box tw-alert-warning" style="margin-top:10px;">
                            <div>${w}</div>
                        </div>
                    `).join('')}

                    <div style="margin-top:20px;">
                        <button class="tw-btn tw-btn-primary" style="width:100%;" id="btn-apply-to-plan">
                            <i class="ph ph-file-plus"></i> 이 조건으로 매매 시나리오 수립하기
                        </button>
                    </div>
                `;

                // 시나리오 연계 버튼 클릭 이벤트
                const applyBtn = resultBox.querySelector('#btn-apply-to-plan');
                if (applyBtn) {
                    applyBtn.addEventListener('click', () => {
                        window.TraderRoom.navigate('trader-plan', {
                            action: 'newFromCalc',
                            calcData: {
                                assetType: currentAsset,
                                stockName: displayName,
                                market: currentAsset === 'krx' ? (container.querySelector('#calc-market')?.value || 'KOSDAQ') : (currentAsset === 'futures' ? 'CME Futures' : (currentAsset === 'us' ? 'US Equity' : 'Crypto')),
                                direction: res.direction,
                                entryPrice: parseFloat(entryInput.value),
                                stopLoss: parseFloat(stopInput.value),
                                targetPrice: parseFloat(targetInput.value) || 0,
                                shares: res.qty,
                                unitName: res.unitName,
                                capital: parseFloat(capitalInput.value),
                                riskAmount: res.allowedRisk,
                                totalAmount: res.notionalValue,
                                portfolioPercent: res.portfolioPercent,
                                rrRatio: res.rrRatio
                            }
                        });
                    });
                }
            };

            // 입력 변경 시 실시간 재계산 이벤트 연결
            [capitalInput, riskValInput, entryInput, stopInput, targetInput].forEach(inp => {
                inp.addEventListener('input', recalc);
            });
            feeCheck.addEventListener('change', recalc);

            // 초기 렌더링
            renderDynamicFields(currentAsset);

            // AI 차트 스캐너 등 외부에서 전달된 타점 파라미터 자동 적용
            if (initialParams.entryPrice) entryInput.value = initialParams.entryPrice;
            if (initialParams.stopPrice) stopInput.value = initialParams.stopPrice;
            if (initialParams.targetPrice) targetInput.value = initialParams.targetPrice;
            if (initialParams.symbol) {
                const krxSymbol = container.querySelector('#calc-krx-symbol');
                if (krxSymbol) krxSymbol.value = initialParams.symbol;
            }
            recalc();

            // 초기화 버튼 이벤트
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
                                        <option value="US Equity" ${calcData && (calcData.market === 'US Equity' || calcData.market === 'NASDAQ' || calcData.market === 'NYSE') ? 'selected' : ''}>미국 주식 (US Equity)</option>
                                        <option value="CME Futures" ${calcData && calcData.market === 'CME Futures' ? 'selected' : ''}>해외선물 (CME Futures)</option>
                                        <option value="Crypto" ${calcData && calcData.market === 'Crypto' ? 'selected' : ''}>가상자산 (Crypto)</option>
                                    </select>
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>종목명 / 상품명 <span class="req">*</span></label>
                                <div class="tw-input-wrapper">
                                    <input type="text" id="plan-stock-name" value="${calcData ? calcData.stockName : ''}" placeholder="예: 원익IPS, NQ, NVDA">
                                </div>
                            </div>
                        </div>

                        <div class="tw-input-grid-3">
                            <div class="tw-form-group">
                                <label>포지션 방향</label>
                                <div class="tw-input-wrapper">
                                    <select id="plan-direction">
                                        <option value="Long" ${calcData && calcData.direction === 'Long' ? 'selected' : ''}>🟢 LONG (매수)</option>
                                        <option value="Short" ${calcData && calcData.direction === 'Short' ? 'selected' : ''}>🔴 SHORT (매도)</option>
                                    </select>
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>매매 타임프레임</label>
                                <div class="tw-input-wrapper">
                                    <select id="plan-timeframe">
                                        <option value="스윙 (1~2주)">스윙 (1~2주)</option>
                                        <option value="단기 데이트레이딩">단기 데이트레이딩</option>
                                        <option value="초단타 스캘핑">초단타 스캘핑</option>
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
                                        <option value="유동성 소탕 (ICT Liquidity Sweep)">유동성 소탕 (Liquidity Sweep)</option>
                                        <option value="FVG 공정가치갭 반등">FVG (공정가치갭) 매매</option>
                                        <option value="거래대금 주도주 매매">거래대금 주도주 매매</option>
                                        <option value="52주 소외 테마 반등">52주 소외 테마 반등</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="tw-form-group">
                            <label>주요 가격대 (Key Level)</label>
                            <div class="tw-input-wrapper">
                                <input type="text" id="plan-key-level" placeholder="예: 주요 지지/저항선, 전일 고점/저점">
                            </div>
                        </div>

                        <div class="tw-form-group">
                            <label>원칙 손절 기준 (무효화 조건) <span class="req">*</span></label>
                            <div class="tw-input-wrapper">
                                <input type="text" id="plan-invalidation" value="${calcData && calcData.stopLoss ? calcData.stopLoss + ' 이탈 시 즉시 기계적 손절' : ''}" placeholder="어떤 조건이나 가격을 이탈하면 시나리오를 폐기하고 손절할 것인가?">
                            </div>
                        </div>

                        <div class="tw-form-group">
                            <label>진입 확정 타점 (트리거) <span class="req">*</span></label>
                            <div class="tw-input-wrapper">
                                <input type="text" id="plan-trigger" placeholder="예: 5분봉 거래량 실린 변곡 캔들 마감 시">
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
                            리스크 계산기에서 계산된 포지션 사이징 결과입니다. 필요 시 수치를 직접 조정할 수 있습니다.
                        </p>
                        <div class="tw-input-grid-3">
                            <div class="tw-form-group">
                                <label>진입 예정가</label>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="plan-calc-entry" value="${calcData ? calcData.entryPrice : ''}" step="any">
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>원칙 손절가</label>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="plan-calc-stop" value="${calcData ? calcData.stopLoss : ''}" step="any">
                                </div>
                            </div>
                            <div class="tw-form-group">
                                <label>목표 익절가</label>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="plan-calc-target" value="${calcData ? calcData.targetPrice : ''}" step="any">
                                </div>
                            </div>
                        </div>
                        <div class="tw-input-grid-2">
                            <div class="tw-form-group">
                                <label>추천 진입 수량 (${calcData && calcData.unitName ? calcData.unitName : '주/계약'})</label>
                                <div class="tw-input-wrapper">
                                    <input type="number" id="plan-calc-shares" value="${calcData ? calcData.shares : ''}" step="any">
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
                            <div class="tw-cal-header-left">
                                <div class="tw-cal-nav-group">
                                    <button class="tw-cal-nav-btn" id="btn-cal-prev" title="이전 달">
                                        <i class="ph ph-caret-left"></i>
                                    </button>
                                    <div class="tw-cal-picker-group">
                                        <select id="cal-year-select" class="tw-cal-select tw-cal-year-select"></select>
                                        <select id="cal-month-select" class="tw-cal-select tw-cal-month-select"></select>
                                    </div>
                                    <button class="tw-cal-nav-btn" id="btn-cal-next" title="다음 달">
                                        <i class="ph ph-caret-right"></i>
                                    </button>
                                    <button class="tw-cal-today-btn" id="btn-cal-today" title="이번 달로 바로 이동">오늘</button>
                                </div>
                            </div>
                            <div class="tw-cal-header-right">
                                <div id="cal-month-stat-badge" class="tw-cal-month-stat"></div>
                                <div class="tw-cal-subtext">일자별 실현 손익 및 거래 횟수 (날짜 클릭 시 상세 복기)</div>
                            </div>
                        </div>
                        <div class="tw-calendar-grid" id="calendar-grid-box">
                            <!-- 캘린더 동적 생성 -->
                        </div>
                    </div>
                </div>
            `;

            // 탭 상태 동기화 및 탭 이벤트
            const activeTabId = options.activeTab || this.currentJournalTab || 'tab-all-journal';
            this.currentJournalTab = activeTabId;

            const nav = container.querySelector('#journal-tab-nav');
            nav.querySelectorAll('.tw-tab-item').forEach(tab => {
                tab.addEventListener('click', () => {
                    nav.querySelectorAll('.tw-tab-item').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const targetId = tab.getAttribute('data-tab');
                    this.currentJournalTab = targetId;
                    container.querySelectorAll('.journal-tab-content').forEach(c => c.style.display = 'none');
                    container.querySelector('#' + targetId).style.display = 'block';

                    if (targetId === 'tab-calendar') {
                        this.updateCalendarView(container, journal);
                    }
                });
            });

            // 캘린더 네비게이션 컨트롤러 세팅
            this.setupCalendarControls(container, journal);

            // 초기 탭 활성화 적용
            if (activeTabId && activeTabId !== 'tab-all-journal') {
                const initialTab = nav.querySelector(`.tw-tab-item[data-tab="${activeTabId}"]`);
                if (initialTab) {
                    nav.querySelectorAll('.tw-tab-item').forEach(t => t.classList.remove('active'));
                    initialTab.classList.add('active');
                    container.querySelectorAll('.journal-tab-content').forEach(c => c.style.display = 'none');
                    const content = container.querySelector('#' + activeTabId);
                    if (content) content.style.display = 'block';
                    if (activeTabId === 'tab-calendar') {
                        this.updateCalendarView(container, journal);
                    }
                }
            }

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
        renderJournalEditor(container, plan = null, defaultDate = null) {
            const todayStr = defaultDate || new Date().toISOString().split('T')[0];

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
                this.renderJournal(container, { activeTab: this.currentJournalTab });
            });
        },

        // 매매 캘린더 네비게이션 컨트롤러 초기화
        setupCalendarControls(container, journal) {
            const calBox = container.querySelector('#tab-calendar');
            if (!calBox) return;

            const prevBtn = calBox.querySelector('#btn-cal-prev');
            const nextBtn = calBox.querySelector('#btn-cal-next');
            const todayBtn = calBox.querySelector('#btn-cal-today');
            const yearSelect = calBox.querySelector('#cal-year-select');
            const monthSelect = calBox.querySelector('#cal-month-select');

            // 연도 셀렉트 동적 채우기 (현재 연도 기준 과거 3년 ~ 미래 8년 등 넉넉하게 생성)
            if (yearSelect) {
                const currentRealYear = new Date().getFullYear();
                const startYear = Math.min(2023, currentRealYear - 2);
                const endYear = Math.max(2035, currentRealYear + 8);
                let yearHtml = '';
                for (let y = startYear; y <= endYear; y++) {
                    yearHtml += `<option value="${y}">${y}년</option>`;
                }
                yearSelect.innerHTML = yearHtml;
                yearSelect.value = this.calYear;

                yearSelect.addEventListener('change', () => {
                    this.calYear = parseInt(yearSelect.value, 10);
                    this.updateCalendarView(container, journal);
                });
            }

            // 월 셀렉트 동적 채우기 (1월 ~ 12월)
            if (monthSelect) {
                let monthHtml = '';
                for (let m = 0; m < 12; m++) {
                    monthHtml += `<option value="${m}">${m + 1}월</option>`;
                }
                monthSelect.innerHTML = monthHtml;
                monthSelect.value = this.calMonth;

                monthSelect.addEventListener('change', () => {
                    this.calMonth = parseInt(monthSelect.value, 10);
                    this.updateCalendarView(container, journal);
                });
            }

            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if (this.calMonth === 0) {
                        this.calMonth = 11;
                        this.calYear -= 1;
                    } else {
                        this.calMonth -= 1;
                    }
                    this.updateCalendarView(container, journal);
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    if (this.calMonth === 11) {
                        this.calMonth = 0;
                        this.calYear += 1;
                    } else {
                        this.calMonth += 1;
                    }
                    this.updateCalendarView(container, journal);
                });
            }

            if (todayBtn) {
                todayBtn.addEventListener('click', () => {
                    const now = new Date();
                    this.calYear = now.getFullYear();
                    this.calMonth = now.getMonth();
                    this.updateCalendarView(container, journal);
                });
            }
        },

        // 매매 캘린더 뷰 갱신 및 월별 종합 통계 계산
        updateCalendarView(container, journal) {
            const calBox = container.querySelector('#tab-calendar');
            if (!calBox) return;

            const yearSelect = calBox.querySelector('#cal-year-select');
            const monthSelect = calBox.querySelector('#cal-month-select');

            if (yearSelect) {
                if (!yearSelect.querySelector(`option[value="${this.calYear}"]`)) {
                    const opt = document.createElement('option');
                    opt.value = this.calYear;
                    opt.textContent = `${this.calYear}년`;
                    yearSelect.appendChild(opt);
                }
                yearSelect.value = this.calYear;
            }
            if (monthSelect) {
                monthSelect.value = this.calMonth;
            }

            // 당월 매매 종합 집계
            const statBadge = calBox.querySelector('#cal-month-stat-badge');
            if (statBadge) {
                const monthPrefix = `${this.calYear}-${String(this.calMonth + 1).padStart(2, '0')}`;
                const monthTrades = journal.filter(j => {
                    const d = j.exitDate || j.entryDate;
                    return d && d.startsWith(monthPrefix);
                });

                if (monthTrades.length === 0) {
                    statBadge.innerHTML = `<span class="tw-cal-stat-pill neutral"><i class="ph ph-calendar"></i> ${this.calYear}년 ${this.calMonth + 1}월 매매 기록 없음</span>`;
                } else {
                    let monthPnL = 0;
                    let monthNetR = 0;
                    let wins = 0;
                    monthTrades.forEach(t => {
                        const pnl = parseFloat(t.pnlAmount) || 0;
                        const r = parseFloat(t.realizedR) || 0;
                        monthPnL += pnl;
                        monthNetR += r;
                        if (pnl > 0) wins++;
                    });
                    const winRate = Math.round((wins / monthTrades.length) * 100);
                    const isWin = monthNetR >= 0;
                    statBadge.innerHTML = `
                        <span class="tw-cal-stat-pill ${isWin ? 'pos' : 'neg'}">
                            <strong>${this.calYear}년 ${this.calMonth + 1}월 종합</strong>: 
                            총 ${monthTrades.length}건 | ${wins}승 (${winRate}%) | 
                            ${isWin ? '+' : ''}${formatKRW(monthPnL)} | 
                            <strong>${isWin ? '+' : ''}${formatNumber(monthNetR, 2)}R</strong>
                        </span>
                    `;
                }
            }

            const gridBox = calBox.querySelector('#calendar-grid-box');
            if (gridBox) {
                this.renderCalendarGrid(gridBox, journal, this.calYear, this.calMonth, container);
            }
        },

        // 매매 캘린더 그리드 렌더러 (연도/월 동적 계산 및 무한 달력 자동 생성)
        renderCalendarGrid(container, journal, year = null, month = null, rootContainer = null) {
            const realNow = new Date();
            const realYear = realNow.getFullYear();
            const realMonth = realNow.getMonth();
            const realDate = realNow.getDate();

            const targetYear = (year !== null && year !== undefined) ? year : realYear;
            const targetMonth = (month !== null && month !== undefined) ? month : realMonth;

            // 자바스크립트 Date 표준 수식: 해당 연/월의 1일 시작 요일 및 해당 월의 마지막 일자 계산
            const firstDay = new Date(targetYear, targetMonth, 1).getDay(); // 0(일) ~ 6(토)
            const lastDate = new Date(targetYear, targetMonth + 1, 0).getDate(); // 28 ~ 31일 (윤년 자동 반영)
            const prevMonthLastDate = new Date(targetYear, targetMonth, 0).getDate();

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
            let html = dayNames.map((d, idx) => `<div class="tw-cal-day-name ${idx === 0 ? 'sun' : (idx === 6 ? 'sat' : '')}">${d}</div>`).join('');

            // 1. 이전 달 날짜 채우기 (빈칸 대신 이전 달 말일 표시로 격자 완성)
            for (let i = firstDay - 1; i >= 0; i--) {
                const prevD = prevMonthLastDate - i;
                html += `
                    <div class="tw-cal-cell other-month">
                        <div class="tw-cal-cell-header">
                            <span class="tw-cal-date-num">${prevD}</span>
                        </div>
                    </div>
                `;
            }

            // 2. 이번 달 날짜들 동적 렌더링
            for (let d = 1; d <= lastDate; d++) {
                const monthStr = String(targetMonth + 1).padStart(2, '0');
                const dateStr = String(d).padStart(2, '0');
                const fullKey = `${targetYear}-${monthStr}-${dateStr}`;
                const trades = dateMap[fullKey] || [];
                const isToday = (targetYear === realYear && targetMonth === realMonth && d === realDate);

                let dayNetR = 0;
                let dayPnL = 0;
                trades.forEach(t => {
                    dayNetR += (parseFloat(t.realizedR) || 0);
                    dayPnL += (parseFloat(t.pnlAmount) || 0);
                });

                const dayOfWeek = (firstDay + d - 1) % 7;
                const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

                html += `
                    <div class="tw-cal-cell ${isToday ? 'today' : ''} ${trades.length > 0 ? 'has-trades' : ''}" data-date="${fullKey}">
                        <div class="tw-cal-cell-header">
                            <span class="tw-cal-date-num ${isWeekend ? 'weekend' : ''}">${d}</span>
                            ${isToday ? '<span class="tw-cal-today-badge">TODAY</span>' : ''}
                        </div>
                        ${trades.length > 0 ? `
                            <div class="tw-cal-trades-badge ${dayNetR >= 0 ? 'win' : 'loss'}" title="${trades.length}건 / ${dayPnL >= 0 ? '+' : ''}${formatKRW(dayPnL)}">
                                <span>${trades.length}건</span>
                                <span>(${dayNetR >= 0 ? '+' : ''}${formatNumber(dayNetR, 1)}R)</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }

            // 3. 다음 달 날짜 채우기 (전체 7열 배수 맞춰 35 or 42칸 완성)
            const filledCount = firstDay + lastDate;
            const totalSlots = Math.ceil(filledCount / 7) * 7;
            const nextDaysCount = totalSlots - filledCount;
            for (let d = 1; d <= nextDaysCount; d++) {
                html += `
                    <div class="tw-cal-cell other-month">
                        <div class="tw-cal-cell-header">
                            <span class="tw-cal-date-num">${d}</span>
                        </div>
                    </div>
                `;
            }

            container.innerHTML = html;

            // 4. 셀 클릭 이벤트 바인딩 (매매 있는 날은 상세 복기 모달, 없는 날은 새 매매 작성 연동)
            const targetRoot = rootContainer || document.getElementById('trader-workspace-container');
            container.querySelectorAll('.tw-cal-cell:not(.other-month)').forEach(cell => {
                cell.addEventListener('click', () => {
                    const dateKey = cell.getAttribute('data-date');
                    if (!dateKey) return;
                    const trades = dateMap[dateKey] || [];
                    if (trades.length > 0) {
                        this.showDayTradesModal(targetRoot, dateKey, trades);
                    } else {
                        this.showEmptyDayModal(targetRoot, dateKey);
                    }
                });
            });
        },

        // 일자별 매매 상세 복기 모달
        showDayTradesModal(container, dateKey, trades) {
            let dayNetR = 0;
            let dayPnL = 0;
            trades.forEach(t => {
                dayNetR += (parseFloat(t.realizedR) || 0);
                dayPnL += (parseFloat(t.pnlAmount) || 0);
            });

            const isWin = dayNetR >= 0;
            const modal = document.createElement('div');
            modal.className = 'tw-modal-overlay';
            modal.innerHTML = `
                <div class="tw-modal" style="max-width: 640px;">
                    <div class="tw-modal-header">
                        <div>
                            <h3><i class="ph ph-calendar-check" style="color:${isWin ? 'var(--pos, #f94d5d)' : 'var(--neg, #2e8af6)'};"></i> ${dateKey} 매매 복기 상세</h3>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                                당일 총 ${trades.length}건 | 실현 손익: <span class="${isWin ? 'pos' : 'neg'}"><strong>${isWin ? '+' : ''}${formatKRW(dayPnL)}</strong> (${isWin ? '+' : ''}${formatNumber(dayNetR, 2)}R)</span>
                            </div>
                        </div>
                        <button class="tw-icon-btn btn-close-modal"><i class="ph ph-x"></i></button>
                    </div>
                    <div class="tw-modal-body" style="max-height:60vh; overflow-y:auto;">
                        <div style="display:flex; flex-direction:column; gap:12px;">
                            ${trades.map(t => `
                                <div class="tw-section-card" style="margin-bottom:0; padding:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                        <div style="display:flex; align-items:center; gap:8px;">
                                            <strong style="font-size:15px; color:#fff;">${t.stockName}</strong>
                                            <span class="tw-badge ${t.ruleCompliance === 'Yes' ? 'tw-badge-status-active' : 'tw-badge-status-cancel'}">
                                                ${t.ruleCompliance === 'Yes' ? '원칙 준수' : '원칙 미준수'}
                                            </span>
                                            <span style="font-size:11px; color:var(--text-muted);">${t.setup || '일반 매매'}</span>
                                        </div>
                                        <div class="${t.pnlAmount >= 0 ? 'pos' : 'neg'}" style="font-size:14px; font-weight:700;">
                                            ${t.pnlAmount >= 0 ? '+' : ''}${formatKRW(t.pnlAmount)} (${t.realizedR >= 0 ? '+' : ''}${formatNumber(t.realizedR, 2)}R)
                                        </div>
                                    </div>
                                    <div style="font-size:12px; color:var(--text-muted); display:flex; gap:14px; margin-bottom:8px;">
                                        <span>매수가: <strong>${formatKRW(t.entryPrice)}</strong></span>
                                        <span>청산가: <strong>${formatKRW(t.exitPrice)}</strong></span>
                                        <span>수량: <strong>${(t.shares || 0).toLocaleString()}주</strong></span>
                                    </div>
                                    ${(t.mistakes && t.mistakes.length > 0) ? `
                                        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;">
                                            ${t.mistakes.map(m => `<span class="tw-badge" style="background:rgba(249,77,93,0.15); color:var(--pos); font-size:10px;">${m}</span>`).join('')}
                                        </div>
                                    ` : ''}
                                    ${t.notes ? `
                                        <div style="background:rgba(0,0,0,0.25); border-radius:6px; padding:8px 10px; font-size:12px; color:#e2e8f0; line-height:1.4; margin-bottom:8px;">
                                            ${t.notes}
                                        </div>
                                    ` : ''}
                                    <div style="display:flex; justify-content:flex-end;">
                                        <button class="tw-btn tw-btn-secondary tw-btn-sm btn-open-review-detail" data-trade-id="${t.id}">
                                            <i class="ph ph-note-pencil"></i> 복기 상세 / 실수 수정
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="tw-modal-footer" style="display:flex; justify-content:space-between;">
                        <button class="tw-btn tw-btn-primary tw-btn-sm" id="btn-add-trade-this-day">
                            <i class="ph ph-plus"></i> 이 날짜로 새 매매 추가
                        </button>
                        <button class="tw-btn tw-btn-secondary btn-close-modal">닫기</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', () => modal.remove()));
            modal.querySelectorAll('.btn-open-review-detail').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tradeId = btn.getAttribute('data-trade-id');
                    const target = trades.find(t => t.id === tradeId);
                    modal.remove();
                    if (target) {
                        this.showReviewModal(container, target);
                    }
                });
            });
            const addBtn = modal.querySelector('#btn-add-trade-this-day');
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    modal.remove();
                    this.renderJournalEditor(container, null, dateKey);
                });
            }
        },

        // 거래 없는 날짜 클릭 시 작성 유도 모달
        showEmptyDayModal(container, dateKey) {
            const modal = document.createElement('div');
            modal.className = 'tw-modal-overlay';
            modal.innerHTML = `
                <div class="tw-modal" style="max-width: 440px;">
                    <div class="tw-modal-header">
                        <h3><i class="ph ph-calendar-plus" style="color:var(--pos);"></i> ${dateKey}</h3>
                        <button class="tw-icon-btn btn-close-modal"><i class="ph ph-x"></i></button>
                    </div>
                    <div class="tw-modal-body" style="text-align:center; padding:24px 16px;">
                        <p style="color:#cbd5e1; font-size:13px; line-height:1.6; margin-bottom:20px;">
                            <strong>${dateKey}</strong>에는 아직 등록된 매매 기록이 없습니다.<br>
                            과거 또는 당일 매매일지를 새로 작성하시겠습니까?
                        </p>
                        <button class="tw-btn tw-btn-primary" id="btn-create-for-date" style="width:100%;">
                            <i class="ph ph-plus-circle"></i> ${dateKey} 매매일지 작성하기
                        </button>
                    </div>
                    <div class="tw-modal-footer">
                        <button class="tw-btn tw-btn-secondary btn-close-modal" style="width:100%;">닫기</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', () => modal.remove()));
            const createBtn = modal.querySelector('#btn-create-for-date');
            if (createBtn) {
                createBtn.addEventListener('click', () => {
                    modal.remove();
                    this.renderJournalEditor(container, null, dateKey);
                });
            }
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
            const scannerView = document.getElementById('chart-scanner-container');

            if (!workspace || !defaultView) return;

            // 기존 테마 테이블 뷰 및 차트 스캐너 뷰는 감추고, 트레이더 룸 표시
            defaultView.style.display = 'none';
            if (scannerView) scannerView.style.display = 'none';
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
