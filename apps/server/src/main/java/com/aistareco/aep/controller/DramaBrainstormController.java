package com.aistareco.aep.controller;

import com.aistareco.aep.service.DramaBrainstormService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 首页脑暴（跟 AI 聊出故事）用户侧端点：立项之前的可恢复草稿 + AI 对话 / 生成故事大纲 / 去制作。
 * 全部 /api/me/drama/brainstorms/** → AepSecurityConfig 下 authenticated，按 principal 严格隔离归属。
 */
@RestController
@RequestMapping("/api/me/drama/brainstorms")
public class DramaBrainstormController {

    private final DramaBrainstormService service;

    public DramaBrainstormController(DramaBrainstormService service) {
        this.service = service;
    }

    /** 「继续上次脑暴」列表卡片 BrainstormSummary[]。 */
    @GetMapping
    public ApiResponse<List<JsonNode>> list(Principal principal) {
        return ApiResponse.of(service.listBrainstorms(principal.getName()));
    }

    /** 新建脑暴会话（body{seed?}）→ { meta, data }。 */
    @PostMapping
    public ApiResponse<JsonNode> create(Principal principal, @RequestBody(required = false) JsonNode body) {
        return ApiResponse.of(service.createBrainstorm(body, principal.getName()));
    }

    /** 详情 { meta: BrainstormSummary, data: BrainstormData }（恢复）。 */
    @GetMapping("/{id}")
    public ApiResponse<JsonNode> get(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.getBrainstorm(id, principal.getName()));
    }

    /** 自动保存整页脑暴 body{ data } → { meta, data }。 */
    @PutMapping("/{id}")
    public ApiResponse<JsonNode> save(Principal principal, @PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.of(service.saveBrainstorm(id, body, principal.getName()));
    }

    /** AI 脑暴回复 body{ text, messages? } → { message }（免费 · §8.0 · 不落库，前端合并后 PUT 保存）。 */
    @PostMapping("/{id}/chat")
    public ApiResponse<JsonNode> chat(Principal principal, @PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.of(service.chat(id, body, principal.getName()));
    }

    /** 由对话生成故事大纲 body{ messages? } → { outline }（免费 · §8.0 · 不落库）。 */
    @PostMapping("/{id}/outline")
    public ApiResponse<JsonNode> outline(Principal principal, @PathVariable String id,
                                         @RequestBody(required = false) JsonNode body) {
        return ApiResponse.of(service.generateOutline(id, body, principal.getName()));
    }

    /** 去制作 body{ form?, data? } → { kind:"project"|"short", projectId|shortId }。 */
    @PostMapping("/{id}/promote")
    public ApiResponse<JsonNode> promote(Principal principal, @PathVariable String id,
                                         @RequestBody(required = false) JsonNode body) {
        return ApiResponse.of(service.promote(id, body, principal.getName()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Principal principal, @PathVariable String id) {
        service.deleteBrainstorm(id, principal.getName());
    }
}
