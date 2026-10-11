package com.aistareco.testsupport;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.support.GenericApplicationContext;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class LegacyH2SchemaCustomizerFactoryTest {
    @Test
    void emptyH2DatabaseRunsRealMigrationsIncludingLegacyProviderAlterations() throws Exception {
        try (var context = new GenericApplicationContext()) {
            new LegacyH2SchemaCustomizerFactory().createContextCustomizer(getClass(), List.of())
                    .customizeContext(context, null);
            context.refresh();
            Flyway flyway = Flyway.configure()
                    .dataSource("jdbc:h2:mem:migration-" + UUID.randomUUID()
                            + ";DB_CLOSE_DELAY=-1", "sa", "")
                    .baselineOnMigrate(true)
                    .load();

            context.getBean(FlywayMigrationStrategy.class).migrate(flyway);

            assertThat(flyway.info().pending()).isEmpty();
            assertThat(flyway.info().applied()).anySatisfy(migration ->
                    assertThat(migration.getVersion().getVersion()).isEqualTo("48"));
            assertThat(flyway.info().applied()).anySatisfy(migration ->
                    assertThat(migration.getVersion().getVersion()).isEqualTo("49"));
            try (var connection = flyway.getConfiguration().getDataSource().getConnection();
                 var statement = connection.createStatement()) {
                // Querying the real columns and queue table fails if the bootstrap bypasses migrations.
                try (var result = statement.executeQuery(
                        "SELECT concurrency_limit, supplier_billing_mode FROM ai_model_providers")) {
                    assertThat(result.getMetaData().getColumnCount()).isEqualTo(2);
                }
                try (var result = statement.executeQuery("SELECT COUNT(*) FROM ai_generation_queue")) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getLong(1)).isZero();
                }
            }
        }
    }
}
