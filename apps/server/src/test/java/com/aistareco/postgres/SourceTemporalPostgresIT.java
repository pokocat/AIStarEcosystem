package com.aistareco.postgres;

import com.aistareco.aep.clip.model.ClipTemplate;
import com.aistareco.aep.model.DramaCharacter;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MySQLContainer;
import java.time.*;
import java.util.*;
import java.nio.file.*;
import static org.assertj.core.api.Assertions.*;

/** Reproduces the source dialect/JVM/JDBC contract with synthetic data only. */
class SourceTemporalPostgresIT {
    @Test void derivesInstantAndOffsetBindingsFromActualMysqlInsteadOfAssumingJvmZone() throws Exception {
        TimeZone original=TimeZone.getDefault();TimeZone.setDefault(TimeZone.getTimeZone("Asia/Shanghai"));
        try(var mysql=new MySQLContainer<>("mysql:8.0.36").withDatabaseName("source_contract").withEnv("TZ","Asia/Shanghai")) {
            mysql.start();String url=mysql.getJdbcUrl()+(mysql.getJdbcUrl().contains("?")?"&":"?")+"serverTimezone=Asia/Shanghai";
            var registry=new StandardServiceRegistryBuilder().applySetting("hibernate.connection.url",url)
                .applySetting("hibernate.connection.username",mysql.getUsername()).applySetting("hibernate.connection.password",mysql.getPassword())
                .applySetting("hibernate.dialect","org.hibernate.dialect.MySQLDialect").applySetting("hibernate.hbm2ddl.auto","create-drop")
                .applySetting("hibernate.auto_quote_keyword",true)
                .applySetting("hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy").build();
            Instant instant=Instant.parse("2026-01-02T03:04:05.123456Z");var result=new TreeMap<String,String>();
            try(var factory=new MetadataSources(registry).addAnnotatedClass(ClipTemplate.class).addAnnotatedClass(DramaCharacter.class).buildMetadata().buildSessionFactory()) {
                try(var session=factory.openSession()) {
                    var tx=session.beginTransaction();session.persist(ClipTemplate.builder().id("clock-instant").name("Synthetic").industry("test").themeKey("test").description("test").scriptSkeletonJson(Map.of("synthetic",true)).createdAt(instant).build());
                    session.persist(DramaCharacter.builder().id("clock-offset").projectId("synthetic").ownerUserId("synthetic").createdAt(instant.atOffset(ZoneOffset.ofHours(8))).build());tx.commit();
                    session.clear();assertThat(session.find(ClipTemplate.class,"clock-instant").getCreatedAt()).isEqualTo(instant);
                    assertThat(session.find(DramaCharacter.class,"clock-offset").getCreatedAt().toInstant()).isEqualTo(instant);
                    session.doWork(c->{
                        for(var item:Map.of("java.time.Instant","clip_template","java.time.OffsetDateTime","drama_character").entrySet()) {
                            try(var statement=c.createStatement();var rs=statement.executeQuery("select created_at from "+item.getValue())) {
                                rs.next();String raw=rs.getString(1);LocalDateTime wall=LocalDateTime.parse(raw.replace(' ','T'));
                                String zone=wall.toInstant(ZoneOffset.UTC).equals(instant)?"UTC":wall.atZone(ZoneId.of("Asia/Shanghai")).toInstant().equals(instant)?"Asia/Shanghai":"UNKNOWN";
                                assertThat(zone).isNotEqualTo("UNKNOWN");result.put(item.getKey(),zone);
                            }
                        }
                        try(var statement=c.createStatement();var rs=statement.executeQuery("select cast('2026-01-02 03:04:05.123456' as datetime(6))")) {
                            rs.next();Instant jdbc=rs.getTimestamp(1).toInstant();
                            assertThat(jdbc).isEqualTo(LocalDateTime.parse("2026-01-02T03:04:05.123456").atZone(ZoneId.of("Asia/Shanghai")).toInstant());result.put("unmapped_jdbc_timestamp","Asia/Shanghai");
                        }
                    });
                }
            } finally {StandardServiceRegistryBuilder.destroy(registry);}
            new com.fasterxml.jackson.databind.ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(Path.of("target/source-temporal-contract.json").toFile(),result);
        } finally {TimeZone.setDefault(original);}
    }
}
