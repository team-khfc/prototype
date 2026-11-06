package kr.securityadvisor.assignment.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import kr.securityadvisor.common.entity.BaseTimeEntity;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Role;

/** 재배정 시 이전 행을 삭제하지 않는 분야별 배정이다. */
@Entity
@Table(name = "request_assignments")
public class Assignment extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "institution_id", nullable = false, updatable = false)
  private UUID institutionId;

  @Column(name = "business_case_id", nullable = false, updatable = false)
  private UUID caseId;

  @Column(name = "request_id", nullable = false, updatable = false)
  private UUID requestId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, updatable = false, length = 20)
  private Role field;

  @Column(name = "assignee_id", nullable = false, updatable = false)
  private UUID assigneeId;

  @Column(name = "assignee_name", nullable = false, updatable = false, length = 100)
  private String assigneeName;

  @Column(nullable = false)
  private boolean active;

  @Column(nullable = false, updatable = false, length = 1000)
  private String reason;

  @Column(name = "assigned_at", nullable = false, updatable = false)
  private Instant assignedAt;

  @Column(name = "ended_at")
  private Instant endedAt;

  protected Assignment() {}

  public Assignment(
      UUID institutionId,
      UUID caseId,
      UUID requestId,
      UUID applicantId,
      Role field,
      UUID assigneeId,
      String assigneeName,
      String reason) {
    if (assigneeId.equals(applicantId))
      throw new DomainException(422, "SELF_ASSIGNMENT", "자기 신청을 검토하도록 배정할 수 없습니다.");
    if (field != Role.INFRA && field != Role.SECURITY)
      throw new IllegalArgumentException("검토 분야가 필요합니다.");
    id = UUID.randomUUID();
    this.institutionId = institutionId;
    this.caseId = caseId;
    this.requestId = requestId;
    this.field = field;
    this.assigneeId = assigneeId;
    this.assigneeName = assigneeName;
    this.reason = reason;
    assignedAt = Instant.now();
    active = true;
  }

  public void deactivate() {
    active = false;
    endedAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public Role getField() {
    return field;
  }

  public UUID getAssigneeId() {
    return assigneeId;
  }

  public String getAssigneeName() {
    return assigneeName;
  }

  public boolean isActive() {
    return active;
  }

  public String getReason() {
    return reason;
  }

  public Instant getAssignedAt() {
    return assignedAt;
  }
}
