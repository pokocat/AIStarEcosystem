package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.service.ai.ProviderErrorMessage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/** Maps documented provider submit errors to stable platform codes and safe user messages. */
final class VideoProviderErrorMapper {
    record MappedError(String code, String message) {
        String publicMessage(String responseBody) {
            // This known restriction is fully explained in Chinese; keep content[] paths and request IDs in diagnostics.
            return VIDEO_REFERENCE_PERSON_RESTRICTED.equals(code) ? message : ProviderErrorMessage.append(responseBody, message);
        }
    }

    /** Stable code for a model the provider has retired; clients must not resubmit to the same model. */
    static final String VIDEO_MODEL_RETIRED = "VIDEO_MODEL_RETIRED";
    static final String VIDEO_REFERENCE_PERSON_RESTRICTED = "VIDEO_REFERENCE_PERSON_RESTRICTED";
    /** The supplier failed an accepted task on its own side (2026-11-07 OneToken Seedance 2.0). A new attempt can work. */
    static final String VIDEO_PROVIDER_INTERNAL = "VIDEO_PROVIDER_INTERNAL";
    private static final MappedError PROVIDER_INTERNAL = new MappedError(VIDEO_PROVIDER_INTERNAL,
            "模型服务临时出错，未生成的视频不扣积分。请重新生成。");
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Map<String, MappedError> SUBMIT_ERRORS = Map.of(
            "503:video_queue_full", new MappedError("VIDEO_PROVIDER_QUEUE_FULL",
                    "模型提供方的视频任务队列已满，暂时无法提交，请稍后再试"),
            // The model itself is gone (2026-10-20 seedance20-onetoken: {"error":{"code":"model_delisted",…}}). Retrying the
            // same request can never succeed; the client reads this code to stop resubmitting and ask for another model.
            "400:model_delisted", new MappedError(VIDEO_MODEL_RETIRED,
                    "这个视频模型已被提供方下架，不能再用它生成，请换一个模型"),
            "400:inputimagesensitivecontentdetected.privacyinformation", new MappedError(VIDEO_REFERENCE_PERSON_RESTRICTED,
                    com.aistareco.aep.service.ai.PublicModelErrorPolicy.PERSON_RESTRICTED)
    );

    private VideoProviderErrorMapper() {}

    /** A task the supplier reports as failed while polling. Anything not listed here gets the worker's generic retry sentence. */
    static Optional<MappedError> poll(String responseBody) {
        return poll(responseBody, null);
    }

    static Optional<MappedError> poll(String responseBody, String configuredReason) {
        var sizeError = referenceSize(configuredReason).or(() -> referenceSize(ProviderErrorMessage.diagnosticReason(responseBody)));
        if (sizeError.isPresent()) return sizeError;
        if (responseBody == null || responseBody.isBlank()) return Optional.empty();
        try {
            JsonNode body = JSON.readTree(responseBody);
            if (body == null || !body.isObject()) return Optional.empty();
            String code = body.path("error").path("code").asText(body.path("code").asText(""));
            String category = body.path("error").path("category").asText("");
            return "internalserviceerror".equals(code.trim().toLowerCase(Locale.ROOT)) || "internal".equals(category.trim().toLowerCase(Locale.ROOT))
                    ? Optional.of(PROVIDER_INTERNAL) : Optional.empty();
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    static Optional<MappedError> submit(int httpStatus, String responseBody) {
        if (responseBody == null || responseBody.isBlank()) return Optional.empty();
        if (httpStatus >= 400 && httpStatus < 500) {
            var sizeError = referenceSize(ProviderErrorMessage.diagnosticReason(responseBody));
            if (sizeError.isPresent()) return sizeError;
        }
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

    static Optional<MappedError> referenceSize(String reason) {
        if (reason == null || !reason.toLowerCase(Locale.ROOT)
                .contains("input image long side exceeds " + H3ReferenceImage.MAX_EDGE)) return Optional.empty();
        return Optional.of(new MappedError(H3ReferenceImage.INVALID_SIZE,
                "参考图长边超过 " + H3ReferenceImage.MAX_EDGE + " 像素，请缩小图片后再试"));
    }
}
