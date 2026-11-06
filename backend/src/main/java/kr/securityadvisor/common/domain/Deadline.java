package kr.securityadvisor.common.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import kr.securityadvisor.common.entity.BaseTimeEntity;
import kr.securityadvisor.common.security.Role;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 기한일은 한 번만 계산하고 재산정은 새 행으로 남긴다. */
@Entity
@Table(name = "request_deadlines")
public class Deadline extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "institution_id", nullable = false, updatable = false)
  private UUID institutionId;

  @Column(name = "request_id", nullable = false, updatable = false)
  private UUID requestId;

  @Enumerated(EnumType.STRING)
  @Column(length = 20, updatable = false)
  private Role field;

  @Column(nullable = false, length = 20, updatable = false)
  private String kind;

  @Column(name = "started_at", nullable = false, updatable = false)
  private Instant startedAt;

  @Column(name = "due_at", nullable = false, updatable = false)
  private Instant dueAt;

  @Column(name = "publication_version", nullable = false, updatable = false)
  private long publicationVersion;

  @Column(nullable = false)
  private boolean active;

  @Column(name = "closed_at")
  private Instant closedAt;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, updatable = false, columnDefinition = "jsonb")
  private Set<LocalDate> holidays;

  protected Deadline() {}

  public Deadline(
      UUID institutionId,
      UUID requestId,
      Role field,
      String kind,
      int days,
      Set<LocalDate> holidays,
      long publicationVersion,
      Instant now) {
    id = UUID.randomUUID();
    this.institutionId = institutionId;
    this.requestId = requestId;
    this.field = field;
    this.kind = kind;
    startedAt = now;
    this.holidays = Set.copyOf(holidays);
    dueAt = BusinessCalendar.deadline(now, days, holidays);
    this.publicationVersion = publicationVersion;
    active = true;
  }

  public void close(Instant now) {
    if (active) {
      active = false;
      closedAt = now;
    }
  }

  public UUID getId() {
    return id;
  }

  public Role getField() {
    return field;
  }

  public String getKind() {
    return kind;
  }

  public Instant getDueAt() {
    return dueAt;
  }

  public boolean isActive() {
    return active;
  }

  public Instant getClosedAt() {
    return closedAt;
  }

  public String timing(Instant now) {
    return active ? BusinessCalendar.timing(dueAt, now, holidays) : "CLOSED";
  }
}
