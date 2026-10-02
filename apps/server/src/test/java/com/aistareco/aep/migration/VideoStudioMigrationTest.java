package com.aistareco.aep.migration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * V37（视频生成区：智能优化记录 + 模板）在 H2 MySQL 模式下按版本顺序跑完全部 SQL 迁移后：
 * 两张表真的建出来、默认值对、同一用户同一 clientRequestId 只能有一条（去重靠它，不是靠代码里先查后插）。
 */
class VideoStudioMigrationTest {

    private static final Path MIGRATIONS = Path.of("src/main/resources/db/migration");

    private static String[] statements(String sql) {
        String stripped = Arrays.stream(sql.split("\n"))
                .filter(l -> !l.trim().startsWith("--"))
                .reduce("", (a, b) -> a + "\n" + b);
        return Arrays.stream(stripped.split(";")).map(String::trim).filter(s -> !s.isEmpty()).toArray(String[]::new);
    }

    private static int versionOf(Path f) {
        var m = java.util.regex.Pattern.compile("^V(\\d+)__").matcher(f.getFileName().toString());
        return m.find() ? Integer.parseInt(m.group(1)) : Integer.MAX_VALUE;
    }

    @Test
    @DisplayName("V37 建表 + 默认值 + (owner_user_id, client_request_id) 唯一")
    void v37TablesWork() throws Exception {
        assertTrue(Files.exists(MIGRATIONS.resolve("V37__video_studio_optimization_and_template.sql")));
        List<Path> files;
        try (var s = Files.list(MIGRATIONS)) {
            files = s.filter(p -> p.toString().endsWith(".sql"))
                    .sorted(Comparator.comparingInt(VideoStudioMigrationTest::versionOf))
                    .toList();
        }
        try (Connection c = DriverManager.getConnection(
                "jdbc:h2:mem:vs37" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
             Statement st = c.createStatement()) {
            for (Path f : files) {
                for (String sql : statements(Files.readString(f))) st.execute(sql);
            }

            st.execute("INSERT INTO video_studio_prompt_optimization (id, owner_user_id, client_request_id, spec_json, "
                    + "original_prompt) VALUES ('vso_1', 'u1', 'crid-0001', '{}', '一只猫')");
            try (ResultSet rs = st.executeQuery("SELECT status, credits_held FROM video_studio_prompt_optimization WHERE id = 'vso_1'")) {
                assertTrue(rs.next());
                assertEquals("queued", rs.getString(1));
                assertEquals(0L, rs.getLong(2));
            }
            // 同一用户同一 clientRequestId：第二条必须被唯一键挡住
            assertThrows(SQLException.class, () -> st.execute(
                    "INSERT INTO video_studio_prompt_optimization (id, owner_user_id, client_request_id, spec_json, "
                            + "original_prompt) VALUES ('vso_2', 'u1', 'crid-0001', '{}', 'x')"));
            // 换个用户同一个串没问题
            st.execute("INSERT INTO video_studio_prompt_optimization (id, owner_user_id, client_request_id, spec_json, "
                    + "original_prompt) VALUES ('vso_3', 'u2', 'crid-0001', '{}', 'x')");

            st.execute("INSERT INTO video_studio_template (id, owner_user_id, scope, title, source_job_id, recipe_json) "
                    + "VALUES ('vst_1', 'u1', 'private', '模板', 'mvj_1', '{}')");
            try (ResultSet rs = st.executeQuery("SELECT status, use_count FROM video_studio_template WHERE id = 'vst_1'")) {
                assertTrue(rs.next());
                assertEquals("active", rs.getString(1));
                assertEquals(0, rs.getInt(2));
            }
            st.execute("UPDATE video_studio_template SET use_count = use_count + 1 WHERE id = 'vst_1'");
            try (ResultSet rs = st.executeQuery("SELECT use_count FROM video_studio_template WHERE id = 'vst_1'")) {
                assertTrue(rs.next());
                assertEquals(1, rs.getInt(1));
            }
        }
    }
}
