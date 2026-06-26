package com.aistareco.aep.service;

import com.aistareco.aep.config.LedgerPlaneBackfill;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.LedgerEntry.LedgerEntryType;
import com.aistareco.aep.model.LedgerEntry.Plane;
import com.aistareco.aep.repository.LedgerEntryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * v2 §1/§4.2 两平面 plane 列：分类真源 + @PrePersist 派生 + DB CHECK 不变量（积分面永不携带现金凭证）
 * + 历史行回填。独立 datasource，避免污染其它测试 context。
 */
@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:ledger-plane;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.seed.dev-data.enabled=true"
})
@Transactional // @Modifying backfill 需事务；同时给每个测试方法回滚隔离
class LedgerPlaneTest {

    @Autowired private LedgerEntryRepository ledgerRepo;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private LedgerPlaneBackfill backfill;

    @Test
    void planeForClassifiesMoneyAndCreditExhaustively() {
        Set<LedgerEntryType> money = EnumSet.of(
                LedgerEntryType.RECHARGE, LedgerEntryType.REFUND_CASH, LedgerEntryType.WITHDRAW);
        for (LedgerEntryType t : LedgerEntryType.values()) {
            Plane expected = money.contains(t) ? Plane.MONEY : Plane.CREDIT;
            assertEquals(expected, LedgerEntry.planeFor(t), "planeFor mis-classified " + t);
        }
        assertEquals(Plane.CREDIT, LedgerEntry.planeFor(null), "null entryType 应安全归积分面");
    }

    @Test
    void prePersistAssignsMoneyPlaneAndLinksCashArtifact() {
        LedgerEntry e = ledgerRepo.save(LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId("w1").userId("u1")
                .entryType(LedgerEntryType.RECHARGE)
                .amount(1000).balanceAfter(1000)
                .referenceType("recharge_order").referenceId("ord-1")
                .createdAt(Instant.now())
                .build());
        LedgerEntry reloaded = ledgerRepo.findById(e.getId()).orElseThrow();
        assertEquals(Plane.MONEY, reloaded.getPlane());
        assertEquals("ord-1", reloaded.getCashArtifactId(), "资金面应回填 cashArtifactId=referenceId");
    }

    @Test
    void prePersistForcesCreditPlaneCashArtifactNull() {
        // 即使调用方误塞 cashArtifactId，积分面也强制清空（守 CHECK）。
        LedgerEntry e = ledgerRepo.save(LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId("w1").userId("u1")
                .entryType(LedgerEntryType.GIFT)
                .cashArtifactId("should-be-cleared")
                .amount(200).balanceAfter(200)
                .referenceType("recharge_order_bonus").referenceId("ord-1")
                .createdAt(Instant.now())
                .build());
        LedgerEntry reloaded = ledgerRepo.findById(e.getId()).orElseThrow();
        assertEquals(Plane.CREDIT, reloaded.getPlane());
        assertNull(reloaded.getCashArtifactId(), "积分面 cashArtifactId 必须为 null");
    }

    @Test
    void dbCheckRejectsCreditPlaneCarryingCashArtifact() {
        // 绕过 @PrePersist 用原生 SQL 直插一条「积分面 + 现金凭证非空」的脏行 → DB CHECK 必须拒绝。
        assertThrows(Exception.class, () -> jdbc.update(
                "INSERT INTO aep_ledger_entries " +
                        "(id, wallet_id, user_id, entry_type, plane, cash_artifact_id, amount, balance_after, created_at) " +
                        "VALUES (?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID().toString(), "w1", "u1", "GIFT", "CREDIT", "ord-illegal",
                100, 100, Instant.now()));
    }

    @Test
    void backfillFillsNullPlaneRowsByEntryType() {
        // 原生插入 plane 为 null 的历史行（绕过 @PrePersist）：一条资金面 RECHARGE、一条积分面 ADJUST。
        String moneyId = UUID.randomUUID().toString();
        String creditId = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO aep_ledger_entries (id, wallet_id, user_id, entry_type, amount, balance_after, created_at) " +
                "VALUES (?,?,?,?,?,?,?)", moneyId, "w9", "u9", "RECHARGE", 500, 500, Instant.now());
        jdbc.update("INSERT INTO aep_ledger_entries (id, wallet_id, user_id, entry_type, amount, balance_after, created_at) " +
                "VALUES (?,?,?,?,?,?,?)", creditId, "w9", "u9", "ADJUST", -50, 450, Instant.now());

        assertTrue(ledgerRepo.countByPlaneIsNull() >= 2);

        // 跑真正的回填逻辑（与生产同一段；run() 的 DDL ensure 由启动期 CommandLineRunner 覆盖）。
        backfill.backfillNullPlanes();

        assertEquals(0, ledgerRepo.countByPlaneIsNull(), "回填后不应再有 plane 为 null 的行");
        assertEquals(Plane.MONEY, ledgerRepo.findById(moneyId).orElseThrow().getPlane());
        assertEquals(Plane.CREDIT, ledgerRepo.findById(creditId).orElseThrow().getPlane());
    }
}
