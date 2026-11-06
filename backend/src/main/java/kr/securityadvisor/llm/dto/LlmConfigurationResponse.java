package kr.securityadvisor.llm.dto;

import java.time.Instant;
import java.util.UUID;
import kr.securityadvisor.common.model.ModelConnection;
import kr.securityadvisor.llm.domain.LlmConfiguration;

/** 관리자만 보는 구성 응답에도 실제 API 키는 포함하지 않는다. */
public record LlmConfigurationResponse(
    UUID id, String purpose, ModelConnection connection, Instant createdAt) {
  /** DB에 저장된 키 참조를 값으로 해석하지 않고 전달한다. */
  public static LlmConfigurationResponse from(LlmConfiguration configuration) {
    return new LlmConfigurationResponse(
        configuration.getId(),
        configuration.getPurpose(),
        configuration.connection(),
        configuration.getCreatedAt());
  }
}
