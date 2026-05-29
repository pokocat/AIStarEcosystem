package com.aistareco.aep.controller;

import com.aistareco.aep.dto.PromptTemplateDto;
import com.aistareco.aep.dto.PromptTemplateUpsertDto;
import com.aistareco.aep.service.PromptService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * Prompt 模板管理（admin /api/admin/prompts/*；hasAnyRole SUPER_ADMIN / OPERATOR）。
 * 运营在此改 system + user 模板 / 灰度 / 回滚，无需改代码或重启（PromptService 1min 缓存，PUT 立即失效）。
 */
@RestController
@RequestMapping("/api/admin/prompts")
public class AdminPromptController {

    private final PromptService promptService;

    public AdminPromptController(PromptService promptService) {
        this.promptService = promptService;
    }

    @GetMapping
    public ApiResponse<List<PromptTemplateDto>> list() {
        return ApiResponse.of(promptService.listForAdmin());
    }

    @GetMapping("/{key}")
    public ApiResponse<PromptTemplateDto> get(@PathVariable String key) {
        return ApiResponse.of(promptService.getForAdmin(key));
    }

    @PutMapping("/{key}")
    public ApiResponse<PromptTemplateDto> upsert(@PathVariable String key,
                                                 @RequestBody PromptTemplateUpsertDto body,
                                                 Principal principal) {
        String by = principal != null ? principal.getName() : "admin";
        return ApiResponse.of(promptService.upsert(key, body, by));
    }

    /** 试运行：用样例参数 fill 出最终 messages（不真调模型）。 */
    @PostMapping("/{key}/dry-run")
    public ApiResponse<Map<String, Object>> dryRun(@PathVariable String key,
                                                   @RequestBody(required = false) Map<String, String> sampleVars) {
        return ApiResponse.of(promptService.dryRun(key, sampleVars));
    }
}
