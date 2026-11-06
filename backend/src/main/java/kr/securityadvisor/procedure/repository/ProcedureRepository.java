package kr.securityadvisor.procedure.repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.securityadvisor.procedure.domain.Procedure;
import kr.securityadvisor.procedure.domain.ProcedureStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 조회와 잠금 모두 기관 조건을 포함하여 다른 기관의 행을 먼저 가져오지 않는다. */
public interface ProcedureRepository extends JpaRepository<Procedure, UUID> {
  List<Procedure> findByInstitutionIdAndOwnerIdOrderByUpdatedAtDesc(
      UUID institutionId, UUID ownerId, Pageable pageable);

  List<Procedure> findByInstitutionIdAndStatusNotOrderByUpdatedAtDesc(
      UUID institutionId, ProcedureStatus status, Pageable pageable);

  Optional<Procedure> findByIdAndInstitutionId(UUID id, UUID institutionId);

  boolean existsByInstitutionIdAndOwnerId(UUID institutionId, UUID ownerId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select p from Procedure p where p.id = :id and p.institutionId = :institutionId")
  Optional<Procedure> lockByIdAndInstitutionId(
      @Param("id") UUID id, @Param("institutionId") UUID institutionId);
}
