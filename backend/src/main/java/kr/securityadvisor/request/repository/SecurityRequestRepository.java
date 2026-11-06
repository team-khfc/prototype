package kr.securityadvisor.request.repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.securityadvisor.request.domain.SecurityRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 모든 업무 접근은 기관 식별자를 쿼리에 포함한다. */
public interface SecurityRequestRepository extends JpaRepository<SecurityRequest, UUID> {
  List<SecurityRequest> findByInstitutionIdOrderByUpdatedAtDesc(
      UUID institutionId, Pageable pageable);

  List<SecurityRequest> findByInstitutionIdAndOwnerIdOrderByUpdatedAtDesc(
      UUID institutionId, UUID ownerId, Pageable pageable);

  List<SecurityRequest> findByCaseIdAndInstitutionIdOrderById(UUID caseId, UUID institutionId);

  Optional<SecurityRequest> findByIdAndInstitutionId(UUID id, UUID institutionId);

  @Query(
      "select r.caseId from SecurityRequest r where r.id = :id and r.institutionId = :institutionId")
  Optional<UUID> findCaseId(@Param("id") UUID id, @Param("institutionId") UUID institutionId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select r from SecurityRequest r where r.id = :id and r.institutionId = :institutionId")
  Optional<SecurityRequest> lockByIdAndInstitutionId(
      @Param("id") UUID id, @Param("institutionId") UUID institutionId);
}
