package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AiAppBindingDto;
import com.aistareco.aep.dto.AiAppEndpointCandidateDto;
import com.aistareco.aep.dto.AiAppEndpointCandidateUpsert;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiAppBindingService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin AI 应用绑定：/api/admin/ai-app-bindings/*（v0.41）。
 * 每个 AI 应用（用途）固定绑一个模型接入端点。SUPER_ADMIN / OPERATOR 可访问。
 */
@RestController
@RequestMapping("/api/admin/ai-app-bindings")
public class AdminAiAppBindingController {

    private final AiAppBindingService service;

    public AdminAiAppBindingController(AiAppBindingService service) {
        this.service = service;
    }

    /** 列出全部用途（含未绑定项）及其绑定端点。 */
    @GetMapping
    public ApiResponse<List<AiAppBindingDto>> list() {
        return ApiResponse.of(service.list());
    }

    /** 把某用途绑定到一个启用端点。 */
    @PutMapping("/{purpose}")
    public ApiResponse<AiAppBindingDto> bind(@PathVariable String purpose,
                                             @RequestBody Map<String, String> body) {
        return ApiResponse.of(service.bind(parsePurpose(purpose), body != null ? body.get("endpointId") : null));
    }

    /** 解绑某用途。 */
    @DeleteMapping("/{purpose}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unbind(@PathVariable String purpose) {
        service.unbind(parsePurpose(purpose));
    }

    // ── D-11 候选端点（一用途多候选 + capability） ────────────────────────────

    /** 列出某用途的全部候选端点（含 capability + 默认标记）。 */
    @GetMapping("/{purpose}/candidates")
    public ApiResponse<List<AiAppEndpointCandidateDto>> listCandidates(@PathVariable String purpose) {
        return ApiResponse.of(service.listCandidates(parsePurpose(purpose)));
    }

    /** 新增一个候选端点（body.endpointId 必填，可带 capability）。 */
    @PostMapping("/{purpose}/candidates")
    public ApiResponse<AiAppEndpointCandidateDto> addCandidate(@PathVariable String purpose,
                                                               @RequestBody AiAppEndpointCandidateUpsert body) {
        return ApiResponse.of(service.addCandidate(parsePurpose(purpose), body));
    }

    /** 更新候选端点的 capability / 单价 override / 启用 / 排序。 */
    @PutMapping("/{purpose}/candidates/{endpointId}")
    public ApiResponse<AiAppEndpointCandidateDto> updateCandidate(@PathVariable String purpose,
                                                                  @PathVariable String endpointId,
                                                                  @RequestBody AiAppEndpointCandidateUpsert body) {
        return ApiResponse.of(service.updateCandidate(parsePurpose(purpose), endpointId, body));
    }

    /** 删除一个候选端点（默认端点不允许删）。 */
    @DeleteMapping("/{purpose}/candidates/{endpointId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeCandidate(@PathVariable String purpose, @PathVariable String endpointId) {
        service.removeCandidate(parsePurpose(purpose), endpointId);
    }

    private static AiModelPurpose parsePurpose(String wire) {
        if (wire == null || wire.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PURPOSE_REQUIRED", "purpose 必填");
        }
        try {
            return AiModelPurpose.valueOf(wire.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PURPOSE_INVALID", "未知用途: " + wire);
        }
    }
}
