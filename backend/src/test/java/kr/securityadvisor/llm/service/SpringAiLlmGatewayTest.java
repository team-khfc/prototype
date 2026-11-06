package kr.securityadvisor.llm.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.model.ModelConnection;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class SpringAiLlmGatewayTest {
  private final BoundedModelHttpClient http = mock(BoundedModelHttpClient.class);
  private final ProviderSecretResolver secrets = mock(ProviderSecretResolver.class);
  private final SpringAiLlmGateway gateway =
      new SpringAiLlmGateway(http, secrets, JsonMapper.builder().build(), new CandidateValidator());

  @Test
  @DisplayName("예시 추출은 명시된 원문 행만 반환하고 외부 LLM을 호출하지 않는다")
  void exampleDoesNotPretendToCallModel() {
    var result =
        gateway.extract(
            "목적: 합성 민원 안내\n내부 IP: 알 수 없음\n처리 정보: 공개 공고",
            new ModelConnection("EXAMPLE", "", "labelled-lines-v1", "", 0, 1024, 15));
    assertThat(result).hasSize(2);
    assertThat(result.getFirst().key()).isEqualTo("purpose");
    assertThat(result.getFirst().evidence()).isEqualTo("목적: 합성 민원 안내");
    verifyNoInteractions(http, secrets);
  }

  @Test
  @DisplayName("OpenAI 응답을 Spring AI 구조화 출력으로 읽고 원문 근거를 검사한다")
  void openAiStructuredContract() {
    when(secrets.resolve(any())).thenReturn("test-transport-placeholder");
    when(http.post(any(), anyString(), any()))
        .thenReturn(
            """
        {"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"{\\"suggestions\\":[{\\"key\\":\\"purpose\\",\\"value\\":\\"합성 안내\\",\\"evidence\\":\\"목적: 합성 안내\\"}]}"}}]}
        """
                .getBytes(StandardCharsets.UTF_8));
    assertThat(gateway.extract("목적: 합성 안내", connection("OPENAI"))).hasSize(1);
  }

  @Test
  @DisplayName("Gemma 규약도 같은 미확정 후보 계약을 반환한다")
  void gemmaStructuredContract() {
    when(secrets.resolve(any())).thenReturn("test-transport-placeholder");
    when(http.post(any(), anyString(), any()))
        .thenReturn(
            """
        {"candidates":[{"finishReason":"STOP","content":{"role":"model","parts":[{"text":"{\\"suggestions\\":[{\\"key\\":\\"purpose\\",\\"value\\":\\"합성 안내\\",\\"evidence\\":\\"목적: 합성 안내\\"}]}"}]}}]}
        """
                .getBytes(StandardCharsets.UTF_8));
    assertThat(gateway.extract("목적: 합성 안내", connection("GEMMA"))).hasSize(1);
  }

  @Test
  @DisplayName("모델이 내부 IP를 제안하거나 원문에 없는 근거를 반환하면 거부한다")
  void rejectsFabricatedInstitutionFact() {
    when(secrets.resolve(any())).thenReturn("test-transport-placeholder");
    when(http.post(any(), anyString(), any()))
        .thenReturn(
            """
        {"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"{\\"suggestions\\":[{\\"key\\":\\"sourceIp\\",\\"value\\":\\"192.0.2.10\\",\\"evidence\\":\\"출처 없음\\"}]}"}}]}
        """
                .getBytes(StandardCharsets.UTF_8));
    assertThatThrownBy(() -> gateway.extract("목적: 합성 안내", connection("OPENAI")))
        .isInstanceOf(DomainException.class);
  }

  private static ModelConnection connection(String provider) {
    return new ModelConnection(
        provider,
        "https://example.invalid/api",
        "synthetic-contract-model",
        "TEST_REFERENCE",
        0,
        1024,
        15);
  }
}
