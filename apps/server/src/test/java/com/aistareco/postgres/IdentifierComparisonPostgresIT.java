package com.aistareco.postgres;

import com.aistareco.aep.repository.AdminUserRepository;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.PlatformConfigRepository;
import com.aistareco.aep.card.repository.CardProfileRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@DataJpaTest(showSql=false)
@AutoConfigureTestDatabase(replace=AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("postgresit")
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class IdentifierComparisonPostgresIT {
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        PostgresTestDatabase.configure(r,"test_identifier");
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired javax.sql.DataSource dataSource;
    @Autowired AdminUserRepository admins;
    @Autowired AepUserRepository users;
    @Autowired PlatformConfigRepository configs;
    @Autowired CardProfileRepository cards;
    @Autowired PlatformTransactionManager manager;

    @Test void loginLookupPreservesCaseAccentsAndPadSpaceWithoutRewritingName() {
        jdbc.update("insert into admin_users(id,username,email) values (?,?,?)","sem-admin","CaféAdmin  ","Café@Example.com  ");
        assertThat(admins.findByUsername("CAFEADMIN")).get().extracting(x->x.getUsername()).isEqualTo("CaféAdmin  ");
        assertThat(admins.findByUsername("cafeadmin  ")).isPresent();
        assertThat(admins.existsByUsername("cafeadmin")).isTrue();
        assertThat(admins.findByEmail("CAFE@example.COM")).isPresent();
        assertThatThrownBy(()->jdbc.update("insert into admin_users(id,username) values (?,?)","sem-admin-collision","cafeadmin")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(admins.findByUsername(" cafeadmin")).isEmpty();
    }
    @Test void endUserLookupUsesSameRule() {
        jdbc.update("insert into aep_users(id,username,email,email_verified,phone_verified) values (?,?,?,false,false)","sem-user","RésuméUser ","résumé@example.com ");
        assertThat(users.findByUsername("RESUMEUSER")).isPresent();
        assertThat(users.findByEmail("resume@example.com")).isPresent();
    }
    @Test void configAndSlugHaveMatchingReadAndUniqueRules() {
        jdbc.update("insert into aep_platform_configs(id,config_key,version,value_json) values (?,?,0,'{}')","sem-config","Résumé.Config  ");
        assertThat(configs.findByConfigKey("RESUME.CONFIG")).isPresent();
        assertThat(configs.existsByConfigKey("resume.config ")).isTrue();
        Boolean found = new TransactionTemplate(manager).execute(s->configs.lockByConfigKey("resume.config").isPresent());
        assertThat(found).isTrue();
        jdbc.update("insert into card_profile(id,owner_user_id,slug,reg_no,status,payload_json) values (?,?,?,?,'draft','{}')","sem-card","sem-user","Café-Card ","sem-reg");
        assertThat(cards.findBySlug("CAFE-CARD")).isPresent();
        assertThatThrownBy(()->jdbc.update("insert into card_profile(id,owner_user_id,slug,reg_no,status,payload_json) values (?,?,?,?,'draft','{}')","sem-card-2","sem-user","cafe-card","sem-reg2")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @Test void opaqueIdentityAndCredentialValuesStayExact() {
        jdbc.update("insert into aep_users(id,username,identity_uid,email_verified,phone_verified) values (?,?,?,false,false)","CaseSensitive-ID","opaque-user-a","OpaqueUID");
        jdbc.update("insert into aep_users(id,username,identity_uid,email_verified,phone_verified) values (?,?,?,false,false)","casesensitive-id","opaque-user-b","opaqueuid");
        assertThat(users.findByIdentityUid("OPAQUEUID")).isEmpty();
        assertThat(users.findById("CaseSensitive-ID")).get().extracting(x->x.getIdentityUid()).isEqualTo("OpaqueUID");
        assertThat(jdbc.queryForObject("select 'AbC-token'::text = 'abc-token'::text",Boolean.class)).isFalse();
    }
    @Test void concurrentEquivalentNamesAdmitExactlyOneInsert() throws Exception {
        var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try {
            var outcomes=new java.util.ArrayList<Future<Boolean>>();
            for(String name:new String[]{"RésuméRace ","RESUMERACE"})outcomes.add(pool.submit(()->{
                gate.await();try{new TransactionTemplate(manager).executeWithoutResult(s->jdbc.update("insert into admin_users(id,username) values (?,?)",java.util.UUID.randomUUID().toString(),name));return true;}
                catch(org.springframework.dao.DataIntegrityViolationException conflict){return false;}
            }));
            gate.countDown();int accepted=0;for(var f:outcomes)if(f.get(20,TimeUnit.SECONDS))accepted++;
            assertThat(accepted).isEqualTo(1);
        } finally {pool.shutdownNow();}
    }
    @Test void identityIndexCheckDoesNotMergeSameNamedIndexesAcrossSchemas() throws Exception {
        jdbc.execute("create schema uid_metadata_shadow");
        jdbc.execute("create table uid_metadata_shadow.aep_users(identity_uid varchar(32) unique)");
        try {assertIdentityIndexMessage("public",false);} finally {jdbc.execute("drop schema uid_metadata_shadow cascade");}
    }
    @Test void identityIndexCheckDoesNotBorrowAnotherSchemasConstraint() throws Exception {
        jdbc.execute("create schema uid_metadata_unindexed");
        jdbc.execute("create table uid_metadata_unindexed.aep_users(identity_uid varchar(32))");
        try {assertIdentityIndexMessage("uid_metadata_unindexed",true);} finally {jdbc.execute("drop schema uid_metadata_unindexed cascade");}
    }
    private void assertIdentityIndexMessage(String schema,boolean missing) throws Exception {
        var logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(com.aistareco.aep.identity.IdentityUidIndexCheck.class);
        var appender=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();appender.start();logger.addAppender(appender);
        try(var connection=dataSource.getConnection()){
            String original=connection.getSchema();connection.setSchema(schema);
            try {
                var scoped=new org.springframework.jdbc.datasource.SingleConnectionDataSource(connection,true);
                new com.aistareco.aep.identity.IdentityUidIndexCheck(scoped).run(new org.springframework.boot.DefaultApplicationArguments(new String[0]));
            } finally {connection.setSchema(original);}
            assertThat(appender.list.stream().anyMatch(event->event.getFormattedMessage().contains("缺少唯一约束"))).isEqualTo(missing);
        } finally {logger.detachAppender(appender);appender.stop();}
    }

}
