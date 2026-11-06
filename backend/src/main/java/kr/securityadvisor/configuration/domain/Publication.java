package kr.securityadvisor.configuration.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** 시작점의 고정 질문·양식·기한 계약을 식별하는 기관별 불변 게시본이다. */
@Entity
@Table(name = "publications")
public class Publication {
  @Id private UUID id;

  @Column(name = "institution_id", nullable = false, updatable = false)
  private UUID institutionId;

  @Column(name = "institution_name", nullable = false, length = 100, updatable = false)
  private String institutionName;

  @Column(nullable = false, updatable = false)
  private long version;

  @Column(name = "schema_key", nullable = false, length = 80, updatable = false)
  private String schemaKey;

  @Column(name = "published_at", nullable = false, updatable = false)
  private Instant publishedAt;

  protected Publication() {}

  public UUID getInstitutionId() {
    return institutionId;
  }

  public String getInstitutionName() {
    return institutionName;
  }

  public long getVersion() {
    return version;
  }

  public String getSchemaKey() {
    return schemaKey;
  }

  public Instant getPublishedAt() {
    return publishedAt;
  }
}
