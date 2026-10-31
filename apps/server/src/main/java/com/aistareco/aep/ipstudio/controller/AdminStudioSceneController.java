package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.scene.StudioSceneAdminService;
import com.aistareco.common.ApiResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;

/**
 * 后台「Studio 场景模板」（/api/admin/studio/scenes；SUPER_ADMIN / OPERATOR）：AI 图片、AI 视频两页的场景由运营在这里配。
 * 整份目录一次保存，带上读到的版本号；封面和参考示例先传到这里拿 key 再写进目录。
 */
@RestController
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'OPERATOR')")
@RequestMapping("/api/admin/studio/scenes")
public class AdminStudioSceneController {
    private final StudioSceneAdminService service;
    public AdminStudioSceneController(StudioSceneAdminService service) { this.service = service; }

    @GetMapping
    public ApiResponse<StudioSceneAdminService.View> view() { return ApiResponse.of(service.view()); }

    @PutMapping
    public ApiResponse<StudioSceneAdminService.View> save(@RequestBody StudioSceneAdminService.SaveRequest body, Principal principal) {
        return ApiResponse.of(service.save(body, by(principal)));
    }

    /** 恢复随包的默认目录。 */
    @DeleteMapping
    public ApiResponse<StudioSceneAdminService.View> reset(@RequestParam(required = false) Integer baseVersion, Principal principal) {
        return ApiResponse.of(service.reset(baseVersion, by(principal)));
    }

    @PostMapping(value = "/media", consumes = "multipart/form-data")
    public ApiResponse<StudioSceneAdminService.Uploaded> upload(@RequestParam("file") MultipartFile file) {
        return ApiResponse.of(service.upload(file));
    }

    private static String by(Principal principal) { return principal == null ? "admin" : principal.getName(); }
}
