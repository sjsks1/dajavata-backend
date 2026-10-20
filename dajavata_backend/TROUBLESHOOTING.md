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
