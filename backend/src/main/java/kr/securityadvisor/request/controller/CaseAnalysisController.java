package kr.securityadvisor.request.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.request.dto.CaseAnalysisResponse;
import kr.securityadvisor.request.dto.WorkflowResponses.BusinessCaseResponse;
import kr.securityadvisor.request.service.CaseAnalysisService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** 선택·전송·분석·답변 적용을 구분하는 사업 건 단위 API다. */
@RestController
@RequestMapping("/api/business-cases/{caseId}/analyses")
public class CaseAnalysisController {
  private final CaseAnalysisService analyses;

  public CaseAnalysisController(CaseAnalysisService analyses) {
    this.analyses = analyses;
  }

  /** 파일과 텍스트는 명시적인 분석 요청에서만 서버로 전송한다. */
  @PostMapping(consumes = "multipart/form-data")
  public CaseAnalysisResponse analyze(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID caseId,
      @RequestParam long expectedRevision,
      @RequestParam(required = false) String text,
      @RequestParam(required = false) MultipartFile file,
      @RequestParam(required = false) UUID configurationId,
      HttpServletRequest request) {
    return analyses.analyze(
        actor,
        caseId,
        expectedRevision,
        text,
        file,
        configurationId,
        String.valueOf(request.getAttribute("requestId")));
  }

  /** 이력 조회는 분석 성공 여부를 바꾸지 않는다. */
  @GetMapping
  public List<CaseAnalysisResponse> list(
      @AuthenticationPrincipal Actor actor, @PathVariable UUID caseId) {
    return analyses.list(actor, caseId);
  }

  /** 대상 사업 건과 소유권을 함께 확인한다. */
  @GetMapping("/{id}")
  public CaseAnalysisResponse get(
      @AuthenticationPrincipal Actor actor, @PathVariable UUID caseId, @PathVariable UUID id) {
    return analyses.get(actor, caseId, id);
  }

  /** 최신 입력과 일치하는 미확정 후보만 답변에 적용한다. */
  @PostMapping("/{id}/apply")
  public BusinessCaseResponse apply(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID caseId,
      @PathVariable UUID id,
      @Valid @RequestBody ApplyRequest body,
      HttpServletRequest request) {
    return analyses.apply(
        actor,
        caseId,
        id,
        body.expectedRevision(),
        String.valueOf(request.getAttribute("requestId")));
  }

  /** 값 자체는 클라이언트에서 받지 않고 저장한 분석 후보를 사용한다. */
  public record ApplyRequest(@NotNull @Min(0) Long expectedRevision) {}
}
