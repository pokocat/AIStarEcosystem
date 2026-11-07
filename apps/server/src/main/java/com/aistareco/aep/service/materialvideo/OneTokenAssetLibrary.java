package com.aistareco.aep.service.materialvideo;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * OneToken 素材库：{@code POST /api/v3/video/assets} 同步上传，返回 {@code asset://ota-…}，约 6 小时过期。
 * 素材归账号所有，同一用户的其他 Key 和其他型号都能引用；每用户每分钟最多传 60 次，所有 Key 共用。
 */
final class OneTokenAssetLibrary implements VideoAssetLibrary {
    private static final Logger log = LoggerFactory.getLogger(OneTokenAssetLibrary.class);
    private static final ObjectMapper OM = new ObjectMapper();
    private static final int RATE_RETRIES = 2;
    private static final long DEFAULT_WAIT_SECONDS = 5;
    private static final long MAX_WAIT_SECONDS = 30;
    /**
     * 2026-11-07 用线上 Key 真调：不存在和已过期的引用都回
     * {@code 400 {"error":{"code":"InvalidParameter","message":"content[1].image_url: asset not found"}}}。
     * 文档还说过期素材不能引用，清理之前可能换一种说法，所以也认 expired。
     */
    private static final Pattern STALE_REFERENCE = Pattern.compile("(?i)_url:\\s*asset\\b.*\\b(not found|expired)\\b");

    /** 上传地址和响应字段的位置。字段位置都是 JSON Pointer。 */
    record Config(String uploadPath, String fileField, String ref, String status, List<String> ready, String expiresAt) {
        static Config read(String json) {
            try {
                Config config = OM.readValue(json, Config.class);
                config.validate();
                return config;
            } catch (IOException e) {
                throw new IllegalArgumentException("素材库配置不是合法 JSON", e);
            }
        }

        void validate() {
            if (uploadPath == null || !uploadPath.matches("/[A-Za-z0-9._~/-]{1,200}") || uploadPath.contains("..")
                    || uploadPath.startsWith("//")) throw new IllegalArgumentException("uploadPath 无效");
            if (fileField == null || !fileField.matches("[A-Za-z][A-Za-z0-9_.-]{0,63}"))
                throw new IllegalArgumentException("fileField 无效");
            if (!pointer(ref) || expiresAt != null && !pointer(expiresAt)) throw new IllegalArgumentException("字段位置无效");
            if ((status == null) != (ready == null)) throw new IllegalArgumentException("status 和 ready 要同时配置");
            if (status != null && (!pointer(status) || ready.isEmpty() || ready.stream().anyMatch(v -> v == null || v.isBlank())))
                throw new IllegalArgumentException("status 或 ready 无效");
        }

        private static boolean pointer(String value) {
            return value != null && value.startsWith("/") && value.length() <= 200;
        }
    }

    private final Config config;
    private final HttpClient http;
    private final Duration timeout;

    OneTokenAssetLibrary(Config config, HttpClient http, Duration timeout) {
        this.config = config;
        this.http = http;
        this.timeout = timeout;
    }

    /** {@code 429} 按厂商给的等待时间重试，等待有上限，超了就让任务失败。 */
    @Override
    public MaterialVideoInputAssets.Receipt submit(EndpointAccess access, LibraryFile file) {
        String label = file.label();
        URI uri = MaterialVideoModelClient.configuredRoute(access.baseUrl(), config.uploadPath(), null, access.model());
        String boundary = "----aistareco" + UUID.randomUUID().toString().replace("-", "");
        try {
            HttpResponse<String> resp;
            for (int attempt = 0; ; attempt++) {
                HttpRequest req = HttpRequest.newBuilder(uri)
                        .timeout(timeout)
                        .header(access.credentialHeader(), access.credentialValue())
                        .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                        .POST(MaterialVideoModelClient.multipartFile(boundary, config.fileField(), file.filename(),
                                file.format().mime(), file.path()))
                        .build();
                resp = http.send(req, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() != 429 || attempt >= RATE_RETRIES) break;
                Duration wait = retryAfter(resp.headers().firstValue("Retry-After").orElse(null));
                log.warn("[material-video] 素材库上传被限流，等待后重试 endpoint={} field={} attempt={} waitSec={} body={}",
                        access.endpointName(), file.mediaType(), attempt + 1, wait.toSeconds(),
                        MaterialVideoModelClient.snippet(resp.body()));
                Thread.sleep(wait.toMillis());
            }
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                log.warn("[material-video] 素材库上传被拒 endpoint={} model={} url={} field={} bytes={} contentType={} status={} body={}",
                        access.endpointName(), access.model(), uri, file.mediaType(), file.size(), file.format().mime(),
                        resp.statusCode(), MaterialVideoModelClient.snippet(resp.body()));
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                        resp.statusCode() == 429 ? label + "上传繁忙，请稍后重试"
                                : MaterialVideoModelClient.uploadFailureMessage(label, resp.statusCode(), resp.body()),
                        "status=" + resp.statusCode() + " url=" + uri + " body=" + MaterialVideoModelClient.snippet(resp.body()));
            }
            MaterialVideoInputAssets.Receipt receipt = receipt(config, resp.body(), label);
            log.info("[material-video] 素材已上传到素材库 endpoint={} model={} field={} bytes={} contentType={} ref={} expiresAt={}",
                    access.endpointName(), access.model(), file.mediaType(), file.size(), file.format().mime(),
                    receipt.assetId(), receipt.expiresAt());
            return receipt;
        } catch (BusinessException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                    label + "上传失败，请稍后重试", "interrupted");
        } catch (Exception e) {
            log.warn("[material-video] 素材库上传异常 endpoint={} field={} url={} err={}",
                    access.endpointName(), file.mediaType(), uri, e.toString());
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                    label + "上传失败，请稍后重试", "err=" + e);
        }
    }

    @Override
    public boolean rejectedStaleReference(int httpStatus, String responseBody) {
        if (httpStatus != 400 || responseBody == null || responseBody.isBlank()) return false;
        try {
            JsonNode error = OM.readTree(responseBody).path("error");
            return "InvalidParameter".equalsIgnoreCase(error.path("code").asText(""))
                    && STALE_REFERENCE.matcher(error.path("message").asText("")).find();
        } catch (IOException notJson) {
            return false;
        }
    }

    /** 没有引用、状态不可用都算失败；状态和引用只从配置指定的位置读。 */
    static MaterialVideoInputAssets.Receipt receipt(Config config, String body, String label) throws IOException {
        JsonNode root = OM.readTree(body);
        String ref = MaterialVideoModelClient.pointerText(root, config.ref());
        if (ref == null || ref.isBlank()) {
            log.warn("[material-video] 素材库返回里没有引用 pointer={} body={}", config.ref(), MaterialVideoModelClient.snippet(body));
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                    label + "上传失败，请稍后重试", "响应里没有素材引用: " + MaterialVideoModelClient.snippet(body));
        }
        if (config.status() != null) {
            String status = MaterialVideoModelClient.pointerText(root, config.status());
            if (status == null || !MaterialVideoModelClient.matchesStatus(config.ready(), status)) {
                log.warn("[material-video] 素材库素材不可用 status={} body={}", status, MaterialVideoModelClient.snippet(body));
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                        label + "尚未处理完成，请稍后重试", "status=" + status + " body=" + MaterialVideoModelClient.snippet(body));
            }
        }
        Instant expiresAt = config.expiresAt() == null ? null : expiry(root.at(config.expiresAt()));
        if (expiresAt != null && !expiresAt.isAfter(Instant.now().plusSeconds(60)))
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                    label + "上传失败，请稍后重试", "素材有效期不足 expiresAt=" + expiresAt);
        return new MaterialVideoInputAssets.Receipt(ref, expiresAt);
    }

    /** 文档只写了 expires_at 这个名字，没写格式，时间串和秒 / 毫秒时间戳都认。读不出来按未知处理：这次用完下次重传。 */
    static Instant expiry(JsonNode value) {
        if (value == null || value.isMissingNode() || value.isNull()) return null;
        String text = value.asText("").trim();
        try {
            if (text.matches("\\d+")) {
                long number = Long.parseLong(text);
                return number >= 100_000_000_000L ? Instant.ofEpochMilli(number) : Instant.ofEpochSecond(number);
            }
            return OffsetDateTime.parse(text).toInstant();
        } catch (RuntimeException unreadable) {
            log.warn("[material-video] 素材库有效期无法读取 value={}", text);
            return null;
        }
    }

    static Duration retryAfter(String header) {
        long seconds = DEFAULT_WAIT_SECONDS;
        if (header != null) {
            try { seconds = Long.parseLong(header.trim()); }
            catch (NumberFormatException httpDate) { /* 时间格式少见，按默认等待 */ }
        }
        return Duration.ofSeconds(Math.max(0, Math.min(seconds, MAX_WAIT_SECONDS)));
    }
}
