package com.aistareco.testsupport;

import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.context.ContextConfigurationAttributes;
import org.springframework.test.context.ContextCustomizer;
import org.springframework.test.context.ContextCustomizerFactory;
import org.springframework.test.context.MergedContextConfiguration;

import java.sql.SQLException;
import java.util.List;

/** Test-only bootstrap for Hibernate-owned tables altered by real Flyway migrations. */
public final class LegacyH2SchemaCustomizerFactory implements ContextCustomizerFactory {
    @Override
    public ContextCustomizer createContextCustomizer(Class<?> testClass,
            List<ContextConfigurationAttributes> configAttributes) {
        return Bootstrap.INSTANCE;
    }

    // A stable customizer identity preserves Spring's context cache across tests.
    private enum Bootstrap implements ContextCustomizer {
        INSTANCE;

        @Override
        public void customizeContext(ConfigurableApplicationContext context,
                MergedContextConfiguration mergedConfig) {
            FlywayMigrationStrategy strategy = flyway -> {
                try (var connection = flyway.getConfiguration().getDataSource().getConnection()) {
                    if ("H2".equals(connection.getMetaData().getDatabaseProductName())) {
                        try (var statement = connection.createStatement()) {
                            // @DataJpaTest replaces the configured datasource with plain H2.
                            // Keep those fresh databases compatible with our real MySQL SQL too.
                            statement.execute("SET MODE MySQL");
                            // Production already owns these base tables. On fresh test databases,
                            // establish them before Flyway; Hibernate adds the remaining entity fields.
                            statement.execute("CREATE TABLE IF NOT EXISTS ai_model_providers "
                                    + "(id VARCHAR(255) PRIMARY KEY, default_model VARCHAR(255), base_url VARCHAR(2000))");
                            statement.execute("CREATE TABLE IF NOT EXISTS material_video_job "
                                    + "(id VARCHAR(160) PRIMARY KEY)");
                        }
                    }
                } catch (SQLException e) {
                    throw new IllegalStateException("Cannot bootstrap legacy H2 test schema", e);
                }
                // Run every real migration and validation; never bypass V48/V49.
                flyway.migrate();
            };
            context.getBeanFactory().registerSingleton("legacyH2TestMigrationStrategy", strategy);
        }
    }
}
