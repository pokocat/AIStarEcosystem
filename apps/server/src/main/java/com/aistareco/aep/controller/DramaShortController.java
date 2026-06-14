package com.aistareco.aep.controller;

import com.aistareco.aep.service.DramaShortService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 短视频制作草稿（drama）用户侧端点：短视频工坊整页编辑态的可恢复草稿 CRUD。
 * 全部 /api/me/drama/shorts/** → AepSecurityConfig 下 authenticated，按 principal 严格隔离归属。
 */
@RestController
@RequestMapping("/api/me/drama/shorts")
public class DramaShortController {

    private final DramaShortService service;

    public DramaShortController(DramaShortService service) {
        this.service = service;
    }

    /** 列表卡片 ShortDraftSummary[]。 */
    @GetMapping
    public ApiResponse<List<JsonNode>> list(Principal principal) {
        return ApiResponse.of(service.listShorts(principal.getName()));
    }

    /** 新建短视频草稿 → { meta, data }。 */
    @PostMapping
    public ApiResponse<JsonNode> create(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.createShort(body, principal.getName()));
    }

    /** 详情 { meta: ShortDraftSummary, data: ShortDraftData }。 */
    @GetMapping("/{id}")
    public ApiResponse<JsonNode> get(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.getShort(id, principal.getName()));
    }

    /** 保存整页草稿。body: { data, status?, progress? } → { meta, data }。 */
    @PutMapping("/{id}")
    public ApiResponse<JsonNode> save(Principal principal, @PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.of(service.saveShort(id, body, principal.getName()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Principal principal, @PathVariable String id) {
        service.deleteShort(id, principal.getName());
    }
}
