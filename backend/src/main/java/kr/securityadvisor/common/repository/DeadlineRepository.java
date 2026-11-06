package kr.securityadvisor.common.repository;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.common.domain.Deadline;
import org.springframework.data.jpa.repository.JpaRepository;

/** 기한 경과는 조회 계산이며 저장 상태를 자동으로 변경하지 않는다. */
public interface DeadlineRepository extends JpaRepository<Deadline, UUID> {
  List<Deadline> findByInstitutionIdAndRequestIdOrderByCreatedAt(
      UUID institutionId, UUID requestId);
}
