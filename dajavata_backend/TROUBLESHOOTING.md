# Dajavata Project - Troubleshooting & Maintenance Log

## 2026-09-22: 네이버 금융 API 구조 변경으로 인한 대시보드 테마/수급 빈 화면(Blank) 이슈

### 🚨 문제 증상 (Issue)
- `dajavata.com` 홈페이지 접속 시 대시보드 화면이 아무것도 뜨지 않음 (특히 테마 및 시장 전체 수급 동향 탭).
- 로컬 및 라이브 서버 모두에서 주식 종목이 하나도 표시되지 않는 현상 발생.

### 🔍 원인 파악 (Root Cause)
- 백엔드에서 네이버 금융 API를 통해 테마 데이터를 수집하는 `update_themes.py` 스크립트가 동작하지 않음.
- **네이버 금융 API의 JSON 응답 키(Key) 이름이 잠수함 패치로 변경됨.**
  1. 테마 목록을 감싸는 키: 기존 `content` ➔ 변경 `items`
  2. 종목 코드를 나타내는 키: 기존 `itemCode` ➔ 변경 `itemcode` (소문자)
- 이로 인해 스크립트가 데이터를 정상적으로 파싱하지 못하고 빈 배열(`[]`)을 반환했으며, 이 빈 데이터가 그대로 `theme_cache.json`과 `all_stocks.json`에 덮어씌워져 홈페이지가 텅 비게 됨.

### ✅ 해결 방안 (Resolution)
1. **`dajavata_backend/update_themes.py` 코드 수정:**
   - 테마 리스트 파싱 부분: `.get('content', [])` ➔ `.get('items', [])` 로 수정.
   - 종목 코드 파싱 부분: `.get('itemCode')` ➔ `.get('itemcode')` 로 수정.
2. **안전 장치(Safeguard) 추가:**
   - API 통신 오류나 구조 변경으로 인해 테마를 0개 가져올 경우, 기존 `theme_cache.json` 파일을 빈 파일로 덮어쓰지 않고 즉시 스크립트를 중단(에러 발생)하도록 예외 처리 로직 추가.
3. **업데이트 적용 방식:**
   - 로컬에서 수정된 `update_themes.py` 파일을 서버(GitHub)에 업로드(덮어쓰기)함.
   - GitHub Actions 탭에서 `[Update Theme Data]` 워크플로우를 수동으로 실행(Run workflow)하여 데이터를 즉시 재생성함.

### 📝 향후 작업자(AI)를 위한 주의사항 (Note for Future AI)
- Dajavata 대시보드의 데이터가 갑자기 비어있다면 가장 먼저 네이버 API의 JSON 구조가 다시 바뀌지 않았는지 의심할 것.
- 크롤링 스크립트가 동작하지 않더라도 기존에 수집해 둔 JSON 파일이 빈 값으로 덮어씌워지지 않도록 항상 예외 처리(빈 리스트 반환 시 저장 안 함)를 유지할 것.

---

## 2026-10-19: 다자바타 트레이더 룸 (Trading Workspace & Risk Calculator) 신규 기능 구축

### 🚀 도입 기능 (New Features)
1. **국내 주식 맞춤형 리스크 & 비중 계산기:**
   - 코스피/코스닥 원화(KRW) 기준 계좌 총자산 및 1R 손실 한도(1~2% 또는 고정금액) 설정.
   - 1주 단위 정수 매수 수량 및 비중(%) 산출.
   - 손익비(Risk/Reward) 자동 검증 및 거래세(0.18%)·위탁수수료(0.015%) 차감 옵션.
   - 계좌 예수금 초과 및 손익비 1:1.5 미만 시 안전 경고 시스템.
2. **매매 시나리오 (Trade Plan):**
   - 뇌동매매 방지용 무효화(손절) 기준 및 진입 트리거 확정 후 시나리오 잠금(Lock) 기능.
3. **매매일지 & 복기노트:**
   - 실현 손익 및 누적 R값 산출, 원칙 준수 여부(Yes/Partial/No), 반복 실수 태그 및 캘린더 뷰.
4. **뇌동매매 방지 비진입 기록 (Skip Logs):**
   - 진입을 참은 이유를 정식 투자 결정으로 기록 및 관리.
5. **성과 분석실 & 데이터 보관함:**
   - 6대 핵심 KPI (Net R, 승률, 기대값, PF 등) 산출 및 Local-First JSON 백업/복원, CSV 엑셀 내보내기 지원.

### 🛡️ 아키텍처 및 안전성 (Architecture & Safety)
- **Local-First 저장소:** 사용자 브라우저의 `localStorage` (`dajavata_trader_db_v1`)에만 저장되어 100% 개인정보 보장 및 서버 비용 0원.
- **기존 사이트 무손상 연동:** 기존 테마/종목/노션 테이블(`default-view-container`)과 신규 트레이더 룸(`trader-workspace-container`)이 분리되어 상호 간섭 없음.
- **상세 매뉴얼:** `c:\Users\SEC\vibcoding\dajavata\TRADING_WORKSPACE_MANUAL.md` 참조.

---

## 2026-10-20: 조건별 종목 500 에러 및 차트 스캐너 15대 작도 엔진 전면 구축

### 🚨 문제 1: 조건별 종목 '데이터 로딩 실패' 오류
- **원인:** `main.py`의 `/api/stocks/fundamentals`에서 `import time` 누락으로 인한 `NameError` 500 에러, 프론트엔드 `stockMenus` 변수 선언 누락.
- **해결:** `import time` 추가, 3중 캐시 파일 경로 자동 탐색 추가, 프론트엔드 `loadAllStocks()` 3중 Fallback 연동.

### 🚨 문제 2: 15대 전문 작도 도구 (사인지선, 피보나치 팬, 삼각형 등) 미작동
- **원인:** 클릭 좌표는 수집되나 `drawSingleShape(ctx, shape)` 렌더러 내부에 수학 드로잉 로직 부재.
- **해결:** `chart_scanner.js`에 사인지선(파장·진폭), 피보나치 팬, 시간주기, 삼각형 패턴, 쓰리 드라이브 등 15개 도구 트레이딩뷰 표준 수학 공식 및 Canvas 드로잉 전면 구현 완료.

### 🚨 문제 3: 트레이더 룸 매매 캘린더 당월(10월) 고정 및 네비게이션 부재 이슈
- **원인:** `trader_room.js`의 `renderCalendarGrid()`에서 `new Date().getFullYear()`, `new Date().getMonth()`를 단순 일회성 호출하여 화면에 렌더링하도록 하드코딩되어 있었고, 연/월 상태(State) 변수 및 이전/다음 이동 핸들러가 누락되어 접속 시점의 당월(10월)만 고정 표시됨.
- **해결:** 
  1. `Views` 객체에 `calYear`, `calMonth`, `currentJournalTab` 전역 상태 변수 신설.
  2. 캘린더 헤더에 이전 달(`<`), 다음 달(`>`), 당월 복귀(`오늘`) 버튼 및 연도/월 직관 점프 셀렉터(`cal-year-select`, `cal-month-select`) 구현.
  3. 자바스크립트 표준 Date 수식(`new Date(year, month, 1).getDay()`, `new Date(year, month + 1, 0).getDate()`)을 통해 2026년뿐만 아니라 2027년, 2028년(윤년 2월 29일), 2030년 등 미래 및 과거 연월이 무한히 자동 계산되는 동적 캘린더 엔진 완성.
  4. 월간 종합 통계 뱃지(총 거래 수, 승률, 실현손익 합계, 누적 R값) 및 일자별 상세 복기 모달/신규 일지 작성 연동.
  5. `index.html`에서 `trader_room.css?v=4`, `trader_room.js?v=3` 캐시 버스팅 파라미터 적용.

### 📚 통합 매뉴얼 안내
전체 세부 수식 및 트러블슈팅 매뉴얼은 `c:\Users\SEC\vibcoding\WORK_HISTORY_MANUAL.md`를 참고하십시오.

---

## 2026-10-27: 대시보드 최근 업데이트 일시(10.20 14:12) 고정 및 백엔드 데이터 파이프라인 갱신 중단 이슈

### 🚨 문제 증상 (Issue)
- 홈페이지 상단 헤더의 최근 업데이트 시간이 `2026.10.20 14:12 (KST)`에서 7일간 멈춰있고, 테이블 내 테마/종목의 업데이트 일시도 `10.20 14:12`로 고정되어 최신 시장 데이터가 갱신되지 않음.

### 🔍 원인 분석 (Root Cause)
1. **네이버 테마별 종목 API 400 Bad Request 에러**:
   - `update_themes.py`의 `fetch_theme_stocks`에서 호출하던 URL에 `marketType=ALL`이 포함되어 있었으나, 네이버 금융 API에서 `marketType` 허용값을 `KOSPI` | `KOSDAQ`로 제한하고 `ALL`을 유효하지 않은 열거형(`invalid_enum_value`)으로 처리하여 400 Bad Request를 반환함.
   - 또한 응답이 배열이 아닌 객체(`{"items": [...], "hasNext": true}`)로 변경되었고, 페이지 크기 파라미터가 `pageSize=100`이 아닌 `size=100`으로 변경됨.
   - 이로 인해 모든 테마의 소속 종목 수집이 0건으로 실패함.
2. **0건 방어 가드로 인한 덮어쓰기 중단**:
   - 소속 종목이 0건이 되자 `update_themes.py`의 안전장치(`if not final_themes or len(theme_details) == 0...`)가 작동하여 기존 캐시 파일을 빈 파일로 덮어쓰지 않고 보호하며 종료됨.
3. **GitHub Actions 커밋 및 푸시 누락**:
   - 매시 정각 GitHub Actions가 실행되었으나, 파일이 변경되지 않아 `git diff --staged --quiet`에 걸려 커밋/푸시가 일어나지 않음.
   - 또한 원격 저장소 워크플로우에 `permissions: contents: write`가 누락되어 있었고, root의 `data/*.json` 동기화가 누락되어 있었음.
4. **무한 대기(Hang) 및 순차 실행 지연**:
   - `fdr.DataReader`가 `requests.get` 타임아웃 없이 호출되어 네트워크 지연 시 스레드가 무한 대기하는 현상이 있었으며, 4,300+개 종목을 1건씩 순차 실행하여 1회 갱신에 65분 이상 소요됨.

### ✅ 조치 및 해결 (Fix)
1. **`update_themes.py` API 호출 및 파싱 로직 전면 개편**:
   - `fetch_theme_stocks` URL에서 `marketType=ALL` 제거, `size=100` 및 cursor 기반 동적 페이지네이션 구현.
   - `data.get('items', [])` 및 `itemCode` / `itemcode` 양방향 키 파싱 적용.
   - 4초 타임아웃이 적용된 직관적 일봉 캔들 패처(`fetch_daily_candles`) 구현으로 네트워크 지연 시 행(Hang) 완벽 차단.
   - `ThreadPoolExecutor(max_workers=8)` 기반 50개 단위 배치 병렬화로 4,300개 전종목 처리 시간을 **65분 ➔ 1분 50초**로 30배 이상 획기적 단축.
2. **`main.py` 캐시 자동 최신 파일 우선 정렬**:
   - `get_themes()` 및 `get_stocks_fundamentals()`에서 캐시 파일 후보군을 `os.path.getmtime` 내림차순으로 정렬하여, 어떤 디렉토리든 가장 최신 파일이 즉각 서빙되도록 보장.
3. **`.github/workflows/update-data.yml` 동기화 보강**:
   - `permissions: contents: write` 추가.
   - 생성된 데이터를 `data/`, `dajavata_backend/data/`, `dajavata/dist/data/` 3대 디렉토리에 일괄 복사 및 동시 스테이징(`git add`) 커밋/푸시 적용.
4. **프론트엔드 날짜 처리 및 캐시 버스팅**:
   - `app.js`의 `getKstDate()`에 `MM.DD HH:mm` 포맷 자동 연도 보정 파서 추가.
   - `index.html`에서 `app.js?v=14` 캐시 버스팅 파라미터 적용.
5. **로컬 데이터 갱신 완료**:
   - 2026-10-27 기준 264개 전체 테마, 4,319개 전종목 데이터 정상 갱신 완료.


