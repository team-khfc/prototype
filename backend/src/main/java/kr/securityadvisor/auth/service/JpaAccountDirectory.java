package kr.securityadvisor.auth.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.securityadvisor.auth.domain.UserAccount;
import kr.securityadvisor.auth.repository.UserAccountRepository;
import kr.securityadvisor.common.security.AccountDirectory;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 배정 컨텍스트에는 계정 엔티티 대신 현재 활성 신원 값만 공개한다. */
@Service
@Transactional(readOnly = true)
public class JpaAccountDirectory implements AccountDirectory {
  private final UserAccountRepository accounts;

  public JpaAccountDirectory(UserAccountRepository accounts) {
    this.accounts = accounts;
  }

  /** 같은 기관·분야의 활성 담당자를 안정적인 순서로 찾는다. */
  @Override
  public List<Actor> activeStaff(UUID institutionId, Role role) {
    if (role != Role.INFRA && role != Role.SECURITY) return List.of();
    return accounts
        .findByInstitutionIdAndRoleAndActiveTrueOrderByUsername(institutionId, role)
        .stream()
        .map(UserAccount::toActor)
        .toList();
  }

  /** 비활성 계정은 기존 배정이 있더라도 검토 주체로 반환하지 않는다. */
  @Override
  public Optional<Actor> activeAccount(UUID id) {
    return accounts.findById(id).filter(UserAccount::isActive).map(UserAccount::toActor);
  }
}
