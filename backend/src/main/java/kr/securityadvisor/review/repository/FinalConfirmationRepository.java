package kr.securityadvisor.review.repository;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.common.security.Role;
import kr.securityadvisor.review.domain.FinalConfirmation;
import org.springframework.data.jpa.repository.JpaRepository;

/** DB 유일 제약과 불변 트리거가 제출본별 확인 기록을 보호한다. */
public interface FinalConfirmationRepository extends JpaRepository<FinalConfirmation, UUID> {
  List<FinalConfirmation> findByRequestIdAndInstitutionIdOrderByConfirmedAt(
      UUID requestId, UUID institutionId);

  boolean existsBySubmissionIdAndInstitutionIdAndField(
      UUID submissionId, UUID institutionId, Role field);
}
