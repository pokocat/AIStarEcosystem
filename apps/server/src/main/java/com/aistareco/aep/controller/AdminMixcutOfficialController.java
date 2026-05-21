package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MixcutAssetDto;
import com.aistareco.aep.service.mixcut.MixcutAssetService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * v0.21+ admin：官方明星片段 CRUD。
 *
 *  POST   /api/admin/mixcut/official-clips                multipart/form-data
 *         fields: file, kind?, category, related_star_id?, name?, tags?
 *  GET    /api/admin/mixcut/official-clips?category=&star_id=
 *  PUT    /api/admin/mixcut/official-clips/{id}           JSON body
 *  DELETE /api/admin/mixcut/official-clips/{id}
 *
 * 鉴权：/api/admin/** 由 AepSecurityConfig 统一限制为 SUPER_ADMIN / OPERATOR。
 */
@RestController
@RequestMapping("/api/admin/mixcut/official-clips")
public class AdminMixcutOfficialController {

    private final MixcutAssetService service;

    public AdminMixcutOfficialController(MixcutAssetService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<MixcutAssetDto>> list(
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "star_id", required = false) String starId
    ) {
        var list = service.listOfficial(category, starId).stream().map(MixcutAssetDto::from).toList();
        return ApiResponse.of(list);
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<ApiResponse<MixcutAssetDto>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "kind", required = false, defaultValue = "video") String kind,
            @RequestParam("category") String category,
            @RequestParam(value = "related_star_id", required = false) String starId,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "tags", required = false) String tags
    ) {
        try {
            var asset = service.uploadOfficial(file, kind, category, starId, name, tags);
            return ResponseEntity.ok(ApiResponse.of(MixcutAssetDto.from(asset)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, null, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new ApiResponse<>(false, null, "上传失败：" + e.getMessage()));
        }
    }

    public record UpdateMetaRequest(
            String name,
            String category,
            String related_star_id,
            String tags
    ) {}

    @PutMapping("/{id}")
    public ApiResponse<MixcutAssetDto> update(
            @PathVariable String id,
            @RequestBody UpdateMetaRequest req
    ) {
        return ApiResponse.of(service
                .updateOfficialMeta(id, req.name(), req.category(), req.related_star_id(), req.tags())
                .map(MixcutAssetDto::from)
                .orElse(null));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Boolean> delete(@PathVariable String id) {
        return ApiResponse.of(service.deleteOfficial(id));
    }
}
