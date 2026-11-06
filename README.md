# 보안길잡이 — 팀 개발 시작점

**SecurityAdvisor**는 공공기관 사업 담당자가 사업 내용을 설명하면 AI와 정보보안·ICT인프라 담당자가 전문 정보를 보완하여 방화벽신청서·보안성검토 신청서 초안을 완성하는 서비스다. AI의 제안, 사람의 확인, 서류 제출·확정, 실제 방화벽 적용을 구분한다.

이 저장소는 팀원이 같은 화면·업무 용어·API에서 개발을 시작하도록 기존 Next.js/Spring Boot 자산을 발전시킨 시작점이다. **공개 시연 화면과 실제 세션·DB를 사용하는 업무 화면을 함께 제공한다.** 전체 대회 기능의 완료·배포·리뷰 승인을 뜻하지 않는다. 실제 실행한 검사와 남은 제한은 [이번 검증 기록](docs/verification-starter.md), 팀별 다음 작업은 [개발 인계](docs/development-handoff.md)를 확인한다.

## 1. 먼저 화면 보기

필요 환경: Node.js 24, npm. 백엔드 없이 시작할 수 있다.

```bash
cd frontend
npm ci
npm run dev
```

`http://localhost:3000/starter`를 연다. 사업 건의 두 서류, 신청별 독립 진행, INFRA 할당·검토 분리, 차수 반환, 사용자 제출, 최종 확인·확정의 화면 흐름을 확인한다. 합성 자료는 브라우저 메모리에서만 바뀌며 새로고침하면 초기화된다. **이 화면의 역할별 보기와 버튼 실행은 실제 로그인·서버 권한 검증이 아니다.**

| 경로 | 용도 | 데이터·인증 경계 |
|---|---|---|
| `/starter` | 최신 업무 흐름을 설명하는 공개 상호작용 시연 | 합성 fixture, 메모리 상태, 업무 API 호출 없음 |
| `/login`, `/signup` | 실제 로그인·신청자 회원가입 | 서버 세션, CSRF, DB 계정 |
| `/business-cases` | 사업 건 목록·생성·공통 정보 | 실제 세션 + `/api/business-cases` |
| `/security-requests` | 서류별 신청·협의·제출·확정 | 실제 세션 + `/api/security-requests` |
| `/operations` | 담당자 후보군·기한·감사 조회, P1 고정 규칙 안내 | 실제 조회 API. LLM·계정 관리 편집 UI는 신규 화면에 미연결 |
| `/design-preview/workspace` | 이전 표시 컴포넌트의 공개 읽기 전용 시안 | 합성 fixture, 저장·제출 비활성 |
| `/workspace`, `/requests`, `/admin/*` | 기존 구현을 보존한 호환·참고 경로 | 기존 `/api/procedures` 등 사용. 새 1:N 업무의 기준 경로는 위 두 자원 |

화면 이동만으로 신청의 업무 상태를 바꾸지 않는다. 서버 화면은 로그인한 사용자의 실제 역할과 서버 응답의 허용 행동을 표시한다.

## 2. 실제 세션·DB와 함께 실행

필요 환경: Docker Engine, Compose v2, Python 3. Dockerfile이 Java 25와 Node.js 24 빌드 환경을 준비한다. 프로젝트 루트에서 실행한다.

```bash
python3 scripts/init-demo.py
docker compose --profile app up -d --build
```

| 주소 | 용도 |
|---|---|
| `http://localhost:3000/login` | 역할별 계정 로그인 |
| `http://localhost:3000/signup` | 합성 시연 기관의 신청자 회원가입 |
| `http://localhost:3000/business-cases` | 새 사업 건 1:N 신청 흐름 |
| `http://localhost:8080/api/health` | 서버 준비 상태 |
| `http://localhost:8080/swagger-ui.html` | 실행 서버의 API 설명 |
| `http://localhost:8080/v3/api-docs` | 실행 서버의 OpenAPI JSON |

`init-demo.py`는 DB 암호·역할별 시연 암호·기관 컨텍스트 암호화 키를 로컬 `.env`에 생성한다. 기존 파일은 덮어쓰지 않는다. 암호는 해당 파일에서 확인하고 커밋하지 않는다. `BOAN_*` 환경변수 이름은 기존 실행 환경과의 호환을 위해 유지한다. Java 패키지는 `kr.securityadvisor`다.

Compose의 새 DB 볼륨은 `scripts/db/02-pgvector.sql`로 vector 확장을 준비한다. 기존 볼륨에는 초기화 스크립트가 다시 실행되지 않으므로 확장 설치 상태를 DB 담당자가 확인해야 한다. 이는 실제 RAG 색인·검색이나 Docker 전체 구동 검증이 완료됐다는 뜻이 아니다.

| 역할 | 아이디 | 암호 환경변수 | 새 업무에서의 책임 |
|---|---|---|---|
| 신청자 | `applicant.demo` | `BOAN_DEMO_APPLICANT_PASSWORD` | 본인 사업·신청 작성, 보완, 최종 제출 |
| 두 번째 신청자 | `second.demo` | `BOAN_DEMO_APPLICANT_PASSWORD` | 본인 신청만 조회하는지 확인 |
| ICT인프라 | `infra.demo` | `BOAN_DEMO_INFRA_PASSWORD` | 배정받은 신청의 할당·검토·최종 확인 |
| 정보보안 | `security.demo` | `BOAN_DEMO_SECURITY_PASSWORD` | 배정받은 신청의 검토·최종 확인·확정 |
| 기관 관리자 | `admin.demo` | `BOAN_DEMO_ADMIN_PASSWORD` | 기관 운영·배정·계정 역할 관리 범위 |

`outside.demo`는 다른 합성 기관의 격리 검사용 신청자이며 신청자 암호를 사용한다. 회원가입은 APPLICANT만 생성하고 역할·기관을 사용자가 지정하지 않는다. 역할을 바꾸려면 로그아웃 후 다른 실제 계정으로 로그인한다. 관리자 역할이 검토자 권한을 자동으로 갖지는 않는다.

기존 합성 예제 자료는 `BOAN_DEMO_SCENARIOS`로 제어한다. 해당 예제의 이전 상태를 새 신청의 현재 업무 규칙으로 해석하지 않는다. 새 흐름은 [시나리오](docs/starter-scenarios.md)에 따라 사업 건을 생성해 진행한다.

종료는 `docker compose --profile app down`이다. DB·업로드 볼륨은 유지된다. 합성 시연 자료를 모두 지우고 새로 시작할 때만 `docker compose --profile app down -v` 후 다시 기동한다. 이 초기화는 로컬 시연 전용이며 저장 자료를 삭제한다. 기존 암호화 자료를 보존할 때는 `.env`의 키와 볼륨을 함께 유지한다.

## 3. 개발·검사 명령

작업 전 기준 문서 버전을 검사한다. 기준표는 [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) 5장이다.

```bash
python3 tools/check_doc_versions.py
```

백엔드는 JDK 25와 Docker(Testcontainers)가 필요하다. Gradle은 저장소 wrapper를 사용한다.

```bash
cd backend
./gradlew spotlessCheck check bootJar
```

프런트엔드는 Node.js 24를 사용한다. `check`에는 포맷 확인·타입·린트·테스트가 포함되고 production 빌드는 별도다.

```bash
cd frontend
npm ci
npm run check
npm run build
```

위 두 블록의 시작 경로는 각각 저장소 루트다. 포맷 수정이 필요하면 해당 폴더에서 `./gradlew spotlessApply` 또는 `npm run format` 후 검사를 다시 실행한다. 프런트엔드 코드를 수정하기 전 [frontend/AGENTS.md](frontend/AGENTS.md)에 따라 설치된 Next.js 문서를 읽는다.

[개발 시작점 CI](.github/workflows/development-starter.yml)는 `main` 대상 PR·`main` push·수동 실행에서 문서 버전, 프런트엔드 검사·빌드, 백엔드 검사·빌드를 독립 job으로 실행하도록 구성했다. Ubuntu 24.04, Node.js 24.22.1, Temurin 25.0.5+8을 지정하고 백엔드 통합 검사는 runner의 Docker에서 Testcontainers PostgreSQL을 사용한다. 저장소·환경 비밀값을 요구하지 않으며 합성 계정 암호와 암호화 키는 테스트가 생성한다.

Actions는 공식 릴리스의 commit SHA로 고정했다([checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), [setup-java v6.2.0](https://github.com/actions/setup-java/releases/tag/v6.2.0)). 토큰 권한은 `contents: read`이며 checkout 자격 증명을 남기지 않는다. **워크플로우 파일 추가는 CI 통과나 branch protection 적용을 뜻하지 않는다.** PR의 실제 실행 결과를 확인한 뒤 [이번 검증 기록](docs/verification-starter.md)에 기록한다.

Docker로 DB만 실행하며 개발할 때는 루트에서 다음 명령을 사용하고, 별도 터미널에서 프런트엔드를 실행한다. JDK 25가 현재 Java 실행 환경이어야 한다.

```bash
docker compose up -d db
python3 scripts/run-backend.py
```

프런트엔드 `API_ORIGIN` 기본값은 `http://localhost:8080`이다. 통합 테스트에 별도 PostgreSQL 17 검증 DB를 사용할 때만 `BOAN_TEST_JDBC_URL`, `BOAN_TEST_DB_USER`, `BOAN_TEST_DB_PASSWORD`를 명시한다. 외부 DB 테스트 성공은 Docker/Testcontainers 기동 성공과 별도로 기록한다. 테스트 DB는 합성 자료 전용이어야 한다.

프런트엔드·백엔드·DB를 기동한 뒤, 별도 터미널의 저장소 루트에서 새 1:N 업무의 실제 HTTP 검사를 실행한다.

```bash
python3 scripts/smoke-starter.py
```

기본 접속 주소는 `http://127.0.0.1:3000`이며 `BOAN_TEST_BASE_URL`로 변경할 수 있다. 역할별 시연 암호는 루트 `.env` 또는 환경변수에서 읽는다. 검사는 실제 세션·CSRF, 사업 건과 두 서류, 기관·소유자 격리, EXAMPLE 분석·미확정 후보, 배정·할당·반환·보완, 제출·최종 확인·확정·감사를 확인하며 **새 합성 사업 건과 이력을 생성한다.** 합성 시연 DB에서 실행하고 결과는 실행 환경과 함께 남긴다.

`python3 scripts/smoke.py`는 기존 `/api/procedures` 호환 흐름을 검사하며 합성 신청·게시 이력을 생성한다. 이 결과만으로 새 1:N 신청 흐름을 검증했다고 표시하지 않는다. 새 API의 검사는 [API 계약](docs/starter-api.md), 테스트 소스, [이번 검증 기록](docs/verification-starter.md)을 함께 본다.

## 4. 이번 시작점의 경계

| 영역 | 시작점과 남은 인수 범위 |
|---|---|
| 업무 모델 | `BusinessCase` 1:N `SecurityRequest`, CASE/REQUEST 답변, 신청별 독립 단계·상태, 서버 revision 계약 |
| 협의·확정 | 배정자 권한, INFRA 할당과 검토 분리, 보완·반환, 불변 제출본, INFRA→SECURITY 최종 확인·SECURITY 확정 |
| 운영 P1 | 배정·저장형 영업일 기한·추가 전용 감사의 서버 경계. 시작점은 단계별 5영업일·공휴일 빈 목록이며 기관 설정과의 연결은 후속 작업 |
| 인증 | DB 세션·CSRF·요청별 계정 확인, 신청자 회원가입, 합성 역할별 계정 |
| AI | 사업 건 분석 API, TXT/MD 입력, 기본 EXAMPLE 추출과 Spring AI 공통 어댑터 경계. 실제 외부 모델 2종 구동은 별도 증거 필요 |
| 지식 | 공개 자료 참조와 기관 비공개 사실을 분리. 의존성·pgvector 준비만으로 RAG 색인·검색이 완료된 것은 아님 |
| 기존 자산 | 이전 procedure/analysis/institution API·마이그레이션·테스트를 보존. 새 업무 모델과 자동 동기화하지 않음 |
| F-15~F-17 | 정책 수명주기·업무 지표·화면 안 알림은 **설계 완료·구현 예정**. 11.09 필수 경로 리허설 통과 후 착수 |

실제 내부망·기관 시스템·실존 개인정보는 입력·커밋·스크린샷에 사용하지 않는다. AI 후보는 출처·근거와 함께 미확정으로 남으며 확인 없이 제출할 수 없다. 서류 확정은 방화벽 장비 적용 완료를 의미하지 않는다.

외부 AI는 DB 연결 구성의 허용된 엔드포인트·모델·키 참조를 사용한다. 키 원문은 환경변수에만 둔다. 키가 없는 기본 시연의 EXAMPLE 추출은 실제 외부 LLM 호출이 아니다. PDF/DOCX/HWP 입력, 공개자료 RAG, 모델 2종의 실제 호출·품질 평가, 운영 SSO·장비 자동 적용은 완료 범위에 포함하지 않는다. **어떤 항목이 검증됐는지는 문서 존재나 화면 버튼이 아니라 이번 검증 기록과 실제 코드로 판단한다.**

신규 화면의 분석 입력·후보 적용은 사업 건 분석 API에 연결한다. LLM 연결 구성과 계정 역할 관리의 새 편집 화면은 아직 연결하지 않았다. 기존 `/admin/*`은 이전 기관 설정 예제이며 새 사업 건의 LLM 구성·고정 절차와 같은 설정 저장소로 간주하지 않는다.

## 5. 팀원이 시작할 문서와 코드

| 목적 | 진입점 |
|---|---|
| 팀별 첫 작업·인수 조건 | [docs/development-handoff.md](docs/development-handoff.md) |
| 정상·반환·거부 시나리오 | [docs/starter-scenarios.md](docs/starter-scenarios.md) |
| 새 API·DTO·상태·질문 키 | [docs/starter-api.md](docs/starter-api.md) |
| 회원가입·계정·AI·모델 구성 연결 | [docs/auth-ai-api.md](docs/auth-ai-api.md) |
| 업무 용어와 코드 식별자 | [docs/glossary.md](docs/glossary.md) |
| 최신 시안과 기준 문서 참조 | [docs/SOURCE_REFERENCES.md](docs/SOURCE_REFERENCES.md) |
| 문서·시안·코드의 차이와 담당 | [docs/alignment-notes.md](docs/alignment-notes.md) |
| 기존 자산 보존·새 업무 경계 결정 | [ADR 0004](docs/adr/0004-team-development-starter.md) |
| 실제 검사 결과 | [docs/verification-starter.md](docs/verification-starter.md) |

기능 구현의 기준은 FUNCTIONAL_SPEC, 시각 규칙은 design.md, 개별 화면 모양은 [prototype-soo](https://github.com/team-khfc/prototype-soo)의 구현 직전 최신본이다. 이번 참고 SHA는 [출처 기록](docs/SOURCE_REFERENCES.md)에 남겼다. `design.md`와 시안 원본은 디자이너가 후속 작업한다.

개발 결과는 [Security-Advisor](https://github.com/team-khfc/Security-Advisor)에 모인다. `prototype`에서도 기능 브랜치와 PR을 사용하고, 작성자 외 사람 1명 이상의 승인 뒤 Squash merge한다. 기존 [2026-11-06 검증 기록](docs/VERIFICATION.md)은 당시 소스의 역사 기록이며 이번 변경의 통과 증거로 재사용하지 않는다.
