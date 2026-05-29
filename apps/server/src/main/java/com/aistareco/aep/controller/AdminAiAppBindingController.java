package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AiAppBindingDto;
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
