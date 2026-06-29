package com.aistareco.aep.config;

import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.LedgerEntry.LedgerEntryType;
import com.aistareco.aep.repository.LedgerEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * v2 §1/§4.2 两平面 plane 列迁移 runner（启动时幂等执行，全 profile）：
 *   1. <b>确保 DB CHECK 约束存在</b>（积分面永不携带现金凭证）—— {@code @Check} 注解 + {@code ddl-auto=update}
 *      只在「建表」时生效，<b>不会</b>把 CHECK 加到已存在的表（生产 MySQL / 持久化 H2 即此情形）。本 runner
 *      在 ddl-auto 之后用原生 {@code ALTER TABLE ADD CONSTRAINT} 补齐，让「调差不碰现金」的<b>数据库</b>
 *      不变量在生产真实成立（评审 H1）。幂等：已存在 → 吞异常。
 *   2. <b>回填历史行 plane</b>：新列加上后既有行 plane 为 null（{@code @PrePersist} 只在 insert 触发）。
 *
 * <p>完全幂等，重启 / 已迁移库零影响。生产级 Flyway 接管后可移除（届时由版本化 DDL 完成，见 TODO）。
 */
@Component
@Order(2) // 在 DataInitializer(@Order 1) 之后
public class LedgerPlaneBackfill implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(LedgerPlaneBackfill.class);

    /** 积分面永不携带现金凭证。资金面不强制非空（提现单等过渡期可空），只锁死积分面那一半。 */
    private static final String PLANE_CHECK_SQL =
            "ALTER TABLE aep_ledger_entries ADD CONSTRAINT ck_ledger_plane "
                    + "CHECK (plane <> 'CREDIT' OR cash_artifact_id IS NULL)";

    private final LedgerEntryRepository ledgerRepo;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate txTemplate;

    public LedgerPlaneBackfill(LedgerEntryRepository ledgerRepo, JdbcTemplate jdbc, PlatformTransactionManager txManager) {
        this.ledgerRepo = ledgerRepo;
        this.jdbc = jdbc;
        this.txTemplate = new TransactionTemplate(txManager);
    }

    @Override
    public void run(String... args) {
        ensurePlaneCheckConstraint();
        txTemplate.executeWithoutResult(s -> backfillNullPlanes());
    }

    /** 幂等补齐 DB CHECK（DDL 自带提交，走 JdbcTemplate 独立连接，不混进回填事务）。 */
    private void ensurePlaneCheckConstraint() {
        try {
            jdbc.execute(PLANE_CHECK_SQL);
            log.info("[ledger-plane] DB CHECK ck_ledger_plane 已补齐（积分面禁带现金凭证，数据库级不变量）");
        } catch (Exception alreadyExistsOrDialect) {
            // 约束已存在（重启 / @Check 建表时已加）或方言不支持具名 IF NOT EXISTS → 幂等吞掉。
            // 生产首启会真正 ADD；之后命中此分支。绝不阻断启动。
            log.debug("[ledger-plane] CHECK ensure 跳过（多半已存在）：{}", alreadyExistsOrDialect.getMessage());
        }
    }

    /** 回填历史 null-plane 行。需在事务内调用（run() 经 txTemplate 包裹；测试用类级 @Transactional）。 */
    public void backfillNullPlanes() {
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
