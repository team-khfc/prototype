package kr.securityadvisor.analysis.service;

import java.util.List;
import kr.securityadvisor.common.model.ModelConnection;
import kr.securityadvisor.common.model.Suggestion;

/** 공급자별 전송 규약을 교체하더라도 후보 검증과 사람 확인 절차는 유지한다. */
public interface LanguageModelAdapter {
  /** 연결 설정의 공급자 식별자를 반환한다. */
  String provider();

  /**
   * 기관 비공개 컨텍스트 없이 명시적으로 제공한 사업 설명에서 후보만 구한다.
   *
   * @throws kr.securityadvisor.common.error.DomainException 호출 또는 응답 해석이 실패했을 때
   */
  List<Suggestion> analyze(String text, ModelConnection connection);
}
