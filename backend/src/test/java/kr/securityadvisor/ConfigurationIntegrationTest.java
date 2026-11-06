package kr.securityadvisor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.model.PolicyProvider;
import kr.securityadvisor.configuration.service.PublishedConfigurationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

class ConfigurationIntegrationTest extends IntegrationTestSupport {
  private final JdbcTemplate jdbc;
  private final PolicyProvider policies;
  private final PublishedConfigurationService configurations;

  @Autowired
  ConfigurationIntegrationTest(
      MockMvc mvc,
      ObjectMapper mapper,
      JdbcTemplate jdbc,
      PolicyProvider policies,
      PublishedConfigurationService configurations) {
    super(mvc, mapper);
    this.jdbc = jdbc;
    this.policies = policies;
    this.configurations = configurations;
  }

  @Test
  @DisplayName("기관별 독립 seed 게시본 1만 사용하고 알 수 없는 기관은 자동 생성하지 않는다")
  void useExplicitTenantPublication() {
    UUID institution = UUID.fromString("10000000-0000-0000-0000-000000000001");
    UUID outside = UUID.fromString("20000000-0000-0000-0000-000000000002");
    assertThat(policies.currentVersion(institution)).isEqualTo(1);
    assertThat(policies.currentVersion(outside)).isEqualTo(1);
    assertThat(configurations.institutionName(institution))
        .isNotEqualTo(configurations.institutionName(outside));
    UUID unknown = UUID.randomUUID();
    assertThatThrownBy(() -> policies.currentVersion(unknown)).isInstanceOf(DomainException.class);
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM publications WHERE institution_id = ?", Long.class, unknown))
        .isZero();
  }

  @Test
  @DisplayName("게시본은 DB에서도 덮어쓰거나 삭제할 수 없다")
  void rejectPublishedSnapshotMutation() {
    UUID institution = UUID.fromString("10000000-0000-0000-0000-000000000001");
    assertThatThrownBy(
            () ->
                jdbc.update(
                    "UPDATE publications SET version = 2 WHERE institution_id = ?", institution))
        .isInstanceOf(DataAccessException.class);
    assertThatThrownBy(
            () -> jdbc.update("DELETE FROM publications WHERE institution_id = ?", institution))
        .isInstanceOf(DataAccessException.class);
    assertThat(policies.currentVersion(institution)).isEqualTo(1);
  }
}
