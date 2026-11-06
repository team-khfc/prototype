package kr.boan.institution.service;

import java.util.HashSet;
import java.util.Set;
import kr.boan.common.error.DomainException;
import kr.boan.common.model.ExtraQuestion;
import kr.boan.common.model.OrganizationPolicy;
import org.springframework.stereotype.Component;

/** 기관 설정이 필수 검토와 질문 책임의 경계를 무너뜨리지 않게 검증한다. */
@Component
public class PolicyValidator {
  private final ModelConfigurationValidator modelValidator;

  public PolicyValidator(ModelConfigurationValidator modelValidator) {
    this.modelValidator = modelValidator;
  }

  /**
   * 게시와 저장에 같은 설정 검증을 적용한다.
   *
   * @throws DomainException 잘못된 질문·검토 방식·모델 구성이 포함되었을 때
   */
  public void validate(OrganizationPolicy policy) {
    if (policy == null
        || !text(policy.institutionName(), 80)
        || policy.reviewMode() == null
        || !Set.of("PARALLEL", "SEQUENTIAL").contains(policy.reviewMode())
        || (!policy.requireSecurity() && !policy.requireInfra())
        || policy.documentFooter() == null
        || policy.documentFooter().length() > 1000
        || policy.questions() == null
        || policy.questions().size() > 30) {
      throw invalid();
    }
    Set<String> keys = new HashSet<>();
    for (ExtraQuestion question : policy.questions()) {
      if (question == null
          || question.key() == null
          || !question.key().matches("custom_[a-z][a-z0-9_]{0,39}")
          || !keys.add(question.key())
          || !text(question.label(), 160)
          || !text(question.reason(), 500)
          || question.ownerRole() == null
          || !Set.of("APPLICANT", "SECURITY", "INFRA").contains(question.ownerRole())) {
        throw invalid();
      }
    }
    modelValidator.validate(policy.model());
  }

  private boolean text(String value, int maximum) {
    return value != null && !value.isBlank() && value.length() <= maximum;
  }

  private DomainException invalid() {
    return new DomainException(
        422, "INVALID_INSTITUTION_POLICY", "기관 이름·질문 키와 책임 역할·필수 검토 설정을 확인해 주세요.");
  }
}
