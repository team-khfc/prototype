# ADR 0005 — Spring AI 어댑터와 공개 지식의 최소 구현

- 일자: 2026-11-06
- 상태: 최신 확정 스택에 따른 프로토타입 적용
- 대체: ADR 0003의 SDK·모델 연결·공개 지식 구현 범위

Spring AI 2.0.2의 ChatClient·ChatModel을 공통 LanguageModelAdapter 뒤에서 사용한다. 업무 domain은 Spring AI 타입에 의존하지 않는다. OpenAI와 OpenAI 호환 제공자를 지원하며 연결·모델·용도 라우팅은 DB 설정으로 관리한다. 키는 허용된 환경변수 참조만 저장한다. 기존 Gemma 연결은 프로토콜을 추정해 자동 전환하지 않고 명시적 재설정을 요구한다.

모델 연결 설정은 질문·양식 게시본과 별도 수명주기로 관리한다. 분석은 입력 revision과 실행 당시 연결 정보를 보존하며, 설정 변경이나 입력 변경을 과거 결과에 소급 적용하지 않는다. AI 결과와 최종 초안의 보완분은 미확정이다. 담당자 질의에서도 공개 근거와 기관 비공개 사실을 분리한다.

SDK 전송은 HTTPS URL의 정확한 허용 목록, 공개 DNS 주소, 연결/읽기 시간, 응답 길이, 리다이렉트 금지 정책을 따른다. 오류를 EXAMPLE 성공으로 숨기지 않는다. 입력·AI 출력의 명령문은 자료로 취급하며 구조·필드·근거를 서버에서 검증한다.

PGVectorVectorStore는 PostgreSQL vector 확장에 공식 공개 자료의 제목·요약을 색인한다. 외부 임베딩 키 없는 최소 구조 증명을 위해 256차원 특징 해시 임베딩을 사용한다. 이는 신경망 의미 검색·전문 RAG의 정확도 입증이 아니며 공식 문서 전문 수집·정제·검색 품질 평가는 후속 작업이다. 기관 컨텍스트는 AES-GCM·기관 격리 경계 안에 보관하고 자동 공개 색인이나 외부 전송 대상에 넣지 않는다.

## 버전·기술 근거

- Spring AI 공식 OpenAI 안내: https://docs.spring.io/spring-ai/reference/api/chat/openai-chat.html
- Spring AI 2.0.2 Maven POM: https://repo.maven.apache.org/maven2/org/springframework/ai/spring-ai-openai/2.0.2/spring-ai-openai-2.0.2.pom
- pgvector 0.8.0 이미지 메타데이터: https://hub.docker.com/v2/repositories/pgvector/pgvector/tags/0.8.0-pg17
- Google Java Format 공식 릴리스: https://github.com/google/google-java-format/releases

어댑터의 합성 HTTP 계약 검사를 실제 외부 두 모델 실호출이나 품질 평가로 집계하지 않는다. 두 모델 구동 입증은 승인된 환경에 실제 키·모델을 설정하여 별도로 수행해야 한다.
