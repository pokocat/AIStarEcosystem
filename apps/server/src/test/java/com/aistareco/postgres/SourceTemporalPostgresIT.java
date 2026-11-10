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
            try(var factory=new MetadataSources(registry).addAnnotatedClass(ClipTemplate.class).addAnnotatedClass(DramaCharacter.class).addAnnotatedClass(com.aistareco.aep.service.materialvideo.VideoAssetLibraryRecord.class).buildMetadata().buildSessionFactory()) {
                try(var session=factory.openSession()) {
                    var tx=session.beginTransaction();session.persist(ClipTemplate.builder().id("clock-instant").name("Synthetic").industry("test").themeKey("test").description("test").scriptSkeletonJson(Map.of("synthetic",true)).createdAt(instant).build());
                    var library=new com.aistareco.aep.service.materialvideo.VideoAssetLibraryRecord();
                    library.setId("clock-library");library.setName("Synthetic");library.setAdapter("ark");library.setConfigJson("{}");library.setCreatedAt(instant);library.setUpdatedAt(instant);session.persist(library);
                    session.persist(DramaCharacter.builder().id("clock-offset").projectId("synthetic").ownerUserId("synthetic").createdAt(instant.atOffset(ZoneOffset.ofHours(8))).build());tx.commit();
                    session.clear();assertThat(session.find(ClipTemplate.class,"clock-instant").getCreatedAt()).isEqualTo(instant);
                    assertThat(session.find(DramaCharacter.class,"clock-offset").getCreatedAt().toInstant()).isEqualTo(instant);
                    session.doWork(c->{
                        try(var statement=c.createStatement();var rs=statement.executeQuery("select created_at from video_asset_library")) {
                            rs.next();assertThat(LocalDateTime.parse(rs.getString(1).replace(' ','T')).toInstant(ZoneOffset.UTC)).isEqualTo(instant);
                            result.put("video_asset_library.jpa_instant","UTC");
                        }
                        // The live library also has DATETIME values from SQL seeding and raw JDBC.
                        // Prove those writers differ from the JPA Instant path in the same column.
                        try(var statement=c.createStatement()) {
                            statement.execute("INSERT INTO video_asset_library(id,name,adapter,config_json,created_at,updated_at) VALUES('clock-seed','Synthetic','onetoken','{}',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))");
                            try(var rs=statement.executeQuery("SELECT TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(6),created_at) FROM video_asset_library WHERE id='clock-seed'")) {
                                rs.next();assertThat(rs.getLong(1)).isBetween(28799L,28800L);
                            }
                            result.put("video_asset_library.sql_seed","Asia/Shanghai");
                        }
                        try(var statement=c.prepareStatement("UPDATE video_asset_library SET updated_at=? WHERE id='clock-library'")) {
                            statement.setTimestamp(1,java.sql.Timestamp.from(instant));statement.executeUpdate();
                        }
                        try(var statement=c.createStatement();var rs=statement.executeQuery("SELECT updated_at FROM video_asset_library WHERE id='clock-library'")) {
                            rs.next();assertThat(LocalDateTime.parse(rs.getString(1).replace(' ','T')).atZone(ZoneId.of("Asia/Shanghai")).toInstant()).isEqualTo(instant);
                            result.put("video_asset_library.jdbc_updated_at","Asia/Shanghai");
                        }
                        // MySQL TIMESTAMP values are serialized by the exporter after SET time_zone=UTC.
                        // Unlike DATETIME, the text changes with the SQL session timezone.
                        try(var statement=c.createStatement()) {
                            statement.execute("CREATE TEMPORARY TABLE portrait_export_clock(created_at TIMESTAMP NOT NULL)");
                            statement.execute("SET SESSION time_zone='+08:00'");
                            statement.execute("INSERT INTO portrait_export_clock VALUES('2026-01-02 11:04:05')");
                            statement.execute("SET SESSION time_zone='+00:00'");
                            try(var rs=statement.executeQuery("SELECT created_at FROM portrait_export_clock")) {
                                rs.next();assertThat(LocalDateTime.parse(rs.getString(1).replace(' ','T')).toInstant(ZoneOffset.UTC)).isEqualTo(instant.truncatedTo(java.time.temporal.ChronoUnit.SECONDS));
                            }
                            result.put("video_asset_person_and_portrait.timestamp_export","UTC");
                            statement.execute("SET SESSION time_zone='+08:00'");
                        }

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
