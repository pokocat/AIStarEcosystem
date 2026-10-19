package com.aistareco.common;

import com.aistareco.aep.service.ErrorLogService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.http.HttpStatus;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GlobalExceptionLogIdTest {
    @Test void returnsStructuredLookupIdWithoutExposingProviderDetails() {
        var logs = mock(ErrorLogService.class);
        var request = new MockHttpServletRequest();
        var exception = BusinessException.wrapped(HttpStatus.BAD_REQUEST, "PROVIDER_REJECTED", "图片接口不可用", "private provider response");
        when(logs.record(exception, "PROVIDER_REJECTED", 400, request)).thenReturn("ABCDEF234567");
        var response = new GlobalExceptionHandler(logs).handleBusiness(exception, request);
        var error = (Map<?, ?>) response.getBody().get("error");
        assertEquals("PROVIDER_REJECTED", error.get("code"));
        assertEquals("ABCDEF234567", error.get("logId"));
        assertTrue(error.get("message").toString().contains("图片接口不可用"));
        assertFalse(error.toString().contains("private provider response"));
    }
}
