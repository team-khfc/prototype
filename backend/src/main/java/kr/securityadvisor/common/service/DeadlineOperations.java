package kr.securityadvisor.common.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import kr.securityadvisor.common.dto.DeadlineResponse;
import kr.securityadvisor.common.security.Role;

/** 신청 컨텍스트가 공통 기한 계산과 저장을 사용하기 위한 경계다. */
public interface DeadlineOperations {
  void open(
      UUID institutionId,
      UUID requestId,
      Role field,
      String kind,
      int days,
      Set<LocalDate> holidays,
      long publicationVersion);

  void close(UUID institutionId, UUID requestId, String kind);

  List<DeadlineResponse> list(UUID institutionId, UUID requestId);
}
