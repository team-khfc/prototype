package kr.securityadvisor.request;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import kr.securityadvisor.IntegrationTestSupport;
import kr.securityadvisor.auth.domain.UserAccount;
import kr.securityadvisor.auth.repository.UserAccountRepository;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Role;
import kr.securityadvisor.request.dto.WorkflowCommands.AnswerInput;
import kr.securityadvisor.request.dto.WorkflowCommands.AnswerPatch;
import kr.securityadvisor.request.dto.WorkflowCommands.CompleteReview;
import kr.securityadvisor.request.dto.WorkflowCommands.CreateCase;
import kr.securityadvisor.request.dto.WorkflowCommands.Reason;
import kr.securityadvisor.request.dto.WorkflowCommands.Reassign;
import kr.securityadvisor.request.dto.WorkflowCommands.Revision;
import kr.securityadvisor.request.dto.WorkflowCommands.StageReturn;
import kr.securityadvisor.request.dto.WorkflowCommands.Supplement;
import kr.securityadvisor.request.dto.WorkflowCommands.SupplementAnswer;
import kr.securityadvisor.request.dto.WorkflowResponses.AnswerResponse;
import kr.securityadvisor.request.dto.WorkflowResponses.BusinessCaseResponse;
import kr.securityadvisor.request.dto.WorkflowResponses.SecurityRequestResponse;
import kr.securityadvisor.request.service.BusinessCaseService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.ObjectMapper;

/** 실제 세션·PostgreSQL·서버 명령을 통과하는 P1 핵심 흐름 회귀 검사다. */
class WorkflowIntegrationTest extends IntegrationTestSupport {
  private final JdbcTemplate jdbc;
  private final BusinessCaseService cases;
  private final UserAccountRepository accounts;

  @Autowired
  WorkflowIntegrationTest(
      MockMvc mvc,
      ObjectMapper mapper,
      JdbcTemplate jdbc,
      BusinessCaseService cases,
      UserAccountRepository accounts) {
    super(mvc, mapper);
    this.jdbc = jdbc;
    this.cases = cases;
    this.accounts = accounts;
  }

  @Test
  void twoDocumentsStayIndependentAndOnlyOrderedHumanConfirmationsFinalizeImmutableSubmission()
      throws Exception {
    Sessions users = sessions();
    Prepared prepared = prepareFinalReview(users);
    UUID id = prepared.requestId();
    SecurityRequestResponse ready = current(users.applicant(), id);
    assertThat(ready.stage()).isEqualTo(3);
    assertThat(current(users.applicant(), prepared.siblingId()).stage()).isEqualTo(1);
    assertThat(ready.reviews()).allMatch(review -> review.status().equals("COMPLETE"));
    String key = UUID.randomUUID().toString();
    Revision input = new Revision(ready.revision());
    SecurityRequestResponse submitted =
        mutate(users.applicant(), post(path(id, "submit")).header("Idempotency-Key", key), input);
    assertThat(submitted.status()).isEqualTo("SUBMITTED");
    SecurityRequestResponse repeated =
        mutate(users.applicant(), post(path(id, "submit")).header("Idempotency-Key", key), input);
    assertThat(repeated.currentSubmissionId()).isEqualTo(submitted.currentSubmissionId());
    assertThat(repeated.submissions()).hasSize(1);
    mvc.perform(
            json(
                post(path(id, "submit")).header("Idempotency-Key", key),
                users.applicant(),
                new Revision(submitted.revision())))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
    mvc.perform(
            json(
                post(path(id, "final-confirmations")),
                users.security(),
                new Revision(submitted.revision())))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("INFRA_CONFIRMATION_REQUIRED"));

    String original = answer(submitted.commonAnswers(), "purpose").value();
    caseAnswer(
        users.applicant(),
        prepared.caseId(),
        List.of(new AnswerInput("purpose", "합성 목적 변경 후", true, false)));
    SecurityRequestResponse stillSubmitted = current(users.applicant(), id);
    assertThat(stillSubmitted.revision()).isEqualTo(submitted.revision());
    assertThat(answer(stillSubmitted.commonAnswers(), "purpose").value()).isEqualTo(original);
    SecurityRequestResponse sibling = current(users.applicant(), prepared.siblingId());
    assertThat(sibling.stage()).isEqualTo(1);
    assertThat(sibling.highlightedFields()).contains("purpose");

    SecurityRequestResponse infraConfirmed =
        command(users.infra(), id, "final-confirmations", new Revision(stillSubmitted.revision()));
    SecurityRequestResponse securityConfirmed =
        command(
            users.security(), id, "final-confirmations", new Revision(infraConfirmed.revision()));
    SecurityRequestResponse finalized =
        command(users.security(), id, "finalize", new Revision(securityConfirmed.revision()));
    assertThat(finalized.status()).isEqualTo("FINALIZED");
    assertThat(finalized.finalConfirmations()).hasSize(2);
    assertThat(finalized.deadlines()).noneMatch(deadline -> deadline.active());
    assertThat(current(users.applicant(), prepared.siblingId()).status()).isEqualTo("DRAFT");
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM firewall_rules WHERE request_id = ?", Integer.class, id))
        .isZero();
    mvc.perform(
            json(
                post(path(id, "withdraw")),
                users.applicant(),
                new Reason(finalized.revision(), "종료 후 변경")))
        .andExpect(status().isConflict());
    assertThatThrownBy(
            () ->
                jdbc.update(
                    "UPDATE security_submissions SET snapshot = snapshot WHERE id = ?",
                    finalized.currentSubmissionId()))
        .isInstanceOf(DataAccessException.class);
    assertThatThrownBy(
            () ->
                jdbc.update(
                    "DELETE FROM review_final_confirmations WHERE submission_id = ?",
                    finalized.currentSubmissionId()))
        .isInstanceOf(DataAccessException.class);
    assertThatThrownBy(
            () -> jdbc.update("UPDATE audit_events SET reason = reason WHERE target_id = ?", id))
        .isInstanceOf(DataAccessException.class);
    String html =
        mvc.perform(get(path(id, "document")).session(users.applicant()))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString(StandardCharsets.UTF_8);
    assertThat(html).contains("확정본", original).doesNotContain("합성 목적 변경 후");
    mvc.perform(get(path(id, "audit-events")).session(users.applicant()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[?(@.action == 'REQUEST_FINALIZED')]").isNotEmpty());
  }

  @Test
  void newSubmissionCannotReuseOldFinalConfirmationAfterReturn() throws Exception {
    Sessions users = sessions();
    Prepared prepared = prepareFinalReview(users);
    UUID id = prepared.requestId();
    SecurityRequestResponse ready = current(users.applicant(), id);
    SecurityRequestResponse first =
        mutate(
            users.applicant(),
            post(path(id, "submit")).header("Idempotency-Key", UUID.randomUUID().toString()),
            new Revision(ready.revision()));
    SecurityRequestResponse checked =
        command(users.infra(), id, "final-confirmations", new Revision(first.revision()));
    SecurityRequestResponse returned =
        command(
            users.security(),
            id,
            "returns",
            new StageReturn(checked.revision(), 3, List.of("connectionPurpose"), "제출본 재확인 요청"));
    assertThat(returned.currentSubmissionId()).isNull();
    assertThat(returned.submissions()).hasSize(1);
    assertThat(returned.highlightedFields()).contains("connectionPurpose");
    SecurityRequestResponse second =
        mutate(
            users.applicant(),
            post(path(id, "submit")).header("Idempotency-Key", UUID.randomUUID().toString()),
            new Revision(returned.revision()));
    assertThat(second.currentSubmissionId()).isNotEqualTo(first.currentSubmissionId());
    assertThat(second.submissions()).hasSize(2);
    mvc.perform(
            json(
                post(path(id, "final-confirmations")),
                users.security(),
                new Revision(second.revision())))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("INFRA_CONFIRMATION_REQUIRED"));
    assertThat(second.finalConfirmations()).hasSize(1);
  }

  @Test
  void supplementsAndReturnsKeepValuesAndNeedAssignedHumanResolution() throws Exception {
    Sessions users = sessions();
    BusinessCaseResponse businessCase = create(users.applicant());
    fillApplicant(users.applicant(), businessCase.id());
    UUID id = document(businessCase, "FIREWALL");
    UUID sibling = document(businessCase, "SECURITY_REVIEW");
    requestAnswer(users.applicant(), id, "connectionPurpose", "합성 연결 목적 원본");
    SecurityRequestResponse consulting =
        command(users.applicant(), id, "consult", revision(users.applicant(), id));
    assertThat(consulting.assignments()).hasSize(2);
    caseAnswer(users.infra(), businessCase.id(), infrastructure());
    SecurityRequestResponse allocated =
        command(users.infra(), id, "allocation", revision(users.infra(), id));
    SecurityRequestResponse supplement =
        command(
            users.security(),
            id,
            "supplements",
            new Supplement(allocated.revision(), List.of("connectionPurpose"), "합성 연결 목적 보완"));
    UUID supplementId = supplement.supplements().getFirst().id();
    mvc.perform(
            json(
                post(path(id, "returns")),
                users.security(),
                new StageReturn(supplement.revision(), 1, List.of("missing"), "보완")))
        .andExpect(status().isUnprocessableEntity());
    SecurityRequestResponse returned =
        command(
            users.security(),
            id,
            "returns",
            new StageReturn(supplement.revision(), 1, List.of("connectionPurpose"), "1단계 설명 보완"));
    assertThat(answer(returned.answers(), "connectionPurpose").value()).isEqualTo("합성 연결 목적 원본");
    assertThat(returned.returns()).hasSize(1);
    assertThat(returned.highlightedFields()).contains("connectionPurpose");
    assertThat(current(users.applicant(), sibling).stage()).isEqualTo(1);
    requestAnswer(users.applicant(), id, "connectionPurpose", "합성 보완한 연결 목적");
    command(users.applicant(), id, "consult", revision(users.applicant(), id));
    SecurityRequestResponse answered =
        command(
            users.applicant(),
            id,
            "supplements/" + supplementId + "/answer",
            new SupplementAnswer(current(users.applicant(), id).revision(), "합성 보완 내용을 반영했습니다."));
    assertThat(answered.supplements().getFirst().status()).isEqualTo("ANSWERED");
    mvc.perform(
            json(
                post(path(id, "reviews/complete")),
                users.security(),
                new CompleteReview(answered.revision(), "확인")))
        .andExpect(status().isUnprocessableEntity());
    mvc.perform(
            json(
                post(path(id, "supplements/" + supplementId + "/resolve")),
                users.infra(),
                new Revision(answered.revision())))
        .andExpect(status().isForbidden());
    SecurityRequestResponse resolved =
        command(
            users.security(),
            id,
            "supplements/" + supplementId + "/resolve",
            new Revision(answered.revision()));
    assertThat(resolved.supplements().getFirst().status()).isEqualTo("RESOLVED");
  }

  @Test
  void preSubmissionWithdrawalAndClosureFreezeCommonValuesAndDocument() throws Exception {
    Sessions users = sessions();
    for (String ending : List.of("withdraw", "close")) {
      BusinessCaseResponse businessCase = create(users.applicant());
      fillApplicant(users.applicant(), businessCase.id());
      UUID id = document(businessCase, "FIREWALL");
      requestAnswer(users.applicant(), id, "connectionPurpose", "합성 종료 시점 연결");
      MockHttpSession actor = users.applicant();
      if (ending.equals("close")) {
        command(users.applicant(), id, "consult", revision(users.applicant(), id));
        actor = users.security();
      }
      SecurityRequestResponse ended =
          command(actor, id, ending, new Reason(current(actor, id).revision(), "합성 종료 사유"));
      String before = answer(ended.commonAnswers(), "purpose").value();
      String documentBefore =
          mvc.perform(get(path(id, "document")).session(users.applicant()))
              .andExpect(status().isOk())
              .andReturn()
              .getResponse()
              .getContentAsString(StandardCharsets.UTF_8);
      caseAnswer(
          users.applicant(),
          businessCase.id(),
          List.of(new AnswerInput("purpose", "형제 신청의 합성 변경", true, false)));
      SecurityRequestResponse after = current(users.applicant(), id);
      assertThat(after.revision()).isEqualTo(ended.revision());
      assertThat(answer(after.commonAnswers(), "purpose").value()).isEqualTo(before);
      String documentAfter =
          mvc.perform(get(path(id, "document")).session(users.applicant()))
              .andExpect(status().isOk())
              .andReturn()
              .getResponse()
              .getContentAsString(StandardCharsets.UTF_8);
      assertThat(documentBefore).contains("당시 초안 · 미제출");
      assertThat(documentAfter).isEqualTo(documentBefore).doesNotContain("형제 신청의 합성 변경");
      assertThatThrownBy(
              () ->
                  jdbc.update(
                      "UPDATE security_requests SET revision = revision + 1 WHERE id = ?", id))
          .isInstanceOf(DataAccessException.class);
    }
  }

  @Test
  void readPermissionDoesNotGrantReviewPermissionAndReassignmentPreservesDeadline()
      throws Exception {
    Sessions users = sessions();
    BusinessCaseResponse businessCase = create(users.applicant());
    fillApplicant(users.applicant(), businessCase.id());
    UUID id = document(businessCase, "FIREWALL");
    requestAnswer(users.applicant(), id, "connectionPurpose", "합성 연결");
    SecurityRequestResponse consulting =
        command(users.applicant(), id, "consult", revision(users.applicant(), id));
    UserAccount seed = accounts.findByUsername("infra.demo").orElseThrow();
    String username = "zz-unassigned-" + UUID.randomUUID().toString().substring(0, 8);
    UserAccount unassigned =
        accounts.saveAndFlush(
            new UserAccount(
                UUID.randomUUID(),
                seed.getInstitutionId(),
                username,
                "합성 미배정 담당자",
                seed.getPasswordHash(),
                Role.INFRA));
    MockHttpSession visitor = login(username);
    mvc.perform(get(path(id, "")).session(visitor)).andExpect(status().isOk());
    mvc.perform(json(post(path(id, "allocation")), visitor, new Revision(consulting.revision())))
        .andExpect(status().isForbidden());
    mvc.perform(get(path(id, "")).session(login("second.demo"))).andExpect(status().isNotFound());
    mvc.perform(get(path(id, "document")).session(login("outside.demo")))
        .andExpect(status().isNotFound());
    mvc.perform(
            json(
                post(path(id, "reviews/complete")),
                users.admin(),
                new CompleteReview(consulting.revision(), "관리자 검토")))
        .andExpect(status().isForbidden());
    SecurityRequestResponse reassigned =
        mutate(
            users.admin(),
            patch(path(id, "assignments/INFRA")),
            new Reassign(consulting.revision(), unassigned.getId(), "합성 교대 배정"));
    assertThat(
            reassigned.assignments().stream()
                .filter(a -> a.active() && a.field().equals("INFRA"))
                .count())
        .isEqualTo(1);
    assertThat(reassigned.deadlines().stream().map(d -> d.dueAt()).toList())
        .containsExactlyElementsOf(consulting.deadlines().stream().map(d -> d.dueAt()).toList());
    mvc.perform(
            json(post(path(id, "allocation")), users.infra(), new Revision(reassigned.revision())))
        .andExpect(status().isForbidden());
    mvc.perform(
            json(
                post(path(id, "withdraw")),
                users.applicant(),
                new Reason(consulting.revision(), "오래된 화면")))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.latestRevision").value(reassigned.revision()));
    UUID deadlineId = reassigned.deadlines().getFirst().id();
    assertThatThrownBy(
            () ->
                jdbc.update(
                    "UPDATE request_deadlines SET due_at = due_at + interval '1 day' WHERE id = ?",
                    deadlineId))
        .isInstanceOf(DataAccessException.class);
    assertThat(current(users.applicant(), id).status()).isEqualTo("CONSULTING");
  }

  @Test
  void auditFailureRollsBackTheBusinessMutation() {
    UserAccount applicant = accounts.findByUsername("applicant.demo").orElseThrow();
    String title = "합성 감사 원자성 " + UUID.randomUUID();
    assertThatThrownBy(
            () ->
                cases.create(
                    applicant.toActor(),
                    new CreateCase(title, "합성 부서", "", List.of("FIREWALL")),
                    "x".repeat(101)))
        .isInstanceOf(DomainException.class);
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM business_cases WHERE title = ?", Integer.class, title))
        .isZero();
  }

  private Prepared prepareFinalReview(Sessions users) throws Exception {
    BusinessCaseResponse businessCase = create(users.applicant());
    fillApplicant(users.applicant(), businessCase.id());
    UUID id = document(businessCase, "FIREWALL");
    requestAnswer(users.applicant(), id, "connectionPurpose", "합성 HTTPS 연결");
    SecurityRequestResponse consulting =
        command(users.applicant(), id, "consult", revision(users.applicant(), id));
    mvc.perform(
            json(
                post(path(id, "reviews/complete")),
                users.security(),
                new CompleteReview(consulting.revision(), "선행 할당 없음")))
        .andExpect(status().isUnprocessableEntity());
    caseAnswer(users.infra(), businessCase.id(), infrastructure());
    SecurityRequestResponse allocated =
        command(users.infra(), id, "allocation", revision(users.infra(), id));
    assertThat(allocated.stage()).isEqualTo(2);
    assertThat(
            allocated.reviews().stream()
                .filter(r -> r.field().equals("INFRA"))
                .findFirst()
                .orElseThrow()
                .status())
        .isEqualTo("ALLOCATED");
    requestAnswer(users.security(), id, "accessControl", "합성 최소 권한 접근 통제");
    SecurityRequestResponse securityDone =
        command(
            users.security(),
            id,
            "reviews/complete",
            new CompleteReview(current(users.security(), id).revision(), "합성 정보보안 검토 완료"));
    assertThat(securityDone.stage()).isEqualTo(2);
    SecurityRequestResponse infraDone =
        command(
            users.infra(),
            id,
            "reviews/complete",
            new CompleteReview(securityDone.revision(), "합성 인프라 협의 완료"));
    assertThat(infraDone.stage()).isEqualTo(3);
    return new Prepared(businessCase.id(), id, document(businessCase, "SECURITY_REVIEW"));
  }

  private BusinessCaseResponse create(MockHttpSession session) throws Exception {
    var result =
        mvc.perform(
                json(
                    post("/api/business-cases"),
                    session,
                    new CreateCase(
                        "합성 시작점 사업 " + UUID.randomUUID(),
                        "합성 부서",
                        "실제 내부 정보 없음",
                        List.of("FIREWALL", "SECURITY_REVIEW"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.createdAt").isString())
            .andExpect(jsonPath("$.updatedAt").isString())
            .andReturn();
    return mapper.readValue(
        result.getResponse().getContentAsByteArray(), BusinessCaseResponse.class);
  }

  private void fillApplicant(MockHttpSession session, UUID caseId) throws Exception {
    caseAnswer(
        session,
        caseId,
        List.of(
            new AnswerInput("purpose", "합성 목적 원본", true, false),
            new AnswerInput("dataTypes", "공개된 합성 안내문", true, false),
            new AnswerInput("externalTransfer", "합성 시연이며 외부 전송 없음", true, false),
            new AnswerInput("dataFlow", "합성 입력을 화면으로 표시", true, false)));
  }

  private void caseAnswer(MockHttpSession session, UUID id, List<AnswerInput> answers)
      throws Exception {
    var result =
        mvc.perform(get("/api/business-cases/" + id).session(session))
            .andExpect(status().isOk())
            .andReturn();
    BusinessCaseResponse current =
        mapper.readValue(result.getResponse().getContentAsByteArray(), BusinessCaseResponse.class);
    mvc.perform(
            json(
                patch("/api/business-cases/" + id + "/answers"),
                session,
                new AnswerPatch(current.revision(), answers)))
        .andExpect(status().isOk());
  }

  private void requestAnswer(MockHttpSession session, UUID id, String key, String value)
      throws Exception {
    mutate(
        session,
        patch(path(id, "answers")),
        new AnswerPatch(
            current(session, id).revision(), List.of(new AnswerInput(key, value, true, false))));
  }

  private SecurityRequestResponse current(MockHttpSession session, UUID id) throws Exception {
    var result =
        mvc.perform(get(path(id, "")).session(session)).andExpect(status().isOk()).andReturn();
    return mapper.readValue(
        result.getResponse().getContentAsByteArray(), SecurityRequestResponse.class);
  }

  private Revision revision(MockHttpSession session, UUID id) throws Exception {
    return new Revision(current(session, id).revision());
  }

  private SecurityRequestResponse command(
      MockHttpSession session, UUID id, String action, Object command) throws Exception {
    return mutate(session, post(path(id, action)), command);
  }

  private SecurityRequestResponse mutate(
      MockHttpSession session, MockHttpServletRequestBuilder builder, Object command)
      throws Exception {
    var result =
        mvc.perform(json(builder, session, command)).andExpect(status().isOk()).andReturn();
    return mapper.readValue(
        result.getResponse().getContentAsByteArray(), SecurityRequestResponse.class);
  }

  private MockHttpServletRequestBuilder json(
      MockHttpServletRequestBuilder builder, MockHttpSession session, Object command)
      throws Exception {
    return builder
        .session(session)
        .with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(mapper.writeValueAsBytes(command));
  }

  private List<AnswerInput> infrastructure() {
    Map<String, String> values =
        Map.of(
            "sourceSystem",
            "합성 출발 시스템",
            "sourceIp",
            "192.0.2.10",
            "destinationSystem",
            "합성 목적 시스템",
            "destinationIp",
            "198.51.100.20",
            "protocol",
            "TCP",
            "port",
            "443",
            "period",
            "2026-11-07~2027-01-31");
    return values.entrySet().stream()
        .map(entry -> new AnswerInput(entry.getKey(), entry.getValue(), true, false))
        .toList();
  }

  private UUID document(BusinessCaseResponse value, String type) {
    return value.requests().stream()
        .filter(request -> request.docType().equals(type))
        .findFirst()
        .orElseThrow()
        .id();
  }

  private AnswerResponse answer(List<AnswerResponse> answers, String key) {
    return answers.stream().filter(answer -> answer.key().equals(key)).findFirst().orElseThrow();
  }

  private String path(UUID id, String action) {
    return "/api/security-requests/" + id + (action.isBlank() ? "" : "/" + action);
  }

  private Sessions sessions() throws Exception {
    return new Sessions(
        login("applicant.demo"), login("infra.demo"), login("security.demo"), login("admin.demo"));
  }

  private record Sessions(
      MockHttpSession applicant,
      MockHttpSession infra,
      MockHttpSession security,
      MockHttpSession admin) {}

  private record Prepared(UUID caseId, UUID requestId, UUID siblingId) {}
}
