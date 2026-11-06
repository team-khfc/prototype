package kr.securityadvisor;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/** 트리거뿐 아니라 실제 애플리케이션 DB 역할의 최소 권한도 검사한다. */
class DatabasePrivilegeIntegrationTest extends IntegrationTestSupport {
  private final JdbcTemplate jdbc;

  @Autowired
  DatabasePrivilegeIntegrationTest(MockMvc mvc, ObjectMapper mapper, JdbcTemplate jdbc) {
    super(mvc, mapper);
    this.jdbc = jdbc;
  }

  @Test
  @DisplayName("감사·제출본·최종 확인은 실행 계정에 조회와 추가만 허용한다")
  void historyTablesAreAppendOnlyForApplicationRole() {
    for (String table :
        List.of("audit_events", "security_submissions", "review_final_confirmations")) {
      assertPrivilege(table, "SELECT", true);
      assertPrivilege(table, "INSERT", true);
      assertPrivilege(table, "UPDATE", false);
      assertPrivilege(table, "DELETE", false);
      assertPrivilege(table, "TRUNCATE", false);
    }
  }

  @Test
  @DisplayName("고정 게시본은 실행 계정에 조회만 허용한다")
  void publicationsAreReadOnlyForApplicationRole() {
    assertPrivilege("publications", "SELECT", true);
    for (String permission : List.of("INSERT", "UPDATE", "DELETE", "TRUNCATE"))
      assertPrivilege("publications", permission, false);
  }

  private void assertPrivilege(String table, String permission, boolean allowed) {
    Boolean granted =
        jdbc.queryForObject(
            "SELECT has_table_privilege('boan_app', ?, ?)",
            Boolean.class,
            "public." + table,
            permission);
    assertThat(granted).as("boan_app %s %s", table, permission).isEqualTo(allowed);
  }
}
