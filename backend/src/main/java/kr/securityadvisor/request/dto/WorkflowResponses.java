package kr.securityadvisor.request.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.assignment.dto.AssignmentResponses.AssignmentResponse;
import kr.securityadvisor.common.domain.AnswerValue;
import kr.securityadvisor.common.dto.DeadlineResponse;
import kr.securityadvisor.request.domain.RequestData;
import kr.securityadvisor.review.dto.ReviewResponses.FinalConfirmationResponse;
import kr.securityadvisor.review.dto.ReviewResponses.ReviewResponse;
import kr.securityadvisor.review.dto.ReviewResponses.SupplementResponse;

/** 서버가 결정한 업무 상태와 입력 책임을 전달하는 읽기 전용 계약이다. */
public final class WorkflowResponses {
  private WorkflowResponses() {}

  public record ConfirmationResponse(UUID actorId, String actorName, String role, Instant at) {
    static ConfirmationResponse from(AnswerValue.Confirmation value) {
      return value == null
          ? null
          : new ConfirmationResponse(
              value.actorId(), value.actorName(), value.role().name(), value.at());
    }
  }

  public record AnswerResponse(
      String key,
      String label,
      String scope,
      String ownerRole,
      boolean required,
      String value,
      String source,
      String evidence,
      boolean confirmed,
      boolean notApplicable,
      ConfirmationResponse confirmation) {
    public static AnswerResponse from(AnswerValue answer) {
      return new AnswerResponse(
          answer.key(),
          answer.label(),
          answer.scope().name(),
          answer.ownerRole().name(),
          answer.required(),
          answer.value(),
          answer.source() == null ? null : answer.source().name(),
          answer.evidence(),
          answer.confirmed(),
          answer.notApplicable(),
          ConfirmationResponse.from(answer.confirmation()));
    }
  }

  public record SecurityRequestSummary(
      UUID id,
      UUID caseId,
      String caseTitle,
      String docType,
      int stage,
      String status,
      long revision,
      Instant updatedAt) {}

  public record BusinessCaseResponse(
      UUID id,
      String title,
      String department,
      String description,
      UUID institutionId,
      UUID ownerId,
      String ownerName,
      long revision,
      long publicationVersion,
      List<AnswerResponse> answers,
      List<SecurityRequestSummary> requests,
      Instant createdAt,
      Instant updatedAt) {}

  public record StageReturnResponse(
      UUID id,
      int fromStage,
      int targetStage,
      List<String> fieldKeys,
      String reason,
      String actorName,
      Instant createdAt) {
    public static StageReturnResponse from(RequestData.StageReturn value) {
      return new StageReturnResponse(
          value.id(),
          value.fromStage(),
          value.targetStage(),
          value.fieldKeys(),
          value.reason(),
          value.actorName(),
          value.createdAt());
    }
  }

  public record SubmissionResponse(
      UUID id, int number, long requestRevision, long caseRevision, Instant createdAt) {}

  public record SecurityRequestResponse(
      UUID id,
      UUID caseId,
      String caseTitle,
      String docType,
      UUID ownerId,
      String ownerName,
      int stage,
      String status,
      long revision,
      long caseRevision,
      long publicationVersion,
      List<AnswerResponse> commonAnswers,
      List<AnswerResponse> answers,
      List<ReviewResponse> reviews,
      List<AssignmentResponse> assignments,
      List<SupplementResponse> supplements,
      List<StageReturnResponse> returns,
      List<DeadlineResponse> deadlines,
      List<SubmissionResponse> submissions,
      List<FinalConfirmationResponse> finalConfirmations,
      UUID currentSubmissionId,
      List<String> changedCommonFields,
      List<String> highlightedFields,
      List<String> blockers,
      List<String> allowedActions,
      Instant createdAt,
      Instant updatedAt) {}

  public record DocumentResponse(String filename, String content) {}
}
