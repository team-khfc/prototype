# SecurityAdvisor 용어 대응표

FUNCTIONAL_SPEC v1.2와 이번 구현에서 사용하는 업무 용어다. 동일한 개념의 이름을 임의로 추가하지 않는다.

| 업무 용어 | 코드·상태 | 의미 |
|---|---|---|
| 신청 | SecurityRequest | 한 건의 보안 서류 작성·협의 생애주기 |
| 서류 유형 | DocumentType | FIREWALL / SECURITY_REVIEW |
| 답변 | Answer | 값·출처·근거·사람의 확인을 가진 필드 |
| 출처 | Source / ValueSource | USER_ANSWER / AI_INFERRED / STAFF_INPUT / STAFF_CONFIRMED |
| 자원 할당 | Allocation | INFRA의 서버·IP·포트 확정, 협의 완료와 구별 |
| 협의 | Review / ReviewCycle | INFRA·SECURITY의 분야별 검토 |
| 보완 질문 | Supplement | 담당자의 추가 질문과 신청자의 답변·해결 확인 |
| 차수 반환 | ReturnItem / returnToStage | 사유·보완 항목을 보존하며 이전 단계로 이동 |
| 최종 초안 | FinalDraft | 사람이 확인해야 하는 AI 요약·보완 후보 |
| 제출본 | Submission | 제출 시점의 개정별 불변 스냅샷 |
| 서류 확정 | CONFIRMED | 두 담당자의 최종 검토 후 확정. 장비 적용과 구별 |
| 종결(반려) | CLOSED | 담당자가 사유를 기록하고 업무를 종료 |
| 철회 | WITHDRAWN | 신청자가 사유를 기록하고 신청을 종료 |
| 기관 설정 | OrganizationPolicy / InstitutionSettings | 질문·문서 안내·고정 절차의 편집 초안 |
| 게시본 | PolicyPublication | 새 신청에 적용하는 불변 정책 버전 |
| 모델 연결 | ModelConnection | 제공자·모델·엔드포인트·키 참조·용도 설정 |
| 공개 지식 | Knowledge | 공개 공식 자료의 검색 가능한 근거 |
| 기관 컨텍스트 | PrivateContext | 기관 비공개 사실. 암호화·기관 격리 대상 |
| 내용 버전 | revision | 오래된 쓰기·검토·AI 적용을 거절하는 기준 |

상태 `SUBMITTED`는 4단계의 최종 검토 대기이며 `CONFIRMED`와 같지 않다. `COMPLETE` 할당과 `COMPLETE` 협의도 서로 다른 상태다. 필드 원출처를 보존하면서 사람의 확인 이력을 별도로 기록한다.
