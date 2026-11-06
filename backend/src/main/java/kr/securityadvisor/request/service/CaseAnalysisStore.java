package kr.securityadvisor.request.service;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.audit.service.AuditTrail;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.model.ModelConnection;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.request.domain.CaseAnalysisJob;
import kr.securityadvisor.request.dto.CaseAnalysisResponse;
import kr.securityadvisor.request.repository.CaseAnalysisJobRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 외부 모델 대기 동안 DB 트랜잭션을 잡지 않도록 분석 저장 경계를 분리한다. */
@Service
@Transactional(readOnly = true)
public class CaseAnalysisStore {
  private final CaseAnalysisJobRepository jobs;
  private final AuditTrail audit;

  public CaseAnalysisStore(CaseAnalysisJobRepository jobs, AuditTrail audit) {
    this.jobs = jobs;
    this.audit = audit;
  }

  /** 사용자가 명시적으로 전송한 원본 객체와 현재 수정본을 연결한다. */
  @Transactional
  public CaseAnalysisResponse start(
      Actor actor,
      UUID caseId,
      long revision,
      ModelConnection connection,
      UUID configurationId,
      List<String> objects,
      String requestId) {
    CaseAnalysisJob job =
        jobs.saveAndFlush(
            new CaseAnalysisJob(
                actor,
                caseId,
                revision,
                connection.provider(),
                connection.model(),
                configurationId,
                objects));
    audit.record(
        actor,
        "BUSINESS_CASE",
        caseId,
        revision,
        "ANALYSIS_STARTED",
        "명시적 분석 요청",
        List.of("analysisJob"),
        requestId);
    return CaseAnalysisResponse.from(job);
  }

  /** 결과와 감사 이력을 함께 저장하며 원문 전체는 감사에 남기지 않는다. */
  @Transactional
  public CaseAnalysisResponse complete(
      Actor actor,
      UUID caseId,
      UUID id,
      List<CaseAnalysisJob.Candidate> candidates,
      boolean stale,
      String requestId) {
    CaseAnalysisJob job = owned(actor, caseId, id);
    job.complete(candidates);
    if (stale) job.markStale();
    audit.record(
        actor,
        "BUSINESS_CASE",
        caseId,
        job.getRevision(),
        stale ? "ANALYSIS_STALE" : "ANALYSIS_COMPLETED",
        "후보 생성: 확정 아님",
        candidates.stream().map(CaseAnalysisJob.Candidate::key).toList(),
        requestId);
    return CaseAnalysisResponse.from(job);
  }

  /** 실패는 별도 트랜잭션에 남겨 오류 응답 뒤에도 재시도 원인을 확인할 수 있다. */
  @Transactional
  public void fail(Actor actor, UUID caseId, UUID id, String message, String requestId) {
    CaseAnalysisJob job = owned(actor, caseId, id);
    job.fail(message);
    audit.record(
        actor,
        "BUSINESS_CASE",
        caseId,
        job.getRevision(),
        "ANALYSIS_FAILED",
        "분석 실패: 재시도 또는 직접 입력 필요",
        List.of("analysisJob"),
        requestId);
  }

  /** 다른 기관·소유자의 분석 식별자로 후보를 가져올 수 없다. */
  public CaseAnalysisResponse get(Actor actor, UUID caseId, UUID id) {
    return CaseAnalysisResponse.from(owned(actor, caseId, id));
  }

  /** 신청자 자신의 최근 분석 작업만 조회한다. */
  public List<CaseAnalysisResponse> list(Actor actor, UUID caseId) {
    return jobs.findTop20ByCaseIdOrderByCreatedAtDesc(caseId).stream()
        .filter(
            job ->
                job.getInstitutionId().equals(actor.institutionId())
                    && job.getOwnerId().equals(actor.userId()))
        .map(CaseAnalysisResponse::from)
        .toList();
  }

  private CaseAnalysisJob owned(Actor actor, UUID caseId, UUID id) {
    return jobs.findById(id)
        .filter(
            job ->
                job.getCaseId().equals(caseId)
                    && job.getInstitutionId().equals(actor.institutionId())
                    && job.getOwnerId().equals(actor.userId()))
        .orElseThrow(() -> new DomainException(404, "ANALYSIS_NOT_FOUND", "분석 작업을 찾을 수 없습니다."));
  }
}
