# 백엔드 작업 지침

루트 AGENTS.md·CODING_STYLE.md와 backend/README.md를 함께 따른다.

- Java 21, Spring Boot, Gradle Wrapper, H2가 현재 개발 구성이다. Maven은 examples/legacy-v1에 보관된 이전 예제뿐이다.
- 이 폴더에서 ./gradlew test bootJar로 검증한다. Windows는 gradlew.bat를 사용한다.
- 신규 Java는 Google Java Style을 참고한다. 2칸 들여쓰기, 100자 기준, wildcard import 금지, 생성자 주입을 사용한다.
- Controller는 입력·응답, Service는 업무 검증·트랜잭션, Repository는 DB 접근을 담당한다. DTO와 Entity를 분리한다.
- 현재 /api/v1/drafts는 저장·조회 샘플이다. 실제 협의 업무·인증·기관 권한을 구현했다고 주장하지 않는다.
- 클라이언트 role/기관 ID를 인증 근거로 사용하지 않는다. 실제 업무 연동은 specs/spring-v3-contract.md를 확인한다.
- 기본 H2는 메모리, file 프로필은 data/에 저장한다. 테스트는 test 프로필에서 독립 메모리 DB를 사용한다. data/·.gradle/·build/는 커밋하지 않는다.
- 기존 예제는 examples/legacy-v1에 보관하며 빌드 대상에 섞지 않는다. Google formatter·Spotless가 설치되었다고 가정하지 않는다.
