package kr.securityadvisor.llm.domain;

import java.util.List;
import kr.securityadvisor.common.model.ModelConnection;

/** 업무 코드는 공급자 SDK나 Spring AI 타입 대신 이 추출 계약만 사용한다. */
public interface LlmGateway {
  /** 원문 근거가 있는 후보만 반환한다. 확정과 저장은 호출자 책임이다. */
  List<Inference> extract(String text, ModelConnection connection);

  /** 근거는 사용자 제공 원문의 발췌이며 기관 내부 사실을 만들어 넣지 않는다. */
  record Inference(String key, String value, String evidence) {}
}
