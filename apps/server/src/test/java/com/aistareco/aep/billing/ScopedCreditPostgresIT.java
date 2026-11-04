package com.aistareco.aep.billing;
@org.springframework.test.context.ActiveProfiles(value="postgresit",inheritProfiles=false)
@org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase(replace=org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace.NONE)
class ScopedCreditPostgresIT extends ScopedCreditServiceIntegrationTest {
    @org.junit.jupiter.api.BeforeEach
    void confirmsRealPostgresBaseline(@org.springframework.beans.factory.annotation.Autowired org.springframework.jdbc.core.JdbcTemplate jdbc) {
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT version FROM flyway_schema_history WHERE success=true ORDER BY installed_rank DESC LIMIT 1",String.class)).isEqualTo("77");
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT current_setting('server_version_num')::integer",Integer.class)).isBetween(180000,189999);
    }
    @org.springframework.test.context.DynamicPropertySource
    static void database(org.springframework.test.context.DynamicPropertyRegistry r) {
        com.aistareco.postgres.PostgresTestDatabase.configure(r,"test_scoped");
    }
}
