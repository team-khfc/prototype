package kr.securityadvisor.request.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.common.entity.BaseTimeEntity;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Actor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 분석의 입력 수정본과 결과를 묶어 오래된 결과가 현재 답변을 덮지 않게 한다. */
@Entity
@Table(name = "case_analysis_jobs")
public class CaseAnalysisJob extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "business_case_id", nullable = false, updatable = false)
  private UUID caseId;

  @Column(name = "institution_id", nullable = false, updatable = false)
  private UUID institutionId;

  @Column(name = "owner_id", nullable = false, updatable = false)
  private UUID ownerId;

  @Column(name = "input_revision", nullable = false, updatable = false)
  private long revision;

  @Column(nullable = false, length = 20)
  private String status;

  @Column(nullable = false, length = 10, updatable = false)
  private String mode;

  @Column(nullable = false, length = 20, updatable = false)
  private String provider;

  @Column(nullable = false, length = 120, updatable = false)
  private String model;

  @Column(name = "configuration_id", updatable = false)
  private UUID configurationId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "source_objects", nullable = false, columnDefinition = "jsonb", updatable = false)
  private List<String> sourceObjects;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<Candidate> suggestions = List.of();

  @Column(length = 500)
  private String error;

  protected CaseAnalysisJob() {}

  /** 분석 원문은 읽기 전용 파일로 보관하고 DB에는 해당 객체 이름만 연결한다. */
  public CaseAnalysisJob(
      Actor actor,
      UUID caseId,
      long revision,
      String provider,
      String model,
      UUID configurationId,
      List<String> sourceObjects) {
    id = UUID.randomUUID();
    this.caseId = caseId;
    institutionId = actor.institutionId();
    ownerId = actor.userId();
    this.revision = revision;
    this.provider = provider;
    this.model = model;
    this.configurationId = configurationId;
    this.sourceObjects = List.copyOf(sourceObjects);
    mode = "EXAMPLE".equals(provider) ? "EXAMPLE" : "LIVE";
    status = "RUNNING";
  }

  /** 후보에는 사람이 확인했다는 정보를 넣지 않는다. */
  public record Candidate(String key, String value, String evidence) {}

  /** 분석 성공은 답변 적용·확정과 별개다. */
  public void complete(List<Candidate> candidates) {
    if (!"RUNNING".equals(status))
      throw new DomainException(409, "ANALYSIS_ALREADY_FINISHED", "이미 끝난 분석입니다.");
    suggestions = List.copyOf(candidates);
    status = "SUCCEEDED";
  }

  /** 실패를 예시 성공으로 대체하지 않고 사용자에게 재시도 정보를 남긴다. */
  public void fail(String message) {
    status = "FAILED";
    error = message;
  }

  /** 이전 입력의 결과는 남기되 현재 답변 적용 대상에서 제외한다. */
  public void markStale() {
    status = "STALE";
    error = "분석 중 입력이 변경되었습니다. 최신 입력으로 다시 분석해 주세요.";
  }

  public UUID getId() {
    return id;
  }

  public UUID getCaseId() {
    return caseId;
  }

  public UUID getInstitutionId() {
    return institutionId;
  }

  public UUID getOwnerId() {
    return ownerId;
  }

  public long getRevision() {
    return revision;
  }

  public String getStatus() {
    return status;
  }

  public String getMode() {
    return mode;
  }

  public String getProvider() {
    return provider;
  }

  public String getModel() {
    return model;
  }

  public String getError() {
    return error;
  }

  public List<Candidate> getSuggestions() {
    return List.copyOf(suggestions);
  }
}
