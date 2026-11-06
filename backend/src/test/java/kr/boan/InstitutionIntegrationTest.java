package kr.boan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import kr.boan.common.model.ExtraQuestion;
import kr.boan.common.model.OrganizationPolicy;
import kr.boan.institution.dto.ContextRequest;
import kr.boan.institution.dto.ContextResponse;
import kr.boan.institution.dto.PublishRequest;
import kr.boan.institution.dto.SettingsRequest;
import kr.boan.institution.dto.SettingsResponse;
import kr.boan.procedure.dto.CreateProcedureRequest;
import kr.boan.procedure.dto.ProcedureResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

class InstitutionIntegrationTest extends IntegrationTestSupport {
  private final JdbcTemplate jdbc;

  @Autowired
  InstitutionIntegrationTest(MockMvc mvc, ObjectMapper mapper, JdbcTemplate jdbc) {
    super(mvc, mapper);
    this.jdbc = jdbc;
  }

  @Test
  @DisplayName("초안·게시본·신청 스냅샷을 분리하고 게시 재전송과 오래된 저장을 처리한다")
  void publishOnlyAffectsNewApplications() throws Exception {
    var admin = login("admin.demo");
    var applicant = login("applicant.demo");
    SettingsResponse original = settings(admin);
    OrganizationPolicy baseline = original.published();
    ProcedureResponse existing = create(applicant);
    try {
      var question =
          new ExtraQuestion("custom_demo_scope", "합성 추가 확인", "합성 범위를 확인합니다.", "APPLICANT", false);
      OrganizationPolicy draft =
          new OrganizationPolicy(
              baseline.institutionName(),
              "SEQUENTIAL",
              true,
              true,
              List.of(question),
              "수정한 시연 문구",
              baseline.model());
      SettingsResponse edited = update(admin, original.revision(), draft);
      assertThat(edited.published()).isEqualTo(baseline);
      assertThat(create(applicant).policyVersion()).isEqualTo(original.publishedVersion());
      String key = UUID.randomUUID().toString();
      SettingsResponse published = publish(admin, edited.revision(), key);
      SettingsResponse repeated = publish(admin, edited.revision(), key);
      assertThat(repeated.revision()).isEqualTo(published.revision());
      assertThat(repeated.history()).isEqualTo(published.history());
      assertThat(published.publishedVersion()).isEqualTo(original.publishedVersion() + 1);
      ProcedureResponse fresh = create(applicant);
      assertThat(fresh.policyVersion()).isEqualTo(published.publishedVersion());
      assertThat(fresh.answers())
          .extracting(ProcedureResponse.AnswerResponse::key)
          .contains("custom_demo_scope");
      ProcedureResponse unchanged =
          mapper.readValue(
              mvc.perform(get("/api/procedures/" + existing.id()).session(applicant))
                  .andExpect(status().isOk())
                  .andReturn()
                  .getResponse()
                  .getContentAsByteArray(),
              ProcedureResponse.class);
      assertThat(unchanged.policy()).isEqualTo(existing.policy());
      assertThat(unchanged.policyVersion()).isEqualTo(existing.policyVersion());
      mvc.perform(
              put("/api/institution/settings")
                  .session(admin)
                  .with(csrf())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(
                      mapper.writeValueAsBytes(new SettingsRequest(original.revision(), draft))))
          .andExpect(status().isConflict())
          .andExpect(jsonPath("$.latestRevision").value(published.revision()));
      mvc.perform(
              post("/api/institution/settings/publish")
                  .session(admin)
                  .with(csrf())
                  .header("Idempotency-Key", key)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(mapper.writeValueAsBytes(new PublishRequest(published.revision()))))
          .andExpect(status().isConflict());
      UUID institution = UUID.fromString("10000000-0000-0000-0000-000000000001");
      assertThatThrownBy(
              () ->
                  jdbc.update(
                      "UPDATE policy_publications SET published_by = ? WHERE institution_id = ? AND version = ?",
                      "합성 변경 시도",
                      institution,
                      published.publishedVersion()))
          .isInstanceOf(DataAccessException.class);
    } finally {
      SettingsResponse current = settings(admin);
      SettingsResponse restored = update(admin, current.revision(), baseline);
      publish(admin, restored.revision(), UUID.randomUUID().toString());
    }
  }

  @Test
  @DisplayName("비공개 자료는 암호문으로 저장하고 전문 역할만 열람하며 신청자·다른 기관 접근을 거절한다")
  void encryptPrivateContextAndEnforceRoles() throws Exception {
    var admin = login("admin.demo");
    var security = login("security.demo");
    var applicant = login("applicant.demo");
    var outside = login("outside.demo");
    ContextRequest input =
        new ContextRequest("합성 제목 " + UUID.randomUUID(), "합성 분류", "실제 정보가 없는 시연 본문");
    ContextResponse saved =
        mapper.readValue(
            mvc.perform(
                    post("/api/institution/contexts")
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
            mvc.perform(get("/api/institution/contexts").session(security))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsByteArray(),
            ContextResponse[].class);
    assertThat(visible).anySatisfy(context -> assertThat(context.id()).isEqualTo(saved.id()));
    mvc.perform(get("/api/institution/contexts").session(applicant))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/institution/contexts").session(outside))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/institution/contexts")
                .session(security)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(input)))
        .andExpect(status().isForbidden());
  }

  private SettingsResponse settings(MockHttpSession admin) throws Exception {
    return mapper.readValue(
        mvc.perform(get("/api/institution/settings").session(admin))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsByteArray(),
        SettingsResponse.class);
  }

  private SettingsResponse update(MockHttpSession admin, long revision, OrganizationPolicy policy)
      throws Exception {
    return mapper.readValue(
        mvc.perform(
                put("/api/institution/settings")
                    .session(admin)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsBytes(new SettingsRequest(revision, policy))))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsByteArray(),
        SettingsResponse.class);
  }

  private SettingsResponse publish(MockHttpSession admin, long revision, String key)
      throws Exception {
    return mapper.readValue(
        mvc.perform(
                post("/api/institution/settings/publish")
                    .session(admin)
                    .with(csrf())
                    .header("Idempotency-Key", key)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsBytes(new PublishRequest(revision))))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsByteArray(),
        SettingsResponse.class);
  }

  private ProcedureResponse create(MockHttpSession applicant) throws Exception {
    return mapper.readValue(
        mvc.perform(
                post("/api/procedures")
                    .session(applicant)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper.writeValueAsBytes(
                            new CreateProcedureRequest(
                                "합성 정책 검사 신청", "FIREWALL", "시연 부서", "설정 적용 범위 검사"))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsByteArray(),
        ProcedureResponse.class);
  }
}
