package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.director.DirectorService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * AI 导演台（docs/ai-director-plan.md v1.1）。挂在 /api/v1/ip-studio 下，沿用 aiavatar 开通与手机号写权限闸。
 */
@RestController
@RequestMapping("/api/v1/ip-studio/director")
public class DirectorController {
    private final DirectorService director;

    public DirectorController(DirectorService director) { this.director = director; }

    @GetMapping("/works")
    public ApiResponse<List<JsonNode>> list(Principal principal) {
        return ApiResponse.of(director.list(uid(principal)));
    }

    @PostMapping("/works")
    public ApiResponse<JsonNode> create(Principal principal, @RequestBody(required = false) DirectorService.CreateRequest req) {
        return ApiResponse.of(director.create(uid(principal), req));
    }

    @GetMapping("/works/{id}")
    public ApiResponse<JsonNode> get(Principal principal, @PathVariable String id) {
        return ApiResponse.of(director.get(uid(principal), id));
    }

    @PatchMapping("/works/{id}")
    public ApiResponse<JsonNode> patch(Principal principal, @PathVariable String id, @RequestBody DirectorService.PatchRequest req) {
        return ApiResponse.of(director.patch(uid(principal), id, req));
    }

    @DeleteMapping("/works/{id}")
    public ApiResponse<Map<String, Boolean>> delete(Principal principal, @PathVariable String id) {
        director.delete(uid(principal), id);
        return ApiResponse.of(Map.of("deleted", true));
    }

    /** 用户的修改：改正文、改资产、改片段、采用 / 确认某个版本。带对象修订号。 */
    @PostMapping("/works/{id}/edits")
    public ApiResponse<JsonNode> edit(Principal principal, @PathVariable String id, @RequestBody DirectorService.EditRequest req) {
        return ApiResponse.of(director.edit(uid(principal), id, req));
    }

    /** 发一个生成任务：写剧本、拆集、提取资产、规划片段、出参考图、出分镜图。 */
    @PostMapping("/works/{id}/tasks")
    public ApiResponse<JsonNode> task(Principal principal, @PathVariable String id, @RequestBody DirectorService.TaskRequest req) {
        return ApiResponse.of(director.task(uid(principal), id, req));
    }

    /** 片段视频报价：逐个片段给价格或说明还差什么，不建任务、不扣积分。 */
    @PostMapping("/works/{id}/quote")
    public ApiResponse<JsonNode> quote(Principal principal, @PathVariable String id, @RequestBody DirectorService.QuoteRequest req) {
        return ApiResponse.of(director.quote(uid(principal), id, req));
    }

    /** 角色声音样本上传（音频）。返回存储 key 与实测时长，再用 asset.setVoice 绑定到角色。 */
    @PostMapping(value = "/works/{id}/uploads", consumes = "multipart/form-data")
    public ApiResponse<com.aistareco.aep.ipstudio.service.StudioMediaImportService.MediaImportResult> upload(
            Principal principal, @PathVariable String id, @RequestPart("file") org.springframework.web.multipart.MultipartFile file) {
        return ApiResponse.of(director.uploadAudio(uid(principal), id, file));
    }

    /** 一键制作：开始 / 暂停 / 继续 / 确认参考图后继续 / 停止。 */
    @PostMapping("/works/{id}/pipeline")
    public ApiResponse<JsonNode> pipeline(Principal principal, @PathVariable String id, @RequestBody DirectorService.PipelineRequest req) {
        return ApiResponse.of(director.pipeline(uid(principal), id, req));
    }

    private static String uid(Principal p) {
        if (p == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        return p.getName();
    }
}
