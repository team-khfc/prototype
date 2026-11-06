# 새 프로토타입의 참조 기록

작성일: 2026-11-07. 이 문서는 이번 구현의 참조 스냅샷이다. 다음 화면 작업은 그 시점의 prototype-soo 기본 브랜치 최신본과 MERGE_NOTES.md를 다시 확인한다. 아래 커밋을 영구 기준으로 규칙 문서에 고정하지 않는다.

## 구현 출발점과 디자인

| 대상 | 참조 |
|---|---|
| 개발 저장소의 현재 main 출발점 | [prototype/e5054c9](https://github.com/team-khfc/prototype/tree/e5054c9f60ea12a5e79ba6f09aacf5cea802a576) |
| 이번 요구사항 | [이슈 #3](https://github.com/team-khfc/prototype/issues/3) — 과거 예제와 병행하지 않는 새 프로토타입 |
| 디자인 원본 | [team-khfc/prototype-soo](https://github.com/team-khfc/prototype-soo) |
| 화면 작업 직전 확인한 커밋 | [1af32fb424ea79a1a4ce60484a83f9d1935fef25](https://github.com/team-khfc/prototype-soo/tree/1af32fb424ea79a1a4ce60484a83f9d1935fef25) |
| 디자이너의 변경 기록 | [해당 커밋 MERGE_NOTES.md](https://github.com/team-khfc/prototype-soo/blob/1af32fb424ea79a1a4ce60484a83f9d1935fef25/MERGE_NOTES.md) |
| 최신 시안 미리보기 | [prototype-soo 미리보기](https://team-khfc.github.io/prototype-soo/) — 이후 변경될 수 있음 |
| 실행 구조 결정 | [ADR 0003](adr/0003-fresh-baseline.md) |

디자이너 저장소에는 쓰지 않았다. 시안의 브라우저 저장소·역할 전환·CDN 라이브러리·AI 모의 버튼을 서버 구현의 권한/업무 근거로 사용하지 않았다. 구형 정적 시안 사본은 현재 개발 트리에서 제거했으며 Git 이력에 남는다.

## 적용한 문서 버전

| 경로 | 버전 | 개정일 |
|---|---|---|
| claude/INSTRUCTIONS.md | v1.8 | 2026-11-07 |
| PROJECT_CONTEXT.md | v2.7 | 2026-11-07 |
| FUNCTIONAL_SPEC.md | v1.7 | 2026-11-07 |
| AGENTS.md | v1.10 | 2026-11-07 |
| PROJECT_RULES.md | v1.10 | 2026-11-07 |
| CONTRIBUTING.md | v0.11 | 2026-11-07 |
| CODING_STYLE.md | v0.4 | 2026-11-07 |
| SECURE_CODING.md | v1.2 | 2026-11-07 |
| design.md | v3.1 | 2026-11-06 |

권위는 PROJECT_CONTEXT 5장 기준표다. `tools/check_doc_versions.py`는 머리말 버전·개정일과 기준표를 검사한다. 이번 변경은 요약 지침의 본문을 바꾸지 않고 규정 경로 claude/INSTRUCTIONS.md로 옮겼다. 루트 규칙 문서와 design.md의 본문·버전은 개정하지 않았다.

## 이번 구현에서 처리한 차이

| 차이 | 적용과 후속 확인 |
|---|---|
| 예전 앱과 새 1:N 앱이 공존 | 사용자의 새 작성 요청에 따라 현재 모델로 단일화. 과거 코드·검증은 Git 이력으로만 보존 |
| 시안의 3단계 `제출 준비` | 명세의 `사용자 최종 검토` 단계·`최종 검토 중` 상태 사용 |
| 시안의 `처리 완료/처리 불가` | 명세의 `확정/종결(반려)` 사용. 서류 확정과 장비 적용 구분 |
| 시안의 담당자 고정 이름·브라우저 role | 합성 계정과 서버의 실제 활성 배정을 사용. 공개 메모리 시연은 별도 표시 |
| 시안 본문 실효 약 13.8px와 design.md 17px | 현행 design.md의 가독성 기준으로 구현. 다음 시각 확정은 디자이너 개정 후 인수 |
| 시안의 D-n/D+n·출처 배지 변경 | 색만으로 의미를 전달하지 않고 기한 텍스트·출처·사람 확인·근거를 함께 표시. 정확한 시각 인수는 후속 확인 |
| design.md의 옛 시안 경로·상태 문구 | 사용자 요청대로 문서를 고치지 않음. 현재 업무 의미는 FUNCTIONAL_SPEC을 우선하며 다음 디자이너 개정 때 정리 |
| 고정 게시본과 운영 설정 편집 | 현재 v1 seed만 운영. 동적 게시·공휴일·기본 담당자 관리 화면은 후속 범위 |

디자인·기획 판단이 필요한 차이는 이 기록과 PR 설명으로 전달한다. 이 작업에서 새로운 정책이나 기능 동결 예외를 확정하지 않는다. 외부 메시지를 별도 발송하지 않았다.

## 재현과 증거

현재 API는 [starter-api.md](starter-api.md)·[auth-ai-api.md](auth-ai-api.md), 팀별 인수는 [development-handoff.md](development-handoff.md), 실제 검사 결과는 [verification-fresh.md](verification-fresh.md)를 따른다. 과거 PR의 통과 수·스크린샷·검증 문서를 새 코드의 통과로 재사용하지 않는다.
