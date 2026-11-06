package kr.securityadvisor.llm.repository;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.llm.domain.LlmConfiguration;
import org.springframework.data.jpa.repository.JpaRepository;

/** 기관 범위 내 모델 연결만 조회한다. */
public interface LlmConfigurationRepository extends JpaRepository<LlmConfiguration, UUID> {
  List<LlmConfiguration> findByInstitutionIdOrderByCreatedAtDesc(UUID institutionId);
}
