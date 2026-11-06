package kr.securityadvisor.auth.dto;

import java.util.UUID;
import kr.securityadvisor.auth.domain.UserAccount;
import kr.securityadvisor.common.security.Role;

/** 관리에 필요한 정보만 반환하며 비밀번호 해시·인증 비밀값은 제외한다. */
public record MemberResponse(
    UUID id,
    String username,
    String displayName,
    String department,
    Role role,
    boolean active,
    long revision) {
  /** 동일 기관 검사가 완료된 계정을 응답으로 변환한다. */
  public static MemberResponse from(UserAccount account) {
    return new MemberResponse(
        account.getId(),
        account.getUsername(),
        account.getDisplayName(),
        account.getDepartment(),
        account.getRole(),
        account.isActive(),
        account.getRevision());
  }
}
