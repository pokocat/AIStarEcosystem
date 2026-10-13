package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.service.ErrorLogService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioRunErrorLogTest {
    private final ObjectMapper mapper = new ObjectMapper();
    @Test void preservesPartialOutputAndLinksTheOriginalExceptionToItsOwner() throws Exception {
        var logs = mock(ErrorLogService.class);
        var reporter = new StudioRunErrorLog(logs, mapper);
        var run = IpRun.builder().id("r").ownerUserId("u").errorCode("PROVIDER_REJECTED").errorMessage("图片接口不可用")
                .outputJson("{\"candidates\":[{\"key\":\"partial.png\"}]}").build();
        var error = BusinessException.wrapped(HttpStatus.BAD_REQUEST, "PROVIDER_REJECTED", "图片接口不可用", "provider HTTP 400");
        when(logs.recordTask(error, "PROVIDER_REJECTED", "u", "r")).thenReturn("ABCDEF234567");
        reporter.attach(run, error);
        assertEquals("ABCDEF234567", mapper.readTree(run.getOutputJson()).path("logId").asText());
        assertEquals("partial.png", mapper.readTree(run.getOutputJson()).path("candidates").get(0).path("key").asText());
        reporter.attach(run, error);
        verify(logs, times(1)).recordTask(error, "PROVIDER_REJECTED", "u", "r");
    }
    @Test void cancellationsAndLoggingFailuresDoNotChangeTaskOutcome() {
        var logs = mock(ErrorLogService.class);
        var reporter = new StudioRunErrorLog(logs, mapper);
        var cancelled = IpRun.builder().id("r").errorCode("IP_RUN_CANCELLED").outputJson("{}").build();
        reporter.attach(cancelled, null);
        verifyNoInteractions(logs);
        var failed = IpRun.builder().id("r").ownerUserId("u").errorCode("TIMEOUT").errorMessage("超时").status("failed").outputJson("{}").build();
        when(logs.recordTask(any(), eq("TIMEOUT"), eq("u"), eq("r"))).thenReturn(null);
        assertDoesNotThrow(() -> reporter.attach(failed, null));
        assertEquals("{}", failed.getOutputJson());
        assertEquals("failed", failed.getStatus());
    }
}
