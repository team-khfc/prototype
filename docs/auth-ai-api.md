# 인증·회원·분석·모델·비공개 컨텍스트 API

작성일: 2026-11-07. 현재 컨트롤러·DTO·서비스와 프런트엔드 계약을 설명한다. 신청 업무는 [starter-api.md](starter-api.md), 실제 실행 결과는 [verification-fresh.md](verification-fresh.md)를 함께 읽는다.

## 공통 경계

경로 기준은 `/api`다. 브라우저는 같은 출처의 Next.js 프록시로 서버의 `SA_SESSION` 세션을 사용한다. 변경 요청은 `/auth/csrf`가 반환한 `headerName`·`token`을 헤더로 전달한다. 로그인·가입도 CSRF 검사를 거친다. 인증·역할·기관은 서버의 계정에서 판단한다.

성공은 DTO 자체, 오류는 ProblemDetail(`status`, `code`, `detail`, `requestId`)이며 업무 버전 충돌에는 `latestRevision`을 제공한다. 공개 메모리 시연은 이 인증 경계를 대신하지 않는다. 세션이 바뀌면 사용자·기관별 캐시를 분리하고 이전 요청 응답을 새 사용자 화면에 반영하지 않는다.

## 로그인·가입

| 메서드 | 경로 | 요청·응답 |
|---|---|---|
| GET | `/auth/csrf` | `{token,headerName}` |
| POST | `/auth/login` | form `username`, `password` → `SessionResponse` |
| GET | `/auth/session` | `SessionResponse` |
| POST | `/auth/extend` | `SessionResponse` |
| POST | `/auth/logout` | 204 |
| POST | `/auth/signup` | `{username,password,displayName,department?}` → 201 `UserResponse` |

`UserResponse={userId,institutionId,username,displayName,role}`. `SessionResponse={user,institutionName,expiresAt}`.

가입 API는 합성 시연 기관의 APPLICANT만 만든다. 요청의 추가 role·institutionId로 승격하거나 기관을 바꿀 수 없다. 아이디는 영숫자로 시작하는 4~40자(영숫자·점·밑줄·하이픈), 소문자로 저장한다. 비밀번호는 대소문자·숫자를 포함한 12자 이상, UTF-8 72바이트 이하다. 합성 표시명을 사용한다. 가입 뒤 로그인 화면에서 인증하며 자동 로그인하지 않는다.

중복 아이디는 409 `USERNAME_EXISTS`다. 비밀번호 누락·12자 미만 등 DTO 형식 검증은 400 `INVALID_INPUT`, 대소문자·숫자·UTF-8 바이트 정책 위반은 422 `PASSWORD_POLICY`다. 업무 API의 미인증은 401, 권한 거부는 403이다. 오류·응답·로그에 비밀번호와 해시를 포함하지 않는다. 합성 seed 계정 암호는 `SA_DEMO_*_PASSWORD`로 주입한다.

## 기관 계정 역할 관리

화면은 `/operations/members`, 코드는 `frontend/features/auth/MemberManagement.tsx`와 `useMembers.ts`다.

| 메서드 | 경로 | 요청·응답 |
|---|---|---|
| GET | `/members` | 같은 기관의 `MemberResponse[]`, ADMIN |
| PATCH | `/members/{id}/role` | `{role,expectedRevision,reason}` → `MemberResponse`, ADMIN |

`MemberResponse={id,username,displayName,department,role,active,revision}`. role은 APPLICANT/INFRA/SECURITY/ADMIN이다. 서버가 기관·사유·현재 revision을 확인하고 역할 변경과 감사를 한 트랜잭션에 저장한다. 오래된 수정본은 409다.

역할 변경은 기존 신청의 담당자 자동 배정과 별도다. 검토 행위는 계정의 현재 역할·기관과 해당 신청의 활성 배정을 다시 검사한다. 관리자는 자동으로 신청 검토자가 되지 않는다. 현재 화면은 목록·역할 변경을 제공하고 계정 삭제·기관 이동·운영 SSO는 제공하지 않는다.

## 사업 건 분석

| 메서드 | 경로 | 요청·응답 |
|---|---|---|
| POST | `/business-cases/{caseId}/analyses` | multipart `expectedRevision`, `text?`, `file?`, `configurationId?` → `CaseAnalysisResponse` |
| GET | `/business-cases/{caseId}/analyses` | `CaseAnalysisResponse[]` |
| GET | `/business-cases/{caseId}/analyses/{id}` | `CaseAnalysisResponse` |
| POST | `/business-cases/{caseId}/analyses/{id}/apply` | `{expectedRevision}` → `BusinessCaseResponse` |

작성자 APPLICANT만 해당 사업 건의 분석을 요청·조회·적용한다. 버전은 사업 건 revision이다. 현재 입력은 UTF-8 TXT/MD 최대 1 MiB와 텍스트이며, 파일 선택만으로 전송하지 않고 분석 요청 때 전송한다. 업로드는 `document/service/UploadStorage`, 분석 저장·적용은 `request/service/CaseAnalysis*`, 모델 호출은 `llm` 컨텍스트다. 응답은 파일 경로와 전체 원문을 공개하지 않는다.

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

분석 → 저장된 후보 적용 → 사람의 확인을 분리한다. apply는 클라이언트가 임의로 보낸 후보가 아니라 서버 분석 기록을 읽는다. 현재 공통 정보 revision과 분석의 대상 revision이 다르면 409로 거부한다. 확인된 값을 조용히 덮지 않는다. 후보는 `AI_INFERRED`·근거·미확정으로만 저장한다.

기본 EXAMPLE은 다음과 같이 라벨이 있는 원문 행을 발췌한다. 자연어를 이해한 외부 LLM·RAG라고 표시하지 않는다.

```text
목적: 공개된 합성 행사 안내를 검색합니다.
처리 정보: 합성 행사명과 공개 안내 문구만 사용합니다.
외부 전송: 실제 외부 시스템과 연결하지 않는 시연입니다.
자료 흐름: 합성 입력을 읽어 시연 화면에 표시합니다.
```

후보 키는 `purpose`, `dataTypes`, `externalTransfer`, `dataFlow`다. 서버는 허용 필드·중복·길이·원문 근거·기관 기술 정보 포함 여부를 검증한다. 담당자 소유의 내부 IP·시스템·포트 후보를 생성하거나 사용자 요청으로 AI 출처를 임의 지정할 수 없다. 외부 모델 오류·키 부재를 EXAMPLE 성공으로 바꾸지 않는다.

## 모델 선택과 연결 관리

분석 화면은 사용자용 선택 목록을 쓰고, 관리자 화면 `/operations/models`는 별도 연결 관리 API를 사용한다. 소스는 `frontend/features/llm/`과 `backend/.../llm/`이다.

| 메서드 | 경로 | 권한·반환 |
|---|---|---|
| GET | `/llm-options` | 인증 사용자, 같은 기관의 `LlmOptionResponse[]` |
| GET | `/llm-configurations` | ADMIN, 같은 기관의 `LlmConfigurationResponse[]` |
| POST | `/llm-configurations` | ADMIN, 새 구성을 저장해 `LlmConfigurationResponse` 반환 |

`LlmOptionResponse={id,purpose,provider,model,mode}`. 기본 EXAMPLE 항목은 id=null이고 구성 ID를 생략한 분석은 이 경로를 사용한다. 일반 사용자에게 endpoint·keyReference는 보내지 않는다. LIVE 옵션 표시나 구성 등록 성공은 실제 모델 호출 성공을 뜻하지 않는다.

관리자 등록 요청:

```json
{
  "purpose": "INTERVIEW",
  "reason": "합성 시연 모델 연결 등록",
  "connection": {
    "provider": "OPENAI",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "model": "gpt-4.1-mini",
    "keyReference": "SA_OPENAI_API_KEY",
    "temperature": 0,
    "maxTokens": 1024,
    "timeoutSeconds": 15
  }
}
```

위 JSON은 연결 형식 예시이며 이 모델을 이번에 실제 호출했다는 뜻이 아니다. 용도는 INTERVIEW/SUMMARY/DOCUMENT, 제공자는 OPENAI/GEMMA/EXAMPLE이다. 관리자 UI는 LIVE 제공자 등록을 제공하고 기본 EXAMPLE은 항상 선택 가능하다. API의 EXAMPLE 구성은 빈 endpoint·keyReference를 요구한다.

응답은 `{id,purpose,connection,createdAt}`이다. 각 등록은 새 ID를 생성하며 과거 분석의 구성을 덮어쓰지 않는다. 수정·삭제 API는 현재 없다. 온도 0~1, 토큰 256~4096, timeout 5~60초를 검증한다. 주소는 `SA_ALLOWED_LLM_ENDPOINTS`와 공급자별 HTTPS 규칙을 모두 만족해야 한다. 키 참조는 공급자에 맞는 `SA_OPENAI_API_KEY` 또는 `SA_GEMMA_API_KEY`이며 원문 키를 입력·저장하지 않는다.

실제 요청 때 공개 주소·리디렉션·응답 크기·시간 제한을 추가 검사한다. 잘못된 구성은 422 `INVALID_MODEL_CONFIGURATION`, 다른 기관의 구성 ID는 404다. 공급자별 최신 모델·요금·가용성은 실제 연결 검증 시 공식 문서와 운영 설정으로 다시 확인한다.

## 비공개 컨텍스트와 공개 지식

| 메서드 | 경로 | 권한·DTO |
|---|---|---|
| GET | `/private-contexts` | INFRA/SECURITY/ADMIN, 같은 기관의 최근 100건 `ContextResponse[]` |
| POST | `/private-contexts` | ADMIN, `{title,category,content}` → 201 `ContextResponse` |
| GET | `/knowledge` | 현재 공개 참고자료 메타데이터 목록 |

`ContextResponse={id,title,category,content,createdAt,createdBy}`. title≤100자, category≤40자, content≤10,000자다. title/category/content는 AES-256-GCM으로 암호화하고 기관·자료 ID를 AAD에 묶는다. 암호화 키 `SA_CONTEXT_KEY`는 환경변수만 사용한다. 등록·조회 감사에는 본문 대신 참조만 남긴다. 신청자는 조회할 수 없다.

현재 비공개 자료 편집 UI·수정 API·RAG 검색·외부 모델 전송은 구현하지 않았다. 공개자료 메타데이터 제공과 PGVector 의존성은 실제 색인·검색 완료를 뜻하지 않는다. API에서도 합성 참고 자료만 사용한다.

## 다음 인수 항목

실제 외부 모델 2종 교차 구동, 대화형 인터뷰·AI 최종 초안, 공개자료 색인·근거 품질, 문서 형식 확장이 남아 있다. EXAMPLE 통과와 프로토콜 단위 테스트를 이 항목의 통과 증거로 바꾸지 않는다. 새 기능은 기능 명세·보안·API·화면·실제 검증 기록을 함께 갱신한다.
