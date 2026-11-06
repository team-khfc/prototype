package kr.securityadvisor.common.domain;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Set;

/** 기산일 다음 영업일부터 계산하며 저장된 기한을 재계산하지 않는 순수 계산기다. */
public final class BusinessCalendar {
  public static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

  private BusinessCalendar() {}

  /** 주말과 고정 게시본 공휴일을 제외한 기한일 끝 시각을 반환한다. */
  public static Instant deadline(Instant from, int days, Set<LocalDate> holidays) {
    if (days < 1 || days > 60) throw new IllegalArgumentException("영업일 수 범위를 확인해 주세요.");
    LocalDate date = from.atZone(SEOUL).toLocalDate();
    for (int remaining = days; remaining > 0; ) {
      date = date.plusDays(1);
      if (businessDay(date, holidays)) remaining--;
    }
    return date.atTime(LocalTime.of(23, 59, 59)).atZone(SEOUL).toInstant();
  }

  /** 임박 표시는 저장하지 않고 다음 영업일과 저장 기한을 비교한다. */
  public static String timing(Instant dueAt, Instant now, Set<LocalDate> holidays) {
    if (now.isAfter(dueAt)) return "OVERDUE";
    LocalDate tomorrow = now.atZone(SEOUL).toLocalDate().plusDays(1);
    while (!businessDay(tomorrow, holidays)) tomorrow = tomorrow.plusDays(1);
    return !dueAt.atZone(SEOUL).toLocalDate().isAfter(tomorrow) ? "DUE_SOON" : "WITHIN";
  }

  private static boolean businessDay(LocalDate date, Set<LocalDate> holidays) {
    return date.getDayOfWeek() != DayOfWeek.SATURDAY
        && date.getDayOfWeek() != DayOfWeek.SUNDAY
        && !holidays.contains(date);
  }
}
