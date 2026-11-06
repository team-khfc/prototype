package kr.securityadvisor.llm.service;

import java.util.List;
import java.util.UUID;
import kr.securityadvisor.audit.service.AuditTrail;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.model.ModelConnection;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import kr.securityadvisor.institution.service.ModelConfigurationValidator;
import kr.securityadvisor.llm.domain.LlmConfiguration;
import kr.securityadvisor.llm.dto.LlmConfigurationRequest;
import kr.securityadvisor.llm.dto.LlmConfigurationResponse;
import kr.securityadvisor.llm.repository.LlmConfigurationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 모델 연결의 기관 격리·주소 허용 목록·변경 이력을 한 경계에서 검사한다. */
@Service
@Transactional(readOnly = true)
public class LlmConfigurationService {
  private final LlmConfigurationRepository configurations;
  private final ModelConfigurationValidator validator;
  private final AuditTrail audit;

  public LlmConfigurationService(
      LlmConfigurationRepository configurations,
      ModelConfigurationValidator validator,
      AuditTrail audit) {
    this.configurations = configurations;
    this.validator = validator;
    this.audit = audit;
  }

  /** 관리자에게 기관의 연결 버전 이력을 반환한다. */
  public List<LlmConfigurationResponse> list(Actor actor) {
    admin(actor);
    return configurations.findByInstitutionIdOrderByCreatedAtDesc(actor.institutionId()).stream()
        .map(LlmConfigurationResponse::from)
        .toList();
  }

  /**
   * 원문 키 없이 새 구성을 생성하며 기존 작업의 연결 식별자는 바꾸지 않는다.
   *
   * @throws DomainException 관리자가 아니거나 허용하지 않은 연결일 때
   */
  @Transactional
  public LlmConfigurationResponse create(
      Actor actor, LlmConfigurationRequest input, String requestId) {
    admin(actor);
    validator.validate(input.connection());
    LlmConfiguration configuration =
        configurations.saveAndFlush(
            new LlmConfiguration(actor.institutionId(), input.connection(), input.purpose()));
    audit.record(
        actor,
        "LLM_CONFIGURATION",
        configuration.getId(),
        0,
        "LLM_CONFIGURATION_CREATED",
        input.reason(),
        List.of("provider", "model", "endpoint", "purpose", "keyReference"),
        requestId);
    return LlmConfigurationResponse.from(configuration);
  }

  /** 호출하는 신청자의 기관에 속한 구성만 사용할 수 있다. */
  public ModelConnection connection(Actor actor, UUID id) {
    if (id == null) return new ModelConnection("EXAMPLE", "", "labelled-lines-v1", "", 0, 1024, 15);
    LlmConfiguration configuration =
        configurations
            .findById(id)
            .filter(item -> item.getInstitutionId().equals(actor.institutionId()))
            .orElseThrow(
                () ->
                    new DomainException(
                        404, "MODEL_CONFIGURATION_NOT_FOUND", "사용할 수 있는 모델 구성을 찾을 수 없습니다."));
    validator.validate(configuration.connection());
    return configuration.connection();
  }

  private static void admin(Actor actor) {
    if (actor.role() != Role.ADMIN)
      throw new DomainException(403, "ADMIN_REQUIRED", "기관 관리자만 모델 연결을 관리할 수 있습니다.");
  }
}
