package kr.securityadvisor.request.service;

import java.util.UUID;
import kr.securityadvisor.assignment.service.AssignmentOperations;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import org.springframework.stereotype.Component;

/** 목록·상세·다운로드에 같은 기관 및 소유·배정 규칙을 적용한다. */
@Component
public class WorkflowAccess {
  private final AssignmentOperations assignments;

  public WorkflowAccess(AssignmentOperations assignments) {
    this.assignments = assignments;
  }

  public boolean canReadCase(Actor actor, UUID institutionId, UUID ownerId, UUID caseId) {
    return actor.institutionId().equals(institutionId)
        && (actor.role() == Role.ADMIN
            || actor.userId().equals(ownerId)
            || assignments.isAssignedToCase(actor, caseId));
  }

  public boolean canReadRequest(Actor actor, UUID institutionId, UUID ownerId, UUID requestId) {
    return actor.institutionId().equals(institutionId)
        && (actor.role() == Role.ADMIN
            || actor.userId().equals(ownerId)
            || assignments.isAssigned(actor, requestId));
  }

  public void requireOwner(Actor actor, UUID ownerId) {
    if (actor.role() != Role.APPLICANT || !actor.userId().equals(ownerId)) {
      throw new DomainException(403, "APPLICANT_OWNER_REQUIRED", "신청자 본인만 처리할 수 있습니다.");
    }
  }

  public void requireRead(boolean allowed) {
    if (!allowed) throw new DomainException(404, "REQUEST_NOT_FOUND", "접근 가능한 신청을 찾을 수 없습니다.");
  }
}
