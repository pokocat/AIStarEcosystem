package com.aistareco.common;

import com.aistareco.aep.service.ErrorLogService;
import org.apache.catalina.connector.ClientAbortException;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import java.io.IOException;
import java.net.SocketException;
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

    /**
     * 2026-10-20: every conversation switch closes the old SSE stream; the next write fails with a broken pipe that Spring
     * dispatches back as AsyncRequestNotUsableException. That landed in handleGeneric: an ERROR with a stack trace, an
     * ErrorLog row, and a JSON body written into an event stream. A client disconnect is no bug: no ErrorLog, no body.
     */
    @Test void aClientThatWentAwayIsNotRecordedAndGetsNoBody() {
        var logs = mock(ErrorLogService.class);
        var handler = new GlobalExceptionHandler(logs);
        var request = new MockHttpServletRequest();
        var committed = new MockHttpServletResponse();
        committed.setCommitted(true);
        var brokenPipe = new IOException("Broken pipe");
        for (Exception ex : java.util.List.<Exception>of(
                new AsyncRequestNotUsableException("ServletOutputStream failed to flush: java.io.IOException: Broken pipe", brokenPipe),
                new ClientAbortException(brokenPipe),
                new HttpMessageNotWritableException("Could not write", new AsyncRequestNotUsableException("Response not usable after response errors.")),
                new IllegalStateException("send failed", new SocketException("Connection reset by peer")),
                brokenPipe)) {
            assertNull(handler.handleGeneric(ex, request, committed), ex.toString());
        }
        handler.handleClientAbort(new AsyncRequestNotUsableException("Response not usable after response errors."));
        verifyNoInteractions(logs);
    }

    /** Anything else is still a recorded 500, including an upstream call that the vendor cut off before we wrote a byte. */
    @Test void otherFailuresAreStillRecorded() {
        var logs = mock(ErrorLogService.class);
        var handler = new GlobalExceptionHandler(logs);
        var request = new MockHttpServletRequest();
        var notCommitted = new MockHttpServletResponse();
        var committed = new MockHttpServletResponse();
        committed.setCommitted(true);
        var upstream = new IllegalStateException("I/O error on POST request", new SocketException("Connection reset by peer"));
        var bug = new IllegalStateException("boom");
        var unrelatedIo = new IOException("No space left on device");
        when(logs.record(any(), eq("INTERNAL_ERROR"), eq(500), eq(request))).thenReturn("LOG1");
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, handler.handleGeneric(upstream, request, notCommitted).getStatusCode());
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, handler.handleGeneric(bug, request, committed).getStatusCode());
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, handler.handleGeneric(unrelatedIo, request, committed).getStatusCode());
        verify(logs).record(upstream, "INTERNAL_ERROR", 500, request);
        verify(logs).record(bug, "INTERNAL_ERROR", 500, request);
        verify(logs).record(unrelatedIo, "INTERNAL_ERROR", 500, request);
    }
}
