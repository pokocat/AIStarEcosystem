package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/**
 * 候选端点声明「出图最少要多少像素」（v0.168）。
 *
 * <p>起因是一次真实排障：运营把出图模型换成火山方舟 seedream 4.5 之后，画布一直失败，
 * 上游回的是 {@code image size must be at least 3686400 pixels}（约 1920×1920）。
 * 而画布的画幅是<b>逐节点</b>存的、内置模板还写死了 768×1024（78 万像素），
 * 又没有全局画幅设置 —— 用户被迫把画布上每个节点挨个改，换个模型再改一遍。
 *
 * <p>有了这一列，服务端在调用前按端点声明把画幅按比例顶上去
 * （{@code DapMultimodalClient#fitMinPixels}）。不填即「无下限」，行为与此前完全一致。
 *
 * <p>用 Java migration 而不是 .sql，与 V21 / V22 / V23 同理：Flyway 早于 Hibernate 跑，
 * 而 {@code ai_app_endpoint_candidate} 是 ddl-auto 建的表 —— 全新 H2 dev 库首启时它还不存在，
 * try/catch 跳过即可，由 ddl-auto 按实体建出带该列的正确定义。
 * （最初写成 .sql 了，在全新库上直接 {@code Table not found} 把整个上下文带崩。）
 */
public class V29__endpoint_min_image_pixels extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V29__endpoint_min_image_pixels.class);

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement st = context.getConnection().createStatement()) {
            try {
                st.executeUpdate("ALTER TABLE ai_app_endpoint_candidate ADD COLUMN min_image_pixels INT NULL");
                log.info("[V29-min-image-pixels] added ai_app_endpoint_candidate.min_image_pixels");
            } catch (Exception e) {
                log.debug("[V29-min-image-pixels] skip column: {}", e.getMessage());
            }
        }
    }
}
