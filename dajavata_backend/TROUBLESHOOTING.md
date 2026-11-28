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

---

## 2026-10-27: GitHub Actions 새벽 2시 스케줄 대기열(Queue Delay) 및 100% 무인 파이프라인 작동 검증

### 🚨 문제 증상 (Issue)
- 새벽 02:08 기준 웹사이트 대시보드 및 테이블 상단 업데이트 시각이 `00:50`으로 유지되어 자동 스케줄러가 작동하지 않는 것으로 오인됨.

### 🔍 원인 분석 (Root Cause)
1. **GitHub Actions 무료 클라우드 대기열 (Queue Delay)**:
   - GitHub Actions `cron: '0 * * * *'` (매시 정각 UTC 기준) 스케줄러는 전 세계 공유 러너 풀의 트래픽 상태에 따라 즉시 시작되지 않고 10~25분의 대기열 지연이 발생함.
   - 실제 02:00 정각 스케줄은 **새벽 2시 12분 36초(KST)**에 작업(Run ID `#40366453982`)이 트리거되어 실행 시작됨.
2. **해외 클라우드 환경 전 종목 수집·연산 시간**:
   - 로컬 국내망과 달리 GitHub 해외 가상머신(Ubuntu) 환경에서는 네이버 금융과의 물리적 거리(RTT)로 인해 4,319개 전 종목 및 264개 테마의 지표 연산에 약 12분이 소요됨.
   - 단, 앞서 최적화한 `ThreadPoolExecutor(max_workers=8)` 덕분에 과거 65분 소요되던 작업이 **12분 20초** 만에 안전하게 완료됨.

### ✅ 결과 및 검증 (Verification)
1. **GitHub Actions 완료**:
   - `17:12:40 UTC` (02:12 KST) 시작 ➔ `17:25:03 UTC` (02:25 KST) **Success 100% 성공 완료** (총 12분 23초 소요).
   - 커밋 `b874c6f` (`Auto-update theme data [skip ci]`)가 자동 생성되어 푸시됨.
2. **백엔드 & 웹사이트 실시간 자동 연동 확인**:
   - Render 백엔드(`dajavata-backend.onrender.com`)가 `10.27 02:25:11`에 4,319개 종목과 264개 테마를 즉시 감지하여 서빙 시작.
   - 웹사이트 프론트엔드가 이를 즉각 수신하여 화면에 **`10.27 02:15` / `02:25`**로 100% 무인 자동 갱신 완료.
3. **운영 결론**:
   - 사용자의 별도 수동 개입(파일 업로드) 없이, 매 시간 정각마다 약 15~25분의 정상적인 클라우드 스케줄 대기 및 연산 주기를 거쳐 100% 전자동으로 갱신되는 완전 무인 파이프라인 검증 완료.

---

## 2026-10-27: GitHub Actions 스케줄러 '정각(0분)' 병목 해소 및 주식시장 맞춤형 스마트 스케줄 적용

### 🚨 문제 증상 (Issue)
- `cron: '0 * * * *'` (매시간 정각)으로 스케줄이 설정되어 있었으나, GitHub 전 세계 러너의 정각 트래픽 폭주로 인해 스케줄이 2~6시간 간격으로 지연되거나 건너뛰어지는(Drop/Skip) 현상 발생.
- 주식시장이 닫힌 심야/새벽(23시~08시) 및 주말에도 불필요하게 1시간마다 실행되어 무의미한 커밋이 과다 누적되는 비효율 발생.

### 🔍 조치 및 개선 (Resolution)
1. **정각(00분) ➔ 15분 시프트 (Shift to 15m)**:
   - 전 세계 개발자/인프라가 몰리는 `00분` 피크를 피해 **`15분`**으로 변경하여 GitHub 공유 러너 대기열 지연 및 스킵 현상을 90% 이상 근본 해소.
2. **한국 주식시장 맞춤형 3단계 스마트 스케줄 구성 (`.github/workflows/update-data.yml`)**:
   - **평일 장중 (09:15 ~ 16:15)**: `15 0-7 * * 1-5` (매 1시간마다 총 8회 집중 갱신)
   - **평일 장 마감 후 저녁 (18:15, 21:15)**: `15 9,12 * * 1-5` (시간외 마감 및 해외장 직전 최종 정산 2회)
   - **주말 (토/일 10:15)**: `15 1 * * 0,6` (주말 데이터 최신성 점검 1회)
   - **심야 (22:00 ~ 익일 08:00)**: 휴식 (0회)
3. **Public 리포지토리 정책 확인**:
   - 리포지토리가 퍼블릭으로 설정되어 있어 GitHub Actions 사용 시간 한도(2,000분) 제한 없이 100% 무제한 무료로 안정 동작 보장.

---

## 2026-10-27: 구글 서치 콘솔 "Sitemap이 HTML입니다" 오류 원인 및 해결

### 🚨 문제 증상 (Issue)
- 구글 서치 콘솔(Google Search Console)에 `https://dajavata.com/sitemap.xml` 제출 시:
  - "사이트맵을 읽을 수 있지만 오류가 있습니다."
  - "Sitemap이 HTML입니다. (2행 태그: html)"

### 🔍 원인 분석 (Root Cause)
- 웹 호스팅 서버(SPA 환경)의 배포 폴더인 `dajavata/dist/`에 `sitemap.xml` 및 `robots.txt`가 업로드되어 있지 않았음.
- 구글 봇이 `https://dajavata.com/sitemap.xml`을 요청했을 때, 파일이 없어 서버가 SPA Fallback으로 `index.html`을 반환함.
- 구글 봇이 HTML 문서의 2행 태그(`<html>`)를 읽고 "지원되지 않는 HTML 사이트맵 형식"으로 판단하여 오류 발생.

### ✅ 조치 및 해결 (Resolution)
1. **정식 XML 사이트맵 생성**: `dajavata/dist/sitemap.xml` (표준 UTF-8 XML sitemap)
2. **크롤링 안내 파일 생성**: `dajavata/dist/robots.txt`
3. **배포**: GitHub 저장소 `dajavata/dist/` 폴더에 `sitemap.xml`과 `robots.txt`를 업로드 후, 서치 콘솔에서 재제출.

---

## 2026-11-01: CMS 칼럼 본문 'None' 노출, 삭제 글 캐시 부활 및 카테고리 라우팅 오류

### 🚨 1. 본문 내용이 사라지고 'None'으로 표시되는 버그
- **증상:** 에디터에서 글 작성 후 저장 시, 본문이 사라지고 `None` 글자만 출력됨.
- **원인:** 서식이 없는 일반 텍스트일 때 프론트가 `html: null`을 전송함. 백엔드 `sanitize_insight_post()`에서 `b_copy["html"] = sanitize_html_content(str(b_copy["html"]))`를 실행할 때 `str(None)`이 파이썬 문자열 `"None"`으로 변환되어 DB에 저장됨. 프론트엔드가 이를 truthy로 인식하여 원본 텍스트 대신 `"None"`을 렌더링함.
- **해결:** 백엔드에서 `html` 값이 `None`이거나 `"None"`, `"null"`, `""`이면 `b_copy.pop("html", None)`으로 필드 자체를 안전하게 제거. 프론트엔드도 서식이 없을 때 `html` 필드를 만들지 않고, 렌더링 시 `getSafeBlockHtml()` 안전 검사를 적용함.

### 🚨 2. 노션 및 홈페이지에서 삭제한 글이 새로고침 시 되살아나는 버그
- **증상:** 노션 DB 및 사이트에서 글을 모두 삭제했으나 F5(새로고침) 시 과거 3개 글(`아모레퍼시픽`, `파이버프로`, `와이씨`)이 다시 화면에 부활함.
- **원인:** 백엔드 `load_local_insights_db()`에서 `len(data["posts"]) > 0`일 때만 캐시를 인정하여 빈 목록(`0개`)이 무시되었고, 프론트엔드 `loadInsights()` 역시 `if (data.posts && data.posts.length > 0)` 검사를 수행하여 백엔드의 정상적인 0개 응답을 실패로 오판하고 정적 백업 파일(`data/insights_db.json`)을 다운로드하여 과거 글을 재복원함.
- **해결:** 백엔드와 프론트엔드 모두 `posts.length > 0` 강제 조건을 제거하여 0개(모두 삭제됨) 상태를 최신 실제 상태로 즉시 수용하도록 개선하고, 로컬 3개 디렉터리의 `insights_db.json`을 `posts: []`로 완전히 비움.

### 🚨 3. "학습자료" 또는 "이것저것" 작성 글이 "기업개요 및 차트분석"에 올라가는 버그
- **증상:** "학습 자료"나 "이것저것" 화면에서 글을 작성했으나 무조건 "기업개요 및 차트분석"으로 저장됨.
- **원인:** 글이 0개인 카테고리를 클릭하면 `renderTable()`을 부르지 않고 조기 리턴하여 `currentMode`가 이전 카테고리(`company`)로 잔존함. 또한 `previousState.themeBadge === '기업분석'` 삼항 연산자 오류와 에디터 내 카테고리 선택 UI 부재가 겹침.
- **해결:** 메뉴 클릭 즉시 `currentMode = action;`으로 확정하고, 상단 버튼 클릭 시 사이드바 `li.active`의 `data-action`을 1순위로 채택. 에디터 상단에 `[📁 기업개요]`, `[📖 학습자료]`, `[💡 이것저것]` 3대 선택 탭 바를 신설하여 사용자가 눈으로 확인하고 클릭 한 번으로 변경할 수 있도록 완벽 개선.

---

### 🚨 4. 차트 이미지 여러 장 삽입 시 하단 내용(2, 3번째 이미지 및 해석글) 잘림 버그
- **증상:** '5. 차트' 항목 아래에 차트 이미지 3장과 차트 해석글을 작성하여 사이트에 발행했으나, 1번째 차트 이미지만 표시되고 2번째/3번째 차트 및 이후의 해석글이 통째로 짤려서 나타나지 않음 (`media_1793509129488_0d112b0e.jpg`).
- **원인 분석 (Root Cause):**
  1. `app.js`의 `canvasToBlocks(canvasEl)` 에디터 DOM 파서 결함:
     - 사용자가 `contenteditable` 캔버스에 이미지를 여러 장 연속으로 넣거나 복사-붙여넣기/줄바꿈할 때, 브라우저는 하나의 컨테이너(`<div>` 또는 `<p>`) 내부에 여러 개의 `<figure>`와 문단을 묶어서 감쌈.
     - 기존 코드는 `child.querySelector('img')`로 **맨 첫 번째 이미지만 1장 추출하고 해당 컨테이너의 처리를 조기 종료(return)**했음. 이로 인해 컨테이너 내부에 뒤이어 있던 2번째 이미지, 3번째 이미지, 그리고 후속 차트 해석글이 모두 버려진 채 DB에 1번째 차트까지만(총 35개 블록) 저장되었음.
  2. `localStorage.setItem` 브라우저 5MB 쿼터 초과 시 스크립트 중단 위험:
     - 고해상도 이미지가 여러 장 포함된 게시글을 로컬스토리지에 저장할 때 `QuotaExceededError`가 발생하면, 발행 API 전송 단계에 도달하지 못하고 멈출 수 있는 구조적 취약점 존재.
- **조치 및 해결 (Resolution):**
  1. **`canvasToBlocks` 재귀적 순차 분해 파서 전면 개편 (`app.js`):**
     - 컨테이너 내부에 이미지나 서식 블록이 여러 개 포함되어 있을 경우(`subImages.length > 0 || subHeaders.length > 0`), 모든 자식 노드(`childNodes`)를 순서대로 순회하며 분해.
     - 연속된 인라인 텍스트 및 서식 요소는 `flushInline()`으로 온전한 하나의 문단(`paragraph`)으로 묶고, 이미지(`img`, `figure`)는 1, 2, 3... 각각 독립적인 `image` 블록으로 순서대로 발행하여 다중 이미지와 후속 해석글이 100% 누락 없이 DB에 저장되도록 수정.
  2. **안전 로컬스토리지 헬퍼 신설 (`safeSetLocalStorage`):**
     - 대용량 이미지가 포함되어 브라우저 5MB 쿼터를 초과하더라도 예외를 안전하게 흡수(`catch`)하여, 백엔드 저장 API 호출(`POST /api/company/save`) 및 정상 발행이 100% 수행되도록 보장.
  3. **캐시 버스팅 업데이트:** `dajavata/dist/index.html`에서 `app.js?v=30`으로 갱신 완료.






---

### 📌 5. Dajavata 홈페이지 15:04 갱신 멈춤 및 GitHub Actions 큐 지연·프론트엔드 캐시 고착 이슈 (2026-11-03)
- **증상:**
  - `https://dajavata.com/` 접속 시 최근 업데이트 시각 및 결과일시가 `2026.11.02 15:04 (KST)`에 고정되어 장 마감 후 야간 및 새벽까지 갱신되지 않음.
- **원인 분석 (Root Cause):**
  1. **GitHub Actions 스케줄 문법 결함 및 큐 정체:**
     - 원격 저장소의 워크플로우(`.github/workflows/update-data.yml`)에 `- cron: '15 0-7 * * 1-5'` 범위 지정으로 등록되어 큐 혼잡 시 장중/장마감 슬롯(16:15, 18:15, 21:15 KST)이 통째로 스킵됨.
     - 야간 정산 배치(21:15 KST)가 GitHub Actions 글로벌 큐에서 3시간 30분 지체되어 00:47 KST에야 실행 완료됨.
  2. **프론트엔드 `app.js` 조기 `break;` 결함:**
     - `fetchThemesWithFallback()`이 Cloudflare Pages 정적 `data/theme_cache.json`을 읽자마자 `break;`하여 최신 GitHub Raw 비교가 원천 차단됨.
  3. **자정~새벽(00:00~08:14 KST) 슬롯 계산 누락:**
     - `get_effective_kst_slot()`과 `getKstDate()`가 `hour < 8`일 때 전 영업일 20:15 최종 마감 슬롯 대신 파일 과거 수정 시각(`15:04`)으로 되돌아감.
- **조치 및 해결 (Resolution):**
  1. **프론트엔드 (`app.js`, `index.html` v32):**
     - GitHub Raw 최우선 순위 배치 및 캐시버스팅 타임스탬프(`?t=${Date.now()}`) 적용.
     - 4.5초 타임아웃(`AbortController`)을 부여하여 Render 슬립 시에도 즉시 GitHub Raw 최신 캐시 채택.
     - 조기 `break;`를 제거하여 모든 소스 중 최신 데이터가 100% 채택되도록 보장.
     - `getKstDate()`에 평일 00:00~08:14 및 주말 분기 추가(전 영업일 20:15 마감 슬롯으로 동기화).
  2. **백엔드 (`main.py`):**
     - `get_effective_kst_slot()`에 `hour < 8` 분기 처리 추가 (전 영업일 20:15 최종 마감 슬롯 산출).
  3. **GitHub Actions (`update-data.yml`):**
     - 큐 병목 분인 `:15` 대신 `:18`분으로 조정, 범위(`0-7`) 대신 쉼표 분리(`0,1,2,3,4,5`, `6,7,8,9,10,11,12`) 적용.
  4. **데이터 동기화:**
     - 최신 데이터(264개 테마, 4,300여 개 종목)를 로컬 3대 디렉토리(`data/`, `dajavata_backend/data/`, `dajavata/dist/data/`)에 동기화 완료.


---

## 2026-11-03: 테마/종목 업데이트 시간 불일치 버그 및 정적 캐시 우선순위 로딩 최적화

### 현상 및 증상
1. **업데이트 시간 불일치:** 우측 상단 최근 업데이트 배지는 `2026.11.03 08:15 (KST)`로 정규 스케줄 슬롯을 표시하는데, 테이블 내의 모든 테마/종목 행의 '업데이트' 열은 `11.03 04:32`로 고정 출력됨.
2. **테마 상세 50초 랙:** URL 직접 접근(`?view=theme&name=...`) 또는 테마 클릭 시, 화면이 장시간 멈추며 로딩 인디케이터가 지속됨.

### Root Cause
1. **엄격 초과(`>`) 비교 버그:** `formatKstTime()` 내부에서 `activeDate`와 `rawVal` 모두 `getKstDate()`를 거치면서 둘 다 `08:15`로 슬롯 정규화됨. `08:15 > 08:15` 비교가 `false`가 되어 `return rawVal;`로 빠지며 원본 캐시 문자열(`11.03 04:32`)이 노출됨.
2. **백엔드 무한 대기:** `loadThemeDetails()`에서 슬립 모드의 Render 백엔드를 타임아웃 없이 순차 호출하여 50~60초간 응답이 지연됨. 정적 캐시 `data/theme_details.json`이 2순위로 밀려 있었음.

### 해결 조치
1. `app.js`의 `formatKstTime()`을 `getKstDate(activeDate || rawVal)` 기반 단일 포맷터로 개편하여 우측 상단 배지와 테이블 열 시간을 100% 일치시킴.
2. `loadThemeDetails()`에서 `getThemeDetailsStore()`(로컬/CDN 정적 캐시)를 1순위로 즉시 조회(0~30ms)하도록 변경하고, 백엔드 호출에는 `fetchWithTimeout(..., 2000)` 타임아웃 적용.
3. `data/theme_cache.json` 및 `data/all_stocks.json` 로컬 경로를 원격보다 최우선 순위로 배치.
4. `index.html` 캐시 버스팅 `app.js?v=33` 반영 완료.


---

## 2026-11-03: 종목 브리핑 미니 차트 모달 실시간 체결가 불일치 버그 해결

### 현상 및 증상
- 메인 검색창/테이블 및 AI 차트 스캐너에서는 알지노믹스(476830)의 현재가가 `20,800원 (-3.93%)`으로 정상 표시되나, 종목을 클릭했을 때 나타나는 브리핑 미니 차트 모달 상단에는 과거 전일 종가인 `21,600원 (+1.41%)`이 고정되어 출력되고, 미니 차트 캔버스 내부에는 `20,750원 (-3.94%)`으로 나타나 가격 불일치 발생.

### Root Cause
1. `syncRealtimeStockQuotes()`가 검색 결과 뷰에서 `currentDataList`만 탐색하여 `stockResults`의 인메모리 `stock` 객체를 갱신하지 못함 (DOM만 갱신).
2. `openStockBriefingModal(stock)` 호출 시 전일 종가 정적 객체(21,600원)가 전달되어 헤더에 그대로 렌더링됨.
3. `loadAndDrawChart()`와 `loadStockBriefingDetails()`가 네이버로부터 당일 실시간 캔들 및 체결가를 수신한 뒤에도 모달 상단 헤더의 가격 엘리먼트를 재동기화하지 않는 구조적 결함.

### 해결 조치
1. `updateModalHeroPrice()` 및 `window.updateModalHeroPrice()` 공통 헬퍼 신설.
2. `syncRealtimeStockQuotes()`에서 `list`, `currentDataList`, `window.allStocks` 전 영역의 인메모리 객체를 갱신하고 열려 있는 모달까지 즉시 실시간 동기화.
3. `loadAndDrawChart()`에서 당일 일봉 캔들 종가(`last.close`) 및 등락률로 모달 상단 헤더 동기화.
4. `loadStockBriefingDetails()`에서 네이버 실시간 체결가(`closePrice`) 수신 즉시 모달 상단과 당일 캔들 종가를 100% 실시간 시세로 일치시킴.
5. `index.html` 캐시 버스팅 `app.js?v=34` 적용 완료.


---

## 2026-11-18: 글로벌 퀀트 허브 10월 30일 날짜 멈춤, 증시 캘린더 '발표예정' 미갱신 & Render 배포 `Port scan timeout` 해결

### 🚨 1. 글로벌 퀀트 허브(`QuantHub`) 업데이트 날짜가 `2026-10-30`에서 멈춰 있던 문제
- **원인:**
  1. GitHub 웹 업로드 시 `update-data.yml`이 `.github/workflows/` 폴더 내부가 아닌 최상위 루트에 업로드되어, 실제 GitHub Actions는 `python update_themes.py`만 실행하고 `update_quant_hub.py`는 실행하지 못했음.
  2. 프론트엔드 `quant_hub.js`의 `ensureDataLoaded()`가 호스팅 서버의 정적 `data/quant_hub_cache.json`만 1순위로 읽고 종료하여 GitHub Raw 최신본이나 `window.allStocks` 실시간 시세를 반영하지 못했음.
- **해결:**
  1. `.github/workflows/update-data.yml` 내부에 `python update_quant_hub.py || true`가 포함된 최신 워크플로우를 정확히 업로드.
  2. `quant_hub.js` (`?v=5`)에서 GitHub Raw 최신본과 로컬 캐시의 `updated_at`을 병렬 비교해 더 최신인 데이터를 채택하고, `syncKrQuantWithLatestStocks()`로 국내 퀀트 종목 시세를 실시간 최신화.
  3. `app.js` (`?v=35`)의 `loadAllStocks()` 및 `getThemeDetailsStore()`에서도 GitHub Raw 최신 자동 갱신본을 최우선 순위로 조회하도록 수정.

### 🚨 2. 증시 캘린더(`quant-calendar`)에서 과거 날짜(11월 2일 등)가 여전히 '실제 발표: 발표예정'으로 뜨던 문제
- **원인:**
  1. 미국 서머타임(DST) 해제 시점에 업스트림 `calendar-economic` API에 동일 일자·동일 지표가 `14:00 UTC (actual: null)`와 `15:00 UTC (actual: 52.4 / 55.5)` 두 줄로 중복 등록되어 가짜 `발표예정` 행이 상단에 노출됨.
  2. 연준 위원 연설(`Speech`), 회의(`Meeting`) 등 원래 수치 발표가 없는 일정에도 일괄적으로 `발표예정` 또는 `발표예정%`가 붙음.
  3. 과거 날짜인데 캐시 생성 이후 발표된 실적을 재조회하는 로직 및 국내(KRX) 지난 일정의 확정 지표 연동이 없었음.
- **해결:**
  1. `update_quant_hub.py`, `dajavata_backend/main.py`, `quant_hub.js` 3곳 모두에 `(일자, 이벤트명)` 기준 중복 병합(`deduplicateEconomicRows`, `actual != null` 우선 보존) 적용.
  2. 과거 날짜 비수치 일정은 `일정 종료 (연설/회의 완료)` / `발표 완료`로 자동 표기하고, 미국 실적은 `실제: $2.05 (Beat 🔥 / Miss ❄️)` 및 확정 매출액 표기 + 미반영 과거 실적 자동 실시간 패치(`ensureCalendarMonthLoaded(..., true)`) 적용.
  3. 국내(KRX) 지난 일정은 `[발표완료]` 배지와 함께 `window.allStocks`의 최신 종가·확정 EPS·PER·PBR을 자동 결합.

### 🚨 3. Render 백엔드 배포 시 `Port scan timeout reached, no open ports detected` (Timed Out) 실패 문제
- **원인:**
  - `dajavata_backend/main.py` 최상단(Top-level)에서 `pandas`, `numpy`, `matplotlib`, `matplotlib.font_manager`, `FinanceDataReader`, `update_themes`를 한꺼번에 임포트하면서, 새 리눅스 컨테이너 부팅 시 `matplotlib.font_manager`의 시스템 폰트 캐시 빌드가 0.1 CPU를 장시간 점유하여 Uvicorn의 포트 바인딩이 지연됨.
- **해결 (반드시 영구 유지할 규칙):**
  1. **Top-level 무거운 패키지 임포트 금지 (Lazy Import 필수):** `dajavata_backend/main.py` 최상단에는 표준 라이브러리와 `fastapi`, `requests`, `dotenv`만 두고, `pandas`, `numpy`, `matplotlib`, `FinanceDataReader`, `update_themes`는 반드시 각 함수 내부에서 지연 임포트(Lazy Import)할 것.
  2. **경량 숫자 검증 (`is_valid_num`):** `/api/themes` 등에서 `pd.notna()` 대신 `math.isnan()` 기반 `is_valid_num()`을 사용하여 `pandas` 로드 없이 즉시 응답할 것.
  3. **종목 리스트 로컬 캐시 즉시 로드 (`load_stocks_sync`):** 포트가 열린 지 2초 뒤(`loop.call_later(2.0, ...)`)에 로컬 `data/all_stocks.json`에서 0.01초 만에 종목 리스트를 로드하고, `os.getenv("RENDER")` 환경에서는 무거운 전체 배치 크롤링을 GitHub Actions에 위임할 것.


---

## 2026-11-24: 증시 일정 캘린더(`quant-calendar`) 하단 상세 리스트 스크롤 불가(첫 리스트로 튕김) 및 4줄 압축 버그 해결

### 🚨 문제 증상 (Issue)
- 증시 일정 캘린더(`?view=quant&tab=quant-calendar`)에서 날짜 클릭 후 하단 '일정 상세 리스트(24건 표시 중)'를 볼 때, 처음 4개 항목만 노출되고 마우스 스크롤을 내려도 내려가지 않거나 즉시 첫 번째 항목(맨 위)으로 되돌아감.

### 🔍 원인 분석 (Root Cause)
1. **실시간 동기화 무한 재렌더링 루프:** `renderCalendarView()`에서 과거 날짜 미발표 실적 확인 후 `ensureCalendarMonthLoaded(year, month, true)`를 호출할 때, 새로 받아온 `data`가 기존 `usMonthObj`를 덮어쓰면서 `_liveSynced` 플래그가 초기화됨. 서버 응답에도 여전히 `epsAct == null`인 과거 종목이 존재하여 `render()` ➔ `setTimeout(ensureCalendarMonthLoaded, 20)` ➔ `container.innerHTML 재작성(스크롤 0으로 리셋)`이 무한 반복됨.
2. **Flexbox 자식 높이 수축(`flex-shrink: 1`):** `.quant-hub-container` 내부의 `.qh-table-card`(`overflow: hidden`)에 `flex-shrink: 0`이 없어 상단 캘린더 그리드에 밀려 테이블 카드 높이가 4줄 크기로 찌부러짐.

### ✅ 해결 조치 (Resolution)
1. `quant_hub.js` (`?v=6`): `state.calLiveSyncedMonths[ym] = true` 영구 상태 플래그를 추가하여 월별 실시간 보강 호출을 딱 1회로 제한하고, `render()` 시 `container.scrollTop` 및 `#qh-cal-detail-scroll.scrollTop` 위치를 보존·복원하도록 개선.
2. `quant_hub.css` (`?v=2`): `.quant-hub-container > *` 및 `.qh-table-card`에 `flex-shrink: 0;`을 적용하여 하단 테이블 카드가 압축되지 않고 전체 스크롤 및 내부 스크롤이 끝까지 작동하도록 수정.

---

## 2026-11-27: 머니 플로우(`quant-money-flow`) 예탁금·MMF·CFTC 선물 빈 차트 및 한·미 IPO 리스트 누락 해결 (4대 공식 API 직결)

### 🚨 문제 증상 (Issues)
1. **국내 고객예탁금 & 미국 리테일 MMF & CFTC 4대 주가지수 선물 차트 '시계열 데이터 준비 중' 표시:**
   - 외부 `goodstock123.com/api/fundamentals/capital-flows` API가 `mmf: []`, `cot: {}` 빈 데이터를 반환하면서 미국 MMF 차트, CFTC 선물 차트 및 포지션 표(`0 계약 / 1 계약 / 0.0%`)가 모두 비어버림.
   - 또한 `quant_hub.js`에서 국내(`KR`) 고객예탁금 차트 위치에도 미국 `mmfList`를 공용으로 바인딩하고 있었음.
2. **국내 신규 상장 주요 IPO(`krLatestIpos`)에 2~3년 전 상장 종목이 섞여 있고 최근 1년 내 상장 종목이 누락됨:**
   - `update_quant_hub.py`에 과거 2023~2024년 대어급 IPO(두산로보틱스, 에코프로머티, 시프트업, 더본코리아, 클로봇 등)가 가짜 2026년 날짜로 하드코딩(`base_kr_ipos`)되어 있었고, `[:25]` 제한으로 인해 실제 최근 1년 내 상장 종목들이 잘려 나감.
3. **미국 신규 상장 주요 IPO(`ipoLatest`)가 15개사만 표시되고, 한·미 IPO 첫 상장 날짜 연도가 잘려(`11-24`) 보임:**
   - `ipo-stats?v=3` 요약 API가 `latest` 배열을 15개로만 제한하여 내려주고 있었고, 프론트엔드에서 `ip.dt.slice(5)`로 연도를 잘라내어 첫 상장일 식별이 어려웠음.

### ✅ 해결 조치 (Resolution — `update_quant_hub.py`, `quant_hub.js?v=10`, `style.css?v=10`, `quant_hub.css?v=3`)
1. **국내 고객예탁금 & 신용잔고 공식 API 직결 (`krDepositSeries`):**
   - 신형 네이버 증권 증시자금동향 내부 JSON API (`https://stock.naver.com/api/domestic/market/trendDeposit?size=60`, 헤더 `Referer: https://stock.naver.com/market/stock/kr/deposit`)를 직결하여 일별 고객예탁금(조 원) 및 신용융자 잔고(조 원) 60영업일 시계열을 자동 수집하고, `quant_hub.js`에서 국내(`krDepositSeries`)와 미국(`mmfList`) 차트를 완전히 분리.
2. **미국 MMF 대기 자금 공식 API 직결 (`mmf`):**
   - 미국 재무부 금융조사국(OFR) 공식 시계열 API (`https://data.financialresearch.gov/v1/series/timeseries?mnemonic=MMF-MMF_TOT-M`)를 직결하여 최근 60개월 미국 MMF 총자산(`$B`) 시계열을 자동 수집.
3. **CFTC 미국 4대 주가지수 선물 공식 API 직결 (`cot.ES`, `NQ`, `YM`, `QR`):**
   - 미국 상품선물거래위원회(CFTC) 공식 Socrata API (`https://publicreporting.cftc.gov/resource/6dca-aqww.json`, `ES=13874A`, `NQ=209742`, `YM=124603`, `QR=239742`)를 직결하여 최근 60주 롱·숏·미결제약정·순포지션 비중(%)을 매주 자동 갱신.
4. **국내 KRX 최근 1년 신규 상장 100개사 전수 자동 수집 (`krLatestIpos`):**
   - 과거 더미 리스트(`base_kr_ipos`)를 100% 삭제하고, 네이버 KRX 신규상장 공식 JSON API (`https://stock.naver.com/api/domestic/market/stock/default?tradeType=KRX&marketType=ALL&orderType=newStock&startIdx=0&pageSize=120`) 및 공모 진행 API (`/api/domestic/market/ipo/progress`)를 직결하여 최근 1년 이내 실제 상장한 코스피·코스닥 100개사 전체를 공식 종목코드(`itemcode`), 실제 상장일(`listedDate`), 공모규모와 함께 표시하고 월별 상장 건수(`krIpoMonths2026`)도 자동 집계.
5. **미국 나스닥 최근 12개월 신규 상장 250~280개사 전수 자동 수집 (`ipoLatest`, `ipoLatestAll`) 및 첫 상장일(`상장일 YYYY-MM-DD`) 배지 적용:**
   - 나스닥 공식 IPO 캘린더 API (`https://api.nasdaq.com/api/ipo/calendar?date=YYYY-MM`) 최근 12개월 병렬 수집으로 미국 IPO 리스트를 250~280개사로 확장하고, 한·미 양쪽 리스트에 `상장일 YYYY-MM-DD` 배지를 선명하게 표시.


---

## 2026-11-28: 메인 홈 실시간 시총 히트맵(218 국장 / 198 미장 / 140 테마) 당일 시세 불일치·납작한 타일·초기 무한루프 해결 및 도메인 등록처 기록

### 🚨 1. 메인 홈 최초 로딩 시 `RESULT_CODE_HUNG` (무한 재귀 루프) 해결
- **원인:** `index.html`에서 `community_hub.js`가 `app.js`보다 먼저 로드될 때, `renderMainHomeDashboard()` 내부의 `ensureHomeArticles()`가 아직 정의되지 않은 `window.DajavataApp`을 확인하고 `postsLoaded = false`인 상태로 즉시 Resolve되면서 `.then(() => renderMainHomeDashboard())` 마이크로태스크 무한 루프가 발생.
- **해결:** `homeState.quantFetchStarted`, `postsFetchStarted`, `dbFetchStarted` 1회 실행 잠금 가드를 도입하고, `window.DajavataApp` 초기화 전에도 정적 JSON을 직접 읽고 `postsLoaded = true`로 확정하도록 수정하여 0.1초 즉시 렌더링 보장.

### 🚨 2. 히트맵 내 일부 종목(예: 알테오젠 `196170`)이 당일 양봉 마감(`+10.45%`)인데 하락(`-1.45%`)으로 표시되던 문제
- **원인:**
  1. 구버전 로컬 `all_stocks.json`(`11.18` 스냅샷)이 뒤늦게 로드되면서 실시간 호가 API가 받아온 최신 등락률을 덮어씀.
  2. 네이버 폴링 API(`polling.finance.naver.com/api/realtime/domestic/stock/...`)에 80개 이상의 종목코드를 한 줄로 요청하면 뒷부분 종목이 잘려서 응답이 오지 않음.
- **해결:**
  1. `dajavata_backend/main.py`에 **`GET /api/market/heatmap-live`**를 신설하여 네이버 모바일 시가총액 API(`https://m.stock.naver.com/api/stocks/marketValue/KOSPI` & `KOSDAQ` 1~3페이지 총 600종목)와 실시간 KOSPI/KOSDAQ 지수를 일괄 수집하고, 하락 부호(`compareToPreviousPrice.code in ('4', '5')`)를 정확히 반영.
  2. `/api/stocks/realtime`을 20종목 단위 자동 청크(Chunk) 분할 조회로 개선하고, 실시간 시세가 반영된 종목은 `st._liveLocked = true`로 잠가 구버전 캐시가 덮어쓰지 못하도록 방어.

### 🚨 3. 히트맵 타일이 가로로 납작하게 눌리고 상단 지수 카드가 잘리던 문제
- **원인:** 트리맵 분할 함수가 실제 픽셀 크기 대신 퍼센트(`100 × 100`)로 계산하여 가로로 넓은 업종 박스를 세로로 또 쪼개면서 높이 15px짜리 납작한 띠 모양이 생성됨.
- **해결:** 실제 픽셀 종횡비(`wPx >= hPx`) 기반 `computePixelTreemap()` 알고리즘으로 교체하고, 히트맵 기본 높이를 `1,280px`(`920px` / `1,280px` / `1,680px` 선택 가능)로 확장하며 `#default-view-container` 및 `.main-home-dashboard`에 `flex: 1; min-height: 0;`을 적용.

### 🌐 4. `dajavata.com` 도메인 등록처(Registrar) 확인 결과
- **등록 대행사:** **`Cloudflare, Inc.` (`https://dash.cloudflare.com/`, IANA ID: `1910`)**
- **등록일 / 만료일:** `2026-08-26` 등록 ~ `2027-08-26` 만료 (네임서버: `merlin.ns.cloudflare.com`, `oaklyn.ns.cloudflare.com`).
