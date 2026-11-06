package kr.securityadvisor.llm.dto;

import java.util.UUID;
import kr.securityadvisor.llm.domain.LlmConfiguration;

/** 일반 사용자의 모델 선택에는 식별·용도·표시값만 공개한다. */
public record LlmOptionResponse(
    UUID id, String purpose, String provider, String model, String mode) {
  /** 기본 예시 경로는 DB 연결이나 외부 전송을 사용하지 않는다. */
  public static LlmOptionResponse example() {
    return new LlmOptionResponse(null, "INTERVIEW", "EXAMPLE", "labelled-lines-v1", "EXAMPLE");
  }

  /** 공급자 주소와 키 참조는 관리자 구성 응답에만 둔다. */
  public static LlmOptionResponse from(LlmConfiguration configuration) {
    var connection = configuration.connection();
    return new LlmOptionResponse(
        configuration.getId(),
        configuration.getPurpose(),
        connection.provider(),
        connection.model(),
        "EXAMPLE".equals(connection.provider()) ? "EXAMPLE" : "LIVE");
  }
}
