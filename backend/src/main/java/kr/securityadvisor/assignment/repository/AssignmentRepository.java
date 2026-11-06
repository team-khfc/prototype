package kr.securityadvisor.assignment.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.securityadvisor.assignment.domain.Assignment;
import kr.securityadvisor.common.security.Role;
import org.springframework.data.jpa.repository.JpaRepository;

/** 활성 배정의 분야별 유일성은 DB 부분 유일 제약으로도 검사한다. */
public interface AssignmentRepository extends JpaRepository<Assignment, UUID> {
  List<Assignment> findByInstitutionIdAndRequestIdOrderByAssignedAt(
      UUID institutionId, UUID requestId);

  Optional<Assignment> findByInstitutionIdAndRequestIdAndFieldAndActiveTrue(
      UUID institutionId, UUID requestId, Role field);

  List<Assignment> findByInstitutionIdAndCaseIdAndFieldAndActiveTrueOrderByAssignedAt(
      UUID institutionId, UUID caseId, Role field);

  boolean existsByInstitutionIdAndCaseIdAndAssigneeIdAndActiveTrue(
      UUID institutionId, UUID caseId, UUID assigneeId);
}
