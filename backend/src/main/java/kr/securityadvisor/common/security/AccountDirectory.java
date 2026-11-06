package kr.securityadvisor.common.security;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** 다른 컨텍스트에 비밀번호와 계정 엔티티를 노출하지 않는 계정 조회 경계다. */
public interface AccountDirectory {
  /** 같은 기관에서 현재 활성인 지정 분야 담당자만 반환한다. */
  List<Actor> activeStaff(UUID institutionId, Role role);

  /** 비활성·삭제 계정은 반환하지 않는다. */
  Optional<Actor> activeAccount(UUID userId);
}
