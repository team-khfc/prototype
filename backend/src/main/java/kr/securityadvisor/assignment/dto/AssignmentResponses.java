package kr.securityadvisor.assignment.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.assignment.domain.Assignment;

/** 계정 비밀정보 없이 배정 및 선택 가능한 담당자만 반환한다. */
public final class AssignmentResponses {
  private AssignmentResponses() {}

  public record AssignmentResponse(
      UUID id,
      String field,
      UUID assigneeId,
      String assigneeName,
      boolean active,
      String reason,
      Instant assignedAt) {
    public static AssignmentResponse from(Assignment assignment) {
      return new AssignmentResponse(
          assignment.getId(),
          assignment.getField().name(),
          assignment.getAssigneeId(),
          assignment.getAssigneeName(),
          assignment.isActive(),
          assignment.getReason(),
          assignment.getAssignedAt());
    }
  }

  public record ReviewerResponse(UUID userId, String displayName, String role) {}

  public record ReviewerPoolResponse(
      String field, List<ReviewerResponse> reviewers, UUID defaultReviewerId) {}
}
