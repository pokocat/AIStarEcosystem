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
}
