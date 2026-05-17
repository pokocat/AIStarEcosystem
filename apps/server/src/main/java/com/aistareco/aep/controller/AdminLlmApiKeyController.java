package com.aistareco.aep.controller;

import com.aistareco.aep.dto.LlmApiKeyCreatedDto;
import com.aistareco.aep.dto.LlmApiKeyDto;
import com.aistareco.aep.dto.LlmApiKeyUpsertDto;
import com.aistareco.aep.service.LlmApiKeyService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * /api/admin/llm-keys/* —— 管理 LLM gateway 业务侧 sk-aep-* key。
 * SUPER_ADMIN / OPERATOR 可访问。
 */
@RestController
@RequestMapping("/api/admin/llm-keys")
public class AdminLlmApiKeyController {

    private final LlmApiKeyService service;

    public AdminLlmApiKeyController(LlmApiKeyService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<LlmApiKeyDto>> list() {
        return ApiResponse.of(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<LlmApiKeyDto> get(@PathVariable String id) {
        return ApiResponse.of(service.get(id));
    }

    /** 唯一返回明文的接口。运营拿到 plaintext 后必须立刻保存。 */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<LlmApiKeyCreatedDto> create(@RequestBody LlmApiKeyUpsertDto req) {
        return ApiResponse.of(service.create(req));
    }

    @PutMapping("/{id}")
    public ApiResponse<LlmApiKeyDto> update(@PathVariable String id, @RequestBody LlmApiKeyUpsertDto req) {
        return ApiResponse.of(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@PathVariable String id) {
        service.revoke(id);
    }
}
