package com.aistareco.aep.config;

import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.LedgerEntry.LedgerEntryType;
import com.aistareco.aep.repository.LedgerEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * v2 §4.2 两平面 plane 列回填。新列经 ddl-auto 加到 {@code aep_ledger_entries} 后，既有行 plane 为 null
 * （{@code @PrePersist} 只在 insert 触发，不动历史行）。本 runner 启动时按 entryType 批量补一次。
 *
 * <p><b>全 profile 运行</b>（非 dev-seed gated）：这是结构迁移而非演示数据。完全幂等 —— 只 UPDATE
 * {@code plane IS NULL} 的行，重启 / 已回填库零影响。生产级 Flyway 接管后可移除（届时由版本化
 * DDL + 回填脚本完成，见 TODO「enum 列扩值需手写迁移」同段）。
 */
@Component
@Order(2) // 在 DataInitializer(@Order 1) 之后
public class LedgerPlaneBackfill implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(LedgerPlaneBackfill.class);

    private final LedgerEntryRepository ledgerRepo;

    public LedgerPlaneBackfill(LedgerEntryRepository ledgerRepo) {
        this.ledgerRepo = ledgerRepo;
    }

    @Override
    @Transactional
    public void run(String... args) {
        long pending = ledgerRepo.countByPlaneIsNull();
        if (pending == 0) {
            return;
        }
        // 只对库里真实出现过的 entry_type 回填（native，规避未 widen 的 ENUM 列拒绝新枚举值）。
        int money = 0, credit = 0;
        for (String typeName : ledgerRepo.distinctEntryTypesWithNullPlane()) {
            LedgerEntry.Plane plane;
            try {
                plane = LedgerEntry.planeFor(LedgerEntryType.valueOf(typeName));
            } catch (IllegalArgumentException unknown) {
                // 库里有代码已不认识的旧枚举名 —— 安全归积分面（绝不误标成有现金背书）。
                plane = LedgerEntry.Plane.CREDIT;
            }
            int n = ledgerRepo.backfillPlaneForType(plane.name(), typeName);
            if (plane == LedgerEntry.Plane.MONEY) money += n; else credit += n;
        }
        log.info("[ledger-plane-backfill] backfilled plane for {} rows (money={}, credit={}) of {} pending",
                money + credit, money, credit, pending);
    }
}
