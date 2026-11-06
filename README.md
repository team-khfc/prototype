# SecurityAdvisor · 보안길잡이

공공기관 담당자가 AI 인터뷰와 정보보안·ICT인프라 담당자 협의를 거쳐 **방화벽 신청서·보안성검토 신청서** 초안을 만드는 프로토타입입니다. AI는 제안하고 사람은 확인합니다. 서류 확정은 방화벽 장비 적용을 의미하지 않습니다.

2026-11-06의 프로젝트 지침 v1.4, PROJECT_CONTEXT v1.9, FUNCTIONAL_SPEC v1.2와 [최신 디자인 시안](https://github.com/team-khfc/prototype/tree/07c2b598d2da27fbbd5f8a694d3fdfddf42bb4e1/%EB%B3%B4%EC%95%88%EA%B8%B8%EC%9E%A1%EC%9D%B4%20%EB%94%94%EC%9E%90%EC%9D%B8%EC%8B%9C%EC%95%88%20%ED%94%84%EB%A1%9C%ED%86%A0%ED%83%80%EC%9E%85)을 반영한 재생성본입니다. 원본 디자인 폴더는 보존했습니다. 개발 결과의 최종 통합 대상은 `team-khfc/Security-Advisor`, 현재 검토 브랜치는 `team-khfc/prototype`의 `feat/team-starter-20261106`입니다.

## 실행

Docker Engine·Compose v2·Python 3 환경에서 루트 디렉터리에서 실행합니다.

```bash
python3 scripts/init-demo.py
docker compose --profile app up -d --build
```

| 용도 | 주소 |
|---|---|
| 프론트엔드 | http://securityadvisor.localhost:3000 |
| API 준비 상태 | http://api.securityadvisor.localhost:8080/api/health |
| 조회용 API 문서 | http://api.securityadvisor.localhost:8080/swagger-ui.html |
| OpenAPI JSON | http://api.securityadvisor.localhost:8080/v3/api-docs |

`.localhost` 이름을 해석하지 못하는 환경은 hosts 파일에 `127.0.0.1 securityadvisor.localhost api.securityadvisor.localhost`를 추가하거나 `localhost`로 접속합니다. 위 주소는 **로컬 개발 주소**입니다. 공개 도메인 구매·DNS 등록·외부 배포는 포함하지 않습니다. 브라우저 업무 요청은 프론트의 같은 출처 `/api`를 경유하며, Docker 내부에서는 `securityadvisor`, `api.securityadvisor` 별칭을 사용합니다.

초기화 명령이 서로 다른 역할 암호·DB 암호·AES-256 키를 `.env`에 생성합니다. 비밀값은 출력하지 않습니다. 기존 `.env`가 있으면 값을 유지하고 이전 `BOAN_*` 설정에 대응하는 `SECURITYADVISOR_*` 항목만 추가합니다. 기존 암호화 키를 바꾸면 저장된 기관 컨텍스트를 읽을 수 없으므로 `.env`와 DB·업로드 볼륨을 함께 보존합니다. 종료 명령 `docker compose --profile app down`은 볼륨을 지우지 않습니다.

| 역할 | 합성 계정 | 암호 환경변수 | 범위 |
|---|---|---|---|
| 일반 사용자 | `applicant.demo` | `SECURITYADVISOR_DEMO_APPLICANT_PASSWORD` | 본인 신청 작성·보완·최종 검토·제출·철회 |
| ICT인프라 | `infra.demo` | `SECURITYADVISOR_DEMO_INFRA_PASSWORD` | 같은 기관 협의 건의 자원 할당·인프라 검토 |
| 정보보안 | `security.demo` | `SECURITYADVISOR_DEMO_SECURITY_PASSWORD` | 할당 후 보안 검토·보완·최종 검토 |
| 기관 관리자 | `admin.demo` | `SECURITYADVISOR_DEMO_ADMIN_PASSWORD` | 질문·게시본·LLM 연결·기관 컨텍스트 |

역할 변경은 로그아웃과 다른 계정 로그인으로 수행합니다. UI에서 역할을 고르는 것으로 권한을 얻을 수 없습니다. 관리자는 업무 본문 열람 권한을 자동으로 받지 않습니다. 현재 전문 담당자 접근 범위는 **기관·담당 역할 단위**이며 개별 담당자 배정·이관 기능은 포함하지 않습니다. `second.demo`, `outside.demo`는 기관·작성자 격리 검사용 합성 계정입니다.

## 디자인만 먼저 보기

Node.js 24 환경에서 다음 명령을 실행합니다.

```bash
cd frontend
npm ci
npm run dev
```

http://securityadvisor.localhost:3000/design-preview/requests 에서 로그인 없이 최신 셸과 목록을 확인할 수 있습니다. `/design-preview/workspace`, `/design-preview/infra`, `/design-preview/security`, `/design-preview/analysis`, `/design-preview/admin`도 제공합니다. 이 화면은 **합성 데이터의 읽기 전용 시안**입니다. 실제 업무 API·저장·게시·파일 전송은 실행하지 않습니다.

## 4단계 시연

1. **작성:** 신청자가 사업 개요와 서류 유형을 입력합니다. TXT·MD를 선택한 뒤 명시적으로 분석을 요청하거나 직접 인터뷰에 답합니다. AI 제안과 근거를 확인하고 사람이 값을 확인합니다.
2. **담당자 협의:** INFRA가 서버·IP·포트를 입력하고 할당을 완료합니다. 할당 완료 후 SECURITY가 검토할 수 있습니다. INFRA는 자신의 협의를 보류할 수 있으며, 두 역할의 협의가 모두 끝나야 다음 단계로 진행합니다.
3. **사용자 최종 검토:** 신청자가 보완 결과와 최종 문서를 검토합니다. AI 최종 초안도 미확정이며 사람이 확인해야 제출할 수 있습니다. 필요한 수정으로 담당자의 확인이 영향을 받으면 재협의가 필요합니다.
4. **확정·관리:** 제출 당시 답변·출처·설정 버전·문서를 불변 스냅샷으로 보존합니다. 두 전문 담당자가 최종 검토한 후 서류를 확정합니다. 장비 적용을 완료했다고 표시하지 않습니다.

**차수 반환**은 2→1, 3→2, 3→1, 4→3을 지원합니다. 사유와 보완 대상 항목을 지정해야 합니다. 기존 값·할당·이력은 보존하고 해당 항목과 영향받은 확인만 다시 검토합니다. 화면에는 색상과 함께 보완 라벨·아이콘·사유를 표시합니다. 4→3 후 다시 제출하면 이전 제출본을 덮어쓰지 않고 새 차수를 만듭니다.

**종결(반려)·철회**도 사유가 필요합니다. 종료 후에는 기존 내용과 이력을 조회할 수 있고 수정은 막습니다. 오래된 revision의 저장은 409로 거절하며 화면 입력을 보존합니다.

## 기술 구성과 데이터 경계

- Next.js App Router·React 19·TypeScript 5.9·TanStack Query.
- Java 25 LTS·Spring Boot 4.1·Gradle Kotlin DSL·JPA, 패키지 `kr.securityadvisor`.
- PostgreSQL 17·Flyway·pgvector, 기존 마이그레이션을 수정하지 않고 새 이관을 추가.
- Spring AI 2.0의 ChatClient·ChatModel·PGVectorVectorStore를 공통 어댑터와 공개 서비스 뒤에서 사용.
- `request`, `review`, `document`, `configuration`, `knowledge`, `llm`, `auth`, `common` 기능 경계. 업무 상태 전이는 도메인 메서드에서 검증.
- 세션·CSRF·기관/작성자/역할 검사·revision·제출/게시 멱등성은 서버가 최종 판단.

출처는 `USER_ANSWER`, `AI_INFERRED`, `STAFF_INPUT`, `STAFF_CONFIRMED`를 사용합니다. 원출처·근거와 이후 사람의 확인을 별도로 보존합니다. 기관 비공개 컨텍스트는 기관 식별자와 결합한 AES-GCM 암호문으로 저장하며 공개 지식과 분리합니다.

기존 자료 보존을 위해 DB명·역할명·테이블·업로드 경로와 기본 볼륨 이름에는 일부 이전 식별자가 남아 있습니다. 이는 호환성을 위한 저장소 식별자이며 서비스명·자바 패키지·API 이름은 SecurityAdvisor 기준입니다. 자세한 이관 결정은 [ADR 0004](docs/adr/0004-securityadvisor-regeneration.md)를 참조합니다.

## AI·지식 기능의 범위

기본 `EXAMPLE` 모드는 이름 붙인 원문 행을 발췌하는 예시 모드입니다. 외부 생성형 모델을 실행했다고 표시하지 않습니다. 실제 호출은 OpenAI 또는 OpenAI 호환 어댑터를 사용합니다. 관리자는 DB에 제공자·모델·정확한 엔드포인트·용도·키 참조를 저장하고, 실제 키는 `SECURITYADVISOR_OPENAI_API_KEY` 또는 `SECURITYADVISOR_OPENAI_COMPATIBLE_API_KEY` 환경변수로 주입합니다. 연결 설정 변경은 이미 게시된 질문 정책과 분리합니다.

엔드포인트는 `SECURITYADVISOR_ALLOWED_LLM_ENDPOINTS`의 정확한 URL 목록에 등록해야 합니다. HTTPS·공개 주소·리다이렉트 금지·응답/시간 제한을 검사합니다. 실패를 예시 성공으로 바꾸지 않습니다. 이전 Gemma 연결 설정을 새 호환 제공자로 자동 변환하지 않으며 관리자가 연결 규약을 확인해 다시 설정해야 합니다.

공개 지식 검색은 확인한 공식 자료의 제목·요약을 pgvector에 색인하는 최소 구현입니다. 로컬 특징 해시 임베딩을 사용하므로 **신경망 기반 의미 검색이나 공개 문서 전문 RAG의 품질을 입증한 것은 아닙니다**. 기관 내부 사실을 공개 근거로 바꾸거나 없는 내부 IP·시스템명을 생성하지 않습니다.

## 검사

```bash
# JDK 25 + Docker(Testcontainers)
cd backend
./gradlew spotlessApply check bootJar

# Node.js 24
cd ../frontend
npm ci
npm run format
npm run check
npm run build
```

별도 **검증 전용 PostgreSQL + vector**를 사용할 때는 `SECURITYADVISOR_TEST_JDBC_URL`, `SECURITYADVISOR_TEST_DB_USER`, `SECURITYADVISOR_TEST_DB_PASSWORD`를 지정할 수 있습니다. 외부 DB 검사는 Docker/Testcontainers 실행 결과와 구분합니다.

개발 실행은 루트에서 `docker compose up -d db`, `python3 scripts/run-backend.py`를 실행하고 별도 터미널에서 프론트를 실행합니다. `API_ORIGIN` 기본값은 `http://localhost:8080`입니다. 전체 서버를 실행한 뒤 `python3 scripts/smoke.py`로 실제 HTTP 흐름을 검사할 수 있습니다. 이 명령은 합성 신청·게시 이력을 만들므로 시연 환경에만 실행합니다.

현재 코드에 대해 실제 실행한 결과와 미검증 항목은 [검증 기록](docs/VERIFICATION.md)에 기록합니다. 이전 검사 결과는 `docs/history/`에 구분해 보존합니다.

## 남은 범위

실제 두 외부 모델의 실호출·품질 평가, PDF/DOCX/HWP 입력·전용 출력 양식, 공개 문서 전문 RAG, 운영 SSO·계정 수명주기·개별 담당자 배정·분산 세션·중앙 감사·백업, 임의 결재선 편집, 실제 방화벽 장비 적용은 완료 범위가 아닙니다. 현재 업로드는 UTF-8 TXT·MD 1MiB, 출력은 인쇄 가능한 HTML입니다. 실제 외부 배포·본 저장소 병합·대회 제출도 별도입니다.

## 작업 시작점

[PROJECT_CONTEXT](claude/PROJECT_CONTEXT.md) → [FUNCTIONAL_SPEC](claude/FUNCTIONAL_SPEC.md) → [AGENTS](AGENTS.md) → [PROJECT_RULES](claude/PROJECT_RULES.md) → [CODING_STYLE](CODING_STYLE.md)·[SECURE_CODING](claude/SECURE_CODING.md) → [CONTRIBUTING](CONTRIBUTING.md) → [design](design.md) 순서로 읽습니다.

[API 계약](docs/CONTRACT.md), [시안 대응](docs/DESIGN_MAPPING.md), [용어집](docs/glossary.md), [참조 출처](docs/SOURCE_REFERENCES.md), [결정 기록](docs/adr/)에서 구현 근거를 확인할 수 있습니다. 공유된 지침 사본의 실존 팀원 이름·연락처는 역할명으로 치환했습니다.
