package kr.securityadvisor.llm.controller;

import java.util.List;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.llm.dto.LlmOptionResponse;
import kr.securityadvisor.llm.service.LlmConfigurationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 신청 화면의 모델 선택 계약과 관리자용 연결 관리 계약을 분리한다. */
@RestController
@RequestMapping("/api/llm-options")
public class LlmOptionController {
  private final LlmConfigurationService configurations;

  public LlmOptionController(LlmConfigurationService configurations) {
    this.configurations = configurations;
  }

  /** 기본 EXAMPLE과 같은 기관의 등록 모델만 제공한다. */
  @GetMapping
  public List<LlmOptionResponse> list(@AuthenticationPrincipal Actor actor) {
    return configurations.options(actor);
  }
}
