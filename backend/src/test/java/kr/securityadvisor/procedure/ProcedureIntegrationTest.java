package kr.securityadvisor.procedure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import kr.securityadvisor.IntegrationTestSupport;
import kr.securityadvisor.common.model.OrganizationPolicy;
import kr.securityadvisor.institution.dto.PublishRequest;
import kr.securityadvisor.institution.dto.SettingsRequest;
import kr.securityadvisor.institution.dto.SettingsResponse;
import kr.securityadvisor.procedure.dto.AnswerPatchRequest;
import kr.securityadvisor.procedure.dto.CreateProcedureRequest;
import kr.securityadvisor.procedure.dto.NetworkRequest;
import kr.securityadvisor.procedure.dto.ProcedureResponse;
import kr.securityadvisor.procedure.dto.ReviewRequest;
import kr.securityadvisor.procedure.dto.RevisionRequest;
import kr.securityadvisor.procedure.dto.SupplementAnswerRequest;
import kr.securityadvisor.procedure.dto.SupplementQuestionRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.ObjectMapper;

class ProcedureIntegrationTest extends IntegrationTestSupport {
  private final JdbcTemplate jdbc;

  @Autowired
  ProcedureIntegrationTest(MockMvc mvc, ObjectMapper mapper, JdbcTemplate jdbc) {
    super(mvc, mapper);
    this.jdbc = jdbc;
  }

  @Test
  void sequentialPolicyRequiresSecurityBeforeInfraAndRechecksAfterContentChange() throws Exception {
    MockHttpSession admin = login("admin.demo");
    MockHttpSession applicant = login("applicant.demo");
    MockHttpSession security = login("security.demo");
    MockHttpSession infra = login("infra.demo");
    SettingsResponse original = settings(admin);
    OrganizationPolicy previous = original.published();
    OrganizationPolicy sequential =
        new OrganizationPolicy(
            previous.institutionName(),
            "SEQUENTIAL",
            true,
            true,
            previous.questions(),
            previous.documentFooter(),
            previous.model());
    try {
      publishPolicy(admin, sequential);
      ProcedureResponse current = create(applicant, "SECURITY_REVIEW", "합성 순차 검토 검증");
      assertThat(current.policy().reviewMode()).isEqualTo("SEQUENTIAL");
      current = fillAnswers(applicant, current, "APPLICANT");
      current =
          exchange(
              post(path(current, "/consult")), applicant, new RevisionRequest(current.revision()));
      current = fillAnswers(security, current, "SECURITY");
      current = fillAnswers(infra, current, "INFRA");
      rejectPrematureInfraReview(infra, current);
      current = review(security, current);
      current = review(infra, current);
      assertThat(fetch(applicant, current.id()).allowedActions()).contains("SUBMIT");
      current =
          exchange(
              patch(path(current, "/answers")),
              security,
              new AnswerPatchRequest(
                  current.revision(),
                  List.of(
                      new AnswerPatchRequest.AnswerInput(
                          "accessControl", "합성 접근 통제 방안을 변경하여 재확인이 필요합니다.", true, false))));
      assertThat(current.reviews()).allMatch(review -> review.status().equals("INVALIDATED"));
      rejectPrematureInfraReview(infra, current);
      current = review(security, current);
      current = review(infra, current);
      assertThat(fetch(applicant, current.id()).blockers()).isEmpty();
    } finally {
      publishPolicy(admin, original.published());
      if (!original.draft().equals(original.published())) {
        savePolicy(admin, original.draft());
      }
    }
  }

  @Test
  void requiresExplicitNonNullExpectedRevisionEvenForInitialDraft() throws Exception {
    MockHttpSession applicant = login("applicant.demo");
    ProcedureResponse procedure = create(applicant, "SECURITY_REVIEW", "합성 버전 필수 검증");
    List<String> invalidBodies =
        List.of(
            """
        {"answers":[{"key":"purpose","value":"버전 없는 변경","confirmed":true,"notApplicable":false}]}
        """,
            """
        {"expectedRevision":null,"answers":[{"key":"purpose","value":"null 버전 변경","confirmed":true,"notApplicable":false}]}
        """);
    for (String body : invalidBodies) {
      mvc.perform(
              patch(path(procedure, "/answers"))
                  .session(applicant)
                  .with(csrf())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isBadRequest());
    }
    assertThat(fetch(applicant, procedure.id()).revision()).isZero();
  }

  @Test
  void validatesFullWorkflowAndPreservesSubmittedDocumentThroughReceipt() throws Exception {
    MockHttpSession applicant = login("applicant.demo");
    MockHttpSession infra = login("infra.demo");
    MockHttpSession security = login("security.demo");
    ProcedureResponse current =
        create(applicant, "FIREWALL", "합성 개요 <script>alert('synthetic')</script>");
    current = fillAnswers(applicant, current, "APPLICANT");
    current =
        exchange(
            post(path(current, "/consult")), applicant, new RevisionRequest(current.revision()));
    current = fillAnswers(infra, current, "INFRA");
    current =
        exchange(
            put(path(current, "/network")),
            infra,
            new NetworkRequest(
                current.revision(),
                List.of(
                    new NetworkRequest.RuleInput(
                        null,
                        "합성 안내 화면",
                        "192.0.2.10",
                        "합성 안내 API",
                        "198.51.100.20",
                        "443",
                        "TCP",
                        "ONE_WAY",
                        LocalDate.of(2026, 11, 10),
                        LocalDate.of(2026, 11, 30),
                        "합성 통신 범위 검증"))));
    assertThat(current.rules().getFirst().source().kind()).isEqualTo("SPECIALIST_INPUT");
    assertThat(current.rules().getFirst().confirmation().role()).isEqualTo("INFRA");
    current = fillAnswers(security, current, "SECURITY");
    current = review(infra, current);
    current = review(security, current);
    assertThat(fetch(applicant, current.id()).allowedActions()).contains("SUBMIT");

    current =
        exchange(
            patch(path(current, "/answers")),
            applicant,
            new AnswerPatchRequest(
                current.revision(),
                List.of(
                    new AnswerPatchRequest.AnswerInput(
                        "purpose", "최종 확인 전 신청자가 수정한 합성 서비스 목적", true, false))));
    assertThat(current.reviews()).allMatch(item -> item.status().equals("INVALIDATED"));
    mvc.perform(
            post(path(current, "/submit"))
                .session(applicant)
                .with(csrf())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(new RevisionRequest(current.revision()))))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("SUBMISSION_BLOCKED"));

    current =
        exchange(
            post(path(current, "/supplements")),
            security,
            new SupplementQuestionRequest(current.revision(), "합성 공개 자료만 처리하는지 재확인해 주세요."));
    UUID supplementId = current.supplements().getFirst().id();
    current =
        exchange(
            post(path(current, "/supplements/" + supplementId + "/answer")),
            applicant,
            new SupplementAnswerRequest(current.revision(), "합성 공개 자료만 처리합니다."));
    assertThat(current.supplements().getFirst().status()).isEqualTo("ANSWERED");
    assertThat(current.blockers()).anyMatch(item -> item.contains("보완"));
    mvc.perform(
            post(path(current, "/supplements/" + supplementId + "/resolve"))
                .session(infra)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(new RevisionRequest(current.revision()))))
        .andExpect(status().isForbidden());
    current =
        exchange(
            post(path(current, "/supplements/" + supplementId + "/resolve")),
            security,
            new RevisionRequest(current.revision()));
    assertThat(current.supplements().getFirst().status()).isEqualTo("RESOLVED");
    current = review(infra, current);
    current = review(security, current);
    current = fetch(applicant, current.id());
    assertThat(current.blockers()).isEmpty();
    long submittedRevision = current.revision();
    String requestKey = UUID.randomUUID().toString();
    current =
        exchange(
            post(path(current, "/submit")).header("Idempotency-Key", requestKey),
            applicant,
            new RevisionRequest(submittedRevision));
    assertThat(current.status()).isEqualTo("SUBMITTED");
    assertThat(current.revision()).isEqualTo(submittedRevision);
    assertThat(current.allowedActions()).doesNotContain("EDIT", "ANALYZE", "SUBMIT");
    ProcedureResponse repeated =
        exchange(
            post(path(current, "/submit")).header("Idempotency-Key", requestKey),
            applicant,
            new RevisionRequest(submittedRevision));
    assertThat(repeated.status()).isEqualTo("SUBMITTED");
    assertThat(
            jdbc.queryForObject(
                "select count(*) from procedure_submissions where procedure_id = ?",
                Integer.class,
                current.id()))
        .isEqualTo(1);

    String beforeReceipt = document(applicant, current.id());
    assertThat(beforeReceipt)
        .contains("제출본", "&lt;script&gt;", "실제 시스템 처리 완료")
        .doesNotContain("<script>");
    String snapshotBefore =
        jdbc.queryForObject(
            "select snapshot::text from procedure_submissions where procedure_id = ?",
            String.class,
            current.id());
    mvc.perform(
            patch(path(current, "/answers"))
                .session(applicant)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    mapper.writeValueAsBytes(
                        new AnswerPatchRequest(
                            submittedRevision,
                            List.of(
                                new AnswerPatchRequest.AnswerInput(
                                    "purpose", "제출 후 변경 시도", true, false))))))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("SUBMISSION_LOCKED"));
    current =
        exchange(post(path(current, "/receive")), security, new RevisionRequest(submittedRevision));
    assertThat(current.status()).isEqualTo("RECEIVED");
    assertThat(document(applicant, current.id())).isEqualTo(beforeReceipt);
    assertThat(
            jdbc.queryForObject(
                "select snapshot::text from procedure_submissions where procedure_id = ?",
                String.class,
                current.id()))
        .isEqualTo(snapshotBefore);
    UUID id = current.id();
    assertThatThrownBy(
            () ->
                jdbc.update(
                    "update procedure_submissions set document_html = ? where procedure_id = ?",
                    "변경 시도",
                    id))
        .isInstanceOf(DataAccessException.class);
    assertThatThrownBy(
            () -> jdbc.update("delete from procedure_submissions where procedure_id = ?", id))
        .isInstanceOf(DataAccessException.class);
    assertThat(document(applicant, id)).isEqualTo(beforeReceipt);
  }

  @Test
  void appliesOwnerTenantAndRoleIsolationToRecordsDocumentsAndMutations() throws Exception {
    MockHttpSession applicant = login("applicant.demo");
    MockHttpSession second = login("second.demo");
    MockHttpSession outside = login("outside.demo");
    MockHttpSession security = login("security.demo");
    MockHttpSession admin = login("admin.demo");
    ProcedureResponse procedure = create(applicant, "SECURITY_REVIEW", "합성 조회 경계 검증");
    for (MockHttpSession blocked : List.of(second, outside, security)) {
      mvc.perform(get(path(procedure, "")).session(blocked)).andExpect(status().isNotFound());
      mvc.perform(get(path(procedure, "/document")).session(blocked))
          .andExpect(status().isNotFound());
    }
    mvc.perform(get(path(procedure, "")).session(admin)).andExpect(status().isForbidden());
    mvc.perform(get("/api/procedures").session(admin)).andExpect(status().isForbidden());
    mvc.perform(
            patch(path(procedure, "/answers"))
                .session(applicant)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    mapper.writeValueAsBytes(
                        new AnswerPatchRequest(
                            procedure.revision(),
                            List.of(
                                new AnswerPatchRequest.AnswerInput(
                                    "accessControl", "권한 위조 확인", true, false))))))
        .andExpect(status().isForbidden());
    mvc.perform(
            patch(path(procedure, "/answers"))
                .session(second)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    mapper.writeValueAsBytes(
                        new AnswerPatchRequest(
                            procedure.revision(),
                            List.of(
                                new AnswerPatchRequest.AnswerInput(
                                    "purpose", "다른 작성자 변경", true, false))))))
        .andExpect(status().isNotFound());
    procedure = fillAnswers(applicant, procedure, "APPLICANT");
    procedure =
        exchange(
            post(path(procedure, "/consult")),
            applicant,
            new RevisionRequest(procedure.revision()));
    assertThat(fetch(security, procedure.id()).allowedActions()).contains("EDIT", "SUPPLEMENT");
    mvc.perform(get(path(procedure, "")).session(second)).andExpect(status().isNotFound());
    mvc.perform(get(path(procedure, "")).session(outside)).andExpect(status().isNotFound());
    mvc.perform(get(path(procedure, "/document")).session(outside))
        .andExpect(status().isNotFound());
  }

  @Test
  void simultaneousEditsAtSameRevisionProduceOneConflictWithoutLostUpdate() throws Exception {
    MockHttpSession applicant = login("applicant.demo");
    ProcedureResponse procedure = create(applicant, "SECURITY_REVIEW", "합성 동시 변경 검증");
    CountDownLatch start = new CountDownLatch(1);
    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
      var first =
          executor.submit(() -> editAtGate(start, applicant, procedure, "purpose", "첫 번째 창 입력"));
      var second =
          executor.submit(() -> editAtGate(start, applicant, procedure, "audience", "두 번째 창 입력"));
      start.countDown();
      assertThat(List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(200, 409);
    }
    ProcedureResponse current = fetch(applicant, procedure.id());
    assertThat(current.revision()).isEqualTo(1);
    assertThat(current.answers().stream().filter(answer -> !answer.value().isBlank())).hasSize(1);
  }

  private int editAtGate(
      CountDownLatch start,
      MockHttpSession session,
      ProcedureResponse procedure,
      String key,
      String value)
      throws Exception {
    if (!start.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("테스트 시작 신호를 받지 못했습니다.");
    return mvc.perform(
            patch(path(procedure, "/answers"))
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    mapper.writeValueAsBytes(
                        new AnswerPatchRequest(
                            procedure.revision(),
                            List.of(new AnswerPatchRequest.AnswerInput(key, value, true, false))))))
        .andReturn()
        .getResponse()
        .getStatus();
  }

  private ProcedureResponse create(MockHttpSession session, String type, String description)
      throws Exception {
    var result =
        mvc.perform(
                post("/api/procedures")
                    .session(session)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper.writeValueAsBytes(
                            new CreateProcedureRequest(
                                "합성 통합 검증 " + UUID.randomUUID(), type, "가상 부서", description))))
            .andExpect(status().isCreated())
            .andReturn();
    return mapper.readValue(result.getResponse().getContentAsByteArray(), ProcedureResponse.class);
  }

  private ProcedureResponse fillAnswers(
      MockHttpSession session, ProcedureResponse procedure, String role) throws Exception {
    List<AnswerPatchRequest.AnswerInput> answers =
        procedure.answers().stream()
            .filter(answer -> answer.ownerRole().equals(role))
            .map(
                answer ->
                    new AnswerPatchRequest.AnswerInput(
                        answer.key(),
                        answer.key().equals("externalTransfer")
                            ? "NO"
                            : "합성 자료 확인: " + answer.label(),
                        true,
                        false))
            .toList();
    return exchange(
        patch(path(procedure, "/answers")),
        session,
        new AnswerPatchRequest(procedure.revision(), answers));
  }

  private ProcedureResponse review(MockHttpSession session, ProcedureResponse procedure)
      throws Exception {
    return exchange(
        post(path(procedure, "/review")),
        session,
        new ReviewRequest(procedure.revision(), "현재 합성 자료를 확인했습니다."));
  }

  private void rejectPrematureInfraReview(MockHttpSession infra, ProcedureResponse procedure)
      throws Exception {
    assertThat(fetch(infra, procedure.id()).allowedActions()).doesNotContain("REVIEW");
    mvc.perform(
            post(path(procedure, "/review"))
                .session(infra)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    mapper.writeValueAsBytes(
                        new ReviewRequest(procedure.revision(), "선행 검토 없이 시도"))))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("REVIEW_BLOCKED"));
  }

  private SettingsResponse settings(MockHttpSession admin) throws Exception {
    var result =
        mvc.perform(get("/api/institution/settings").session(admin))
            .andExpect(status().isOk())
            .andReturn();
    return mapper.readValue(result.getResponse().getContentAsByteArray(), SettingsResponse.class);
  }

  private SettingsResponse savePolicy(MockHttpSession admin, OrganizationPolicy policy)
      throws Exception {
    SettingsResponse current = settings(admin);
    var result =
        mvc.perform(
                put("/api/institution/settings")
                    .session(admin)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper.writeValueAsBytes(new SettingsRequest(current.revision(), policy))))
            .andExpect(status().isOk())
            .andReturn();
    return mapper.readValue(result.getResponse().getContentAsByteArray(), SettingsResponse.class);
  }

  private void publishPolicy(MockHttpSession admin, OrganizationPolicy policy) throws Exception {
    SettingsResponse saved = savePolicy(admin, policy);
    mvc.perform(
            post("/api/institution/settings/publish")
                .session(admin)
                .with(csrf())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(new PublishRequest(saved.revision()))))
        .andExpect(status().isOk());
  }

  private ProcedureResponse fetch(MockHttpSession session, UUID id) throws Exception {
    var result =
        mvc.perform(get("/api/procedures/" + id).session(session))
            .andExpect(status().isOk())
            .andReturn();
    return mapper.readValue(result.getResponse().getContentAsByteArray(), ProcedureResponse.class);
  }

  private ProcedureResponse exchange(
      MockHttpServletRequestBuilder request, MockHttpSession session, Object body)
      throws Exception {
    var result =
        mvc.perform(
                request
                    .session(session)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsBytes(body)))
            .andExpect(status().isOk())
            .andReturn();
    return mapper.readValue(result.getResponse().getContentAsByteArray(), ProcedureResponse.class);
  }

  private String document(MockHttpSession session, UUID id) throws Exception {
    return mvc.perform(get("/api/procedures/" + id + "/document").session(session))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString(StandardCharsets.UTF_8);
  }

  private String path(ProcedureResponse procedure, String suffix) {
    return "/api/procedures/" + procedure.id() + suffix;
  }
}
