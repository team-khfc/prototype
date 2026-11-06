package kr.securityadvisor.assignment.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import kr.securityadvisor.common.entity.BaseTimeEntity;
import kr.securityadvisor.common.security.Role;

/** 처음 준비된 분야별 기본 담당자를 게시본 시작점으로 고정한다. */
@Entity
@Table(name = "reviewer_pools")
public class ReviewerPool extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "institution_id", nullable = false, updatable = false)
  private UUID institutionId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20, updatable = false)
  private Role field;

  @Column(name = "reviewer_id", nullable = false)
  private UUID reviewerId;

  protected ReviewerPool() {}

  public ReviewerPool(UUID institutionId, Role field, UUID reviewerId) {
    id = UUID.randomUUID();
    this.institutionId = institutionId;
    this.field = field;
    this.reviewerId = reviewerId;
  }

  public UUID getReviewerId() {
    return reviewerId;
  }
}
