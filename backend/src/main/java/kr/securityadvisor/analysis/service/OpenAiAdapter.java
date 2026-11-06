package kr.securityadvisor.analysis.service;

import java.util.List;
import kr.securityadvisor.analysis.dto.ModelProtocol;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.model.ModelConnection;
import kr.securityadvisor.common.model.Suggestion;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/** OpenAI Chat Completions 실제 규약을 사용하는 어댑터다. */
@Component
public class OpenAiAdapter implements LanguageModelAdapter {
  private final BoundedModelHttpClient http;
  private final ProviderSecretResolver secrets;
  private final ModelPrompt prompt;
  private final ObjectMapper mapper;

  public OpenAiAdapter(
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
    return "OPENAI";
  }

  /** 정상 종료한 응답만 공통 후보 구조로 해석하며 실패를 예시 결과로 대체하지 않는다. */
  @Override
  public List<Suggestion> analyze(String text, ModelConnection connection) {
    var request =
        new ModelProtocol.OpenAiRequest(
            connection.model(),
            List.of(
                new ModelProtocol.OpenAiMessage("system", prompt.instructions()),
                new ModelProtocol.OpenAiMessage("user", prompt.document(text))),
            connection.temperature(),
            connection.maxTokens(),
            new ModelProtocol.OpenAiResponseFormat("json_object"),
            false);
    byte[] response =
        http.post(connection, secrets.resolve(connection), mapper.writeValueAsBytes(request));
    try {
      ModelProtocol.OpenAiResponse decoded =
          mapper.readValue(response, ModelProtocol.OpenAiResponse.class);
      if (decoded == null
          || decoded.choices() == null
          || decoded.choices().size() != 1
          || decoded.choices().getFirst() == null
          || !"stop".equals(decoded.choices().getFirst().finishReason())
          || decoded.choices().getFirst().message() == null) {
        throw invalid();
      }
      return prompt.parse(decoded.choices().getFirst().message().content());
    } catch (JacksonException exception) {
      throw invalid();
    }
  }

  private DomainException invalid() {
    return new DomainException(
        502, "MODEL_INCOMPLETE_RESPONSE", "모델 분석이 정상 종료되지 않았습니다. 다시 시도해 주세요.");
  }
}
