package com.aistareco.aep.controller;

import com.aistareco.aep.dto.TemplateScriptDto;
import com.aistareco.aep.model.TemplateScript;
import com.aistareco.aep.model.TemplateScriptStatus;
import com.aistareco.aep.repository.TemplateScriptRepository;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * 用户端模板脚本只读：/api/template-scripts/*。v0.5 新增。
 *
 * 仅暴露 PUBLISHED 脚本（小程序 / web 用户端消费）。
 */
@RestController
@RequestMapping("/api/template-scripts")
public class TemplateScriptController {

    private final TemplateScriptRepository repo;

    public TemplateScriptController(TemplateScriptRepository repo) {
        this.repo = repo;
    }

    @GetMapping("/by-template/{templateId}")
    public ApiResponse<TemplateScriptDto> getPublishedByTemplate(@PathVariable String templateId) {
        TemplateScript s = repo.findTopByTemplateIdAndStatusOrderByVersionDesc(
                        templateId, TemplateScriptStatus.PUBLISHED)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SCRIPT_NOT_FOUND",
                        "模板 " + templateId + " 没有 published 脚本"));
        return ApiResponse.of(TemplateScriptDto.from(s));
    }

    @GetMapping("/{id}")
    public ApiResponse<TemplateScriptDto> get(@PathVariable String id) {
        TemplateScript s = repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SCRIPT_NOT_FOUND",
                        "脚本不存在：" + id));
        if (s.getStatus() != TemplateScriptStatus.PUBLISHED) {
            // 用户端不允许读非 published
            throw new BusinessException(HttpStatus.NOT_FOUND, "SCRIPT_NOT_PUBLISHED",
                    "脚本未发布");
        }
        return ApiResponse.of(TemplateScriptDto.from(s));
    }
}
