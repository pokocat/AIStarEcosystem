package com.aistareco.postgres;

import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/** Runtime credentials validate the schema; the separate migration role applies DDL before deployment. */
@Configuration(proxyBeanMethods=false)
@Profile("postgres")
public class PostgresFlywayValidationConfiguration {
    @Bean
    public FlywayMigrationStrategy postgresSchemaValidation() { return Flyway::validate; }
}
