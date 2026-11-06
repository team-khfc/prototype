package kr.securityadvisor.common.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import kr.securityadvisor.common.domain.Deadline;
import kr.securityadvisor.common.dto.DeadlineResponse;
import kr.securityadvisor.common.repository.DeadlineRepository;
import kr.securityadvisor.common.security.Role;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 호출 업무와 같은 트랜잭션에서 기존 기한을 종료하고 새 기한을 남긴다. */
@Service
@Transactional(readOnly = true)
public class DeadlineService implements DeadlineOperations {
  private final DeadlineRepository deadlines;

  public DeadlineService(DeadlineRepository deadlines) {
    this.deadlines = deadlines;
  }

  @Override
  @Transactional
  public void open(
      UUID institutionId,
      UUID requestId,
      Role field,
      String kind,
      int days,
      Set<LocalDate> holidays,
      long publicationVersion) {
    Instant now = Instant.now();
    deadlines.findByInstitutionIdAndRequestIdOrderByCreatedAt(institutionId, requestId).stream()
        .filter(
            d -> d.isActive() && Objects.equals(d.getField(), field) && d.getKind().equals(kind))
        .forEach(d -> d.close(now));
    deadlines.flush();
    deadlines.save(
        new Deadline(
            institutionId, requestId, field, kind, days, holidays, publicationVersion, now));
  }

  @Override
  @Transactional
  public void close(UUID institutionId, UUID requestId, String kind) {
    Instant now = Instant.now();
    deadlines.findByInstitutionIdAndRequestIdOrderByCreatedAt(institutionId, requestId).stream()
        .filter(d -> kind == null || d.getKind().equals(kind))
        .forEach(d -> d.close(now));
  }

  @Override
  public List<DeadlineResponse> list(UUID institutionId, UUID requestId) {
    Instant now = Instant.now();
    return deadlines
        .findByInstitutionIdAndRequestIdOrderByCreatedAt(institutionId, requestId)
        .stream()
        .map(d -> DeadlineResponse.from(d, now))
        .toList();
  }
}
