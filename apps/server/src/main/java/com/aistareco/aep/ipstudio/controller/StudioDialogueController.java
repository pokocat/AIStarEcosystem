package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.dialogue.StudioDialogueService;
import com.aistareco.aep.ipstudio.dialogue.StudioDialogueStream;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.*;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.security.Principal;
import java.util.List;

/**
 * Studio conversation endpoints (specs/openapi.yaml /v1/ip-studio/projects/{id}/conversation*). Owner / project / thread
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
                             @RequestHeader(value = "Last-Event-ID", required = false) String lastEventId) {
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
