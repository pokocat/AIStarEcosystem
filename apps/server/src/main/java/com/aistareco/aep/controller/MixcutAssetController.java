package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MixcutAssetDto;
import com.aistareco.aep.service.mixcut.MixcutAssetService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;

/**
 * 混剪素材管理：上传 / 列表 / 删除。
 *
 *   POST   /api/mixcut/assets               multipart/form-data
 *          fields: file, kind, name?, tags?
 *   GET    /api/mixcut/assets?kind=&preset=&group=
 *   GET    /api/mixcut/assets/{id}
 *   DELETE /api/mixcut/assets/{id}
 *
 * v0.13.0+: user_id 不再走 query/body，强制取 principal；客户端字段被忽略。
 * v0.13a+:  preset=true&group=sparkle 返回平台预置贴图池（is_preset=true，全用户可见）。
 */
@RestController
@RequestMapping("/api/mixcut/assets")
public class MixcutAssetController {

    private final MixcutAssetService service;

    public MixcutAssetController(MixcutAssetService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<MixcutAssetDto>> list(
            @RequestParam(value = "kind", required = false) String kind,
            @RequestParam(value = "preset", required = false) Boolean preset,
            @RequestParam(value = "group", required = false) String presetGroup,
            @RequestParam(value = "related_product_id", required = false) String relatedProductId,
            Principal principal
    ) {
        String userId = currentUserId(principal);
        // v0.26+: 商品关联素材过滤优先（短路 listVisibleTo），避免和 preset 池混合
        if (relatedProductId != null && !relatedProductId.isBlank()) {
            var byProduct = service.listByProduct(relatedProductId, userId, kind)
                    .stream().map(MixcutAssetDto::from).toList();
            return ApiResponse.of(byProduct);
        }
        var assets = service.listVisibleTo(userId, kind, preset, presetGroup)
                .stream().map(MixcutAssetDto::from).toList();
        return ApiResponse.of(assets);
    }

    @GetMapping("/{id}")
    public ApiResponse<MixcutAssetDto> get(@PathVariable String id, Principal principal) {
        String userId = currentUserId(principal);
        return ApiResponse.of(service.getVisibleTo(id, userId).map(MixcutAssetDto::from).orElse(null));
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<ApiResponse<MixcutAssetDto>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("kind") String kind,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "tags", required = false) String tags,
            Principal principal
    ) {
        String userId = currentUserId(principal);
        try {
            var asset = service.upload(file, kind, userId, name, tags);
            return ResponseEntity.ok(ApiResponse.of(MixcutAssetDto.from(asset)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, null, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new ApiResponse<>(false, null, "上传失败：" + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@PathVariable String id, Principal principal) {
        String userId = currentUserId(principal);
        return ApiResponse.of(service.deleteOwned(id, userId));
    }

    /**
     * v0.21+: 官方明星片段公开列表（所有登录用户可见，只读）。
     * URL: GET /api/mixcut/assets/official-clips?category=&star_id=
     */
    @GetMapping("/official-clips")
    public ApiResponse<List<MixcutAssetDto>> listOfficialClips(
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "star_id", required = false) String starId
    ) {
        var list = service.listOfficial(category, starId).stream().map(MixcutAssetDto::from).toList();
        return ApiResponse.of(list);
    }

    private static String currentUserId(Principal principal) {
        return principal == null ? null : principal.getName();
    }
}
