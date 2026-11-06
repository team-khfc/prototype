-- 기존 예제 분석 자료는 보존하고 사업 건 단위 분석과 모델 연결 버전을 추가한다.
-- 원문은 업로드 객체로 별도 보관하며 감사에는 값·프롬프트 원문을 넣지 않는다.
CREATE TABLE llm_configurations (
  id UUID PRIMARY KEY,
  institution_id UUID NOT NULL,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('EXAMPLE', 'OPENAI', 'GEMMA')),
  endpoint VARCHAR(500) NOT NULL,
  model VARCHAR(120) NOT NULL,
  key_reference VARCHAR(100) NOT NULL,
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('INTERVIEW', 'SUMMARY', 'DOCUMENT')),
  temperature DOUBLE PRECISION NOT NULL,
  max_tokens INTEGER NOT NULL,
  timeout_seconds INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX llm_configurations_institution_idx ON llm_configurations(institution_id);

CREATE TABLE case_analysis_jobs (
  id UUID PRIMARY KEY,
  business_case_id UUID NOT NULL REFERENCES business_cases(id),
  institution_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  input_revision BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'STALE')),
  mode VARCHAR(10) NOT NULL CHECK (mode IN ('EXAMPLE', 'LIVE')),
  provider VARCHAR(20) NOT NULL,
  model VARCHAR(120) NOT NULL,
  configuration_id UUID REFERENCES llm_configurations(id),
  source_objects JSONB NOT NULL,
  suggestions JSONB NOT NULL,
  error VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX case_analysis_jobs_case_idx ON case_analysis_jobs(business_case_id, created_at);
