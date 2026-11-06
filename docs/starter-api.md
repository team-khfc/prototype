# 개발 시작점 P1 API 계약

작성일: 2026-11-07. 기준: FUNCTIONAL_SPEC v1.7(스키마 v1.6 동일), AGENTS v1.10.
이 문서는 새 `/api/business-cases`, `/api/security-requests` 화면과 서버의 계약이다.
실행 모델은 이 두 자원으로 통일한다. 구형 예제 API는 제거했다.
`design.md`와 디자이너의 `prototype-soo`는 이 작업에서 수정하지 않는다.
회원가입·역할·사업 건 분석·LLM 연결은 [auth-ai-api.md](auth-ai-api.md)를 함께 본다.

## 인증과 오류

- SA_SESSION 세션 로그인과 CSRF 헤더(`X-CSRF-TOKEN`)를 사용한다. 클라이언트 role을 보내지 않는다.
- 성공은 DTO 자체, 오류는 ProblemDetail(`status`, `code`, `detail`, `requestId`, 충돌 시 `latestRevision`).
- 사업 건 생성은 201 Created, 나머지 정상 명령·조회는 200 OK다.
- 사업 건 생성에는 기존 revision이 없다. 공통 답변 및 신청 명령은 JSON의 `expectedRevision`이 필수다. 공통 답변의 버전은 사업 건의 `revision`, 신청 업무는 신청의 `revision`이다.
- 날짜/시간은 ISO-8601, 식별자는 UUID. 입력값은 모두 합성 데이터만 사용한다.

## 사업 건

| 메서드 | 경로 | 본문 / 반환 |
|---|---|---|
| GET | `/api/business-cases` | `BusinessCaseResponse[]` |
| POST | `/api/business-cases` | `{title,department,description,docTypes:["FIREWALL","SECURITY_REVIEW"]}` → `BusinessCaseResponse` |
| GET | `/api/business-cases/{id}` | `BusinessCaseResponse` |
| PATCH | `/api/business-cases/{id}/answers` | `{expectedRevision,answers:[{key,value,confirmed,notApplicable}]}` → `BusinessCaseResponse` |

`BusinessCaseResponse`: `id`, `title`, `department`, `description`, `institutionId`, `ownerId`, `ownerName`, `revision`, `publicationVersion`, `answers: AnswerResponse[]`, `requests: SecurityRequestSummary[]`, `createdAt`, `updatedAt`.

`SecurityRequestSummary`: `id`, `caseId`, `caseTitle`, `docType`, `stage`, `status`, `revision`, `updatedAt`.
사업 건 상태는 저장하지 않는다. 화면은 하위 신청의 요약으로 표시한다.

## 신청 조회와 명령

| 메서드 | 경로(`/api/security-requests` 기준) | 본문 |
|---|---|---|
| GET | `` | 없음 → `SecurityRequestResponse[]` |
| GET | `/{id}` | 없음 → `SecurityRequestResponse` |
| PATCH | `/{id}/answers` | `{expectedRevision,answers:[{key,value,confirmed,notApplicable}]}` |
| POST | `/{id}/consult` | `{expectedRevision}` |
| POST | `/{id}/allocation` | `{expectedRevision}` (공통 INFRA 답변 저장 후 할당 완료) |
| POST | `/{id}/reviews/complete` | `{expectedRevision,comment}` (담당 분야는 서버 Actor에서 결정) |
| POST | `/{id}/supplements` | `{expectedRevision,fieldKeys:["purpose"],reason}` |
| POST | `/{id}/supplements/{supplementId}/answer` | `{expectedRevision,answer}` |
| POST | `/{id}/supplements/{supplementId}/resolve` | `{expectedRevision}` |
| POST | `/{id}/returns` | `{expectedRevision,targetStage,fieldKeys:["purpose"],reason}` |
| POST | `/{id}/submit` | `{expectedRevision}` + `Idempotency-Key` 헤더 |
| POST | `/{id}/final-confirmations` | `{expectedRevision}` |
| POST | `/{id}/finalize` | `{expectedRevision}` |
| POST | `/{id}/close` | `{expectedRevision,reason}` |
| POST | `/{id}/withdraw` | `{expectedRevision,reason}` |
| PATCH | `/{id}/assignments/{field}` | `{expectedRevision,assigneeId,reason}` (관리자, field=INFRA/SECURITY) |
| GET | `/{id}/document` | HTML 첨부파일, 초안/제출본 구분, 출력도 HTML escape 적용 |
| GET | `/{id}/audit-events` | `AuditEventResponse[]`, 권한 내 이력 |

문서·감사 조회를 제외한 신청 명령은 변경 후 `SecurityRequestResponse`를 반환한다.
담당자 선택지는 `GET /api/reviewer-pools` → `{field,reviewers:[{userId,displayName,role}],defaultReviewerId}[]`.
기관 감사 조회는 `GET /api/audit-events`(ADMIN 전용).

`SecurityRequestResponse`:

```ts
interface SecurityRequestResponse {
  id: string;
  caseId: string;
  caseTitle: string;
  docType: 'FIREWALL' | 'SECURITY_REVIEW';
  ownerId: string;
  ownerName: string;
  stage: 1 | 2 | 3 | 4;
  status: 'DRAFT' | 'CONSULTING' | 'SUPPLEMENT_REQUESTED' | 'FINAL_REVIEW'
    | 'SUBMITTED' | 'FINALIZED' | 'CLOSED' | 'WITHDRAWN';
  revision: number;
  caseRevision: number;
  publicationVersion: number;
  commonAnswers: AnswerResponse[];
  answers: AnswerResponse[];
  reviews: ReviewResponse[];
  assignments: AssignmentResponse[];
  supplements: SupplementResponse[];
  returns: StageReturnResponse[];
  deadlines: DeadlineResponse[];
  submissions: SubmissionResponse[];
  finalConfirmations: FinalConfirmationResponse[];
  currentSubmissionId: string | null;
  changedCommonFields: string[];
  highlightedFields: string[];
  blockers: string[];
  allowedActions: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 보조 응답

- `AnswerResponse`: `{key,label,scope,ownerRole,required,value,source,evidence,confirmed,notApplicable,confirmation}`. `scope=CASE|REQUEST`, `source=USER_ANSWER|AI_INFERRED|STAFF_INPUT|STAFF_CONFIRMED|null`. 빈 필드의 null 출처는 확인 필요다. `confirmation={actorId,actorName,role,at}|null`.
- `ReviewResponse`: `{id,field,status,allocationCompleted,comment,completedBy,completedAt}`. `status=PENDING|ALLOCATED|IN_REVIEW|SUPPLEMENT_REQUESTED|COMPLETE|RECHECK`. 할당 완료는 별도 사실이며 COMPLETE와 다르다.
- `AssignmentResponse`: `{id,field,assigneeId,assigneeName,active,reason,assignedAt}`. 분야별 활성 배정은 최대 한 건이다.
- `SupplementResponse`: `{id,field,fieldKeys,reason,answer,status,requestedBy,createdAt,resolvedAt}`. `status=OPEN|ANSWERED|RESOLVED`.
- `StageReturnResponse`: `{id,fromStage,targetStage,fieldKeys,reason,actorName,createdAt}`. 값과 과거 이력을 지우지 않는다.
- `DeadlineResponse`: `{id,field,kind,dueAt,active,closedAt,timing}`. `field=INFRA|SECURITY|null`, `kind=CONSULTATION|SUPPLEMENT|FINALIZATION`, `timing=WITHIN|DUE_SOON|OVERDUE|CLOSED`.
- `SubmissionResponse`: `{id,number,requestRevision,caseRevision,createdAt}`. 실제 스냅샷은 서버에서 불변 보존한다.
- `FinalConfirmationResponse`: `{id,submissionId,field,actorName,confirmedAt}`.
- `AuditEventResponse`: `{id,actorName,actorRole,targetType,targetId,targetRevision,action,reason,fieldKeys,requestId,createdAt}`. 값·AI 프롬프트·응답 원문은 없음.

### 상태와 동작 표시

| 상태 | 화면 문구 |
|---|---|
| DRAFT | 작성 중 |
| CONSULTING | 협의 중 |
| SUPPLEMENT_REQUESTED | 보완 요청 |
| FINAL_REVIEW | 최종 검토 중 |
| SUBMITTED | 제출됨 |
| FINALIZED | 확정 |
| CLOSED | 종결(반려) |
| WITHDRAWN | 철회 |

`allowedActions`는 표시 힌트다: `EDIT_CASE`, `EDIT_ANSWERS`, `CONSULT`, `ALLOCATE`, `COMPLETE_REVIEW`, `REQUEST_SUPPLEMENT`, `ANSWER_SUPPLEMENT`, `RESOLVE_SUPPLEMENT`, `RETURN`, `SUBMIT`, `FINAL_CONFIRM`, `FINALIZE`, `CLOSE`, `WITHDRAW`, `REASSIGN`, `DOWNLOAD`.
서버는 힌트와 무관하게 모든 조건을 다시 검사한다. CASE 입력은 `/api/business-cases/{caseId}/answers`와 `caseRevision`으로 저장 후 신청을 재조회한다.
`caseRevision`은 현재 응답에 표시된 공통값의 버전이다. 제출·종료 스냅샷을 표시할 때에는 그 스냅샷의 공통 버전이며, 수정 가능한 신청만 최신 사업 건 버전을 사용한다. 제출본의 `changedCommonFields`는 저장된 제출 내용과 최신 공통값을 조회 시 비교한 차이로, 제출본·신청 revision·상태를 바꾸지 않는다. 제출/확정 화면에서는 이를 "제출 후 공통 정보 변경됨 — 보존된 제출본은 그대로"로 구분하며 종료 상태에는 반환 버튼을 제공하지 않는다.

## seed 질문과 입력 책임

- CASE/APPLICANT: `purpose`(목적), `dataTypes`(처리 정보), `externalTransfer`(외부 전송), `dataFlow`(자료 흐름).
- CASE/INFRA: `sourceSystem`, `sourceIp`, `destinationSystem`, `destinationIp`, `protocol`, `port`, `period`.
- REQUEST/APPLICANT: FIREWALL=`connectionPurpose`, SECURITY_REVIEW=`serviceScope`.
- REQUEST/SECURITY: FIREWALL=`accessControl`, SECURITY_REVIEW=`securityControls`.
- 필수·허용값·출처는 서버가 결정한다. 질문 schema 자체를 클라이언트가 교체할 수 없다.

## 범위와 연결 경계

- F-15 정책 수명주기, F-16 지표, F-17 알림함은 후속 범위이며 이번 명령에 포함하지 않는다. 신청 확정은 방화벽 적용 완료가 아니다.
- `firewall_rules`, `notifications`는 스키마 동결 준비용 빈 테이블만 생성한다. 확정 시 규칙 자동 생성·적용 기록·알림 생성/발송은 아직 없다.
- 신청자 본인과 같은 기관 관리자가 조회한다. 담당자는 2단계 이상 같은 기관의 신청을 조회할 수 있고, 반환된 1단계 신청은 현재 배정자만 조회한다. 검토·입력·확정 명령은 현재 활성 배정자만 수행한다.
- 제출 전 철회·종결에서도 당시 CASE+REQUEST 답변을 종료 스냅샷으로 고정한다. 형제 신청 때문에 공통값이 바뀌어도 종료 신청의 상세·문서는 변하지 않는다.
- 시작점의 기한 게시값은 협의/보완/최종 확정 각 5영업일, 공휴일 목록은 비어 있다. 계산기는 게시된 공휴일을 제외할 수 있으나 공휴일 관리 화면과 기관별 기한 설정 연결은 후속 작업이다.
- AI 입력은 일반 답변 API에서 AI 출처를 지정하지 못한다. 서버 내부의 `BusinessCaseService.proposeAnswers(...)` 경계로만 AI 후보를 미확정 저장한다(사업 건 분석 API와 연결).
- 신규 P1 흐름에 기관별 순서 변경·부서장 확인·서류 추가를 넣지 않는다.
- 3→1/2는 소유 신청자의 재검토 요청 명령으로 구분하며 Review 완료 권한은 주지 않는다. 2·4단계 반환은 배정 담당자만 가능하다.

## 검증 상태

이 문서는 먼저 합의한 구현 계약이다. 실제 검증 결과는 작업 완료 때 README/PR에 별도로 기록하며, 명세 존재를 구현 완료로 표시하지 않는다.

## 할당 완료 시 입력 검사

임시 저장은 입력 중인 텍스트를 보존한다. INFRA가 할당 완료할 때 출발지·목적지의 단일 IPv4/IPv6 주소, TCP/UDP/ICMP/ICMPV6 프로토콜, 1~65535 포트와 쉼표 목록·범위, 시작일보다 빠르지 않은 종료일을 확인한다. 기간 권장 형식은 `2026-11-07 ~ 2026-12-31`이다. 담당자가 확인한 미해당은 사유를 유지한다.

CIDR·다중 IP·무기한 규칙의 입력 문법은 이번 프로토타입에서 지원하지 않으며 후속 설계 항목이다. 이 제한을 전체 서비스의 확정 범위로 해석하지 않는다. 잘못된 입력의 할당 시도는 revision·할당 사실·감사를 부분 저장하지 않는다.

`POST /{id}/submit`의 `Idempotency-Key` 헤더는 필수다. 누락은 400 입력 오류, 형식 오류는 도메인의 422 거부이며 유효한 같은 키의 재전송은 같은 제출본을 반환한다.
