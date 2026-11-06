package kr.securityadvisor.request.domain;

import java.net.InetAddress;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import kr.securityadvisor.common.domain.AnswerValue;
import kr.securityadvisor.common.error.DomainException;

/** 할당 완료 시 실제 값 형식을 검사하며 초안 단계의 불완전한 답변 저장은 막지 않는다. */
public final class NetworkAllocation {
  private static final Set<String> PROTOCOLS = Set.of("TCP", "UDP", "ICMP", "ICMPV6");
  private static final Pattern PERIOD =
      Pattern.compile("^(\\d{4}-\\d{2}-\\d{2})\\s*(?:~|부터)\\s*(\\d{4}-\\d{2}-\\d{2})(?:까지)?$");

  private NetworkAllocation() {}

  /**
   * 담당자가 확인한 단일 IP·프로토콜·포트·시작/종료일을 검증한다.
   *
   * @throws DomainException 값 형식이 지원 범위를 벗어나면 항목 이름과 수정 방법을 반환한다.
   */
  public static void validate(List<AnswerValue> answers) {
    for (AnswerValue answer : answers) {
      // 미해당은 값 형식 대신 사유와 사람의 확인을 기존 답변 불변식으로 검사한다.
      if (answer.notApplicable()) {
        if (!answer.ready()) invalid(answer, "미해당 사유를 입력하고 담당자가 확인해 주세요.");
        continue;
      }
      switch (answer.key()) {
        case "sourceIp", "destinationIp" -> validateAddress(answer);
        case "protocol" -> {
          if (!PROTOCOLS.contains(answer.value().toUpperCase(Locale.ROOT)))
            invalid(answer, "TCP, UDP, ICMP 또는 ICMPV6를 입력해 주세요.");
        }
        case "port" -> validatePorts(answer);
        case "period" -> validatePeriod(answer);
        default -> {
          // 시스템명과 사용자 설명은 텍스트·확인 규칙을 그대로 따른다.
        }
      }
    }
  }

  private static void validateAddress(AnswerValue answer) {
    String value = answer.value();
    if (!value.contains(":")) {
      String[] parts = value.split("\\.", -1);
      if (parts.length != 4) invalidAddress(answer);
      for (String part : parts) {
        if (!part.matches("0|[1-9][0-9]{0,2}") || Integer.parseInt(part) > 255)
          invalidAddress(answer);
      }
      return;
    }
    if (!value.matches("[0-9A-Fa-f:.]{2,45}")) invalidAddress(answer);
    try {
      // ofLiteral은 호스트 이름 조회나 네트워크 요청을 하지 않는다.
      InetAddress.ofLiteral(value);
    } catch (IllegalArgumentException exception) {
      invalidAddress(answer);
    }
  }

  private static void invalidAddress(AnswerValue answer) {
    invalid(answer, "단일 IPv4 또는 IPv6 주소를 입력해 주세요. 호스트 이름·CIDR·주소 목록은 현재 지원하지 않습니다.");
  }

  private static void validatePorts(AnswerValue answer) {
    String[] ports = answer.value().split(",", -1);
    if (ports.length > 64) invalidPorts(answer);
    for (String port : ports) {
      String value = port.strip();
      if (!value.matches("[0-9]{1,5}(?:\\s*-\\s*[0-9]{1,5})?")) invalidPorts(answer);
      String[] range = value.split("\\s*-\\s*", -1);
      int start = Integer.parseInt(range[0]);
      int end = range.length == 2 ? Integer.parseInt(range[1]) : start;
      if (start < 1 || end > 65535 || start > end) invalidPorts(answer);
    }
  }

  private static void invalidPorts(AnswerValue answer) {
    invalid(answer, "1~65535의 포트 또는 오름차순 범위를 쉼표로 구분해 64개 이하로 입력해 주세요. 예: 443, 8000-8010");
  }

  private static void validatePeriod(AnswerValue answer) {
    var match = PERIOD.matcher(answer.value());
    if (!match.matches()) invalidPeriod(answer);
    try {
      LocalDate start = LocalDate.parse(match.group(1));
      LocalDate end = LocalDate.parse(match.group(2));
      if (start.isAfter(end)) invalidPeriod(answer);
    } catch (DateTimeParseException exception) {
      invalidPeriod(answer);
    }
  }

  private static void invalidPeriod(AnswerValue answer) {
    invalid(answer, "실제 시작일과 종료일을 '2026-11-07 ~ 2026-12-31' 형식으로 입력해 주세요. 종료일은 시작일보다 빠를 수 없습니다.");
  }

  private static void invalid(AnswerValue answer, String message) {
    throw new DomainException(422, "INVALID_ALLOCATION_VALUE", answer.label() + ": " + message);
  }
}
