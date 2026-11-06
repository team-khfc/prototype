# 기준 문서·시안·구현의 정합성 기록

확인일: 2026-11-07. 기준: PROJECT_CONTEXT v2.7, FUNCTIONAL_SPEC v1.7, AGENTS v1.10, PROJECT_RULES v1.10, CONTRIBUTING v0.11, CODING_STYLE v0.4, SECURE_CODING v1.2, design v3.1. 이 기록은 원본 규칙을 개정하거나 미확정 제안을 팀 결정으로 채택하지 않는다. 사용자의 요청에 따라 `design.md`는 후속 디자이너 작업으로 남긴다.

## 이번 시작점에서 적용한 해석

| 항목 | 근거 | 적용·후속 책임 |
|---|---|---|
| 시안 원본 | PROJECT_CONTEXT 4장, AGENTS 6장, CONTRIBUTING 2장 | prototype-soo의 구현 직전 최신본·MERGE_NOTES를 확인하고 참고 SHA를 PR·출처 기록에 남김. 이후 변경을 자동 반영하지 않음 |
| 시안 모의 동작 | PROJECT_CONTEXT 4장, AGENTS 6장 | 브라우저 저장소·역할 전환·CDN·AI 모의는 서비스 구현 규칙으로 복사하지 않음. 공개 starter와 실제 세션 API를 분리 |
| 업무·시각 우선순위 | FUNCTIONAL_SPEC 머리말·3-1·6장, PROJECT_CONTEXT 4장 | 업무 단계·권한·상태는 기능 명세, 시각 기준은 design.md, 개별 화면 모양은 최신 시안 |
| 도메인과 프레임워크 | AGENTS 5장 “Spring Web·Spring AI 타입에 의존하지 않는다(JPA 애너테이션은 허용)” | DDD 전술 패턴과 JPA 엔티티는 양립. Spring AI는 어댑터 뒤에 둠 |
| 개발 시작점 저장소 | PROJECT_CONTEXT 4·7장, 현재 사용자 요청 | prototype의 기존 코드·검사 보존 후 팀 시작점으로 발전. ADR 0001의 이전 보관 정책은 이번 범위에 한해 ADR 0004가 대체 |
| 이전 증거 | 기존 docs/VERIFICATION.md·ADR 0001~0003 | 2026-11-06 당시 기록으로 보존. 이번 Java 25·새 1:N API의 통과 증거로 사용하지 않음 |

## 다음 담당자가 확인할 차이

이번 개발·인수에 영향을 주는 항목만 남긴다. 줄번호는 위 버전의 원본 기준이다. design.md 개정은 사용자가 지정한 디자이너 후속 작업이며 이 기록 때문에 현재 개발을 중단하지 않는다.

| 상태·항목 | 서로 다른 원문·위치 | 이번 적용 / 후속 |
|---|---|---|
| 잔존 — 시연 암호 예시 | AGENTS 4장 78행·SECURE_CODING 2절 34행 “.env.example에 이름만” / FUNCTIONAL_SPEC F-11 285행 “시연 기본값 표기” | 기존 생성 스크립트의 임의 시연 암호·환경변수 주입을 유지. 고정 암호를 Git에 추가하지 않음. 개발자·보안 담당이 문구 통일 |
| 잔존 — 검토 순서 | CONTRIBUTING 7장 90행 “순차/병렬 정책 반영” / FUNCTIONAL_SPEC 3-1장 99행 “INFRA 선행 → SECURITY 후행으로 고정” | 신규 업무는 INFRA 선행 고정. 기존 procedure의 가변 정책은 호환 자산. 협업 문서 담당이 수용 기준 통일 |
| 잔존 — 동결과 P2 | PROJECT_RULES 8장 일정 109행 “이후 버그 수정·문구·안정화만” / FUNCTIONAL_SPEC 4장 215행 “11.09 … 통과한 뒤에만” P2 착수 | F-15~F-17 실행 기능을 추가하지 않음. 착수 시점·동결 예외는 팀장 결정으로 기록 필요 |
| 디자이너 후속 — 시안·상태·글자 | design.md 머리말·10.2장에는 이전 시안 출처와 신청 “처리 완료/처리 불가”가 남음. MERGE_NOTES의 약 13.8px는 design.md 5.1·부록 A-1의 17px·zoom 제거와 다름 | 새 화면은 최신 시안, 명세의 “확정/종결”, 본문 17px·축소 없음 적용. 원본 갱신은 디자이너 담당 |

현재 스키마는 FUNCTIONAL_SPEC v1.7의 8-1, 이번 기술 결정은 ADR 0004로 읽는다. 기존 요약 지침은 루트 INSTRUCTIONS.md 한 개를 검사하며 자동 이동·복제하지 않는다. 실제 구현 현황은 코드·검사로 보고하되, 미구현을 이유로 업무 명세를 자동 축소하지 않는다.

## 완료 범위의 판정

`tools/check_doc_versions.py`는 기준표와 로컬 문서의 머리말 버전·개정일 일치만 검사한다. 내용 모순, 프로젝트 설정의 지침 칸, 원격 디자인 사본까지 자동으로 검사하지 않는다. 체크 결과가 성공이어도 위 후속 항목은 남는다.

신규 API·UI의 코드, 실제 실행한 검사, 남은 기능을 구별한다. 구현·검증 상태의 최종 기록은 [verification-starter.md](verification-starter.md)이고, 계약은 [starter-api.md](starter-api.md)다. 원본 규칙 8개와 design.md 내용의 변경으로 이 기록을 해소한 것으로 표시하지 않는다.
