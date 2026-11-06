package kr.securityadvisor.auth.service;

import jakarta.servlet.http.HttpSession;
import java.time.Instant;
import kr.securityadvisor.auth.dto.SessionResponse;
import kr.securityadvisor.auth.dto.UserResponse;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.configuration.service.PublishedConfigurationService;
import org.springframework.stereotype.Service;

/** 매번 서버 기준 만료 시각과 현재 기관 표시를 함께 반환한다. */
@Service
public class SessionService {
  private final PublishedConfigurationService configurations;

  public SessionService(PublishedConfigurationService configurations) {
    this.configurations = configurations;
  }

  /** 컨테이너의 idle timeout 정책을 화면이 임의 연장하지 못하게 한다. */
  public SessionResponse describe(Actor actor, HttpSession session) {
    return new SessionResponse(
        UserResponse.from(actor),
        configurations.institutionName(actor.institutionId()),
        Instant.now().plusSeconds(session.getMaxInactiveInterval()));
  }
}
