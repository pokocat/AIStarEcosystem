package com.aistareco.aep.dap.controller;

import com.aistareco.aep.dap.dto.DapPublicAvatarUpsertRequest;
import com.aistareco.aep.dap.service.DapPublicAvatarService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * 数字人广场 · 运营内嵌后台（web-aiavatar）。
 * 路径 /api/v1/admin/**，由 AepSecurityConfig 门禁 hasAnyRole(SUPER_ADMIN, OPERATOR)。
 * 对应前端 apps/web-aiavatar/src/proto/api.ts 的 PlazaAdminApi。
 */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminDapPublicAvatarController {

    private final DapPublicAvatarService service;

    public AdminDapPublicAvatarController(DapPublicAvatarService service) {
        this.service = service;
    }

    private static String uid(Principal p) {
        if (p == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        return p.getName();
    }

    /** 运营公开数字人列表（仅本表，可编辑项；内置 10 个静态样板不在此列）。 */
    @GetMapping("/avatars")
    public ApiResponse<List<Map<String, Object>>> list() {
        return ApiResponse.of(service.listPublicWire());
    }

    @PostMapping("/avatars")
    public ApiResponse<Map<String, Object>> create(Principal principal,
                                                    @RequestBody DapPublicAvatarUpsertRequest req) {
        return ApiResponse.of(service.create(req, uid(principal)));
    }

    @PutMapping("/avatars/{id}")
    public ApiResponse<Map<String, Object>> update(Principal principal, @PathVariable String id,
                                                   @RequestBody DapPublicAvatarUpsertRequest req) {
        uid(principal);
        return ApiResponse.of(service.update(id, req));
    }

    @DeleteMapping("/avatars/{id}")
    public ApiResponse<Map<String, Object>> remove(Principal principal, @PathVariable String id) {
        uid(principal);
        service.delete(id);
        return ApiResponse.of(Map.of("deleted", true));
    }

    /** 上传一张形象图 → OSS，返回 { key, url }。前端把 key 放进 create/update 的 frontKey/rightKey/leftKey。 */
    @PostMapping(value = "/uploads", consumes = "multipart/form-data")
    public ApiResponse<Map<String, String>> upload(Principal principal,
                                                   @RequestParam("file") MultipartFile file,
                                                   @RequestParam(value = "kind", defaultValue = "front") String kind) {
        uid(principal);
        return ApiResponse.of(service.uploadImage(file));
    }
}
