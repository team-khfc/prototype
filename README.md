# 보안길잡이 AI · 프론트엔드 우선 개발 프로토타입

React·Next.js 프론트엔드와 Spring Boot·Gradle·H2 백엔드를 분리한 개발 시작 프로젝트입니다. 기존 KRDS 기반 화면과 합성 데이터 시연을 유지합니다.

## 먼저 프론트엔드 실행

Node.js 22 또는 24와 npm이 필요합니다. 저장소 루트에서 실행합니다.

```bash
npm ci
npm run dev
```

http://localhost:3000 에 접속합니다. **Java, DB, 백엔드 실행 없이 모든 시연 화면을 사용할 수 있습니다.** 프론트엔드만 수정할 때는 `cd frontend` 후 `npm run dev`도 가능합니다. 의존성은 루트 `package-lock.json` 하나로 관리합니다.

## 프로젝트 구조

| 경로 | 역할 |
|---|---|
| `frontend/app/` | Next.js App Router 진입점·전역 CSS |
| `frontend/components/` | 화면 셸·공통 UI |
| `frontend/features/` | 업무 요약·신청·검토·문서함·기관 설정 |
| `frontend/lib/` | 시연 데이터·업무 상태 전이·저장 |
| `frontend/public/` | KRDS 토큰·폰트·디자인 문서·소스 ZIP |
| `frontend/scripts/` | 프론트 테스트·개발 서버·스모크 검사 |
| `backend/src/` | Spring Boot API·JPA·H2 예제 및 테스트 |
| `backend/gradle/`, `backend/gradlew*` | Gradle Wrapper 8.14.6 |
| `backend/examples/legacy-v1/` | 기존 Maven·인메모리 코드 보관, 빌드 제외 |
| `scripts/` | 정적 빌드 수집·소스 패키징 |
| `specs/` | 제안 API 계약·검증 기록 |

현재 고정 버전은 Next.js 16.3.4, React 19.2.6, TypeScript 5.9.3, Java 21, Spring Boot 3.5.16입니다. 자세한 버전은 각 빌드 파일을 기준으로 합니다.

## 프론트엔드 체험 순서

1. 업무 요약에서 상태별 협의 요청을 확인하고 목록으로 이동합니다.
2. 상단 역할을 신청자로 변경하고 새 신청의 4단계 흐름을 진행합니다.
3. 파일 정보와 합성 AI 제안을 확인하고 사전 협의를 요청합니다.
4. 정보보안·ICT인프라 담당자 역할에서 검토·보완 요청·의견 기록을 체험합니다.
5. 신청자가 보완에 답변하고 담당자가 재검토합니다. 미확정 값을 확인하고 두 분야 협의를 마치면 최종 제출할 수 있습니다.
6. 문서함에서 초안/제출본 검색·미리보기·다운로드를 체험합니다.
7. 기관 관리자 역할에서 질문·절차 초안 저장과 게시를 체험합니다. 새 설정은 새 신청에 적용됩니다.

## 백엔드 개발 시작

JDK 21을 설치하고 `JAVA_HOME`을 설정합니다. 별도 Gradle 설치는 필요하지 않습니다.

```bash
cd backend
./gradlew bootRun
# Windows PowerShell: .\gradlew.bat bootRun
```

- 서버: http://localhost:8080
- 상태: http://localhost:8080/actuator/health
- 샘플 초안: `GET/POST /api/v1/drafts`, `GET /api/v1/drafts/{id}`
- H2 Console: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:mem:secureflow`, 사용자 `sa`, 비밀번호 공란

기본 H2는 메모리 DB로 서버 종료 시 초기화됩니다. 파일 저장 선택과 API 예제는 [backend/README.md](backend/README.md)를 참고하세요. **현재 UI의 신청·검토 데이터는 이 API와 연결되지 않습니다.** API는 DB 개발을 시작하기 위한 작은 저장·조회 예제입니다.

## Docker

```bash
# 프론트엔드만 실행 (기본)
docker compose up --build -d
# 백엔드·H2도 함께 실행
docker compose --profile full up --build -d
```

프론트엔드는 localhost:3000, 백엔드는 full 프로필에서 localhost:8080입니다. [DOCKER.md](DOCKER.md)에 검사·종료 명령을 정리했습니다.

## 검증·빌드

```bash
npm run typecheck
npm test
npm run build
# backend/에서
./gradlew test bootJar
```

기본 빌드는 `frontend/out/`에 정적 HTML을 생성하고 루트 `out/`으로 복사합니다. Docker는 Next.js standalone 서버 모드를 사용합니다. npm workspace 설정으로 설치와 lockfile은 루트에서 관리하며 프론트 소스는 `frontend/`에 모읍니다.

```bash
# 소스 ZIP 갱신 후 정적 배포 결과에 반영
npm run package:source
npm run build
```

## 데이터·구현 범위

- 현재 업무 화면은 sessionStorage 기반입니다. 같은 탭 새로고침에 유지되며 사용자 간 공유나 서버 저장은 없습니다.
- AI는 고정 합성 결과입니다. 파일은 이름·형식·크기만 확인하며 서버로 전송하지 않습니다.
- 역할 선택·세션 만료는 화면 시연입니다. 실제 로그인, 기관별 권한, AI 연동은 후속 개발입니다.
- 기관 질문은 공통 텍스트 입력입니다. 조건식 엔진·파일 질문 등 전체 필드 타입은 아직 구현하지 않았습니다.
- 백엔드는 인증 없는 로컬 개발용입니다. 실서비스 업무 상태·권한·동시성은 [제안 API 계약](specs/spring-v3-contract.md)을 기준으로 구현해야 합니다.
- 예전 v1 코드·문서는 참고 자료입니다. 현재 구조와 실행법은 이 README와 폴더별 README를 우선합니다.

## 팀 개발 문서

[AGENTS.md](AGENTS.md), [CONTRIBUTING.md](CONTRIBUTING.md), [CODING_STYLE.md](CODING_STYLE.md), [design.md](design.md)를 함께 읽으세요. Google Java·TS/JS 스타일을 참고한 팀 규칙은 유지하며, 신규 폴더별 지침을 추가했습니다. 검사 결과는 [분리 구성 검증 기록](specs/validation-frontend-backend.md)에 기록합니다.
