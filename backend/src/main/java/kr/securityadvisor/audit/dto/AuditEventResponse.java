package kr.securityadvisor.audit.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.audit.domain.AuditEvent;

/** 역할별 공개 범위를 검사한 뒤 내보낼 최소 이력이다. */
public record AuditEventResponse(
    UUID id,
    String actorName,
    String actorRole,
    String targetType,
    UUID targetId,
    long targetRevision,
    String action,
    String reason,
    List<String> fieldKeys,
    String requestId,
    Instant createdAt) {
  public static AuditEventResponse from(AuditEvent event) {
    return new AuditEventResponse(
        event.getId(),
        event.getActorName(),
        event.getActorRole(),
        event.getTargetType(),
        event.getTargetId(),
        event.getTargetRevision(),
        event.getAction(),
        event.getReason(),
        event.getFieldKeys(),
        event.getRequestId(),
        event.getCreatedAt());
  }
}
