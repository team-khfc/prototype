# 프론트엔드·백엔드 분리 검증

2026-11-05. 화면 변경 없이 기존 v4 프로토타입을 frontend/로 옮기고 backend/를 Gradle·JPA/H2 개발 스캐폴드로 구성했다. 전체 업무 API 연동은 수행하지 않았다.

## 확인한 결과

| 검사 | 결과 |
|---|---|
| npm workspace lockfile 갱신 및 npm ci | 통과 |
| TypeScript strict 타입 검사 | 통과 |
| 프론트 업무 전이 테스트 | 기존 15개 통과 |
| Next.js 정적 export | 통과, frontend/out → 루트 out |
| Next.js standalone 빌드 | 통과 |
| 브라우저 화면 | 업무 요약·신청자 역할 전환·새 신청 확인 |
| 브라우저 초안 | 예시 입력·저장·새로고침 후 복원 확인 |
| Gradle Wrapper | 8.14.6 생성·실행, 배포 SHA-256 검증 |
| Spring Boot/JPA/H2 통합 테스트 | 5개 통과, 실패·오류·skip 0 |
| bootJar | 실행 JAR 생성 성공 |
| 백엔드 없이 standalone 실행 | 200 응답 및 앱 HTML 확인 |
| 실행 JAR·H2·프록시 | 상태 UP, Next 경유 POST 201 → GET 200, 빈 사업명 400 |
| 프론트 정적 자원 | JS/CSS 8개, 한글 폰트 200 응답 |
| Compose YAML | 구조·기본 frontend 단독/full backend 프로필 확인 |
| Docker 실제 빌드·기동 | 미검증: Docker 실행 파일/데몬 없음 |

백엔드 테스트는 실제 H2에 저장하고 다른 HTTP 요청에서 재조회하는 흐름, 빈 사업명 무저장, 잘못된 JSON, 404, DB 포함 health를 확인한다. Mockito Java agent를 테스트 JVM 시작 시 로드하도록 설정해 Java 21의 동적 attach 의존성을 없앴다. 테스트 조건을 삭제하거나 실패를 성공 처리하지 않았다.

런타임 검사는 Dockerfile과 동일한 standalone 파일 배치와 비어 있는 H2 메모리 DB에서 수행했다. 이는 Docker 이미지의 OS·사용자·네트워크 동작 전체를 검사한 결과가 아니다.

## 환경·범위

검사 환경: Linux, Node.js 24.22.1, Java 21.0.13, Gradle 8.14.6. Dockerfile의 Node.js 22 컨테이너 실행은 별도 확인해야 한다. 의존성 다운로드 시 환경 제공 프록시를 사용했으며 주소·인증값은 저장소에 넣지 않았다.

브라우저 회귀 확인은 PC 화면과 핵심 저장 흐름 중심이다. 이번 폴더 이동에서 모바일 전 화면·모든 역할의 전체 시나리오를 다시 수행한 것은 아니다. 기존 KRDS 디자인·업무 상태 모델·15개 회귀 검사를 유지했다.

현재 역할 전환은 인증이 아니고 AI는 합성 결과다. sessionStorage의 업무 화면과 H2의 저장 예제는 서로 별개다. 실제 서버 업무 권한·기관 분리·조건부 질문 엔진·파일 업로드·AI·운영 DB 연동은 후속 작업이다.
