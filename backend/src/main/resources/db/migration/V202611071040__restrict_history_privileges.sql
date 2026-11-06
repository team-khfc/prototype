-- 이미 병합된 이력 테이블·트리거를 유지하면서 실제 실행 계정의 권한도 추가 전용으로 제한한다.
-- 기본 검사 DB에는 역할이 없을 수 있으므로 역할 생성은 인프라 초기화가 담당한다.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'boan_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON
      audit_events, security_submissions, review_final_confirmations
      FROM boan_app;
    GRANT SELECT, INSERT ON
      audit_events, security_submissions, review_final_confirmations
      TO boan_app;
  END IF;
END;
$$;
