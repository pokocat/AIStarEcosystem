package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/**
 * 短视频开拍付费创建的幂等键升级为真列 + 唯一索引（v0.145）。
 *
 * <p>v0.144 把 clientRequestId 存在 payloadJson 里，没有唯一约束，只能挡住「超时后再点一次」
 * 这类顺序重试；两个请求真并发时都查不到对方，会各建一条草稿、各扣一笔开拍费。
 * 加 {@code (owner_user_id, client_request_id)} 唯一索引后，并发同键只有一个能落库，
 * 落败的那次释放冻结、回查并返回赢家的草稿。</p>
 *
 * <p>存量行该列为 NULL；MySQL / H2 的唯一索引都允许多个 NULL，因此加索引不会因存量数据失败。
 * 刻意<b>不回填</b> payloadJson 里的旧键：v0.144 的键本来只在 2 小时窗口内有意义，
 * 窗口早已过去，回填不会让任何请求变得更幂等。</p>
 *
 * <p>用 Java migration 而不是 .sql，与 V21 / V22 同理：Flyway 早于 Hibernate 跑，
 * 而 {@code drama_shorts} 是 ddl-auto 建的表 —— 全新 H2 dev 库首启时表还不存在，
 * 逐条 DDL 各自 try/catch 跳过即可，由 ddl-auto 按实体建出正确定义。</p>
 */
public class V23__drama_short_client_request_id extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V23__drama_short_client_request_id.class);

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement st = context.getConnection().createStatement()) {
            try {
                st.executeUpdate("ALTER TABLE drama_shorts ADD COLUMN client_request_id VARCHAR(64) NULL");
                log.info("[V23-drama-short-idem] added drama_shorts.client_request_id");
            } catch (Exception e) {
                log.debug("[V23-drama-short-idem] skip client_request_id column: {}", e.getMessage());
            }
            try {
                st.executeUpdate("CREATE UNIQUE INDEX uk_drama_short_owner_client_req"
                        + " ON drama_shorts (owner_user_id, client_request_id)");
                log.info("[V23-drama-short-idem] added uk_drama_short_owner_client_req");
            } catch (Exception e) {
                log.debug("[V23-drama-short-idem] skip unique index: {}", e.getMessage());
            }
        }
    }
}
