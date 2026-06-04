package com.aistareco.aep.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

/**
 * v0.37+：把 v0.33+ 新加的列在启动时显式 ADD 到 mixcut_render_job 表。
 *
 * 背景：Hibernate ddl-auto=update 理论上自动加列，但实际遇到老 H2 文件 DB
 * (./data/aistareco.mv.db) 不识别新字段 → 查询时报「Column "CREDITS_HELD" not found」。
 * 同样问题可能影响 MySQL 老库。
 *
 * <h2>v0.34.x 重写：不用事务、不用 EntityManager</h2>
 *
 * 旧版用 {@code @PersistenceContext EntityManager em} + {@code @Transactional} +
 * try-catch 吞异常。当任意 ALTER 失败时：
 * <ol>
 *   <li>Hibernate / JPA 给当前事务自动 setRollbackOnly</li>
 *   <li>外层 try-catch 吞了异常，但 rollback-only 标记没消</li>
 *   <li>{@code @Transactional} commit 时 Spring 抛 {@code UnexpectedRollbackException:
 *       Transaction silently rolled back because it has been marked as rollback-only}</li>
 *   <li>整个应用启动失败</li>
 * </ol>
 *
 * 新版直接用 {@link DataSource} 拿独立 {@link Connection} 跑每条 DDL：
 * <ul>
 *   <li>DDL（ALTER TABLE）在 MySQL/H2 都是 implicit commit，本来就不需要事务</li>
 *   <li>每条 ALTER 独立 connection / try-with-resources，互不污染</li>
 *   <li>失败只 log，不影响后续列 ALTER 也不阻塞启动</li>
 * </ul>
 *
 * <h2>长期方向</h2>
 *
 * 本类是 runtime ALTER 兜底，v0.34+ 引入 Flyway 后未来 schema 改动应该走
 * {@code db/migration/V<N>__xxx.sql} 而不是 runtime catch-up。等所有线上库
 * schema 走完一次 Flyway 后，本类可彻底删除。
 */
@Component
@Order(40)
public class MixcutJobSchemaMigration implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MixcutJobSchemaMigration.class);

    private final DataSource dataSource;

    public MixcutJobSchemaMigration(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    private record AddColumn(String table, String column, String typeH2, String typeMySql) {}

    private static final List<AddColumn> COLUMNS = List.of(
            // v0.33：积分预冻结
            new AddColumn("mixcut_render_job", "credits_held",        "BIGINT NOT NULL DEFAULT 0", "BIGINT NOT NULL DEFAULT 0"),
            new AddColumn("mixcut_render_job", "credits_per_variant", "BIGINT NOT NULL DEFAULT 0", "BIGINT NOT NULL DEFAULT 0"),
            // v0.30：rerun 血缘
            new AddColumn("mixcut_render_job", "forked_from_job_id",  "VARCHAR(64)",               "VARCHAR(64)"),
            // v0.48：来源实例（草稿）血缘
            new AddColumn("mixcut_render_job", "draft_id",            "VARCHAR(64)",               "VARCHAR(64)"),
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
    public void run(String... args) {
        for (AddColumn c : COLUMNS) {
            tryAddColumn(c);
        }
    }

    /**
     * 跑一条 ALTER TABLE ADD COLUMN，尝试两种方言；任意失败仅 log，不阻塞。
     * 每条用独立 connection（DDL 是 implicit commit，无需事务）。
     */
    private void tryAddColumn(AddColumn c) {
        // 优先 H2/Postgres 兼容形式：ADD COLUMN IF NOT EXISTS
        // MySQL 8.0.29+ 也支持。失败再 fallback 到 MySQL 老版本写法。
        String sqlIfNotExists = String.format(
                "ALTER TABLE %s ADD COLUMN IF NOT EXISTS %s %s",
                c.table(), c.column(), c.typeH2()
        );
        if (executeOnce(sqlIfNotExists, c, /*logSuccess=*/true, /*tag=*/"H2/PG/MySQL8.0.29+")) {
            return;
        }

        // Fallback：MySQL < 8.0.29 不支持 IF NOT EXISTS，裸 ADD COLUMN
        // 已存在列时会抛「Duplicate column name」—— 仅 debug log，不阻塞
        String sqlBare = String.format(
                "ALTER TABLE %s ADD COLUMN %s %s",
                c.table(), c.column(), c.typeMySql()
        );
        executeOnce(sqlBare, c, /*logSuccess=*/true, /*tag=*/"MySQL legacy");
    }

    private boolean executeOnce(String sql, AddColumn c, boolean logSuccess, String tag) {
        try (Connection conn = dataSource.getConnection();
             Statement st = conn.createStatement()) {
            st.execute(sql);
            if (logSuccess) {
                log.info("[mixcut-schema] ensured column {}.{} ({})", c.table(), c.column(), tag);
            }
            return true;
        } catch (SQLException e) {
            // 列已存在 / 表不存在 / 方言不支持 — debug 级别，下一个 fallback 或下一列继续
            log.debug("[mixcut-schema] {} {} {} failed ({}): {}",
                    tag, c.table(), c.column(), e.getSQLState(), e.getMessage());
            return false;
        }
    }
}
