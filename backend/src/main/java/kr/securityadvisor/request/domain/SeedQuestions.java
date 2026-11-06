package kr.securityadvisor.request.domain;

import java.util.List;
import kr.securityadvisor.common.domain.AnswerValue;
import kr.securityadvisor.common.domain.AnswerValue.Scope;
import kr.securityadvisor.common.security.Role;

/** 시작점 게시본의 최소 필드 계약이며 화면에서 임의로 바꿀 수 없다. */
public final class SeedQuestions {
  private SeedQuestions() {}

  public static List<AnswerValue> common() {
    return List.of(
        item("purpose", "사업 목적", Scope.CASE, Role.APPLICANT),
        item("dataTypes", "처리하는 정보", Scope.CASE, Role.APPLICANT),
        item("externalTransfer", "외부 전송 여부", Scope.CASE, Role.APPLICANT),
        item("dataFlow", "자료 흐름", Scope.CASE, Role.APPLICANT),
        item("sourceSystem", "출발지 시스템", Scope.CASE, Role.INFRA),
        item("sourceIp", "출발지 IP", Scope.CASE, Role.INFRA),
        item("destinationSystem", "목적지 시스템", Scope.CASE, Role.INFRA),
        item("destinationIp", "목적지 IP", Scope.CASE, Role.INFRA),
        item("protocol", "프로토콜", Scope.CASE, Role.INFRA),
        item("port", "서비스 포트", Scope.CASE, Role.INFRA),
        item("period", "사용 기간", Scope.CASE, Role.INFRA));
  }

  public static List<AnswerValue> specific(DocType type) {
    return type == DocType.FIREWALL
        ? List.of(
            item("connectionPurpose", "연결 목적", Scope.REQUEST, Role.APPLICANT),
            item("accessControl", "접근 통제 확인", Scope.REQUEST, Role.SECURITY))
        : List.of(
            item("serviceScope", "검토 대상 범위", Scope.REQUEST, Role.APPLICANT),
            item("securityControls", "보안 조치 확인", Scope.REQUEST, Role.SECURITY));
  }

  private static AnswerValue item(String key, String label, Scope scope, Role role) {
    return AnswerValue.empty(key, label, scope, role, true);
  }
}
