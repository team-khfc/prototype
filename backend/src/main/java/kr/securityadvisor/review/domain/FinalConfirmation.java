package kr.securityadvisor.review.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import kr.securityadvisor.common.entity.BaseTimeEntity;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;

/** 확인은 특정 제출본에만 유효하며 새 개정본에 재사용할 수 없다. */
@Entity
@Table(name = "review_final_confirmations")
public class FinalConfirmation extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "institution_id", nullable = false, updatable = false)
  private UUID institutionId;

  @Column(name = "request_id", nullable = false, updatable = false)
  private UUID requestId;

  @Column(name = "submission_id", nullable = false, updatable = false)
  private UUID submissionId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, updatable = false, length = 20)
  private Role field;

  @Column(name = "actor_id", nullable = false, updatable = false)
  private UUID actorId;

  @Column(name = "actor_name", nullable = false, updatable = false, length = 100)
  private String actorName;

  @Column(name = "confirmed_at", nullable = false, updatable = false)
  private Instant confirmedAt;

  protected FinalConfirmation() {}

  public FinalConfirmation(Actor actor, UUID requestId, UUID submissionId) {
    id = UUID.randomUUID();
    institutionId = actor.institutionId();
    this.requestId = requestId;
    this.submissionId = submissionId;
    field = actor.role();
    actorId = actor.userId();
    actorName = actor.displayName();
    confirmedAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public UUID getSubmissionId() {
    return submissionId;
  }

  public Role getField() {
    return field;
  }

  public String getActorName() {
    return actorName;
  }

  public Instant getConfirmedAt() {
    return confirmedAt;
  }
}
