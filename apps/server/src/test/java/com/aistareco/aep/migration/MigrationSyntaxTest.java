package com.aistareco.aep.migration;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * SQL 迁移的语法体检 —— 直接拿 H2（MySQL 模式）跑一遍。
 *
 * <p>为什么需要：V31 当初写了 {@code TINYINT(1)}，H2 不吃显示宽度，
 * 结果 {@code @DataJpaTest} 上下文起不来、连带 8 个测试报错 —— 那是**部署/跑测试时**
 * 才发现的。迁移文件不过 typecheck、不过契约门，唯一能在提交前抓住它的就是真的执行一遍。
 *
 * <p>本测试只验**语法与可执行性**，不验业务语义；顺带断言列真的加上了。
 */
class MigrationSyntaxTest {

    private static final Path MIGRATIONS = SqlMigrations.DIR;

    private static String[] statements(String sql) {
        return SqlMigrations.statements(sql);
    }

    @Test
    void V31与V32在H2_MySQL模式下都能执行_且kind列真的加上了() throws Exception {
        String v31 = Files.readString(MIGRATIONS.resolve("V31__ip_demo_template.sql"));
        String v32 = Files.readString(MIGRATIONS.resolve("V32__ip_demo_kind.sql"));

        try (Connection c = DriverManager.getConnection(
                "jdbc:h2:mem:mig" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
             Statement st = c.createStatement()) {

            for (String s : statements(v31)) st.execute(s);
            for (String s : statements(v32)) st.execute(s);

            // 列真的在，且默认值是 example（存量行不能变成 template —— 那会让它们素材消失）
            st.execute("INSERT INTO ip_demo_template (id, name, doc_json) VALUES ('d1','x','{}')");
            try (ResultSet rs = st.executeQuery("SELECT kind FROM ip_demo_template WHERE id='d1'")) {
                assertTrue(rs.next());
                assertEquals("example", rs.getString(1),
                        "存量行必须默认 example：v0.182 起存的都带素材，改判 template 会让素材凭空消失");
            }
        }
    }

    @Test
    void 所有SQL迁移在同一个库上按版本号依次执行且一条都不许失败() throws Exception {
        // 此前这条是「每个文件各开一个新库、失败就吞、只要有一个成功就算过」——
        // 那样它永远不会红，等于没有门禁（Codex 复核 v0.192 逮到）。
        // V69 起有 SQL 迁移改的是 Java 迁移（V67）建的表，所以顺序执行时要把那份建表脚本补在
        // 它的版本号位置上（见 SqlMigrations）；任何一条失败就红，并指出是哪个文件的哪条语句。
        assertTrue(SqlMigrations.files().size() > 10,
                "迁移目录只扫到 " + SqlMigrations.files().size() + " 个文件，扫描没生效就等于这条永远绿");

        try (Connection c = DriverManager.getConnection(
                "jdbc:h2:mem:migall" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1")) {
            SqlMigrations.runAll(c);
        }
    }
}
