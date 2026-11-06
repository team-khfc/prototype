package kr.securityadvisor.common.dto;

import java.time.Instant;
import java.util.UUID;
import kr.securityadvisor.common.domain.Deadline;

/** 기한과 업무 상태를 구분하여 조회 시점의 임박 여부만 반환한다. */
public record DeadlineResponse(
    UUID id,
    String field,
    String kind,
    Instant dueAt,
    boolean active,
    Instant closedAt,
    String timing) {
  public static DeadlineResponse from(Deadline value, Instant now) {
    return new DeadlineResponse(
        value.getId(),
        value.getField() == null ? null : value.getField().name(),
        value.getKind(),
        value.getDueAt(),
        value.isActive(),
        value.getClosedAt(),
        value.timing(now));
  }
}
