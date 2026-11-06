package kr.securityadvisor.configuration.service;

import java.util.UUID;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.model.PolicyProvider;
import kr.securityadvisor.configuration.domain.Publication;
import kr.securityadvisor.configuration.repository.PublicationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 초기 게시본을 인증한 기관에 맞춰 조회하며 다른 컨텍스트에는 공개 값만 전달한다. */
@Service
@Transactional(readOnly = true)
public class PublishedConfigurationService implements PolicyProvider {
  private final PublicationRepository publications;

  public PublishedConfigurationService(PublicationRepository publications) {
    this.publications = publications;
  }

  /** 신규 사업 건의 게시본 버전을 고정한다. 임의 기관의 게시본을 자동 생성하지 않는다. */
  @Override
  public long currentVersion(UUID institutionId) {
    return current(institutionId).getVersion();
  }

  /** 세션에는 기관 표시명만 반환하며 설정·연결 비밀을 노출하지 않는다. */
  public String institutionName(UUID institutionId) {
    return current(institutionId).getInstitutionName();
  }

  private Publication current(UUID institutionId) {
    return publications
        .findFirstByInstitutionIdOrderByVersionDesc(institutionId)
        .orElseThrow(
            () -> new DomainException(409, "PUBLICATION_REQUIRED", "기관의 시작 게시본을 먼저 준비해 주세요."));
  }
}
