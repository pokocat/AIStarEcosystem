package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
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
    /** 角色定妆三视图单价（积分）默认值（admin「短剧专区」可改 KEY_PORTRAIT）。 */
    public static final long PORTRAIT_COST = 6L;
    /** 一致性中间件单次最多注入的参考图数量（对应 ViMax 的「最多 8 张」，这里收敛到 6 控成本）。 */
    private static final int MAX_REFS = 6;
    /** 定妆三视图的视角键（与前端 CharacterDef.portraits 字段对齐）。 */
    private static final String[] PORTRAIT_VIEWS = {"front", "side", "back"};

    private final AiModelInvocationService invocation;
    private final AiModelUsageService usage;
    private final MaterialVideoJobService videoJobs;
    private final CreditService creditService;
    private final CdnUploader cdnUploader;
    private final CdnUrlSigner signer;
    private final PlatformConfigService configs;
    private final PromptService promptService;
    private final ObjectMapper om;

    public DramaRenderService(AiModelInvocationService invocation,
                              AiModelUsageService usage,
                              MaterialVideoJobService videoJobs,
                              CreditService creditService,
                              CdnUploader cdnUploader,
                              CdnUrlSigner signer,
                              PlatformConfigService configs,
                              PromptService promptService,
                              ObjectMapper om) {
        this.invocation = invocation;
        this.usage = usage;
        this.videoJobs = videoJobs;
        this.creditService = creditService;
        this.cdnUploader = cdnUploader;
        this.signer = signer;
        this.configs = configs;
        this.promptService = promptService;
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

        // 视觉一致性中间件（可降级旁路；移植自 ViMax 的「参考注入」思路，不引入其依赖）：
        // 出图前从候选参考池（角色定妆三视图 + 场景参考图 + 本场历史帧）里挑参考图 + 改写「参考使用说明」，
        // 用文本 chat（复用 DRAMA_SCRIPT_DRAFT 端点）完成，不需要视觉模型。
        // §8.0：未配置 / 调用失败 / 解析失败 → 退回原始出图（真实产物，consistency.used=false），不伪造、不阻断、不额外扣费。
        JsonNode refImages = body.get("ref_images");
        ObjectNode consistency = om.createObjectNode();
        consistency.put("used", false);
        boolean wantConsistency = body.path("consistency").asBoolean(true)
                && body.get("ref_pool") != null && body.get("ref_pool").isArray() && body.get("ref_pool").size() > 0;
        if (wantConsistency) {
            String frameDesc = orDefault(text(body, "frame_desc"), varVisual(body));
            SelectionResult sel = selectReferences(frameDesc, body.get("ref_pool"));
            if (sel.used()) {
                prompt = prompt + "\n" + sel.usageClause();
                refImages = sel.selectedUrls();
                consistency.put("used", true);
                consistency.put("clause", sel.usageClause());
                consistency.set("selected", sel.selected());
            } else if (sel.reason() != null) {
                consistency.put("reason", sel.reason());
            }
        }

        ArrayNode frames = om.createArrayNode();
        for (int i = 0; i < count; i++) {
            byte[] bytes = callImageModel(ep, prompt, size, refImages);
            String key = uploadPng(bytes, "drama/frames/");
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
        log.info("[drama-render] frame ok user={} count={} endpoint={} size={} consistency={}",
                userId, count, ep.getName(), size, consistency.path("used").asBoolean(false));

        ObjectNode out = om.createObjectNode();
        out.set("frames", frames);
        out.put("cost", cost);
        out.set("consistency", consistency);
        return out;
    }

    // ── 角色定妆三视图（视觉一致性地基） ────────────────────────────────────────

    /**
     * 角色定妆参考图（正 / 侧 / 背三视图）一次性生成。出图前置，落 CDN（DB 真值 = cdnKey，URL signer 派生）。
     * body: { name, features?, style?, ratio?("3:4"...), ref_images?[]（可选：基于已绑数字人底图） }
     * → { portraits: { front:{cdnKey,url}, side:{...}, back:{...} }, cost }
     * 前端把 portraits 的 url 落进 CharacterDef.portraits，后续每帧出图作为角色参考注入。
     */
    public JsonNode renderPortraits(JsonNode body, String userId) {
        AiModelEndpoint ep = invocation.resolveEndpoint(AiModelPurpose.IMAGE_GENERATION)
                .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "IMAGE_NOT_CONFIGURED",
                        "角色定妆图还没接入图像模型：请在管理后台为「图像生成」用途绑定一个模型端点后再试。"));
        PromptService.ResolvedPrompt p = promptService.resolve(PromptService.KEY_DRAMA_CHARACTER_PORTRAIT);
        if ("code".equals(p.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "角色定妆参考图的提示词尚未配置（promptKey=" + PromptService.KEY_DRAMA_CHARACTER_PORTRAIT
                            + "）。请在管理后台「短剧专区 · 提示词设置」补全后再试。");
        }
        String name = orDefault(text(body, "name"), "角色");
        String features = orDefault(text(body, "features"), "");
        String styleSuffix = orDefault(text(body, "style"), "");
        String size = ratioToSize(orDefault(text(body, "ratio"), "3:4"));
        JsonNode refImages = body.get("ref_images"); // 可选：基于已绑数字人底图，定妆更贴脸

        ObjectNode portraits = om.createObjectNode();
        for (String view : PORTRAIT_VIEWS) {
            Map<String, String> vars = new LinkedHashMap<>();
            vars.put("view", portraitViewLabel(view));
            vars.put("name", name);
            vars.put("features", features);
            vars.put("styleSuffix", styleSuffix);
            String prompt = PromptService.fill(p.userTemplate(), vars).replaceAll("\\{\\{[^}]*}}", "").trim();
            byte[] bytes = callImageModel(ep, prompt, size, refImages);
            String key = uploadPng(bytes, "drama/portraits/");
            ObjectNode pv = om.createObjectNode();
            pv.put("cdnKey", key);
            pv.put("url", signer.signKey(key));
            portraits.set(view, pv);
        }

        long cost = configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_PORTRAIT, PORTRAIT_COST);
        if (cost > 0) {
            creditService.debit(userId, cost, "DRAMA_PORTRAIT",
                    "portrait_" + UUID.randomUUID().toString().substring(0, 8),
                    "角色定妆三视图（" + name + "）");
        }
        log.info("[drama-render] portraits ok user={} name={} endpoint={}", userId, name, ep.getName());
        ObjectNode out = om.createObjectNode();
        out.set("portraits", portraits);
        out.put("cost", cost);
        return out;
    }

    private static String portraitViewLabel(String view) {
        return switch (view) {
            case "side" -> "侧面视角，标准侧脸";
            case "back" -> "背面视角，背对镜头";
            default -> "正面视角，面向镜头";
        };
    }

    // ── 一致性参考选择（出图前的「挑参考图 + 改写参考说明」中间件） ──────────────────

    /** 选择结果：used=true 才注入；selectedUrls=按选中顺序的 URL 数组；selected=对应 {url,desc} 明细。 */
    private record SelectionResult(boolean used, ArrayNode selectedUrls, ArrayNode selected,
                                   String usageClause, String reason) {
        static SelectionResult degraded(String reason) {
            return new SelectionResult(false, null, null, null, reason);
        }
    }

    /**
     * 从候选参考池里挑参考图 + 生成「参考使用说明」。文本 chat（复用 DRAMA_SCRIPT_DRAFT 端点），不需要视觉模型。
     * 任一环节不可用即降级（返回 used=false + reason），由调用方退回原始出图。
     */
    private SelectionResult selectReferences(String frameDesc, JsonNode refPool) {
        List<JsonNode> items = new java.util.ArrayList<>();
        refPool.forEach(items::add);
        if (items.isEmpty()) return SelectionResult.degraded("empty_pool");
        if (!invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)) {
            return SelectionResult.degraded("text_model_not_configured");
        }
        PromptService.ResolvedPrompt p = promptService.resolve(PromptService.KEY_DRAMA_REF_SELECT);
        if ("code".equals(p.origin())) return SelectionResult.degraded("prompt_not_configured");
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("frame_desc", frameDesc == null ? "" : frameDesc);
        vars.put("candidates", buildCandidateBlock(items));
        String user = PromptService.fill(p.userTemplate(), vars);
        try {
            AiModelInvocationService.AiModelResponse resp = invocation.invokeChat(
                    AiModelPurpose.DRAMA_SCRIPT_DRAFT,
                    List.of(Map.of("role", "system", "content", p.system()),
                            Map.of("role", "user", "content", user)),
                    Map.of("temperature", 0.2, "max_tokens", 700,
                            "response_format", Map.of("type", "json_object")));
            return parseSelection(resp.content(), items);
        } catch (Exception e) {
            log.warn("[drama-render] ref-select degraded (call failed): {}", e.toString());
            return SelectionResult.degraded("selection_call_failed");
        }
    }

    /** 把候选参考池渲染成「候选N：描述」的编号清单（喂给选择模型）。 */
    static String buildCandidateBlock(List<JsonNode> items) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < items.size(); i++) {
            sb.append("候选").append(i).append("：").append(items.get(i).path("desc").asText("")).append('\n');
        }
        return sb.toString().strip();
    }

    /** 净化模型回的下标：丢弃越界 / 负数 / 重复，最多取 max 个（对应 ViMax 的 select_pairs_by_indices 越界保护）。 */
    static List<Integer> sanitizeIndices(JsonNode idxArr, int size, int max) {
        List<Integer> out = new java.util.ArrayList<>();
        if (idxArr == null || !idxArr.isArray()) return out;
        for (JsonNode n : idxArr) {
            int i = n.asInt(-1);
            if (i >= 0 && i < size && !out.contains(i)) {
                out.add(i);
                if (out.size() >= max) break;
            }
        }
        return out;
    }

    private SelectionResult parseSelection(String content, List<JsonNode> items) {
        try {
            JsonNode root = om.readTree(stripFences(content));
            List<Integer> idx = sanitizeIndices(root.get("ref_indices"), items.size(), MAX_REFS);
            if (idx.isEmpty()) return SelectionResult.degraded("no_refs_selected");
            ArrayNode urls = om.createArrayNode();
            ArrayNode selected = om.createArrayNode();
            for (int i : idx) {
                String url = items.get(i).path("url").asText(null);
                if (url == null || url.isBlank()) continue;
                urls.add(url);
                selected.add(items.get(i));
            }
            if (urls.isEmpty()) return SelectionResult.degraded("no_valid_refs");
            String clause = root.path("usage_clause").asText("");
            if (clause.isBlank()) clause = "请严格参照所提供的参考图，保持人物长相、场景与整体影调一致。";
            return new SelectionResult(true, urls, selected, clause, null);
        } catch (Exception e) {
            log.warn("[drama-render] ref-select degraded (parse failed): {}", e.toString());
            return SelectionResult.degraded("parse_failed");
        }
    }

    /** 容错：模型偶尔把 JSON 包在 ```json ``` 代码块里，剥掉围栏再解析。 */
    static String stripFences(String s) {
        if (s == null) return "{}";
        String t = s.strip();
        if (t.startsWith("```")) {
            int nl = t.indexOf('\n');
            if (nl >= 0) t = t.substring(nl + 1);
            if (t.endsWith("```")) t = t.substring(0, t.length() - 3);
        }
        return t.strip();
    }

    private static String varVisual(JsonNode body) {
        JsonNode v = body == null ? null : body.get("vars");
        if (v != null && v.isObject()) {
            JsonNode visual = v.get("visual");
            if (visual != null && !visual.isNull()) return visual.asText();
        }
        return "";
    }

    /** 图像字节 → 临时文件 → CDN（DB 真值 = cdnKey）。首帧 / 定妆图共用。 */
    private String uploadPng(byte[] bytes, String keyPrefix) {
        String key = keyPrefix + UUID.randomUUID().toString().replace("-", "") + ".png";
        try {
            Path tmp = Files.createTempFile("drama-img-", ".png");
            try {
                Files.write(tmp, bytes);
                cdnUploader.upload(tmp, key, "image/png");
            } finally {
                Files.deleteIfExists(tmp);
            }
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "IMAGE_STORE_FAILED",
                    "图像已生成但存储失败，请重试。");
        }
        return key;
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
            HttpResponse<String> resp = HTTP.send(httpReq, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() / 100 != 2) {
                log.warn("[drama-render] image http {} body={}", resp.statusCode(), truncate(resp.body(), 300));
                usage.recordObserved(ep.getId(), ep.getName(), ep.getModel(),
                        AiModelPurpose.IMAGE_GENERATION.name(), 0L, 0L, 0L, false,
                        requestId, null, elapsedMs(startNanos), "HTTP_" + resp.statusCode(), truncate(resp.body(), 300));
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "IMAGE_CALL_FAILED",
                        "图像生成失败，请稍后重试",
                        "endpoint=" + ep.getName() + " model=" + ep.getModel()
                                + " status=" + resp.statusCode() + " body=" + truncate(resp.body(), 300));
            }
            JsonNode root = om.readTree(resp.body());
            String upstreamId = root.path("id").asText(null);
            JsonNode data0 = root.path("data").path(0);
            String url = data0.path("url").asText(null);
            byte[] bytes;
            if (url != null && !url.isBlank()) {
                bytes = download(url);
            } else {
                String b64 = data0.path("b64_json").asText(null);
                if (b64 == null || b64.isBlank()) {
                    log.warn("[drama-render] image BAD_OUTPUT endpoint={} status={} body={}",
                            ep.getName(), resp.statusCode(), truncate(resp.body(), 600));
                    usage.recordObserved(ep.getId(), ep.getName(), ep.getModel(),
                            AiModelPurpose.IMAGE_GENERATION.name(), 0L, 0L, 0L, false,
                            requestId, upstreamId, elapsedMs(startNanos), "IMAGE_BAD_OUTPUT",
                            "图像模型响应缺少 data[0].url / b64_json。");
                    throw new BusinessException(HttpStatus.BAD_GATEWAY, "IMAGE_BAD_OUTPUT",
                            "图像模型响应缺少 data[0].url / b64_json。");
                }
                bytes = Base64.getDecoder().decode(b64);
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
        int durationSec = clamp(body.path("duration_sec").asInt(5), 2, 60);
        String ratio = orDefault(text(body, "ratio"), "9:16");
        String name = orDefault(text(body, "name"), "短剧分镜");
        String projectId = text(body, "project_id");
        String sceneId = text(body, "scene_id");
        String shotId = text(body, "shot_id");
        String target = text(body, "target");
        String frameUrl = text(body, "frame_url");

        StringBuilder full = new StringBuilder(prompt);
        if (frameUrl != null && !frameUrl.isBlank()) {
            full.append("\n（严格基于该首帧画面延展动态：").append(frameUrl).append("）");
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
