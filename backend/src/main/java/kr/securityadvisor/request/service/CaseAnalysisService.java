package kr.securityadvisor.request.service;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.analysis.service.UploadStorage;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import kr.securityadvisor.llm.domain.LlmGateway;
import kr.securityadvisor.llm.service.LlmConfigurationService;
import kr.securityadvisor.request.domain.CaseAnalysisJob;
import kr.securityadvisor.request.dto.CaseAnalysisResponse;
import kr.securityadvisor.request.dto.WorkflowResponses.BusinessCaseResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** 분석·적용·사람 확인을 분리하고 모델 호출 동안 업무 트랜잭션을 열지 않는다. */
@Service
public class CaseAnalysisService {
  private final BusinessCaseService cases;
  private final UploadStorage uploads;
  private final CaseAnalysisStore jobs;
  private final LlmGateway models;
  private final LlmConfigurationService configurations;

  public CaseAnalysisService(
      BusinessCaseService cases,
      UploadStorage uploads,
      CaseAnalysisStore jobs,
      LlmGateway models,
      LlmConfigurationService configurations) {
    this.cases = cases;
    this.uploads = uploads;
    this.jobs = jobs;
    this.models = models;
    this.configurations = configurations;
  }

  /**
   * 파일을 고른 것만으로는 호출되지 않으며 서버가 소유권·수정본을 먼저 확인한다.
   *
   * @throws DomainException 권한·입력·연결·모델 결과가 유효하지 않을 때
   */
  public CaseAnalysisResponse analyze(
      Actor actor,
      UUID caseId,
      long expectedRevision,
      String text,
      MultipartFile file,
      UUID configurationId,
      String requestId) {
    BusinessCaseResponse businessCase = owner(actor, caseId);
    revision(businessCase, expectedRevision);
    if (businessCase.requests().stream()
        .noneMatch(
            item ->
                item.stage() < 4
                    && !java.util.Set.of("FINALIZED", "CLOSED", "WITHDRAWN")
                        .contains(item.status()))) {
      throw new DomainException(409, "CASE_READ_ONLY", "수정 가능한 신청이 없어 새 분석을 시작할 수 없습니다.");
    }
    var connection = configurations.connection(actor, configurationId);
    var input = uploads.store(text, file);
    var job =
        jobs.start(
            actor,
            caseId,
            expectedRevision,
            connection,
            configurationId,
            input.objectNames(),
            requestId);
    try {
      var candidates =
          models.extract(input.text(), connection).stream()
              .map(item -> new CaseAnalysisJob.Candidate(item.key(), item.value(), item.evidence()))
              .toList();
      boolean stale = cases.get(actor, caseId).revision() != expectedRevision;
      return jobs.complete(actor, caseId, job.id(), candidates, stale, requestId);
    } catch (RuntimeException exception) {
      String message =
          exception instanceof DomainException domain
              ? domain.getMessage()
              : "분석을 완료하지 못했습니다. 직접 입력하거나 다시 시도해 주세요.";
      jobs.fail(actor, caseId, job.id(), message, requestId);
      if (exception instanceof DomainException domain) throw domain;
      throw new DomainException(502, "ANALYSIS_FAILED", message);
    }
  }

  /** 명시적인 후보 적용도 확정이 아니며 원래 분석 수정본에서만 허용한다. */
  public BusinessCaseResponse apply(
      Actor actor, UUID caseId, UUID jobId, long expectedRevision, String requestId) {
    BusinessCaseResponse businessCase = owner(actor, caseId);
    revision(businessCase, expectedRevision);
    CaseAnalysisResponse job = jobs.get(actor, caseId, jobId);
    if (!"SUCCEEDED".equals(job.status()) || job.revision() != expectedRevision)
      throw new DomainException(
          409, "STALE_ANALYSIS", "현재 입력을 기준으로 다시 분석해 주세요.", businessCase.revision());
    return cases.proposeAnswers(actor, caseId, expectedRevision, job.suggestions(), requestId);
  }

  /** 소유권을 확인한 뒤 최근 작업 상태를 반환한다. */
  public List<CaseAnalysisResponse> list(Actor actor, UUID caseId) {
    owner(actor, caseId);
    return jobs.list(actor, caseId);
  }

  /** 다른 사용자 분석의 식별자를 알아도 접근할 수 없다. */
  public CaseAnalysisResponse get(Actor actor, UUID caseId, UUID jobId) {
    owner(actor, caseId);
    return jobs.get(actor, caseId, jobId);
  }

  private BusinessCaseResponse owner(Actor actor, UUID id) {
    BusinessCaseResponse value = cases.get(actor, id);
    if (actor.role() != Role.APPLICANT || !value.ownerId().equals(actor.userId()))
      throw new DomainException(403, "ANALYSIS_OWNER_REQUIRED", "사업 건 작성자만 분석을 요청할 수 있습니다.");
    return value;
  }

  private static void revision(BusinessCaseResponse businessCase, long revision) {
    if (businessCase.revision() != revision)
      throw new DomainException(
          409, "REVISION_CONFLICT", "입력이 변경되었습니다. 최신 내용을 비교해 주세요.", businessCase.revision());
  }
}
