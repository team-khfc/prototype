# 보안길잡이 프론트엔드 — 현재 개발 시작점

최신 업무 규칙에 맞춘 **사업 건(BusinessCase) 1:N 신청(SecurityRequest)** 앱입니다. 공개 합성 시연과 실제 서버 화면이 같은 신청 컴포넌트를 사용하며, 데이터 공급 경계만 나눕니다. 과거 `/workspace`, `/requests`, `/admin`, `/design-preview` 앱과 procedure/institution/preview 모델은 제거했습니다.

디자인 참고는 `team-khfc/prototype-soo`의 `1af32fb424ea79a1a4ce60484a83f9d1935fef25` 및 `MERGE_NOTES.md`입니다. 업무 이름은 `FUNCTIONAL_SPEC.md`, 시각 규칙은 `design.md v3.1`을 우선합니다. 디자이너 원본과 `design.md`는 수정하지 않았습니다. 원본의 축소 배율 대신 본문 17px, 로컬 KRDS 토큰·Pretendard GOV 폰트를 사용합니다.

## 실행

Node 22/24 환경에서 다음 명령을 실행합니다. 패키지 버전은 `package-lock.json`에 고정되어 있습니다.

```sh
npm ci
npm run dev
```

`http://localhost:3000/`에 접속하면 `/starter` 합성 시연이 열립니다. 서버·DB·LLM 키가 없어도 사업 건 생성, 2종 서류, 출처 확인, 협의·반환·제출·확정 흐름을 탐색할 수 있습니다. 시연 역할 선택은 메모리 자료를 탐색하는 기능이며 실제 계정 권한을 만들지 않습니다. 새로고침하면 시연 내용이 초기화됩니다.

실제 서버 화면은 백엔드를 먼저 구동한 뒤 `/login`에서 로그인합니다. 비밀번호는 서버의 실행 환경변수로 주입하며 프론트에 포함하지 않습니다. `/signup`에서 만든 계정은 일반 사용자(APPLICANT)입니다. 가입 시 부서는 선택 항목이고 역할을 선택할 수 없습니다.

API 프록시 목적지는 기본 `http://localhost:8080`입니다. 다른 목적지는 `SA_API_ORIGIN`으로 지정합니다. 브라우저는 같은 출처의 `/api`만 호출합니다. Next의 rewrite는 빌드 시 반영되므로 Docker에서도 `SA_API_ORIGIN` build arg를 맞춘 후 다시 빌드해야 합니다.

## 화면

| 경로 | 내용 |
|---|---|
| `/` → `/starter` | 서버 없이 열리는 합성 업무 시연 |
| `/starter/business-cases/new` | 사업 건과 필요한 서류 1~2종 생성 |
| `/starter/business-cases/:id` | 공통 정보·예시 분석·출처·사람 확인 |
| `/starter/security-requests/:id` | 서류별 질문·협의·보완·반환·최종 검토·제출·확정 |
| `/login`, `/signup` | 실제 세션 로그인·일반 사용자 회원가입 |
| `/business-cases`, `/business-cases/new`, `/business-cases/:id` | 서버에 저장되는 사업 건과 공통 정보 |
| `/security-requests`, `/security-requests/:id` | 서버가 허용한 신청 목록과 업무 행위 |
| `/operations` | 담당자 풀·처리 기한·감사 이력 조회 |
| `/operations/members` | 기관 관리자 회원 역할 변경(사유·revision 필수) |
| `/operations/models` | 기관 관리자 모델 연결 등록(비밀값 없이 키 참조만) |
| `/operations/configuration` | 현재 고정 업무 기준·이용 안내 |
| `/operations/roadmap` | P2/P3 구현 예정 범위 안내 |

시연 주소는 대응하는 실제 경로 앞에 `/starter`가 붙습니다. 회원·모델 관리의 쓰기 동작은 실제 관리자 로그인 후에만 제공하며, 공개 시연에서는 로그인 안내를 표시합니다. 정책 수명주기 실행, 지표, 화면 알림, 기관 설정 편집·게시, PDF·DOCX 파싱·내보내기는 완료 기능으로 표시하지 않습니다.

## 코드 구조와 협업 경계

| 경로 | 책임 |
|---|---|
| `app/` | Next App Router, 인증 경계, 공통 Provider, 화면 진입 |
| `features/request/` | 사업 건·신청 DTO와 Query, 업무 화면, 합성 시연 시나리오 |
| `features/auth/` | 세션·CSRF 로그인 흐름, 회원가입, 관리자 역할 변경 |
| `features/llm/` | 모델 선택지·관리자 연결 구성 DTO/Query/화면 |
| `components/ui/` | 아이콘, 오류·로딩·빈 상태, native dialog |
| `lib/http.ts` | 유일한 HTTP 경계, CSRF, ProblemDetail, Zod, 이전 신원 응답 폐기 |
| `lib/draft.ts` | 같은 탭의 임시 입력과 계정·기관별 복구 경계 |
| `styles/tokens.css` | KRDS 원본 토큰과 프로젝트 별칭, 밝은/어두운 모드 |
| `styles/base.css`, `styles/workspace.css` | 공통 기반과 현재 업무 화면·반응형 |
| `public/assets/` | 최신 시안 로고, KRDS 원본, 폰트·라이선스 |
| `verification/` | HTTP/신원 경계, 업무 시연 불변식, 사용자 상호작용 검사 |

기능 밖에서는 `@/features/<기능>` 공개 진입점을 사용합니다. 서버 데이터는 TanStack Query 훅으로 조회·변경하며 모든 응답을 각 `types.ts`의 Zod 스키마로 검증합니다. 실제 서버 요청이 실패하면 해당 오류를 표시합니다. 시연 자료를 대신 보여주거나 성공으로 전환하지 않습니다.

## 모델 연결과 분석

관리자는 `/operations/models`에서 `OPENAI` 또는 `GEMMA` 공급자의 연결·모델명·용도·제한값·등록 사유를 저장합니다. 키 참조는 `SA_OPENAI_API_KEY` 또는 `SA_GEMMA_API_KEY`이며 비밀값을 직접 입력하는 필드는 없습니다. HTTPS 연결 주소와 모델 사용 가능 여부는 서버 허용 목록 검증을 거칩니다. 현재 API는 새 구성 등록을 지원하므로 기존 연결은 변경하지 않고, 필요하면 ‘이 구성으로 새 등록’을 사용합니다.

신청자는 공통 작성의 ‘분석 모델’에서 서버의 `/api/llm-options` 응답을 선택합니다. 이 응답에는 endpoint와 keyReference가 없습니다. 실제 연결을 선택하면 분석 multipart의 `configurationId`에 해당 ID를 보내고, 예시 추출기는 ID를 생략합니다. 파일은 선택만으로 전송되지 않으며 ‘자료 분석 요청’을 눌러야 전송됩니다. 분석 결과 적용도 별도 행동입니다. 적용된 AI 값은 근거를 가진 미확정 후보이며 사람이 확인한 값을 덮어쓰지 않습니다.

예시 추출기(`EXAMPLE`)는 실제 LLM이 아닙니다. 모델 구성 등록 성공, 분석 요청 접수, 실제 모델 실행 성공은 서로 다르게 표시합니다. 모델 목록 조회나 실제 호출 실패는 예시 추출기로 자동 대체하지 않습니다.

## 세션·입력 복구

세션 만료 60초 전에 서버 만료 시각에 맞춰 연장을 안내합니다. 미저장 답변은 같은 탭의 메모리에만 보관하며 브라우저 저장소·쿠키에 넣지 않습니다. 같은 계정으로 다시 로그인하면 복구할 수 있고, 명시적 로그아웃이나 다른 기관·계정 로그인은 메모리와 서버 캐시를 지웁니다. 새로고침·탭 종료 뒤 복구 기능은 제공하지 않습니다.

미저장 답변은 편집 시작 revision을 유지합니다. 다른 변경이 먼저 저장되어도 값을 자동으로 덮어쓰지 않고, 최신 값을 불러오는 행동을 별도로 제공합니다. 회원 역할 변경도 선택 시 revision과 사유를 보존하고 충돌을 표시합니다. 기관 격리·배정·전이·제출 조건의 최종 판단은 서버가 수행합니다.

## 검사

```sh
npm run format
npm run check
npm run build
```

`check`는 Prettier, TypeScript strict, ESLint, Vitest + Testing Library를 순서대로 실행합니다. 구형 기능 삭제에 따라 구형 procedure/preview 계약·정적 분석 화면 검사는 제거했으며, 기존 HTTP/CSRF·신원 경계와 최신 1:N 도메인·편집/복구 검사는 보존했습니다. 관리자 역할 변경·구성 등록·모델 선택 실패와 신원 전환 경합 검사를 추가했습니다.

프로덕션 빌드와 DOM 상호작용 검사는 실제 브라우저의 작은 화면·키보드·색상 대비 검증을 대신하지 않습니다. 실제 LLM 2종 호출, Docker/PostgreSQL 통합 구동, 모바일·스크린리더 검증은 각각 실행한 결과로만 보고해야 합니다.
