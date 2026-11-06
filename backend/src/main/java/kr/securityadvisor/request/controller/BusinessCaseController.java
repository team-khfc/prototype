package kr.securityadvisor.request.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.request.dto.WorkflowCommands.AnswerPatch;
import kr.securityadvisor.request.dto.WorkflowCommands.CreateCase;
import kr.securityadvisor.request.dto.WorkflowResponses.BusinessCaseResponse;
import kr.securityadvisor.request.service.BusinessCaseService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 기관·역할은 세션의 서버 Actor로만 전달한다. */
@RestController
@RequestMapping("/api/business-cases")
public class BusinessCaseController {
  private final BusinessCaseService cases;

  public BusinessCaseController(BusinessCaseService cases) {
    this.cases = cases;
  }

  @GetMapping
  public List<BusinessCaseResponse> list(@AuthenticationPrincipal Actor actor) {
    return cases.list(actor);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public BusinessCaseResponse create(
      @AuthenticationPrincipal Actor actor,
      @Valid @RequestBody CreateCase command,
      HttpServletRequest request) {
    return cases.create(actor, command, String.valueOf(request.getAttribute("requestId")));
  }

  @GetMapping("/{id}")
  public BusinessCaseResponse get(@AuthenticationPrincipal Actor actor, @PathVariable UUID id) {
    return cases.get(actor, id);
  }

  @PatchMapping("/{id}/answers")
  public BusinessCaseResponse answer(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @Valid @RequestBody AnswerPatch command,
      HttpServletRequest request) {
    return cases.answer(actor, id, command, String.valueOf(request.getAttribute("requestId")));
  }
}
