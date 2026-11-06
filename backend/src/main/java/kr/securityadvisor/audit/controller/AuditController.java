package kr.securityadvisor.audit.controller;

import java.util.List;
import kr.securityadvisor.audit.dto.AuditEventResponse;
import kr.securityadvisor.audit.service.AuditTrail;
import kr.securityadvisor.common.security.Actor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 기관 관리자는 같은 기관의 추가 전용 이력만 읽는다. */
@RestController
public class AuditController {
  private final AuditTrail audit;

  public AuditController(AuditTrail audit) {
    this.audit = audit;
  }

  @GetMapping("/api/audit-events")
  public List<AuditEventResponse> list(@AuthenticationPrincipal Actor actor) {
    return audit.institutionEvents(actor);
  }
}
