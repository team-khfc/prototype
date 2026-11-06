# 팀 개발 인계 — 새 프로토타입의 시작점

작성일: 2026-11-07. PROJECT_CONTEXT v2.7·FUNCTIONAL_SPEC v1.7을 따른다. 이 문서는 이번 실행 구조의 코드 진입점과 인수 조건이며 팀의 확정 역할·범위를 바꾸지 않는다. 기존 앱을 병행 운영하지 않는다.

## 공통 첫 실행

1. 루트에서 `python3 tools/check_doc_versions.py`와 `python3 tools/check_fresh_structure.py`를 실행한다.
2. PROJECT_CONTEXT → FUNCTIONAL_SPEC 담당 F-xx → AGENTS → PROJECT_RULES·CODING_STYLE·SECURE_CODING·CONTRIBUTING을 읽는다. 요약 지침은 `claude/INSTRUCTIONS.md`다.
3. README대로 프런트엔드를 실행해 `/starter`의 합성 자료로 업무 용어와 두 서류의 독립 진행을 확인한다.
4. 실제 서버·DB를 기동한 뒤 `/login`에서 역할별 계정으로 로그인한다. 공개 시연의 역할 전환을 권한 검증 증거로 사용하지 않는다.
5. 새 사업 건을 만들고 [시나리오](starter-scenarios.md)를 실행한다. 실행 중인 합성 서버에는 `python3 scripts/smoke-starter.py`로 HTTP 흐름을 검사할 수 있다.
6. 다음 이슈에 F-xx·범위·검토자·수용 기준을 적고 기능 브랜치에서 작업한다. PR에는 참고 시안 SHA와 실제 실행 결과를 남긴다.

HTTP 검사의 주소는 `SA_TEST_BASE_URL`, 계정 암호는 `.env` 또는 SA_DEMO_*_PASSWORD다. 이 검사는 새 합성 사업·신청·감사를 만든다. 실제 운영 DB에서 실행하지 않는다. 임시로 만들어진 스크린샷·로그에도 실제 내부 정보와 개인 자료를 넣지 않는다.

## 담당 영역별 출발점

| 영역 | 첫 코드·문서 | 다음 인수 조건 |
|---|---|---|
| 팀장·통합 | README, verification-fresh, 시나리오, ADR 0003 | 한 번의 사업 설명으로 두 서류를 생성해 반환·재검토·제출·최종 확정까지 역할별 실제 경로 재현 |
| 백엔드·아키텍처 | request/domain·service, review, assignment, audit, configuration, migrations | 최신 revision·배정·기관·제출본·감사 원자성 및 DB 제약, 신규 migration만 사용 |
| 프런트엔드 | app, features/request·auth·llm, components/ui, lib/http.ts | 실제 DTO·에러·빈 상태·세션 만료·401/403/409, 사용자 입력 보존, 키보드·모바일 인수 |
| AI·지식 | common/model, llm, request/CaseAnalysis*, document/UploadStorage, knowledge | 같은 합성 입력에서 외부 모델 2종 구동, 근거·미확정·실패·기관 분리, 공개자료 색인·검색 |
| 기획·시연 | FUNCTIONAL_SPEC 3~6장, glossary, starter-scenarios | 질문/작성 책임/출처/반환 필드/양식 대응, 초보 사용자의 업무 문구 이해 |
| 디자인·접근성 | prototype-soo 최신본·MERGE_NOTES, styles, ServiceShell·RequestComponents | 현행 업무 의미를 유지하며 시각 차이·키보드·반응형·출처 배지 확인 |
| DB·실행·품질 | compose.yaml, scripts, .github/workflows, backend/src/test | 새 환경 첫 실행, 최소 DB 권한, 9문서 버전, 실제 PR CI·다른 사람 리뷰 |

실제 담당자 지정과 기획 범위 결정은 팀 운영 문서에 따라 기록한다. 위 표는 새로운 개인 배정이나 일정 확정이 아니다.

## 백엔드의 소유 경계

`BusinessCase`는 CASE 공통 답변과 생성 시 게시본·기한 정책 스냅샷을 소유한다. `SecurityRequest`는 REQUEST 답변·단계·상태·반환·제출을 소유한다. 사업 건 상태를 저장하거나 한 신청의 명령으로 형제 신청을 함께 전이하지 않는다.

`review`는 분야별 협의·보완·최종 확인, `assignment`는 활성 배정, `audit`는 민감 원문 없는 추가 전용 이력을 담당한다. `configuration`은 현재 기관별 v1 게시본을 제공한다. 고정 질문·양식·기한은 코드의 seed 계약이며 동적 설정 편집은 P2다. 기본 담당자 정책의 운영 확장·합성 공휴일 seed를 다음 인수에서 확인한다.

문서 생성은 `document.dto.DocumentRenderRequest`를 거쳐 `DocumentRenderer`로 전달한다. document에서 request 엔티티나 저장소를 직접 읽지 않는다. 실제 조회 시 선택한 현재 값·제출본·종료 스냅샷을 출처·근거·사람 확인과 함께 렌더링한다. 사용자 입력은 HTML에서도 이스케이프한다.

새 할당 검증은 입력 저장과 분리했다. 초안 텍스트를 보존하고 할당 완료에서만 IP·프로토콜·포트·기간 형식을 확인한다. CIDR·다중 IP·무기한 기간 등 현재 지원하지 않는 문법은 임의 사실로 변환하지 않고 후속 설계로 남긴다.

이미 병합된 여섯 migration은 변경하지 않았다. 예전 테이블과 SQL role 이름은 DB 이력 호환을 위해 남아 있지만 새 앱이 구형 업무 테이블을 읽지는 않는다. 이력 테이블은 기존 트리거에 더해 앱 role의 수정·삭제 권한도 회수했다. 기존 자료 삭제·자동 변환은 별도 검토 없이 하지 않는다.

## 프런트엔드·API 연결

프런트 수정 전에 `frontend/AGENTS.md`와 설치된 Next.js 문서를 읽는다. 새 기능은 해당 기능의 index.ts 공개 경계를 사용한다. 서버 상태는 TanStack Query 훅·공통 requestJson을 통해 요청하고 Zod DTO 계약으로 검사한다.

`/starter`의 데이터·역할은 메모리 시연이다. `/business-cases`, `/security-requests`, `/operations`는 실제 세션과 API를 사용한다. `allowedActions`는 표시 힌트이고 서버는 매번 권한·상태·버전을 검사한다. 오래된 revision 오류에서 작성 중인 값을 보존하고 최신 내용을 비교하도록 안내한다.

관리자 회원 역할은 `/operations/members`, 모델 구성은 `/operations/models`에 연결했다. 역할 변경에는 사유·revision이 필요하다. 모델 구성은 원문 키 대신 환경변수 참조를 저장한다. 신청자용 모델 목록에는 endpoint·keyReference가 없다. 상세 DTO는 [auth-ai-api.md](auth-ai-api.md)에 있다.

설정 편집·공휴일 관리·정책 수명주기·지표·알림은 구현된 운영 버튼처럼 보이지 않게 한다. 모바일·스크린리더·실제 키보드 사용은 자동 렌더 테스트와 별도로 사람 인수가 필요하다.

## AI·지식에서 이어갈 일

현재 사업 건 분석은 TXT/MD 또는 설명 텍스트에서 허용된 공통 필드만 미확정 후보로 만든다. 업로드 → 분석 → 후보 적용 → 사람 확인을 별개로 유지한다. 내부 IP·시스템명·포트를 AI가 제안 사실로 만들지 않는다. 오래된 분석 결과와 사람이 확인한 값의 자동 덮어쓰기를 막는다.

EXAMPLE은 라벨 행 발췌이며 외부 호출이 아니다. Spring AI는 공통 LlmGateway 뒤에서만 사용한다. 실제 OpenAI/Gemma 교차 구동은 키·허용 목록을 준비한 합성 환경에서 재현하고, 모델·대상 revision·근거·실패·결과 차이를 기록해야 한다. LIVE 구성 저장과 선택 목록 조회만으로 실제 모델 구동 성공을 주장하지 않는다.

공개자료 RAG, 대화형 인터뷰, 3단계 AI 최종 초안, PDF/DOCX/HWP 입력은 아직 남은 P1 인수·구현 항목이다. 현재 HTML 초안 미리보기를 AI가 새로 생성한 최종 초안이라고 부르지 않는다. 기관 비공개 컨텍스트는 암호화·권한·감사 API로 분리했고 현재 외부 모델로 전달하지 않는다.

## 기획·디자인에서 확인할 차이

시안 최신본의 메뉴 구성·신청 목록·상세 패널·출처 표현을 참고하되, 1:N·상태·배정·기한은 FUNCTIONAL_SPEC이 우선한다. 시안의 3단계 `제출 준비`, 종료 `처리 완료/불가`를 그대로 업무 상태로 도입하지 않았다. 자세한 차이와 원본 SHA는 [SOURCE_REFERENCES.md](SOURCE_REFERENCES.md)에 있다.

사용자 요청대로 design.md는 수정하지 않았다. 시각 규칙의 다음 개정은 디자이너가 수행한다. 이번 개발용 토큰·응답형 레이아웃이 시안과 픽셀 단위로 일치한다고 주장하지 않는다. 본문 글자 크기·출처 배지·기한 텍스트·전체 페이지 가로 넘침·반환 강조를 실제 화면에서 인수한다.

F-15~F-17은 필수 경로 리허설 통과 후의 범위다. 서류 확정이 방화벽 규칙 생성·적용을 완료한 것으로 보이지 않게 한다. 테이블만 있는 기능은 '설계 완료·구현 예정'으로 표시한다.

## 다음 PR에 남길 증거

| 변경 | 필수 기록 |
|---|---|
| 기능 | 역할·사용자 문제·명세 F-xx·포함/남은 범위·수용 기준 |
| API | DTO·권한·기관·revision·멱등성·에러·소비자 영향 |
| 화면 | 참고 시안 커밋·업무 문구·합성/실제 구분·접근성 결과 |
| DB | 새 Flyway·기존 자료 영향·권한·이력 불변·복구 고려 |
| 검증 | 실제 명령·환경·결과·실행하지 못한 항목 |

AGENTS.md 8장에 따라 작성자 외 사람 1명 이상의 승인 뒤 Squash merge한다. 이 문서·테스트 파일·CI 설정의 존재를 실행 통과나 리뷰 승인으로 대체하지 않는다.
