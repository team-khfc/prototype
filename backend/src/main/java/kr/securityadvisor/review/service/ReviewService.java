package kr.securityadvisor.review.service;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.common.domain.ReviewReadiness;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import kr.securityadvisor.review.domain.FinalConfirmation;
import kr.securityadvisor.review.domain.Review;
import kr.securityadvisor.review.dto.ReviewResponses.FinalConfirmationResponse;
import kr.securityadvisor.review.dto.ReviewResponses.ReviewResponse;
import kr.securityadvisor.review.dto.ReviewResponses.SupplementResponse;
import kr.securityadvisor.review.repository.FinalConfirmationRepository;
import kr.securityadvisor.review.repository.ReviewRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 다른 컨텍스트의 엔티티를 읽거나 수정하지 않는 분야별 협의 서비스다. */
@Service
@Transactional(readOnly = true)
public class ReviewService implements ReviewOperations {
  private final ReviewRepository reviews;
  private final FinalConfirmationRepository confirmations;

  public ReviewService(ReviewRepository reviews, FinalConfirmationRepository confirmations) {
    this.reviews = reviews;
    this.confirmations = confirmations;
  }

  @Override
  @Transactional
  public void initialize(UUID institutionId, UUID requestId) {
    List<Review> current = all(institutionId, requestId);
    for (Role field : List.of(Role.INFRA, Role.SECURITY)) {
      if (current.stream().noneMatch(r -> r.getField() == field))
        reviews.save(new Review(institutionId, requestId, field));
    }
  }

  @Override
  public ReviewReadiness readiness(UUID institutionId, UUID requestId) {
    List<Review> list = all(institutionId, requestId);
    return new ReviewReadiness(
        list.stream().anyMatch(r -> r.getField() == Role.INFRA && r.isAllocationCompleted()),
        complete(list, Role.INFRA),
        complete(list, Role.SECURITY),
        list.stream().anyMatch(Review::unresolved));
  }

  @Override
  public List<ReviewResponse> list(UUID institutionId, UUID requestId) {
    return all(institutionId, requestId).stream().map(ReviewResponse::from).toList();
  }

  @Override
  public List<SupplementResponse> supplements(UUID institutionId, UUID requestId) {
    return all(institutionId, requestId).stream()
        .flatMap(r -> r.getSupplements().stream())
        .map(SupplementResponse::from)
        .toList();
  }

  @Override
  @Transactional
  public void allocate(UUID institutionId, UUID requestId) {
    find(institutionId, requestId, Role.INFRA).completeAllocation();
  }

  @Override
  @Transactional
  public void complete(Actor actor, UUID requestId, String comment, boolean fieldsReady) {
    ReviewReadiness state = readiness(actor.institutionId(), requestId);
    find(actor.institutionId(), requestId, actor.role())
        .complete(actor, comment, state.allocationCompleted(), fieldsReady);
  }

  @Override
  @Transactional
  public void invalidate(UUID institutionId, UUID requestId, boolean allocationChanged) {
    all(institutionId, requestId).forEach(review -> review.invalidate(allocationChanged));
  }

  @Override
  @Transactional
  public void requestSupplement(
      Actor actor, UUID requestId, List<String> fieldKeys, String reason) {
    find(actor.institutionId(), requestId, actor.role())
        .requestSupplement(actor, fieldKeys, reason);
  }

  @Override
  public Role supplementField(UUID institutionId, UUID requestId, UUID supplementId) {
    return supplementReview(institutionId, requestId, supplementId).getField();
  }

  @Override
  @Transactional
  public void answerSupplement(
      UUID institutionId, UUID requestId, UUID supplementId, String answer) {
    supplementReview(institutionId, requestId, supplementId).answerSupplement(supplementId, answer);
  }

  @Override
  @Transactional
  public void resolveSupplement(Actor actor, UUID requestId, UUID supplementId) {
    supplementReview(actor.institutionId(), requestId, supplementId)
        .resolveSupplement(actor, supplementId);
  }

  @Override
  public boolean hasOpenSupplements(UUID institutionId, UUID requestId) {
    return all(institutionId, requestId).stream().anyMatch(Review::hasOpen);
  }

  @Override
  @Transactional
  public void confirmFinal(Actor actor, UUID requestId, UUID submissionId) {
    if (actor.role() != Role.INFRA && actor.role() != Role.SECURITY)
      throw new DomainException(403, "STAFF_REQUIRED", "배정된 담당자의 최종 확인이 필요합니다.");
    if (actor.role() == Role.SECURITY
        && !confirmations.existsBySubmissionIdAndInstitutionIdAndField(
            submissionId, actor.institutionId(), Role.INFRA)) {
      throw new DomainException(422, "INFRA_CONFIRMATION_REQUIRED", "같은 제출본의 인프라 최종 확인이 먼저 필요합니다.");
    }
    if (!confirmations.existsBySubmissionIdAndInstitutionIdAndField(
        submissionId, actor.institutionId(), actor.role())) {
      confirmations.save(new FinalConfirmation(actor, requestId, submissionId));
    }
  }

  @Override
  public boolean bothFinalConfirmed(UUID institutionId, UUID submissionId) {
    return submissionId != null
        && confirmations.existsBySubmissionIdAndInstitutionIdAndField(
            submissionId, institutionId, Role.INFRA)
        && confirmations.existsBySubmissionIdAndInstitutionIdAndField(
            submissionId, institutionId, Role.SECURITY);
  }

  @Override
  public List<FinalConfirmationResponse> finalConfirmations(UUID institutionId, UUID requestId) {
    return confirmations
        .findByRequestIdAndInstitutionIdOrderByConfirmedAt(requestId, institutionId)
        .stream()
        .map(FinalConfirmationResponse::from)
        .toList();
  }

  private List<Review> all(UUID institutionId, UUID requestId) {
    return reviews.findByRequestIdAndInstitutionIdOrderByField(requestId, institutionId);
  }

  private boolean complete(List<Review> list, Role field) {
    return list.stream().anyMatch(r -> r.getField() == field && "COMPLETE".equals(r.getStatus()));
  }

  private Review find(UUID institutionId, UUID requestId, Role field) {
    return all(institutionId, requestId).stream()
        .filter(r -> r.getField() == field)
        .findFirst()
        .orElseThrow(() -> new DomainException(409, "REVIEW_NOT_STARTED", "협의를 먼저 요청해 주세요."));
  }

  private Review supplementReview(UUID institutionId, UUID requestId, UUID supplementId) {
    return all(institutionId, requestId).stream()
        .filter(r -> r.containsSupplement(supplementId))
        .findFirst()
        .orElseThrow(() -> new DomainException(404, "SUPPLEMENT_NOT_FOUND", "보완 요청을 찾을 수 없습니다."));
  }
}
