package com.aistareco.aep.service.materialvideo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/** Maps documented provider submit errors to stable platform codes and safe user messages. */
final class VideoProviderErrorMapper {
    record MappedError(String code, String message) {}

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Map<String, MappedError> SUBMIT_ERRORS = Map.of(
            "503:video_queue_full", new MappedError("VIDEO_PROVIDER_QUEUE_FULL",
                    "模型提供方的视频任务队列已满，暂时无法提交，请稍后再试")
    );

    private VideoProviderErrorMapper() {}

    static Optional<MappedError> submit(int httpStatus, String responseBody) {
        if (responseBody == null || responseBody.isBlank()) return Optional.empty();
        try {
            JsonNode body = JSON.readTree(responseBody);
            if (body == null || !body.isObject()) return Optional.empty();
            String providerCode = body.path("code").asText("");
            if (providerCode.isBlank()) providerCode = body.path("error").path("code").asText("");
            return Optional.ofNullable(SUBMIT_ERRORS.get(httpStatus + ":" + providerCode.trim().toLowerCase(Locale.ROOT)));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }
}
