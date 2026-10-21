package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.dialogue.StudioDialogueService;
import com.aistareco.aep.ipstudio.dialogue.StudioDialogueStream;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.*;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import jakarta.servlet.http.HttpServletResponse;
import java.security.Principal;
import java.util.List;

/**
 * Studio conversation endpoints (specs/openapi.yaml /v1/ip-studio/projects/{id}/conversation*; thread list / new / read / open:
 * docs/ip-studio-new-canvas-and-threads.md §3). Owner / project / thread
 * are checked on every call. The SSE stream uses the same authentication as every other request (Authorization header);
 * no token is ever accepted in the URL, and subscribing never authorizes a write.
 */
@RestController
@RequestMapping("/api/v1/ip-studio/projects/{id}")
public class StudioDialogueController {
    private final StudioDialogueService dialogue;
    private final StudioDialogueStream stream;

    public StudioDialogueController(StudioDialogueService dialogue, StudioDialogueStream stream) { this.dialogue = dialogue; this.stream = stream; }

    @GetMapping("/conversation")
    public ApiResponse<State> conversation(Principal principal, @PathVariable String id) {
        return ApiResponse.of(dialogue.conversation(principal.getName(), id));
    }

    /** 「历史对话」: the user's threads on this canvas with messages, plus the current one; latest activity first, at most 50. */
    @GetMapping("/conversations")
    public ApiResponse<List<ThreadSummary>> threads(Principal principal, @PathVariable String id) {
        return ApiResponse.of(dialogue.threads(principal.getName(), id));
    }

    /** 「新对话」: an empty thread becomes current (an idle empty one is reused). Idempotent on clientRequestId; never charges. */
    @PostMapping("/conversations")
    public ApiResponse<State> createThread(Principal principal, @PathVariable String id, @RequestBody(required = false) CreateThreadRequest request) {
        return ApiResponse.of(dialogue.createThread(principal.getName(), id, request));
    }

    /** One thread's snapshot, read only: the current thread stays what it was (reconnects, polls, catch-up reads). */
    @GetMapping("/conversations/{threadId}")
    public ApiResponse<State> thread(Principal principal, @PathVariable String id, @PathVariable String threadId) {
        return ApiResponse.of(dialogue.readThread(principal.getName(), id, threadId));
    }

    /** 「历史对话」 → a row: open that thread and make it current. No body; never charges. */
    @PostMapping("/conversations/{threadId}/open")
    public ApiResponse<State> openThread(Principal principal, @PathVariable String id, @PathVariable String threadId) {
        return ApiResponse.of(dialogue.openThread(principal.getName(), id, threadId));
    }

    @GetMapping("/conversations/{threadId}/messages")
    public ApiResponse<List<Message>> messages(Principal principal, @PathVariable String id, @PathVariable String threadId,
                                               @RequestParam(required = false) Long beforeSeq, @RequestParam(required = false) Integer limit) {
        return ApiResponse.of(dialogue.messages(principal.getName(), id, threadId, beforeSeq, limit));
    }

    @PostMapping("/conversations/{threadId}/messages")
    public ApiResponse<PostMessageResult> post(Principal principal, @PathVariable String id, @PathVariable String threadId,
                                               @RequestBody PostMessageRequest request) {
        return ApiResponse.of(dialogue.post(principal.getName(), id, threadId, request));
    }

    @GetMapping("/conversations/{threadId}/events")
    public SseEmitter events(Principal principal, @PathVariable String id, @PathVariable String threadId,
                             @RequestParam(required = false) Long afterSeq,
                             @RequestHeader(value = "Last-Event-ID", required = false) String lastEventId,
                             HttpServletResponse response) {
        // Proxies must pass each event through as it is written. Next's rewrite proxy gzips text/event-stream unless the
        // response says no-transform, and gzip holds small events until the stream closes (30 minutes), so a finished turn
        // stayed on 「停止」 until the page was refreshed (local e2e 2026-10-19). nginx buffers proxied responses the same way.
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.setHeader("X-Accel-Buffering", "no");
        return stream.open(principal.getName(), id, threadId, afterSeq, lastEventId);
    }

    @PostMapping("/conversations/{threadId}/control")
    public ApiResponse<State> control(Principal principal, @PathVariable String id, @PathVariable String threadId,
                                      @RequestBody ControlRequest request) {
        return ApiResponse.of(dialogue.control(principal.getName(), id, threadId, request));
    }

    @PostMapping("/conversations/{threadId}/branches")
    public ApiResponse<State> branch(Principal principal, @PathVariable String id, @PathVariable String threadId,
                                     @RequestBody BranchRequest request) {
        return ApiResponse.of(dialogue.branch(principal.getName(), id, threadId, request));
    }
}
