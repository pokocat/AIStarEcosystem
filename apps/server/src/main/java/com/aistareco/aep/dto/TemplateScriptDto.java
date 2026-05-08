package com.aistareco.aep.dto;

import com.aistareco.aep.model.TemplateScript;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 用户端 / admin 共用的 TemplateScript DTO。
 * 字段对齐 apps/web/src/types/celebrity-zone.ts {@code TemplateScript}。
 *
 * 大对象（persona / scenes / variables / engineAdapters / durationVariants
 *   / postProcess / safety / referenceClip / experiment / metrics / visualStyle）
 *   从 entity 的 JSON 列反序列化为 Map / List。
 *
 * 用户端 GET /template-scripts/by-template/{id} 仅返回 status=PUBLISHED；admin 端读全字段。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TemplateScriptDto(
        String id,
        String templateId,
        Integer version,
        String status,
        String language,
        String kind,
        Map<String, Object> referenceClip,
        Map<String, Object> persona,
        String systemPrompt,
        List<Map<String, Object>> scenes,
        Map<String, Object> visualStyle,
        String negativePrompt,
        List<Map<String, Object>> variables,
        Map<String, Object> engineAdapters,
        Map<String, Object> durationVariants,
        Map<String, Object> postProcess,
        Map<String, Object> safety,
        Map<String, Object> experiment,
        Map<String, Object> metrics,
        Instant createdAt,
        Instant publishedAt,
        String publishedBy
) {
    private static final ObjectMapper OM = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> OBJ_T = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> ARR_T = new TypeReference<>() {};

    public static TemplateScriptDto from(TemplateScript s) {
        return new TemplateScriptDto(
                s.getId(),
                s.getTemplateId(),
                s.getVersion(),
                s.getStatus() != null ? s.getStatus().wire() : null,
                s.getLanguage(),
                s.getKind() != null ? s.getKind().wire() : null,
                readObj(s.getReferenceClipJson()),
                readObj(s.getPersonaJson()),
                s.getSystemPrompt(),
                readArr(s.getScenesJson()),
                readObj(s.getVisualStyleJson()),
                s.getNegativePrompt(),
                readArr(s.getVariablesJson()),
                readObj(s.getEngineAdaptersJson()),
                readObj(s.getDurationVariantsJson()),
                readObj(s.getPostProcessJson()),
                readObj(s.getSafetyJson()),
                readObj(s.getExperimentJson()),
                readObj(s.getMetricsJson()),
                s.getCreatedAt(),
                s.getPublishedAt(),
                s.getPublishedBy()
        );
    }

    private static Map<String, Object> readObj(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return OM.readValue(json, OBJ_T);
        } catch (Exception e) {
            return null;
        }
    }

    private static List<Map<String, Object>> readArr(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return OM.readValue(json, ARR_T);
        } catch (Exception e) {
            return null;
        }
    }
}
