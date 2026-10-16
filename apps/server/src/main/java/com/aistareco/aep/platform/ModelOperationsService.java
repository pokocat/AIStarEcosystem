package com.aistareco.aep.platform;

import com.aistareco.aep.service.AiModelEndpointAdminService;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiVideoRequestSpec;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import java.util.Set;
import java.util.Arrays;

/** Reuses original provider checks, model discovery and usage queries; no generation or retry. */
@Service
public class ModelOperationsService {
    private final AiModelEndpointAdminService endpoints;
    private final AiModelUsageService usage;
    private final ObjectMapper mapper;
    public ModelOperationsService(AiModelEndpointAdminService endpoints, AiModelUsageService usage, ObjectMapper mapper) {
        this.endpoints = endpoints; this.usage = usage; this.mapper = mapper;
    }
    public static boolean handles(String action) {
        return Set.of("endpointTest", "endpointFetchModels", "endpointProbe", "usageRecords", "usageRecordsPage").contains(action);
    }
    public Object execute(JsonNode command) {
        String action = command.path("action").asText();
        if ("endpointTest".equals(action) || "endpointFetchModels".equals(action)) {
            fields(command, Set.of("action", "id"));
            String id = text(command, "id", 160);
            if (id == null || id.isBlank()) throw invalid();
            var result = mapper.<ObjectNode>valueToTree("endpointFetchModels".equals(action)
                    ? endpoints.fetchModels(id) : endpoints.testConnection(id));
            result.remove("error");
            if (!result.path("ok").asBoolean()) result.put("error", safeProbeReason(result));
            result.remove("snippet"); // Raw vendor content is not a connection result for operators.
            return result;
        }
        if ("endpointProbe".equals(action)) {
            fields(command, Set.of("action", "id", "providerType", "baseUrl", "apiKey", "modelsPath", "authHeader", "catalogSpec"));
            String provider = text(command, "providerType", 40);
            String baseUrl = text(command, "baseUrl", 2000);
            if (provider == null || baseUrl == null || baseUrl.isBlank()
                    || Arrays.stream(AiModelProviderType.values()).noneMatch(t -> t.wire().equals(provider)))
                throw invalid();
            if (command.hasNonNull("authHeader")) fields(command.get("authHeader"), Set.of("name", "prefix"));
            AiVideoRequestSpec.AuthHeader authHeader = command.hasNonNull("authHeader")
                    ? mapper.convertValue(command.get("authHeader"), AiVideoRequestSpec.AuthHeader.class) : null;
            if (authHeader != null) authHeader.validate();
            if (command.hasNonNull("catalogSpec") && !command.get("catalogSpec").isObject()) throw invalid();
            if (command.hasNonNull("catalogSpec")) fields(command.get("catalogSpec"), Set.of("items", "id", "label", "status"));
            AiVideoRequestSpec.CatalogSpec catalogSpec = command.hasNonNull("catalogSpec")
                    ? mapper.convertValue(command.get("catalogSpec"), AiVideoRequestSpec.CatalogSpec.class) : null;
            if (catalogSpec != null) catalogSpec.validate();
            var result = mapper.<ObjectNode>valueToTree(authHeader == null && catalogSpec == null
                    ? endpoints.probe(text(command, "id", 160), AiModelProviderType.fromWire(provider), baseUrl,
                            text(command, "apiKey", 8192), text(command, "modelsPath", 1024))
                    : catalogSpec == null
                        ? endpoints.probe(text(command, "id", 160), AiModelProviderType.fromWire(provider), baseUrl,
                                text(command, "apiKey", 8192), text(command, "modelsPath", 1024), authHeader)
                        : endpoints.probe(text(command, "id", 160), AiModelProviderType.fromWire(provider), baseUrl,
                                text(command, "apiKey", 8192), text(command, "modelsPath", 1024), authHeader, catalogSpec));
            result.remove("snippet");
            result.remove("error");
            if (!result.path("ok").asBoolean()) result.put("error", safeProbeReason(result));
            return result;
        }
        if ("usageRecordsPage".equals(action)) {
            fields(command, Set.of("action", "days", "page", "size", "asOf", "appCode", "userId", "tenantId", "purpose", "providerId", "model", "success", "q"));
            if (command.has("success") && !command.get("success").isBoolean()) throw invalid();
            int page = 0;
            if (command.has("page")) {
                if (!command.get("page").isIntegralNumber() || !command.get("page").canConvertToInt() || command.get("page").intValue() < 0) throw invalid();
                page = command.get("page").intValue();
            }
            java.time.Instant asOf = null;
            if (command.has("asOf")) {
                try { asOf = java.time.Instant.parse(text(command, "asOf", 64)); }
                catch (Exception badDate) { throw invalid(); }
            }
            var result = usage.recordsPage(integer(command,"days",30,365), page, integer(command,"size",20,200), asOf,
                    text(command,"appCode",100), text(command,"userId",160), text(command,"tenantId",160),
                    text(command,"purpose",100), text(command,"providerId",160), text(command,"model",200),
                    command.has("success") ? command.get("success").booleanValue() : null, text(command,"q",200));
            ObjectNode safe = mapper.valueToTree(result);
            safe.path("items").forEach(row -> ((ObjectNode) row).remove(Set.of("requestBodyJson", "responseBodyJson")));
            return safe;
        }
        if ("usageRecords".equals(action)) {
            fields(command, Set.of("action", "days", "size", "appCode", "userId", "tenantId", "purpose", "providerId", "success", "q"));
            if (command.has("success") && !command.get("success").isBoolean()) throw invalid();
            var records = usage.records(integer(command,"days",30,365), text(command,"appCode",100),
                    text(command,"userId",160), text(command,"tenantId",160), text(command,"purpose",100),
                    text(command,"providerId",160), command.has("success") ? command.get("success").booleanValue() : null,
                    text(command,"q",200), integer(command,"size",500,500));
            return records.stream().map(record -> {
                ObjectNode safe = mapper.valueToTree(record);
                safe.remove(Set.of("requestBodyJson", "responseBodyJson"));
                return safe;
            }).toList();
        }
        throw invalid();
    }
    private static void fields(JsonNode node, Set<String> allowed) {
        node.fieldNames().forEachRemaining(key -> { if (!allowed.contains(key)) throw invalid(); });
    }
    private static String text(JsonNode node, String key, int max) {
        if (!node.has(key)) return null;
        if (!node.get(key).isTextual() || node.get(key).asText().length() > max) throw invalid();
        return node.get(key).asText().trim();
    }
    private static int integer(JsonNode node, String key, int fallback, int max) {
        if (!node.has(key)) return fallback;
        if (!node.get(key).isIntegralNumber() || !node.get(key).canConvertToInt() || node.get(key).intValue() < 1 || node.get(key).intValue() > max) throw invalid();
        return node.get(key).intValue();
    }
    private static String safeProbeReason(JsonNode result) {
        int status = result.path("statusCode").asInt(0);
        return switch (status) {
            case 401 -> "上游密钥未通过验证，请核对密钥";
            case 403 -> "当前上游密钥无权读取模型目录";
            case 404 -> "模型目录路径不存在，请核对调用地址和目录路径";
            case 429 -> "供应商暂时限流，请稍后再检测";
            default -> status >= 500 ? "供应商服务异常（HTTP " + status + "）"
                    : "供应商检查未通过，请核对地址、目录路径和密钥权限";
        };
    }
    private static BusinessException invalid() { return BusinessException.badRequest("MODEL_MANAGEMENT_COMMAND_INVALID", "模型管理参数无效"); }
}
