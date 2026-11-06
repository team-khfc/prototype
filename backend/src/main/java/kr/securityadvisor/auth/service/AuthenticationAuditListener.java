package kr.securityadvisor.auth.service;

import java.util.List;
import kr.securityadvisor.audit.service.AuditTrail;
import kr.securityadvisor.common.security.Actor;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** 인증 감사에는 아이디 입력·암호·세션 토큰을 기록하지 않는다. */
@Component
public class AuthenticationAuditListener {
  private final AuditTrail audit;

  public AuthenticationAuditListener(AuditTrail audit) {
    this.audit = audit;
  }

  /** 서버가 확인한 신원으로 로그인 성공을 기록한다. */
  @EventListener
  public void succeeded(AuthenticationSuccessEvent event) {
    if (event.getAuthentication().getPrincipal() instanceof Actor actor) {
      audit.record(
          actor, "MEMBER", actor.userId(), 0, "LOGIN_SUCCEEDED", "계정 로그인", List.of(), requestId());
    }
  }

  /** 존재하지 않는 계정도 구분해서 노출하지 않는다. */
  @EventListener
  public void failed(AbstractAuthenticationFailureEvent event) {
    audit.securityAttempt("LOGIN_FAILED", null, requestId());
  }

  private static String requestId() {
    if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)
      return String.valueOf(attributes.getRequest().getAttribute("requestId"));
    return "authentication";
  }
}
