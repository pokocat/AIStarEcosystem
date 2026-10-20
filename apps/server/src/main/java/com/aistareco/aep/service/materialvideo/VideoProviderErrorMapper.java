package com.aistareco.aep.service.materialvideo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/** Maps documented provider submit errors to stable platform codes and safe user messages. */
final class VideoProviderErrorMapper {
    record MappedError(String code, String message) {}

    /** Stable code for a model the provider has retired; clients must not resubmit to the same model. */
    static final String VIDEO_MODEL_RETIRED = "VIDEO_MODEL_RETIRED";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Map<String, MappedError> SUBMIT_ERRORS = Map.of(
            "503:video_queue_full", new MappedError("VIDEO_PROVIDER_QUEUE_FULL",
                    "模型提供方的视频任务队列已满，暂时无法提交，请稍后再试"),
            // The model itself is gone (2026-10-20 seedance20-onetoken: {"error":{"code":"model_delisted",…}}). Retrying the
            // same request can never succeed; the client reads this code to stop resubmitting and ask for another model.
            "400:model_delisted", new MappedError(VIDEO_MODEL_RETIRED,
                    "这个视频模型已被提供方下架，不能再用它生成，请换一个模型")
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
