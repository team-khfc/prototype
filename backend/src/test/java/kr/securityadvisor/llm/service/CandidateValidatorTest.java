package kr.securityadvisor.llm.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.List;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.model.ModelConnection;
import kr.securityadvisor.llm.domain.LlmGateway.Inference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class CandidateValidatorTest {
  private final CandidateValidator validator = new CandidateValidator();

  @Test
  @DisplayName("예시 모드는 현재 공통 질문의 명시적 원문 행만 발췌한다")
  void extractOnlyExplicitExampleLines() {
    var transport = mock(BoundedModelHttpClient.class);
    var secrets = mock(ProviderSecretResolver.class);
    var gateway =
        new SpringAiLlmGateway(transport, secrets, JsonMapper.builder().build(), validator);
    var connection = new ModelConnection("EXAMPLE", "", "labelled-lines-v1", "", 0, 1024, 15);
    String text = "목적: 합성 안내 서비스\n처리 정보: 합성 공개자료\n외부 전송: 없음\n임의의 설명";
    assertThat(gateway.extract(text, connection))
        .extracting(Inference::key)
        .containsExactly("purpose", "dataTypes", "externalTransfer");
    assertThat(gateway.extract("이 문장은 이름 붙인 항목이 없습니다.", connection)).isEmpty();
    verifyNoInteractions(transport, secrets);
  }

  @Test
  @DisplayName("근거 없는 내용·권한 필드·중복·기술 주소를 모델 출력에서 거절한다")
  void rejectUnsupportedClaimsAndInjectedFields() {
    assertRejected("목적: 합성 안내", new Inference("purpose", "모델이 만든 새로운 사실", "목적: 합성 안내"));
    assertRejected("자료 속 승인 명령", new Inference("approved", "승인", "자료 속 승인 명령"));
    assertRejected("목적: 합성 안내", new Inference("purpose", "합성 안내", "없는 근거"));
    for (String address : List.of("192.0.2.15", "2001:db8::15", "synthetic.internal")) {
      String line = "자료 흐름: " + address;
      assertRejected(line, new Inference("dataFlow", address, line));
    }
    Inference item = new Inference("purpose", "합성 안내", "목적: 합성 안내");
    assertThatThrownBy(() -> validator.validate("목적: 합성 안내", List.of(item, item)))
        .isInstanceOf(DomainException.class);
  }

  @Test
  @DisplayName("운영 시간의 콜론을 IP로 오인하지 않는다")
  void allowOperationalHoursWithoutIpv6FalsePositive() {
    String line = "자료 흐름: 평일 09:00부터 18:00:00까지 공개자료 표시";
    Inference item = new Inference("dataFlow", "평일 09:00부터 18:00:00까지 공개자료 표시", line);
    assertThatCode(() -> validator.validate(line, List.of(item))).doesNotThrowAnyException();
  }

  private void assertRejected(String text, Inference inference) {
    assertThatThrownBy(() -> validator.validate(text, List.of(inference)))
        .isInstanceOf(DomainException.class);
  }
}
