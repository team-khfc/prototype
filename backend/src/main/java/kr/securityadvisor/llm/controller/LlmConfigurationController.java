package kr.securityadvisor.llm.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.llm.dto.LlmConfigurationRequest;
import kr.securityadvisor.llm.dto.LlmConfigurationResponse;
import kr.securityadvisor.llm.service.LlmConfigurationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 연결 관리 UI보다 먼저 사용할 수 있는 관리자용 구성 계약이다. */
@RestController
@RequestMapping("/api/llm-configurations")
public class LlmConfigurationController {
  private final LlmConfigurationService configurations;

  public LlmConfigurationController(LlmConfigurationService configurations) {
    this.configurations = configurations;
  }

  /** 같은 기관의 모델 연결 이력만 조회한다. */
  @GetMapping
  public List<LlmConfigurationResponse> list(@AuthenticationPrincipal Actor actor) {
    return configurations.list(actor);
  }

  /** 키 원문을 받거나 반환하지 않는다. */
  @PostMapping
  public LlmConfigurationResponse create(
      @AuthenticationPrincipal Actor actor,
      @Valid @RequestBody LlmConfigurationRequest input,
      HttpServletRequest request) {
    return configurations.create(actor, input, String.valueOf(request.getAttribute("requestId")));
  }
}
