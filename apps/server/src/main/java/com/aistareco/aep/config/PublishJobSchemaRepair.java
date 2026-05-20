package com.aistareco.aep.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.List;
import java.util.Locale;

/**
 * Dev H2 compatibility repair for publish-job enum columns.
 *
 * Hibernate 6 creates CHECK constraints for Java enums on H2. ddl-auto=update
 * does not reliably update those CHECK clauses when we add a new enum value
 * such as AWAITING_USER, so old local DBs reject callback saves with 500.
 * Production MySQL is not touched; this only runs when the datasource is H2.
 */
@Component
public class PublishJobSchemaRepair {

    private static final Logger log = LoggerFactory.getLogger(PublishJobSchemaRepair.class);

    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    public PublishJobSchemaRepair(DataSource dataSource, JdbcTemplate jdbc) {
        this.dataSource = dataSource;
        this.jdbc = jdbc;
    }

    @PostConstruct
    void repairH2PublishJobEnumChecks() {
        if (!isH2()) return;
        dropCheckConstraints("AEP_PUBLISH_JOBS");
        dropCheckConstraints("AEP_PUBLISH_JOB_EVENTS");
    }

    private boolean isH2() {
        try (Connection c = dataSource.getConnection()) {
            String product = c.getMetaData().getDatabaseProductName();
            return product != null && product.toLowerCase(Locale.ROOT).contains("h2");
        } catch (Exception e) {
            log.warn("Unable to inspect datasource product for publish job schema repair: {}", e.getMessage());
            return false;
        }
    }

    private void dropCheckConstraints(String tableName) {
        List<String> constraintNames;
        try {
            constraintNames = jdbc.queryForList(
                    """
                    SELECT CONSTRAINT_NAME
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                    WHERE TABLE_NAME = ?
                      AND CONSTRAINT_TYPE = 'CHECK'
                    """,
                    String.class,
                    tableName
            );
        } catch (Exception e) {
            log.warn("Unable to list H2 CHECK constraints for {}: {}", tableName, e.getMessage());
            return;
        }
        for (String name : constraintNames) {
            if (name == null || name.isBlank()) continue;
            try {
                jdbc.execute("ALTER TABLE " + tableName + " DROP CONSTRAINT " + name);
                log.info("Dropped stale H2 CHECK constraint {} on {}", name, tableName);
            } catch (Exception e) {
                log.warn("Unable to drop H2 CHECK constraint {} on {}: {}", name, tableName, e.getMessage());
            }
        }
    }
}
