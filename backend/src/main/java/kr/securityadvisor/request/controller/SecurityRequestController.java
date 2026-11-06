package kr.securityadvisor.request.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.audit.dto.AuditEventResponse;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.request.dto.WorkflowCommands.AnswerPatch;
import kr.securityadvisor.request.dto.WorkflowCommands.CompleteReview;
import kr.securityadvisor.request.dto.WorkflowCommands.Reason;
import kr.securityadvisor.request.dto.WorkflowCommands.Reassign;
import kr.securityadvisor.request.dto.WorkflowCommands.Revision;
import kr.securityadvisor.request.dto.WorkflowCommands.StageReturn;
import kr.securityadvisor.request.dto.WorkflowCommands.Supplement;
import kr.securityadvisor.request.dto.WorkflowCommands.SupplementAnswer;
import kr.securityadvisor.request.dto.WorkflowResponses.SecurityRequestResponse;
import kr.securityadvisor.request.service.RequestApplicationService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 임의의 stage/status 패치 없이 업무 동사별 검증된 명령을 받는다. */
@RestController
@RequestMapping("/api/security-requests")
public class SecurityRequestController {
  private final RequestApplicationService requests;

  public SecurityRequestController(RequestApplicationService requests) {
    this.requests = requests;
  }

  @GetMapping
  public List<SecurityRequestResponse> list(@AuthenticationPrincipal Actor actor) {
    return requests.list(actor);
  }

  @GetMapping("/{id}")
  public SecurityRequestResponse get(@AuthenticationPrincipal Actor actor, @PathVariable UUID id) {
    return requests.get(actor, id);
  }

  @PatchMapping("/{id}/answers")
  public SecurityRequestResponse answer(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @Valid @RequestBody AnswerPatch command,
      HttpServletRequest request) {
    return requests.answer(actor, id, command, requestId(request));
  }

  @PostMapping("/{id}/consult")
  public SecurityRequestResponse consult(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @Valid @RequestBody Revision command,
      HttpServletRequest request) {
    return requests.consult(actor, id, command, requestId(request));
  }

  @PostMapping("/{id}/allocation")
  public SecurityRequestResponse allocate(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @Valid @RequestBody Revision command,
      HttpServletRequest request) {
    return requests.allocate(actor, id, command, requestId(request));
  }

  @PostMapping("/{id}/reviews/complete")
  public SecurityRequestResponse completeReview(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @Valid @RequestBody CompleteReview command,
      HttpServletRequest request) {
    return requests.completeReview(actor, id, command, requestId(request));
  }

  @PostMapping("/{id}/supplements")
  public SecurityRequestResponse supplement(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @Valid @RequestBody Supplement command,
      HttpServletRequest request) {
    return requests.requestSupplement(actor, id, command, requestId(request));
  }

  @PostMapping("/{id}/supplements/{supplementId}/answer")
  public SecurityRequestResponse answerSupplement(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @PathVariable UUID supplementId,
      @Valid @RequestBody SupplementAnswer command,
      HttpServletRequest request) {
    return requests.answerSupplement(actor, id, supplementId, command, requestId(request));
  }

  @PostMapping("/{id}/supplements/{supplementId}/resolve")
  public SecurityRequestResponse resolveSupplement(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @PathVariable UUID supplementId,
      @Valid @RequestBody Revision command,
      HttpServletRequest request) {
    return requests.resolveSupplement(actor, id, supplementId, command, requestId(request));
  }

  @PostMapping("/{id}/returns")
  public SecurityRequestResponse returnToStage(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @Valid @RequestBody StageReturn command,
      HttpServletRequest request) {
    return requests.returnToStage(actor, id, command, requestId(request));
  }

  @PostMapping("/{id}/submit")
  public SecurityRequestResponse submit(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @Valid @RequestBody Revision command,
      @RequestHeader("Idempotency-Key") String idempotencyKey,
      HttpServletRequest request) {
    return requests.submit(actor, id, command, idempotencyKey, requestId(request));
  }

  @PostMapping("/{id}/final-confirmations")
  public SecurityRequestResponse confirmFinal(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @Valid @RequestBody Revision command,
      HttpServletRequest request) {
    return requests.confirmFinal(actor, id, command, requestId(request));
  }

  @PostMapping("/{id}/finalize")
  public SecurityRequestResponse finalizeRequest(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @Valid @RequestBody Revision command,
      HttpServletRequest request) {
    return requests.finalizeRequest(actor, id, command, requestId(request));
  }

  @PostMapping("/{id}/close")
  public SecurityRequestResponse close(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @Valid @RequestBody Reason command,
      HttpServletRequest request) {
    return requests.close(actor, id, command, requestId(request));
  }

  @PostMapping("/{id}/withdraw")
  public SecurityRequestResponse withdraw(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @Valid @RequestBody Reason command,
      HttpServletRequest request) {
    return requests.withdraw(actor, id, command, requestId(request));
  }

  @PatchMapping("/{id}/assignments/{field}")
  public SecurityRequestResponse reassign(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @PathVariable String field,
      @Valid @RequestBody Reassign command,
      HttpServletRequest request) {
    return requests.reassign(actor, id, field, command, requestId(request));
  }

  @GetMapping("/{id}/audit-events")
  public List<AuditEventResponse> auditEvents(
      @AuthenticationPrincipal Actor actor, @PathVariable UUID id) {
    return requests.auditEvents(actor, id);
  }

  @GetMapping("/{id}/document")
  public ResponseEntity<byte[]> document(
      @AuthenticationPrincipal Actor actor, @PathVariable UUID id, HttpServletRequest request) {
    var result = requests.document(actor, id, requestId(request));
    return ResponseEntity.ok()
        .contentType(new MediaType("text", "html", StandardCharsets.UTF_8))
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(result.filename()).build().toString())
        .header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; sandbox")
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .body(result.content().getBytes(StandardCharsets.UTF_8));
  }

  private static String requestId(HttpServletRequest request) {
    return String.valueOf(request.getAttribute("requestId"));
  }
}
