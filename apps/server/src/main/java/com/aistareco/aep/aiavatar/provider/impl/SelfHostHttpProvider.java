package com.aistareco.aep.aiavatar.provider.impl;

import com.aistareco.aep.aiavatar.model.AiAvatarAssetKind;
import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.aistareco.aep.aiavatar.model.AiAvatarStandardShot;
import com.aistareco.aep.aiavatar.provider.*;
import com.aistareco.aep.aiavatar.service.AiAvatarStorage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * 自部署模型微服务 Provider（任务书 §2/§5 SELFHOST）—— 真实集成的统一 HTTP 编排入口。
 *
 * 任意能力（InstantID / SDXL / SAM / TripoSR / SVD …）只要包成
 * {@code POST {baseUrl}/run} 接口（请求 {capability, jobId, input}，返回
 * {assets:[{url,kind,width,height,mime,format3d,durationSec,thumbnailUrl}], meta}）即可热插拔。
 *
 * baseUrl 来自 {@code aep.aiavatar.selfhost-base-urls.<capability>}。未配置 → healthcheck=false，run 抛错。
 */
public class SelfHostHttpProvider extends AbstractCapabilityProvider {

    private final String baseUrl;
    private final HttpClient http;

    public SelfHostHttpProvider(AiAvatarCapability capability, String baseUrl, AiAvatarStorage storage, ObjectMapper mapper) {
        super(capability, AiAvatarProviderMode.SELFHOST, "selfhost:" + capability.wire(), storage, mapper);
        this.baseUrl = baseUrl == null ? "" : baseUrl.replaceAll("/+$", "");
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    @Override
    public ProviderResult run(JsonNode input, AiAvatarJobContext ctx) throws Exception {
        if (baseUrl.isBlank()) {
            throw new IllegalStateException("SELFHOST_NOT_CONFIGURED: 未配置 aep.aiavatar.selfhost-base-urls." + capability.wire());
        }
        ctx.onProgress(10, "提交自部署模型服务");
        ObjectNode body = mapper.createObjectNode();
        body.put("capability", capability.wire());
        body.put("jobId", ctx.jobId());
        body.put("ownerUserId", ctx.ownerUserId());
        body.set("input", input == null ? mapper.createObjectNode() : input);

        HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + "/run"))
                .timeout(Duration.ofMinutes(5))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        ctx.onProgress(80, "解析模型产出");
        if (resp.statusCode() / 100 != 2) {
            throw new IllegalStateException("SELFHOST_HTTP_" + resp.statusCode() + ": " + clip(resp.body()));
        }
        JsonNode root = mapper.readTree(resp.body());
        List<AssetSpec> specs = new ArrayList<>();
        JsonNode assets = root.get("assets");
        if (assets != null && assets.isArray()) {
            for (JsonNode a : assets) {
                specs.add(AssetSpec.builder()
                        .kind(AiAvatarAssetKind.fromWire(a.path("kind").asText("image_2d")))
                        .standardShot(a.hasNonNull("standardShot") ? AiAvatarStandardShot.fromWire(a.get("standardShot").asText()) : null)
                        .fileUrl(a.path("url").asText())
                        .thumbnailUrl(a.hasNonNull("thumbnailUrl") ? a.get("thumbnailUrl").asText() : a.path("url").asText())
                        .mimeType(a.path("mime").asText("image/png"))
                        .width(a.path("width").asInt(0))
                        .height(a.path("height").asInt(0))
                        .durationSec(a.path("durationSec").asDouble(0))
                        .format3d(a.hasNonNull("format3d") ? a.get("format3d").asText() : null)
                        .engine(engine)
                        .build());
            }
        }
        String meta = root.has("meta") ? root.get("meta").toString() : null;
        return ProviderResult.of(specs, meta);
    }

    @Override
    public ProviderHealth healthcheck() {
        if (baseUrl.isBlank()) return ProviderHealth.down("未配置 selfhost base url");
        return ProviderHealth.ok("selfhost configured: " + baseUrl);
    }

    private static String clip(String s) {
        if (s == null) return "";
        return s.length() <= 200 ? s : s.substring(0, 200);
    }
}
