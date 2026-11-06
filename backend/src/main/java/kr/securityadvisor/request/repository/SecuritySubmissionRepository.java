package kr.securityadvisor.request.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.securityadvisor.request.domain.SecuritySubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 제출본은 새 행만 생성하며 DB가 수정과 삭제를 거부한다. */
public interface SecuritySubmissionRepository extends JpaRepository<SecuritySubmission, UUID> {
  @Query(
      value = "SELECT CAST(pg_advisory_xact_lock(hashtextextended(:scope, 0)) AS text)",
      nativeQuery = true)
  String lockIdempotencyKey(@Param("scope") String scope);

  List<SecuritySubmission> findByRequestIdAndInstitutionIdOrderByNumber(
      UUID requestId, UUID institutionId);

  Optional<SecuritySubmission> findByInstitutionIdAndOwnerIdAndIdempotencyKey(
      UUID institutionId, UUID ownerId, String idempotencyKey);

  Optional<SecuritySubmission> findByIdAndInstitutionId(UUID id, UUID institutionId);
}
