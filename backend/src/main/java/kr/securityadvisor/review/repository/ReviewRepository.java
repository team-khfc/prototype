package kr.securityadvisor.review.repository;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.review.domain.Review;
import org.springframework.data.jpa.repository.JpaRepository;

/** 신청 잠금 안에서만 분야별 검토를 변경한다. */
public interface ReviewRepository extends JpaRepository<Review, UUID> {
  List<Review> findByRequestIdAndInstitutionIdOrderByField(UUID requestId, UUID institutionId);
}
