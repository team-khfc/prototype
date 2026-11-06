package kr.securityadvisor.request.repository;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.request.domain.CaseAnalysisJob;
import org.springframework.data.jpa.repository.JpaRepository;

/** 분석 결과는 소유 사업 건과 기관 권한을 확인한 뒤 조회한다. */
public interface CaseAnalysisJobRepository extends JpaRepository<CaseAnalysisJob, UUID> {
  List<CaseAnalysisJob> findTop20ByCaseIdOrderByCreatedAtDesc(UUID caseId);
}
