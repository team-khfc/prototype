package kr.securityadvisor.request.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import kr.securityadvisor.common.entity.BaseTimeEntity;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 서버와 DB 트리거 모두 수정·삭제를 막는 제출본이다. */
@Entity
@Table(name = "security_submissions")
public class SecuritySubmission extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "request_id", nullable = false, updatable = false)
  private UUID requestId;

  @Column(name = "institution_id", nullable = false, updatable = false)
  private UUID institutionId;

  @Column(name = "owner_id", nullable = false, updatable = false)
  private UUID ownerId;

  @Column(name = "submission_number", nullable = false, updatable = false)
  private int number;

  @Column(name = "idempotency_key", nullable = false, updatable = false, length = 100)
  private String idempotencyKey;

  @Column(name = "request_revision", nullable = false, updatable = false)
  private long requestRevision;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, updatable = false, columnDefinition = "jsonb")
  private SubmissionSnapshot snapshot;

  protected SecuritySubmission() {}

  public SecuritySubmission(
      UUID id,
      UUID requestId,
      UUID institutionId,
      UUID ownerId,
      int number,
      String idempotencyKey,
      long requestRevision,
      SubmissionSnapshot snapshot) {
    this.id = id;
    this.requestId = requestId;
    this.institutionId = institutionId;
    this.ownerId = ownerId;
    this.number = number;
    this.idempotencyKey = idempotencyKey;
    this.requestRevision = requestRevision;
    this.snapshot = snapshot;
  }

  public UUID getId() {
    return id;
  }

  public UUID getRequestId() {
    return requestId;
  }

  public UUID getOwnerId() {
    return ownerId;
  }

  public int getNumber() {
    return number;
  }

  public long getRequestRevision() {
    return requestRevision;
  }

  public SubmissionSnapshot getSnapshot() {
    return snapshot;
  }
}
