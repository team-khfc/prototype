package kr.securityadvisor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.llm.service.BoundedModelHttpClient;
import kr.securityadvisor.llm.service.ProviderSecretResolver;
import kr.securityadvisor.request.dto.AiAnswerProposal;
import kr.securityadvisor.request.dto.CaseAnalysisResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** 실제 인증·DB·분석 서비스를 통과하되 외부 전송과 운영 키 접근은 검사에서 차단한다. */
@MockitoBean(
    types = {BoundedModelHttpClient.class, ProviderSecretResolver.class},
    enforceOverride = true)
class CaseAnalysisIntegrationTest extends IntegrationTestSupport {
  private final BoundedModelHttpClient http;
  private final ProviderSecretResolver secrets;

  @Autowired
  CaseAnalysisIntegrationTest(
      MockMvc mvc,
      ObjectMapper mapper,
      BoundedModelHttpClient http,
      ProviderSecretResolver secrets) {
    super(mvc, mapper);
    this.http = http;
    this.secrets = secrets;
  }

  @Test
  @DisplayName("명시적 multipart 분석은 허용된 공통 후보만 만들고 EXAMPLE은 외부 모델을 호출하지 않는다")
  void explicitMultipartCreatesOnlyUnconfirmedAllowedCandidates() throws Exception {
    var applicant = login("applicant.demo");
    JsonNode businessCase = createCase(applicant);
    String text =
        "목적: 합성 공개자료 안내\n"
            + "처리 정보: 공개된 합성 행사명\n"
            + "외부 전송: 시연용 전송 없음\n"
            + "자료 흐름: 합성 입력을 화면에 표시\n"
            + "sourceIp: 192.0.2.10\nport: 443\nsourceSystem: 합성 기술 정보";
    MockMultipartFile selectedFile =
        new MockMultipartFile(
            "file", "합성-사업개요.md", "text/markdown", text.getBytes(StandardCharsets.UTF_8));

    // 파일 선택 UI의 검사는 별도이며 여기서는 조회와 명시적 전송의 서버 경계를 확인한다.
    mvc.perform(get(analysesPath(businessCase)).session(applicant))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
    var result =
        mvc.perform(
                multipart(analysesPath(businessCase))
                    .file(selectedFile)
                    .session(applicant)
                    .with(csrf())
                    .param("expectedRevision", revision(businessCase)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sourceObjects").doesNotExist())
            .andReturn();
    CaseAnalysisResponse analysis =
        mapper.readValue(result.getResponse().getContentAsByteArray(), CaseAnalysisResponse.class);
    assertThat(analysis.mode()).isEqualTo("EXAMPLE");
    assertThat(analysis.provider()).isEqualTo("EXAMPLE");
    assertThat(analysis.status()).isEqualTo("SUCCEEDED");
    assertThat(analysis.revision()).isEqualTo(businessCase.path("revision").asLong());
    assertThat(analysis.suggestions())
        .extracting(AiAnswerProposal::key)
        .containsExactlyInAnyOrder("purpose", "dataTypes", "externalTransfer", "dataFlow");
    analysis.suggestions().forEach(candidate -> assertThat(text).contains(candidate.evidence()));

    JsonNode beforeApply = current(applicant, businessCase);
    assertThat(beforeApply.path("revision").asLong())
        .isEqualTo(businessCase.path("revision").asLong());
    assertThat(answer(beforeApply, "purpose").path("value").asText()).isEmpty();
    JsonNode applied = apply(applicant, beforeApply, analysis.id());
    for (String key : List.of("purpose", "dataTypes", "externalTransfer", "dataFlow")) {
      JsonNode proposed = answer(applied, key);
      assertThat(proposed.path("source").asText()).isEqualTo("AI_INFERRED");
      assertThat(proposed.path("confirmed").asBoolean()).isFalse();
      assertThat(proposed.path("confirmation").isNull()).isTrue();
      assertThat(proposed.path("evidence").asText()).isNotBlank();
    }
    assertThat(answer(applied, "sourceIp").path("value").asText()).isEmpty();
    assertThat(answer(applied, "port").path("value").asText()).isEmpty();

    JsonNode confirmed = patchAnswer(applicant, applied, "purpose", "합성 공개자료 안내", true);
    assertThat(answer(confirmed, "purpose").path("source").asText()).isEqualTo("AI_INFERRED");
    assertThat(answer(confirmed, "purpose").path("confirmed").asBoolean()).isTrue();
    assertThat(answer(confirmed, "purpose").path("confirmation").path("role").asText())
        .isEqualTo("APPLICANT");
    verifyNoInteractions(http, secrets);
  }

  @Test
  @DisplayName("같은 기관의 다른 신청자·다른 기관과 사업 건을 바꿔 붙인 분석 ID를 거절한다")
  void isolateAnalysisByOwnerInstitutionAndBusinessCase() throws Exception {
    var applicant = login("applicant.demo");
    JsonNode businessCase = createCase(applicant);
    CaseAnalysisResponse analysis = analyze(applicant, businessCase, "목적: 소유자 전용 합성 안내");

    for (String username : List.of("second.demo", "outside.demo")) {
      var other = login(username);
      mvc.perform(get(analysesPath(businessCase)).session(other)).andExpect(status().isNotFound());
      mvc.perform(get(analysesPath(businessCase) + "/" + analysis.id()).session(other))
          .andExpect(status().isNotFound());
      mvc.perform(
              multipart(analysesPath(businessCase))
                  .session(other)
                  .with(csrf())
                  .param("expectedRevision", revision(businessCase))
                  .param("text", "목적: 다른 사용자의 변경 시도"))
          .andExpect(status().isNotFound());
      mvc.perform(
              post(analysesPath(businessCase) + "/" + analysis.id() + "/apply")
                  .session(other)
                  .with(csrf())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(revisionBody(businessCase)))
          .andExpect(status().isNotFound());
    }

    JsonNode anotherCase = createCase(applicant);
    mvc.perform(get(analysesPath(anotherCase) + "/" + analysis.id()).session(applicant))
        .andExpect(status().isNotFound());
    mvc.perform(
            post(analysesPath(anotherCase) + "/" + analysis.id() + "/apply")
                .session(applicant)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(revisionBody(anotherCase)))
        .andExpect(status().isNotFound());
    assertThat(current(applicant, businessCase).path("revision").asLong())
        .isEqualTo(businessCase.path("revision").asLong());
    verifyNoInteractions(http, secrets);
  }

  @Test
  @DisplayName("오래된 요청 버전과 이전 입력에서 생성된 후보가 현재 공통 답변을 덮지 못한다")
  void rejectStaleRevisionAndStaleAnalysis() throws Exception {
    var applicant = login("applicant.demo");
    JsonNode businessCase = createCase(applicant);
    CaseAnalysisResponse analysis = analyze(applicant, businessCase, "목적: 이전 합성 설명");
    JsonNode changed = patchAnswer(applicant, businessCase, "purpose", "사용자가 바꾼 합성 설명", false);

    mvc.perform(
            multipart(analysesPath(businessCase))
                .session(applicant)
                .with(csrf())
                .param("expectedRevision", revision(businessCase))
                .param("text", "목적: 오래된 화면의 요청"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("REVISION_CONFLICT"))
        .andExpect(jsonPath("$.latestRevision").value(changed.path("revision").asInt()));
    mvc.perform(
            post(analysesPath(businessCase) + "/" + analysis.id() + "/apply")
                .session(applicant)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(revisionBody(businessCase)))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("REVISION_CONFLICT"));
    mvc.perform(
            post(analysesPath(businessCase) + "/" + analysis.id() + "/apply")
                .session(applicant)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(revisionBody(changed)))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("STALE_ANALYSIS"));
    JsonNode latest = current(applicant, businessCase);
    assertThat(latest.path("revision").asLong()).isEqualTo(changed.path("revision").asLong());
    assertThat(answer(latest, "purpose").path("value").asText()).isEqualTo("사용자가 바꾼 합성 설명");
    mvc.perform(get(analysesPath(businessCase)).session(applicant))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));
    verifyNoInteractions(http, secrets);
  }

  @Test
  @DisplayName("사람이 확인한 공통 값은 보존하고 다른 AI 후보만 미확정으로 적용한다")
  void preserveConfirmedAnswerWhenApplyingMixedCandidates() throws Exception {
    var applicant = login("applicant.demo");
    JsonNode businessCase = createCase(applicant);
    JsonNode confirmed = patchAnswer(applicant, businessCase, "purpose", "사람이 확인한 합성 목적", true);
    CaseAnalysisResponse analysis =
        analyze(applicant, confirmed, "목적: AI가 덮어쓰려는 합성 목적\n처리 정보: 새로운 공개 합성 자료");
    JsonNode applied = apply(applicant, confirmed, analysis.id());
    JsonNode protectedAnswer = answer(applied, "purpose");
    assertThat(protectedAnswer.path("value").asText()).isEqualTo("사람이 확인한 합성 목적");
    assertThat(protectedAnswer.path("source").asText()).isEqualTo("USER_ANSWER");
    assertThat(protectedAnswer.path("confirmed").asBoolean()).isTrue();
    assertThat(protectedAnswer.path("confirmation"))
        .isEqualTo(answer(confirmed, "purpose").path("confirmation"));
    assertThat(answer(applied, "dataTypes").path("value").asText()).isEqualTo("새로운 공개 합성 자료");
    assertThat(answer(applied, "dataTypes").path("source").asText()).isEqualTo("AI_INFERRED");
    assertThat(answer(applied, "dataTypes").path("confirmed").asBoolean()).isFalse();
    verifyNoInteractions(http, secrets);
  }

  @Test
  @DisplayName("revision 누락·null·음수와 CSRF 없는 분석을 거절하고 답변을 바꾸지 않는다")
  void requireExplicitRevisionAndCsrf() throws Exception {
    var applicant = login("applicant.demo");
    JsonNode businessCase = createCase(applicant);
    CaseAnalysisResponse analysis = analyze(applicant, businessCase, "목적: 합성 버전 검사");
    for (String body : List.of("{}", "{\"expectedRevision\":null}", "{\"expectedRevision\":-1}")) {
      mvc.perform(
              post(analysesPath(businessCase) + "/" + analysis.id() + "/apply")
                  .session(applicant)
                  .with(csrf())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.requestId").exists());
    }
    mvc.perform(
            multipart(analysesPath(businessCase))
                .session(applicant)
                .with(csrf())
                .param("text", "목적: 버전 없는 요청"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            multipart(analysesPath(businessCase))
                .session(applicant)
                .param("expectedRevision", revision(businessCase))
                .param("text", "목적: CSRF 없는 요청"))
        .andExpect(status().isForbidden());
    assertThat(current(applicant, businessCase).path("revision").asLong())
        .isEqualTo(businessCase.path("revision").asLong());
    verifyNoInteractions(http, secrets);
  }

  @Test
  @DisplayName("분석 후보 검증 실패는 502와 FAILED 이력으로 남고 예시 성공으로 바뀌지 않는다")
  void persistFailedExampleWithoutSuccessFallback() throws Exception {
    var applicant = login("applicant.demo");
    JsonNode businessCase = createCase(applicant);
    mvc.perform(
            multipart(analysesPath(businessCase))
                .session(applicant)
                .with(csrf())
                .param("expectedRevision", revision(businessCase))
                .param("text", "목적: " + "합".repeat(2001)))
        .andExpect(status().isBadGateway())
        .andExpect(jsonPath("$.code").value("MODEL_EVIDENCE_REJECTED"));
    mvc.perform(get(analysesPath(businessCase)).session(applicant))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].status").value("FAILED"))
        .andExpect(jsonPath("$[0].mode").value("EXAMPLE"))
        .andExpect(jsonPath("$[0].suggestions").isEmpty());
    assertThat(current(applicant, businessCase).path("revision").asLong())
        .isEqualTo(businessCase.path("revision").asLong());
    verifyNoInteractions(http, secrets);
  }

  @Test
  @DisplayName("LIVE 연결의 키 실패도 FAILED로 보존하고 외부 전송·EXAMPLE 성공을 만들지 않는다")
  void persistLiveConnectionFailureWithoutExampleFallback() throws Exception {
    var applicant = login("applicant.demo");
    JsonNode businessCase = createCase(applicant);
    var admin = login("admin.demo");
    var created =
        mvc.perform(
                post("/api/llm-configurations")
                    .session(admin)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper.writeValueAsBytes(
                            Map.of(
                                "connection",
                                Map.of(
                                    "provider", "OPENAI",
                                    "endpoint", "https://api.openai.com/v1/chat/completions",
                                    "model", "synthetic-contract-model",
                                    "keyReference", "SA_OPENAI_API_KEY",
                                    "temperature", 0,
                                    "maxTokens", 1024,
                                    "timeoutSeconds", 15),
                                "purpose",
                                "SUMMARY",
                                "reason",
                                "합성 키 실패 경로 검사"))))
            .andExpect(status().isOk())
            .andReturn();
    String configurationId =
        mapper.readTree(created.getResponse().getContentAsByteArray()).path("id").asText();
    when(secrets.resolve(any()))
        .thenThrow(new DomainException(503, "MODEL_KEY_UNAVAILABLE", "합성 검사: 모델 키 없음"));
    mvc.perform(
            multipart(analysesPath(businessCase))
                .session(applicant)
                .with(csrf())
                .param("expectedRevision", revision(businessCase))
                .param("configurationId", configurationId)
                .param("text", "목적: 합성 연결 실패 검사"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(jsonPath("$.code").value("MODEL_KEY_UNAVAILABLE"));
    mvc.perform(get(analysesPath(businessCase)).session(applicant))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].status").value("FAILED"))
        .andExpect(jsonPath("$[0].mode").value("LIVE"))
        .andExpect(jsonPath("$[0].provider").value("OPENAI"))
        .andExpect(jsonPath("$[0].suggestions").isEmpty());
    assertThat(current(applicant, businessCase).path("revision").asLong())
        .isEqualTo(businessCase.path("revision").asLong());
    verifyNoInteractions(http);
  }

  @Test
  @DisplayName("지원하지 않는 확장자·잘못된 UTF-8·초과 파일은 분석 작업을 만들기 전에 거절한다")
  void rejectUnsupportedMalformedAndOversizedFiles() throws Exception {
    var applicant = login("applicant.demo");
    JsonNode businessCase = createCase(applicant);
    for (String name : List.of("합성.exe", "합성.pdf", "../합성.md")) {
      var file = new MockMultipartFile("file", name, "application/octet-stream", new byte[] {65});
      mvc.perform(
              multipart(analysesPath(businessCase))
                  .file(file)
                  .session(applicant)
                  .with(csrf())
                  .param("expectedRevision", revision(businessCase)))
          .andExpect(status().isUnprocessableEntity())
          .andExpect(jsonPath("$.code").value("UNSUPPORTED_UPLOAD"));
    }
    var invalidUtf8 =
        new MockMultipartFile(
            "file", "합성.txt", "text/plain", new byte[] {(byte) 0xc3, (byte) 0x28});
    mvc.perform(
            multipart(analysesPath(businessCase))
                .file(invalidUtf8)
                .session(applicant)
                .with(csrf())
                .param("expectedRevision", revision(businessCase)))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("INVALID_UTF8"));
    var oversized =
        new MockMultipartFile("file", "합성.md", "text/markdown", new byte[1024 * 1024 + 1]);
    mvc.perform(
            multipart(analysesPath(businessCase))
                .file(oversized)
                .session(applicant)
                .with(csrf())
                .param("expectedRevision", revision(businessCase)))
        .andExpect(status().is(413))
        .andExpect(jsonPath("$.code").value("UPLOAD_TOO_LARGE"));
    mvc.perform(get(analysesPath(businessCase)).session(applicant))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
    verifyNoInteractions(http, secrets);
  }

  private JsonNode createCase(MockHttpSession applicant) throws Exception {
    var result =
        mvc.perform(
                post("/api/business-cases")
                    .session(applicant)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper.writeValueAsBytes(
                            Map.of(
                                "title", "합성 사업 건 분석 검사",
                                "department", "시연 기획팀",
                                "description", "합성 자료만 사용하는 분석 경계 검사",
                                "docTypes", List.of("FIREWALL", "SECURITY_REVIEW")))))
            .andExpect(status().isCreated())
            .andReturn();
    return mapper.readTree(result.getResponse().getContentAsByteArray());
  }

  private CaseAnalysisResponse analyze(
      MockHttpSession applicant, JsonNode businessCase, String text) throws Exception {
    var result =
        mvc.perform(
                multipart(analysesPath(businessCase))
                    .session(applicant)
                    .with(csrf())
                    .param("expectedRevision", revision(businessCase))
                    .param("text", text))
            .andExpect(status().isOk())
            .andReturn();
    return mapper.readValue(
        result.getResponse().getContentAsByteArray(), CaseAnalysisResponse.class);
  }

  private JsonNode apply(MockHttpSession applicant, JsonNode businessCase, UUID analysisId)
      throws Exception {
    var result =
        mvc.perform(
                post(analysesPath(businessCase) + "/" + analysisId + "/apply")
                    .session(applicant)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(revisionBody(businessCase)))
            .andExpect(status().isOk())
            .andReturn();
    return mapper.readTree(result.getResponse().getContentAsByteArray());
  }

  private JsonNode current(MockHttpSession applicant, JsonNode businessCase) throws Exception {
    var result =
        mvc.perform(get(casePath(businessCase)).session(applicant))
            .andExpect(status().isOk())
            .andReturn();
    return mapper.readTree(result.getResponse().getContentAsByteArray());
  }

  private JsonNode patchAnswer(
      MockHttpSession applicant, JsonNode businessCase, String key, String value, boolean confirmed)
      throws Exception {
    var result =
        mvc.perform(
                patch(casePath(businessCase) + "/answers")
                    .session(applicant)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper.writeValueAsBytes(
                            Map.of(
                                "expectedRevision", businessCase.path("revision").asLong(),
                                "answers",
                                    List.of(
                                        Map.of(
                                            "key", key,
                                            "value", value,
                                            "confirmed", confirmed,
                                            "notApplicable", false))))))
            .andExpect(status().isOk())
            .andReturn();
    return mapper.readTree(result.getResponse().getContentAsByteArray());
  }

  private byte[] revisionBody(JsonNode businessCase) {
    return mapper.writeValueAsBytes(
        Map.of("expectedRevision", businessCase.path("revision").asLong()));
  }

  private static String revision(JsonNode businessCase) {
    return Long.toString(businessCase.path("revision").asLong());
  }

  private static String casePath(JsonNode businessCase) {
    return "/api/business-cases/" + businessCase.path("id").asText();
  }

  private static String analysesPath(JsonNode businessCase) {
    return casePath(businessCase) + "/analyses";
  }

  private static JsonNode answer(JsonNode businessCase, String key) {
    for (JsonNode answer : businessCase.path("answers")) {
      if (key.equals(answer.path("key").asText())) return answer;
    }
    throw new AssertionError("공통 답변이 없습니다: " + key);
  }
}
