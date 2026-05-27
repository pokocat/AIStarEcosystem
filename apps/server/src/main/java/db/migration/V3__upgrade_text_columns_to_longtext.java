package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/**
 * V3 (Java)：把所有 columnDefinition="LONGTEXT" 字段的列类型从 TEXT(64KB) 升到 LONGTEXT(4GB)。
 *
 * 动机：H2 当 TEXT 是 VARCHAR(MAX) 无限制，dev 跑没事；MySQL TEXT 是 64KB 截断 → 大 JSON
 * 字段（mixcut_render_job.*_json / template_scripts.*_json 等）会被截 → JSON 反序列化失败。
 *
 * 为什么用 Java migration 而不是 SQL：
 *   - Spring Boot 默认 Flyway 在 Hibernate ddl-auto 之**前**跑，首次启动空库时表还没建出
 *     → SQL 文件直接 ALTER 会失败 → 启动崩。
 *   - 用 Java migration 可以对每个 ALTER 独立 try-catch，表/列不存在 / 已是 LONGTEXT
 *     都跳过，跨「空库 / 老 dev / 老 RDS」三种状态全兼容。
 *
 * 兼容性：
 *   - MySQL 5.7+ / 8.x：ALTER ... MODIFY COLUMN ... LONGTEXT 幂等
 *   - H2 2.x (MODE=MySQL)：把 LONGTEXT 当 CLOB 同义
 *
 * 列表由 python 从 @Column(columnDefinition="LONGTEXT") 自动抽取，严格筛 String/List/Map
 * 类型（已排除 boolean/int/long 等误判）。共 71 个列。
 */
public class V3__upgrade_text_columns_to_longtext extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V3__upgrade_text_columns_to_longtext.class);

    /** {table, column} 对。新增 TEXT 字段时同步追加。 */
    private static final String[][] TARGETS = new String[][] {
            { "aep_albums", "track_ids" },
            { "aep_audit_logs", "detail" },
            { "aep_community_posts", "content" },
            { "aep_community_posts", "media_urls" },
            { "aep_concerts", "artist_ids" },
            { "aep_credit_packs", "highlights" },
            { "aep_credit_purchases", "payment_meta_json" },
            { "aep_error_logs", "message" },
            { "aep_error_logs", "request_params" },
            { "aep_error_logs", "stacktrace" },
            { "aep_forge_blueprints", "snapshot_json" },
            { "aep_forge_results", "locked" },
            { "aep_forge_results", "prompt" },
            { "aep_forge_templates", "tags" },
            { "aep_notifications", "description" },
            { "aep_platform_configs", "value_json" },
            { "aep_platform_connections", "credentials_json" },
            { "aep_publish_job_events", "note" },
            { "aep_publish_jobs", "description" },
            { "aep_publish_jobs", "error_message" },
            { "aep_publish_jobs", "interaction_required" },
            { "aep_recharge_records", "description" },
            { "aep_saved_outfits", "slots_json" },
            { "aep_selling_channels", "remark" },
            { "aep_social_accounts", "storage_state_encrypted" },
            { "aep_songs", "lyrics" },
            { "aep_studios", "bio" },
            { "ai_model_providers", "models_json" },
            { "celebrity_projects", "channels_json" },
            { "celebrity_stars", "authorization_json" },
            { "celebrity_stars", "bio" },
            { "celebrity_stars", "description" },
            { "celebrity_stars", "photos_json" },
            { "celebrity_stars", "pricing_json" },
            { "celebrity_stars", "sample_videos_json" },
            { "celebrity_stars", "stats_json" },
            { "celebrity_stars", "videos_json" },
            { "celebrity_templates", "description" },
            { "celebrity_templates", "fit_hint" },
            { "celebrity_templates", "previews_json" },
            { "digital_ips", "bio" },
            { "digital_ips", "domains" },
            { "digital_ips", "incubation_params" },
            { "marketplace_listings", "description" },
            { "mixcut_render_job", "canvas_snapshot_json" },
            { "mixcut_render_job", "perturbation_overrides_json" },
            { "mixcut_render_job", "scenes_snapshot_json" },
            { "mixcut_render_job", "slot_bindings_json" },
            { "mixcut_render_job", "slots_snapshot_json" },
            { "mixcut_render_job", "sticker_pool_json" },
            { "mixcut_render_output", "applied_transforms_json" },
            { "mixcut_template", "canvas_json" },
            { "mixcut_template", "quality_gate_json" },
            { "mixcut_template", "scenes_json" },
            { "official_ips", "tags" },
            { "products", "selling_points" },
            { "singers", "tags" },
            { "template_scripts", "duration_variants_json" },
            { "template_scripts", "engine_adapters_json" },
            { "template_scripts", "experiment_json" },
            { "template_scripts", "metrics_json" },
            { "template_scripts", "negative_prompt" },
            { "template_scripts", "persona_json" },
            { "template_scripts", "post_process_json" },
            { "template_scripts", "reference_clip_json" },
            { "template_scripts", "safety_json" },
            { "template_scripts", "scenes_json" },
            { "template_scripts", "system_prompt" },
            { "template_scripts", "variables_json" },
            { "template_scripts", "visual_style_json" },
            { "wardrobe_items", "tags" },
    };

    @Override
    public void migrate(Context context) throws Exception {
        int ok = 0, skip = 0;
        try (Statement st = context.getConnection().createStatement()) {
            for (String[] tc : TARGETS) {
                String sql = "ALTER TABLE " + tc[0] + " MODIFY COLUMN " + tc[1] + " LONGTEXT";
                try {
                    st.executeUpdate(sql);
                    ok++;
                } catch (Exception e) {
                    // 表/列不存在 / H2 不识别 / 已是 LONGTEXT —— 都跳过
                    skip++;
                    log.debug("[V3-longtext] skip {}.{}: {}", tc[0], tc[1], e.getMessage());
                }
            }
        }
        log.info("[V3-longtext] upgraded {} columns to LONGTEXT (skipped {})", ok, skip);
    }
}
