package kr.securityadvisor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.UUID;
import kr.securityadvisor.common.model.ModelConnection;
import kr.securityadvisor.llm.dto.LlmConfigurationRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

class LlmConfigurationIntegrationTest extends IntegrationTestSupport {
  private final JdbcTemplate jdbc;

  @Autowired
  LlmConfigurationIntegrationTest(MockMvc mvc, ObjectMapper mapper, JdbcTemplate jdbc) {
    super(mvc, mapper);
    this.jdbc = jdbc;
  }

  @Test
  @DisplayName("모델 선택은 인증 기관으로 격리하고 일반 응답에서 주소·키 참조를 제외한다")
  void listSafeTenantOptions() throws Exception {
    var admin = login("admin.demo");
    var applicant = login("applicant.demo");
    var outside = login("outside.demo");
    String model = "synthetic-option-" + UUID.randomUUID();
    var saved =
        mvc.perform(
                post("/api/llm-configurations")
                    .session(admin)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsBytes(input(model))))
            .andExpect(status().isOk())
            .andReturn();
    String id = mapper.readTree(saved.getResponse().getContentAsByteArray()).path("id").asText();
    mvc.perform(get("/api/llm-options")).andExpect(status().isUnauthorized());
    var response =
        mvc.perform(get("/api/llm-options").session(applicant))
            .andExpect(status().isOk())
            .andReturn();
    var options = mapper.readTree(response.getResponse().getContentAsByteArray());
    assertThat(options.get(0).path("id").isNull()).isTrue();
    assertThat(options.get(0).path("mode").asText()).isEqualTo("EXAMPLE");
    assertThat(response.getResponse().getContentAsString())
        .contains(id, model, "LIVE")
        .doesNotContain("endpoint", "keyReference", "SA_OPENAI_API_KEY");
    var external =
        mvc.perform(get("/api/llm-options").session(outside))
            .andExpect(status().isOk())
            .andReturn();
    assertThat(external.getResponse().getContentAsString()).doesNotContain(id, model);
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM audit_events WHERE target_id = ? AND action = 'LLM_CONFIGURATION_CREATED'",
                Long.class,
                UUID.fromString(id)))
        .isEqualTo(1);
  }

  @Test
  @DisplayName("일반 사용자는 연결을 관리할 수 없고 관리자가 입력한 사설 주소도 거절한다")
  void rejectUnprivilegedOrUnsafeConfiguration() throws Exception {
    var applicant = login("applicant.demo");
    var admin = login("admin.demo");
    mvc.perform(get("/api/llm-configurations").session(applicant))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/llm-configurations")
                .session(applicant)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(input("synthetic-denied"))))
        .andExpect(status().isForbidden());
    var unsafe =
        Map.of(
            "connection",
            new ModelConnection(
                "OPENAI", "http://localhost/model", "model", "SA_OPENAI_API_KEY", 0, 1024, 15),
            "purpose",
            "SUMMARY",
            "reason",
            "합성 주소 경계 검사");
    mvc.perform(
            post("/api/llm-configurations")
                .session(admin)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(unsafe)))
        .andExpect(status().isUnprocessableEntity());
  }

  private static LlmConfigurationRequest input(String model) {
    return new LlmConfigurationRequest(
        new ModelConnection(
            "OPENAI",
            "https://api.openai.com/v1/chat/completions",
            model,
            "SA_OPENAI_API_KEY",
            0,
            1024,
            15),
        "SUMMARY",
        "합성 모델 선택 경계 검사");
  }
}
