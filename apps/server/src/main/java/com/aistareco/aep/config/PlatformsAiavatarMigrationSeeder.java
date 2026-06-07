package com.aistareco.aep.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * v0.53：aiavatar 纳入平台全集（PlatformSupport.ALL 由 3 → 4）后的一次性回填。
 *
 * 背景：v0.43 ~ v0.52 期间 dev-grant-all=true 路径会把「全部平台」写成显式 CSV
 * "music,drama,celebrity"（当时的全集）。aiavatar 加入全集 + web-aiavatar 上平台门禁后，
 * 这些行若保持显式 3 平台会被 aiavatar 拦截 —— 但其业务语义本来是「全平台」。
 *
 * 回填规则：platforms 恰好等于老全集（含任意顺序的等价排列在历史上不存在 ——
 * toCsv 保 ALL 顺序，只会产出这一种串）→ 置 NULL（effective = 新全集）。
 * 显式单平台 / 双平台授权的行不动（那是真实的收窄授权）。
 *
 * 幂等：命中 0 行时无操作；执行一次后不再有匹配行。
 */
@Component
@Order(52)
public class PlatformsAiavatarMigrationSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(PlatformsAiavatarMigrationSeeder.class);

    /** v0.43 时代 PlatformSupport.toCsv(ALL) 的唯一产出形态。 */
    private static final String LEGACY_FULL_SET = "music,drama,celebrity";

    private final JdbcTemplate jdbc;

    public PlatformsAiavatarMigrationSeeder(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        try {
            int updated = jdbc.update(
                    "UPDATE aep_users SET platforms = NULL WHERE platforms = ?", LEGACY_FULL_SET);
            if (updated > 0) {
                log.info("[platforms-migration] v0.53 aiavatar 纳入全集：{} 个「老全集 {}」账号已升为全平台 (platforms=NULL)",
                        updated, LEGACY_FULL_SET);
            }
        } catch (Exception e) {
            // 迁移失败不阻断启动；下次启动幂等重试。
            log.warn("[platforms-migration] 回填失败（不阻断启动，将于下次启动重试）：{}", e.getMessage());
        }
    }
}
