package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;

/**
 * 官方形象（dap_public_avatar）加「使用方式」列：free 免费可直接用于生成，license 需授权（2026-11-10）。
 *
 * <p>存量行一律补 license：运营此前上架的形象没有约定过免费，宁可先不放行。内置 10 个由
 * DapBuiltinPublicAvatarSeeder 写入时明确标 free。
 *
 * <p>dap_public_avatar 由 Hibernate 按实体建表：空库跑迁移时表还不存在，直接跳过（同 V80）。
 */
public class V81__dap_public_avatar_access extends BaseJavaMigration {
    private static final String TABLE = "dap_public_avatar";

    @Override public void migrate(Context context) throws Exception {
        Connection c = context.getConnection();
        if (!tableExists(c)) return;
        try (var s = c.createStatement()) {
            if (!columnExists(c, "access")) s.execute("ALTER TABLE " + TABLE + " ADD COLUMN access VARCHAR(16) NULL");
            s.execute("UPDATE " + TABLE + " SET access = 'license' WHERE access IS NULL");
        }
    }

    private static boolean tableExists(Connection c) throws Exception {
        try (var r = c.getMetaData().getTables(c.getCatalog(), null, "%", new String[]{"TABLE"})) {
            while (r.next()) if (TABLE.equalsIgnoreCase(r.getString("TABLE_NAME"))) return true;
        }
        return false;
    }

    private static boolean columnExists(Connection c, String column) throws Exception {
        try (var r = c.getMetaData().getColumns(c.getCatalog(), null, "%", "%")) {
            while (r.next()) if (TABLE.equalsIgnoreCase(r.getString("TABLE_NAME")) && column.equalsIgnoreCase(r.getString("COLUMN_NAME"))) return true;
        }
        return false;
    }
}
