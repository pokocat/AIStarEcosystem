package com.aistareco.aep.service.ai;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;

/** Structured upstream evidence for recovery decisions; public error code/message stay unchanged. */
public final class AiChatHttpException extends BusinessException {
    private final int upstreamStatus;
    private final String upstreamCode;
    private final String upstreamMessage;

    public AiChatHttpException(int status, String body, String friendly, String detail) {
        super(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", friendly, null, detail);
        upstreamStatus = status;
        String code = null, message = null;
        try {
            var root = new ObjectMapper().readTree(body);
            var error = root.path("error");
            var c = error.hasNonNull("code") ? error.path("code") : root.path("code");
            var m = error.hasNonNull("message") ? error.path("message") : root.path("message");
            if (c.isTextual()) code = c.asText();
            if (m.isTextual()) message = m.asText();
        } catch (Exception ignored) { /* Non-JSON errors never authorize a recovery call. */ }
        upstreamCode = code;
        upstreamMessage = message;
    }

    public boolean isVisualMemoryRejection() {
        return upstreamStatus == 400 && "unsupported_geometry".equals(upstreamCode)
                && upstreamMessage != null
                && "visual activation/HBM headroom budget".equals(upstreamMessage.strip());
    }
}
