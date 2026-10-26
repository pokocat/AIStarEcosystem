package com.aistareco.aep.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
class StudioOperationsDashboardIntegrationTest {
    @Autowired JdbcTemplate jdbc;

    @Test
    void emptyDatabaseReturnsPartialRatherThanFakeGreenAndKeepsSevenBeijingBuckets() {
        var dashboard = new StudioOperationsDashboardService(jdbc, new ObjectMapper()).dashboard(7);
        assertThat(dashboard.health().checks()).hasSize(9);
        assertThat(dashboard.health().status()).isEqualTo("partial");
        assertThat(dashboard.health().reconciliationAgent().status()).isEqualTo("unavailable");
        assertThat(dashboard.business().dailySpend()).hasSize(7);
        assertThat(dashboard.technology().queue().concurrencyStatus()).isEqualTo("unavailable");

        var startInBeijing = dashboard.window().startInclusive().atZone(ZoneId.of("Asia/Shanghai"));
        assertThat(startInBeijing.toLocalTime()).isEqualTo(LocalTime.MIDNIGHT);
        assertThat(dashboard.business().dailySpend().get(0).date()).isEqualTo(startInBeijing.toLocalDate().toString());
        assertThat(dashboard.window().endExclusive()).isEqualTo(dashboard.generatedAt());
    }

    @Test
    void keepsWalletAndScopedGrantLiabilitiesSeparateAndOnlyCountsActualSpend() {
        Instant now = Instant.now();
        jdbc.update("insert into aep_wallets (id,user_id,account_type,account_key,total_balance,license_balance,recharge_balance,gift_balance,pending_balance,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?)",
                "wallet-a", "user-a", "personal", "personal:user-a", 1000, 0, 0, 1000, 0,
                Timestamp.from(now), Timestamp.from(now));
        jdbc.update("insert into aep_credit_grants (id,wallet_id,campaign_id,amount,available,frozen,spent,expired,source,source_reference,reason,created_by,expires_at,created_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                "grant-a", "wallet-a", "campaign-a", 300, 300, 0, 0, 0, "campaign", "source-a",
                "赠款批次", "admin-a", Timestamp.from(now.plusSeconds(86400)), Timestamp.from(now));

        insertLedger("ordinary-spend", "SPEND", -200, now);
        insertLedger("scoped-spend", "SCOPED_SPEND", -120, now);
        insertLedger("scoped-grant", "SCOPED_GRANT", 500, now);
        insertLedger("scoped-release", "SCOPED_RELEASE", 380, now);

        var dashboard = new StudioOperationsDashboardService(jdbc, new ObjectMapper()).dashboard(1);
        assertThat(dashboard.business().totals().walletCredits()).isEqualTo(200);
        assertThat(dashboard.business().totals().grantCredits()).isEqualTo(120);
        assertThat(dashboard.business().totals().totalCredits()).isEqualTo(320);
        assertThat(dashboard.business().issuance().walletBalance()).isEqualTo(1000);
        assertThat(dashboard.business().issuance().grantAvailable()).isEqualTo(300);
        assertThat(dashboard.business().issuance().note()).contains("分开列示", "未重复相加");
    }

    @Test
    void groupsTechnologyByObservedSupplierAndReturnsBoundedHourlyOutcomes() {
        Instant now = Instant.now();
        jdbc.update("insert into material_video_job (id,owner_user_id,status,progress,credits_held,provider_used,model_used,error_code,error_message,created_at,updated_at,completed_at) values (?,?,?,?,?,?,?,?,?,?,?,?)",
                "video-hourly-a", "user-a", "failed", 100, 0, "supplier-a", "model-a",
                "PROVIDER_TIMEOUT", "provider timeout", Timestamp.from(now.minusSeconds(600)),
                Timestamp.from(now.minusSeconds(300)), Timestamp.from(now.minusSeconds(300)));

        var dashboard = new StudioOperationsDashboardService(jdbc, new ObjectMapper()).dashboard(7);
        assertThat(dashboard.technology().models()).hasSize(1);
        var model = dashboard.technology().models().get(0);
        assertThat(model.supplier()).isEqualTo("supplier-a");
        assertThat(model.hourlyOutcomes()).hasSize(24);
        assertThat(model.hourlyOutcomes()).anyMatch(bucket -> bucket.status().equals("issue") && bucket.failed() == 1);
        assertThat(model.hourlyOutcomes()).anyMatch(bucket -> bucket.status().equals("no_calls"));
    }

    private void insertLedger(String id, String type, long amount, Instant createdAt) {
        jdbc.update("insert into aep_ledger_entries (id,wallet_id,user_id,entry_type,plane,amount,balance_after,description,created_at) values (?,?,?,?,?,?,?,?,?)",
                id, "wallet-a", "user-a", type, "CREDIT", amount, 0, "口径验收", Timestamp.from(createdAt));
    }
}
