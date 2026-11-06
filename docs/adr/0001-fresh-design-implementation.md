# ADR 0001 — 지정 디자인 시안으로 새 구현

- 상태: 이번 프로토타입에 적용. 본 저장소의 팀 승인·병합을 의미하지 않음.
- 일자: 2026-11-06
- 대상: Security-Advisor에 통합할 별도 소스 산출물

## 배경

사용자는 AGENTS와 프로젝트 규칙을 수정했고 직전 생성물을 사용하지 않는 새 프로토타입을 요청했다. 화면의 기준은 `team-khfc/prototype`의 `보안길잡이 디자인시안 프로토타입/`이다.

## 결정

1. 직전 생성물의 애플리케이션 소스를 복사하지 않고 별도 디렉터리에서 다시 작성한다.
2. 지정 시안의 공통 CSS, KRDS 토큰, Pretendard GOV 글꼴과 라이선스를 보존한다. React 컴포넌트와 실제 업무 데이터 연결은 새로 구현한다.
3. 실제 업무 화면은 DB 계정의 서버 세션으로 접근한다. 시안의 역할 선택기를 인증 대용으로 사용하지 않는다.
4. 인증이 필요 없는 `/design-preview/*`는 합성 자료만 사용하는 읽기 전용 디자인 확인 화면이다. 업무 API 호출과 저장 기능을 제공하지 않는다.
5. 기존 `prototype` 보관 저장소에 새 개발 코드를 쓰지 않는다. 이 산출물은 `Security-Advisor`의 검토용 브랜치로 옮길 수 있다.

## 확정 스택

- Next.js App Router / React 19 / TypeScript 5.9 / TanStack Query
- Java 21 / Spring Boot 4.1 / Gradle Kotlin DSL / Spring Data JPA
- PostgreSQL 17 / Flyway / Docker Compose
- Google Java Format 기반 Spotless, Google TS 가이드 기반 프로젝트 Prettier·ESLint 설정
- OpenAPI는 서버 DTO에서 생성한다. Swagger UI는 조회용으로 제공하며 업무 실행 권한을 만들지 않는다.

의존성의 정확한 고정 버전은 `package-lock.json`, `backend/build.gradle.kts`, Gradle Wrapper 및 Compose 파일이 기준이다. 외부 CSS와 생성 파일은 자체 포맷 대상에서 제외한다.

## 결과

원본 화면의 정보 구조와 타이포그래피를 유지하면서 화면 시연과 서버 권한 경계를 구분한다. 디자인 매핑과 차이는 `../DESIGN_MAPPING.md`, 검증 결과는 `../VERIFICATION.md`에 기록한다.

## 확인한 공식 자료

- Spring Boot 시스템 요구: https://docs.spring.io/spring-boot/system-requirements.html
- Spotless Gradle 플러그인: https://plugins.gradle.org/plugin/com.diffplug.spotless/7.2.1
- Springdoc 지원 버전: https://springdoc.org/
