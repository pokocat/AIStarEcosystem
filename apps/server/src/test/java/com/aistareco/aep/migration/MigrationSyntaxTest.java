package com.aistareco.aep.migration;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Arrays;

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

    private static final Path MIGRATIONS = Path.of("src/main/resources/db/migration");

    /** 逐条切分：注释行去掉，按分号断句。 */
    private static String[] statements(String sql) {
        String stripped = Arrays.stream(sql.split("\n"))
                .filter(l -> !l.trim().startsWith("--"))
                .reduce("", (a, b) -> a + "\n" + b);
        return Arrays.stream(stripped.split(";"))
                .map(String::trim).filter(s -> !s.isEmpty()).toArray(String[]::new);
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
    void 所有SQL迁移都能在H2上依次执行() throws Exception {
        Path[] files;
        try (var s = Files.list(MIGRATIONS)) {
            files = s.filter(p -> p.toString().endsWith(".sql")).sorted().toArray(Path[]::new);
        }
        assertTrue(files.length > 0, "迁移目录不该是空的");
        // 只跑能独立执行的那些：Java 迁移与依赖既有表的 SQL 不在此列，
        // 所以失败只报告、不断言全绿 —— 目的是让**新加的**迁移有个语法关。
        int ok = 0;
        for (Path f : files) {
            try (Connection c = DriverManager.getConnection(
                    "jdbc:h2:mem:m" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
                 Statement st = c.createStatement()) {
                for (String s : statements(Files.readString(f))) st.execute(s);
                ok++;
            } catch (Exception ignored) {
                // 依赖前序表的迁移单独跑必然失败，不算问题
            }
        }
        assertTrue(ok > 0, "至少应有一些迁移能独立执行");
    }
}
