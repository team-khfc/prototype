package kr.securityadvisor.audit.service;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.audit.dto.AuditEventResponse;
import kr.securityadvisor.common.security.Actor;

/** 다른 컨텍스트는 감사 엔티티와 저장소 대신 이 경계만 호출한다. */
public interface AuditTrail {
  /** 호출한 업무 트랜잭션에 참여하여 함께 성공하거나 실패한다. */
  void record(
      Actor actor,
      String targetType,
      UUID targetId,
      long targetRevision,
      String action,
      String reason,
      List<String> fieldKeys,
      String requestId);

  /** 인증 실패는 원문 식별자 없이 별도 트랜잭션으로 기록한다. */
  void securityAttempt(String action, UUID nullableActorId, String requestId);

  /** 기관 관리자용 조회이며 다른 기관의 이력은 반환하지 않는다. */
  List<AuditEventResponse> institutionEvents(Actor actor);

  /** 신청 접근 검사를 마친 애플리케이션 서비스만 대상별 이력을 조회한다. */
  List<AuditEventResponse> requestEvents(UUID institutionId, UUID requestId);
}
