# 보안길잡이 AI — 디자이너용 HTML + CSS

## 시작하기

1. ZIP을 **모두 압축 해제**합니다.
2. `index.html`을 Chrome 또는 Edge로 엽니다. 파일을 더블클릭해도 됩니다.
3. 화면 목록에서 필요한 화면을 선택합니다.
4. VS Code 등 편집기로 HTML과 CSS를 수정하고 브라우저를 새로고침합니다.

Node.js, React, Next.js, npm, Docker, 빌드 과정이 필요 없습니다. 외부 CDN·폰트·API에 의존하지 않습니다. 폰트와 아이콘이 모두 포함되어 있습니다. ZIP 안에서 HTML을 바로 열면 상대 경로가 깨질 수 있으므로 먼저 전체를 압축 해제하세요.

파일 브라우저의 보안 정책이 로컬 스크립트를 제한하는 환경에서는 선택적으로 해당 폴더에서 `python -m http.server 8000`을 실행하고 `http://localhost:8000`을 열 수 있습니다.

## 편집 위치

| 바꾸고 싶은 것 | 파일 |
|---|---|
| 화면 문구·폼·배치·요소 순서 | 해당 화면의 `.html` |
| 기본 색상·반경·글꼴 선언 | `assets/css/tokens.css` |
| 공통 헤더·메뉴·표·폼·상세·반응형 | `assets/css/styles.css` |
| 업무 요약·문서함 | `assets/css/workspace.css` |
| 편집 안내·컴포넌트 가이드 | `assets/css/handoff.css` |
| 간단한 UI 상호작용 | `assets/js/interactions.js` |
| 문서·기관 질문 등의 합성 샘플 | `assets/js/sample-data.js` |
| 색상·타이포·간격 토큰 참고 | `design-tokens.json` |

모든 페이지는 **완성된 HTML 본문**을 갖고 있습니다. JavaScript로 전체 화면을 조립하지 않으므로 디자인·마크업 작업이 쉽습니다. 셸을 공통 HTML 조각으로 로딩하지 않아 `file://`에서도 열립니다. 그 대신 헤더·메뉴 HTML을 바꿀 때는 여러 페이지에 같은 수정이 필요합니다. 색상·컴포넌트 외형은 공통 CSS 하나를 수정하면 함께 바뀝니다.

## 포함 화면

- `index.html`: 화면 목록·편집 안내
- `01-workspace.html` ~ `15-admin-versions.html`: 대표 업무 화면 15개
- `16-components.html`: 색상·타이포·버튼·배지·폼·오류·모달·간격 가이드
- `cases/`: 요청함의 다른 11개 사업에 대응하는 상세 샘플

모든 HTML은 반응형이며 모바일용 별도 중복 파일을 만들지 않았습니다. 표는 자체 스크롤 영역을 사용합니다. 개발 도구에서 360, 768, 1440px 너비를 확인하세요.

## 동작 범위

동작하는 UI: 화면·역할 이동, 모바일 메뉴, 신청 필수값 검증, 예시 입력, 요청함의 키워드·상태·분야 필터와 페이지 이동, 문서 검색·미리보기·TXT 다운로드, 주요 확인 모달, 글자 크기 설정.

고정 시안: 전체 업무 데이터, 적용 설정·게시 이력·검토 완료 여부. 저장·게시·AI·보완·제출 버튼은 **디자인 상태를 보여주는 모달 또는 다음 대표 화면으로 이동**합니다. 서버 처리·브라우저 영구 저장·인증·실제 승인·기관 전송을 수행하지 않습니다. 날짜·정렬·체크박스 등 일부 컨트롤은 표시·선택 스타일 검토용이며 실제 업무 데이터 필터 전체를 재구현하지 않았습니다. 입력은 페이지 이동/새로고침 시 유지되지 않습니다.

실제 기능 개발은 기존 React + Next.js + Spring Boot 프로젝트에서 이어갑니다. 이 편집본은 원본의 업무 상태 엔진이나 권한 검증을 대체하지 않습니다.

## Figma에서 사용할 경우

이 산출물은 `.fig` 파일이 아닙니다. Figma에서 재구성할 때 `16-components.html`, `design-tokens.json`, `docs/HANDOFF.md`를 참고하여 색상/타이포 스타일과 Auto Layout 컴포넌트를 정의하세요. JSON은 토큰 참고 데이터이며 특정 Figma 플러그인의 자동 가져오기 호환성을 보장하지 않습니다.

## 기준·권리·검증

- 기준 원본: 보안길잡이 Site v4, commit `1ed38ab13949d49a7599a608b026458928342a51`, 2026-11-05.
- 디자이너 편집본을 별도 생성했으며 원본 사이트를 변경하지 않았습니다.
- 기존 KRDS 토큰 및 Pretendard GOV 폰트를 보존했습니다. `assets/vendor/krds/Pretendard-LICENSE.txt`, `docs/THIRD_PARTY_NOTICES.md`를 함께 전달하세요.
- 화면별 설명: `docs/HANDOFF.md`; 점검 결과: `docs/VALIDATION.md`.
- `docs/design.md`, `AGENTS.md`, `CODING_STYLE.md`, `CONTRIBUTING.md`는 원본 개발 규칙의 참고 사본이며 이 정적 패키지에 Node/Java 명령을 실행할 필요는 없습니다.
