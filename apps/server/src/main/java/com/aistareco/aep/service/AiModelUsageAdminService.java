package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiModelQualityUpdateDto;
import com.aistareco.aep.dto.AiModelReplayResultDto;
import com.aistareco.aep.dto.AiModelUsageRecordDto;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.AiModelUsageRecord;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.repository.AiModelUsageRecordRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Admin-only helpers for LLM request replay and quality annotation. */
@Service
public class AiModelUsageAdminService {

    private final AiModelUsageRecordRepository repo;
    private final AiModelEndpointRepository endpointRepo;
    private final AiModelUsageService usageService;
    private final AiModelInvocationService invocation;
    private final ObjectMapper om;

    public AiModelUsageAdminService(AiModelUsageRecordRepository repo,
                                    AiModelEndpointRepository endpointRepo,
                                    AiModelUsageService usageService,
                                    AiModelInvocationService invocation,
                                    ObjectMapper om) {
        this.repo = repo;
        this.endpointRepo = endpointRepo;
        this.usageService = usageService;
        this.invocation = invocation;
        this.om = om;
    }

    @Transactional
    public AiModelUsageRecordDto updateQuality(String recordId, AiModelQualityUpdateDto body) {
        AiModelUsageRecord record = load(recordId);
        if (body == null) {
            throw BusinessException.badRequest("QUALITY_BODY_REQUIRED", "缺少质量标注参数");
        }
        Integer score = body.score();
        if (score != null) score = Math.max(0, Math.min(100, score));
        record.setQualityScore(score);
        record.setQualityLabel(blankToNull(body.label()));
        record.setQualityNote(truncate(blankToNull(body.note()), 512));
        repo.save(record);
        return usageService.recordDto(record);
    }

    public AiModelReplayResultDto replay(String recordId) {
        AiModelUsageRecord record = load(recordId);
        if (record.getRequestBodyJson() == null || record.getRequestBodyJson().isBlank()) {
            throw BusinessException.badRequest("LLM_REPLAY_REQUEST_MISSING", "该记录没有保存请求体，无法重放");
        }
        AiModelEndpoint endpoint = endpointRepo.findById(record.getProviderId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ENDPOINT_NOT_FOUND", "原端点不存在"));
        ParsedRequest parsed = parseRequest(record.getRequestBodyJson());
        AiModelInvocationService.AiModelResponse response = invocation.invokeChatOnEndpoint(
                endpoint,
                AiModelPurpose.fromWire(record.getPurpose()),
                parsed.messages(),
                parsed.options(),
                record.getId());
        return new AiModelReplayResultDto(
                record.getId(),
                response.content(),
                response.finishReason(),
                response.tokensUsed(),
                response.endpointUsed(),
                response.modelUsed());
    }

    private ParsedRequest parseRequest(String requestJson) {
        try {
            Map<?, ?> root = om.readValue(requestJson, Map.class);
            Object messagesObj = root.get("messages");
            if (!(messagesObj instanceof List<?> rawMessages)) {
                throw BusinessException.badRequest("LLM_REPLAY_MESSAGES_MISSING", "原请求缺少 messages");
            }
            List<Map<String, String>> messages = rawMessages.stream()
                    .filter(Map.class::isInstance)
                    .map(Map.class::cast)
                    .map(m -> Map.of(
                            "role", String.valueOf(m.getOrDefault("role", "user")),
                            "content", String.valueOf(m.getOrDefault("content", ""))
                    ))
                    .toList();
            Map<String, Object> options = new LinkedHashMap<>();
            copyIfPresent(root, options, "model");
            copyIfPresent(root, options, "temperature");
            copyIfPresent(root, options, "max_tokens");
            copyIfPresent(root, options, "top_p");
            copyIfPresent(root, options, "response_format");
            return new ParsedRequest(messages, options);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw BusinessException.badRequest("LLM_REPLAY_BAD_REQUEST_JSON", "原请求体不是合法 JSON，无法重放");
        }
    }

    private AiModelUsageRecord load(String recordId) {
        return repo.findById(recordId)
                .orElseThrow(() -> BusinessException.notFound("LLM_USAGE_RECORD_NOT_FOUND", "调用记录不存在"));
    }

    private static void copyIfPresent(Map<?, ?> from, Map<String, Object> to, String key) {
        if (from.containsKey(key)) to.put(key, from.get(key));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) return value;
        return value.substring(0, maxLength);
    }

    private record ParsedRequest(List<Map<String, String>> messages, Map<String, Object> options) {}
}
