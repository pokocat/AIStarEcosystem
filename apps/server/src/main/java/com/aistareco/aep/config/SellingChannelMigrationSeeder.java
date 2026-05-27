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
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * v0.36：把现有 LicenseBatch.issuerTenantId 迁移到 SellingChannel。
 *
 * 流程：
 *   1) 启动时扫所有 `sellingChannelId == null && issuerTenantId 非空` 的批次；
 *   2) 为每个 distinct issuerTenantId 创建（或复用）一个 SellingChannel
 *      （code=`legacy-tenant-<前 8>`, type=PARTNER, status=ACTIVE）；
 *   3) 回填 batch.sellingChannelId。
 *
 * 幂等：sellingChannelId 已有则跳过；通过 code 查找已建的 legacy channel。
 *
 * 不删除 issuerTenantId 列 —— 保留至少 2 个版本以便回滚 + 历史 ledger 追溯。
 */
@Component
@Order(50)
public class SellingChannelMigrationSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SellingChannelMigrationSeeder.class);

    private final LicenseBatchRepository batchRepo;
    private final SellingChannelRepository channelRepo;

    public SellingChannelMigrationSeeder(LicenseBatchRepository batchRepo,
                                          SellingChannelRepository channelRepo) {
        this.batchRepo = batchRepo;
        this.channelRepo = channelRepo;
    }

    @Override
    @Transactional
    public void run(String... args) {
        ensurePlatformSelfChannel();
        backfillLegacyBatches();
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

    private Optional<SellingChannel> noop() { return Optional.empty(); }
}
