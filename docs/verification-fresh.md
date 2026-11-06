# 새 프로토타입 검증 기록

검증일: 2026-11-07(Asia/Seoul). 기준 main: `e5054c9f60ea12a5e79ba6f09aacf5cea802a576`. 대상: 이슈 #3의 새 단일 프로토타입 변경. 이전 PR의 테스트 결과를 재사용하지 않고 이번 코드에서 실행했다. 최종 원격 커밋의 CI 결과는 해당 PR의 Checks에서 확인한다.

## 실행 결과

| 검사 | 실제 결과 | 환경·범위 |
|---|---|---|
| 문서 버전 검사 | 9개 일치 | PROJECT_CONTEXT 5장 ↔ 머리말 버전·개정일 |
| 문서 본문 보존 | 9개 일치 | 규칙 본문·design.md 불변, INSTRUCTIONS는 경로만 이동 |
| 새 구조 검사 | 실행 소스 171개 통과 | 폐기한 패키지·API·환경변수 의존 및 경로 부재 |
| 프런트 포맷·타입·린트 | 통과 | Node.js 24.22.1, TypeScript strict, ESLint |
| 프런트 테스트 | **4파일 35검사, 실패 0** | Vitest·Testing Library |
| 프런트 production 빌드 | 통과 | Next.js 16.4.5, React 19.3.1 |
| Next 실제 SSR 응답 | 6개 화면 200 및 핵심 문구 | 기본 진입 /→/starter, 구형 경로 404 |
| 백엔드 포맷·ArchUnit·검사 | **24클래스 95검사, 실패·오류·건너뜀 0** | Temurin 25.0.5+8, Gradle 9.1.0, PostgreSQL 17.11 |
| 백엔드 bootJar | 통과 | Spring Boot 4.1.2, Spring AI 2.0.0 |
| 실제 HTTP 통합 | **10그룹 통과** | Next production → Spring JAR → 실제 PostgreSQL, 분리 계정·세션·CSRF |
| 실제 응답 계약 대조 | **56응답 통과** | 서버 JSON을 현재 프런트 Zod 스키마로 검사 |
| 현재 OpenAPI | 37개 경로 생성 | 실행 JAR의 `/v3/api-docs`에서 재생성 |
| 기존 Flyway 보존 | 6개 원문 바이트 일치 | 새 migration 2개만 추가 |
| 차이 형식 검사 | 통과 | git diff --check |

기계 판독 결과는 [fresh-verification.json](evidence/fresh-verification.json), 실제 HTTP 결과는 [fresh-http.txt](evidence/fresh-http.txt), 현재 계약 스냅샷은 [openapi.json](openapi.json)에 있다. 암호·쿠키·CSRF 토큰·API 키·원문 개인정보는 증거에 포함하지 않는다.

## 실행한 명령과 환경

```bash
python3 tools/check_doc_versions.py
python3 tools/check_fresh_structure.py
```

```bash
cd frontend
npm ci --ignore-scripts
npm run format
npm run check
npm run build
```

```bash
cd backend
./gradlew --no-daemon spotlessApply check bootJar
```

```bash
python3 scripts/smoke-starter.py
```

로컬 환경에는 Docker daemon이 없어 **격리된 실제 PostgreSQL 17.11**을 직접 기동하고 `SA_TEST_JDBC_URL/SA_TEST_DB_USER/SA_TEST_DB_PASSWORD`로 통합 검사에 연결했다. H2·Mock DB로 대체하지 않았다. 이 로컬 결과를 Docker/Testcontainers 기동 통과로 표현하지 않는다. PR CI의 기본 경로는 Docker/Testcontainers다.

HTTP 검사는 테스트용 DB의 migration 계정과 비관리자 앱 계정 `boan_app`를 분리했다. 같은 실행 환경에서 PostgreSQL·빌드된 Spring JAR·Next production 서버를 함께 띄우고 실제 프록시·쿠키·CSRF를 사용했다. 모델 구성 등록·선택과 EXAMPLE 분석을 검증했으며 유료 외부 모델 호출은 하지 않았다.

## 통과한 실제 HTTP 흐름

1. 역할별 로그인·CSRF, 미인증·관리자 권한 거부.
2. 폐기한 `/workspace`, `/requests`, `/admin/models`, `/design-preview/workspace`, `/api/procedures`, `/api/institution-settings`의 404.
3. 직접 가입, role/기관 주입 방지, 관리자 역할 변경·감사 경계, 오래된 revision 거부.
4. 같은 기관 모델 구성 저장·선택 목록, 허용하지 않은 주소 거부, 일반 선택 목록의 endpoint/keyReference 제외, 다른 기관 격리.
5. 한 사업 건에서 두 신청 생성, 다른 신청자·다른 기관의 조회 차단.
6. 지정된 EXAMPLE 구성 분석, 미확정 후보 적용, 사람 확인, 오래된 revision의 저장 거부.
7. 자동 배정·저장형 기한, INFRA 할당 선행, 할당과 협의 분리, 형제 신청의 독립 진행.
8. 2→1 반환의 기존 값·이력 보존과 지정 필드 강조, 보완 답변·요청 분야의 해결 확인.
9. 두 서류 각각 협의 완료·멱등 제출·INFRA→SECURITY 최종 확인·SECURITY 확정, 문서와 감사 조회.
10. 운영 후보군·감사 목록 조회, 로그아웃 뒤 세션 폐기.

단위·DB 통합 검사에서는 추가로 3→1·3→2·4→3 반환, 불변 제출/종료 스냅샷, 계정·배정 재검사, 감사 원자성, 할당 형식 오류의 부분 저장 방지, 암호화/AAD·업로드·HTTP 제한·AI 후보 근거를 검사한다. 이력 테이블의 SELECT/INSERT만 허용하고 UPDATE/DELETE/TRUNCATE를 거부하는 role 권한도 확인했다.

## 검사 중 발견해 수정한 내용

- 제출 헤더가 필수 계약과 달리 선택으로 선언되어 있었다. Idempotency-Key 누락을 컨트롤러에서 400으로 거부하고 형식·멱등성은 도메인에서 검증하도록 수정했다.
- 기본 Testcontainers에 앱 role이 없을 수 있어 새 migration의 권한 적용에 역할 존재 검사를 추가했다. 별도의 테스트 초기화 SQL로 최소 권한도 검사한다.
- 개발자 로컬 실행의 업로드 기본 경로를 권한이 필요한 `/var/lib/...` 대신 gitignore된 `local-uploads`로 지정했다. Compose의 영속 업로드 볼륨은 별도 경로를 쓴다.
- 감사·제출본·최종 확인은 트리거 외에 앱 role 권한에서도 수정·삭제·절단을 회수했다. 기존 migration을 고치지 않고 새 SQL로 반영했다.
- 새 관리자 입력의 도움말이 접근성 이름에 중복 포함되는 부분을 label·설명으로 분리했다.

구형 기능만 다루던 테스트는 해당 앱/API 제거와 함께 제거했다. 유효한 업로드·암호화·기관 격리·모델 프로토콜·출처·신원 검사는 새 경계로 옮겼다. 실패를 숨기기 위해 기대값을 낮추거나 테스트를 비활성화하지 않았다.

## 미검증·남은 구현

| 항목 | 현재 상태 |
|---|---|
| Docker Compose 전체 로컬 첫 실행 | 이 환경에서 실행하지 못함. 팀의 Docker 환경에서 별도 인수 필요 |
| 실제 브라우저 시각·모바일·키보드/스크린리더 | 이번에 실행하지 않음. SSR·DOM 테스트와 구별 |
| 외부 LLM 2종 실제 구동 | 실행하지 않음. 연결 구성·프로토콜·EXAMPLE 검사와 구별 |
| 대화형 인터뷰·AI 최종 초안 | 추가 구현·인수 필요. 현재 HTML 문서 미리보기를 AI 생성으로 표시하지 않음 |
| 공개자료 RAG·PGVector 색인/검색 품질 | 미구현. 모듈·확장·메타데이터 제공과 구별 |
| PDF/DOCX/HWP 입력·출력 양식 정밀화 | 추가 구현. 현재 TXT/MD 입력·HTML 출력 |
| 기관별 동적 질문/기한/공휴일/기본 담당자 편집 | 현재 고정 v1 seed. 후속 운영 계약 확장 |
| 정책 수명주기·업무 지표·화면 안 알림 | 설계 및 일부 테이블 준비. 생성·적용·발송 API 미구현 |
| 배포·다른 사람의 리뷰 승인·main 병합 | PR 절차로 별도 진행. 작성자의 검사와 구별 |

구현되지 않은 기능의 버튼·테이블·문서가 있다는 이유로 완료라고 보고하지 않는다. 다음 인수 책임과 수용 기준은 [development-handoff.md](development-handoff.md), 시안 차이는 [SOURCE_REFERENCES.md](SOURCE_REFERENCES.md)에 정리했다.
