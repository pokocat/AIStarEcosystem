package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.dialogue.StudioDialogueService;
import com.aistareco.aep.ipstudio.dialogue.StudioDialogueStream;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.security.Principal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * The event stream must reach the browser event by event through every proxy in front of it. Next's rewrite proxy gzips
 * text/event-stream unless the response says no-transform, and gzip held a finished turn's events until the stream closed:
 * the reply had settled and been charged while the page still showed 「停止」 (local e2e 2026-10-19).
 */
class StudioDialogueControllerTest {
    @Test void theEventStreamTellsProxiesNotToCompressOrBufferIt() {
        var stream = mock(StudioDialogueStream.class);
        var emitter = new SseEmitter();
        when(stream.open("u1", "P1", "T1", 3L, null)).thenReturn(emitter);
        var controller = new StudioDialogueController(mock(StudioDialogueService.class), stream);
        var response = new MockHttpServletResponse();
        Principal principal = () -> "u1";

        assertSame(emitter, controller.events(principal, "P1", "T1", 3L, null, response));
        assertTrue(response.getHeader("Cache-Control").contains("no-transform"), response.getHeader("Cache-Control"));
        assertEquals("no", response.getHeader("X-Accel-Buffering"));
    }
}
