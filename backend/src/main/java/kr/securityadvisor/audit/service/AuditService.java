package kr.securityadvisor.audit.service;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.audit.domain.AuditEvent;
import kr.securityadvisor.audit.dto.AuditEventResponse;
import kr.securityadvisor.audit.repository.AuditEventRepository;
import kr.securityadvisor.common.domain.AnswerValue;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 업무 기록은 원자적으로, 인증 실패 기록은 실패 트랜잭션 밖에 보존한다. */
@Service
@Transactional(readOnly = true)
public class AuditService implements AuditTrail {
  private final AuditEventRepository events;

  public AuditService(AuditEventRepository events) {
    this.events = events;
  }

  @Override
  @Transactional
  public void record(
      Actor actor,
      String targetType,
      UUID targetId,
      long targetRevision,
      String action,
      String reason,
      List<String> fieldKeys,
      String requestId) {
    if (fieldKeys == null || fieldKeys.size() > 40)
      throw new IllegalArgumentException("감사 항목 수를 확인해 주세요.");
    events.save(
        new AuditEvent(
            actor,
            AnswerValue.clean(targetType, 40),
            targetId,
            targetRevision,
            AnswerValue.clean(action, 80),
            AnswerValue.clean(reason, 1000),
            fieldKeys.stream().map(key -> AnswerValue.clean(key, 80)).toList(),
            AnswerValue.clean(requestId, 100)));
  }

  @Override
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void securityAttempt(String action, UUID nullableActorId, String requestId) {
    events.save(
        new AuditEvent(
            null,
            "AUTHENTICATION",
            nullableActorId,
            0,
            AnswerValue.clean(action, 80),
            "",
            List.of(),
            AnswerValue.clean(requestId, 100)));
  }

  @Override
  public List<AuditEventResponse> institutionEvents(Actor actor) {
    if (actor.role() != Role.ADMIN)
      throw new DomainException(403, "ADMIN_REQUIRED", "기관 관리자만 감사 이력을 조회할 수 있습니다.");
    return events
        .findByInstitutionIdOrderByCreatedAtDesc(actor.institutionId(), PageRequest.of(0, 200))
        .stream()
        .map(AuditEventResponse::from)
        .toList();
  }

  @Override
  public List<AuditEventResponse> requestEvents(UUID institutionId, UUID requestId) {
    return events
        .findByInstitutionIdAndTargetTypeAndTargetIdOrderByCreatedAtDesc(
            institutionId, "SECURITY_REQUEST", requestId, PageRequest.of(0, 200))
        .stream()
        .map(AuditEventResponse::from)
        .toList();
  }
}
