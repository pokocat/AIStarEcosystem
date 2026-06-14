package com.aistareco;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * v0.15+: 启用 @EnableScheduling 以让 PublishJobScheduler 的 @Scheduled 方法生效
 * （定时发布任务到点自动触发 startJob）。
 */
@SpringBootApplication
@EnableScheduling
public class AiStarEcoApplication {
    public static void main(String[] args) {
        loadLocalDotenv();
        SpringApplication.run(AiStarEcoApplication.class, args);
    }

    /**
     * 本地联调允许把 OSS / SMS / JWT 等环境变量放在 apps/server/.env。
     * 这里必须在 SpringApplication.run 之前加载，否则 @ConditionalOnProperty
     * 选择 CdnUploader Bean 时还读不到 AEP_CDN_DRIVER。
     */
    static void loadLocalDotenv() {
        loadDotenvFile(Path.of(".env"));
        loadDotenvFile(Path.of("apps/server/.env"));
    }

    private static void loadDotenvFile(Path path) {
        if (!Files.isRegularFile(path)) return;
        try {
            for (String raw : Files.readAllLines(path)) {
                String line = raw.trim();
                if (line.isBlank() || line.startsWith("#")) continue;
                if (line.startsWith("export ")) line = line.substring("export ".length()).trim();
                int idx = line.indexOf('=');
                if (idx <= 0) continue;
                String key = line.substring(0, idx).trim();
                String value = unquote(line.substring(idx + 1).trim());
                if (!key.isBlank() && System.getenv(key) == null && System.getProperty(key) == null) {
                    System.setProperty(key, value);
                }
            }
        } catch (IOException ignored) {
            // 不阻断启动；缺必需配置时由具体配置类 fail fast。
        }
    }

    private static String unquote(String value) {
        if (value.length() >= 2) {
            List<String> quotes = List.of("\"", "'");
            for (String quote : quotes) {
                if (value.startsWith(quote) && value.endsWith(quote)) {
                    return value.substring(1, value.length() - 1);
                }
            }
        }
        return value;
    }
}
