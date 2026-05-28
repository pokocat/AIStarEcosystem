package com.aistareco.aep.config;

import com.aistareco.aep.model.LicenseBatch;
import com.aistareco.aep.model.SellingChannel;
import com.aistareco.aep.repository.LicenseBatchRepository;
import com.aistareco.aep.repository.SellingChannelRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.UUID;

/**
 * v0.36：把现有 LicenseBatch.issuerTenantId 迁移到 SellingChannel。
 *
 * 流程：
 *   0) 先把 issuer_tenant_id 列的 NOT NULL 约束放开（JPA ddl-auto=update 不会改约束）；
 *   1) 启动时扫所有 `sellingChannelId == null && issuerTenantId 非空` 的批次；
 *   2) 为每个 distinct issuerTenantId 创建（或复用）一个 SellingChannel
 *      （code=`legacy-tenant-<前 8>`, type=PARTNER, status=ACTIVE）；
 *   3) 回填 batch.sellingChannelId。
 *
 * 幂等：sellingChannelId 已有则跳过；通过 code 查找已建的 legacy channel。
 *
 * 不删除 issuerTenantId 列 —— 保留至少 2 个版本以便回滚 + 历史 ledger 追溯。
 *
 * <h2>v0.34.x 重构：分离 DDL 与业务事务</h2>
 *
 * 旧版整个 run() 用 {@code @Transactional} 包裹 + 用 {@code EntityManager.createNativeQuery}
 * 跑 ALTER + try-catch 吞 SQLException。当 ALTER 失败时 JPA 自动 setRollbackOnly，
 * 即使外层 catch 吞了异常，事务标记没消，{@code @Transactional} commit 时 Spring
 * 抛 {@code UnexpectedRollbackException: Transaction silently rolled back}。
 *
 * 新版分离两类操作：
 * <ul>
 *   <li>{@link #relaxIssuerTenantIdConstraint()}：用 {@link DataSource} 拿独立 Connection
 *       跑 DDL，失败仅 log，**不影响**后续业务事务（DDL 在 MySQL/H2 都是 implicit commit
 *       本来就不需要事务）。</li>
 *   <li>{@link #ensurePlatformSelfChannel()} / {@link #backfillLegacyBatches()}：用
 *       {@link TransactionTemplate} 各自独立显式包事务，互不污染。</li>
 * </ul>
 */
@Component
@Order(50)
public class SellingChannelMigrationSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SellingChannelMigrationSeeder.class);

    private final LicenseBatchRepository batchRepo;
    private final SellingChannelRepository channelRepo;
    private final DataSource dataSource;
    private final TransactionTemplate txTemplate;

    public SellingChannelMigrationSeeder(LicenseBatchRepository batchRepo,
                                          SellingChannelRepository channelRepo,
                                          DataSource dataSource,
                                          PlatformTransactionManager txManager) {
        this.batchRepo = batchRepo;
        this.channelRepo = channelRepo;
        this.dataSource = dataSource;
        this.txTemplate = new TransactionTemplate(txManager);
    }

    @Override
    public void run(String... args) {
        // 1) DDL：独立 connection，不参与任何事务
        relaxIssuerTenantIdConstraint();

        // 2) 业务：各自独立事务（失败不影响下一步、不影响整个应用启动）
        try {
            txTemplate.executeWithoutResult(status -> ensurePlatformSelfChannel());
        } catch (Exception e) {
            log.warn("[selling-channel] ensurePlatformSelfChannel failed: {}", e.getMessage());
        }
        try {
            txTemplate.executeWithoutResult(status -> backfillLegacyBatches());
        } catch (Exception e) {
            log.warn("[selling-channel] backfillLegacyBatches failed: {}", e.getMessage());
        }
    }

    /**
     * JPA `ddl-auto=update` 只会**加**列，**不会**改已有列的 NOT NULL 约束。
     * v0.36 把 LicenseBatch.issuerTenantId 改为 nullable 后，老 H2/MySQL DB 仍然
     * 保留 NOT NULL，导致新批次插入失败。这里显式 DROP NOT NULL，兼容 H2 + MySQL。
     *
     * 每条 DDL 用独立 Connection（DDL 是 implicit commit，无需事务）；失败仅 log。
     */
    private void relaxIssuerTenantIdConstraint() {
        // H2 / PostgreSQL 标准语法
        String h2Sql = "ALTER TABLE aep_license_batches ALTER COLUMN issuer_tenant_id DROP NOT NULL";
        if (executeDdl(h2Sql)) {
            log.info("[selling-channel] relaxed issuer_tenant_id NOT NULL (H2/PG)");
            return;
        }
        // MySQL 语法
        String mysqlSql = "ALTER TABLE aep_license_batches MODIFY COLUMN issuer_tenant_id VARCHAR(255) NULL";
        if (executeDdl(mysqlSql)) {
            log.info("[selling-channel] relaxed issuer_tenant_id NOT NULL (MySQL)");
            return;
        }
        log.warn("[selling-channel] could not relax issuer_tenant_id constraint (both H2 and MySQL syntax failed); "
                + "new batches with sellingChannelId-only may fail. Please run ALTER manually.");
    }

    private boolean executeDdl(String sql) {
        try (Connection conn = dataSource.getConnection();
             Statement st = conn.createStatement()) {
            st.execute(sql);
            return true;
        } catch (SQLException e) {
            log.debug("[selling-channel] DDL failed ({}): {}", e.getSQLState(), e.getMessage());
            return false;
        }
    }

    /** 一定保证存在一个默认「平台直营」渠道，给 admin UI 默认值用。 */
    private void ensurePlatformSelfChannel() {
        if (channelRepo.findByCode("platform-self").isPresent()) return;
        Instant now = Instant.now();
        SellingChannel c = SellingChannel.builder()
                .id(UUID.randomUUID().toString())
                .code("platform-self")
                .name("平台直营")
                .sellingEntity("AI Star Eco 平台")
                .type(SellingChannel.ChannelType.DIRECT)
                .status(SellingChannel.ChannelStatus.ACTIVE)
                .remark("v0.36 默认渠道；admin 新建批次时的默认归属。")
                .createdAt(now)
                .updatedAt(now)
                .build();
        channelRepo.save(c);
        log.info("[selling-channel] seeded default 'platform-self' channel");
    }

    /** 把老批次的 issuerTenantId 转换成 legacy-tenant-XXX 渠道。 */
    private void backfillLegacyBatches() {
        int migrated = 0;
        for (LicenseBatch batch : batchRepo.findAll()) {
            if (batch.getSellingChannelId() != null && !batch.getSellingChannelId().isBlank()) continue;
            String tenantId = batch.getIssuerTenantId();
            if (tenantId == null || tenantId.isBlank()) continue;

            String legacyCode = "legacy-tenant-" + tenantId.substring(0, Math.min(8, tenantId.length()));
            SellingChannel channel = channelRepo.findByCode(legacyCode).orElseGet(() -> {
                Instant now = Instant.now();
                SellingChannel c = SellingChannel.builder()
                        .id(UUID.randomUUID().toString())
                        .code(legacyCode)
                        .name("历史渠道 · " + legacyCode)
                        .sellingEntity("Tenant " + tenantId)
                        .type(SellingChannel.ChannelType.PARTNER)
                        .status(SellingChannel.ChannelStatus.ACTIVE)
                        .remark("v0.36 数据迁移自动建：由 LicenseBatch.issuerTenantId=" + tenantId + " 迁入")
                        .createdAt(now)
                        .updatedAt(now)
                        .build();
                return channelRepo.save(c);
            });
            batch.setSellingChannelId(channel.getId());
            batchRepo.save(batch);
            migrated++;
        }
        if (migrated > 0) {
            log.info("[selling-channel] migrated {} legacy batch(es) to SellingChannel rows", migrated);
        }
    }
}
