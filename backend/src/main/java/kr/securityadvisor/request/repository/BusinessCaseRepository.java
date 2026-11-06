package kr.securityadvisor.request.repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.securityadvisor.request.domain.BusinessCase;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 공통값과 제출이 경합할 때 항상 사업 건을 먼저 잠근다. */
public interface BusinessCaseRepository extends JpaRepository<BusinessCase, UUID> {
  List<BusinessCase> findByInstitutionIdOrderByUpdatedAtDesc(UUID institutionId, Pageable pageable);

  List<BusinessCase> findByInstitutionIdAndOwnerIdOrderByUpdatedAtDesc(
      UUID institutionId, UUID ownerId, Pageable pageable);

  Optional<BusinessCase> findByIdAndInstitutionId(UUID id, UUID institutionId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select c from BusinessCase c where c.id = :id and c.institutionId = :institutionId")
  Optional<BusinessCase> lockByIdAndInstitutionId(
      @Param("id") UUID id, @Param("institutionId") UUID institutionId);
}
