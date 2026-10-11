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
        return Set.of("endpointTest", "endpointFetchModels", "usageRecords").contains(action);
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
            if (!result.path("ok").asBoolean()) result.put("error", "供应商检查未通过，请核对已保存配置");
            result.remove("snippet"); // Raw vendor content is not a connection result for operators.
            return result;
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
