# 보안길잡이 AI 코딩 스타일

팀 검토용 초안 v0.2 · 2026-11-05 · React/Next.js + Spring Boot/Gradle/H2 구성 기준

Google 공식 가이드에서 필요한 규칙을 채택하고 React·Next.js·Spring Boot에 맞춰 보완한다. “Google 가이드 전체와 완전히 동일”하다고 주장하지 않는다. 아래 `[G]`는 Google 원문 기반, `[P]`는 프로젝트 선택·예외, `[F]`는 프레임워크 요구다. Google 문서의 후속 변경을 개발 중인 코드에 자동 적용하지 않는다.

## 1. 공통

- `[G]` UTF-8을 사용하고 의미를 드러내는 이름을 쓴다.
- `[P]` 기본은 LF 줄바꿈·파일 끝 개행·공백 들여쓰기이며 Gradle의 Windows 실행 파일 `gradlew.bat`는 CRLF 예외다. `.editorconfig`·`.gitattributes`를 따른다. 주석·설명 문서는 한국어를 허용하고 식별자는 영어로 작성한다.
- `[P]` 이유·조건·계약을 설명하는 주석을 쓴다. 코드 동작을 그대로 읽어 주는 주석은 줄인다.
- `[P]` 생성물과 외부 공급 파일은 손으로 포맷하지 않는다. 공통 규칙은 직접 관리하는 소스에 적용한다.
- `[P]` formatter 도입 후에는 고정한 출력을 코드 배치 기준으로 사용한다. 현재 formatter/linter는 미도입이므로 설치·자동 검사 완료로 표현하지 않는다.

## 2. Java — Google Java Style 기반

| 항목 | 채택 규칙 | 분류 |
|---|---|---|
| 들여쓰기 | 블록 2칸, 탭 사용 금지 | G |
| 줄 길이 | 100자, 원문에서 인정한 예외 고려 | G |
| 선언·문장 | 최상위 타입을 파일별로 분리, 문장을 한 줄에 몰아 쓰지 않음 | G |
| import | wildcard import 금지, static/non-static 그룹과 정렬 유지 | G |
| 이름 | 타입 UpperCamelCase, 메서드·변수 lowerCamelCase, 상수 UPPER_SNAKE_CASE | G |
| 예외 처리 | 잡은 예외를 설명 없이 무시하지 않음 | G |
| 자동 포맷 | google-java-format의 Google 모드 | G 기반 도구 |

세부 brace·줄바꿈·import 배치는 고정한 formatter가 결정한다. 단일 줄에 여러 메서드를 압축하는 기존 예제 스타일을 신규 코드에서 반복하지 않는다. Google 원문은 [Java Guide][JAVA]를 참고한다.

### Spring Boot 프로젝트 규칙

- `[P]` 운영 소스는 생성자 주입을 기본으로 하고 field injection을 새로 추가하지 않는다. 현재 Spring 통합 테스트의 `@Autowired` 테스트 필드는 테스트 하네스 범위의 예외이며 운영 코드의 기준으로 확장하지 않는다.
- `[P]` 요청·응답은 구체적인 DTO를 정의한다. record를 우선 검토하되 영속 객체까지 일괄 적용하지 않는다.
- `[P]` Controller는 입출력, Service는 업무 검증·트랜잭션, Repository는 저장소를 맡는다.
- `[P]` `Map<String, Object>`·JsonNode로 모든 운영 계약을 대신하지 않는다. `backend/examples/legacy-v1/`의 보관 예제는 신규 운영 코드의 기준이 아니다.
- `[P]` API 오류는 공통 처리 지점으로 모으고 원인을 보존한다. DTO·Entity·로그에 비밀값이 섞이지 않도록 검토한다.
- `[P]` 단순히 클래스 수를 늘리기 위한 Service/ServiceImpl 쌍을 강제하지 않는다. 대체 구현·테스트 경계 등 실제 필요가 있으면 인터페이스를 둔다.

아래는 이 프로젝트를 위한 독자 예시이며 완성된 API 구현은 아니다.

```java
public record ReviewDecisionRequest(long expectedRevision, String decision, String opinion) {}
```

필수값·허용된 decision 검증, 인증 사용자 확인은 별도 구현해야 한다. 현재 `spring-boot-starter-validation`은 설치되어 있으나 Lombok은 도입하지 않았다. DTO의 validation 선언과 서비스의 업무 검증을 함께 설계한다.

### Gradle·JPA·H2 적용 규칙

- `[P]` Java 21과 `backend/build.gradle`의 toolchain을 기준으로 한다. 실행·검증에는 `backend/gradlew` 또는 `gradlew.bat`를 사용한다.
- `[P]` Spring Boot 3.5.16 BOM으로 관리하는 의존성은 개별 버전을 임의로 덮어쓰지 않는다. Wrapper 8.14.6과 배포 체크섬은 함께 관리한다.
- `[P]` API 입출력 DTO와 JPA Entity를 분리한다. 현재 record DTO와 일반 클래스 Entity의 경계를 유지하며 Entity를 그대로 응답하지 않는다.
- `[P]` 서비스에서 트랜잭션 범위를 정한다. 읽기 전용 조회와 저장 동작을 구분하고 Controller에서 Repository를 직접 호출하지 않는다.
- `[P]` 현재 H2 초안 예제의 ProblemDetail 오류 계약은 `backend/README.md`를 따른다. 실제 업무 API 오류 계약과 혼용하지 않는다.
- `[P]` 기본 메모리 DB·선택적 파일 DB·테스트 DB 설정을 구분한다. 파일 DB와 build/.gradle 생성물을 소스로 관리하지 않는다.
- `[P]` H2에서 통과한 SQL·타입·잠금 동작을 Oracle에서도 동일하다고 가정하지 않는다.
- `[P]` Java 21 테스트는 build.gradle의 Mockito 시작 에이전트 설정을 사용한다. 테스트 실패를 피하려고 업무 검증을 비활성화하지 않는다.

## 3. TypeScript·React — Google TS/JS 기반, 프로젝트 예외 명시

| 항목 | 채택 규칙 | 분류 |
|---|---|---|
| 선언 | const 우선, 재할당이 필요할 때 let | G |
| 문자열·문장 | 일반 문자열 single quote, 세미콜론 사용 | G |
| 내보내기 | 재사용 모듈 named export | G |
| 타입 | 객체 구조는 interface 우선, union·tuple 등은 type 사용 | G |
| 이름 | 타입·React 컴포넌트 UpperCamelCase, 일반 함수·변수 lowerCamelCase | G |
| 타입 안전 | 외부 입력은 unknown 등으로 받고 검증·좁히기, 무분별한 any/단언 회피 | G 기반 적용 |
| 포맷 | 2칸, Prettier printWidth 100 | P |
| JSX 문자열 | 속성의 double quote | P |
| 파일명 | 일반 TS/TSX는 kebab-case; 컴포넌트 함수는 UpperCamelCase | P |
| Next.js 특수 파일 | page.tsx·layout.tsx 등 요구되는 default export 유지 | F, G 예외 |

Google는 named export를 권장하지만 Next.js 페이지 등의 형식은 프레임워크 계약을 따른다. `next.config.ts`와 외부 도구가 default export를 요구하는 설정도 명시적인 예외다. 기존 파일의 export 방식을 변경할 때 호출부를 함께 수정하고 타입 검사한다.

**printWidth 100은 팀이 선택한 목표 폭이다.** Google TypeScript의 공식 100자 규칙이라고 표현하지 않는다. Prettier의 목표 폭은 모든 줄의 강제 최대 길이도 아니다. Prettier 출력은 Google의 모든 포맷 세부 규칙과 동일하지 않다.

```tsx
interface ReviewStatusProps {
  label: string;
  isConfirmed: boolean;
}

export function ReviewStatus({ label, isConfirmed }: ReviewStatusProps) {
  return (
    <span data-confirmed={isConfirmed}>
      {label}: {isConfirmed ? '확인 완료' : '미확정'}
    </span>
  );
}
```

위 코드는 의미 설명용 독자 예시다. 최종 공백 배치는 프로젝트 formatter를 따른다.

### 프런트엔드 프로젝트 규칙

- `[P]` TypeScript strict를 유지하고 `frontend/tsconfig.json`의 `@/*` 경로를 프런트엔드 폴더 기준으로 해석한다. 공개 API·어댑터의 반환 타입과 상태 모델은 명시적으로 관리한다.
- `[P]` React state를 직접 변경하지 않는다. 비동기 호출에는 로딩·실패·취소/경합 상태를 고려한다.
- `[P]` 일반 컴포넌트에서 HTTP 호출·업무 전이·출력을 한 함수에 섞지 않는다. 공통 API 접근과 상태 변경 지점을 유지한다.
- `[F/P]` `'use client'`는 브라우저 기능이 필요한 경계에 둔다. 클라이언트 번들에 서버 비밀값을 넣지 않는다.
- `[P]` 권한 표시와 실제 권한 검사를 구분한다. UI에서 버튼을 숨기는 것으로 서버 보호를 대체하지 않는다.
- `[P]` hooks의 조건부 호출·누락된 의존성을 임의 suppression으로 숨기지 않는다. 예외는 이유와 검증 근거를 남긴다.
- `[P]` KRDS 원본 토큰을 수정하지 않고 프로젝트 별칭과 공통 UI를 사용한다. 시각 규칙은 design.md를 따른다.

Google의 기존 JavaScript 전용 가이드는 갱신이 중단되어 TypeScript 가이드를 우선 참고한다. React/Next.js 상세 규칙과 위 프로젝트 선택값을 Google가 직접 정한 규칙으로 설명하지 않는다.

### 폴더·환경변수·빌드 규칙

- 프런트 소스는 `frontend/app/`, `frontend/components/`, `frontend/features/`, `frontend/lib/`에 둔다. 루트 npm workspace와 lockfile을 함께 변경하며 별도 lockfile을 임의로 만들지 않는다.
- 현재 스타일은 `frontend/app/globals.css`·`workspace.css`, 공급 리소스는 `frontend/public/vendor/krds/`에 있다. 존재하지 않는 styles/·lib/api/를 현재 구현 경로처럼 안내하지 않는다.
- 업무 화면은 `frontend/lib/prototype.ts`의 sessionStorage 시연을 사용한다. 이전 `lib/gateway.ts`를 현재 API 어댑터로 연결하지 않는다.
- `BACKEND_INTERNAL_URL`은 Next.js 서버의 내부 API 주소다. `NEXT_PUBLIC_*`에 비밀값을 넣지 않는다. 프록시 주소 변경을 UI 실제 연동 완료로 취급하지 않는다.
- 기본 정적 export와 standalone 모드의 차이를 유지한다. 정적 export에 서버 API가 포함된다고 가정하지 않는다.

## 4. 자동화 도구 — 현재 상태와 도입 제안

| 영역 | 권장 도구 | 담당 범위 |
|---|---|---|
| Java | Spotless + google-java-format | 코드 배치·포맷 검사 |
| Java 추가 검사 | Checkstyle의 필요한 규칙만 선택 | wildcard import·이름 등 formatter 밖 규칙 |
| TS/TSX | Prettier + ESLint + Next.js/TypeScript 규칙 | 포맷, React hooks·프레임워크·타입 관련 정적 검사 |
| 공통 | EditorConfig·Git attributes (현재 제공) | 인코딩·개행·기본 들여쓰기 |

Google gts도 대안이다. 다만 이 프로젝트는 Next.js 규칙과 이미 정한 출력 방식을 유지하기 위해 명시적 ESLint + Prettier 구성을 우선 제안한다. gts와 독립 formatter 설정을 중복 적용하지 않는다.

Spotless/google-java-format/Checkstyle/ESLint/Prettier의 버전은 도입 PR에서 Java 21·현재 Next.js와의 호환성을 확인하고 고정한다. 패키지·플러그인 버전으로 latest를 사용하지 않는다. 최신 google-java-format의 실행 JDK 요구사항을 Java 소스 대상 버전과 혼동하지 않는다.

현재 `.editorconfig`·`.gitattributes`와 Gradle Wrapper는 제공되어 있다. ESLint·Prettier·Spotless·Checkstyle의 설치와 실행 스크립트는 아직 없다. `backend/examples/legacy-v1/`는 보관 코드이며 포맷 도구 예제가 아니다. 다음 명령은 **도입 후 사용할 목표**다.

```bash
npm run format:check
npm run lint
cd backend
./gradlew spotlessCheck
```

Java 파일을 Prettier와 google-java-format 둘 다로 처리하지 않는다. UI의 공백·들여쓰기 검사를 ESLint와 Prettier가 상충하게 구성하지 않는다. CI에서는 수정 명령 대신 검사 명령을 실행한다.

## 5. 예외 관리

| 예외 | 이유 | 적용 범위 |
|---|---|---|
| Next.js default export | 프레임워크 파일 계약 | 요구되는 페이지·레이아웃·특수 파일·설정 |
| TS/TSX printWidth 100 | 팀의 가독성·기존 코드 균형 | 직접 관리하는 TS/TSX |
| kebab-case 파일명 | 현재 파일 체계 유지 | 일반 소스 파일; 프레임워크 지정 이름 제외 |
| vendor·생성물 제외 | 공급·생성 원본 보존 | frontend/public/vendor, frontend/.next, out, backend/build 등 |
| Gradle Windows 실행 파일의 CRLF | 공식 Wrapper·Windows 실행 호환 | backend/gradlew.bat |
| 테스트 필드 주입 | Spring 테스트 하네스 | backend/src/test/의 테스트 클래스 |
| 기존 파일의 한 번의 대량 정리 | 리뷰·충돌 범위 통제 | 전용 포맷 PR에서 수행 |

새 예외는 사유·범위·검증 방법을 함께 추가한다. 이 표 외에 임의로 특정 개발자의 IDE 스타일을 적용하지 않는다.

## 참고 자료

- [Google Java Style Guide][JAVA]
- [Google TS/JS Style Guide][TS]
- [기존 Google JavaScript 가이드][JS]
- [google-java-format][GJF]
- [Google gts][GTS]
- [Spotless Gradle 공식 설명][SPOTLESS]
- [Next.js page 파일][NEXT_PAGE]
- [Next.js ESLint 설정][NEXT_LINT]
- [Prettier 옵션][PRETTIER]

[JAVA]: https://google.github.io/styleguide/javaguide.html
[TS]: https://google.github.io/styleguide/tsguide.html
[JS]: https://google.github.io/styleguide/jsguide.html
[GJF]: https://github.com/google/google-java-format
[GTS]: https://github.com/google/gts
[SPOTLESS]: https://github.com/diffplug/spotless/tree/main/plugin-gradle
[NEXT_PAGE]: https://nextjs.org/docs/app/api-reference/file-conventions/page
[NEXT_LINT]: https://nextjs.org/docs/app/api-reference/config/eslint
[PRETTIER]: https://prettier.io/docs/options
