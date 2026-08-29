package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/**
 * 音乐真实生成上线（2026-08-29）：
 *
 * <ol>
 *   <li>{@code ai_app_binding.purpose} / {@code ai_app_endpoint_candidate.purpose} 在 MySQL 上是
 *       ENUM 列，不 ALTER 的话写入 {@code MUSIC_GENERATION} 会被拒（Data truncated）。
 *       Hibernate 的 ddl-auto=update **不会**帮你扩 ENUM，必须显式改。</li>
 *   <li>{@code aep_songs.audio_cdn_key}：音频真值改存 OSS object key（§4.7.4），
 *       URL 在 DTO 出 wire 时派生。老行的 audio_url 保留做兼容读。</li>
 * </ol>
 *
 * 用 Java migration 兼容空库首次启动：Flyway 早于 Hibernate 跑，表不存在时全部跳过，
 * 由 ddl-auto 按实体建出正确定义（H2 上枚举是 varchar，本身不需要 ALTER）。
 */
public class V22__music_generation_purpose_and_song_key extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V22__music_generation_purpose_and_song_key.class);

    /** 与 AiModelPurpose 保持一致；顺序不重要，但必须覆盖全部现存值，否则已有行会被截断。 */
    private static final String PURPOSE_ENUM = "'APPEARANCE_FORGE','DAP_IMAGE','DAP_PERSONA','DAP_REAL_AVATAR',"
            + "'DAP_VIDEO','DRAMA_SCRIPT_DRAFT','GENERAL','IMAGE_GENERATION','MUSIC_GENERATION','SAFETY_REVIEW',"
            + "'SCRIPT_DRAFT','SELLING_POINTS','TEMPLATE_REWRITE','VARIABLE_EXTRACT','VIDEO_GENERATION',"
            + "'VIDEO_REF_ANALYSIS'";

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement st = context.getConnection().createStatement()) {
            alterPurposeEnum(st, "ai_app_binding", "purpose", "NOT NULL");
            alterPurposeEnum(st, "ai_app_endpoint_candidate", "purpose", "NOT NULL");

            try {
                st.executeUpdate("ALTER TABLE aep_songs ADD COLUMN audio_cdn_key VARCHAR(512) NULL");
                log.info("[V22-music] added aep_songs.audio_cdn_key");
            } catch (Exception e) {
                log.debug("[V22-music] skip aep_songs.audio_cdn_key: {}", e.getMessage());
            }
        }
    }

    /**
     * 扩 ENUM。H2（dev）上该列是 VARCHAR，这条 ALTER 会失败 —— 属于预期，跳过即可。
     */
    private void alterPurposeEnum(Statement st, String table, String column, String nullability) {
        try {
            st.executeUpdate("ALTER TABLE " + table + " MODIFY COLUMN " + column
                    + " ENUM(" + PURPOSE_ENUM + ") " + nullability);
            log.info("[V22-music] extended {}.{} enum with MUSIC_GENERATION", table, column);
        } catch (Exception e) {
            log.debug("[V22-music] skip {}.{} enum alter: {}", table, column, e.getMessage());
        }
    }
}
