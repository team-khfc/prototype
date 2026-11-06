# ADR 0002 — Spring AI를 공통 LLM 경계 뒤에서 사용

- 일자: 2026-11-07
- 상태: 어댑터 적용, 외부 모델 교차 구동·RAG는 추가 검증 필요
- 상위 기준: PROJECT_CONTEXT v2.7, FUNCTIONAL_SPEC F-03·F-09·F-10

## 결정

Spring AI BOM 2.0.0의 ChatClient·ChatModel과 PGVector 모듈을 사용한다. `llm.domain.LlmGateway`가 업무 코드에 노출하는 계약이고 `llm.service.SpringAiLlmGateway`가 Spring AI 타입을 소유한다. request/domain은 Spring AI를 참조하지 않는다.

OpenAI·Gemma의 요청/응답은 공급자별 ChatModel 어댑터로 처리하며 외부 HTTP에는 허용 엔드포인트·공개 주소 검증·크기·시간 제한을 적용한다. 관리자는 DB에 연결 구성과 환경변수 키 참조만 저장한다. API 키 원문은 DB·코드·응답·로그에 저장하지 않는다. 사용자용 `/api/llm-options`는 같은 기관의 구성 ID·용도·제공자·모델·모드만 제공한다.

키 없이 동작하는 EXAMPLE은 라벨이 있는 합성 원문을 발췌한다. LIVE 실패를 EXAMPLE 성공으로 대체하지 않는다. 제안은 허용 질문·근거·원문 일치·길이를 재검증하고, 기관 내부 IP·시스템·포트를 AI가 사실로 만들어 내지 못하게 한다. 저장된 후보 적용과 사람의 확인은 별도 행위다.

공개자료와 비공개 기관 사실은 분리한다. `knowledge`는 공개 자료 메타데이터와 암호화 컨텍스트를 관리하지만, 비공개 컨텍스트 원문을 자동으로 외부 모델에 보내지 않는다.

## 현재 한계와 인수 조건

Spring AI·pgvector 의존성과 DB 확장 준비는 RAG 완성이 아니다. 공개 문서 수집·판본·색인·검색·근거 품질은 다음 구현이다. 실제 모델 2종의 같은 합성 입력에 대한 구동, 실패 처리와 결과 차이를 별도 실행 증거로 남겨야 한다. 현재 자동 테스트는 어댑터 프로토콜과 안전한 후보 경계를 검증하며 유료 외부 호출은 하지 않는다.

대화형 인터뷰와 3단계 AI 최종 초안 생성, PDF/DOCX/HWP 추출은 현재 TXT/MD 사업 건 분석 이후의 인수 작업이다. 자세한 계약은 [auth-ai-api.md](../auth-ai-api.md)를 따른다.
