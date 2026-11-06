-- 새 사업 건/신청 흐름만 추가한다. 기존 procedures 및 제출본은 보존한다.
-- 답변·보완·반환은 애그리거트 JSONB, 기관·상태·배정·제출본 제약은 DB로도 강제한다.
ALTER TABLE user_accounts ADD CONSTRAINT user_accounts_id_institution_unique UNIQUE (id, institution_id);

CREATE TABLE business_cases (
  id UUID PRIMARY KEY,
  institution_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  owner_name VARCHAR(100) NOT NULL,
  title VARCHAR(160) NOT NULL,
  department VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  publication_version BIGINT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision >= 0),
  lock_version BIGINT NOT NULL,
  answers JSONB NOT NULL CHECK (jsonb_typeof(answers) = 'array'),
  policy JSONB NOT NULL CHECK (jsonb_typeof(policy) = 'object'),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (id, institution_id),
  UNIQUE (id, institution_id, owner_id),
  FOREIGN KEY (owner_id, institution_id) REFERENCES user_accounts(id, institution_id)
);
CREATE INDEX business_cases_owner_idx ON business_cases(institution_id, owner_id, updated_at DESC);

CREATE TABLE security_requests (
  id UUID PRIMARY KEY,
  business_case_id UUID NOT NULL,
  institution_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  doc_type VARCHAR(32) NOT NULL CHECK (doc_type IN ('FIREWALL', 'SECURITY_REVIEW')),
  stage INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 4),
  status VARCHAR(32) NOT NULL,
  revision BIGINT NOT NULL CHECK (revision >= 0),
  lock_version BIGINT NOT NULL,
  current_submission_id UUID,
  terminal_snapshot JSONB CHECK (terminal_snapshot IS NULL OR jsonb_typeof(terminal_snapshot) = 'object'),
  answers JSONB NOT NULL CHECK (jsonb_typeof(answers) = 'array'),
  data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (business_case_id, doc_type),
  UNIQUE (id, institution_id),
  UNIQUE (id, business_case_id, institution_id),
  FOREIGN KEY (business_case_id, institution_id, owner_id)
    REFERENCES business_cases(id, institution_id, owner_id),
  CHECK (
    (stage = 1 AND status = 'DRAFT')
    OR (stage = 2 AND status IN ('CONSULTING', 'SUPPLEMENT_REQUESTED'))
    OR (stage = 3 AND status IN ('FINAL_REVIEW', 'SUPPLEMENT_REQUESTED'))
    OR (stage = 4 AND status IN ('SUBMITTED', 'FINALIZED'))
    OR status IN ('CLOSED', 'WITHDRAWN')
  ),
  CHECK (status NOT IN ('SUBMITTED', 'FINALIZED') OR current_submission_id IS NOT NULL),
  CHECK (status NOT IN ('CLOSED', 'WITHDRAWN') OR terminal_snapshot IS NOT NULL)
);
CREATE INDEX security_requests_owner_idx ON security_requests(institution_id, owner_id, updated_at DESC);

CREATE TABLE security_submissions (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL,
  institution_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  submission_number INTEGER NOT NULL CHECK (submission_number > 0),
  idempotency_key VARCHAR(100) NOT NULL,
  request_revision BIGINT NOT NULL CHECK (request_revision >= 0),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (request_id, submission_number),
  UNIQUE (institution_id, owner_id, idempotency_key),
  UNIQUE (id, request_id, institution_id),
  FOREIGN KEY (request_id, institution_id) REFERENCES security_requests(id, institution_id),
  FOREIGN KEY (owner_id, institution_id) REFERENCES user_accounts(id, institution_id)
);
ALTER TABLE security_requests ADD CONSTRAINT security_requests_current_submission_fk
  FOREIGN KEY (current_submission_id, id, institution_id)
  REFERENCES security_submissions(id, request_id, institution_id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE request_reviews (
  id UUID PRIMARY KEY,
  institution_id UUID NOT NULL,
  request_id UUID NOT NULL,
  field VARCHAR(20) NOT NULL CHECK (field IN ('INFRA', 'SECURITY')),
  status VARCHAR(32) NOT NULL CHECK (status IN ('PENDING', 'ALLOCATED', 'IN_REVIEW', 'SUPPLEMENT_REQUESTED', 'COMPLETE', 'RECHECK')),
  allocation_completed BOOLEAN NOT NULL,
  comment VARCHAR(1000) NOT NULL,
  completed_by VARCHAR(100),
  completed_at TIMESTAMPTZ,
  supplements JSONB NOT NULL CHECK (jsonb_typeof(supplements) = 'array'),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (request_id, field),
  FOREIGN KEY (request_id, institution_id) REFERENCES security_requests(id, institution_id),
  CHECK (field = 'INFRA' OR allocation_completed = FALSE)
);

CREATE TABLE review_final_confirmations (
  id UUID PRIMARY KEY,
  institution_id UUID NOT NULL,
  request_id UUID NOT NULL,
  submission_id UUID NOT NULL,
  field VARCHAR(20) NOT NULL CHECK (field IN ('INFRA', 'SECURITY')),
  actor_id UUID NOT NULL,
  actor_name VARCHAR(100) NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (submission_id, field),
  FOREIGN KEY (submission_id, request_id, institution_id)
    REFERENCES security_submissions(id, request_id, institution_id),
  FOREIGN KEY (actor_id, institution_id) REFERENCES user_accounts(id, institution_id)
);

CREATE TABLE reviewer_pools (
  id UUID PRIMARY KEY,
  institution_id UUID NOT NULL,
  field VARCHAR(20) NOT NULL CHECK (field IN ('INFRA', 'SECURITY')),
  reviewer_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (institution_id, field),
  FOREIGN KEY (reviewer_id, institution_id) REFERENCES user_accounts(id, institution_id)
);

CREATE TABLE request_assignments (
  id UUID PRIMARY KEY,
  institution_id UUID NOT NULL,
  business_case_id UUID NOT NULL,
  request_id UUID NOT NULL,
  field VARCHAR(20) NOT NULL CHECK (field IN ('INFRA', 'SECURITY')),
  assignee_id UUID NOT NULL,
  assignee_name VARCHAR(100) NOT NULL,
  active BOOLEAN NOT NULL,
  reason VARCHAR(1000) NOT NULL CHECK (length(trim(reason)) > 0),
  assigned_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (request_id, business_case_id, institution_id)
    REFERENCES security_requests(id, business_case_id, institution_id),
  FOREIGN KEY (assignee_id, institution_id) REFERENCES user_accounts(id, institution_id),
  CHECK (active = (ended_at IS NULL))
);
CREATE UNIQUE INDEX request_assignments_active_unique
  ON request_assignments(request_id, field) WHERE active;
CREATE INDEX request_assignments_actor_idx ON request_assignments(institution_id, assignee_id) WHERE active;

CREATE TABLE request_deadlines (
  id UUID PRIMARY KEY,
  institution_id UUID NOT NULL,
  request_id UUID NOT NULL,
  field VARCHAR(20) CHECK (field IN ('INFRA', 'SECURITY')),
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('CONSULTATION', 'SUPPLEMENT', 'FINALIZATION')),
  started_at TIMESTAMPTZ NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  publication_version BIGINT NOT NULL,
  active BOOLEAN NOT NULL,
  closed_at TIMESTAMPTZ,
  holidays JSONB NOT NULL CHECK (jsonb_typeof(holidays) = 'array'),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (request_id, institution_id) REFERENCES security_requests(id, institution_id),
  CHECK (due_at > started_at),
  CHECK (active = (closed_at IS NULL)),
  CHECK ((kind = 'CONSULTATION' AND field IS NOT NULL) OR (kind <> 'CONSULTATION' AND field IS NULL))
);
CREATE UNIQUE INDEX request_deadlines_active_unique
  ON request_deadlines(request_id, field, kind) NULLS NOT DISTINCT WHERE active;

CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  institution_id UUID,
  actor_id UUID,
  actor_name VARCHAR(100) NOT NULL,
  actor_role VARCHAR(20),
  target_type VARCHAR(40) NOT NULL,
  target_id UUID,
  target_revision BIGINT NOT NULL,
  action VARCHAR(80) NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  field_keys JSONB NOT NULL CHECK (jsonb_typeof(field_keys) = 'array'),
  request_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX audit_events_target_idx ON audit_events(institution_id, target_type, target_id, created_at DESC);

CREATE FUNCTION reject_workflow_history_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only workflow record cannot be modified or deleted' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER security_submissions_immutable BEFORE UPDATE OR DELETE ON security_submissions
  FOR EACH ROW EXECUTE FUNCTION reject_workflow_history_mutation();
CREATE TRIGGER final_confirmations_immutable BEFORE UPDATE OR DELETE ON review_final_confirmations
  FOR EACH ROW EXECUTE FUNCTION reject_workflow_history_mutation();
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_workflow_history_mutation();

CREATE FUNCTION preserve_terminal_request() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'workflow request history cannot be deleted' USING ERRCODE = '42501';
  END IF;
  IF OLD.status IN ('FINALIZED', 'CLOSED', 'WITHDRAWN') THEN
    RAISE EXCEPTION 'terminal request and its snapshot are immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER security_requests_terminal_immutable BEFORE UPDATE OR DELETE ON security_requests
  FOR EACH ROW EXECUTE FUNCTION preserve_terminal_request();

CREATE FUNCTION preserve_workflow_deadline() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'deadline history cannot be deleted' USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['active', 'closed_at', 'updated_at'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['active', 'closed_at', 'updated_at'])
      OR (NOT OLD.active AND NEW.active) THEN
    RAISE EXCEPTION 'stored deadline cannot be recalculated in place' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER request_deadlines_preserve BEFORE UPDATE OR DELETE ON request_deadlines
  FOR EACH ROW EXECUTE FUNCTION preserve_workflow_deadline();

CREATE FUNCTION reject_self_assignment() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM security_requests r WHERE r.id = NEW.request_id AND r.owner_id = NEW.assignee_id) THEN
    RAISE EXCEPTION 'applicant cannot review own request' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER request_assignments_not_self BEFORE INSERT ON request_assignments
  FOR EACH ROW EXECUTE FUNCTION reject_self_assignment();

-- P2 준비 스키마: 기능, 자동 생성, 적용 기록 API, 알림 발송은 아직 제공하지 않는다.
CREATE TABLE firewall_rules (
  id UUID PRIMARY KEY,
  institution_id UUID NOT NULL,
  request_id UUID NOT NULL,
  submission_id UUID NOT NULL,
  submission_revision BIGINT NOT NULL,
  source_address VARCHAR(200) NOT NULL,
  destination_address VARCHAR(200) NOT NULL,
  protocol VARCHAR(20) NOT NULL,
  port VARCHAR(100) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE,
  review_on DATE,
  status VARCHAR(32) NOT NULL,
  applied_at TIMESTAMPTZ,
  applied_by UUID,
  application_note VARCHAR(1000),
  withdrawal_reason VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (ends_on IS NOT NULL OR review_on IS NOT NULL),
  FOREIGN KEY (submission_id, request_id, institution_id)
    REFERENCES security_submissions(id, request_id, institution_id)
);
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  institution_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  event_kind VARCHAR(80) NOT NULL,
  event_key VARCHAR(200) NOT NULL,
  target_path VARCHAR(500) NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (recipient_id, event_key),
  FOREIGN KEY (recipient_id, institution_id) REFERENCES user_accounts(id, institution_id)
);
