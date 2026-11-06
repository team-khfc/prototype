package kr.securityadvisor.request.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import kr.securityadvisor.assignment.domain.Assignment;
import kr.securityadvisor.common.domain.AnswerValue;
import kr.securityadvisor.common.domain.BusinessCalendar;
import kr.securityadvisor.common.domain.Deadline;
import kr.securityadvisor.common.domain.ReviewReadiness;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import kr.securityadvisor.review.domain.Review;
import org.junit.jupiter.api.Test;

class WorkflowDomainTest {
  private final UUID institutionId = UUID.randomUUID();
  private final Actor applicant = actor(Role.APPLICANT);
  private final Actor infra = actor(Role.INFRA);
  private final Actor security = actor(Role.SECURITY);

  @Test
  void aiValuesNeedHumanConfirmationAndCannotOverwriteConfirmedValues() {
    AnswerValue value = SeedQuestions.common().getFirst().propose("합성 사업 설명", "합성 문서 1절");
    assertThat(value.source()).isEqualTo(AnswerValue.Source.AI_INFERRED);
    assertThat(value.ready()).isFalse();
    AnswerValue confirmed = value.answer(security, value.value(), true, false);
    assertThat(confirmed.source()).isEqualTo(AnswerValue.Source.STAFF_CONFIRMED);
    assertThat(confirmed.evidence()).isEqualTo("합성 문서 1절");
    assertThat(confirmed.confirmation().actorId()).isEqualTo(security.userId());
    assertThat(confirmed.ready()).isTrue();
    assertThatThrownBy(() -> confirmed.propose("새 추정", "다른 근거"))
        .isInstanceOf(DomainException.class);
    assertThatThrownBy(() -> SeedQuestions.common().get(5).propose("192.0.2.15", "추측"))
        .isInstanceOf(DomainException.class);
  }

  @Test
  void allocationDoesNotCompleteEitherReviewAndSecurityMayFinishBeforeInfraReview() {
    Review infraReview = new Review(institutionId, UUID.randomUUID(), Role.INFRA);
    Review securityReview = new Review(institutionId, UUID.randomUUID(), Role.SECURITY);
    assertThatThrownBy(() -> securityReview.complete(security, "확인", false, true))
        .isInstanceOf(DomainException.class);
    infraReview.completeAllocation();
    assertThat(infraReview.getStatus()).isEqualTo("ALLOCATED");
    securityReview.complete(security, "합성 보안 확인", infraReview.isAllocationCompleted(), true);
    assertThat(securityReview.getStatus()).isEqualTo("COMPLETE");
    assertThat(infraReview.getStatus()).isEqualTo("ALLOCATED");
    SecurityRequest request = request();
    request.requestReview();
    request.recordReviewProgress(new ReviewReadiness(true, false, true, false));
    assertThat(request.getStage()).isEqualTo(2);
    request.recordReviewProgress(new ReviewReadiness(true, true, true, false));
    assertThat(request.getStage()).isEqualTo(3);
  }

  @Test
  void returnPreservesAnswersAndHistoryAndRequiresAllowedPairAndReason() {
    SecurityRequest request = request();
    List<AnswerValue> answered =
        request.getAnswers().stream()
            .map(
                answer ->
                    answer.ownerRole() == Role.APPLICANT
                        ? answer.answer(applicant, "합성 연결 목적", true, false)
                        : answer)
            .toList();
    request.answer(answered);
    request.requestReview();
    assertThatThrownBy(() -> request.returnToStage(1, List.of("connectionPurpose"), "", "담당자"))
        .isInstanceOf(DomainException.class);
    assertThatThrownBy(() -> request.returnToStage(3, List.of("connectionPurpose"), "검토", "담당자"))
        .isInstanceOf(DomainException.class);
    request.returnToStage(1, List.of("connectionPurpose"), "설명 보완", "합성 담당자");
    assertThat(request.getAnswers()).isEqualTo(answered);
    assertThat(request.getData().highlightedFields()).containsExactly("connectionPurpose");
    assertThat(request.getData().returns()).hasSize(1);
    assertThat(request.getStatus()).isEqualTo(RequestStatus.DRAFT);
  }

  @Test
  void answerCommandCannotAlterPublishedResponsibilityOrRequiredFlag() {
    BusinessCase businessCase =
        new BusinessCase(UUID.randomUUID(), applicant, "합성 사업", "합성 부서", "", 1);
    List<AnswerValue> altered = new java.util.ArrayList<>(businessCase.getAnswers());
    AnswerValue original = altered.getFirst();
    altered.set(
        0,
        AnswerValue.empty(original.key(), original.label(), original.scope(), Role.ADMIN, false));
    assertThatThrownBy(() -> businessCase.answer(altered)).isInstanceOf(DomainException.class);
    assertThat(businessCase.getRevision()).isZero();
  }

  @Test
  void finalizationRequiresSecurityAndTheExactSubmittedVersion() {
    SecurityRequest request = request();
    request.answer(
        request.getAnswers().stream()
            .map(
                answer ->
                    answer.answer(
                        answer.ownerRole() == Role.APPLICANT ? applicant : security,
                        "합성 확인",
                        true,
                        false))
            .toList());
    List<AnswerValue> common =
        SeedQuestions.common().stream()
            .map(
                answer ->
                    answer.answer(
                        answer.ownerRole() == Role.APPLICANT ? applicant : infra,
                        "합성 확인",
                        true,
                        false))
            .toList();
    request.requestReview();
    request.recordReviewProgress(new ReviewReadiness(true, true, true, false));
    UUID submission = UUID.randomUUID();
    request.submit(submission, common, new ReviewReadiness(true, true, true, false));
    assertThatThrownBy(() -> request.finalizeRequest(submission, Role.INFRA, true))
        .isInstanceOf(DomainException.class);
    assertThatThrownBy(() -> request.finalizeRequest(UUID.randomUUID(), Role.SECURITY, true))
        .isInstanceOf(DomainException.class);
    assertThatThrownBy(() -> request.finalizeRequest(submission, Role.SECURITY, false))
        .isInstanceOf(DomainException.class);
    request.finalizeRequest(submission, Role.SECURITY, true);
    assertThat(request.getStatus()).isEqualTo(RequestStatus.FINALIZED);
    assertThatThrownBy(() -> request.withdraw("변경", null)).isInstanceOf(DomainException.class);
  }

  @Test
  void businessCalendarSkipsWeekendAndPublishedHolidayWithoutChangingWorkflow() {
    Instant friday = Instant.parse("2026-11-06T03:00:00Z");
    Set<LocalDate> holidays = Set.of(LocalDate.of(2026, 11, 9));
    assertThat(BusinessCalendar.deadline(friday, 2, holidays))
        .isEqualTo(Instant.parse("2026-11-11T14:59:59Z"));
    Deadline deadline =
        new Deadline(
            institutionId, UUID.randomUUID(), Role.INFRA, "CONSULTATION", 2, holidays, 7, friday);
    SecurityRequest request = request();
    request.requestReview();
    assertThat(deadline.timing(Instant.parse("2026-11-12T00:00:00Z"))).isEqualTo("OVERDUE");
    assertThat(deadline.getDueAt()).isEqualTo(Instant.parse("2026-11-11T14:59:59Z"));
    assertThat(request.getStatus()).isEqualTo(RequestStatus.CONSULTING);
  }

  @Test
  void applicantCannotBeAssignedToReviewOwnRequest() {
    assertThatThrownBy(
            () ->
                new Assignment(
                    institutionId,
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    applicant.userId(),
                    Role.INFRA,
                    applicant.userId(),
                    "합성 담당자",
                    "배정"))
        .isInstanceOf(DomainException.class);
  }

  private SecurityRequest request() {
    return new SecurityRequest(
        UUID.randomUUID(), UUID.randomUUID(), institutionId, applicant.userId(), DocType.FIREWALL);
  }

  private Actor actor(Role role) {
    return new Actor(UUID.randomUUID(), institutionId, "synthetic-" + role, "합성 " + role, role);
  }
}
