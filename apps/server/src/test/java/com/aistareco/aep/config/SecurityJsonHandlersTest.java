package com.aistareco.aep.config;

import com.aistareco.common.TraceContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Security 链 401/403 出口的 JSON 壳契约：{error:{code,message,traceId?}}。
 * GlobalExceptionHandler 只覆盖进 controller 后的异常，这两个 handler 是 filter 链上
 * 唯一的 JSON 兜底 —— 壳变形会让前端 apiFetch 直接退化成 PARSE_ERROR。
 */
class SecurityJsonHandlersTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @AfterEach
    void clearMdc() {
        MDC.remove(TraceContext.MDC_KEY);
    }

    @Test
    void entryPointWrites401ShellWithTraceId() throws Exception {
        MDC.put(TraceContext.MDC_KEY, "trace-abc123");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new SecurityJsonEntryPoint(mapper).commence(
                new MockHttpServletRequest(), response, new BadCredentialsException("bad"));

        assertEquals(401, response.getStatus());
        assertTrue(response.getContentType().startsWith("application/json"));
        JsonNode error = mapper.readTree(response.getContentAsString()).path("error");
        assertEquals("UNAUTHORIZED", error.path("code").asText());
        assertEquals("登录状态无效或已过期", error.path("message").asText());
        assertEquals("trace-abc123", error.path("traceId").asText());
    }

    @Test
    void accessDeniedHandlerWrites403Shell() throws Exception {
        MDC.put(TraceContext.MDC_KEY, "trace-def456");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new SecurityJsonAccessDeniedHandler(mapper).handle(
                new MockHttpServletRequest(), response, new AccessDeniedException("denied"));

        assertEquals(403, response.getStatus());
        JsonNode error = mapper.readTree(response.getContentAsString()).path("error");
        assertEquals("FORBIDDEN", error.path("code").asText());
        assertEquals("trace-def456", error.path("traceId").asText());
    }

    @Test
    void omitsTraceIdWhenMdcEmpty() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        new SecurityJsonEntryPoint(mapper).commence(
                new MockHttpServletRequest(), response, new BadCredentialsException("bad"));

        JsonNode error = mapper.readTree(response.getContentAsString()).path("error");
        assertFalse(error.has("traceId"));
        assertEquals("UNAUTHORIZED", error.path("code").asText());
    }
}
