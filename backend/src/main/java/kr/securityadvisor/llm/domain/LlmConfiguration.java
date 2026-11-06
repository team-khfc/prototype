package kr.securityadvisor.llm.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import kr.securityadvisor.common.entity.BaseTimeEntity;
import kr.securityadvisor.common.model.ModelConnection;

/** 키 원문을 갖지 않는 기관별 모델 연결 구성이다. 새 연결은 별도 버전으로 추가한다. */
@Entity
@Table(name = "llm_configurations")
public class LlmConfiguration extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "institution_id", nullable = false, updatable = false)
  private UUID institutionId;

  @Column(nullable = false, length = 20, updatable = false)
  private String provider;

  @Column(nullable = false, length = 500, updatable = false)
  private String endpoint;

  @Column(nullable = false, length = 120, updatable = false)
  private String model;

  @Column(name = "key_reference", nullable = false, length = 100, updatable = false)
  private String keyReference;

  @Column(nullable = false, length = 20, updatable = false)
  private String purpose;

  @Column(nullable = false, updatable = false)
  private double temperature;

  @Column(name = "max_tokens", nullable = false, updatable = false)
  private int maxTokens;

  @Column(name = "timeout_seconds", nullable = false, updatable = false)
  private int timeoutSeconds;

  protected LlmConfiguration() {}

  /** 검증을 마친 연결 값만 서버 생성 식별자에 연결한다. */
  public LlmConfiguration(UUID institutionId, ModelConnection connection, String purpose) {
    id = UUID.randomUUID();
    this.institutionId = institutionId;
    this.provider = connection.provider();
    endpoint = connection.endpoint();
    model = connection.model();
    keyReference = connection.keyReference();
    temperature = connection.temperature();
    maxTokens = connection.maxTokens();
    timeoutSeconds = connection.timeoutSeconds();
    this.purpose = purpose;
  }

  public UUID getId() {
    return id;
  }

  public UUID getInstitutionId() {
    return institutionId;
  }

  public String getPurpose() {
    return purpose;
  }

  /** 비밀값을 해석하지 않은 연결 값만 공통 어댑터로 전달한다. */
  public ModelConnection connection() {
    return new ModelConnection(
        provider, endpoint, model, keyReference, temperature, maxTokens, timeoutSeconds);
  }
}
