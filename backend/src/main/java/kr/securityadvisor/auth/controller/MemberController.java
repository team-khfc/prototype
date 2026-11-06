package kr.securityadvisor.auth.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.auth.dto.ChangeMemberRoleRequest;
import kr.securityadvisor.auth.dto.MemberResponse;
import kr.securityadvisor.auth.dto.SignupRequest;
import kr.securityadvisor.auth.dto.UserResponse;
import kr.securityadvisor.auth.service.MemberService;
import kr.securityadvisor.common.security.Actor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 가입과 역할 관리의 입력 계약을 제공한다. 인가·업무는 서비스가 판단한다. */
@RestController
public class MemberController {
  private final MemberService members;

  public MemberController(MemberService members) {
    this.members = members;
  }

  /** 가입 뒤에는 생성한 아이디·비밀번호로 명시적으로 로그인한다. */
  @PostMapping("/api/auth/signup")
  @ResponseStatus(HttpStatus.CREATED)
  public UserResponse signup(@Valid @RequestBody SignupRequest body, HttpServletRequest request) {
    return members.signup(body, String.valueOf(request.getAttribute("requestId")));
  }

  /** 기관 관리자에게 같은 기관 계정을 반환한다. */
  @GetMapping("/api/members")
  public List<MemberResponse> list(@AuthenticationPrincipal Actor actor) {
    return members.list(actor);
  }

  /** 요청 헤더의 역할이 아닌 현재 인증 주체를 사용한다. */
  @PatchMapping("/api/members/{id}/role")
  public MemberResponse changeRole(
      @AuthenticationPrincipal Actor actor,
      @PathVariable UUID id,
      @Valid @RequestBody ChangeMemberRoleRequest body,
      HttpServletRequest request) {
    return members.changeRole(actor, id, body, String.valueOf(request.getAttribute("requestId")));
  }
}
