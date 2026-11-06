-- 기존 계정과 해시는 유지하고 회원가입·관리자 역할 변경에 필요한 정보만 추가한다.
-- 복구는 데이터 보존 후 후속 마이그레이션으로 수행한다. 기존 마이그레이션은 수정하지 않는다.
ALTER TABLE user_accounts ADD COLUMN department VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE user_accounts ADD COLUMN registration_source VARCHAR(10) NOT NULL DEFAULT 'SEED';
ALTER TABLE user_accounts ADD COLUMN revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE user_accounts ADD CONSTRAINT user_accounts_registration_source_check
  CHECK (registration_source IN ('SEED', 'SELF'));
CREATE INDEX user_accounts_staff_idx ON user_accounts (institution_id, role, active);
