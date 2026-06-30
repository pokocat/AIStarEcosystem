package com.aistareco.aep.controller;

import com.aistareco.aep.service.DramaAssetService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 短剧素材库（用户个人素材）：列表 / 新建记录 / 改 / 删。文件上传在 {@link DramaAssetUploadController}
 * （落 OSS 返回 cdnKey），前端拿 cdnKey 调本控制器 POST 建库记录。按 principal 严格隔离（§4.4）。
 */
@RestController
@RequestMapping("/api/me/drama/assets")
public class DramaAssetController {

    private final DramaAssetService service;

    public DramaAssetController(DramaAssetService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<JsonNode>> list(Principal principal) {
        return ApiResponse.of(service.list(uid(principal)));
    }

    @PostMapping
    public ApiResponse<JsonNode> create(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.create(body, uid(principal)));
    }

    @PutMapping("/{id}")
    public ApiResponse<JsonNode> update(Principal principal, @PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.of(service.update(id, body, uid(principal)));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(Principal principal, @PathVariable String id) {
        service.delete(id, uid(principal));
        return ApiResponse.of(null);
    }

    private static String uid(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        }
        return principal.getName();
    }
}
