package kr.securityadvisor.analysis.service;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.analysis.domain.AnalysisJob;
import kr.securityadvisor.analysis.domain.AnalysisSuggestion;
import kr.securityadvisor.analysis.repository.AnalysisJobRepository;
import kr.securityadvisor.common.model.ModelConnection;
import kr.securityadvisor.common.security.Actor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 네트워크 호출 밖에서 짧은 독립 트랜잭션으로 분석 진행·종료 이력을 남긴다. */
@Service
@Transactional(readOnly = true)
public class AnalysisJobStore {
  private final AnalysisJobRepository jobs;

  public AnalysisJobStore(AnalysisJobRepository jobs) {
    this.jobs = jobs;
  }

  /** 모델 호출 전에 진행 상태와 입력 버전을 확실히 저장한다. */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public AnalysisJob start(
      Actor actor, UUID procedureId, long revision, ModelConnection model, List<String> objects) {
    return jobs.saveAndFlush(
        new AnalysisJob(
            procedureId,
            actor.institutionId(),
            actor.userId(),
            revision,
            model.provider(),
            model.model(),
            model.timeoutSeconds(),
            objects));
  }

  /** 실행이 끝나면 검증한 제안만 저장한다. */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public AnalysisJob succeed(UUID id, UUID institutionId, List<AnalysisSuggestion> suggestions) {
    AnalysisJob job = jobs.lockByIdAndInstitutionId(id, institutionId).orElseThrow();
    if ("RUNNING".equals(job.getStatus())) {
      job.succeed(suggestions);
      jobs.flush();
    }
    return job;
  }

  /** 오류 본문 대신 서비스가 정한 안전한 실패 설명을 저장한다. */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void fail(UUID id, UUID institutionId, String message) {
    AnalysisJob job = jobs.lockByIdAndInstitutionId(id, institutionId).orElseThrow();
    if ("RUNNING".equals(job.getStatus())) {
      job.fail(message);
      jobs.flush();
    }
  }
}
