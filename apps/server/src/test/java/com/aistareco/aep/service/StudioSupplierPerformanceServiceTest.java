package com.aistareco.aep.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
class StudioSupplierPerformanceServiceTest {
    @Autowired JdbcTemplate jdbc;

    @Test
    void statisticsAndDetailsUseTheSameExclusionAndSuccessOnlyLatency() {
        Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        insertIp("ok", "done", null, null, now.minusSeconds(600), now.minusSeconds(480));
        String syntheticPhone = "138" + "1234" + "5678";
        insertIp("moderated", "failed", "CONTENT_MODERATION", "审核拒绝 " + syntheticPhone, now.minusSeconds(500), now.minusSeconds(490));
        insertIp("balance", "failed", "INSUFFICIENT_BALANCE", "provider balance", now.minusSeconds(400), now.minusSeconds(390));
        insertIp("running", "running", null, null, now.minusSeconds(300), null);
        var service = new StudioSupplierPerformanceService(jdbc, new ObjectMapper());
        ZoneId zone = ZoneId.of("Asia/Shanghai");
        String from = local(now.minusSeconds(3600), zone), to = local(now.plusSeconds(60), zone);

        var all = service.query(from, to, zone.getId(), null, null, "all", "all", List.of(), "", 0, 20);
        assertThat(jdbc.queryForObject("select count(*) from ip_run where created_at >= ? and created_at < ?", Long.class,
                Timestamp.from(all.window().startInclusive()), Timestamp.from(all.window().endExclusive()))).isEqualTo(4);
        assertThat(all.summary().tasks()).isEqualTo(4);
        assertThat(all.summary().deliverySuccessRate()).isEqualTo(1.0 / 3.0);
        assertThat(all.summary().latencySamples()).isEqualTo(1);
        assertThat(all.summary().p50Seconds()).isEqualTo(120);
        assertThat(all.details().items()).hasSize(4);
        assertThat(all.details().items()).allMatch(item -> !item.errorCode().contains(syntheticPhone));

        var excluded = service.query(from, to, zone.getId(), "endpoint-a", "model-a", "image", "all",
                List.of("insufficient-balance"), "", 0, 20);
        assertThat(excluded.summary().tasks()).isEqualTo(3);
        assertThat(excluded.summary().excludedTasks()).isEqualTo(1);
        assertThat(excluded.summary().deliverySuccessRate()).isEqualTo(.5);
        assertThat(excluded.details().items()).noneMatch(item -> item.id().equals("balance"));
    }

    @Test
    void rejectsUnsupportedTimezoneAndUnboundedRange() {
        var service = new StudioSupplierPerformanceService(jdbc, new ObjectMapper());
        assertThatThrownBy(() -> service.query(null, null, "Europe/Paris", null, null, "all", "all", List.of(), null, 0, 20))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("时区");
        assertThatThrownBy(() -> service.query("2026-01-01T00:00", "2026-03-01T00:00", "UTC", null, null, "all", "all", List.of(), null, 0, 20))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("31 天");
    }

    @Test
    void dailyBucketsFollowLocalCalendarAcrossLosAngelesDst() {
        var service = new StudioSupplierPerformanceService(jdbc, new ObjectMapper());
        var result = service.query("2026-10-31T00:00", "2026-11-03T00:00", "America/Los_Angeles",
                null, null, "all", "all", List.of(), null, 0, 20);
        assertThat(result.window().bucket()).isEqualTo("day");
        assertThat(result.trend()).hasSize(3);
        assertThat(Duration.between(result.trend().get(1).start(), result.trend().get(2).start()).toHours()).isEqualTo(25);
    }

    @Test
    void keepsFailureKindsAndOwnershipSeparate() {
        assertThat(StudioSupplierPerformanceService.classify("INSUFFICIENT_BALANCE", "").category()).isEqualTo("insufficient-balance");
        assertThat(StudioSupplierPerformanceService.classify("HTTP_502", "").ownership()).isEqualTo("供应商");
        assertThat(StudioSupplierPerformanceService.classify("OUTPUT_SIZE_MISMATCH", "").category()).isEqualTo("result-validation");
        assertThat(StudioSupplierPerformanceService.classify("FAILED", "unclassified").ownership()).isEqualTo("未知");
    }

    private void insertIp(String id, String status, String code, String message, Instant created, Instant finished) {
        jdbc.update("insert into ip_run (id,project_id,owner_user_id,node_id,kind,status,stage,pct,cost,cancel_requested,input_json,error_code,error_message,created_at,finished_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                id, "project", "user", "node-" + id, "generate", status,
                status.equals("running") ? "image.generate" : status, status.equals("done") ? 100 : 0, 0, false,
                "{\"_exec\":{\"endpointId\":\"model-a\",\"providerId\":\"endpoint-a\",\"providerModel\":\"model-a\"}}",
                code, message, OffsetDateTime.ofInstant(created, ZoneOffset.UTC),
                finished == null ? null : OffsetDateTime.ofInstant(finished, ZoneOffset.UTC));
    }

    private String local(Instant instant, ZoneId zone) {
        return instant.atZone(zone).toLocalDateTime().format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"));
    }
}
