package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.service.music.VolcOpenApiSigner;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;

/** Official Ark control plane. No bearer tokens, signed URLs or H5 credentials in logs. */
@Component
public class ArkAssetClient {
    private static final Logger log = LoggerFactory.getLogger(ArkAssetClient.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private final HttpClient http;
    public ArkAssetClient() { this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build()); }
    ArkAssetClient(HttpClient http) { this.http = http; }

    public JsonNode call(VideoAssetLibraryRecord library, String action, Map<String, Object> values) {
        try {
            JsonNode config = JSON.readTree(library.getConfigJson());
            String project = config.path("projectName").asText();
            String credential = AepCryptoUtil.decrypt(library.getCredentialEncrypted());
            if (project.isBlank() || credential == null || !credential.contains(":")) throw new IllegalArgumentException();
            String[] keys = credential.split(":", 2);
            Map<String,Object> body = new LinkedHashMap<>(values); body.put("ProjectName", project);
            String raw = JSON.writeValueAsString(body);
            URI uri = URI.create("https://ark.cn-beijing.volcengineapi.com/?Action=" + action + "&Version=2024-01-01");
            var signed = VolcOpenApiSigner.signPostJson(uri, raw, keys[0], keys[1], "cn-beijing", "ark", Instant.now());
            var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(30));
            signed.headers().forEach((k,v) -> { if (!k.equalsIgnoreCase("host")) request.header(k,v); });
            var response = http.send(request.POST(HttpRequest.BodyPublishers.ofString(raw)).build(), HttpResponse.BodyHandlers.ofString());
            JsonNode root;
            try { root = JSON.readTree(response.body()); } catch (Exception invalid) { root = JSON.createObjectNode(); }
            JsonNode error = root.path("ResponseMetadata").path("Error");
            if (response.statusCode() / 100 != 2 || !error.isMissingNode() && !error.isNull() || root.path("Result").hasNonNull("Error") && !root.path("Result").has("Status")) {
                // Retain provider diagnostics, recursively removing credentials and URLs before writing them.
                log.warn("[ark-assets] action={} library={} status={} body={}", action, library.getId(), response.statusCode(), safe(root));
                String code = error.path("Code").asText(root.path("Result").path("Error").path("Code").asText());
                boolean missing = code.toLowerCase(Locale.ROOT).contains("notfound");
                throw new BusinessException(missing ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY,
                        missing ? "VIDEO_ASSET_REMOTE_NOT_FOUND" : "VIDEO_ASSET_PROVIDER_FAILED",
                        "素材服务暂时无法完成处理，请稍后重试。", null, "action="+action+" status="+response.statusCode()+" body="+safe(root));
            }
            return root.path("Result");
        } catch (BusinessException ex) { throw ex; }
        catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw unavailable(action, ex); }
        catch (Exception ex) { throw unavailable(action, ex); }
    }
    private BusinessException unavailable(String action, Exception error) {
        log.warn("[ark-assets] action={} transport/config failure={}", action, error.getClass().getSimpleName());
        return BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_ASSET_PROVIDER_FAILED",
                "素材服务暂时无法完成处理，请稍后重试。", "action="+action+" cause="+error.getClass().getSimpleName());
    }
    static String safe(JsonNode node) {
        JsonNode copy = node.deepCopy(); redact(copy); return copy.toString().substring(0, Math.min(3000,copy.toString().length()));
    }
    private static void redact(JsonNode node) {
        if(node.isObject()) {
            var names=new ArrayList<String>();node.fieldNames().forEachRemaining(names::add);
            for(String name:names) {
                if(name.matches("(?i).*(token|key|authorization|url|link|secret).*") || node.path(name).isTextual() && node.path(name).asText().contains("https://"))
                    ((com.fasterxml.jackson.databind.node.ObjectNode)node).put(name,"[redacted]");
                else redact(node.path(name));
            }
        } else if(node.isArray())node.forEach(ArkAssetClient::redact);
    }
}
