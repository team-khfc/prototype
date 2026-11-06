package kr.securityadvisor.analysis.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.common.entity.BaseTimeEntity;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 외부 호출과 무관하게 분석 시작·실패·원문 버전을 추적한다. */
@Entity
@Table(name = "analysis_jobs")
public class AnalysisJob extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "procedure_id", nullable = false)
  private UUID procedureId;

  @Column(name = "institution_id", nullable = false)
  private UUID institutionId;

  @Column(name = "requested_by", nullable = false)
  private UUID requestedBy;

  @Column(name = "input_revision", nullable = false)
  private long inputRevision;

  @Column(nullable = false, length = 20)
  private String status;

  @Column(nullable = false, length = 20)
  private String provider;

  @Column(nullable = false, length = 120)
  private String model;

  @Column(name = "timeout_seconds", nullable = false)
  private int timeoutSeconds;

  @Column(name = "error_message", length = 500)
  private String error;

  @Column(name = "applied_at")
  private Instant appliedAt;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "source_objects", nullable = false, columnDefinition = "jsonb")
  private List<String> sourceObjects;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<AnalysisSuggestion> suggestions;

  @Version
  @Column(name = "lock_version", nullable = false)
  private long lockVersion;

  protected AnalysisJob() {}

  /** 완료 여부를 추정하지 않고 진행 상태부터 기록한다. */
  public AnalysisJob(
      UUID procedureId,
      UUID institutionId,
      UUID requestedBy,
      long inputRevision,
      String provider,
      String model,
      int timeoutSeconds,
      List<String> sourceObjects) {
    id = UUID.randomUUID();
    this.procedureId = procedureId;
    this.institutionId = institutionId;
    this.requestedBy = requestedBy;
    this.inputRevision = inputRevision;
    this.provider = provider;
    this.model = model;
    this.timeoutSeconds = timeoutSeconds;
    this.sourceObjects = List.copyOf(sourceObjects);
    suggestions = List.of();
    status = "RUNNING";
  }

  /** 검증한 후보만 저장하며 사람 확인 상태를 생성하지 않는다. */
  public void succeed(List<AnalysisSuggestion> values) {
    suggestions = List.copyOf(values);
    status = "SUCCEEDED";
    error = null;
  }

  /** 실패한 실행은 후보가 없는 실패 이력으로 남긴다. */
  public void fail(String message) {
    status = "FAILED";
    suggestions = List.of();
    error = message;
  }

  /** 한 분석 결과를 여러 번 적용하지 않도록 사용 시점을 기록한다. */
  public void markApplied() {
    appliedAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public UUID getProcedureId() {
    return procedureId;
  }

  public UUID getInstitutionId() {
    return institutionId;
  }

  public UUID getRequestedBy() {
    return requestedBy;
  }

  public long getInputRevision() {
    return inputRevision;
  }

  public String getStatus() {
    return status;
  }

  public String getProvider() {
    return provider;
  }

  public String getModel() {
    return model;
  }

  public int getTimeoutSeconds() {
    return timeoutSeconds;
  }

  public String getError() {
    return error;
  }

  public Instant getAppliedAt() {
    return appliedAt;
  }

  public List<AnalysisSuggestion> getSuggestions() {
    return List.copyOf(suggestions);
  }
}
