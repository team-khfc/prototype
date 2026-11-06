package kr.securityadvisor.assignment.service;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import kr.securityadvisor.assignment.domain.Assignment;
import kr.securityadvisor.assignment.domain.ReviewerPool;
import kr.securityadvisor.assignment.dto.AssignmentResponses.AssignmentResponse;
import kr.securityadvisor.assignment.dto.AssignmentResponses.ReviewerPoolResponse;
import kr.securityadvisor.assignment.dto.AssignmentResponses.ReviewerResponse;
import kr.securityadvisor.assignment.repository.AssignmentRepository;
import kr.securityadvisor.assignment.repository.ReviewerPoolRepository;
import kr.securityadvisor.common.domain.AnswerValue;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.AccountDirectory;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 인증 계정은 공개 조회 경계로만 읽고 배정 기록을 별도로 보존한다. */
@Service
@Transactional(readOnly = true)
public class AssignmentService implements AssignmentOperations {
  private final AssignmentRepository assignments;
  private final ReviewerPoolRepository pools;
  private final AccountDirectory accounts;

  public AssignmentService(
      AssignmentRepository assignments, ReviewerPoolRepository pools, AccountDirectory accounts) {
    this.assignments = assignments;
    this.pools = pools;
    this.accounts = accounts;
  }

  @Override
  @Transactional
  public void assignDefaults(UUID institutionId, UUID caseId, UUID requestId, UUID applicantId) {
    for (Role field : List.of(Role.INFRA, Role.SECURITY)) {
      if (assignments
          .findByInstitutionIdAndRequestIdAndFieldAndActiveTrue(institutionId, requestId, field)
          .isPresent()) continue;
      Optional<Actor> preferred =
          assignments
              .findByInstitutionIdAndCaseIdAndFieldAndActiveTrueOrderByAssignedAt(
                  institutionId, caseId, field)
              .stream()
              .map(a -> eligible(a.getAssigneeId(), institutionId, field, applicantId))
              .flatMap(Optional::stream)
              .findFirst();
      if (preferred.isEmpty()) {
        Optional<ReviewerPool> pool = pools.findByInstitutionIdAndField(institutionId, field);
        if (pool.isEmpty()) {
          Optional<Actor> first =
              accounts.activeStaff(institutionId, field).stream()
                  .filter(a -> !a.userId().equals(applicantId))
                  .sorted(Comparator.comparing(Actor::username))
                  .findFirst();
          if (first.isPresent()) {
            pools.initializeDefault(
                UUID.randomUUID(), institutionId, field.name(), first.get().userId());
            pool = pools.findByInstitutionIdAndField(institutionId, field);
          }
        }
        preferred =
            pool.flatMap(p -> eligible(p.getReviewerId(), institutionId, field, applicantId));
      }
      preferred.ifPresent(
          staff ->
              assignments.save(
                  new Assignment(
                      institutionId,
                      caseId,
                      requestId,
                      applicantId,
                      field,
                      staff.userId(),
                      staff.displayName(),
                      "기본 담당자 자동 배정")));
    }
  }

  @Override
  public boolean isAssigned(Actor actor, UUID requestId) {
    if (actor.role() != Role.INFRA && actor.role() != Role.SECURITY) return false;
    return assignments
        .findByInstitutionIdAndRequestIdAndFieldAndActiveTrue(
            actor.institutionId(), requestId, actor.role())
        .filter(a -> a.getAssigneeId().equals(actor.userId()))
        .flatMap(a -> accounts.activeAccount(a.getAssigneeId()))
        .filter(a -> a.institutionId().equals(actor.institutionId()) && a.role() == actor.role())
        .isPresent();
  }

  @Override
  public boolean isAssignedToCase(Actor actor, UUID caseId) {
    return (actor.role() == Role.INFRA || actor.role() == Role.SECURITY)
        && accounts
            .activeAccount(actor.userId())
            .filter(
                current ->
                    current.role() == actor.role()
                        && current.institutionId().equals(actor.institutionId()))
            .isPresent()
        && assignments
            .findByInstitutionIdAndCaseIdAndFieldAndActiveTrueOrderByAssignedAt(
                actor.institutionId(), caseId, actor.role())
            .stream()
            .anyMatch(assignment -> assignment.getAssigneeId().equals(actor.userId()));
  }

  @Override
  public boolean hasAssigned(UUID institutionId, UUID requestId, Role field) {
    return assignments
        .findByInstitutionIdAndRequestIdAndFieldAndActiveTrue(institutionId, requestId, field)
        .flatMap(a -> accounts.activeAccount(a.getAssigneeId()))
        .filter(a -> a.institutionId().equals(institutionId) && a.role() == field)
        .isPresent();
  }

  @Override
  public void requireAssigned(Actor actor, UUID requestId) {
    if (!isAssigned(actor, requestId))
      throw new DomainException(
          403, "ASSIGNED_REVIEWER_REQUIRED", "해당 분야에 배정된 활성 담당자만 처리할 수 있습니다.");
  }

  @Override
  @Transactional
  public void reassign(
      Actor actor,
      UUID caseId,
      UUID requestId,
      UUID applicantId,
      Role field,
      UUID assigneeId,
      String reason) {
    if (actor.role() != Role.ADMIN)
      throw new DomainException(403, "ADMIN_REQUIRED", "기관 관리자만 재배정할 수 있습니다.");
    String why = AnswerValue.clean(reason, 1000);
    if (why.isBlank()) throw new DomainException(422, "REASON_REQUIRED", "재배정 사유를 입력해 주세요.");
    Actor next =
        eligible(assigneeId, actor.institutionId(), field, applicantId)
            .orElseThrow(
                () ->
                    new DomainException(
                        422,
                        "INELIGIBLE_REVIEWER",
                        "같은 기관의 활성 분야 담당자를 선택해 주세요. 자기 신청은 담당할 수 없습니다."));
    assignments
        .findByInstitutionIdAndRequestIdAndFieldAndActiveTrue(
            actor.institutionId(), requestId, field)
        .ifPresent(
            old -> {
              old.deactivate();
              assignments.saveAndFlush(old);
            });
    assignments.save(
        new Assignment(
            actor.institutionId(),
            caseId,
            requestId,
            applicantId,
            field,
            next.userId(),
            next.displayName(),
            why));
  }

  @Override
  public List<AssignmentResponse> list(UUID institutionId, UUID requestId) {
    return assignments
        .findByInstitutionIdAndRequestIdOrderByAssignedAt(institutionId, requestId)
        .stream()
        .map(AssignmentResponse::from)
        .toList();
  }

  @Override
  public List<ReviewerPoolResponse> reviewers(Actor actor) {
    if (actor.role() != Role.ADMIN)
      throw new DomainException(403, "ADMIN_REQUIRED", "기관 관리자만 배정 후보를 조회할 수 있습니다.");
    return List.of(Role.INFRA, Role.SECURITY).stream()
        .map(
            field ->
                new ReviewerPoolResponse(
                    field.name(),
                    accounts.activeStaff(actor.institutionId(), field).stream()
                        .map(
                            a -> new ReviewerResponse(a.userId(), a.displayName(), a.role().name()))
                        .toList(),
                    pools
                        .findByInstitutionIdAndField(actor.institutionId(), field)
                        .map(ReviewerPool::getReviewerId)
                        .orElse(null)))
        .toList();
  }

  private Optional<Actor> eligible(UUID id, UUID institutionId, Role field, UUID applicantId) {
    return accounts
        .activeAccount(id)
        .filter(
            a ->
                a.institutionId().equals(institutionId)
                    && a.role() == field
                    && !a.userId().equals(applicantId));
  }
}
