# 팀 개발 시작점 검증 기록

검증일: 2026-11-07(Asia/Seoul). 대상: 이 PR의 신규 1:N 업무·화면·인증·분석과 함께 보존한 기존 코드. 이전 `VERIFICATION.md`의 결과를 이번 변경의 통과 증거로 재사용하지 않았다.

## 1. 결과

| 검사 | 실제 실행 환경·명령 | 결과 |
|---|---|---|
| 기준 문서 | `python3 tools/check_doc_versions.py` | **9개 문서 통과**. 로컬 머리말 버전·개정일과 PROJECT_CONTEXT 기준표 일치 |
| 프런트엔드 | Node 24.22.1 / npm 11.9.0, `npm ci --ignore-scripts`, `npm run format`, `npm run check` | **32개 테스트 / 4개 파일 통과**, 포맷·TypeScript·ESLint 통과 |
| 프런트엔드 빌드 | `npm run build`, Next.js 16.4.5 | **성공**. 신규 starter·사업 건·신청·운영·회원가입 라우트 포함 |
| 백엔드 | Temurin 25.0.5+8 / Gradle wrapper 9.1.0, `./gradlew --no-daemon spotlessApply check bootJar` | **109개 테스트 / 25개 suite 통과**, 실패·오류·건너뜀 0. Spotless·ArchUnit·실행 JAR 생성 성공 |
| 백엔드 DB | 실제 PostgreSQL 17.11. `BOAN_TEST_JDBC_URL/USER/PASSWORD`로 별도 합성 검증 DB 연결 | Flyway **6개 migration 적용**, JPA validate·DB 통합 테스트 통과. Docker/Testcontainers 실행 결과와 구별 |
| 실제 HTTP 업무 흐름 | 실행 JAR + Next 운영 서버의 `/api` 프록시 + 별도 PostgreSQL 17.11, `python3 scripts/smoke-starter.py` | **7개 그룹 통과**, 두 서류 모두 작성부터 최종 확정·다운로드·감사까지 실행 |
| 실제 응답과 화면 계약 | 위 HTTP 실행의 합성 응답을 현재 `frontend/features/request/types.ts`의 Zod 스키마로 검사 | **47개 응답 통과**: 사업 건 5, 분석 1, 신청 37, 감사 목록 3, 담당자 풀 목록 1 |
| 변경 범위 | 원본과 byte 비교, `git diff --check` | 규칙 문서 8개·`design.md`·기존 migration 3개 보존, 디자이너 저장소 수정 없음, 공백 오류 없음 |
| CI 구성 | `.github/workflows/development-starter.yml` YAML·job·명령·권한 정적 확인 | 문서/프런트/백엔드 3개 job 작성. 실제 원격 실행 상태는 해당 PR의 Checks를 확인 |

HTTP 실행에서는 migration 전용 계정과 `NOSUPERUSER`인 `boan_app` 실행 계정을 구분했다. 데이터·계정 암호·암호화 키는 실행 때 생성한 합성 검증 자료다. 토큰·암호·원문 파일을 이 기록에 포함하지 않는다. 패턴 기반 비밀값 점검에서 발견된 항목은 없었지만, 이를 포괄적인 보안 인증으로 해석하지 않는다.

## 2. 실제로 확인한 업무·거부 경로

### 서버 도메인·DB 통합 검사

- 공통 답변 1회 수집, 문서 종류 중복 금지, 신청별 단계·할당·협의의 독립 진행.
- INFRA 할당 전 SECURITY 검토 거부, 할당 완료와 분야별 협의 완료의 구분, 두 분야 협의 이후 최종 검토.
- 출처·원문 근거를 가진 미확정 AI 후보, 사람 확인, 이미 확인한 값 보호, 분석 대상 revision·소유자·기관 검사.
- 보완 요청·답변·요청 분야의 해결 확인, 사유 없는 반환 거부, 반환 후 기존 값과 이력 보존.
- 현재 배정자만 변경 명령 수행, 자기 신청 담당 금지, 같은 기관 비배정 담당자 읽기와 명령 권한 분리, 관리자 재배정과 기존 기한 보존.
- 미확정·필수 누락·협의 미완료 제출 차단, 멱등 제출, 불변 제출본, 같은 제출본의 INFRA→SECURITY 최종 확인과 SECURITY 확정.
- 제출 후 공통 정보 변경 감지와 제출본 보존, 제출 전 철회·종결의 내용 스냅샷, 종료 뒤 값 변경 거부.
- 감사 저장 실패 시 업무 변경 롤백, DB의 감사·제출본·최종 확인·종료 신청 변경 차단.
- 회원가입의 역할·기관 위조 무시, 일반 사용자만 생성, 약한 암호·CSRF 없는 요청 거부, 관리자 역할 변경 revision, 로그인 성공·실패 감사.
- 기존 procedure·분석·기관 설정·암호화·업로드·외부 전송 제한 검사를 새 패키지에서도 유지.

주요 신규 검사 위치는 `backend/src/test/java/kr/securityadvisor/request/`, `CaseAnalysisIntegrationTest.java`, `MemberRegistrationIntegrationTest.java`, `llm/service/SpringAiLlmGatewayTest.java`다. 단위·통합 테스트의 HTTP 모의 클라이언트 결과와 아래 실제 서버 실행을 구분한다.

### 실행 서버 HTTP 7개 그룹

1. 역할별 실제 로그인 세션, CSRF, 관리자 전용 접근 거부.
2. 사업 건 하나에 두 서류 생성, 다른 신청자와 다른 기관의 조회 거부.
3. EXAMPLE 분석, 미확정 후보 적용, 사람 확인, 오래된 revision 거부.
4. 자동 배정, 저장된 분야별 기한, INFRA 선행, 할당과 협의 및 서류별 진행 분리.
5. 2→1 반환, 기존 값 유지·지정 항목 강조 데이터, 보완과 요청 분야 담당자의 해결 확인.
6. 두 서류 각각 협의 완료, 같은 제출의 재시도, INFRA→SECURITY 최종 확인, SECURITY 확정, 문서 다운로드·감사.
7. 담당자 풀·감사 조회, 로그아웃 후 세션 폐기.

실행 중 생성 응답의 `createdAt/updatedAt` null 문제가 발견되어 저장 후 관리 대상 엔티티를 사용하도록 수정했다. 수정한 응답을 포함한 47개 응답이 화면 스키마를 통과했다. 종료 스냅샷과 제출본의 문구·버전 혼동, 기본 메모리 계정 자동 생성도 검토 과정에서 수정했다.

### 화면 코드 검사

Vitest/Testing Library에서 AI 근거·미확정 표시, 확인 후 저장, 파일 선택만으로 업로드하지 않음, 분석과 적용의 분리, revision 충돌 시 입력 보존, 재인증 뒤 탭 메모리 초안 복구, 종료 상태의 조회 전용 표시를 확인했다. 합성 시연의 상태 전이 검사는 실제 서버 권한 검증을 대체하지 않는다.

## 3. 실행하지 못했거나 완료로 판정하지 않은 항목

| 항목 | 상태·이유 | 다음 인수 작업 |
|---|---|---|
| 실제 브라우저 화면·좁은 화면·키보드 전 과정 | **미검증**. Chromium이 시작 단계에서 실행 환경의 Unix socket 권한 제한으로 종료되어 화면을 관찰하지 못함. 스크린샷 통과로 보고하지 않음 | 디자이너/프런트 담당자가 1440px·390px, 키보드, 글자 확대, 빈 상태·오류를 실제 브라우저에서 확인 |
| Docker Compose 전체 기동·이미지 빌드·재시작 | **미실행**. 이 검증 환경에 Docker daemon이 없음. JAR/Next/실제 PostgreSQL 실행은 통과했지만 컨테이너 구동을 증명하지 않음 | 팀원이 README의 `docker compose --profile app up -d --build`로 교차 구동 |
| Testcontainers 기본 경로 | **로컬 미실행**. 같은 통합 테스트를 외부 PostgreSQL 환경변수 경로로 실행 | CI 또는 Docker가 있는 개발 환경에서 기본 경로 실행 |
| 실제 외부 LLM 2종 | **미실행**. EXAMPLE와 모의 HTTP 응답의 OpenAI/Gemma 프로토콜 검사만 수행 | 허용된 엔드포인트·환경변수 키 참조로 두 모델의 실제 호출·실패·근거 품질 증거 확보 |
| 공개자료 RAG·pgvector 색인/검색 | **미구현·미검증**. 의존성과 새 Compose 볼륨의 extension 초기화만 준비 | 공개 자료·판본·위치 메타데이터와 VectorStore를 연결하고 근거 품질 검사 |
| 기관 운영 세부 편집 | 새 LLM 구성·회원 역할 관리 API는 있으나 신규 편집 화면은 미연결. 질문·기한은 seed, 기한은 5영업일·공휴일 빈 목록 | 기관별 질문 게시본·담당자 풀·공휴일·모델 선택·회원 편집 화면 인수 |
| F-15~F-17 실행 기능 | 정책 수명주기·지표·알림은 구현 예정. 준비 테이블은 기능 완료를 뜻하지 않음 | 명세의 P2 착수 조건과 팀장 결정에 따라 별도 PR |
| 사람 리뷰·병합 | 이 검증은 작성자 외 사람의 승인을 대체하지 않음 | AGENTS 8장에 따라 사람 1명 이상 승인 후 Squash merge |

원격 CI가 성공하더라도 실제 외부 모델, 수동 화면·접근성, Docker Compose 전체 교차 구동까지 자동으로 완료된 것은 아니다. 해당 결과는 각각의 실행 증거로 추가한다.

## 4. 팀원이 재현하는 순서

1. README대로 환경을 준비하고 `python3 tools/check_doc_versions.py`를 실행한다.
2. `backend`에서 `./gradlew spotlessApply check bootJar`, `frontend`에서 `npm run format`, `npm run check`, `npm run build`를 실행한다.
3. 실제 서버를 기동한 뒤 저장소 루트에서 `python3 scripts/smoke-starter.py`를 실행한다. 기본 주소는 `http://127.0.0.1:3000`이며 필요하면 `BOAN_TEST_BASE_URL`을 지정한다. 이 스크립트는 새 합성 사업 건·신청·감사 이력을 만든다.
4. `/starter`에서 화면 설명을 확인하고, 실제 `/login` 이후 같은 흐름을 역할별 계정으로 직접 수행한다.
5. PR에 실행 환경과 실제 결과를 기록한다. 기존 `scripts/smoke.py`·`docs/VERIFICATION.md`는 이전 procedure 모델의 검증이다.

시안 출처와 버전은 [SOURCE_REFERENCES.md](SOURCE_REFERENCES.md), API는 [starter-api.md](starter-api.md), 팀별 다음 작업은 [development-handoff.md](development-handoff.md)를 따른다.
