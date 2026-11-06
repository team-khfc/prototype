package kr.securityadvisor.audit.repository;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.audit.domain.AuditEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

/** 삭제·수정 저장소 API를 노출하지 않는다. */
public interface AuditEventRepository extends Repository<AuditEvent, UUID> {
  AuditEvent save(AuditEvent event);

  List<AuditEvent> findByInstitutionIdOrderByCreatedAtDesc(UUID institutionId, Pageable pageable);

  List<AuditEvent> findByInstitutionIdAndTargetTypeAndTargetIdOrderByCreatedAtDesc(
      UUID institutionId, String targetType, UUID targetId, Pageable pageable);
}
