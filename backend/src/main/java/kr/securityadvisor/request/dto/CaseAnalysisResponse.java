package kr.securityadvisor.request.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.request.domain.CaseAnalysisJob;

/** 분석 원문·저장소 경로를 노출하지 않고 후보와 근거·입력 수정본만 반환한다. */
public record CaseAnalysisResponse(
    UUID id,
    UUID caseId,
    long revision,
    String status,
    String mode,
    String provider,
    String model,
    String error,
    List<AiAnswerProposal> suggestions,
    Instant createdAt) {
  /** 실패와 예시 실행을 실제 모델 성공과 구분해 전달한다. */
  public static CaseAnalysisResponse from(CaseAnalysisJob job) {
    return new CaseAnalysisResponse(
        job.getId(),
        job.getCaseId(),
        job.getRevision(),
        job.getStatus(),
        job.getMode(),
        job.getProvider(),
        job.getModel(),
        job.getError(),
        job.getSuggestions().stream()
            .map(
                candidate ->
                    new AiAnswerProposal(candidate.key(), candidate.value(), candidate.evidence()))
            .toList(),
        job.getCreatedAt());
  }
}
