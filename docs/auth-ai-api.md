# 인증·계정·사업 건 분석 연결 안내

작성일: 2026-11-07. 이 문서는 현재 컨트롤러·DTO·서비스를 기준으로 신규 프런트엔드와 AI 담당자가 연결할 경계를 정리한다. 신청 업무 계약은 [starter-api.md](starter-api.md), 실제 실행 결과는 [verification-starter.md](verification-starter.md)에서 확인한다. 엔드포인트 설명 자체가 검증 통과를 의미하지 않는다.

## 공통 요청

API 기준 경로는 `/api`다. 브라우저는 같은 출처의 Next.js 프록시를 통해 서버 세션을 사용한다. 변경 요청은 `/auth/csrf`가 반환한 `headerName`과 `token`을 헤더에 넣는다. 로그인·회원가입도 CSRF 경계를 거친다. 성공 응답은 DTO 자체이며 오류는 `ProblemDetail`의 `status`, `code`, `detail`, `requestId`를 사용하고 버전 충돌에는 `latestRevision`을 제공한다.

화면의 role·기관 식별자를 권한 주장으로 보내지 않는다. 세션이 바뀌면 사용자·기관별 캐시를 분리하고 이전 응답으로 새 사용자의 화면을 덮어쓰지 않는다. 공통 클라이언트는 `frontend/lib/http.ts`, 실제 요청 훅은 `frontend/features/request/useRequests.ts`에서 시작한다.

## 로그인·회원가입

| 메서드 | 경로 | 요청·응답 |
|---|---|---|
| GET | `/auth/csrf` | `{token,headerName}` |
| POST | `/auth/login` | form `username`, `password` → `SessionResponse` |
| GET | `/auth/session` | `SessionResponse` |
| POST | `/auth/extend` | `SessionResponse` |
| POST | `/auth/logout` | 204 |
| POST | `/auth/signup` | JSON `{username,password,displayName,department?}` → 201 `UserResponse` |

`UserResponse`는 `{userId,institutionId,username,displayName,role}`이다. `SessionResponse`는 `{user,institutionName,expiresAt}`이다.

회원가입은 시연 기관의 APPLICANT만 만든다. 추가 `role`·`institutionId` 값은 권한에 반영하지 않는다. 아이디는 영숫자로 시작하는 4~40자이며 영숫자·점·밑줄·하이픈을 허용하고 소문자로 저장한다. 비밀번호는 영문 대소문자·숫자를 포함한 12자 이상, UTF-8 72바이트 이하다. 합성 표시명만 입력한다. 생성 뒤 자동 로그인하지 않으므로 `/login`에서 로그인한다. 시연 seed 암호는 별도의 16자 이상 규칙과 환경변수 주입을 사용한다.

주요 거부 결과는 중복 아이디 409 `USERNAME_EXISTS`, 비밀번호 정책 422 `PASSWORD_POLICY`, 인증되지 않은 업무 요청 401, 권한 부족 403이다. DTO 검증 오류는 요청 검증 응답을 사용한다. 성공·실패 메시지에 비밀번호·해시를 포함하지 않는다.

## 기관 계정 역할 관리 — API 제공, 신규 편집 화면 미연결

| 메서드 | 경로 | 요청·응답·권한 |
|---|---|---|
| GET | `/members` | 같은 기관의 `MemberResponse[]`, ADMIN |
| PATCH | `/members/{id}/role` | `{role,expectedRevision,reason}` → `MemberResponse`, ADMIN |

`MemberResponse`는 `{id,username,displayName,department,role,active,revision}`이다. 역할은 APPLICANT/INFRA/SECURITY/ADMIN 중 하나이며 다른 기관 계정은 관리할 수 없다. 변경 사유·revision 검증과 감사 기록이 필요하다. 계정 역할 변경은 해당 신청의 활성 담당자 배정을 자동 생성하는 동작이 아니다.

신규 `/operations`는 계정 역할 편집 UI를 제공하지 않는다. 실제 관리자 편집 화면을 추가할 때 서버 계약을 이용하고 현재 역할·배정에 미치는 영향을 함께 검토한다.

## 사업 건 분석

| 메서드 | 경로 | 요청·응답 |
|---|---|---|
| POST | `/business-cases/{caseId}/analyses` | multipart `expectedRevision`, `text?`, `file?`, `configurationId?` → `CaseAnalysisResponse` |
| GET | `/business-cases/{caseId}/analyses` | `CaseAnalysisResponse[]` |
| GET | `/business-cases/{caseId}/analyses/{id}` | `CaseAnalysisResponse` |
| POST | `/business-cases/{caseId}/analyses/{id}/apply` | `{expectedRevision}` → `BusinessCaseResponse` |

현재 분석은 해당 사업 건의 APPLICANT 작성자만 요청·조회·적용한다. `expectedRevision`은 사업 건 revision이다. 입력은 UTF-8 TXT/MD 파일 최대 1 MiB와 텍스트이며 파일 선택만으로 전송하지 않는다. 사용자가 분석을 요청할 때만 업로드한다. 출력 DTO는 파일의 저장소 경로·전체 원문을 노출하지 않는다.

```ts
interface CaseAnalysisResponse {
  id: string;
  caseId: string;
  revision: number;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'STALE';
  mode: 'EXAMPLE' | 'LIVE';
  provider: string;
  model: string;
  error: string | null;
  suggestions: Array<{ key: string; value: string; evidence: string }>;
  createdAt: string;
}
```

분석과 후보 적용과 사람의 확인은 서로 다른 행동이다. apply는 클라이언트가 보낸 후보 값을 사용하지 않고 서버에 저장된 분석 후보를 읽는다. 성공한 분석의 대상 revision과 현재 공통 정보 revision이 같아야 하며 오래된 분석은 409로 거부한다. 사람의 확인 완료 값을 AI가 조용히 덮어쓰지 않는다. 후보는 `AI_INFERRED`·근거·미확정으로 저장한다.

기본 EXAMPLE은 아래와 같은 이름 붙인 원문 행을 추출한다. 자유 문장의 의미를 이해하는 모델 호출이나 RAG로 표시하지 않는다.

```text
목적: 공개된 합성 행사 안내를 검색합니다.
처리 정보: 합성 행사명과 공개 안내 문구만 사용합니다.
외부 전송: 실제 외부 시스템과 연결하지 않는 시연입니다.
자료 흐름: 합성 입력을 읽어 시연 화면에 표시합니다.
```

허용 후보 키는 `purpose`, `dataTypes`, `externalTransfer`, `dataFlow`다. 서버는 원문의 정확한 근거·중복 키·허용 필드·출력 길이를 다시 검사한다. 내부 IP·시스템·포트·기관 정책은 추론 대상이 아니다. 모델 실패는 실패 이력과 오류로 남기며 EXAMPLE 성공으로 대체하지 않는다.

## LLM 구성 — API 제공, 신규 편집·선택 화면 미연결

| 메서드 | 경로 | 요청·응답·권한 |
|---|---|---|
| GET | `/llm-configurations` | 같은 기관의 `LlmConfigurationResponse[]`, ADMIN |
| POST | `/llm-configurations` | `{connection,purpose,reason}` → `LlmConfigurationResponse`, ADMIN |

`connection`은 `{provider,endpoint,model,keyReference,temperature,maxTokens,timeoutSeconds}`이고 `purpose`는 INTERVIEW/SUMMARY/DOCUMENT 중 하나다. 응답은 `{id,purpose,connection,createdAt}`이다. 구성은 새 레코드로 남기며 기존 분석 작업이 참조하는 구성을 바꾸지 않는다.

`provider`는 EXAMPLE/OPENAI/GEMMA 범위다. 외부 연결은 서버의 정확한 허용 목록과 공급자 규약을 통과해야 한다. 키 원문을 API·DB에 저장하지 않고 `BOAN_OPENAI_API_KEY` 또는 `BOAN_GEMMA_API_KEY` 같은 허용된 환경변수 참조를 사용한다. HTTPS·공개 DNS·리다이렉트 거부·응답 상한·시간 제한은 기존 안전 전송 경계를 유지한다. Gemma 경로는 현재 Google `generateContent` 규약이며 모든 OpenAI 호환 엔드포인트를 자동 지원한다는 의미가 아니다.

관리자가 만든 같은 기관의 구성 ID를 분석 요청의 `configurationId`로 지정한다. 생략하면 EXAMPLE을 사용한다. 현재 신규 화면의 기본 분석은 이 예시 경로이며 모델 선택 UI를 인수해야 한다. 기존 `/admin/models`는 이전 institution 게시본 API를 사용하므로 새 LLM 구성 관리 화면으로 간주하지 않는다.

Spring AI `ChatClient`/`ChatModel`은 `LlmGateway` 뒤에서 사용한다. 공개자료 PGVector 의존성 준비와 실제 RAG 색인·검색은 다른 작업이다. 실제 외부 모델 2종 호출·품질 평가는 이번 API 설명만으로 완료 처리하지 않고 별도 실행 증거를 요구한다.
