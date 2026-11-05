# 디자이너 인계 명세

## 화면별 목적

| 파일 | 역할 | 핵심 요소·검토 포인트 |
|---|---|---|
| 01-workspace.html | 정보보안 | 상태 카드, 우선 확인 목록, 진행 안내, 최근 기록 |
| 02-requests.html | 담당자 | 상태 필터, 검색, 목록, 배지, 선택, 페이지 이동 |
| 03-request-basic.html | 신청자 | 필수 입력·도움말·오류·글자 수 |
| 04-request-analysis.html | 신청자 | 파일 선택, AI 제안·근거·미확정·확인 체크 |
| 05-request-questions.html | 신청자 | 질문 이유, 작성 역할, 필수 시점 |
| 06-request-summary.html | 신청자 | 수집 정보 요약, 협의 요청 확인 |
| 07-security-review.html | 정보보안 | 원문 근거, 수집 정보, 체크리스트·의견·보완 요청 |
| 08-infra-review.html | ICT인프라 | 서버·DB·통신 검토, 분야별 상태 |
| 09-supplement.html | 신청자 | 보완 이유·책임·답변 입력 |
| 10-submit.html | 신청자 | 미확정 0건·검토 완료 샘플, 제출 확인 모달 |
| 11-receipt.html | 신청자 | 완료 표시, 번호·시각·버전·다음 단계 |
| 12-documents.html | 신청자 | 초안/제출본 구분, 검색, 미리보기·다운로드 |
| 13-admin-questions.html | 기관 관리자 | 질문 제목·키·형식·필수·책임·조건 |
| 14-admin-workflow.html | 기관 관리자 | 순차/병렬 절차와 적용 범위 안내 |
| 15-admin-versions.html | 기관 관리자 | 게시본·적용 범위·시각·이력 |
| 16-components.html | 공통 | 토큰·상태·입력·메시지·반응형 비교 |

## 공통 컴포넌트 대응

| CSS 클래스 | Figma 컴포넌트 제안 | 상태/Variants |
|---|---|---|
| .button | Button | primary / secondary / disabled / focus |
| .text-button | TextButton | default / hover / focus |
| .sf-field | Field | default / required / error / readonly |
| .sf-badge | StatusBadge | blue / amber / green / gray / red |
| .sf-panel | Panel | default / list / review |
| .stat-card | MetricCard | default / selected |
| .sf-notice | InlineNotice | info / error |
| .sf-dialog | Dialog | info / confirm / document |
| .sf-table | DataTable | header / row / selected / empty |
| .sf-stepper | Stepper | completed / current / upcoming |
| .sidebar | SideNavigation | expanded / mobile-open / active-item |

이름은 프로젝트 제안이며 Figma 파일이 자동 생성된 것은 아닙니다.

## 디자인 의사결정

- 밝은 업무 화면, 파란색 주요 행동, 상태를 색과 문구로 함께 전달.
- Pretendard GOV, 본문 17px·행간 1.5, h1 32px / h2 24px / h3 19px.
- 4·8·12·16·24·32·40·48px 간격 스케일. 컨트롤은 기본 48px 높이.
- 업무 셸 최대 1920px, 좌측 메뉴 240px, 넓은 화면 본문 48px 여백. 프로젝트 확장값이며 KRDS 표준의 유일한 값이라고 주장하지 않음.
- 상세 본문/검토 패널은 좁은 화면에서 한 열로 전환. 긴 표는 표 영역만 스크롤.
- 업무 화면의 primary 버튼은 한 개를 원칙으로 하고 컴포넌트 가이드의 나열은 비교용.

## 수정·전달 체크

1. 변경 화면·컴포넌트·상태·해상도를 함께 적습니다.
2. 색상 변경은 대비, 폼 변경은 label/for/id와 오류 안내 연결을 확인합니다.
3. 탭 이동과 focus-visible, 모달 Escape·복귀, 긴 한글/파일명, 360px 화면을 확인합니다.
4. 전달 시 바뀐 HTML/CSS/토큰과 변경 이유를 함께 남깁니다. JavaScript의 data-action 속성을 지우면 화면 동작이 끊깁니다.
5. 개발자는 해당 수정사항을 React 공통 컴포넌트에 반영합니다. 정적 HTML을 운영 상태 엔진으로 재사용하지 않습니다.

## 생략된 운영 기능

실제 인증, 기관별 권한, 서버 저장, 파일 본문 분석, AI 모델 호출, 문서 발급, 승인·기관 전송, 기관 설정의 실제 게시와 마이그레이션은 포함하지 않습니다. 현재 HTML은 디자인용 합성 샘플입니다.
