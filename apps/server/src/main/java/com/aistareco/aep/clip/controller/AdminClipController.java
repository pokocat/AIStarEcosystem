package com.aistareco.aep.clip.controller;

import com.aistareco.aep.clip.dto.ClipDtos.*;
import com.aistareco.aep.clip.dto.ClipRequests.UpsertTemplate;
import com.aistareco.aep.clip.service.*;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@RestController
@RequestMapping("/api/admin/clip")
public class AdminClipController {
    private final ClipTemplateService templates;private final ClipAssetService assets;
    public AdminClipController(ClipTemplateService templates,ClipAssetService assets){this.templates=templates;this.assets=assets;}
    @GetMapping("/templates") public ApiResponse<List<TemplateDto>> list(){return ApiResponse.of(templates.adminList());}
    @PostMapping("/templates") public ApiResponse<TemplateDto> create(@RequestBody UpsertTemplate r){return ApiResponse.of(templates.upsert(null,r));}
    @PutMapping("/templates/{id}") public ApiResponse<TemplateDto> update(@PathVariable String id,@RequestBody UpsertTemplate r){return ApiResponse.of(templates.upsert(id,r));}
    @DeleteMapping("/templates/{id}") public ApiResponse<Map<String,Object>> delete(@PathVariable String id){templates.delete(id);return ApiResponse.of(Map.of("ok",true));}
    /** 预置素材必须走运营上传路由；不允许靠 seed 把本机路径写进库。 */
    @PostMapping("/preset-assets") public ApiResponse<AssetDto> preset(@RequestPart("file")MultipartFile file,@RequestParam(defaultValue="video")String kind,@RequestParam(required=false)String label,@RequestParam(required=false)String group){return ApiResponse.of(assets.upload("admin",file,kind,label,true,group));}
}
