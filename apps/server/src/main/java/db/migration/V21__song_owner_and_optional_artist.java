package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/**
 * 创作音乐去掉艺人硬依赖（2026-08-29）：
 *   1) aep_songs.artist_id 放开 NOT NULL —— 无艺人也能创作歌曲；
 *   2) 新增 aep_songs.owner_user_id —— 无艺人歌曲的归属真值（老行保持 null，
 *      归属仍经 artist_id → DigitalIp 推导，不做回填）。
 *
 * 用 Java migration 兼容空库首次启动：Flyway 早于 Hibernate 跑，
 * 表不存在（fresh H2 dev）时全部跳过，由 ddl-auto 按实体建出正确定义。
 */
public class V21__song_owner_and_optional_artist extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V21__song_owner_and_optional_artist.class);

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement st = context.getConnection().createStatement()) {
            try {
                st.executeUpdate("ALTER TABLE aep_songs ADD COLUMN owner_user_id VARCHAR(36) NULL");
                log.info("[V21-song-owner] added aep_songs.owner_user_id");
            } catch (Exception e) {
                log.debug("[V21-song-owner] skip owner_user_id: {}", e.getMessage());
            }
            try {
                // MySQL 语法；失败再试 H2 语法（已有 H2 文件库升级场景）。
                st.executeUpdate("ALTER TABLE aep_songs MODIFY COLUMN artist_id VARCHAR(36) NULL");
                log.info("[V21-song-owner] relaxed aep_songs.artist_id NOT NULL (mysql)");
            } catch (Exception mysqlEx) {
                try {
                    st.executeUpdate("ALTER TABLE aep_songs ALTER COLUMN artist_id SET NULL");
                    log.info("[V21-song-owner] relaxed aep_songs.artist_id NOT NULL (h2)");
                } catch (Exception h2Ex) {
                    log.debug("[V21-song-owner] skip artist_id relax: {}", h2Ex.getMessage());
                }
            }
            try {
                st.executeUpdate("CREATE INDEX idx_songs_owner_user ON aep_songs (owner_user_id)");
                log.info("[V21-song-owner] added idx_songs_owner_user");
            } catch (Exception e) {
                log.debug("[V21-song-owner] skip idx_songs_owner_user: {}", e.getMessage());
            }
        }
    }
}
