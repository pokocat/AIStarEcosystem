package com.aistareco.aep.service.music;

import com.aistareco.aep.config.MusicGenProperties;
import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;

/**
 * 音乐生成模型适配层：选端点 → 提交 → 轮询。
 *
 * <p>当前实现火山引擎「AI 音乐生成大模型」协议（{@code open.volcengineapi.com}）：
 * <ul>
 *   <li>提交 {@code POST /?Action=GenSongForTime&Version=2024-08-12} → {@code Result.TaskID}</li>
 *   <li>轮询 {@code POST /?Action=QuerySong&Version=2024-08-12} → {@code Result.Status}
 *       （0 等待 / 1 处理中 / 2 成功 / 3 失败）+ {@code Result.SongDetail}</li>
 * </ul>
 *
 * <p><b>鉴权与其余端点不同</b>：走 AK/SK 的 OpenAPI V4 签名，不是 Bearer。端点的
 * {@code upstreamApiKeyEncrypted} 里存 {@code "AK:SK"}（冒号分隔），由本类拆开后签名；
 * 密钥只在内存中使用，绝不出 wire、绝不进日志。
 *
 * <p>§8.0：端点未配置 / Key 缺失 / 时长越界一律抛带码异常，且这些校验都发生在
 * 冻结积分之前（见 {@code MusicGenJobService#submit}），保证不会「先扣费再失败」。
 */
@Service
public class MusicGenModelClient {

    private static final Logger log = LoggerFactory.getLogger(MusicGenModelClient.class);

    /** 未配置错误码 —— 前端据此提示去 admin 配置，而不是显示一个假结果。 */
    public static final String ERR_NOT_CONFIGURED = "MUSIC_NOT_CONFIGURED";
    public static final String ERR_SUBMIT_FAILED = "MUSIC_SUBMIT_FAILED";
    public static final String ERR_ENDPOINT_NOT_ALLOWED = "ENDPOINT_NOT_ALLOWED";
    public static final String ERR_DURATION_UNSUPPORTED = "MUSIC_DURATION_UNSUPPORTED";

    private final AiModelInvocationService invocation;
    private final MusicGenProperties props;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    public MusicGenModelClient(AiModelInvocationService invocation, MusicGenProperties props) {
        this.invocation = invocation;
        this.props = props;
    }

    // ── 端点解析 ────────────────────────────────────────────────────────────

    /** 指定 endpointId 时必须命中候选白名单；未命中一律 503，绝不静默回退默认端点。 */
    private AiModelEndpoint pickEndpoint(String endpointId) {
        if (endpointId != null && !endpointId.isBlank()) {
            return invocation.resolveEndpoint(AiModelPurpose.MUSIC_GENERATION, endpointId)
                    .map(AiModelInvocationService.ResolvedEndpoint::endpoint)
                    .filter(e -> e.getBaseUrl() != null && !e.getBaseUrl().isBlank())
                    .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,
                            ERR_ENDPOINT_NOT_ALLOWED,
                            "所选音乐模型不在该用途的可用列表里，请重新选择。"));
        }
        return invocation.resolveEndpoint(AiModelPurpose.MUSIC_GENERATION)
                .filter(e -> e.getBaseUrl() != null && !e.getBaseUrl().isBlank())
                .orElse(null);
    }

    private AiModelEndpoint requireEndpoint(String endpointId) {
        AiModelEndpoint ep = pickEndpoint(endpointId);
        if (ep == null) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, ERR_NOT_CONFIGURED,
                    "音乐生成尚未配置可用模型端点。请在管理后台「平台 · AI 模型」新增端点后，"
                            + "到「AI 应用绑定」把用途「音乐生成」绑定到该端点。");
        }
        return ep;
    }

    /** 端点是否已就绪 —— 供 preflight 在冻结积分前判断。 */
    public boolean isConfigured() {
        try {
            return pickEndpoint(null) != null;
        } catch (Exception e) {
            return false;
        }
    }

    public void ensureConfigured(String endpointId) {
        requireEndpoint(endpointId);
    }

    /** AK/SK 以 "AK:SK" 形式存在端点的加密 Key 字段里。 */
    private record AkSk(String ak, String sk) {
    }

    private AkSk requireAkSk(AiModelEndpoint ep) {
        String raw;
        try {
            raw = AepCryptoUtil.decrypt(ep.getUpstreamApiKeyEncrypted());
        } catch (Exception e) {
            raw = null;
        }
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, ERR_NOT_CONFIGURED,
                    "音乐生成端点「" + ep.getName() + "」未配置访问密钥。"
                            + "请在「平台 · AI 模型」把该端点的 Key 填成「AccessKeyId:AccessKeySecret」格式。");
        }
        int i = raw.indexOf(':');
        if (i <= 0 || i == raw.length() - 1) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, ERR_NOT_CONFIGURED,
                    "音乐生成端点「" + ep.getName() + "」的密钥格式不正确。"
                            + "火山引擎音乐 API 需要 AK/SK 签名，请填成「AccessKeyId:AccessKeySecret」。");
        }
        return new AkSk(raw.substring(0, i).trim(), raw.substring(i + 1).trim());
    }

    // ── 参数校验（必须在 hold 之前调用）──────────────────────────────────────

    /**
     * 校验时长是否在模型支持区间。越界直接 400，不建任务不扣费。
     * 上限优先取候选端点的 capability（maxDurationSec），否则用全局默认。
     */
    public void validateRequest(String endpointId, int durationSec, boolean instrumental) {
        requireEndpoint(endpointId);
        int max = instrumental ? props.getMaxInstrumentalDurationSec() : props.getMaxDurationSec();
        Integer capMax = invocation.resolveEndpoint(AiModelPurpose.MUSIC_GENERATION, endpointId)
                .map(AiModelInvocationService.ResolvedEndpoint::candidate)
                .map(c -> c == null ? null : c.getMaxDurationSec())
                .orElse(null);
        if (capMax != null && capMax > 0) {
            max = Math.min(max, capMax);
        }
        int min = instrumental ? 1 : props.getMinDurationSec();
        if (durationSec < min || durationSec > max) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, ERR_DURATION_UNSUPPORTED,
                    (instrumental ? "纯音乐" : "歌曲") + "时长需在 " + min + "–" + max + " 秒之间。");
        }
    }

    /**
     * 按秒展开单价。语义与视频线一致：PER_SECOND 端点下 {@code creditCostOverride} 是
     * 「每秒积分」，PER_CALL 是「每次积分」。未配则回落全局默认每秒单价。
     */
    public long resolveCreditCost(String endpointId, int durationSec) {
        var resolved = invocation.resolveEndpoint(AiModelPurpose.MUSIC_GENERATION, endpointId).orElse(null);
        Long override = resolved == null || resolved.candidate() == null
                ? null : resolved.candidate().getCreditCostOverride();
        long rate = override != null ? Math.max(0L, override) : props.getDefaultCreditsPerSecond();
        boolean perSecond = resolved == null
                || resolved.endpoint().getBillingMode() == AiModelBillingMode.PER_SECOND;
        if (!perSecond) return rate;
        return Math.multiplyExact(rate, Math.max(1, durationSec));
    }

    // ── 提交 ────────────────────────────────────────────────────────────────

    public record SubmitSpec(String prompt, String lyrics, String genre, String mood,
                             String timbre, String gender, int durationSec,
                             boolean instrumental, String endpointId) {
    }

    public record SubmitResult(String taskId, String providerUsed, String modelUsed, String endpointId) {
    }

    public SubmitResult submit(SubmitSpec spec) {
        AiModelEndpoint ep = requireEndpoint(spec.endpointId());
        AkSk key = requireAkSk(ep);

        ObjectNode body = mapper.createObjectNode();
        // Lyrics 优先级高于 Prompt（火山契约）；两者至少一个非空由上层保证。
        if (spec.lyrics() != null && !spec.lyrics().isBlank()) {
            body.put("Lyrics", spec.lyrics().trim());
        } else if (spec.prompt() != null && !spec.prompt().isBlank()) {
            body.put("Prompt", spec.prompt().trim());
        }
        String modelVersion = ep.getModel();
        if (modelVersion != null && !modelVersion.isBlank()) {
            body.put("ModelVersion", modelVersion.trim());
        }
        putIfPresent(body, "Genre", spec.genre());
        putIfPresent(body, "Mood", spec.mood());
        putIfPresent(body, "Timbre", spec.timbre());
        putIfPresent(body, "Gender", spec.gender());
        if (spec.durationSec() > 0) body.put("Duration", spec.durationSec());
        body.put("VodFormat", props.getVolcAudioFormat());
        body.put("AigcWatermark", props.isVolcAigcWatermark());

        JsonNode root = call(ep, key, props.getVolcSongAction(), body);
        String taskId = root.path("Result").path("TaskID").asText(null);
        if (taskId == null || taskId.isBlank()) {
            String msg = root.path("Message").asText("");
            log.warn("[music-gen] submit returned no TaskID endpoint={} message={}", ep.getId(), msg);
            throw new BusinessException(HttpStatus.BAD_GATEWAY, ERR_SUBMIT_FAILED,
                    "音乐生成任务提交失败，请稍后重试。");
        }
        return new SubmitResult(taskId, ep.getName(), modelVersion, ep.getId());
    }

    // ── 轮询 ────────────────────────────────────────────────────────────────

    /** 上游终态与产物。audioUrl 是时效地址，必须镜像后再出 wire。 */
    public record PollResult(String status, int progress, String audioUrl, Integer durationSec,
                             String lyrics, String captions, String failReason) {
        public boolean succeeded() {
            return "succeeded".equals(status);
        }

        public boolean failed() {
            return "failed".equals(status);
        }
    }

    public PollResult poll(String endpointId, String taskId) {
        AiModelEndpoint ep = requireEndpoint(endpointId);
        AkSk key = requireAkSk(ep);

        ObjectNode body = mapper.createObjectNode();
        body.put("TaskID", taskId);
        JsonNode root = call(ep, key, props.getVolcQueryAction(), body);

        JsonNode result = root.path("Result");
        // 火山状态码：0 等待中 / 1 处理中 / 2 成功 / 3 失败
        int raw = result.path("Status").asInt(-1);
        String status = switch (raw) {
            case 2 -> "succeeded";
            case 3 -> "failed";
            default -> "processing";
        };
        int progress = clamp(result.path("Progress").asInt(0), 0, 100);

        JsonNode detail = result.path("SongDetail");
        String audioUrl = textOrNull(detail.path("AudioUrl"));
        Integer duration = detail.hasNonNull("Duration")
                ? (int) Math.round(detail.path("Duration").asDouble(0)) : null;
        String lyrics = textOrNull(detail.path("Lyrics"));
        String captions = textOrNull(detail.path("Captions"));

        String failReason = null;
        JsonNode fr = result.path("FailureReason");
        if (!fr.isMissingNode() && !fr.isNull()) {
            failReason = fr.path("Msg").asText(null);
        }
        return new PollResult(status, progress, audioUrl, duration, lyrics, captions, failReason);
    }

    // ── HTTP ────────────────────────────────────────────────────────────────

    private JsonNode call(AiModelEndpoint ep, AkSk key, String action, ObjectNode body) {
        String base = ep.getBaseUrl().trim();
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        URI uri = URI.create(base + "/?Action=" + action + "&Version=" + props.getVolcVersion());

        String payload;
        try {
            payload = mapper.writeValueAsString(body);
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, ERR_SUBMIT_FAILED,
                    "音乐生成请求构造失败。");
        }

        var signed = VolcOpenApiSigner.signPostJson(uri, payload, key.ak(), key.sk(),
                props.getVolcRegion(), props.getVolcService(), Instant.now());

        HttpRequest.Builder req = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(payload));
        signed.headers().forEach((k, v) -> {
            // Host 由 JDK HttpClient 自行设置，显式设会被拒绝。
            if (!"Host".equalsIgnoreCase(k)) req.header(k, v);
        });

        HttpResponse<String> resp;
        try {
            resp = http.send(req.build(), HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            log.warn("[music-gen] {} transport failure endpoint={}: {}", action, ep.getId(), e.toString());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "MUSIC_CALL_FAILED",
                    "音乐生成服务暂时不可用，请稍后重试。");
        }
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            // 上游响应体可能含账号信息，只进服务端日志，不出 wire。
            log.warn("[music-gen] {} http {} endpoint={} body={}", action, resp.statusCode(),
                    ep.getId(), truncate(resp.body(), 500));
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "MUSIC_CALL_FAILED",
                    "音乐生成服务返回异常，请稍后重试。");
        }
        JsonNode root;
        try {
            root = mapper.readTree(resp.body());
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "MUSIC_BAD_OUTPUT",
                    "音乐生成服务返回了无法解析的内容。");
        }
        int code = root.path("Code").asInt(0);
        JsonNode err = root.path("ResponseMetadata").path("Error");
        if (code != 0 || (!err.isMissingNode() && !err.isNull())) {
            String upstream = err.path("Message").asText(root.path("Message").asText(""));
            log.warn("[music-gen] {} biz error endpoint={} code={} msg={}", action, ep.getId(), code, upstream);
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "MUSIC_CALL_FAILED",
                    "音乐生成失败：" + (upstream.isBlank() ? "上游返回错误" : upstream));
        }
        return root;
    }

    private static void putIfPresent(ObjectNode node, String field, String value) {
        if (value != null && !value.isBlank()) node.put(field, value.trim());
    }

    private static String textOrNull(JsonNode n) {
        if (n == null || n.isMissingNode() || n.isNull()) return null;
        String s = n.asText();
        return (s == null || s.isBlank()) ? null : s;
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
