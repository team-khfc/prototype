# Spring Boot 연동 계획 · v3

현재 정적 배포에는 Spring Boot가 실행되지 않으며 아래 계약은 구현 제안이다. 현재 backend/는 Gradle·JPA/H2 저장·조회 개발 예제이며 v3 화면과 연결되지 않았다. 기존 v1은 backend/examples/legacy-v1/에 보관한다. Java 21 서버에서 인증·기관 권한·버전·업무 전이·트랜잭션을 강제해야 한다.

| 동작 | API 제안 | 서버 책임 |
|---|---|---|
| 목록 | GET /api/v3/requests?query=&status=&from=&to=&sort=&page=&size= | 인증된 역할/기관 범위 필터·실제 총수 |
| 상세 | GET /api/v3/requests/{id} | 신청/문서/원문 조회권한 |
| 초안 | POST /api/v3/drafts, PUT /drafts/{id} | 권한·저장 성공 시각·revision |
| 파일 분석 | POST /api/v3/requests/{id}/analysis-jobs | 명시적 동의 이후 업로드, 형식·크기·내용 검증, idempotency key, 입력 revision |
| 분석 상태 | GET /api/v3/analysis-jobs/{id} | queued/running/failed/review_required, 원문 위치·근거·대상 revision |
| 답변 확인/수정 | PUT /api/v3/requests/{id}/answers/{key} | 확인 주체·근거·중요정보 변경 시 재검토 |
| 담당 검토 | PUT /api/v3/requests/{id}/reviews/{role} | 역할 검증·선행 분야·조건별 필수 항목·낙관적 잠금 |
| 보완 요청/답변 | POST /api/v3/requests/{id}/supplements, PUT /supplements/{id}/answer | 작성 책임·권한·답변 후 재검토 |
| 최종 제출 | POST /api/v3/requests/{id}/submissions | required 조건·모든 협의 완료·미해결 보완·멱등성·불변 스냅샷 |
| 기관 초안 | PUT /api/v3/institutions/{id}/configuration/draft | 관리자 권한·키 유일성·조건/타입 스키마 검증 |
| 기관 게시 | POST /api/v3/institutions/{id}/configuration/publications | 관리자 권한·저장된 revision·새 신청만 적용 |
| 세션 | GET /api/v3/session, POST /session/extend, DELETE /session | 서버 시각·실제 만료·연장 결과·10회 이상 정책 확인 |

변경 요청은 If-Match 또는 expectedRevision과 Idempotency-Key를 사용한다. 409는 최신 버전과 비교할 필드 정보를 제공하고 사용자의 미저장 값을 보존한다. 401은 인증 화면으로 이동하되 보존 가능한 초안만 권한 검사 후 복구한다. 403은 허용되는 대안을 안내한다. 오류는 {code,message,fieldErrors,requestId}로 정규화한다.

운영 초안과 업로드는 권한이 있는 서버 저장을 기본으로 한다. 현재 sessionStorage 어댑터를 운영에 사용하지 않는다. API 인증을 클라이언트 역할/기관 ID로 판정하지 않는다. 파일·AI 텍스트는 명령이 아닌 데이터로 취급한다.
