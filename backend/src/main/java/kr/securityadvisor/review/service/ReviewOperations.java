package kr.securityadvisor.review.service;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.common.domain.ReviewReadiness;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import kr.securityadvisor.review.dto.ReviewResponses.FinalConfirmationResponse;
import kr.securityadvisor.review.dto.ReviewResponses.ReviewResponse;
import kr.securityadvisor.review.dto.ReviewResponses.SupplementResponse;

/** 신청 애플리케이션이 분야별 검토를 조율하는 공개 경계다. */
public interface ReviewOperations {
  void initialize(UUID institutionId, UUID requestId);

  ReviewReadiness readiness(UUID institutionId, UUID requestId);

  List<ReviewResponse> list(UUID institutionId, UUID requestId);

  List<SupplementResponse> supplements(UUID institutionId, UUID requestId);

  void allocate(UUID institutionId, UUID requestId);

  void complete(Actor actor, UUID requestId, String comment, boolean fieldsReady);

  void invalidate(UUID institutionId, UUID requestId, boolean allocationChanged);

  void requestSupplement(Actor actor, UUID requestId, List<String> fieldKeys, String reason);

  Role supplementField(UUID institutionId, UUID requestId, UUID supplementId);

  void answerSupplement(UUID institutionId, UUID requestId, UUID supplementId, String answer);

  void resolveSupplement(Actor actor, UUID requestId, UUID supplementId);

  boolean hasOpenSupplements(UUID institutionId, UUID requestId);

  void confirmFinal(Actor actor, UUID requestId, UUID submissionId);

  boolean bothFinalConfirmed(UUID institutionId, UUID submissionId);

  List<FinalConfirmationResponse> finalConfirmations(UUID institutionId, UUID requestId);
}
