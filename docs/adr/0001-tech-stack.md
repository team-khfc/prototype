# ADR 0001 — 확정 스택과 재현 가능한 개발 환경

- 일자: 2026-11-07
- 상태: 현재 프로토타입 적용
- 상위 기준: PROJECT_CONTEXT v2.7, AGENTS v1.10, FUNCTIONAL_SPEC v1.7

## 결정

팀이 확정한 Next.js App Router·React 19·TypeScript 5.9·TanStack Query, Java 25·Spring Boot 4.1·Gradle Kotlin DSL, PostgreSQL 17·Flyway·pgvector, Docker Compose를 사용한다. Vite·별도 Node API 서버는 추가하지 않는다. 업무 API는 Spring MVC, 프런트엔드는 동일 출처 프록시로 연결한다.

| 항목 | 현재 고정값 | 코드 기준 |
|---|---|---|
| Next.js / React | 16.4.5 / 19.3.1 | frontend/package-lock.json |
| TypeScript / TanStack Query | 5.9.3 / 5.106.1 | frontend/package-lock.json |
| Java / Spring Boot | 25 / 4.1.2 | backend/build.gradle.kts |
| Gradle | 9.1.0 | backend/gradle/wrapper/gradle-wrapper.properties |
| Spring AI | 2.0.0 | backend/build.gradle.kts, ADR 0002 |
| DB | PostgreSQL 17 | compose.yaml, IntegrationTestSupport |
| CI Node / JDK | 24.22.1 / Temurin 25.0.5+8 | .github/workflows/development-starter.yml |

Google 형식은 Spotless·google-java-format와 Prettier로 적용하며 KISA 기준의 입력·권한·비밀값·에러·감사 검사는 코드와 수동 검토를 함께 사용한다. 포맷 통과를 보안 인증으로 해석하지 않는다.

## 영향

기능 컨텍스트와 domain 불변식, 공개 DTO·서비스 경계를 따른다. 테스트는 Vitest/Testing Library, JUnit·ArchUnit·실제 PostgreSQL을 사용한다. 의존성을 바꿀 때 lock/빌드 설정·이 문서·실제 검사 결과를 함께 갱신한다. 새 프로토타입을 만들기 위해 라이브러리 버전을 임의로 올리지는 않았다.

버전의 권위는 빌드 파일과 lock 파일이며 이 표는 해당 결정의 설명이다. 실제 실행 결과와 미검증 범위는 [검증 기록](../verification-fresh.md)에 기록한다.
