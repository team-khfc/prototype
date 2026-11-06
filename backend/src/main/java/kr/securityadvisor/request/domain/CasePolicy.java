package kr.securityadvisor.request.domain;

import java.time.LocalDate;
import java.util.Set;

/** 사업 건 생성 시점에 고정하는 시작점 게시본의 기한 정책이다. */
public record CasePolicy(
    int consultationDays, int supplementDays, int finalizationDays, Set<LocalDate> holidays) {
  public CasePolicy {
    holidays = Set.copyOf(holidays);
  }

  public static CasePolicy seed() {
    return new CasePolicy(5, 5, 5, Set.of());
  }
}
