package com.aistareco.aep.config;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * v0.37+：把 v0.33+ 新加的列在启动时显式 ADD 到 mixcut_render_job 表。
 *
 * 背景：Hibernate ddl-auto=update 理论上自动加列，但实际遇到老 H2 文件 DB
 * (./data/aistareco.mv.db) 不识别新字段 → 查询时报「Column "CREDITS_HELD" not found」。
 * 同样问题可能影响 MySQL 老库。
 *
 * 策略：每个目标列 try { ALTER TABLE ADD COLUMN ... } catch (重复加) {}。
 * 任意 catch 不阻塞启动；下一次列存在时直接 noop。
 *
 * 仅处理 v0.33+ 增量列；老列由 ddl-auto 创建表时自然生成。
 */
@Component
@Order(40)
public class MixcutJobSchemaMigration implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MixcutJobSchemaMigration.class);

    @PersistenceContext
    private EntityManager em;

    private record AddColumn(String table, String column, String typeH2, String typeMySql) {}

    private static final List<AddColumn> COLUMNS = List.of(
            // v0.33：积分预冻结
            new AddColumn("mixcut_render_job", "credits_held",        "BIGINT NOT NULL DEFAULT 0", "BIGINT NOT NULL DEFAULT 0"),
            new AddColumn("mixcut_render_job", "credits_per_variant", "BIGINT NOT NULL DEFAULT 0", "BIGINT NOT NULL DEFAULT 0"),
            // v0.30：rerun 血缘
            new AddColumn("mixcut_render_job", "forked_from_job_id",  "VARCHAR(64)",               "VARCHAR(64)"),
            // v0.28：商品贯穿
            new AddColumn("mixcut_render_job", "product_id",          "VARCHAR(64)",               "VARCHAR(64)"),
            // v0.25：场景快照
            new AddColumn("mixcut_render_job", "scenes_snapshot_json", "TEXT",                     "LONGTEXT"),
            // v0.13：扰动贴图池
            new AddColumn("mixcut_render_job", "sticker_pool_json",   "TEXT",                      "LONGTEXT"),
            // 早期但容易漏：source_phash
            new AddColumn("mixcut_render_job", "source_phash",        "VARCHAR(16)",               "VARCHAR(16)")
    );

    @Override
    @Transactional
    public void run(String... args) {
        for (AddColumn c : COLUMNS) {
            tryAddColumn(c);
        }
    }

    private void tryAddColumn(AddColumn c) {
        // H2 支持 ADD COLUMN IF NOT EXISTS（最简洁、跨重启幂等）
        try {
            em.createNativeQuery(String.format(
                    "ALTER TABLE %s ADD COLUMN IF NOT EXISTS %s %s",
                    c.table(), c.column(), c.typeH2()
            )).executeUpdate();
            log.info("[mixcut-schema] ensured column {}.{} (H2/PG)", c.table(), c.column());
            return;
        } catch (Exception ignored) {
            // 走 MySQL fallback
        }
        // MySQL 8.0.29+ 才支持 IF NOT EXISTS；老版本只能 try-catch 重复列
        try {
            em.createNativeQuery(String.format(
                    "ALTER TABLE %s ADD COLUMN %s %s",
                    c.table(), c.column(), c.typeMySql()
            )).executeUpdate();
            log.info("[mixcut-schema] added column {}.{} (MySQL)", c.table(), c.column());
        } catch (Exception e) {
            // 重复列 / 表不存在 / 其它 — 都不阻塞启动
            log.debug("[mixcut-schema] add column {}.{} skipped: {}",
                    c.table(), c.column(), e.getMessage());
        }
    }
}
