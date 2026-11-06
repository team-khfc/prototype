# 팀 개발 인계 — 같은 시작점에서 다음 기능으로

작성일: 2026-11-07. 기준 문서는 PROJECT_CONTEXT v2.7의 표를 따른다. 이 문서는 이번 저장소의 코드 진입점과 다음 인수 조건을 연결하는 구현 안내이며 팀 규칙·역할 배치를 바꾸지 않는다.

## 공통 시작 순서

1. 루트 `python3 tools/check_doc_versions.py` 실행 후 PROJECT_CONTEXT → FUNCTIONAL_SPEC의 담당 F-xx → AGENTS → 관련 스타일·보안 규칙을 읽는다.
2. `/starter`에서 업무 용어와 화면 흐름을 확인한다. 이 단계는 공개 합성 시연이며 서버 검증 증거로 쓰지 않는다.
3. README대로 실제 서버를 실행하고 `/business-cases`, `/security-requests`에서 역할별 계정으로 같은 흐름을 확인한다.
4. [starter-api.md](starter-api.md)의 요청·응답·권한·revision과 담당 코드의 현재 구현을 함께 읽는다. 차이는 이슈의 완료 조건으로 기록한다.
5. 한 이슈에 구현 책임자와 검토자를 정하고 `<종류>/<이슈번호>-<짧은-설명>` 브랜치를 만든다. PR에는 시안 참고 SHA와 실제 검사 결과를 남긴다.

실제 프런트엔드·백엔드·DB를 기동한 뒤 저장소 루트에서 새 업무 HTTP 검사를 실행한다.

```bash
python3 scripts/smoke-starter.py
```

기본 주소는 `http://127.0.0.1:3000`이며 다른 합성 검증 서버는 `BOAN_TEST_BASE_URL`로 지정한다. 루트 `.env` 또는 환경변수의 역할별 시연 암호를 사용하고 새 합성 사업 건·신청·감사 이력을 만든다. 이 결과와 화면 확인 결과를 함께 인수 증거에 남긴다. 기존 `scripts/smoke.py`는 이전 procedure 호환 흐름의 검사로 유지한다.

코드에서 구현한 동작과 기능 명세가 요구하는 동작은 구별한다. 미완성 코드를 근거로 기능 명세의 업무 의미를 축소하지 않는다. 업무 의미의 변경은 팀장·기획 결정, 기술 변경은 ADR, 시각 기준 변경은 디자이너의 `design.md` 개정으로 기록한다.

## 팀장·통합 책임

**첫 진입점:** README, [alignment-notes.md](alignment-notes.md), [이번 검증 기록](verification-starter.md), [시나리오](starter-scenarios.md).

사용자 가치가 드러나는 한 경로를 먼저 인수한다: 회원가입/로그인 → 사업 건·서류 2종 → 업로드·AI 요약·공통 정보 → INFRA 할당 → 보완·반환 1회 → 사용자 최종 검토 → 제출 → 두 분야 최종 확인 → SECURITY 확정 → 감사 이력. 실제 모델 교체와 기관별 운영 세부는 검증 여부를 별도로 확인한다.

다음 결정은 P1 남은 작업의 담당·완료 조건, 동결 이후 허용 범위, 검증 환경과 교차 구동 담당이다. F-15~F-17은 11.09 리허설 통과 전에는 구현 완료로 표시하거나 필수 경로보다 먼저 착수하지 않는다. 규칙 문서의 동결/P2 문구 차이는 [정합성 기록](alignment-notes.md)에 남겼다.

**인수 기준:** 새 API 정상·거부 경로와 팀원이 직접 실행한 결과가 PR에 남고, 작성자 외 사람 1명 이상이 승인한다. GitHub 브랜치 보호·CODEOWNERS는 실제 설정·계정 확인 후 적용 여부를 확인한다. 파일이 존재한다는 이유만으로 보호가 활성화됐다고 판단하지 않는다.

## 백엔드·아키텍처 담당

**첫 코드:** `backend/src/main/java/kr/securityadvisor/request/`, `review/`, `assignment/`, `audit/`, `auth/`, `common/`, `backend/src/main/resources/db/migration/`, `backend/src/test/java/kr/securityadvisor/`.

`BusinessCase`는 CASE 공통 답변, `SecurityRequest`는 각 문서의 단계·상태와 REQUEST 답변을 소유한다. `Review`의 할당 완료와 검토 완료를 분리하고, 실제 인증 주체·기관·활성 배정·revision을 서버에서 검사한다. 제출 시 공통 값과 신청 값을 같은 불변 제출본에 담고 동일 제출본의 두 최종 확인을 요구한다.

다음 인수 작업은 API 계약과 구현의 누락, 기관별 ReviewerPool·공휴일·기한 정책, 감사 트랜잭션·동시성·권한 거부 경로의 증명, DB 제약과 migration 영향 검토다. 기존 `procedure`, `analysis`, `institution`은 보존 자산이다. 새 업무로 연결할 때 복사한 규칙을 두 군데 운영하지 않도록 경계를 정리한다.

**인수 기준:** JDK 25 빌드와 formatter/ArchUnit/도메인·DB 통합 검사, 오래된 revision·다른 기관·비배정자·자기 배정·중복 제출 거부, 반환 후 값·이력 보존을 실제로 확인한다. 기존 migration은 고치지 않고 후속 migration을 추가한다.

## 프런트엔드·AI 연동 담당

**첫 코드:** `frontend/app/`, `frontend/features/`, `frontend/lib/http.ts`, `backend/src/main/java/kr/securityadvisor/analysis/`, `llm/`. 파일별 실제 경로는 `rg --files frontend`로 확인한다. 프런트엔드 수정 전 `frontend/AGENTS.md`와 설치된 Next.js 문서를 읽는다.

`/starter`는 교육·설명용 메모리 시연이다. `/business-cases`와 `/security-requests`는 세션과 서버 DTO를 사용한다. 화면의 `allowedActions`는 표시 힌트이며 서버의 허용 판단을 대체하지 않는다. 409 때 사용자의 미저장 값을 보존하고 최신 revision으로 비교·재시도하게 한다.

새 BusinessCase 분석과 공통 인터뷰·신청별 질문을 연결할 때 기존 분석 서비스의 파일 검증·허용 엔드포인트·기밀 컨텍스트 분리·오래된 결과 방지를 재사용한다. 기존 Procedure ID에 새 Request ID를 섞지 않는다. 신규 후보는 서버 내부 제안 경계에서만 `AI_INFERRED`·미확정으로 생성한다. 일반 답변 API로 임의 AI 출처나 확인 주체를 보낼 수 없다.

Spring AI 타입은 공통 어댑터 내부에 둔다. 다음 인수는 모델 2종에서 같은 합성 입력·질문·근거·실패 처리를 재현하는 것이다. 실제 호출과 EXAMPLE 추출을 화면과 증거에서 구분한다. pgvector 모듈을 추가한 사실과 RAG 색인·검색 품질 검증을 구분한다. PDF/DOCX/HWP는 현재 TXT/MD 입력과 별도 후속 범위다.

연결할 인증·회원가입·계정 역할·사업 건 분석·LLM 구성의 상세는 [auth-ai-api.md](auth-ai-api.md)에 있다. 신규 LLM 구성과 기존 `/admin/models`의 설정 저장소를 혼동하지 않는다. 모델 구성 선택·계정 역할 편집은 신규 화면의 다음 인수 항목이다.

**인수 기준:** `npm run check`, `npm run build`, 실제 API 흐름·세션 만료·401/403/409·AI 실패·재시도·미확정 표시를 확인한다. 파일 선택만으로 업로드하지 않는다. 키는 환경변수 참조만 사용한다.

## 기획·업무 문구·합성 시나리오 담당

**첫 진입점:** FUNCTIONAL_SPEC 3·4·5·6장, [glossary.md](glossary.md), [starter-scenarios.md](starter-scenarios.md), `/starter`와 실제 역할별 화면.

공통 질문을 한 번만 묻는지, 두 서류가 독립으로 진행하는지, 할당·검토·제출·확정의 차이가 초보 사용자에게 분명한지 확인한다. 반환은 기존 값을 유지하면서 지정 필드를 강조해야 한다. 신청 상태에 “처리 완료/불가”를 다시 넣지 않는다. 사업 건 상태를 사용자가 직접 수정하는 기능을 만들지 않는다.

다음 인수는 두 문서의 최소 질문·담당 역할·필수 조건·근거·출력 항목 대응과 합성 시연 대본이다. 실존 기관명·담당자 개인정보·내부 IP를 모의자료에 사용하지 않는다. 입력할 수 없는 필드는 “잘 모름/담당자 확인 필요”가 어떤 상태인지 정한다.

**인수 기준:** 두 서류 모두 정상 흐름과 반환 1회를 설명할 수 있고, 반려·철회·확정 이후에는 조회·다운로드만 가능함을 화면과 API에서 확인한다. 대본의 각 문장에 구현·예시·예정을 구분한다.

## 디자이너·접근성 담당

**첫 진입점:** [prototype-soo](https://github.com/team-khfc/prototype-soo) 기본 브랜치의 최신 시안과 `MERGE_NOTES.md`, 본 저장소 `/starter`·실제 화면, [출처 기록](SOURCE_REFERENCES.md).

시안 원본과 `design.md`는 디자이너의 후속 작업 영역이다. 이번 시작점은 해당 파일을 변경하지 않는다. 새 시안 참고 커밋은 PR별로 기록하며 규칙 문서에 고정하지 않는다. 화면의 브라우저 저장소·역할 전환·CDN·AI 모의 동작은 서비스 구현 기준으로 복사하지 않는다.

다음 인수는 1:N 사업 건/서류별 상태, 회원가입, 배정·기한·감사 표시, 최종 확인·확정 문구, 반환 강조, 빈 상태·오류·모바일·키보드 탐색이다. 본문 크기는 현행 design.md 기준으로 적용하고 시안의 약 13.8px 축소와 차이를 정리한다. design.md의 이전 시안 경로·이전 상태 배지 갱신은 [정합성 기록](alignment-notes.md)에 남긴다.

**인수 기준:** 데이터·권한·상태 의미를 유지하면서 시각·접근성 차이가 설명되고, 새 디자인 참고 SHA를 기록한다. 11.08 이후 반영은 오류·접근성 수정과 팀장 승인 범위인지 확인한다.

## 다음 PR에 넘길 산출물

| 산출물 | 반드시 담을 내용 |
|---|---|
| 기능 이슈 | 사용자 역할·문제·포함 범위·명세 F-xx·완료 조건·검토자 |
| API 변경 | 경로·DTO·401/403/409·권한·revision·멱등성·기존 소비자 영향 |
| 화면 변경 | 참고 시안 SHA·업무 의미 차이·실제 API/공개 시연 경계·접근성 결과 |
| DB 변경 | 새 Flyway 파일·기존 자료 영향·복구 계획·불변 제출본/감사 영향 |
| 검증 기록 | 실행 환경·명령·결과·증거·실행하지 못한 항목·인수 담당 |

과거 `docs/VERIFICATION.md`, `docs/evidence/`, ADR 0001~0003은 당시 결정·검사의 이력이다. 이번 변경의 적용 범위는 ADR 0004, 새 API 계약과 이번 검증 기록으로 읽는다.
