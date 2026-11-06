package kr.securityadvisor.audit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.common.entity.BaseTimeEntity;
import kr.securityadvisor.common.security.Actor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 민감 원문을 복제하지 않는 추가 전용 업무 기록이다. */
@Entity
@Table(name = "audit_events")
public class AuditEvent extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "institution_id", updatable = false)
  private UUID institutionId;

  @Column(name = "actor_id", updatable = false)
  private UUID actorId;

  @Column(name = "actor_name", nullable = false, updatable = false, length = 100)
  private String actorName;

  @Column(name = "actor_role", updatable = false, length = 20)
  private String actorRole;

  @Column(name = "target_type", nullable = false, updatable = false, length = 40)
  private String targetType;

  @Column(name = "target_id", updatable = false)
  private UUID targetId;

  @Column(name = "target_revision", nullable = false, updatable = false)
  private long targetRevision;

  @Column(nullable = false, updatable = false, length = 80)
  private String action;

  @Column(nullable = false, updatable = false, length = 1000)
  private String reason;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "field_keys", nullable = false, updatable = false, columnDefinition = "jsonb")
  private List<String> fieldKeys;

  @Column(name = "request_id", nullable = false, updatable = false, length = 100)
  private String requestId;

  protected AuditEvent() {}

  public AuditEvent(
      Actor actor,
      String targetType,
      UUID targetId,
      long revision,
      String action,
      String reason,
      List<String> fieldKeys,
      String requestId) {
    id = UUID.randomUUID();
    institutionId = actor == null ? null : actor.institutionId();
    actorId = actor == null ? null : actor.userId();
    actorName = actor == null ? "인증 전 요청" : actor.displayName();
    actorRole = actor == null ? null : actor.role().name();
    this.targetType = targetType;
    this.targetId = targetId;
    targetRevision = revision;
    this.action = action;
    this.reason = reason == null ? "" : reason;
    this.fieldKeys = List.copyOf(fieldKeys);
    this.requestId =
        requestId == null || requestId.isBlank() ? UUID.randomUUID().toString() : requestId;
  }

  public UUID getId() {
    return id;
  }

  public UUID getInstitutionId() {
    return institutionId;
  }

  public String getActorName() {
    return actorName;
  }

  public String getActorRole() {
    return actorRole;
  }

  public String getTargetType() {
    return targetType;
  }

  public UUID getTargetId() {
    return targetId;
  }

  public long getTargetRevision() {
    return targetRevision;
  }

  public String getAction() {
    return action;
  }

  public String getReason() {
    return reason;
  }

  public List<String> getFieldKeys() {
    return List.copyOf(fieldKeys);
  }

  public String getRequestId() {
    return requestId;
  }
}
