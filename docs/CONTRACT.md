# 새 시안 기반 프로토타입 API 계약

2026-11-06. 최신 제공 규칙과 지정 GitHub 시안을 기준으로 새로 구현한다. 앞선 생성물의 소스·화면·검증 결과는 재사용하지 않는다.

## 공통

- JSON camelCase, API /api, 실제 세션과 DB 신원. 변경 요청 CSRF, 오류 ProblemDetail + code/requestId/latestRevision?.
- Java 공통: kr.boan.common.security.Role(APPLICANT,SECURITY,INFRA,ADMIN), Actor(UUID userId, UUID institutionId, String username, String displayName, Role role) implements Principal.
- kr.boan.common.error.DomainException(int status,String code,String detail), (int status,String code,String detail,Long latestRevision).
- kr.boan.common.entity.BaseTimeEntity: createdAt/updatedAt Instant, getCreatedAt/getUpdatedAt; JPA callbacks.
- kr.boan.common.model.PolicySnapshot(long version, OrganizationPolicy policy).
- OrganizationPolicy(String institutionName,String reviewMode,boolean requireSecurity,boolean requireInfra,List<ExtraQuestion> questions,String documentFooter,ModelConnection model).
- ExtraQuestion(String key,String label,String reason,String ownerRole,boolean required).
- ModelConnection(String provider,String endpoint,String model,String keyReference,double temperature,int maxTokens,int timeoutSeconds). provider EXAMPLE/OPENAI/GEMMA.
- kr.boan.common.model.PolicyProvider.current(UUID institutionId) -> PolicySnapshot. institution 서비스가 구현.

## 인증 — root

- GET /auth/csrf -> {token,headerName}
- POST /auth/login form username,password -> SessionResponse
- GET /auth/session, POST /auth/extend -> SessionResponse {user:{userId,institutionId,username,displayName,role},institutionName,expiresAt}
- POST /auth/logout -> 204
- GET /health -> 200 {status:"UP"} only ApplicationReady; 503 before readiness.
- 신규 합성 계정은 applicant.demo/security.demo/infra.demo/admin.demo. 같은 암호 역할별 env BOAN_DEMO_*_PASSWORD. 음성검사용 second.demo(APPLICANT), outside.demo(APPLICANT 다른기관).
- 고정 합성 institutionId 10000000-0000-0000-0000-000000000001 / 20000000-0000-0000-0000-000000000002.

## 신청·협의 — procedure 담당

- GET /procedures -> ProcedureResponse[]; APPLICANT 본인, 전문가 동일기관 협의이후; ADMIN403.
- POST /procedures {title,documentType:"FIREWALL"|"SECURITY_REVIEW",department,description} ->201 ProcedureResponse.
- GET /procedures/{id} -> ProcedureResponse.
- PATCH /procedures/{id}/answers {expectedRevision,answers:[{key,value,confirmed:boolean,notApplicable:boolean}]} -> ProcedureResponse. 본인 역할만, 원래출처유지 +확인별도, UNKNOWN은확정불가.
- PUT /procedures/{id}/network {expectedRevision,rules:[{id?,sourceName,sourceIp,destinationName,destinationIp,port,protocol,direction,startsOn,endsOn,purpose}]} -> ProcedureResponse; INFRA만, 최소허용.
- POST /procedures/{id}/consult {expectedRevision}
- POST /procedures/{id}/review {expectedRevision,comment}
- POST /procedures/{id}/supplements {expectedRevision,question} -> ProcedureResponse
- POST /procedures/{id}/supplements/{sid}/answer {expectedRevision,answer}
- POST /procedures/{id}/supplements/{sid}/resolve {expectedRevision}
- POST /procedures/{id}/submit {expectedRevision} + Idempotency-Key
- POST /procedures/{id}/receive {expectedRevision}
- GET /procedures/{id}/document -> escaped HTML attachment; draft/submission visually distinct; submitted immutable.
- ProcedureResponse {id,title,documentType,department,description,ownerName,status,revision,policyVersion,createdAt,updatedAt,answers:AnswerResponse[],rules:NetworkResponse[],reviews:ReviewResponse[],supplements:SupplementResponse[],timeline:EventResponse[],blockers:string[],allowedActions:string[],policy:OrganizationPolicy}
- status DRAFT/COLLABORATING/SUBMITTED/RECEIVED. allowedActions includes EDIT,ANALYZE,CONSULT,REVIEW,SUPPLEMENT,ANSWER,RESOLVE,SUBMIT,RECEIVE as server evaluates.
- AnswerResponse {key,label,reason,ownerRole,requiredAt:"CONSULT"|"SUBMIT"|"OPTIONAL",value:string,status:"EMPTY"|"PROPOSED"|"CONFIRMED"|"NOT_APPLICABLE",source:SourceResponse|null,confirmation:ConfirmationResponse|null}
- SourceResponse {kind:"USER_ANSWER"|"AI_INFERENCE"|"SPECIALIST_INPUT"|"SPECIALIST_CONFIRMATION",evidence,actorName,at}; ConfirmationResponse {actorName,role,at}.
- NetworkResponse = input + id,source,confirmation.
- ReviewResponse {role,status:"PENDING"|"COMPLETE"|"INVALIDATED",revision:number|null,comment,actorName:string|null,at:string|null}.
- SupplementResponse {id,question,answer,requestedByRole,requestedBy,status:"OPEN"|"ANSWERED"|"RESOLVED",createdAt,resolvedAt:string|null}.
- EventResponse {id,action,description,actorName,at}.
- Default applicant keys purpose,audience,dataTypes,externalTransfer,period,dataFlow; INFRA operatingEnvironment; SECURITY accessControl,retention,logging. purpose/audience required CONSULT; others SUBMIT (retention/logging OPTIONAL for FIREWALL).
- External transfer choice NO/YES/UNKNOWN. Technical facts never inferred.
- ProcedureService.get(Actor,UUID) -> ProcedureResponse.
- ProcedureService.propose(Actor,UUID,long,List<kr.boan.common.model.Suggestion>) -> ProcedureResponse; Suggestion(String key,String value,String evidence); only applicant semantic keys. Confirmed fields cannot overwrite. All proposed in one batch with one revision.
- Reviews do not increment content revision; other content changes invalidate reviews. expectedRevision checked under DB row lock. Existing procedure pins published policy. DB-protected immutable submission.
- reviewMode PARALLEL은 필요한 두 담당 분야가 함께 검토한다. SEQUENTIAL은 지정 원본 14-admin-workflow.html에 따라 SECURITY → INFRA 순서다. 필요한 선행 역할의 완료가 현재 자료 버전에 유효해야 후행 검토할 수 있다.

## 기관·AI — institution/analysis 담당

- GET /institution/settings -> SettingsResponse ADMIN
- PUT /institution/settings {expectedRevision,policy:OrganizationPolicy} -> SettingsResponse
- POST /institution/settings/publish {expectedRevision} + Idempotency-Key -> SettingsResponse
- SettingsResponse {revision,publishedVersion,draft:OrganizationPolicy,published:OrganizationPolicy,history:[{version,publishedAt,publishedBy}]}
- GET /institution/contexts -> ContextResponse[] (same institution ADMIN/SECURITY/INFRA)
- POST /institution/contexts {title,category,content} ->201 ContextResponse ADMIN
- ContextResponse {id,title,category,content,createdAt,createdBy}; AES256GCM title/category/content encrypted, tenant-bound, no AI egress.
- POST /procedures/{id}/analysis multipart expectedRevision,text,file? -> AnalysisResponse; explicit UTF8 TXT/MD max1MiB, immutable UUID upload outside webroot.
- GET /procedures/{id}/analysis -> AnalysisResponse[]
- POST /procedures/{id}/analysis/{analysisId}/apply {expectedRevision} -> ProcedureResponse (apply stored candidates only; stale/confirmed protection).
- AnalysisResponse {id,procedureId,revision,status:"RUNNING"|"SUCCEEDED"|"FAILED"|"STALE",mode:"EXAMPLE"|"LIVE",provider,model,createdAt,error:string|null,suggestions:[{key,label,value,evidence}],references:[{title,version,section,url}]}
- GET /knowledge -> [{title,version,section,url,summary}]; public reference excerpts / bounded retrieval scope accurately labeled.
- LLM endpoints exact allowlist env + DB-config, DNS public only, HTTPS, no redirects, timeout+bounded bytes, no silent mock fallback, no private context.

## 화면

Next app routes: /workspace, /requests, /requests/new, /requests/[id]/[step] where step analysis/questions/summary/security/infra/supplement/submit/receipt; /documents; /admin/questions,/admin/workflow,/admin/versions,/admin/models,/admin/context; /knowledge; /login; /components.

指定 시안 CSS·토큰·배치 재사용 허용(원본라이선스포함), 기존 생성프로토타입 소스 재사용 금지. 인증후 실제데이터화면과 공개 읽기전용 /design-preview/* 시안 검토 화면을 명확히 구분. 공개시안은 합성fixture만, 업무 API·DB접근없음. 사용자에게 바로 디자인검토가능하게 제공하되 시연인증을 대체하지 않음.
