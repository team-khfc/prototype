package kr.securityadvisor.llm.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.model.ModelConnection;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ModelConfigurationValidatorTest {
  private static final String OPENAI = "https://api.openai.com/v1/chat/completions";
  private static final String GEMMA =
      "https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent";
  private final ModelConfigurationValidator models =
      new ModelConfigurationValidator(OPENAI + "," + GEMMA);

  @Test
  @DisplayName("두 공급자의 정확한 HTTPS 경로와 SA 키 참조만 허용한다")
  void validateExactProviderContracts() {
    assertThatCode(() -> models.validate(model("OPENAI", OPENAI, "model", "SA_OPENAI_API_KEY")))
        .doesNotThrowAnyException();
    assertThatCode(
            () -> models.validate(model("GEMMA", GEMMA, "gemma-4-26b-a4b-it", "SA_GEMMA_API_KEY")))
        .doesNotThrowAnyException();
    for (String endpoint :
        List.of(
            OPENAI + "?redirect=1",
            OPENAI + "#fragment",
            "http://localhost/service",
            "https://api.openai.com@localhost/v1/chat/completions")) {
      assertThatThrownBy(
              () -> models.validate(model("OPENAI", endpoint, "model", "SA_OPENAI_API_KEY")))
          .isInstanceOf(DomainException.class);
    }
    assertThatThrownBy(() -> models.validate(model("OPENAI", OPENAI, "model", "OTHER_ENVIRONMENT")))
        .isInstanceOf(DomainException.class);
    assertThatThrownBy(
            () -> models.validate(model("GEMMA", GEMMA, "gemma-other-model", "SA_GEMMA_API_KEY")))
        .isInstanceOf(DomainException.class);
  }

  @Test
  @DisplayName("예시 연결에는 외부 주소·비밀 참조를 붙일 수 없고 생성 파라미터 상한을 지킨다")
  void distinguishExampleModeAndRejectUnboundedParameters() {
    assertThatCode(() -> models.validate(model("EXAMPLE", "", "labelled-lines-v1", "")))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> models.validate(model("EXAMPLE", OPENAI, "labelled-lines-v1", "")))
        .isInstanceOf(DomainException.class);
    for (ModelConnection invalid :
        List.of(
            new ModelConnection(
                "OPENAI", OPENAI, "model", "SA_OPENAI_API_KEY", Double.NaN, 1024, 15),
            new ModelConnection("OPENAI", OPENAI, "model", "SA_OPENAI_API_KEY", 0, 4097, 15),
            new ModelConnection("OPENAI", OPENAI, "model", "SA_OPENAI_API_KEY", 0, 1024, 61))) {
      assertThatThrownBy(() -> models.validate(invalid)).isInstanceOf(DomainException.class);
    }
  }

  private ModelConnection model(String provider, String endpoint, String name, String reference) {
    return new ModelConnection(provider, endpoint, name, reference, 0.2, 1200, 30);
  }
}
