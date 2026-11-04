package com.aistareco.postgres;

import com.aistareco.aep.card.model.CardProfile;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.model.PromptTemplate;
import com.aistareco.aep.service.materialvideo.MaterialVideoInputAssetRepository;
import com.aistareco.aep.service.alerts.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import java.time.Instant;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql=false)
@AutoConfigureTestDatabase(replace=AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("postgresit")
@Testcontainers
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class StoragePostgresIT {
    @Container static final PostgreSQLContainer<?> PG=new PostgreSQLContainer<>("postgres:18.0-alpine")
            .withDatabaseName("aistar").withUsername("aistar_test").withPassword("local-test-only");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",PG::getJdbcUrl);r.add("spring.datasource.username",PG::getUsername);
        r.add("spring.datasource.password",PG::getPassword);
    }
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @Autowired MaterialVideoInputAssetRepository assets;
    @Autowired com.aistareco.aep.repository.LicenseBatchRepository batches;
    @Autowired com.aistareco.aep.repository.SellingChannelRepository channels;
    @Test void emptySchemaValidatesAllEntitiesWithoutLegacyMigrations() {
        assertThat(jdbc.queryForList("SELECT version FROM flyway_schema_history WHERE success=true",String.class)).containsExactly("74", "75", "76", "77");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",Integer.class)).isEqualTo(193);
        assertThat(jdbc.queryForObject("SELECT data_type FROM information_schema.columns WHERE table_name='card_profile' AND column_name='payload_json'",String.class)).isEqualTo("text");
        assertThat(jdbc.queryForObject("SELECT data_type FROM information_schema.columns WHERE table_name='aep_enterprise_members' AND column_name='billing_default'",String.class)).isEqualTo("character varying");
    }
    @Test void canvasCardAndPromptLargeTextRoundTripWithoutOidOrTruncation() {
        String text="中文😀完整保存".repeat(30000);String json="{\"text\":\""+text+"\"}";
        var tx=new TransactionTemplate(manager);
        tx.executeWithoutResult(s->{
            em.persist(CardProfile.builder().id("pg-card").ownerUserId("pg-owner").slug("pg-card").regNo("BC-PG").status("draft").payloadJson(json).build());
            em.persist(IpProject.builder().id("pg-project").ownerUserId("pg-owner").name("PG画布").status("draft").docJson(json).templateInstanceJson(json).build());
            em.persist(com.aistareco.aep.model.DramaCharacter.builder().id("pg-character").projectId("pg-drama").ownerUserId("pg-owner")
                    .name("角色").cast("主角").createdAt(java.time.OffsetDateTime.parse("2026-11-03T10:20:30Z")).build());
            em.persist(PromptTemplate.builder().id("pg-prompt").promptKey("pg.large-text").systemPrompt(text).userTemplate(text).paramsJson("{}").build());
            em.flush();em.clear();
            assertThat(em.find(CardProfile.class,"pg-card").getPayloadJson()).isEqualTo(json);
            assertThat(em.find(IpProject.class,"pg-project").getDocJson()).isEqualTo(json);
            assertThat(em.find(PromptTemplate.class,"pg-prompt").getSystemPrompt()).isEqualTo(text);
            assertThat(em.find(com.aistareco.aep.model.DramaCharacter.class,"pg-character").getCast()).isEqualTo("主角");
            assertThat(em.createQuery("select count(c) from CardProfile c where c.payloadJson like :needle",Long.class)
                    .setParameter("needle","%中文%").getSingleResult()).isEqualTo(1);
            assertThat(em.createQuery("select length(p.systemPrompt) from PromptTemplate p where p.id='pg-prompt'",Integer.class)
                    .getSingleResult()).isEqualTo(text.codePointCount(0,text.length()));
        });
    }
    @Test void concurrentSupplierReceiptUpsertsKeepSourceKeyAndWholeExpiry() throws Exception {
        var executor=Executors.newFixedThreadPool(6);var gate=new CountDownLatch(1);
        try {
            var futures=new java.util.ArrayList<Future<?>>();
            for(int i=0;i<12;i++){final int n=i;futures.add(executor.submit(()->{
                gate.await();new TransactionTemplate(manager).executeWithoutResult(s->assets.remember("shared-voice","owned/voice.wav","asset-"+n,Instant.parse("2027-01-01T01:02:03Z")));return null;
            }));}
            gate.countDown();for(var f:futures)f.get(30,TimeUnit.SECONDS);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM material_video_input_asset WHERE id='shared-voice'",Integer.class)).isEqualTo(1);
            new TransactionTemplate(manager).executeWithoutResult(s->assets.remember("shared-voice","must-not-replace","new-receipt",Instant.parse("2027-01-02T01:02:03Z")));
            assertThat(jdbc.queryForObject("SELECT source_key FROM material_video_input_asset WHERE id='shared-voice'",String.class)).isEqualTo("owned/voice.wav");
            assertThat(jdbc.queryForObject("SELECT expires_at FROM material_video_input_asset WHERE id='shared-voice'",java.sql.Timestamp.class).toInstant()).isEqualTo(Instant.parse("2027-01-02T01:02:03Z"));
        } finally {executor.shutdownNow();}
    }
    @Test void legacyStartupBackfillsPreserveImportedAuthorizationAndChannel() {
        jdbc.update("INSERT INTO aep_users(id,username,platforms,email_verified,phone_verified) VALUES(?,?,?,false,false)",
                "pg-imported-user","pg-imported-user","music,drama,celebrity");
        jdbc.update("INSERT INTO aep_license_batches(id,batch_no,name,total_count,activated_count,initial_credit_grant,issuer_tenant_id) VALUES(?,?,?,1,0,0,?)",
                "pg-imported-batch","pg-imported-batch","历史批次","legacy-tenant");
        new com.aistareco.aep.config.PlatformsAiavatarMigrationSeeder(jdbc).run();
        new com.aistareco.aep.config.SellingChannelMigrationSeeder(batches,channels,jdbc.getDataSource(),manager).run();
        assertThat(jdbc.queryForObject("SELECT platforms FROM aep_users WHERE id='pg-imported-user'",String.class)).isEqualTo("music,drama,celebrity");
        assertThat(jdbc.queryForObject("SELECT selling_channel_id FROM aep_license_batches WHERE id='pg-imported-batch'",String.class)).isNull();
        assertThat(channels.findByCode("platform-self")).isPresent();
    }
    @Test void durableAlertDedupeDoesNotAbortTransactionOrSendMessages() {
        var config=new FeishuAlertConfig();config.setEnabled(true);config.setAppId("local-test-app");config.setAppSecret("local-test-only");config.setChatId("oc_local");config.setUserId("ou_local");
        var client=mock(FeishuAlertClient.class);var service=new FeishuModelAlerts(jdbc,config,client);
        new TransactionTemplate(manager).executeWithoutResult(s->{
            service.enqueue("pg-task","PG_TEST","local-log",new RuntimeException("local diagnostic"));
            service.enqueue("pg-task","PG_TEST","local-log",new RuntimeException("duplicate"));
            assertThat(jdbc.queryForObject("SELECT count(*) FROM model_alert_delivery WHERE task_id='pg-task'",Integer.class)).isEqualTo(1);
        });
        verifyNoInteractions(client);
    }
    @Test void lowPrivilegeMetadataWorksOnPostgres18WithoutRemovedRulePrivilege() throws Exception {
        try(var owner=java.sql.DriverManager.getConnection(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());var st=owner.createStatement()) {
            st.execute("CREATE ROLE metadata_runtime LOGIN PASSWORD 'local-test-only'");
            st.execute("CREATE SCHEMA metadata_visible");st.execute("CREATE SCHEMA metadata_hidden");
            st.execute("CREATE TABLE metadata_visible.scope_probe(id integer primary key,identity_uid text unique)");
            st.execute("CREATE TABLE metadata_hidden.scope_probe(id integer primary key,identity_uid text unique)");
            st.execute("GRANT USAGE ON SCHEMA metadata_visible TO metadata_runtime");st.execute("GRANT SELECT ON metadata_visible.scope_probe TO metadata_runtime");
            try(var connection=java.sql.DriverManager.getConnection(PG.getJdbcUrl()+"?currentSchema=metadata_visible&hideUnprivilegedObjects=true","metadata_runtime","local-test-only")) {
                var schemas=new java.util.ArrayList<String>();
                try(var rs=connection.getMetaData().getTables(null,null,"scope_probe",new String[]{"TABLE"})) {while(rs.next())schemas.add(rs.getString("TABLE_SCHEM"));}
                assertThat(schemas).containsExactly("metadata_visible");
                try(var rs=connection.getMetaData().getColumns(null,"metadata_visible","scope_probe","identity_uid")){assertThat(rs.next()).isTrue();}
            } finally {st.execute("DROP SCHEMA metadata_visible CASCADE");st.execute("DROP SCHEMA metadata_hidden CASCADE");st.execute("DROP ROLE metadata_runtime");}
        }
    }
    @Test void copyBytesPreservesLongUnicodeAndEmbeddedDelimitersWithCurrentDriver() throws Exception {
        String value="中文😀".repeat(20000)+"\tquoted \" value\nnext line";
        try(var connection=java.sql.DriverManager.getConnection(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());var st=connection.createStatement()) {
            connection.setAutoCommit(false);
            try {
                st.execute("CREATE TEMP TABLE driver_copy_probe(payload text)");
                String csv="\""+value.replace("\"","\"\"")+"\"\n";
                long rows=connection.unwrap(org.postgresql.PGConnection.class).getCopyAPI().copyIn("COPY driver_copy_probe(payload) FROM STDIN WITH (FORMAT CSV)",new java.io.ByteArrayInputStream(csv.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
                assertThat(rows).isEqualTo(1);
                try(var rs=st.executeQuery("SELECT payload FROM driver_copy_probe")){assertThat(rs.next()).isTrue();assertThat(rs.getString(1).equals(value)).as("UTF-8 COPY preserves the complete value and delimiters").isTrue();assertThat(rs.next()).isFalse();}
            } finally {connection.rollback();}
        }
    }
    @Test void runtimeValidatesWithReadOnlyHistoryAndRejectsPendingDdl() throws Exception {
        var directory=java.nio.file.Files.createTempDirectory("pg-runtime-validation-");
        java.nio.file.Files.writeString(directory.resolve("V1__initial.sql"),"CREATE TABLE schema_probe(id integer primary key)");
        String schema="runtime_validation";
        try(var owner=java.sql.DriverManager.getConnection(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());var st=owner.createStatement()) {
            st.execute("CREATE ROLE schema_runtime LOGIN PASSWORD 'local-test-only'");
            var migration=org.flywaydb.core.Flyway.configure().dataSource(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword()).defaultSchema(schema).schemas(schema).locations("filesystem:"+directory).load();migration.migrate();
            st.execute("GRANT USAGE ON SCHEMA runtime_validation TO schema_runtime");st.execute("GRANT SELECT ON runtime_validation.flyway_schema_history TO schema_runtime");
            try {
                var runtime=org.flywaydb.core.Flyway.configure().dataSource(PG.getJdbcUrl()+"?currentSchema="+schema+"&hideUnprivilegedObjects=true","schema_runtime","local-test-only").defaultSchema(schema).schemas(schema).locations("filesystem:"+directory).load();
                var strategy=new PostgresFlywayValidationConfiguration().postgresSchemaValidation();strategy.migrate(runtime);
                java.nio.file.Files.writeString(directory.resolve("V2__requires_migrator.sql"),"CREATE TABLE must_not_exist(id integer primary key)");
                org.assertj.core.api.Assertions.assertThatThrownBy(()->strategy.migrate(runtime)).isInstanceOf(org.flywaydb.core.api.FlywayException.class).hasMessageContaining("not applied");
                try(var rs=st.executeQuery("SELECT count(*) FROM information_schema.tables WHERE table_schema='runtime_validation' AND table_name='must_not_exist'")){rs.next();assertThat(rs.getInt(1)).isZero();}
                try(var rs=st.executeQuery("SELECT count(*) FROM runtime_validation.flyway_schema_history WHERE version IS NOT NULL")){rs.next();assertThat(rs.getInt(1)).isEqualTo(1);}
            } finally {st.execute("DROP SCHEMA runtime_validation CASCADE");st.execute("DROP ROLE schema_runtime");}
        } finally {try(var files=java.nio.file.Files.list(directory)){for(var f:files.toList())java.nio.file.Files.deleteIfExists(f);}java.nio.file.Files.deleteIfExists(directory);}
    }

}
