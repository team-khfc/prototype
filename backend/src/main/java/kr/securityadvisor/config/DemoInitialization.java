package kr.securityadvisor.config;

import kr.securityadvisor.auth.service.AuthService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** 합성 계정만 초기화하며 사업 건은 사용자가 새로 작성한다. */
@Component
@ConditionalOnProperty(name = "securityadvisor.demo.enabled", havingValue = "true")
public class DemoInitialization implements ApplicationRunner {
  private final AuthService auth;

  public DemoInitialization(AuthService auth) {
    this.auth = auth;
  }

  /** 계정 초기화가 끝나야 ApplicationReady 상태가 된다. */
  @Override
  public void run(ApplicationArguments args) {
    auth.initializeDemoAccounts();
  }
}
