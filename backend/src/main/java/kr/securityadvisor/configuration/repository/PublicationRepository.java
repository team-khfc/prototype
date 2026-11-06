package kr.securityadvisor.configuration.repository;

import java.util.Optional;
import java.util.UUID;
import kr.securityadvisor.configuration.domain.Publication;
import org.springframework.data.repository.Repository;

/** seed 게시본은 조회만 공개하며 편집·게시 명령은 P2에서 별도로 정의한다. */
public interface PublicationRepository extends Repository<Publication, UUID> {
  Optional<Publication> findFirstByInstitutionIdOrderByVersionDesc(UUID institutionId);
}
