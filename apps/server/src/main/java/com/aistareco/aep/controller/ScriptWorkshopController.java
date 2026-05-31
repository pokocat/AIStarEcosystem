package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ScriptDto;
import com.aistareco.aep.dto.ScriptVersionDto;
import com.aistareco.aep.service.ScriptWorkshopService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * 脚本工坊用户侧端点（v0.45）：/api/me/scripts/** + /api/me/script-versions/{id}。
 * AepSecurityConfig 下 /api/me/** authenticated；service 按 principal 严格隔离。
 * 字段镜像 packages/types/src/script.ts（Script / ScriptVersion）。
 */
@RestController
@RequestMapping("/api/me")
public class ScriptWorkshopController {

    private final ScriptWorkshopService service;

    public ScriptWorkshopController(ScriptWorkshopService service) {
        this.service = service;
    }

    @GetMapping("/scripts")
    public ApiResponse<List<ScriptDto>> listScripts(Principal principal) {
        return ApiResponse.of(service.listScripts(principal.getName()));
    }

    @GetMapping("/scripts/{id}")
    public ApiResponse<ScriptDto> getScript(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.getScript(id, principal.getName()));
    }

    @GetMapping("/scripts/{id}/versions")
    public ApiResponse<List<ScriptVersionDto>> listVersions(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.listVersions(id, principal.getName()));
    }

    @GetMapping("/script-versions/{versionId}")
    public ApiResponse<ScriptVersionDto> getVersion(Principal principal, @PathVariable String versionId) {
        return ApiResponse.of(service.getVersion(versionId, principal.getName()));
    }

    @PostMapping("/scripts")
    public ApiResponse<ScriptDto> createScript(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.createScript(body, principal.getName()));
    }

    @PostMapping("/scripts/{id}/versions")
    public ApiResponse<ScriptVersionDto> commitVersion(Principal principal, @PathVariable String id,
                                                       @RequestBody JsonNode body) {
        return ApiResponse.of(service.commitVersion(id, body, principal.getName()));
    }

    @PatchMapping("/scripts/{id}/status")
    public ApiResponse<ScriptDto> setStatus(Principal principal, @PathVariable String id,
                                            @RequestBody JsonNode body) {
        String status = body == null ? null : (body.hasNonNull("status") ? body.get("status").asText() : null);
        return ApiResponse.of(service.setStatus(id, status, principal.getName()));
    }

    @DeleteMapping("/scripts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteScript(Principal principal, @PathVariable String id) {
        service.deleteScript(id, principal.getName());
    }

    @PostMapping("/scripts/{id}/clone")
    public ApiResponse<ScriptDto> cloneScript(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.cloneScript(id, principal.getName()));
    }

    @PostMapping("/scripts/{id}/generate")
    public ApiResponse<Map<String, String>> generate(Principal principal, @PathVariable String id,
                                                     @RequestBody JsonNode body) {
        String prompt = body == null ? null : (body.hasNonNull("prompt") ? body.get("prompt").asText() : null);
        String content = service.generate(id, prompt, principal.getName());
        return ApiResponse.of(Map.of("content", content));
    }
}
