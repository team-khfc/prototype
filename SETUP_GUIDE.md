# SecurityAdvisor(보안길잡이) 문서 세트 재설정 안내

2026-11-07 기준. 이 묶음 하나로 Claude 프로젝트·지침 칸·저장소의 규칙 문서를 같은 버전으로 다시 맞출 수 있다. 문서별 현재 버전의 공식 기준은 PROJECT_CONTEXT.md 5장 "기준 버전 표"다.

## 1. 묶음 구성

| 파일 | 버전 | 용도 |
|---|---|---|
| INSTRUCTIONS.md | v1.6 | 요약 지침 — 프로젝트 설정 '지침' 칸에 붙여넣을 본문 |
| PROJECT_CONTEXT.md | v2.2 | 전체 그림·확정 결정·**기준 버전 표** |
| FUNCTIONAL_SPEC.md | v1.3 | 기능 명세·도메인 맵·불변식 18개 |
| AGENTS.md | v1.7 | 사람·AI 공통 개발 규칙 |
| PROJECT_RULES.md | v1.6 | 팀·범위·일정·제출·**문서 개정 절차(7-1)** |
| CONTRIBUTING.md | v0.8 | 협업 절차·API 계약·수용 기준 |
| CODING_STYLE.md | v0.3 | Google 스타일 기반 작성 규칙 |
| SECURE_CODING.md | v1.0 | KISA 시큐어코딩 실행 규칙 |
| design.md | v3.1 | KRDS·화면·접근성 기준(디자인 담당 관리, 내용 변경 없음) |
| tools/check_doc_versions.py | — | 머리말 버전과 기준 버전 표 일치 점검 스크립트 |
| SETUP_GUIDE.md | — | 이 안내(배포용, 기준 버전 표 대상 아님) |

## 2. Claude 프로젝트 "보안길잡이" 재설정

1. **지침 칸 교체:** 프로젝트 설정 → 지침에 INSTRUCTIONS.md 본문 전체를 붙여넣는다(현재 v1.4 → v1.6).
2. **문서 확인:** 프로젝트 문서에 아래 9개가 **한 경로에 하나씩만** 있어야 한다 — INSTRUCTIONS.md만 `claude/INSTRUCTIONS.md`, 나머지 8개는 루트. 2026-11-07 정리로 이미 반영되어 있으며, 다시 설정할 때는 같은 이름 문서를 지우고 이 묶음의 파일을 올린다.
   INSTRUCTIONS.md(claude/) · PROJECT_CONTEXT.md · FUNCTIONAL_SPEC.md · AGENTS.md · PROJECT_RULES.md · CONTRIBUTING.md · CODING_STYLE.md · SECURE_CODING.md · design.md
3. **두지 않을 것:** 루트 문서의 `claude/` 아래 사본(PROJECT_CONTEXT·PROJECT_RULES·FUNCTIONAL_SPEC·SECURE_CODING — 삭제 완료), "Instructions.md"·"Project context.md" 같은 예전 이름 문서. 참고 PDF 2종(참가 안내서, UI/UX 자체 검증 체크리스트)은 그대로 둔다.
4. **새 대화에서 확인:** "작업 전 버전 확인을 해줘"라고 요청해 Claude가 지침 칸과 기준 버전 표가 같다고 답하는지 본다.

## 3. 저장소 반영 (개발자)

1. Security-Advisor 저장소 루트에 규칙 문서 9개와 `tools/check_doc_versions.py`를 두는 PR을 올린다(SETUP_GUIDE.md는 넣지 않아도 된다).
2. prototype 저장소 루트의 규칙 문서는 11-06 기준(AGENTS v1.5 등)이다. 같은 PR 방식으로 이 묶음의 버전으로 교체하거나, "최신 규칙은 Security-Advisor" 안내로 바꾼다.
3. PR 설명에 `python3 tools/check_doc_versions.py` 실행 결과를 붙인다. 이 묶음 기준 실행 결과는 9개 문서 모두 "일치"(2026-11-07 확인).

## 4. 앞으로 문서를 고칠 때 (PROJECT_RULES.md 7-1 요약)

본문 수정 + 머리말 버전·개정일 → PROJECT_CONTEXT.md 5장 기준 버전 표 갱신 → 프로젝트·저장소 사본 교체 → (지침이 바뀌었으면) 지침 칸 교체 → 공유 문서 갱신 또는 "구버전" 표시 → 팀 공지 한 줄 → 점검 스크립트 실행. 같은 날 안에 모두 끝낸다.

## 5. 함께 정리할 공유 문서

| Claude 문서 | 상태 | 조치 |
|---|---|---|
| SecurityAdvisor 기능 명세 보고 | FUNCTIONAL_SPEC v1.3 반영 | 유지 |
| 보안길잡이 추진 현황 보고 | 11-06 기준(1:N 반영 전) | 필요 시 갱신, 아니면 "11-06 기준" 표시 |
| 보안길잡이 서비스 소개 (팀 공유용) | 초기 소개 | 유지(규칙 문서 아님) |
| 보안길잡이 기능 명세서 | FUNCTIONAL_SPEC v1.2 기준(1:N 반영 전), 폐기 대상 | 삭제 또는 "폐기 — 기능 명세 보고 참조" 표시 |
