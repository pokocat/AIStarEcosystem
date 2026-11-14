package com.aistareco.aep.service;
@org.springframework.test.context.ActiveProfiles(value="postgresit",inheritProfiles=false)
@org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase(replace=org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace.NONE)
class WalletBucketPostgresIT extends WalletBucketAndConcurrencyTest {
    @org.junit.jupiter.api.BeforeEach
    void confirmsRealPostgresBaseline(@org.springframework.beans.factory.annotation.Autowired org.springframework.jdbc.core.JdbcTemplate jdbc) {
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT version FROM flyway_schema_history WHERE success=true ORDER BY installed_rank DESC LIMIT 1",String.class)).isEqualTo("83");
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT current_setting('server_version_num')::integer",Integer.class)).isBetween(180000,189999);
    }
    @org.springframework.test.context.DynamicPropertySource
    static void database(org.springframework.test.context.DynamicPropertyRegistry r) {
        com.aistareco.postgres.PostgresTestDatabase.configure(r,"test_wallet");
    }

    @org.springframework.beans.factory.annotation.Autowired CreditService pgCredits;
    @org.springframework.beans.factory.annotation.Autowired com.aistareco.aep.repository.WalletRepository pgWallets;
    @org.springframework.beans.factory.annotation.Autowired com.aistareco.aep.repository.LedgerEntryRepository pgLedger;

    @org.junit.jupiter.api.Test
    void caseAccentAndTrailingSpaceRetryFreezesOnlyOnce() throws Exception {
        String user="pg-retry-"+java.util.UUID.randomUUID();
        pgCredits.creditAccount(user,1000,com.aistareco.aep.model.LedgerEntry.LedgerEntryType.INCOME,"test_income","fund","synthetic");
        var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
        var gate=new java.util.concurrent.CountDownLatch(1);
        try {
            var futures=new java.util.ArrayList<java.util.concurrent.Future<String>>();
            for(String key:new String[]{"Résumé-Request ","RESUME-REQUEST"})futures.add(pool.submit(()->{
                gate.await();return pgCredits.hold(user,100,"migration_retry",key,"synthetic",com.aistareco.aep.billing.service.ModelChargeContext.NONE).getId();
            }));
            gate.countDown();String first=futures.get(0).get(30,java.util.concurrent.TimeUnit.SECONDS);
            org.assertj.core.api.Assertions.assertThat(futures.get(1).get(30,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(first);
            var wallet=pgWallets.findByUserId(user).orElseThrow();
            org.assertj.core.api.Assertions.assertThat(wallet.getPendingBalance()).isEqualTo(100);
            org.assertj.core.api.Assertions.assertThat(wallet.getTotalBalance()).isEqualTo(900);
            org.assertj.core.api.Assertions.assertThat(pgLedger.findByUserIdOrderByCreatedAtDesc(user).stream().filter(e->e.getEntryType()==com.aistareco.aep.model.LedgerEntry.LedgerEntryType.FREEZE).count()).isEqualTo(1);
        } finally {pool.shutdownNow();}
    }
}
