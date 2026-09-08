package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/**
 * 把 {@code card_profile.payload_json} 拉回 LONGTEXT（v0.178）。
 *
 * <p>线上这一列是 <b>tinytext（255 字节）</b>：{@code CardProfile.payloadJson} 只写了
 * {@code @Lob}、没写 {@code columnDefinition}，Hibernate 6 便按 {@code @Column} 的默认长度 255
 * 去挑 MySQL 的 text 家族，挑中了 tinytext；而 ddl-auto 只加不改，建错一次就一直错着。
 * 表现是「做成数字名片」500 —— {@code Data too long for column 'payload_json'}，
 * 一张名片的文档（名字 + 衣柜若干条引用）随手就超过 255 字节。
 *
 * <p>V28 的建表语句写的本来就是 LONGTEXT，所以全新库不需要这条；它只修被 ddl-auto
 * 建歪的存量库。用 Java migration 而不是 .sql，与 V21 / V22 / V23 / V29 同理：
 * 表可能不存在（全新库上 Flyway 早于 Hibernate），try/catch 跳过即可。
 *
 * <p>只放宽不收窄，已有数据不受影响。
 */
public class V30__card_payload_longtext extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V30__card_payload_longtext.class);

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement st = context.getConnection().createStatement()) {
            try {
                st.executeUpdate("ALTER TABLE card_profile MODIFY COLUMN payload_json LONGTEXT NOT NULL");
                log.info("[V30-card-payload] card_profile.payload_json → LONGTEXT");
            } catch (Exception e) {
                // H2（dev）语法或表尚不存在都走这里；全新库由 V28 建表时就已经是 LONGTEXT
                log.debug("[V30-card-payload] skip: {}", e.getMessage());
            }
        }
    }
}
