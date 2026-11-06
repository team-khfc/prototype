# 보안길잡이 — 새 개발 프로토타입

**SecurityAdvisor(보안길잡이)**는 보안을 모르는 공공기관 담당자와 정보보안·ICT인프라 담당자 사이의 지식 중계를 돕는다. 사업 내용을 한 번 설명하고, AI의 미확정 제안과 담당자의 확인을 거쳐 **방화벽신청서·보안성검토 신청서**를 각각 작성·제출·확정한다.

이번 시작점은 **최신 규칙과 prototype-soo 시안을 기준으로 실행 구조를 하나로 구성**했다. 이전 `/workspace`, `/requests`, `/admin`, `/design-preview` 화면과 `procedure/analysis/institution` 예제 API·샘플은 제거했다. 현재 업무 불변식과 검증된 보안 유틸리티는 새 컨텍스트에 배치했다. 과거 구현·검증 기록은 Git 이력에서 찾는다. 이미 병합된 Flyway SQL과 기존 DB 자료는 삭제하거나 변경하지 않는다([결정 기록](docs/adr/0003-fresh-baseline.md)).

이 저장소는 팀원이 개발을 시작하는 프로토타입이다. 구현 범위·실행한 검사·남은 작업은 [검증 기록](docs/verification-fresh.md)과 [팀 인계](docs/development-handoff.md)에 구분한다. 최종 개발 결과는 [team-khfc/Security-Advisor](https://github.com/team-khfc/Security-Advisor)에 모은다.

## 1. 화면부터 실행하기

Node.js 24 환경에서 저장소 루트 기준으로 실행한다.

```bash
cd frontend
npm ci
npm run dev
```

`http://localhost:3000`을 열면 `/starter`로 이동한다. **백엔드 없이도** 합성 사업 건·서류 2종·역할 4종의 흐름을 살펴볼 수 있다. 역할별 보기는 브라우저 메모리 시연이며 실제 로그인이나 서버 권한 검증이 아니다. 새로고침하면 시연 자료가 초기화된다.

| 경로 | 용도 | 데이터 경계 |
|---|---|---|
| `/`, `/starter` | 공통 정보, 두 서류, 역할별 협의·반환·확정 시연 | 합성 메모리 자료 |
| `/login`, `/signup` | 실제 계정 로그인·신청자 가입 | 서버 세션·CSRF·DB |
| `/business-cases` | 사업 건 생성·공통 인터뷰·문서 분석 | `/api/business-cases` |
| `/security-requests` | 신청별 독립 상태·협의·반환·제출·확정 | `/api/security-requests` |
| `/operations` | 담당자 후보·감사 조회, 계정 역할·LLM 연결 구성 | 같은 기관 관리자 API |

시안의 배치·토큰·출처 표시를 참고하면서 단계·상태·권한은 FUNCTIONAL_SPEC을 따른다. 최신 시안의 `제출 준비`, `처리 완료/불가` 표현은 현행 명세의 `최종 검토 중`, `확정/종결(반려)`로 표시한다. **design.md와 디자이너 저장소는 수정하지 않았다.** 참고 커밋과 차이는 [출처 기록](docs/SOURCE_REFERENCES.md)에 있다.

## 2. 실제 서버·DB까지 실행하기

필요 환경은 Docker Engine, Compose v2, Python 3이다. 프로젝트 루트에서 실행한다.

```bash
python3 scripts/init-demo.py
docker compose --profile app up -d --build
```

`init-demo.py`는 DB 암호·역할별 합성 계정 암호·기관 컨텍스트 암호화 키를 로컬 `.env`에 생성한다. 실제 값은 해당 파일에서 확인하며 코드·Git·영상에 넣지 않는다. 기존 `.env`는 덮어쓰지 않는다. 이전 checkout의 `.env`가 있다면 새 checkout에서 새 파일을 만들거나 `.env.example`의 **SA_*** 이름으로 직접 맞춘다. 구형 환경변수는 읽지 않는다.

| 주소 | 용도 |
|---|---|
| `http://localhost:3000/login` | 실제 역할별 로그인 |
| `http://localhost:3000/signup` | 합성 시연 기관의 신청자 가입 |
| `http://localhost:3000/business-cases` | 새 사업 건·서류 2종 시작 |
| `http://localhost:8080/api/health` | 서버 준비 상태 |
| `http://localhost:8080/swagger-ui.html` | OpenAPI 설명 |
| `http://localhost:8080/v3/api-docs` | OpenAPI JSON |

| 역할 | 아이디 | 암호 환경변수 |
|---|---|---|
| 신청자 | `applicant.demo` | `SA_DEMO_APPLICANT_PASSWORD` |
| 두 번째 신청자 | `second.demo` | `SA_DEMO_APPLICANT_PASSWORD` |
| ICT인프라 담당자 | `infra.demo` | `SA_DEMO_INFRA_PASSWORD` |
| 정보보안 담당자 | `security.demo` | `SA_DEMO_SECURITY_PASSWORD` |
| 기관 관리자 | `admin.demo` | `SA_DEMO_ADMIN_PASSWORD` |

`outside.demo`는 다른 합성 기관의 격리 검사 계정이며 신청자 암호를 쓴다. 회원가입은 APPLICANT만 생성한다. 사업 건은 사용자가 새로 만들며 이전 예제 업무를 자동 생성하지 않는다. 실제 역할 변경은 로그아웃 후 해당 계정으로 로그인해서 확인한다.

Compose 프로젝트명은 `securityadvisor-prototype`, 새 기본 DB명은 `securityadvisor`다. 기존 Compose 프로젝트의 볼륨과 분리되며 예전 자료를 자동 이관하거나 삭제하지 않는다. SQL 계정 이름 `boan_app/boan_migrator`는 이미 병합된 Flyway의 권한 설정을 지키기 위해 남겨 둔다. 서비스·환경변수·API가 과거 예제에 의존한다는 뜻은 아니다.

새 DB 초기화는 pgvector 확장을 준비한다. 공개자료 색인·검색은 별도 구현 범위다. 종료할 때는 `docker compose --profile app down`을 사용한다. **이 프로토타입의 합성 자료를 전부 지우려는 경우에만** `docker compose --profile app down -v` 후 다시 기동한다. 보존할 암호화 자료가 있으면 볼륨과 `.env` 키를 함께 보관한다.

## 3. 개발과 검사

작업 전에 PROJECT_CONTEXT → FUNCTIONAL_SPEC → AGENTS → 프로젝트 운영·스타일·보안·협업 규칙을 읽는다. 요약 지침은 중복 없이 `claude/INSTRUCTIONS.md`에 있다.

```bash
python3 tools/check_doc_versions.py
python3 tools/check_fresh_structure.py
```

각 블록은 저장소 루트에서 시작한다. 백엔드 검사는 JDK 25와 Docker(Testcontainers)가 필요하다.

```bash
cd backend
./gradlew spotlessApply check bootJar
```

```bash
cd frontend
npm ci
npm run format
npm run check
npm run build
```

DB만 Docker로 사용하려면 루트에서 다음을 실행한다. 별도 터미널에서 프런트엔드 개발 서버를 시작한다.

```bash
docker compose up -d db
python3 scripts/run-backend.py
```

프런트엔드 서버 프록시 설정은 `SA_API_ORIGIN`이며 기본값은 `http://localhost:8080`이다. 전용 PostgreSQL 17에서 통합 검사를 실행할 때만 `SA_TEST_JDBC_URL`, `SA_TEST_DB_USER`, `SA_TEST_DB_PASSWORD`를 지정한다. 테스트 DB는 합성 자료 전용이어야 한다. 기본 검사는 Testcontainers를 사용한다.

실제 프런트엔드·백엔드·DB를 모두 기동한 뒤 루트에서 실행한다.

```bash
python3 scripts/smoke-starter.py
```

실제 HTTP·세션·CSRF로 새 사업 건과 이력을 생성하는 검사다. 주소는 `SA_TEST_BASE_URL`(기본 `http://127.0.0.1:3000`), 역할별 암호는 환경변수 또는 `.env`에서 읽는다. 운영 DB에서 실행하지 않는다. 실행 범위와 결과는 [검증 기록](docs/verification-fresh.md)을 따른다.

[CI](.github/workflows/development-starter.yml)는 PR에서 문서·구조, 프런트엔드, 백엔드 검사를 실행한다. Node.js 24.22.1, Temurin 25.0.5+8, PostgreSQL Testcontainers를 사용하고 계정 암호·암호화 키는 테스트 실행마다 생성한다. 실제 CI 통과 여부는 PR의 check를 확인한다. 워크플로우 파일만으로 브랜치 보호가 설정되지는 않는다.

## 4. 현재 구현 범위

| 영역 | 현재 출발점 | 다음 인수·구현 |
|---|---|---|
| 업무 모델 | 사업 건 1:N 신청, CASE/REQUEST 답변, 두 서류, 독립 단계·상태 | 명세별 세부 질문·서류 양식 확장 |
| 협의·확정 | 자동 배정, INFRA 할당·검토 분리, 보완·반환, 불변 제출본, INFRA→SECURITY 최종 확인·SECURITY 확정 | 실제 사용자 인수와 운영 데이터 조건 검토 |
| P1 운영 | 배정자 권한·재배정, 저장형 영업일 기한, 추가 전용 감사 | 기관별 기본 담당자·공휴일·기한 게시 계약 확장 |
| 설정 | 기관별 v1 게시본, 코드에 고정한 질문·양식·기한 | 설정 편집·게시 UI는 P2 |
| 인증 | 세션·CSRF·요청별 신원 확인, 신청자 가입, 관리자 역할 관리 | 기관 온보딩·운영 계정 정책 |
| AI | TXT/MD 분석, 근거 있는 미확정 후보, EXAMPLE/LIVE 구분, 모델 구성 선택, Spring AI 어댑터 | 실제 공급자 2종 호출·품질 평가, 대화형 인터뷰·AI 최종 초안 생성, PDF/DOCX/HWP |
| 지식 | 공개자료 메타데이터와 암호화 비공개 사실 분리 | PGVector 색인·검색·근거 품질 검증 |
| 문서 | 현재 또는 고정 스냅샷의 출처·확인·근거를 포함한 HTML 다운로드 | 제출 양식 정밀화·파일 형식 확장 |
| F-15~F-17 | 정책 수명주기·지표·알림은 설계 및 일부 테이블 준비 | 필수 경로 리허설 뒤 착수. 적용·회수·알림 생성은 미구현 |

AI 후보는 근거가 있는 **미확정 제안**이다. 확인 없이 제출할 수 없다. 기한 경과로 업무 상태를 바꾸지 않으며, 서류 확정은 방화벽 적용 완료가 아니다. 실제 기관 내부 정보·실존 개인정보는 시연·모의자료에 사용하지 않는다.

기본 EXAMPLE은 정해진 이름의 원문 행을 발췌하는 합성 시연이며 외부 LLM 호출이 아니다. LIVE 연결 구성 저장이나 프로토콜 테스트만으로 두 모델의 실제 구동을 입증하지 않는다. 현재 기한 seed는 각 5영업일·빈 공휴일 목록이다. 확정 시 방화벽 규칙 생성·적용 기록은 후속 구현 범위다.

## 5. 팀별 출발 문서

| 목적 | 문서 |
|---|---|
| 개발자·팀원별 코드 진입점과 인수 조건 | [development-handoff.md](docs/development-handoff.md) |
| 정상·반환·권한 거부·AI 실패 시나리오 | [starter-scenarios.md](docs/starter-scenarios.md) |
| 신청 API·DTO·상태·질문 키 | [starter-api.md](docs/starter-api.md) |
| 인증·회원·분석·모델·비공개 컨텍스트 API | [auth-ai-api.md](docs/auth-ai-api.md) |
| 업무 용어와 코드의 대응 | [glossary.md](docs/glossary.md) |
| 이번 시안·규칙 참조와 남은 차이 | [SOURCE_REFERENCES.md](docs/SOURCE_REFERENCES.md) |
| 기술 스택 | [ADR 0001](docs/adr/0001-tech-stack.md) |
| Spring AI 경계 | [ADR 0002](docs/adr/0002-spring-ai.md) |
| 새 단일 실행 구조와 기존 DB 이력 보존 | [ADR 0003](docs/adr/0003-fresh-baseline.md) |
| 이번 코드에서 실제 실행한 결과 | [verification-fresh.md](docs/verification-fresh.md) |

이 저장소도 기능 브랜치와 PR을 사용한다. AGENTS.md 8장에 따라 작성자 외 사람 1명 이상이 승인한 뒤 Squash merge한다. 디자인 원본은 [prototype-soo](https://github.com/team-khfc/prototype-soo)에서 디자이너가 관리하며, 다음 화면 변경 직전에 최신 커밋과 `MERGE_NOTES.md`를 다시 확인한다.
