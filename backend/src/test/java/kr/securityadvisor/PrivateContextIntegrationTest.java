package kr.securityadvisor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import kr.securityadvisor.knowledge.dto.ContextRequest;
import kr.securityadvisor.knowledge.dto.ContextResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

class PrivateContextIntegrationTest extends IntegrationTestSupport {
  private final JdbcTemplate jdbc;

  @Autowired
  PrivateContextIntegrationTest(MockMvc mvc, ObjectMapper mapper, JdbcTemplate jdbc) {
    super(mvc, mapper);
    this.jdbc = jdbc;
  }

  @Test
  @DisplayName("비공개 원문은 암호화하고 등록·조회 감사에는 참조 ID만 남긴다")
  void encryptContextAndAuditWithoutCopyingContent() throws Exception {
    var admin = login("admin.demo");
    var security = login("security.demo");
    ContextRequest input =
        new ContextRequest(
            "합성 자료 " + UUID.randomUUID(),
            "합성 분류-" + UUID.randomUUID().toString().substring(0, 8),
            "실제 정보가 없는 시연 원문 " + UUID.randomUUID());
    ContextResponse saved =
        mapper.readValue(
            mvc.perform(
                    post("/api/private-contexts")
                        .session(admin)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsBytes(input)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsByteArray(),
            ContextResponse.class);
    byte[] encrypted =
        jdbc.queryForObject(
            "SELECT encrypted_payload FROM private_contexts WHERE id = ?",
            byte[].class,
            saved.id());
    assertThat(new String(encrypted, StandardCharsets.UTF_8))
        .doesNotContain(input.title(), input.category(), input.content());
    ContextResponse[] visible =
        mapper.readValue(
            mvc.perform(get("/api/private-contexts").session(security))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsByteArray(),
            ContextResponse[].class);
    assertThat(visible).anySatisfy(context -> assertThat(context.id()).isEqualTo(saved.id()));
    var actions =
        jdbc.queryForList(
            "SELECT action FROM audit_events WHERE target_type = 'PRIVATE_CONTEXT' AND target_id = ?",
            String.class,
            saved.id());
    assertThat(actions).contains("PRIVATE_CONTEXT_REGISTERED", "PRIVATE_CONTEXT_VIEWED");
    var traces =
        jdbc.queryForList(
            "SELECT reason || field_keys::text FROM audit_events WHERE target_id = ?",
            String.class,
            saved.id());
    assertThat(traces)
        .allSatisfy(
            trace ->
                assertThat(trace).doesNotContain(input.title(), input.category(), input.content()));
  }

  @Test
  @DisplayName("신청자는 조회할 수 없고 전문 담당자는 관리자 등록 권한을 가질 수 없다")
  void enforceReadAndRegistrationRoles() throws Exception {
    mvc.perform(get("/api/private-contexts")).andExpect(status().isUnauthorized());
    for (String username : java.util.List.of("applicant.demo", "outside.demo")) {
      mvc.perform(get("/api/private-contexts").session(login(username)))
          .andExpect(status().isForbidden());
    }
    var security = login("security.demo");
    mvc.perform(
            post("/api/private-contexts")
                .session(security)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(new ContextRequest("합성 제목", "합성 분류", "합성 내용"))))
        .andExpect(status().isForbidden());
  }
}
