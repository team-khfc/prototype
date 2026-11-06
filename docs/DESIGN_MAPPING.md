# 지정 디자인 시안과 새 구현의 대응

> **현재 참고 범위:** 이 파일의 기존 매핑은 2026-11-06 이전 prototype 시안과 당시 구현의 기록이다. 이번 신규 `/starter`·`/business-cases`·`/security-requests`는 [prototype-soo 참조 기록](SOURCE_REFERENCES.md)의 시안을 사용한다. 업무 의미와 원본 시안의 차이는 [alignment-notes.md](alignment-notes.md), 개발 경로는 [development-handoff.md](development-handoff.md)에 기록한다. 아래 매핑을 최신 시안 목록으로 사용하지 않는다.

2026-11-06. 이번 구현은 사용자가 지정한 `team-khfc/prototype`의 **보안길잡이 디자인시안 프로토타입/** 디렉터리에서 이번 작업에 새로 취득한 HTML·CSS를 기준으로 작성했다. 이전에 생성한 애플리케이션의 코드나 화면은 참조하지 않았다.

## 보존한 원본 자산

아래 파일은 지정 시안에서 가져온 원본을 수정하지 않고 `frontend/public/` 아래 같은 상대 경로에 보관한다.

- `assets/css/styles.css`
- `assets/css/tokens.css`
- `assets/css/workspace.css`
- `assets/vendor/krds/css/token/krds_tokens.css`
- `assets/vendor/krds/Pretendard-LICENSE.txt`
- `assets/vendor/Lucide-LICENSE.txt`
- `assets/vendor/krds/fonts/PretendardGOV-Regular.subset.woff2`
- `assets/vendor/krds/fonts/PretendardGOV-Bold.subset.woff2`

폰트는 지정 저장소의 원본 파일을 내려받아 Git blob SHA-1을 검증했다. Regular는 `5adc7447ae2fac1be659e73e36dc529e3549ffdf`(263,044B), Bold는 `925e6522a6962872209b260686441c673bc72b20`(267,248B)다. 외부 폰트 CDN 요청은 하지 않는다. 공급 CSS는 직접 수정하지 않으며 API 동작에 필요한 추가 스타일은 `frontend/styles/application.css`에 분리했다.

## 공통 디자인

지정 시안의 `.app-header`, `.app-shell`, `.sidebar`, `.sf-panel`, `.sf-table`, `.sf-stepper`, `.form-layout`, `.detail-grid`, `.review-aside`, `.admin-grid` 클래스와 HTML 구조를 React 컴포넌트에 이식했다.

- 업무 셸 최대 폭 1,920px, 좌측 메뉴 240px.
- 흰색 헤더, 파란색 브랜드와 주요 행동, 연한 회색 업무 배경.
- Pretendard GOV, 본문 17px/행간 1.5, h1 32px/h2 24px/h3 19px.
- 4개 상태 카드, 넓은 업무 표, 단계별 신청 작성, 본문과 검토 패널의 2열 배치.
- 48px 기본 컨트롤, 원본 반응형 분기와 표 내부 가로 스크롤.
- 상태는 색과 한국어 문구로 함께 표현한다.

이 구성은 지정 시안에 따른 프로젝트 디자인이다. KRDS 전체 준수나 접근성 인증을 획득했다고 표시하지 않는다.

## 화면별 대응

| 원본 HTML | 새 실제 업무 경로 | 주요 React 구현 | 반영 내용 |
|---|---|---|---|
| 01-workspace.html | `/workspace` | `WorkspaceView` | 상태 카드, 우선 확인 목록, 진행 안내, 최근 협의 기록 |
| 02-requests.html | `/requests` | `RequestsView` | 분야·상태·기간·텍스트 필터, 넓은 표, 정렬·페이지 이동 |
| 03-request-basic.html | `/requests/new` | `CreatePage` | 사업 정보·문서 종류·부서, 명시적 초안 생성 |
| 04-request-analysis.html | `/requests/{id}/analysis` | `AnalysisView`, `AnalysisPage` | 파일 선택과 전송 분리, 예시/LIVE 구분, 후보·근거·미확정 표시 |
| 05-request-questions.html | `/requests/{id}/questions` | `AnswerEditor`, `AnswerFields` | 역할별 질문·작성 이유·필수 시점·확인 상태 |
| 06-request-summary.html | `/requests/{id}/summary` | `SummaryPage` | 수집 정보 요약, 사전 협의 요청 확인 |
| 07-security-review.html | `/requests/{id}/security` | `DetailView`, `ReviewPanel` | 사업 개요·근거·문서·이력과 우측 검토 패널 |
| 08-infra-review.html | `/requests/{id}/infra` | `DetailView`, `NetworkEditor` | 같은 2열 구조, 담당자의 통신 규칙 입력 |
| 09-supplement.html | `/requests/{id}/supplement` | `SupplementEntry` | 요청 분야·질문·답변·담당자의 해소 확인 |
| 10-submit.html | `/requests/{id}/submit` | `SubmitPanel` | 서버의 제출 차단 사유, 검토 상태, 최종 제출 확인 |
| 11-receipt.html | `/requests/{id}/receipt` | `ReceiptPage` | 제출본 번호·시각·버전, 접수와 실제 처리 구분 |
| 12-documents.html | `/documents` | `DocumentsPage`, `DocumentPanel` | 초안/제출본 분리, 검색, React 미리보기와 서버 HTML 다운로드 |
| 13-admin-questions.html | `/admin/questions` | `AdminView` | 목록/편집 2열 구조, 추가 질문·역할·필수 여부·도움말 |
| 14-admin-workflow.html | `/admin/workflow` | `AdminView` | 병렬/순차·필수 담당 분야·문서 안내 문구 |
| 15-admin-versions.html | `/admin/versions` | `SettingsEditor` | 초안 저장과 게시 분리, 변경 비교, 게시 이력 |
| 16-components.html | `/components` | 공통 UI 컴포넌트 | 배지·입력·메시지·단계·비활성 상태 |

계약에 추가된 모델 연결·기관 컨텍스트·공개 지식은 각각 `/admin/models`, `/admin/context`(`/institution/context`), `/knowledge`에 같은 셸·토큰·패널을 확장했다. 기관 관리자 대시보드는 업무 내용 열람 권한을 확대하지 않고 설정 바로가기를 제공한다.

## 원본 정적 동작에서 바꾼 부분과 이유

원본 HTML의 `data-action` 스크립트, 고정 성공 알림, 임시 역할 선택, 가짜 저장 동작은 가져오지 않았다. 실제 화면의 모든 업무 변경은 `docs/CONTRACT.md` API를 호출한다.

| 원본 시안 표현 | 구현한 동작 | 이유 |
|---|---|---|
| 역할 선택 | 아이디·비밀번호 로그인 후 서버 세션의 역할 표시 | 클라이언트 역할 값을 권한으로 신뢰하지 않음 |
| 고정 분석 결과 | EXAMPLE 원문 추출 또는 설정된 LIVE 모델 결과 | 실행 모드·실패·근거를 실제 이력으로 구분 |
| PDF/DOCX/TXT 10MB 안내 | UTF-8 TXT/MD 1MiB 1개 | 현재 구현·서버 검증 범위와 맞춤 |
| 파일 선택 상태 | 선택됨/전송 전, 명시적 분석 버튼 | 선택만으로 파일을 외부에 보내지 않음 |
| 클릭형 가짜 저장 | CSRF·세션 인증을 갖춘 API 변경 요청 | 서버의 실제 결과만 성공 표시 |
| TXT 예시 다운로드 | 서버가 생성한 초안/불변 제출본 HTML 다운로드 | 현재 지원하는 문서 형식을 정확하게 표시 |
| 확정처럼 보일 수 있는 AI 값 | 미확정 후보·원문 근거·사람의 확인을 분리 | AI 제안은 확정 사실이 아님 |
| 선택형/파일형/조건부 관리자 질문 | 텍스트형 추가 질문만 편집 | 계약에 없는 기능을 작동하는 것처럼 표시하지 않음 |

수정·삭제·게시·제출은 서버의 `allowedActions`, 권한과 버전 검증 결과를 따른다. 409 충돌 시 입력을 유지하며 최신 저장값 비교 후 다시 저장할 수 있다. 미리보기 HTML을 주입하지 않고 React 텍스트로 렌더링하여 문서 본문 속 HTML·명령문을 실행하지 않는다.

## 공개 읽기전용 디자인 검토

다음 경로는 로그인 없이 디자인을 검토하기 위한 독립 화면이다.

- `/design-preview/workspace`
- `/design-preview/requests`
- `/design-preview/security`
- `/design-preview/infra`
- `/design-preview/analysis`
- `/design-preview/admin` (`?tab=workflow`, `versions`, `models`, `context` 지원)

공개 시안은 실제 업무 화면과 동일한 `WorkspaceView`, `RequestsView`, `DetailView`, `AnalysisView`, `AdminView`를 재사용한다. `features/preview/fixtures.ts`의 합성 자료만 전달한다. 실제 인증 컨테이너와 업무 API 훅을 호출하지 않는다. 상단에 **읽기전용 디자인 시안 · 합성 데이터 · 저장 및 업무 API 연결 없음**을 표시하고 변경·업로드·다운로드·게시 버튼을 `disabled` 처리한다. 검색·탭·페이지 이동·문서 미리보기처럼 자료를 바꾸지 않는 화면 탐색만 가능하다.

미리보기의 합성 통신 규칙은 문서 예시용 `192.0.2.0/24`, `198.51.100.0/24` 범위만 사용한다. 계정 암호·실제 기관 정보·실존 개인정보는 포함하지 않는다.

## 확인 범위

프런트엔드 검증 명령은 `frontend/package.json`에 고정했다.

- `npm run check`: 아래 포맷·타입·린트·테스트를 모두 수행하는 통합 명령.
- `npm run format:check`: 프로젝트 TS/TSX/CSS/JSON 형식 검사. 지정 원본 vendor CSS는 검사·변경 대상에서 제외.
- `npm run typecheck`: TypeScript strict 검사.
- `npm run lint`: Next.js 권장 ESLint·TypeScript 규칙, 경고 0건 기준.
- `npm test`: Vitest + Testing Library로 CSRF 헤더, 계정 변경 전 응답 폐기, 409 오류 정보, 잘못된 응답 거절, 계정별 초안 격리, 업로드 제한, 합성 fixture 계약·업무 상태 일관성, 미확정 후보 표시, 읽기전용 버튼의 변경 요청 차단을 검증.
- `npm run build`: 실제 Next.js 프로덕션 빌드.

브라우저 시각 검토 결과와 서버 업무 시나리오 검증 결과는 통합 검증 문서에 별도로 기록한다. 자동 검사만으로 실제 기관 운영 적합성이나 접근성 인증을 주장하지 않는다.

합성 시안의 기존 신청은 질문 추가 전 게시본 v1에 고정되고, 관리자 화면은 추가 질문이 포함된 게시본 v2를 보여 준다. 제출 준비·제출·접수 예시에서는 필수 답변 확인, 현재 수정본에 대한 양쪽 검토 완료, 보완 해소가 모두 일치한다. 작성 중인 예시에는 전문 분야의 완료 검토가 없다. 예시 추출 모드의 제안값은 표시된 원문 근거 안에 실제로 포함되어 있다.
