package kr.securityadvisor.analysis.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.analysis.dto.ModelProtocol;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.model.ModelConnection;
import kr.securityadvisor.common.model.Suggestion;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.env.MockEnvironment;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class ModelAdapterProtocolTest {
  private final ObjectMapper mapper = JsonMapper.builder().build();
  private final BoundedModelHttpClient transport = mock(BoundedModelHttpClient.class);
  private final String credential = UUID.randomUUID().toString();
  private final ProviderSecretResolver secrets =
      new ProviderSecretResolver(
          new MockEnvironment()
              .withProperty("BOAN_OPENAI_API_KEY", credential)
              .withProperty("BOAN_GEMMA_API_KEY", credential));
  private final ModelPrompt prompt = new ModelPrompt(mapper);
  private final Suggestion suggestion = new Suggestion("purpose", "합성 안내 서비스", "사업 목적: 합성 안내 서비스");

  @Test
  @DisplayName("OpenAI 전송 규약·토큰 상한·키 참조와 반환 구조를 HTTP 전송 대역으로 검증한다")
  void openAiContractWithStubbedTransport() {
    ModelConnection connection = openAi();
    String output = mapper.writeValueAsString(new ModelProtocol.Proposals(List.of(suggestion)));
    byte[] upstream =
        mapper.writeValueAsBytes(
            new ModelProtocol.OpenAiResponse(
                List.of(
                    new ModelProtocol.OpenAiChoice(
                        new ModelProtocol.OpenAiMessage("assistant", output), "stop"))));
    when(transport.post(eq(connection), eq(credential), any(byte[].class))).thenReturn(upstream);
    OpenAiAdapter adapter = new OpenAiAdapter(transport, secrets, prompt, mapper);
    assertThat(adapter.analyze(suggestion.evidence(), connection)).containsExactly(suggestion);
    ArgumentCaptor<byte[]> sent = ArgumentCaptor.forClass(byte[].class);
    verify(transport).post(eq(connection), eq(credential), sent.capture());
    ModelProtocol.OpenAiRequest request =
        mapper.readValue(sent.getValue(), ModelProtocol.OpenAiRequest.class);
    assertThat(request.maxCompletionTokens()).isEqualTo(1200);
    assertThat(request.responseFormat().type()).isEqualTo("json_object");
    assertThat(request.store()).isFalse();
    assertThat(request.messages())
        .extracting(ModelProtocol.OpenAiMessage::role)
        .containsExactly("system", "user");
    assertThat(request.messages().getLast().content())
        .contains("document", suggestion.evidence())
        .doesNotContain(credential);
    assertThat(new String(sent.getValue(), java.nio.charset.StandardCharsets.UTF_8))
        .contains("max_completion_tokens", "response_format");
  }

  @Test
  @DisplayName("Gemma의 generateContent 규약을 검증하며 내부 사고 부분은 후보로 사용하지 않는다")
  void gemmaContractWithStubbedTransport() {
    ModelConnection connection = gemma();
    String output = mapper.writeValueAsString(new ModelProtocol.Proposals(List.of(suggestion)));
    byte[] upstream =
        mapper.writeValueAsBytes(
            new ModelProtocol.GemmaResponse(
                List.of(
                    new ModelProtocol.GemmaCandidate(
                        new ModelProtocol.GemmaContent(
                            "model",
                            List.of(
                                new ModelProtocol.GemmaPart("분석용 내부 사고 부분", true),
                                new ModelProtocol.GemmaPart(output, false))),
                        "STOP"))));
    when(transport.post(eq(connection), eq(credential), any(byte[].class))).thenReturn(upstream);
    GemmaAdapter adapter = new GemmaAdapter(transport, secrets, prompt, mapper);
    assertThat(adapter.analyze(suggestion.evidence(), connection)).containsExactly(suggestion);
    ArgumentCaptor<byte[]> sent = ArgumentCaptor.forClass(byte[].class);
    verify(transport).post(eq(connection), eq(credential), sent.capture());
    ModelProtocol.GemmaRequest request =
        mapper.readValue(sent.getValue(), ModelProtocol.GemmaRequest.class);
    assertThat(request.generationConfig().maxOutputTokens()).isEqualTo(1200);
    assertThat(request.contents()).hasSize(1);
    assertThat(request.contents().getFirst().parts().getFirst().text())
        .contains("document", suggestion.evidence())
        .doesNotContain(credential);
  }

  @Test
  @DisplayName("외부 오류·불완전 응답·잘못된 JSON을 예시 성공으로 대체하지 않는다")
  void neverFallbackToExampleOnExternalFailure() {
    ModelConnection connection = openAi();
    when(transport.post(eq(connection), eq(credential), any(byte[].class)))
        .thenThrow(new DomainException(504, "MODEL_TIMEOUT", "합성 시간 초과"));
    assertThatThrownBy(
            () ->
                new OpenAiAdapter(transport, secrets, prompt, mapper)
                    .analyze(suggestion.evidence(), connection))
        .isInstanceOf(DomainException.class)
        .hasMessage("합성 시간 초과");
    assertThatThrownBy(() -> prompt.parse("{\"suggestions\":[],\"approved\":true}"))
        .isInstanceOf(DomainException.class);
    assertThatThrownBy(() -> prompt.parse("{\"suggestions\":[]} {\"suggestions\":[]}"))
        .isInstanceOf(DomainException.class);
    assertThatThrownBy(() -> prompt.parse("```json\n{\"suggestions\":[]}\n```"))
        .isInstanceOf(DomainException.class);
  }

  @Test
  @DisplayName("운영 키가 없거나 다른 환경변수 참조이면 외부 전송을 시작하지 않는다")
  void rejectMissingAndUnapprovedSecrets() {
    ProviderSecretResolver empty = new ProviderSecretResolver(new MockEnvironment());
    assertThatThrownBy(() -> empty.resolve(openAi())).isInstanceOf(DomainException.class);
    ModelConnection invalid =
        new ModelConnection(
            "OPENAI", openAi().endpoint(), openAi().model(), "UNRELATED_SECRET", 0.2, 1200, 30);
    assertThatThrownBy(() -> secrets.resolve(invalid)).isInstanceOf(DomainException.class);
  }

  private ModelConnection openAi() {
    return new ModelConnection(
        "OPENAI",
        "https://api.openai.com/v1/chat/completions",
        "gpt-4.1-mini",
        "BOAN_OPENAI_API_KEY",
        0.2,
        1200,
        30);
  }

  private ModelConnection gemma() {
    return new ModelConnection(
        "GEMMA",
        "https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent",
        "gemma-4-26b-a4b-it",
        "BOAN_GEMMA_API_KEY",
        0.2,
        1200,
        30);
  }
}
