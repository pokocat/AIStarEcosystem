package com.aistareco.aep.aiavatar.provider.impl;

import com.aistareco.aep.aiavatar.model.AiAvatarAssetKind;
import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.aistareco.aep.aiavatar.model.AiAvatarStandardShot;
import com.aistareco.aep.aiavatar.provider.AbstractCapabilityProvider;
import com.aistareco.aep.aiavatar.provider.AiAvatarJobContext;
import com.aistareco.aep.aiavatar.provider.AssetSpec;
import com.aistareco.aep.aiavatar.provider.ProviderHealth;
import com.aistareco.aep.aiavatar.provider.ProviderResult;
import com.aistareco.aep.aiavatar.service.AiAvatarStorage;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.PromptService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * AiAvatar 图像能力的 backend 实现。
 *
 * 运行链路：
 *  1. prompt_template 内置/运营配置的 aiavatar.* prompt；
 *  2. AIAVATAR_PROMPT_REWRITE / AIAVATAR_STANDARD_SHOTS 真实 chat 调用生成最终出图 prompt；
 *  3. AIAVATAR_IMAGE_GENERATION / AIAVATAR_IMAGE_EDIT 真实 image endpoint 调用；
 *  4. URL 或 b64 结果落为 AiAvatarAsset。
 */
public class BackendImageProvider extends AbstractCapabilityProvider {

    private final AiModelInvocationService gateway;
    private final PromptService promptService;

    public BackendImageProvider(AiAvatarCapability capability,
                                AiModelInvocationService gateway,
                                AiAvatarStorage storage,
                                ObjectMapper mapper,
                                PromptService promptService) {
        super(capability, AiAvatarProviderMode.BACKEND, "LLM-Gateway:" + capability.wire(), storage, mapper);
        this.gateway = gateway;
        this.promptService = promptService;
    }

    @Override
    public ProviderResult run(JsonNode input, AiAvatarJobContext ctx) throws Exception {
        requireGateway();
        if (hasStandardShots(input)) {
            return runStandardShots(input, ctx);
        }
        return runSinglePrompt(input, ctx);
    }

    private ProviderResult runSinglePrompt(JsonNode input, AiAvatarJobContext ctx) throws Exception {
        AiModelPurpose promptPurpose = AiModelPurpose.AIAVATAR_PROMPT_REWRITE;
        AiModelPurpose imagePurpose = imagePurposeFor(capability);
        ensureBound(promptPurpose);
        ensureBound(imagePurpose);

        int variants = clamp(input == null ? 1 : input.path("variants").asInt(1), 1, 5);
        ctx.onProgress(15, "大模型改写出图提示词");
        String prompt = rewritePrompt(promptPurpose, promptKeyFor(capability), variablesFor(input, variants), false);
        ctx.onProgress(45, "调用图像模型生成");

        AiModelInvocationService.AiImageResponse imageResp = gateway.invokeImageGeneration(
                imagePurpose, prompt, variants, imageSize(input, null), imageOptions(input));
        List<AssetSpec> specs = toAssetSpecs(imageResp, null, ctx, prompt);
        return ProviderResult.of(specs, metaJson(prompt, imageResp.modelUsed(), imagePurpose));
    }

    private ProviderResult runStandardShots(JsonNode input, AiAvatarJobContext ctx) throws Exception {
        ensureBound(AiModelPurpose.AIAVATAR_STANDARD_SHOTS);
        ensureBound(AiModelPurpose.AIAVATAR_IMAGE_GENERATION);

        List<AiAvatarStandardShot> shots = requestedShots(input);
        ctx.onProgress(15, "大模型规划标准 6 镜头");
        Map<AiAvatarStandardShot, String> prompts = standardShotPrompts(input, shots);
        List<AssetSpec> all = new ArrayList<>();
        int done = 0;
        for (AiAvatarStandardShot shot : shots) {
            String prompt = prompts.get(shot);
            if (prompt == null || prompt.isBlank()) {
                throw new IllegalStateException("AI_BAD_OUTPUT: 标准镜头缺少 prompt: " + shot.wire());
            }
            ctx.onProgress(25 + (done * 60 / Math.max(1, shots.size())), "生成" + shot.label());
            AiModelInvocationService.AiImageResponse resp = gateway.invokeImageGeneration(
                    AiModelPurpose.AIAVATAR_IMAGE_GENERATION, prompt, 1, imageSize(input, shot), imageOptions(input));
            all.addAll(toAssetSpecs(resp, shot, ctx, prompt));
            done++;
        }
        return ProviderResult.of(all, metaJson(prompts.toString(), "standard-shots", AiModelPurpose.AIAVATAR_STANDARD_SHOTS));
    }

    private String rewritePrompt(AiModelPurpose purpose, String promptKey, Map<String, String> vars, boolean jsonMode) {
        PromptService.ResolvedPrompt p = promptService.resolve(promptKey);
        List<Map<String, String>> messages = new ArrayList<>();
        if (p.system() != null && !p.system().isBlank()) {
            messages.add(Map.of("role", "system", "content", p.system()));
        }
        messages.add(Map.of("role", "user", "content", PromptService.fill(p.userTemplate(), vars)));
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", p.params().temperatureOrDefault());
        options.put("max_tokens", p.params().maxTokensOrDefault());
        if (jsonMode) {
            options.put("response_format", Map.of("type", "json_object"));
        }
        AiModelInvocationService.AiModelResponse resp = gateway.invokeChat(purpose, messages, options);
        String content = resp.content() == null ? "" : resp.content().trim();
        if (content.isBlank()) {
            throw new IllegalStateException("AI_BAD_OUTPUT: 大模型未返回有效提示词");
        }
        return extractPromptText(content);
    }

    private Map<AiAvatarStandardShot, String> standardShotPrompts(JsonNode input, List<AiAvatarStandardShot> shots) {
        Map<String, String> vars = variablesFor(input, shots.size());
        vars.put("shots", String.join(",", shots.stream().map(AiAvatarStandardShot::wire).toList()));
        vars.put("storyboard", input != null && input.has("storyboard") ? input.get("storyboard").toString() : "{}");
        String content = rewritePrompt(AiModelPurpose.AIAVATAR_STANDARD_SHOTS,
                PromptService.KEY_AIAVATAR_STANDARD_SHOTS, vars, true);
        Map<AiAvatarStandardShot, String> out = parseShotPromptJson(content);
        if (out.isEmpty()) {
            throw new IllegalStateException("AI_BAD_OUTPUT: 标准 6 镜头 prompt JSON 无法解析");
        }
        return out;
    }

    private List<AssetSpec> toAssetSpecs(AiModelInvocationService.AiImageResponse resp,
                                         AiAvatarStandardShot shot,
                                         AiAvatarJobContext ctx,
                                         String prompt) {
        List<AssetSpec> specs = new ArrayList<>();
        int[] dims = dims(resp.size());
        int i = 0;
        for (AiModelInvocationService.AiImageItem item : resp.images()) {
            String url = item.url();
            long bytes = 0;
            String mime = "image/png";
            if ((url == null || url.isBlank()) && item.b64Json() != null && !item.b64Json().isBlank()) {
                DecodedImage decoded = decodeB64(item.b64Json());
                AiAvatarStorage.StoredFile stored = storage.writeBytes(decoded.bytes(), ctx.ownerUserId(), decoded.ext(), decoded.mime());
                url = stored.url();
                bytes = stored.bytes();
                mime = decoded.mime();
            }
            if (url == null || url.isBlank()) continue;
            ObjectNode meta = mapper.createObjectNode();
            meta.put("prompt", prompt);
            meta.put("model", resp.modelUsed());
            if (item.revisedPrompt() != null) meta.put("revisedPrompt", item.revisedPrompt());
            meta.put("index", i++);
            specs.add(AssetSpec.builder()
                    .kind(assetKindFor(shot))
                    .standardShot(shot)
                    .fileUrl(url)
                    .thumbnailUrl(url)
                    .mimeType(mime)
                    .width(dims[0])
                    .height(dims[1])
                    .fileSize(bytes)
                    .engine(resp.endpointUsed() + "/" + resp.modelUsed())
                    .metaJson(meta.toString())
                    .build());
        }
        return specs;
    }

    @Override
    public ProviderHealth healthcheck() {
        if (gateway == null) return ProviderHealth.down("LLM gateway missing");
        List<String> missing = new ArrayList<>();
        for (AiModelPurpose purpose : requiredPurposesForHealth()) {
            if (!gateway.hasEndpointFor(purpose)) missing.add(purpose.wire());
        }
        return missing.isEmpty()
                ? ProviderHealth.ok("LLM gateway bound: " + capability.wire())
                : ProviderHealth.down("无可用大模型端点(" + String.join(",", missing) + ")");
    }

    private List<AiModelPurpose> requiredPurposesForHealth() {
        if (capability == AiAvatarCapability.RESTORE) {
            return List.of(AiModelPurpose.AIAVATAR_PROMPT_REWRITE,
                    AiModelPurpose.AIAVATAR_IMAGE_GENERATION,
                    AiModelPurpose.AIAVATAR_STANDARD_SHOTS);
        }
        return List.of(AiModelPurpose.AIAVATAR_PROMPT_REWRITE, imagePurposeFor(capability));
    }

    private AiModelPurpose imagePurposeFor(AiAvatarCapability cap) {
        return switch (cap) {
            case IMG2IMG, INPAINT, MAKEUP, HAIR -> AiModelPurpose.AIAVATAR_IMAGE_EDIT;
            default -> AiModelPurpose.AIAVATAR_IMAGE_GENERATION;
        };
    }

    private AiAvatarAssetKind assetKindFor(AiAvatarStandardShot shot) {
        if (shot == AiAvatarStandardShot.EXPRESSION) return AiAvatarAssetKind.EXPRESSION_IMAGE;
        if (shot != null) return AiAvatarAssetKind.IMAGE_2D;
        return switch (capability) {
            case FACE_CLONE, TXT2IMG, IMG2IMG -> AiAvatarAssetKind.DRAFT_IMAGE;
            default -> AiAvatarAssetKind.IMAGE_2D;
        };
    }

    private String promptKeyFor(AiAvatarCapability cap) {
        return switch (cap) {
            case FACE_CLONE -> PromptService.KEY_AIAVATAR_SAMPLING_REAL;
            case TXT2IMG -> PromptService.KEY_AIAVATAR_SAMPLING_AI;
            case IMG2IMG -> PromptService.KEY_AIAVATAR_DRAFT_ITERATE;
            default -> PromptService.KEY_AIAVATAR_REFINE_APPEARANCE;
        };
    }

    private Map<String, String> variablesFor(JsonNode input, int variants) {
        Map<String, String> vars = new LinkedHashMap<>();
        String prompt = text(input, "prompt", "");
        vars.put("input", prompt);
        vars.put("persona", prompt);
        vars.put("style", text(input, "styleCategory", "写实数字人"));
        vars.put("instruction", prompt);
        vars.put("look", firstNonBlank(text(input, "look", null), prompt));
        vars.put("variants", String.valueOf(variants));
        vars.put("negativePrompt", text(input, "negativePrompt",
                "畸形五官，面部扭曲，五官变形，多余肢体，水印，文字，logo，模糊，低画质，马赛克，画面裁切不全，透视畸变，多人入镜，杂乱背景"));
        return vars;
    }

    private Map<String, Object> imageOptions(JsonNode input) {
        Map<String, Object> options = new LinkedHashMap<>();
        if (input != null && input.has("params") && input.get("params").isObject()) {
            JsonNode params = input.get("params");
            copyText(params, options, "quality");
            copyText(params, options, "style");
            copyText(params, options, "response_format");
            copyText(params, options, "model");
        }
        return options;
    }

    private void copyText(JsonNode node, Map<String, Object> out, String key) {
        if (node.hasNonNull(key)) out.put(key, node.get(key).asText());
    }

    private String imageSize(JsonNode input, AiAvatarStandardShot shot) {
        if (input != null && input.at("/params/size").isTextual()) return input.at("/params/size").asText();
        if (shot == AiAvatarStandardShot.DETAIL_CLOSEUP || shot == AiAvatarStandardShot.EXPRESSION) {
            return "1024x1024";
        }
        return "1024x1792";
    }

    private boolean hasStandardShots(JsonNode input) {
        return input != null && input.has("standardShots") && input.get("standardShots").isArray()
                && input.get("standardShots").size() > 0;
    }

    private List<AiAvatarStandardShot> requestedShots(JsonNode input) {
        List<AiAvatarStandardShot> out = new ArrayList<>();
        if (input != null && input.has("standardShots") && input.get("standardShots").isArray()) {
            for (JsonNode n : input.get("standardShots")) out.add(AiAvatarStandardShot.fromWire(n.asText()));
        }
        return out.isEmpty() ? AiAvatarStandardShot.standardSix() : out;
    }

    private String extractPromptText(String content) {
        JsonNode node = tryReadJson(content);
        if (node != null) {
            for (String key : List.of("prompt", "imagePrompt", "positivePrompt", "content")) {
                if (node.hasNonNull(key)) return node.get(key).asText();
            }
            if (node.has("shots")) return node.toString();
        }
        return content.replaceAll("^```(?:json)?", "").replaceAll("```$", "").trim();
    }

    private Map<AiAvatarStandardShot, String> parseShotPromptJson(String content) {
        Map<AiAvatarStandardShot, String> out = new LinkedHashMap<>();
        JsonNode root = tryReadJson(content);
        if (root == null) return out;
        JsonNode shots = root.has("shots") ? root.get("shots") : root;
        if (!shots.isArray()) return out;
        for (JsonNode n : shots) {
            AiAvatarStandardShot shot = AiAvatarStandardShot.fromWire(n.path("standardShot").asText(n.path("shot").asText()));
            String prompt = n.path("prompt").asText("");
            if (!prompt.isBlank()) out.put(shot, prompt);
        }
        return out;
    }

    private JsonNode tryReadJson(String content) {
        if (content == null || content.isBlank()) return null;
        String c = content.trim();
        int obj = c.indexOf('{');
        int arr = c.indexOf('[');
        if (obj > 0 && (arr < 0 || obj < arr)) c = c.substring(obj);
        if (arr > 0 && (obj < 0 || arr < obj)) c = c.substring(arr);
        int endObj = c.lastIndexOf('}');
        int endArr = c.lastIndexOf(']');
        int end = Math.max(endObj, endArr);
        if (end >= 0 && end + 1 < c.length()) c = c.substring(0, end + 1);
        try {
            return mapper.readTree(c);
        } catch (Exception e) {
            return null;
        }
    }

    private void requireGateway() {
        if (gateway == null || promptService == null) {
            throw new IllegalStateException("AIAVATAR_BACKEND_GATEWAY_MISSING: 大模型网关或 PromptService 不可用");
        }
    }

    private void ensureBound(AiModelPurpose purpose) {
        if (!gateway.hasEndpointFor(purpose)) {
            throw new IllegalStateException("AI_NOT_CONFIGURED: 未配置可用大模型端点（用途=" + purpose.wire() + "）");
        }
    }

    private String metaJson(String prompt, String model, AiModelPurpose purpose) {
        ObjectNode meta = mapper.createObjectNode();
        meta.put("purpose", purpose.wire());
        meta.put("model", model);
        meta.put("prompt", prompt);
        return meta.toString();
    }

    private int[] dims(String size) {
        if (size == null) return new int[]{0, 0};
        String[] parts = size.toLowerCase().split("x");
        if (parts.length != 2) return new int[]{0, 0};
        try {
            return new int[]{Integer.parseInt(parts[0].trim()), Integer.parseInt(parts[1].trim())};
        } catch (Exception e) {
            return new int[]{0, 0};
        }
    }

    private DecodedImage decodeB64(String raw) {
        String mime = "image/png";
        String ext = "png";
        String b64 = raw.trim();
        if (b64.startsWith("data:")) {
            int semi = b64.indexOf(';');
            int comma = b64.indexOf(',');
            if (semi > 5) mime = b64.substring(5, semi);
            if (comma > 0) b64 = b64.substring(comma + 1);
            if (mime.contains("jpeg") || mime.contains("jpg")) ext = "jpg";
            else if (mime.contains("webp")) ext = "webp";
        }
        return new DecodedImage(Base64.getDecoder().decode(b64), ext, mime);
    }

    private String text(JsonNode input, String key, String fallback) {
        if (input != null && input.hasNonNull(key)) return input.get(key).asText();
        return fallback;
    }

    private String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : (b == null ? "" : b);
    }

    private int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }

    private record DecodedImage(byte[] bytes, String ext, String mime) {}
}
