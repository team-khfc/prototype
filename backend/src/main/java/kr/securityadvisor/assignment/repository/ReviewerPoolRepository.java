package kr.securityadvisor.assignment.repository;

import java.util.Optional;
import java.util.UUID;
import kr.securityadvisor.assignment.domain.ReviewerPool;
import kr.securityadvisor.common.security.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 기본 담당자 관리 화면은 후속 범위이며 seed 지정은 DB에 보존한다. */
public interface ReviewerPoolRepository extends JpaRepository<ReviewerPool, UUID> {
  Optional<ReviewerPool> findByInstitutionIdAndField(UUID institutionId, Role field);

  @Modifying
  @Query(
      value =
          """
      INSERT INTO reviewer_pools (id, institution_id, field, reviewer_id, created_at, updated_at)
      VALUES (:id, :institutionId, :field, :reviewerId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (institution_id, field) DO NOTHING
      """,
      nativeQuery = true)
  void initializeDefault(
      @Param("id") UUID id,
      @Param("institutionId") UUID institutionId,
      @Param("field") String field,
      @Param("reviewerId") UUID reviewerId);
}
