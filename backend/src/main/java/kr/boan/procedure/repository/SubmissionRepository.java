package kr.boan.procedure.repository;

import java.util.Optional;
import java.util.UUID;
import kr.boan.procedure.domain.Submission;
import org.springframework.data.jpa.repository.JpaRepository;

/** 제출본과 멱등성 키는 기관·작성자 범위로 조회한다. */
public interface SubmissionRepository extends JpaRepository<Submission, UUID> {
  Optional<Submission> findByProcedureIdAndInstitutionId(UUID procedureId, UUID institutionId);

  Optional<Submission> findByInstitutionIdAndOwnerIdAndIdempotencyKey(
      UUID institutionId, UUID ownerId, String idempotencyKey);
}
