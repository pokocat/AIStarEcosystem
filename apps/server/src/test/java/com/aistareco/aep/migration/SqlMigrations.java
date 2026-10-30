package com.aistareco.aep.migration;

import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 把 SQL 迁移按 Flyway 的版本号顺序在同一个库上依次执行。
 *
 * <p>只跑 SQL 文件不等于 Flyway 的真实顺序：有的 Java 迁移会无条件建表，后面的 SQL 迁移再去改这些表
 * （V67 用 {@code db/schema/model-scoped-credits.sql} 建 {@code aep_model_charges}，V69 再给它加列）。
 * 整套 Flyway 在空库上跑不通（V48 等 Java 迁移要先有 Hibernate 建的表），所以这里只补
 * 「Java 迁移无条件执行的建表脚本」，在它的版本号位置执行，与生产一致。
 *
 * <p>新增一个 Java 迁移、而且它像 V67 那样无条件跑建表脚本时，在 {@link #JAVA_SCHEMA_SCRIPTS} 登记。
 */
final class SqlMigrations {

    static final Path DIR = Path.of("src/main/resources/db/migration");

    /** Java 迁移版本号 → 它无条件执行的建表脚本（classpath）。 */
    private static final Map<Integer, String> JAVA_SCHEMA_SCRIPTS = new TreeMap<>(Map.of(
            67, "db/schema/model-scoped-credits.sql"));

    private SqlMigrations() {}

    /** 全部 SQL 迁移文件，按版本号排序（字典序会把 V1 排到 V19 后面）。 */
    static List<Path> files() throws Exception {
        try (var s = Files.list(DIR)) {
            return s.filter(p -> p.toString().endsWith(".sql"))
                    .sorted(Comparator.comparingInt(SqlMigrations::versionOf))
                    .toList();
        }
    }

    /** 依次执行，任何一条失败就抛 {@link AssertionError} 并指出是哪个文件的哪条语句。 */
    static void runAll(Connection c) throws Exception {
        var pending = new TreeMap<>(JAVA_SCHEMA_SCRIPTS);
        try (Statement st = c.createStatement()) {
            for (Path f : files()) {
                int version = versionOf(f);
                while (!pending.isEmpty() && pending.firstKey() < version) {
                    var script = pending.pollFirstEntry();
                    try {
                        ScriptUtils.executeSqlScript(c, new ClassPathResource(script.getValue()));
                    } catch (Exception e) {
                        throw new AssertionError("V" + script.getKey() + " 的建表脚本 " + script.getValue()
                                + " 执行失败 → " + e.getMessage(), e);
                    }
                }
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

    /** 逐条切分：注释行去掉，按分号断句。 */
    static String[] statements(String sql) {
        String stripped = Arrays.stream(sql.split("\n"))
                .filter(l -> !l.trim().startsWith("--"))
                .reduce("", (a, b) -> a + "\n" + b);
        return Arrays.stream(stripped.split(";"))
                .map(String::trim).filter(s -> !s.isEmpty()).toArray(String[]::new);
    }

    /** {@code V32__ip_demo_kind.sql} → 32。编号是 Flyway 的排序真值。 */
    static int versionOf(Path f) {
        var m = java.util.regex.Pattern.compile("^V(\\d+)__").matcher(f.getFileName().toString());
        return m.find() ? Integer.parseInt(m.group(1)) : Integer.MAX_VALUE;
    }
}
