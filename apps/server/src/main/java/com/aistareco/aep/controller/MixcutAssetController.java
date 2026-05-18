package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MixcutAssetDto;
import com.aistareco.aep.service.mixcut.MixcutAssetService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 混剪素材管理：上传 / 列表 / 删除。
 *
 *   POST   /api/mixcut/assets               multipart/form-data
 *          fields: file, kind, user_id?, name?, tags?
 *   GET    /api/mixcut/assets?kind=&user_id=
 *   GET    /api/mixcut/assets/{id}
 *   DELETE /api/mixcut/assets/{id}
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
            @RequestParam(value = "user_id", required = false) String userId
    ) {
        var assets = service.listAll(kind, userId)
                .stream().map(MixcutAssetDto::from).toList();
        return ApiResponse.of(assets);
    }

    @GetMapping("/{id}")
    public ApiResponse<MixcutAssetDto> get(@PathVariable String id) {
        return ApiResponse.of(service.get(id).map(MixcutAssetDto::from).orElse(null));
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<ApiResponse<MixcutAssetDto>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("kind") String kind,
            @RequestParam(value = "user_id", required = false) String userId,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "tags", required = false) String tags
    ) {
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
    public ApiResponse<Boolean> delete(@PathVariable String id) {
        return ApiResponse.of(service.delete(id));
    }
}
