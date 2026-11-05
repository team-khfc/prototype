# Backend

Java 21 · Spring Boot 3.5.16 · Gradle Wrapper 8.14.6 · Spring Data JPA · H2.

현재 목적은 API와 DB 개발 환경을 준비하는 것입니다. 프론트엔드의 전체 협의 업무는 아직 연결하지 않았습니다.

## 실행·검증

JDK 21을 설치하고 JAVA_HOME을 설정한 뒤 이 폴더에서 실행합니다.

```bash
./gradlew bootRun
./gradlew test bootJar
java -jar build/libs/secureflow-api.jar
```

Windows는 `./gradlew` 대신 `.\gradlew.bat`를 사용합니다. ZIP 압축 해제로 실행 권한이 사라진 macOS/Linux 환경은 `chmod +x gradlew`를 한 번 실행하세요. 최초 실행 시 Gradle 배포 서버와 Maven Central에 접속합니다. Wrapper 배포 ZIP은 SHA-256으로 검증합니다. Java 21의 테스트 에이전트 제약을 피하기 위해 Mockito를 테스트 JVM 시작 시 명시적으로 로드합니다.

기본 서버는 `127.0.0.1:8080`에 바인딩하며 기본 프로필은 `local`입니다.

## H2

| 설정 | 값 |
|---|---|
| Console | http://localhost:8080/h2-console |
| JDBC URL | `jdbc:h2:mem:secureflow` |
| Driver | `org.h2.Driver` |
| 사용자 | `sa` |
| 비밀번호 | 공란 |
| 기본 수명 | 서버 종료 시 삭제 |

파일 DB를 사용하려면:

```bash
./gradlew bootRun --args='--spring.profiles.active=local,file'
```

Console JDBC URL도 `jdbc:h2:file:./data/secureflow`로 변경합니다. DB 파일은 `backend/data/`에 생성되고 Git·소스 ZIP에서 제외합니다. 테스트는 별도 메모리 DB와 create-drop을 사용합니다. 개발용 ddl-auto=update는 운영 마이그레이션 정책이 아닙니다.

## 구현된 샘플 API

| 메서드 | 경로 | 동작 |
|---|---|---|
| GET | `/actuator/health` | DB를 포함한 상태 확인 |
| POST | `/api/v1/drafts` | 사업명·개요를 검증하고 H2에 저장 |
| GET | `/api/v1/drafts` | 최근 100개 샘플 조회 |
| GET | `/api/v1/drafts/{id}` | 단건 조회, 없으면 404 |

```bash
curl -i http://localhost:8080/api/v1/drafts \
  -H 'Content-Type: application/json' \
  -d '{"title":"합성 사업","summary":"H2 저장 예제입니다."}'
curl http://localhost:8080/api/v1/drafts
```

저장은 201과 Location 헤더를 반환합니다. 빈 값·길이 초과·잘못된 JSON은 400으로 거부합니다. 오류는 Spring ProblemDetail 형식이며 필드 검증 오류는 `errors` 객체를 추가합니다. 이는 샘플 계약이며 미래 업무 API 오류 스키마는 별도로 합의합니다.

`draft/`는 Controller → Service → Repository/Entity로 나눴습니다. 인증·기관 범위·검토 승인·보완·최종 제출은 아직 구현하지 않았습니다. 외부 사용자에게 공개할 운영 API가 아닙니다.

## 프론트엔드 연결 준비

Next.js 개발/standalone 서버가 `/api/*`를 프록시하므로 별도 광범위한 CORS 허용은 추가하지 않았습니다. 실제 업무 API 계획은 `../specs/spring-v3-contract.md`에 있습니다. 현재 샘플 API를 기존 업무 모델과 같은 계약으로 취급하지 마세요.

`examples/legacy-v1/`는 기존 Maven·인메모리 소스 보관이며 Gradle은 컴파일하지 않습니다. 신규 개발은 `src/`에서 진행하세요.

## 버전 근거

- https://docs.spring.io/spring-boot/3.5/system-requirements.html
- https://docs.gradle.org/8.14.6/release-notes.html
- https://docs.gradle.org/current/userguide/gradle_wrapper.html
