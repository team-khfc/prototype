package kr.securityadvisor.analysis.service;

import java.util.List;
import java.util.stream.Collectors;
import kr.securityadvisor.analysis.dto.ModelProtocol;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.model.ModelConnection;
import kr.securityadvisor.common.model.Suggestion;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/** Google Gemini API의 Gemma 어댑터이며 NIA 실증 플랫폼을 연결했다고 주장하지 않는다. */
@Component
public class GemmaAdapter implements LanguageModelAdapter {
  private final BoundedModelHttpClient http;
  private final ProviderSecretResolver secrets;
  private final ModelPrompt prompt;
  private final ObjectMapper mapper;

  public GemmaAdapter(
      BoundedModelHttpClient http,
      ProviderSecretResolver secrets,
      ModelPrompt prompt,
      ObjectMapper mapper) {
    this.http = http;
    this.secrets = secrets;
    this.prompt = prompt;
    this.mapper = mapper;
  }

  @Override
  public String provider() {
    return "GEMMA";
  }

  /** 정상 STOP 응답의 텍스트만 읽고 길이 초과·차단·내부 사고 응답을 성공으로 보지 않는다. */
  @Override
  public List<Suggestion> analyze(String text, ModelConnection connection) {
    var request =
        new ModelProtocol.GemmaRequest(
            List.of(
                new ModelProtocol.GemmaContent(
                    "user",
                    List.of(
                        new ModelProtocol.GemmaPart(
                            prompt.instructions() + "\n입력 자료 JSON:\n" + prompt.document(text),
                            null)))),
            new ModelProtocol.GemmaGenerationConfig(
                connection.temperature(), connection.maxTokens()));
    byte[] response =
        http.post(connection, secrets.resolve(connection), mapper.writeValueAsBytes(request));
    try {
      ModelProtocol.GemmaResponse decoded =
          mapper.readValue(response, ModelProtocol.GemmaResponse.class);
      if (decoded == null
          || decoded.candidates() == null
          || decoded.candidates().size() != 1
          || decoded.candidates().getFirst() == null
          || !"STOP".equals(decoded.candidates().getFirst().finishReason())
          || decoded.candidates().getFirst().content() == null
          || decoded.candidates().getFirst().content().parts() == null) {
        throw invalid();
      }
      List<ModelProtocol.GemmaPart> parts = decoded.candidates().getFirst().content().parts();
      if (parts.stream().anyMatch(part -> part == null)) {
        throw invalid();
      }
      String output =
          parts.stream()
              .filter(part -> !Boolean.TRUE.equals(part.thought()) && part.text() != null)
              .map(ModelProtocol.GemmaPart::text)
              .collect(Collectors.joining());
      return prompt.parse(output);
    } catch (JacksonException exception) {
      throw invalid();
    }
  }

  private DomainException invalid() {
    return new DomainException(
        502, "MODEL_INCOMPLETE_RESPONSE", "모델 분석이 정상 종료되지 않았습니다. 다시 시도해 주세요.");
  }
}
