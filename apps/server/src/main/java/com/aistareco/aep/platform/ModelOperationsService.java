package com.aistareco.aep.platform;

import com.aistareco.aep.service.AiModelEndpointAdminService;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import java.util.Set;

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
        if ("endpointProbe".equals(action)) {
            fields(command, Set.of("action", "id", "providerType", "baseUrl", "apiKey"));
            String type = text(command, "providerType", 100), url = text(command, "baseUrl", 2000);
            if (type == null || url == null) throw invalid();
            com.aistareco.aep.model.AiModelProviderType.fromWire(type);
            long start = System.nanoTime();
            var result = mapper.<ObjectNode>valueToTree(endpoints.probeDraft(text(command, "id", 160),
                    new com.aistareco.aep.dto.AiModelDiscoveryRequestDto(type, url, text(command, "apiKey", 8192))));
            if (result.hasNonNull("error")) {
                int status = result.path("statusCode").asInt();
                String message = switch (status) {
                    case 401, 403 -> "鉴权未通过，请核对密钥与供应商授权";
                    case 404 -> "模型目录未找到，请检查地址是否包含 API 版本路径";
                    case 429 -> "供应商请求过于频繁，请稍后重试";
                    default -> "供应商连接或模型目录检查未通过，请核对地址、协议和密钥";
                };
                result.put("error", message);
            } else result.remove("error");
            if (result.path("statusCode").isNull()) result.remove("statusCode");
            result.put("latencyMs", (System.nanoTime() - start) / 1_000_000L);
            return result;
        }
        if ("endpointTest".equals(action) || "endpointFetchModels".equals(action)) {
            fields(command, Set.of("action", "id"));
            String id = text(command, "id", 160);
            if (id == null || id.isBlank()) throw invalid();
            var result = mapper.<ObjectNode>valueToTree("endpointFetchModels".equals(action)
                    ? endpoints.fetchModels(id) : endpoints.testConnection(id));
            result.remove("error");
            if (!result.path("ok").asBoolean()) result.put("error", "供应商检查未通过，请核对已保存配置");
            result.remove("snippet"); // Raw vendor content is not a connection result for operators.
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
    private static BusinessException invalid() { return BusinessException.badRequest("MODEL_MANAGEMENT_COMMAND_INVALID", "模型管理参数无效"); }
}
