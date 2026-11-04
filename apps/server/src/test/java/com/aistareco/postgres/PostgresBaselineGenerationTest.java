package com.aistareco.postgres;

import jakarta.persistence.Entity;
import jakarta.persistence.Converter;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import java.nio.file.*;
import static org.assertj.core.api.Assertions.assertThat;

/** 离线映射校验及建表候选稿。正式基线还需包含 JDBC 专用表、历史索引与外键。 */
class PostgresBaselineGenerationTest {
    @Test void postgresMappingsGenerateWithoutJdbcLobOrMysqlTypes() throws Exception {
        String ddl=generate("org.hibernate.dialect.PostgreSQLDialect","target/postgresql-entity-schema.sql");
        assertThat(ddl.toLowerCase()).doesNotContain("longtext"," clob"," blob");
        assertThat(ddl).contains("\"cast\"");
    }
    @Test void mysqlRetainsLongtextCapacityWithoutTinytext() throws Exception {
        String ddl=generate("org.hibernate.dialect.MySQLDialect","target/mysql-entity-schema.sql").toLowerCase();
        assertThat(ddl).doesNotContain("tinytext");
        assertThat(ddl.split("longtext",-1).length-1).isGreaterThan(80);
    }
    private String generate(String dialect,String filename) throws Exception {
        Path target=Path.of(filename);Files.deleteIfExists(target);
        var registry=new StandardServiceRegistryBuilder()
                .applySetting("hibernate.auto_quote_keyword",true)
                .applySetting("hibernate.dialect",dialect)
                .applySetting("hibernate.temp.use_jdbc_metadata_defaults",false)
                .applySetting("hibernate.boot.allow_jdbc_metadata_access",false)
                .applySetting("hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy")
                .applySetting("hibernate.implicit_naming_strategy","org.springframework.boot.orm.jpa.hibernate.SpringImplicitNamingStrategy")
                .applySetting("jakarta.persistence.schema-generation.database.action","none")
                .applySetting("jakarta.persistence.schema-generation.scripts.action","create")
                .applySetting("jakarta.persistence.schema-generation.scripts.create-target",target.toString())
                .applySetting("hibernate.hbm2ddl.delimiter",";").build();
        try {
            var source=new MetadataSources(registry);
            var scanner=new ClassPathScanningCandidateComponentProvider(false);
            scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
            scanner.addIncludeFilter(new AnnotationTypeFilter(Converter.class));
            for(var bean:scanner.findCandidateComponents("com.aistareco"))source.addAnnotatedClass(Class.forName(bean.getBeanClassName()));
            try(var factory=source.buildMetadata().buildSessionFactory()) { assertThat(factory.getMetamodel().getEntities().size()).isGreaterThan(150); }
            return Files.readString(target);
        } finally {StandardServiceRegistryBuilder.destroy(registry);}
    }
}
