package com.aistareco.aep.migration;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
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
    void 所有SQL迁移在同一个库上按版本号依次执行且一条都不许失败() throws Exception {
        // 此前这条是「每个文件各开一个新库、失败就吞、只要有一个成功就算过」——
        // 那样它永远不会红，等于没有门禁（Codex 复核 v0.192 逮到）。
        // 实测：全部 SQL 迁移在**同一个库上按顺序**跑是干净的（依赖 Java 迁移建表的一条都没有），
        // 所以这里改成真门禁：任何一条失败就红，并指出是哪个文件的哪条语句。
        List<Path> files;
        try (var s = Files.list(MIGRATIONS)) {
            files = s.filter(p -> p.toString().endsWith(".sql"))
                    .sorted(Comparator.comparingInt(MigrationSyntaxTest::versionOf))   // Flyway 按版本号排，不是字典序
                    .toList();
        }
        assertTrue(files.size() > 10, "迁移目录只扫到 " + files.size() + " 个文件，扫描没生效就等于这条永远绿");

        try (Connection c = DriverManager.getConnection(
                "jdbc:h2:mem:migall" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
             Statement st = c.createStatement()) {
            for (Path f : files) {
                for (String sql : statements(Files.readString(f))) {
                    try {
                        st.execute(sql);
                    } catch (Exception e) {
                        throw new AssertionError("迁移 " + f.getFileName() + " 执行失败：\n"
                                + sql.strip() + "\n→ " + e.getMessage(), e);
                    }
                }
            }
        }
    }

    /** {@code V32__ip_demo_kind.sql} → 32。编号是 Flyway 的排序真值，字典序会把 V1 排到 V19 后面。 */
    private static int versionOf(Path f) {
        var m = java.util.regex.Pattern.compile("^V(\\d+)__").matcher(f.getFileName().toString());
        return m.find() ? Integer.parseInt(m.group(1)) : Integer.MAX_VALUE;
    }
}
