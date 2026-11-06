package kr.securityadvisor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

class MemberRegistrationIntegrationTest extends IntegrationTestSupport {
  private final JdbcTemplate jdbc;

  @Autowired
  MemberRegistrationIntegrationTest(MockMvc mvc, ObjectMapper mapper, JdbcTemplate jdbc) {
    super(mvc, mapper);
    this.jdbc = jdbc;
  }

  @Test
  @DisplayName("로그인 성공과 실패를 원문 자격 증명 없이 감사 이력에 남긴다")
  void authenticationEventsReachTheAuditStore() throws Exception {
    long succeeded =
        jdbc.queryForObject(
            "select count(*) from audit_events where action = 'LOGIN_SUCCEEDED'", Long.class);
    long failed =
        jdbc.queryForObject(
            "select count(*) from audit_events where action = 'LOGIN_FAILED'", Long.class);
    login("applicant.demo");
    mvc.perform(
            post("/api/auth/login")
                .with(csrf())
                .with(
                    request -> {
                      request.setRemoteAddr("192.0.2.251");
                      return request;
                    })
                .param("username", "missing." + UUID.randomUUID())
                .param("password", UUID.randomUUID().toString()))
        .andExpect(status().isUnauthorized());
    assertThat(
            jdbc.queryForObject(
                "select count(*) from audit_events where action = 'LOGIN_SUCCEEDED'", Long.class))
        .isEqualTo(succeeded + 1);
    assertThat(
            jdbc.queryForObject(
                "select count(*) from audit_events where action = 'LOGIN_FAILED'", Long.class))
        .isEqualTo(failed + 1);
  }

  @Test
  @DisplayName("가입 요청이 ADMIN과 타 기관을 주장해도 시연 기관의 일반 사용자로만 만든다")
  void ignoresForgedRoleAndInstitution() throws Exception {
    String username = "signup." + UUID.randomUUID().toString().substring(0, 12);
    String password = "Aa9" + UUID.randomUUID();
    var result =
        mvc.perform(
                post("/api/auth/signup")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper.writeValueAsString(
                            Map.of(
                                "username",
                                username,
                                "password",
                                password,
                                "displayName",
                                "합성 신규 신청자",
                                "department",
                                "가상 사업부",
                                "role",
                                "ADMIN",
                                "institutionId",
                                UUID.randomUUID().toString()))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.role").value("APPLICANT"))
            .andExpect(jsonPath("$.institutionId").value("10000000-0000-0000-0000-000000000001"))
            .andReturn();
    UUID id =
        UUID.fromString(
            mapper.readTree(result.getResponse().getContentAsString()).path("userId").asText());
    String hash =
        jdbc.queryForObject(
            "select password_hash from user_accounts where id = ?", String.class, id);
    assertThat(hash).startsWith("$2").doesNotContain(password);
    assertThat(
            jdbc.queryForObject(
                "select count(*) from audit_events where target_id = ? and action = 'MEMBER_REGISTERED'",
                Long.class,
                id))
        .isEqualTo(1);
    var login =
        mvc.perform(
                post("/api/auth/login")
                    .with(csrf())
                    .param("username", username)
                    .param("password", password))
            .andExpect(status().isOk())
            .andReturn();
    MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);
    mvc.perform(get("/api/members").session(session)).andExpect(status().isForbidden());
    mvc.perform(get("/api/business-cases").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
    mvc.perform(
            post("/api/auth/signup")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    mapper.writeValueAsString(
                        Map.of(
                            "username", username, "password", password, "displayName", "합성 중복"))))
        .andExpect(status().isConflict());
  }

  @Test
  @DisplayName("약한 비밀번호와 CSRF 없는 가입 요청은 거절한다")
  void rejectsWeakPasswordAndMissingCsrf() throws Exception {
    String body =
        mapper.writeValueAsString(
            Map.of("username", "weak.demo", "password", "weak", "displayName", "합성"));
    mvc.perform(
            post("/api/auth/signup")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest());
    mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("관리자 역할 변경은 같은 기관과 수정본을 검사하고 감사에 남긴다")
  void roleChangeHasServerAuthorityAndRevision() throws Exception {
    String username = "roles." + UUID.randomUUID().toString().substring(0, 12);
    String password = "Aa9" + UUID.randomUUID();
    var result =
        mvc.perform(
                post("/api/auth/signup")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper.writeValueAsString(
                            Map.of(
                                "username",
                                username,
                                "password",
                                password,
                                "displayName",
                                "합성 역할 계정"))))
            .andExpect(status().isCreated())
            .andReturn();
    String id = mapper.readTree(result.getResponse().getContentAsString()).path("userId").asText();
    String body =
        mapper.writeValueAsString(
            Map.of("role", "INFRA", "expectedRevision", 0, "reason", "합성 담당자 배정 테스트"));
    mvc.perform(
            patch("/api/members/" + id + "/role")
                .session(login("applicant.demo"))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isForbidden());
    MockHttpSession admin = login("admin.demo");
    mvc.perform(
            patch("/api/members/" + id + "/role")
                .session(admin)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("INFRA"))
        .andExpect(jsonPath("$.revision").value(1));
    mvc.perform(
            patch("/api/members/" + id + "/role")
                .session(admin)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isConflict());
    assertThat(
            jdbc.queryForObject(
                "select count(*) from audit_events where target_id = ? and action = 'MEMBER_ROLE_CHANGED'",
                Long.class,
                UUID.fromString(id)))
        .isEqualTo(1);
  }
}
