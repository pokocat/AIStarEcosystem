package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.ai.ModelCallCtx;
import com.aistareco.aep.service.ai.UpstreamCallException;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 短剧渲染服务（v0.65）：分镜「首帧」图像生成 + 「直出/动态」视频生成。
 *
 *  - 首帧：用途 {@link AiModelPurpose#IMAGE_GENERATION}（OpenAI images 兼容
 *    POST {baseUrl}/images/generations，response_format=url|b64_json），产物字节按
 *    AGENTS §4.7 经 {@link CdnUploader} 落 CDN（DB 真值 = cdnKey，URL 由 signer 派生），
 *    成功后按 action 定价扣积分（{@link CreditService#debit}）。
 *  - 视频：委派 celebrity 既有管线 {@link MaterialVideoJobService}（kind="drama-shot"，
 *    异步 submit + poll，自带 hold/commit/release 计费）。轮询复用
 *    /api/me/drama/episodes/jobs/{id}。
 *
 * 不静默兜底：未绑定端点 503 IMAGE_NOT_CONFIGURED / 调用失败 502 IMAGE_CALL_FAILED。
 */
@Service
public class DramaRenderService {

    private static final Logger log = LoggerFactory.getLogger(DramaRenderService.class);
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    /** 首帧单价（积分）。与前端 FRAME_COST 对齐；后续可挪 admin 定价。 */
    public static final long FRAME_COST = 2L;

    private final AiModelInvocationService invocation;
    private final AiModelUsageService usage;
    private final UpstreamModelHttp upstreamHttp;
    private final MaterialVideoJobService videoJobs;
    private final CreditService creditService;
    private final CdnUploader cdnUploader;
    private final CdnUrlSigner signer;
    private final PlatformConfigService configs;
    private final PromptService promptService;
    private final com.aistareco.aep.service.storage.StorageQuotaService storage;
    private final ObjectMapper om;

    public DramaRenderService(AiModelInvocationService invocation,
                              AiModelUsageService usage,
                              UpstreamModelHttp upstreamHttp,
                              MaterialVideoJobService videoJobs,
                              CreditService creditService,
                              CdnUploader cdnUploader,
                              CdnUrlSigner signer,
                              PlatformConfigService configs,
                              PromptService promptService,
                              com.aistareco.aep.service.storage.StorageQuotaService storage,
                              ObjectMapper om) {
        this.invocation = invocation;
        this.usage = usage;
        this.upstreamHttp = upstreamHttp;
        this.videoJobs = videoJobs;
        this.creditService = creditService;
        this.cdnUploader = cdnUploader;
        this.signer = signer;
        this.configs = configs;
        this.promptService = promptService;
        this.storage = storage;
        this.om = om;
    }

    /**
     * 出图 / 出片提示词服务端化（v0.72）：模板存 PromptService（admin「短剧专区 · 提示词设置」可改），
     * 前端只传结构化字段（vars）+ kind（shot=工作台分镜 / short=短视频分镜）选模板。
     * §8.0：模板未配置（origin=code）即报错，不静默兜底。过渡期仍兼容旧客户端直接传 prompt。
     */
    private String buildMediaPrompt(JsonNode body, String workbenchKey, String shortKey) {
        String legacy = text(body, "prompt");
        if (legacy != null && !legacy.isBlank()) return legacy; // 过渡兼容；新前端走 vars
        String kind = orDefault(text(body, "kind"), "shot");
        String key = "short".equals(kind) ? shortKey : workbenchKey;
        PromptService.ResolvedPrompt p = promptService.resolve(key);
        if ("code".equals(p.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "分镜出图 / 出片的提示词尚未配置（promptKey=" + key
                            + "）。请在管理后台「短剧专区 · 提示词设置」补全后再试。");
        }
        Map<String, String> vars = new LinkedHashMap<>();
        JsonNode v = body.get("vars");
        if (v != null && v.isObject()) {
            v.fields().forEachRemaining(e ->
                    vars.put(e.getKey(), e.getValue() == null || e.getValue().isNull() ? "" : e.getValue().asText()));
        }
        // fill 后清掉未填充的残留占位符，避免把 {{x}} 原样喂给图像/视频模型
        String finalPrompt = PromptService.fill(p.userTemplate(), vars).replaceAll("\\{\\{[^}]*}}", "").trim();
        // 排查用：出图/出片拼装数据 + 最终发给模型的提示词全文（图像生成不走 ai-chat-io，这里兜底记录）。
        log.info("[drama-render] promptKey={} kind={} origin={} vars={} prompt={}", key, kind, p.origin(), vars, finalPrompt);
        return finalPrompt;
    }

    // ── 首帧（图像） ─────────────────────────────────────────────────────────────

    /**
     * body: { prompt, ratio?("9:16"|"16:9"|...), count?(1..4), ref_images?[] }
     * → { frames: [ { url, cdnKey } ... ], cost }
     */
    public JsonNode renderFrame(JsonNode body, String userId) {
        String prompt = buildMediaPrompt(body,
                PromptService.KEY_DRAMA_FRAME_IMAGE, PromptService.KEY_DRAMA_SHORT_FRAME_IMAGE);
        if (prompt.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_PROMPT_REQUIRED", "请先填写画面描述再渲染首帧");
        }
        AiModelEndpoint ep = invocation.resolveEndpoint(AiModelPurpose.IMAGE_GENERATION)
                .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "IMAGE_NOT_CONFIGURED",
                        "首帧渲染还没接入图像模型：请在管理后台为「图像生成」用途绑定一个模型端点后再试。"));
        int count = clamp(body.path("count").asInt(1), 1, 4);
        String size = ratioToSize(orDefault(text(body, "ratio"), "9:16"));

        // 存储配额前置：已满则不生成、不扣费，提示清理或购买存储套餐（产物字节未知，按已用是否超额校验）。
        storage.checkQuota("drama", userId, 0);

        ArrayNode frames = om.createArrayNode();
        for (int i = 0; i < count; i++) {
            byte[] bytes = callImageModel(ep, prompt, size, body.get("ref_images"));
            String key = "drama/frames/" + UUID.randomUUID().toString().replace("-", "") + ".png";
            try {
                Path tmp = Files.createTempFile("drama-frame-", ".png");
                try {
                    Files.write(tmp, bytes);
                    cdnUploader.upload(tmp, key, "image/png");
                } finally {
                    Files.deleteIfExists(tmp);
                }
            } catch (Exception e) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "IMAGE_STORE_FAILED",
                        "首帧已生成但存储失败，请重试。");
            }
            storage.record("drama", userId, "分镜首帧", null, key, bytes.length);
            ObjectNode f = om.createObjectNode();
            f.put("cdnKey", key);
            f.put("url", signer.signKey(key));
            frames.add(f);
        }

        // 一次「首帧渲染」动作 = 固定单价（admin 短剧专区可配），与版数解耦
        long cost = configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_FRAME, FRAME_COST);
        if (cost > 0) {
            creditService.debit(userId, cost, "DRAMA_FRAME",
                    "frame_" + UUID.randomUUID().toString().substring(0, 8),
                    "短剧首帧渲染（" + count + " 版）");
        }
        log.info("[drama-render] frame ok user={} count={} endpoint={} size={}", userId, count, ep.getName(), size);

        ObjectNode out = om.createObjectNode();
        out.set("frames", frames);
        out.put("cost", cost);
        return out;
    }

    /** OpenAI images 兼容调用：data[0].url（下载）或 b64_json（解码）→ 图像字节。 */
    private byte[] callImageModel(AiModelEndpoint ep, String prompt, String size, JsonNode refImages) {
        String requestId = "img-" + UUID.randomUUID().toString().substring(0, 16);
        long startNanos = System.nanoTime();
        try {
            ObjectNode req = om.createObjectNode();
            req.put("model", ep.getModel());
            req.put("prompt", prompt);
            if (size != null) req.put("size", size);
            ObjectNode extra = req.putObject("extra_body");
            extra.put("response_format", "url");
            if (refImages != null && refImages.isArray() && refImages.size() > 0) {
                ArrayNode arr = extra.putArray("image");
                refImages.forEach(n -> arr.add(n.asText()));
            }
            String apiKey = AepCryptoUtil.decrypt(ep.getUpstreamApiKeyEncrypted());
            URI uri = URI.create(rstrip(ep.getBaseUrl()) + "/images/generations");
            HttpRequest httpReq = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(120))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(req)))
                    .build();
            // v0.85：发送 + 原始日志 + 非 2xx WARN + 失败用量统一走共享原语。
            ModelCallCtx ctx = ModelCallCtx.builder(AiModelPurpose.IMAGE_GENERATION)
                    .endpoint(ep.getId(), ep.getName())
                    .model(ep.getModel())
                    .requestId(requestId)
                    .client(HTTP)
                    .build();
            HttpResponse<String> resp;
            try {
                resp = upstreamHttp.sendJson(httpReq, ctx);
            } catch (UpstreamCallException ex) {
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "IMAGE_CALL_FAILED",
                        "图像生成失败，请稍后重试",
                        "endpoint=" + ep.getName() + " err=" + ex.getCause());
            }
            if (resp.statusCode() / 100 != 2) {
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "IMAGE_CALL_FAILED",
                        "图像生成失败，请稍后重试",
                        "endpoint=" + ep.getName() + " model=" + ep.getModel()
                                + " status=" + resp.statusCode() + " body=" + truncate(resp.body(), 300));
            }
            String upstreamId = null;
            byte[] bytes;
            try {
                JsonNode root = om.readTree(resp.body());
                upstreamId = root.path("id").asText(null);
                JsonNode data0 = root.path("data").path(0);
                String url = data0.path("url").asText(null);
                if (url != null && !url.isBlank()) {
                    bytes = download(url);
                } else {
                    String b64 = data0.path("b64_json").asText(null);
                    if (b64 == null || b64.isBlank()) {
                        upstreamHttp.recordBadOutput(ctx, resp.body(), "IMAGE_BAD_OUTPUT", elapsedMs(startNanos));
                        throw new BusinessException(HttpStatus.BAD_GATEWAY, "IMAGE_BAD_OUTPUT",
                                "图像模型响应缺少 data[0].url / b64_json。");
                    }
                    bytes = Base64.getDecoder().decode(b64);
                }
            } catch (BusinessException e) {
                throw e;
            } catch (Exception e) {
                // 2xx 之后的处理（解析 / 下载产物 / 解码）失败：记一条失败用量后转业务错误。
                usage.recordObserved(ep.getId(), ep.getName(), ep.getModel(),
                        AiModelPurpose.IMAGE_GENERATION.name(), 0L, 0L, 0L, false,
                        requestId, upstreamId, elapsedMs(startNanos), e.getClass().getSimpleName(), e.getMessage());
                log.warn("[drama-render] image post-process failed: {}", e.toString());
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "IMAGE_CALL_FAILED",
                        "图像生成失败，请稍后重试",
                        "endpoint=" + ep.getName() + " err=" + e);
            }
            // 用量观测（best-effort，token 数图像接口通常不回）
            try {
                usage.recordMeteredObserved(ep.getId(), ep.getName(), ep.getModel(),
                        AiModelPurpose.IMAGE_GENERATION.name(), 0L, 0L, 0L,
                        AiModelBillingMode.PER_CALL, 1L, 0L, true,
                        requestId, upstreamId, elapsedMs(startNanos), null, null);
            } catch (Exception ignore) { /* 观测旁路，不阻塞主链路 */ }
            return bytes;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            // 仅覆盖发送前的准备阶段（序列化 / URI 构造等）；发送及之后的失败已在内层处理。
            usage.recordObserved(ep.getId(), ep.getName(), ep.getModel(),
                    AiModelPurpose.IMAGE_GENERATION.name(), 0L, 0L, 0L, false,
                    requestId, null, elapsedMs(startNanos), e.getClass().getSimpleName(), e.getMessage());
            log.warn("[drama-render] image call failed: {}", e.toString());
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "IMAGE_CALL_FAILED",
                    "图像生成失败，请稍后重试",
                    "endpoint=" + ep.getName() + " err=" + e);
        }
    }

    private static byte[] download(String url) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(60)).GET().build();
        HttpResponse<byte[]> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofByteArray());
        if (resp.statusCode() / 100 != 2 || resp.body() == null || resp.body().length == 0) {
            throw new IllegalStateException("download " + resp.statusCode());
        }
        if (resp.body().length > 64 * 1024 * 1024) throw new IllegalStateException("image too large");
        return resp.body();
    }

    // ── 视频（直出 / 动态） ───────────────────────────────────────────────────────

    /**
     * body: { prompt, name?, duration_sec?, ratio?, project_id?, shot_id?, frame_url?(首帧参考) }
     * → 视频任务卡（轮询走 /api/me/drama/episodes/jobs/{id}）。
     */
    public JsonNode renderClip(JsonNode body, String userId) {
        String prompt = buildMediaPrompt(body,
                PromptService.KEY_DRAMA_CLIP_VIDEO, PromptService.KEY_DRAMA_SHORT_CLIP_VIDEO);
        if (prompt.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_PROMPT_REQUIRED", "请先填写画面描述再生成视频");
        }
        // 存储配额前置：已满则不提交任务、不 hold 积分（成片字节出片后由 worker 记账）。
        storage.checkQuota("drama", userId, 0);
        int durationSec = clamp(body.path("duration_sec").asInt(5), 2, 60);
        String ratio = orDefault(text(body, "ratio"), "9:16");
        String name = orDefault(text(body, "name"), "短剧分镜");
        String projectId = text(body, "project_id");
        String sceneId = text(body, "scene_id");
        String shotId = text(body, "shot_id");
        String target = text(body, "target");
        String frameUrl = text(body, "frame_url");
        String lastFrameUrl = text(body, "last_frame_url");

        StringBuilder full = new StringBuilder(prompt);
        if (frameUrl != null && !frameUrl.isBlank()) {
            full.append("\n（严格基于该首帧画面延展动态：").append(frameUrl).append("）");
        }
        // v0.97 P2：尾帧（来自下一镜首帧 / decompose 末帧）→ seedance 双关键帧插值；
        // 视频客户端按协议抽出（seedance content[role=last_frame] / generic end_image），
        // 下游不支持则忽略不报错（§8.0：传入不生效 ≠ 静默伪造）。
        if (lastFrameUrl != null && !lastFrameUrl.isBlank()) {
            full.append("\n（并以该画面作为结尾帧：").append(lastFrameUrl).append("）");
        }

        ObjectNode item = om.createObjectNode();
        item.put("kind", "drama-shot");
        item.put("name", name);
        item.put("prompt", full.toString());
        item.put("duration_sec", durationSec);
        item.put("aspect_ratio", ratio);
        if (projectId != null && !projectId.isBlank()) item.put("script_id", projectId);
        ObjectNode vc = item.putObject("variant_config");
        vc.put("target", orDefault(target, orDefault(text(body, "kind"), "shot")));
        if (sceneId != null && !sceneId.isBlank()) vc.put("scene_id", sceneId);
        if (shotId != null && !shotId.isBlank()) vc.put("shot_id", shotId);
        if (body != null && body.hasNonNull("episode_no")) vc.put("episode_no", body.path("episode_no").asInt());
        ObjectNode submit = om.createObjectNode();
        ArrayNode items = submit.putArray("items");
        items.add(item);

        List<JsonNode> jobs = videoJobs.submit(submit, userId);
        log.info("[drama-render] clip queued user={} project={} dur={}s", userId, projectId, durationSec);
        return jobs.isEmpty() ? om.createObjectNode() : jobs.get(0);
    }

    // ── 工具 ────────────────────────────────────────────────────────────────────

    private static String ratioToSize(String ratio) {
        return switch (ratio) {
            case "16:9" -> "1280x720";
            case "1:1" -> "1024x1024";
            case "4:3" -> "1024x768";
            case "3:4" -> "768x1024";
            default -> "720x1280"; // 9:16 竖屏
        };
    }

    private static String rstrip(String s) {
        if (s == null) return "";
        String t = s.trim();
        return t.endsWith("/") ? t.substring(0, t.length() - 1) : t;
    }

    private static String truncate(String s, int n) {
        if (s == null) return "";
        return s.length() > n ? s.substring(0, n) + "…" : s;
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static String text(JsonNode n, String f) {
        JsonNode v = n == null ? null : n.get(f);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }
}
