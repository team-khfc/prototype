package kr.securityadvisor.request.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import kr.securityadvisor.common.domain.AnswerValue;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class NetworkAllocationTest {
  private final Actor infra =
      new Actor(UUID.randomUUID(), UUID.randomUUID(), "infra.synthetic", "합성 인프라 담당자", Role.INFRA);

  @Test
  @DisplayName("합성 IPv4·IPv6와 포트 목록·범위 및 두 기간 표기를 허용한다")
  void acceptsSupportedLiteralFormats() {
    assertThatCode(() -> NetworkAllocation.validate(validAnswers())).doesNotThrowAnyException();
    assertThatCode(
            () ->
                NetworkAllocation.validate(
                    replace(validAnswers(), "destinationIp", "2001:db8::20", false)))
        .doesNotThrowAnyException();
    assertThatCode(
            () ->
                NetworkAllocation.validate(
                    replace(validAnswers(), "period", "2026-11-07부터 2026-12-31까지", false)))
        .doesNotThrowAnyException();
  }

  @ParameterizedTest
  @MethodSource("invalidValues")
  @DisplayName("잘못된 할당값은 항목과 수정 방법을 포함한 업무 오류로 거부한다")
  void rejectsMalformedAllocation(String key, String value) {
    List<AnswerValue> answers = replace(validAnswers(), key, value, false);
    String label =
        answers.stream()
            .filter(answer -> answer.key().equals(key))
            .findFirst()
            .orElseThrow()
            .label();
    assertThatThrownBy(() -> NetworkAllocation.validate(answers))
        .isInstanceOf(DomainException.class)
        .hasMessageContaining(label)
        .satisfies(
            exception -> {
              DomainException domain = (DomainException) exception;
              assertThat(domain.getStatus()).isEqualTo(422);
              assertThat(domain.getCode()).isEqualTo("INVALID_ALLOCATION_VALUE");
            });
  }

  @Test
  @DisplayName("미해당은 확인된 사유가 있을 때만 형식 검증을 대신한다")
  void acceptsConfirmedNotApplicableReason() {
    assertThatCode(
            () ->
                NetworkAllocation.validate(
                    replace(validAnswers(), "port", "ICMP 사용으로 포트 미해당", true)))
        .doesNotThrowAnyException();
    AnswerValue unconfirmed =
        AnswerValue.empty("port", "포트", AnswerValue.Scope.CASE, Role.INFRA, true)
            .answer(infra, "ICMP 사용으로 포트 미해당", false, true);
    assertThatThrownBy(() -> NetworkAllocation.validate(List.of(unconfirmed)))
        .isInstanceOf(DomainException.class)
        .hasMessageContaining("미해당 사유");
  }

  private List<AnswerValue> validAnswers() {
    Map<String, String> values =
        Map.of(
            "sourceIp", "192.0.2.10",
            "destinationIp", "198.51.100.20",
            "protocol", "TCP",
            "port", "443, 8000-8010",
            "period", "2026-11-07 ~ 2026-12-31");
    return SeedQuestions.common().stream()
        .filter(answer -> values.containsKey(answer.key()))
        .map(answer -> answer.answer(infra, values.get(answer.key()), true, false))
        .toList();
  }

  private List<AnswerValue> replace(
      List<AnswerValue> answers, String key, String value, boolean notApplicable) {
    return answers.stream()
        .map(
            answer ->
                answer.key().equals(key)
                    ? answer.answer(infra, value, true, notApplicable)
                    : answer)
        .toList();
  }

  private static Stream<Arguments> invalidValues() {
    return Stream.of(
        Arguments.of("sourceIp", "256.0.2.10"),
        Arguments.of("sourceIp", "192.0.2"),
        Arguments.of("sourceIp", "192.0.2.10/24"),
        Arguments.of("sourceIp", "synthetic.example.test"),
        Arguments.of("destinationIp", "2001:db8::g"),
        Arguments.of("destinationIp", "2001:db8::1%test"),
        Arguments.of("protocol", "TCP OR UDP"),
        Arguments.of("port", "0"),
        Arguments.of("port", "65536"),
        Arguments.of("port", "443,"),
        Arguments.of("port", "9000-8000"),
        Arguments.of("period", "2026-12-31 ~ 2026-11-07"),
        Arguments.of("period", "2026-02-30 ~ 2026-12-31"),
        Arguments.of("period", "무기한"));
  }
}
