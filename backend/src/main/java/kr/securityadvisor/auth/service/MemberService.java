package kr.securityadvisor.auth.service;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import kr.securityadvisor.audit.service.AuditTrail;
import kr.securityadvisor.auth.domain.UserAccount;
import kr.securityadvisor.auth.dto.ChangeMemberRoleRequest;
import kr.securityadvisor.auth.dto.MemberResponse;
import kr.securityadvisor.auth.dto.SignupRequest;
import kr.securityadvisor.auth.dto.UserResponse;
import kr.securityadvisor.auth.repository.UserAccountRepository;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 가입·역할 변경과 감사 기록을 같은 트랜잭션에 묶는다. */
@Service
@Transactional(readOnly = true)
public class MemberService {
  private static final UUID DEMO_INSTITUTION =
      UUID.fromString("10000000-0000-0000-0000-000000000001");
  private final UserAccountRepository accounts;
  private final PasswordEncoder passwords;
  private final AuditTrail audit;

  public MemberService(
      UserAccountRepository accounts, PasswordEncoder passwords, AuditTrail audit) {
    this.accounts = accounts;
    this.passwords = passwords;
    this.audit = audit;
  }

  /**
   * 역할과 기관은 요청에 존재해도 사용하지 않으며 자동 로그인하지 않는다.
   *
   * @throws DomainException 아이디 중복 또는 비밀번호 규칙을 만족하지 못하는 경우
   */
  @Transactional
  public UserResponse signup(SignupRequest request, String requestId) {
    validatePassword(request.password());
    String username = request.username().toLowerCase(Locale.ROOT);
    if (accounts.findByUsername(username).isPresent()) throw duplicate();
    UserAccount account =
        UserAccount.register(
            DEMO_INSTITUTION,
            username,
            request.displayName().strip(),
            request.department() == null ? "" : request.department().strip(),
            passwords.encode(request.password()));
    try {
      accounts.saveAndFlush(account);
    } catch (DataIntegrityViolationException error) {
      throw duplicate();
    }
    audit.record(
        account.toActor(),
        "MEMBER",
        account.getId(),
        account.getRevision(),
        "MEMBER_REGISTERED",
        "직접 가입: 시연 기관 일반 사용자",
        List.of("registrationSource", "role"),
        requestId);
    return UserResponse.from(account.toActor());
  }

  /** 관리자에게만 같은 기관의 역할 관리에 필요한 계정을 공개한다. */
  public List<MemberResponse> list(Actor actor) {
    requireAdmin(actor);
    return accounts.findByInstitutionIdOrderByUsername(actor.institutionId()).stream()
        .map(MemberResponse::from)
        .toList();
  }

  /**
   * 현재 역할·기관과 수정본을 확인하고 이전 요청이 최신 역할을 덮어쓰지 못하게 한다.
   *
   * @throws DomainException 권한·기관·수정본·사유가 유효하지 않은 경우
   */
  @Transactional
  public MemberResponse changeRole(
      Actor actor, UUID memberId, ChangeMemberRoleRequest request, String requestId) {
    requireAdmin(actor);
    UserAccount account =
        accounts
            .findById(memberId)
            .filter(member -> member.getInstitutionId().equals(actor.institutionId()))
            .orElseThrow(() -> new DomainException(404, "MEMBER_NOT_FOUND", "계정을 찾을 수 없습니다."));
    if (account.getRevision() != request.expectedRevision()) {
      throw new DomainException(
          409, "REVISION_CONFLICT", "역할 정보가 변경되었습니다. 최신 내용을 확인해 주세요.", account.getRevision());
    }
    if (request.reason().isBlank())
      throw new DomainException(422, "REASON_REQUIRED", "역할 변경 사유를 입력해 주세요.");
    account.changeRole(request.role());
    accounts.flush();
    audit.record(
        actor,
        "MEMBER",
        memberId,
        account.getRevision(),
        "MEMBER_ROLE_CHANGED",
        request.reason().strip(),
        List.of("role"),
        requestId);
    return MemberResponse.from(account);
  }

  private static void requireAdmin(Actor actor) {
    if (actor.role() != Role.ADMIN)
      throw new DomainException(403, "ADMIN_REQUIRED", "기관 관리자만 역할을 관리할 수 있습니다.");
  }

  private static DomainException duplicate() {
    return new DomainException(409, "USERNAME_EXISTS", "이미 사용 중인 아이디입니다.");
  }

  private static void validatePassword(String value) {
    if (value == null
        || value.length() < 12
        || value.getBytes(StandardCharsets.UTF_8).length > 72
        || value.chars().noneMatch(Character::isUpperCase)
        || value.chars().noneMatch(Character::isLowerCase)
        || value.chars().noneMatch(Character::isDigit)) {
      throw new DomainException(
          422, "PASSWORD_POLICY", "비밀번호는 영문 대소문자·숫자를 포함한 12자 이상, UTF-8 72바이트 이하로 입력해 주세요.");
    }
  }
}
