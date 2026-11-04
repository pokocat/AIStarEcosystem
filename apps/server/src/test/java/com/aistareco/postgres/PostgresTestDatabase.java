package com.aistareco.postgres;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.testcontainers.containers.PostgreSQLContainer;
public final class PostgresTestDatabase {
    private static final PostgreSQLContainer<?> PG=new PostgreSQLContainer<>("postgres:18.0-alpine")
        .withDatabaseName("aistar_workflows").withUsername("aistar_test").withPassword("local-test-only");
    private PostgresTestDatabase() {}
    public static synchronized void configure(DynamicPropertyRegistry r, String schema) {
        if(!PG.isRunning())PG.start();
        r.add("spring.datasource.url",()->PG.getJdbcUrl()+(PG.getJdbcUrl().contains("?")?"&":"?")+"currentSchema="+schema);
        r.add("spring.flyway.schemas",()->schema);r.add("spring.flyway.default-schema",()->schema);
        r.add("spring.jpa.properties.hibernate.default_schema",()->schema);r.add("spring.datasource.username",PG::getUsername);r.add("spring.datasource.password",PG::getPassword);
        r.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");
        r.add("spring.datasource.hikari.connection-init-sql",()->"SET TIME ZONE 'UTC'");
        r.add("spring.jpa.hibernate.ddl-auto",()->"validate");r.add("spring.flyway.enabled",()->"true");
        r.add("spring.flyway.baseline-on-migrate",()->"false");r.add("spring.flyway.locations",()->"classpath:db/postgresql");
        r.add("spring.jpa.properties.hibernate.jdbc.time_zone",()->"UTC");
        r.add("spring.jpa.properties.hibernate.auto_quote_keyword",()->"true");
        r.add("aep.dev-auth.enabled",()->"false");r.add("aep.dap.allow-placeholder",()->"false");r.add("aep.seed.dev-data.enabled",()->"false");
    }
}
