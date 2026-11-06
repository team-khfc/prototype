package kr.securityadvisor.assignment.service;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.assignment.dto.AssignmentResponses.AssignmentResponse;
import kr.securityadvisor.assignment.dto.AssignmentResponses.ReviewerPoolResponse;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;

/** 신청 서비스에 배정 엔티티 대신 권한 판단과 배정 명령을 제공한다. */
public interface AssignmentOperations {
  void assignDefaults(UUID institutionId, UUID caseId, UUID requestId, UUID applicantId);

  boolean isAssigned(Actor actor, UUID requestId);

  boolean isAssignedToCase(Actor actor, UUID caseId);

  boolean hasAssigned(UUID institutionId, UUID requestId, Role field);

  void requireAssigned(Actor actor, UUID requestId);

  void reassign(
      Actor actor,
      UUID caseId,
      UUID requestId,
      UUID applicantId,
      Role field,
      UUID assigneeId,
      String reason);

  List<AssignmentResponse> list(UUID institutionId, UUID requestId);

  List<ReviewerPoolResponse> reviewers(Actor actor);
}
