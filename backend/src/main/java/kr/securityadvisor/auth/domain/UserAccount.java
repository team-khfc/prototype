package kr.securityadvisor.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.util.UUID;
import kr.securityadvisor.common.entity.BaseTimeEntity;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;

/** 기관과 역할은 계정의 서버 데이터이며 로그인 폼에서 선택하지 않는다. */
@Entity
@Table(name = "user_accounts")
public class UserAccount extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "institution_id", nullable = false)
  private UUID institutionId;

  @Column(nullable = false, unique = true, length = 80)
  private String username;

  @Column(name = "display_name", nullable = false, length = 100)
  private String displayName;

  @Column(name = "password_hash", nullable = false, length = 100)
  private String passwordHash;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private Role role;

  @Column(nullable = false)
  private boolean active;

  @Column(nullable = false, length = 100)
  private String department = "";

  @Column(name = "registration_source", nullable = false, length = 10)
  private String registrationSource = "SEED";

  @Version private long revision;

  protected UserAccount() {}

  /** 초기 시연 계정도 운영 인증과 같은 해시 검사를 거치게 한다. */
  public UserAccount(
      UUID id,
      UUID institutionId,
      String username,
      String displayName,
      String passwordHash,
      Role role) {
    this.id = id;
    this.institutionId = institutionId;
    this.username = username;
    this.displayName = displayName;
    this.passwordHash = passwordHash;
    this.role = role;
    active = true;
  }

  /** 계정이 중지되면 기존 세션도 다음 요청부터 사용할 수 없다. */
  public void deactivate() {
    active = false;
  }

  /** 직접 가입은 소속 기관과 일반 사용자 역할을 서버에서 고정한다. */
  public static UserAccount register(
      UUID institutionId, String username, String displayName, String department, String hash) {
    UserAccount account =
        new UserAccount(
            UUID.randomUUID(), institutionId, username, displayName, hash, Role.APPLICANT);
    account.department = department == null ? "" : department;
    account.registrationSource = "SELF";
    return account;
  }

  /** 역할 변경은 애플리케이션 서비스의 관리자·수정본 검사를 거친다. */
  public void changeRole(Role nextRole) {
    role = java.util.Objects.requireNonNull(nextRole);
  }

  public UUID getInstitutionId() {
    return institutionId;
  }

  public String getDisplayName() {
    return displayName;
  }

  public String getDepartment() {
    return department;
  }

  public Role getRole() {
    return role;
  }

  public long getRevision() {
    return revision;
  }

  public UUID getId() {
    return id;
  }

  public String getUsername() {
    return username;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public boolean isActive() {
    return active;
  }

  /** 최신 DB 역할을 신원 값으로 복사한다. */
  public Actor toActor() {
    return new Actor(id, institutionId, username, displayName, role);
  }
}
