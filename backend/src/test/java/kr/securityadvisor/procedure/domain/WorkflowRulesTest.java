package kr.securityadvisor.procedure.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.common.model.ModelConnection;
import kr.securityadvisor.common.model.OrganizationPolicy;
import kr.securityadvisor.common.security.Role;
import org.junit.jupiter.api.Test;

class WorkflowRulesTest {
  private static final Instant NOW = Instant.parse("2026-11-06T00:00:00Z");

  @Test
  void requiresBothOriginalSourceAndHumanConfirmationEvenWhenStatusLooksConfirmed() {
    ProcedureData.Answer answer =
        answer(
            "purpose",
            "설명",
            "CONSULT",
            Role.APPLICANT,
            ProcedureData.AnswerStatus.CONFIRMED,
            null,
            confirmation());
    assertThat(WorkflowRules.resolved(answer)).isFalse();
    assertThat(
            WorkflowRules.resolved(
                answer(
                    "purpose",
                    "설명",
                    "CONSULT",
                    Role.APPLICANT,
                    ProcedureData.AnswerStatus.CONFIRMED,
                    source(),
                    null)))
        .isFalse();
    assertThat(
            WorkflowRules.resolved(
                answer(
                    "purpose",
                    "설명",
                    "CONSULT",
                    Role.APPLICANT,
                    ProcedureData.AnswerStatus.PROPOSED,
                    source(),
                    confirmation())))
        .isFalse();
  }

  @Test
  void unknownExternalTransferIsNeverResolved() {
    assertThat(
            WorkflowRules.resolved(
                answer(
                    "externalTransfer",
                    "UNKNOWN",
                    "SUBMIT",
                    Role.APPLICANT,
                    ProcedureData.AnswerStatus.CONFIRMED,
                    source(),
                    confirmation())))
        .isFalse();
  }

  @Test
  void emptyOptionalIsAllowedButWrittenUnconfirmedOptionalBlocksSubmission() {
    Procedure empty =
        collaborating(
            "PARALLEL",
            List.of(
                answer(
                    "optional",
                    "",
                    "OPTIONAL",
                    Role.SECURITY,
                    ProcedureData.AnswerStatus.EMPTY,
                    null,
                    null)),
            List.of(),
            List.of());
    assertThat(WorkflowRules.submissionBlockers(empty)).isEmpty();
    Procedure proposed =
        collaborating(
            "PARALLEL",
            List.of(
                answer(
                    "optional",
                    "미확정 방안",
                    "OPTIONAL",
                    Role.SECURITY,
                    ProcedureData.AnswerStatus.PROPOSED,
                    source(),
                    null)),
            List.of(),
            List.of());
    assertThat(WorkflowRules.submissionBlockers(proposed))
        .anyMatch(value -> value.contains("optional"));
  }

  @Test
  void answeredSupplementStillRequiresTheRequestingSpecialistResolution() {
    ProcedureData.Supplement supplement =
        new ProcedureData.Supplement(
            UUID.randomUUID(), "확인 질문", "답변", Role.SECURITY, "합성 담당자", "ANSWERED", NOW, null);
    Procedure procedure = collaborating("PARALLEL", List.of(), List.of(), List.of(supplement));
    assertThat(WorkflowRules.submissionBlockers(procedure)).anyMatch(value -> value.contains("보완"));
    assertThat(WorkflowRules.reviewBlockers(procedure, Role.SECURITY))
        .anyMatch(value -> value.contains("보완"));
  }

  @Test
  void sequentialInfraReviewRequiresCurrentSecurityReview() {
    Procedure procedure = withRequiredReviews("SEQUENTIAL");
    assertThat(WorkflowRules.reviewBlockers(procedure, Role.SECURITY)).isEmpty();
    assertThat(WorkflowRules.reviewBlockers(procedure, Role.INFRA))
        .anyMatch(value -> value.contains("순차"));
    procedure.recordProgress(
        new ProcedureData(
            List.of(),
            List.of(),
            List.of(
                new ProcedureData.Review(
                    Role.SECURITY, "COMPLETE", procedure.getRevision(), "", "합성 담당자", NOW)),
            List.of(),
            List.of()));
    assertThat(WorkflowRules.reviewBlockers(procedure, Role.INFRA)).isEmpty();
    procedure.replaceContent(procedure.getData());
    assertThat(WorkflowRules.reviewBlockers(procedure, Role.INFRA))
        .anyMatch(value -> value.contains("순차"));
  }

  @Test
  void parallelReviewDoesNotRequireEitherRoleToReviewFirst() {
    assertThat(WorkflowRules.reviewBlockers(withRequiredReviews("PARALLEL"), Role.SECURITY))
        .isEmpty();
    assertThat(WorkflowRules.reviewBlockers(withRequiredReviews("PARALLEL"), Role.INFRA)).isEmpty();
  }

  @Test
  void contentChangePreservesOldReviewEvidenceButInvalidatesItsApproval() {
    List<ProcedureData.Review> invalidated =
        WorkflowRules.invalidateReviews(
            List.of(new ProcedureData.Review(Role.INFRA, "COMPLETE", 3L, "이전 확인", "합성 담당자", NOW)));
    assertThat(invalidated.getFirst().status()).isEqualTo("INVALIDATED");
    assertThat(invalidated.getFirst().revision()).isEqualTo(3L);
    assertThat(invalidated.getFirst().comment()).isEqualTo("이전 확인");
    assertThat(invalidated.getFirst().at()).isEqualTo(NOW);
  }

  private Procedure withRequiredReviews(String mode) {
    OrganizationPolicy policy =
        new OrganizationPolicy(
            "가상기관",
            mode,
            true,
            true,
            List.of(),
            "합성 문서",
            new ModelConnection("EXAMPLE", "", "extractive-demo", "", 0.2, 1000, 30));
    Procedure procedure =
        new Procedure(
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            "합성 작성자",
            "합성 신청",
            DocumentType.SECURITY_REVIEW,
            "가상 부서",
            "합성 개요",
            1,
            policy,
            new ProcedureData(List.of(), List.of(), List.of(), List.of(), List.of()));
    procedure.openConsultation(procedure.getData());
    return procedure;
  }

  private Procedure collaborating(
      String mode,
      List<ProcedureData.Answer> answers,
      List<ProcedureData.Review> reviews,
      List<ProcedureData.Supplement> supplements) {
    OrganizationPolicy policy =
        new OrganizationPolicy(
            "가상기관",
            mode,
            false,
            false,
            List.of(),
            "합성 문서",
            new ModelConnection("EXAMPLE", "", "extractive-demo", "", 0.2, 1000, 30));
    Procedure procedure =
        new Procedure(
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            "합성 작성자",
            "합성 신청",
            DocumentType.SECURITY_REVIEW,
            "가상 부서",
            "합성 개요",
            1,
            policy,
            new ProcedureData(answers, List.of(), reviews, supplements, List.of()));
    procedure.openConsultation(procedure.getData());
    return procedure;
  }

  private ProcedureData.Answer answer(
      String key,
      String value,
      String required,
      Role role,
      ProcedureData.AnswerStatus status,
      ProcedureData.Source source,
      ProcedureData.Confirmation confirmation) {
    return new ProcedureData.Answer(
        key, key, "합성 질문의 이유", role, required, value, status, source, confirmation);
  }

  private ProcedureData.Source source() {
    return new ProcedureData.Source(
        ProcedureData.SourceKind.AI_INFERENCE, "합성 문서 근거", "AI 제안", NOW);
  }

  private ProcedureData.Confirmation confirmation() {
    return new ProcedureData.Confirmation("합성 작성자", Role.APPLICANT, NOW);
  }
}
