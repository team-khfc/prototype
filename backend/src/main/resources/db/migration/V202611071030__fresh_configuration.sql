-- 이전 구조의 테이블·게시 자료는 보존한다. 현재 실행 구조는 이 불변 seed 게시본만 읽는다.
-- schema_key의 v1 계약은 SeedQuestions·CasePolicy·문서 렌더러에 고정되어 있다.
-- P2 설정 편집·게시를 구현할 때 새 버전을 추가하고 기존 사업 건의 버전은 바꾸지 않는다.
CREATE TABLE publications (
  id UUID PRIMARY KEY,
  institution_id UUID NOT NULL,
  institution_name VARCHAR(100) NOT NULL,
  version BIGINT NOT NULL CHECK (version > 0),
  schema_key VARCHAR(80) NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT publications_institution_version_unique UNIQUE (institution_id, version)
);

INSERT INTO publications (id, institution_id, institution_name, version, schema_key, published_at)
VALUES
  ('41000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '가상 시연 기관', 1, 'security-advisor-starter-v1', '2026-11-07 00:00:00+00'),
  ('41000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
   '다른 가상 시연 기관', 1, 'security-advisor-starter-v1', '2026-11-07 00:00:00+00');

CREATE FUNCTION reject_starter_publication_change() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Published configuration versions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER immutable_publications
BEFORE UPDATE OR DELETE ON publications
FOR EACH ROW EXECUTE FUNCTION reject_starter_publication_change();

-- 런타임에는 조회만 허용한다. 마이그레이션 계정이 게시본을 관리한다.
-- Testcontainers의 단일 계정에서도 스키마 검사가 가능하도록 운영 역할 유무를 확인한다.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'boan_app') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON publications FROM boan_app;
    GRANT SELECT ON publications TO boan_app;
  END IF;
END;
$$;
