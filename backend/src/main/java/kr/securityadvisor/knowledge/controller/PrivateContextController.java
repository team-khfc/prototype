package kr.securityadvisor.knowledge.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.knowledge.dto.ContextRequest;
import kr.securityadvisor.knowledge.dto.ContextResponse;
import kr.securityadvisor.knowledge.service.PrivateContextService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 기관 비공개 사실은 공개 지식·AI 원문 전송과 분리된 경계에서 취급한다. */
@RestController
@RequestMapping("/api/private-contexts")
public class PrivateContextController {
  private final PrivateContextService contexts;

  public PrivateContextController(PrivateContextService contexts) {
    this.contexts = contexts;
  }

  /** 전문 담당자·관리자에게 자신의 기관 자료만 반환하고 조회를 감사한다. */
  @GetMapping
  public List<ContextResponse> list(
      @AuthenticationPrincipal Actor actor, HttpServletRequest request) {
    return contexts.getContexts(actor, String.valueOf(request.getAttribute("requestId")));
  }

  /** 관리자만 합성 참고 자료를 등록할 수 있으며 본문은 감사 이력에 복제하지 않는다. */
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ContextResponse create(
      @AuthenticationPrincipal Actor actor,
      @Valid @RequestBody ContextRequest input,
      HttpServletRequest request) {
    return contexts.createContext(actor, input, String.valueOf(request.getAttribute("requestId")));
  }
}
