# ADR 0003 — 최신 규칙의 단일 프로토타입으로 실행 구조 교체

- 일자: 2026-11-07
- 상태: 적용
- 이슈: [#3](https://github.com/team-khfc/prototype/issues/3)
- 기존 main: `e5054c9f60ea12a5e79ba6f09aacf5cea802a576`
- 화면 참조: `prototype-soo`의 `1af32fb424ea79a1a4ce60484a83f9d1935fef25`

## 배경

사용자는 과거 프로토타입과 현재 기준의 차이가 크므로 새로 만들도록 명시했다. 직전 main에는 새 1:N 업무와 구형 예제 앱이 함께 있어 팀원이 시작할 경로·상태·설정을 혼동할 수 있었다. 이번 결정은 이전 ADR의 병행 보존 방침을 대체한다. 옛 소스·ADR·검증 기록은 Git 이력에 남는다.

## 결정

1. `/`는 `/starter`로 연결하고 현재 `/business-cases`, `/security-requests`, `/operations`, 로그인·가입만 실행 경로로 유지한다. 구형 `/workspace`, `/requests`, `/admin`, `/design-preview`와 정적 시안 사본을 제거한다.
2. `procedure`, `analysis`, `institution` 예제 컨텍스트를 없앤다. 현재 1:N 업무 불변식은 유지하며 업로드는 document, LLM 안전 전송·공급자 연결은 llm, 비공개 사실은 knowledge, 고정 게시본은 configuration에 둔다. 모든 줄을 재작성한 것으로 주장하지 않는다.
3. 자동 seed는 합성 계정·현재 고정 게시본으로 제한한다. 구형 신청·설정 예제는 만들지 않는다. 실제 사업 건은 사용자가 생성한다.
4. 환경변수는 SA_*, 앱 속성은 securityadvisor.*, 세션 쿠키는 SA_SESSION으로 정리한다. 새 Compose 프로젝트/DB를 사용하되 기존 볼륨은 건드리지 않는다.
5. 이미 병합된 Flyway 여섯 파일은 바꾸지 않는다. 예전 테이블이 남아 있어도 새 앱에서 읽지 않는다. SQL role boan_app/boan_migrator는 기존 GRANT/REVOKE 호환을 위해 유지한다. 새 스키마 변경은 새 migration으로만 추가한다.
6. 현재 팀 문서는 루트, 요약 지침은 claude/INSTRUCTIONS.md 하나로 둔다. 근거·버전·개정일은 변경하지 않는다. design.md는 사용자 요청대로 디자이너의 후속 개정에 맡긴다.
7. 현재 코드만 다루는 안내·API·검증 문서를 제공한다. 구형 기능만 검증하던 테스트는 해당 기능 제거와 함께 제거하고, 여전히 필요한 보안·도메인 테스트는 새 경계로 옮긴다. 통과를 위해 기대값을 낮추거나 검사를 비활성화하지 않는다.

## 영향과 확인

기존 구형 URL·환경변수 호환은 제공하지 않는다. 개발자는 새 checkout과 README의 환경설정으로 시작한다. 데이터 삭제·변환은 이번 작업에 포함되지 않는다. 데이터 이관이 필요하면 별도 계획·검증을 한다.

ArchUnit과 `tools/check_fresh_structure.py`가 폐기한 컨텍스트의 재유입을 확인한다. 새 API의 정상·거부 흐름, 구형 API의 404, 마이그레이션 보존, 실제 HTTP를 이번 코드에서 검사한다. 결과는 [verification-fresh.md](../verification-fresh.md)에 기록한다.

main 직접 push·자체 merge는 하지 않는다. 기능 브랜치/PR에 반영한 뒤 AGENTS.md 8장에 따른 다른 사람의 승인을 받는다.
