package kr.securityadvisor.review.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.common.domain.AnswerValue;
import kr.securityadvisor.common.entity.BaseTimeEntity;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 할당 사실·분야별 협의·보완 해결을 서로 다른 상태로 보존한다. */
@Entity
@Table(name = "request_reviews")
public class Review extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "institution_id", nullable = false, updatable = false)
  private UUID institutionId;

  @Column(name = "request_id", nullable = false, updatable = false)
  private UUID requestId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20, updatable = false)
  private Role field;

  @Column(nullable = false, length = 32)
  private String status;

  @Column(name = "allocation_completed", nullable = false)
  private boolean allocationCompleted;

  @Column(nullable = false, length = 1000)
  private String comment;

  @Column(name = "completed_by", length = 100)
  private String completedBy;

  @Column(name = "completed_at")
  private Instant completedAt;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<Supplement> supplements;

  protected Review() {}

  public Review(UUID institutionId, UUID requestId, Role field) {
    if (field != Role.INFRA && field != Role.SECURITY)
      throw new IllegalArgumentException("검토 분야가 필요합니다.");
    id = UUID.randomUUID();
    this.institutionId = institutionId;
    this.requestId = requestId;
    this.field = field;
    status = "PENDING";
    comment = "";
    supplements = List.of();
  }

  public record Supplement(
      UUID id,
      Role field,
      List<String> fieldKeys,
      String reason,
      String answer,
      String status,
      String requestedBy,
      Instant createdAt,
      Instant resolvedAt) {
    public Supplement {
      fieldKeys = List.copyOf(fieldKeys);
    }
  }

  /** 할당 완료 후에도 별도 협의 완료 명령을 요구한다. */
  public void completeAllocation() {
    if (field != Role.INFRA) throw new DomainException(403, "INFRA_REQUIRED", "인프라 분야만 자원을 할당합니다.");
    allocationCompleted = true;
    if (!"COMPLETE".equals(status)) status = "ALLOCATED";
  }

  /** 해당 분야의 확인과 미해결 보완을 검사하고 협의를 완료한다. */
  public void complete(Actor actor, String note, boolean allocationReady, boolean answersReady) {
    requireField(actor);
    if (!allocationReady || !answersReady || unresolved()) {
      throw new DomainException(422, "REVIEW_NOT_READY", "할당·담당 항목 확인·보완 해결을 완료해 주세요.");
    }
    String value = AnswerValue.clean(note, 1000);
    if (value.isBlank())
      throw new DomainException(422, "REVIEW_COMMENT_REQUIRED", "검토 의견을 입력해 주세요.");
    status = "COMPLETE";
    comment = value;
    completedBy = actor.displayName();
    completedAt = Instant.now();
  }

  /** 의견·보완 기록은 남기면서 변경된 값에 대한 완료 판단만 무효화한다. */
  public void invalidate(boolean allocationChanged) {
    if ("COMPLETE".equals(status)) status = "RECHECK";
    if (field == Role.INFRA && allocationChanged) {
      allocationCompleted = false;
      if (!"PENDING".equals(status) && !"SUPPLEMENT_REQUESTED".equals(status)) status = "RECHECK";
    }
  }

  public UUID requestSupplement(Actor actor, List<String> keys, String reason) {
    requireField(actor);
    String why = AnswerValue.clean(reason, 1000);
    if (why.isBlank() || keys.isEmpty())
      throw new DomainException(422, "SUPPLEMENT_DETAILS_REQUIRED", "대상 항목과 보완 사유가 필요합니다.");
    var list = new ArrayList<>(supplements);
    UUID supplementId = UUID.randomUUID();
    list.add(
        new Supplement(
            supplementId, field, keys, why, "", "OPEN", actor.displayName(), Instant.now(), null));
    supplements = List.copyOf(list);
    status = "SUPPLEMENT_REQUESTED";
    return supplementId;
  }

  public void answerSupplement(UUID supplementId, String answer) {
    String value = AnswerValue.clean(answer, 4000);
    if (value.isBlank())
      throw new DomainException(422, "SUPPLEMENT_ANSWER_REQUIRED", "보완 답변을 입력해 주세요.");
    Supplement old = getSupplement(supplementId);
    if (!"OPEN".equals(old.status()))
      throw new DomainException(409, "SUPPLEMENT_NOT_OPEN", "열린 보완 요청에만 답변할 수 있습니다.");
    replace(
        new Supplement(
            old.id(),
            field,
            old.fieldKeys(),
            old.reason(),
            value,
            "ANSWERED",
            old.requestedBy(),
            old.createdAt(),
            null));
    status = "RECHECK";
  }

  public void resolveSupplement(Actor actor, UUID supplementId) {
    requireField(actor);
    Supplement old = getSupplement(supplementId);
    if (!"ANSWERED".equals(old.status()))
      throw new DomainException(422, "SUPPLEMENT_ANSWER_REQUIRED", "신청자의 답변을 받은 뒤 해결해 주세요.");
    replace(
        new Supplement(
            old.id(),
            field,
            old.fieldKeys(),
            old.reason(),
            old.answer(),
            "RESOLVED",
            old.requestedBy(),
            old.createdAt(),
            Instant.now()));
    status = unresolved() ? "SUPPLEMENT_REQUESTED" : "RECHECK";
  }

  public boolean containsSupplement(UUID id) {
    return supplements.stream().anyMatch(s -> s.id().equals(id));
  }

  public boolean unresolved() {
    return supplements.stream().anyMatch(s -> !"RESOLVED".equals(s.status()));
  }

  public boolean hasOpen() {
    return supplements.stream().anyMatch(s -> "OPEN".equals(s.status()));
  }

  private Supplement getSupplement(UUID id) {
    return supplements.stream()
        .filter(s -> s.id().equals(id))
        .findFirst()
        .orElseThrow(() -> new DomainException(404, "SUPPLEMENT_NOT_FOUND", "보완 요청을 찾을 수 없습니다."));
  }

  private void replace(Supplement replacement) {
    supplements =
        supplements.stream().map(s -> s.id().equals(replacement.id()) ? replacement : s).toList();
  }

  private void requireField(Actor actor) {
    if (actor.role() != field)
      throw new DomainException(403, "REVIEW_FIELD_REQUIRED", "해당 분야 담당자만 검토할 수 있습니다.");
  }

  public UUID getId() {
    return id;
  }

  public Role getField() {
    return field;
  }

  public String getStatus() {
    return status;
  }

  public boolean isAllocationCompleted() {
    return allocationCompleted;
  }

  public String getComment() {
    return comment;
  }

  public String getCompletedBy() {
    return completedBy;
  }

  public Instant getCompletedAt() {
    return completedAt;
  }

  public List<Supplement> getSupplements() {
    return List.copyOf(supplements);
  }
}
