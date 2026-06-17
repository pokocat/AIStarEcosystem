package com.aistareco.aep.controller;

import com.aistareco.aep.dto.PromptDryRunDto;
import com.aistareco.aep.dto.PromptTemplateDto;
import com.aistareco.aep.dto.PromptTemplateUpsertDto;
import com.aistareco.aep.dto.PromptTemplateVersionDto;
import com.aistareco.aep.dto.PromptTestRunRequestDto;
import com.aistareco.aep.dto.PromptTestRunResultDto;
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
    public ApiResponse<PromptDryRunDto> dryRun(@PathVariable String key,
                                               @RequestBody(required = false) Map<String, String> sampleVars) {
        return ApiResponse.of(promptService.dryRun(key, sampleVars));
    }

    /** 真试运行：用样例参数填充后真实调用一次模型。 */
    @PostMapping("/{key}/test-run")
    public ApiResponse<PromptTestRunResultDto> testRun(@PathVariable String key,
                                                       @RequestBody(required = false) PromptTestRunRequestDto body) {
        return ApiResponse.of(promptService.testRun(key, body));
    }

    @GetMapping("/{key}/versions")
    public ApiResponse<List<PromptTemplateVersionDto>> versions(@PathVariable String key) {
        return ApiResponse.of(promptService.versions(key));
    }

    @PostMapping("/{key}/versions/{version}/rollback")
    public ApiResponse<PromptTemplateDto> rollback(@PathVariable String key,
                                                   @PathVariable int version,
                                                   Principal principal) {
        String by = principal != null ? principal.getName() : "admin";
        return ApiResponse.of(promptService.rollback(key, version, by));
    }
}
