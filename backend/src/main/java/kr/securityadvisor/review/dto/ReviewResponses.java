package kr.securityadvisor.review.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.review.domain.FinalConfirmation;
import kr.securityadvisor.review.domain.Review;

/** 협의 컨텍스트의 공개 결과만 불변 DTO로 반환한다. */
public final class ReviewResponses {
  private ReviewResponses() {}

  public record ReviewResponse(
      UUID id,
      String field,
      String status,
      boolean allocationCompleted,
      String comment,
      String completedBy,
      Instant completedAt) {
    public static ReviewResponse from(Review value) {
      return new ReviewResponse(
          value.getId(),
          value.getField().name(),
          value.getStatus(),
          value.isAllocationCompleted(),
          value.getComment(),
          value.getCompletedBy(),
          value.getCompletedAt());
    }
  }

  public record SupplementResponse(
      UUID id,
      String field,
      List<String> fieldKeys,
      String reason,
      String answer,
      String status,
      String requestedBy,
      Instant createdAt,
      Instant resolvedAt) {
    public static SupplementResponse from(Review.Supplement value) {
      return new SupplementResponse(
          value.id(),
          value.field().name(),
          value.fieldKeys(),
          value.reason(),
          value.answer(),
          value.status(),
          value.requestedBy(),
          value.createdAt(),
          value.resolvedAt());
    }
  }

  public record FinalConfirmationResponse(
      UUID id, UUID submissionId, String field, String actorName, Instant confirmedAt) {
    public static FinalConfirmationResponse from(FinalConfirmation value) {
      return new FinalConfirmationResponse(
          value.getId(),
          value.getSubmissionId(),
          value.getField().name(),
          value.getActorName(),
          value.getConfirmedAt());
    }
  }
}
