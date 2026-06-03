package com.aistareco.aep.service.cdn;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Real OSS smoke test. Skips unless all AEP_CDN_OSS_* env vars are present.
 */
class AliyunOssCdnUploaderSmokeTest {

    @Test
    void uploadsBuildsPublicUrlAndDeletesRealObject() throws Exception {
        String endpoint = env("AEP_CDN_OSS_ENDPOINT");
        String bucket = env("AEP_CDN_OSS_BUCKET");
        String accessKeyId = env("AEP_CDN_OSS_ACCESS_KEY_ID");
        String accessKeySecret = env("AEP_CDN_OSS_ACCESS_KEY_SECRET");
        String baseUrl = env("AEP_CDN_OSS_BASE_URL");
        String keyPrefix = envOrBlank("AEP_CDN_OSS_KEY_PREFIX");

        Assumptions.assumeTrue(
                hasText(endpoint) && hasText(bucket) && hasText(accessKeyId)
                        && hasText(accessKeySecret) && hasText(baseUrl),
                "Set AEP_CDN_OSS_ENDPOINT/BUCKET/ACCESS_KEY_ID/ACCESS_KEY_SECRET/BASE_URL to run real OSS smoke test"
        );

        // v0.47+: 构造器多 3 个签名相关参数（strategy / ttl / cdn-auth-key）
        AliyunOssCdnUploader uploader = new AliyunOssCdnUploader(
                endpoint, bucket, accessKeyId, accessKeySecret, baseUrl, keyPrefix,
                "none", 3600L, "");
        Path tmp = Files.createTempFile("aistareco-oss-smoke-", ".txt");
        String key = "codex-smoke/" + UUID.randomUUID() + ".txt";
        CdnUploader.CdnUploadResult result = null;

        try {
            String body = "ai-star-eco oss smoke " + Instant.now();
            Files.writeString(tmp, body);

            result = uploader.upload(tmp, key, "text/plain; charset=utf-8");

            assertTrue(result.uploadedBytes() > 0);
            assertTrue(result.key().endsWith(key));
            assertEquals(result.cdnUrl(), uploader.publicUrlFor(result.key()));
            if (verifyPublicGet()) {
                HttpResponse<String> response = HttpClient.newHttpClient().send(
                        HttpRequest.newBuilder(URI.create(result.cdnUrl()))
                                .timeout(Duration.ofSeconds(15))
                                .GET()
                                .build(),
                        HttpResponse.BodyHandlers.ofString()
                );
                assertEquals(200, response.statusCode(), "public CDN/OSS URL must be directly readable");
                assertEquals(body, response.body());
            }
        } finally {
            if (result != null) uploader.delete(result.key());
            uploader.shutdown();
            Files.deleteIfExists(tmp);
        }
    }

    private static String env(String name) {
        return System.getenv(name);
    }

    private static String envOrBlank(String name) {
        String value = System.getenv(name);
        return value == null ? "" : value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static boolean verifyPublicGet() {
        String value = envOrBlank("AEP_CDN_OSS_VERIFY_PUBLIC_GET");
        return "1".equals(value) || "true".equalsIgnoreCase(value);
    }
}
