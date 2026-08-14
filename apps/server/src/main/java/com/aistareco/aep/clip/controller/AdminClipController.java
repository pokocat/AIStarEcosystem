package com.aistareco.aep.clip.controller;

import com.aistareco.aep.clip.dto.ClipDtos.*;
import com.aistareco.aep.clip.dto.ClipRequests.UpsertTemplate;
import com.aistareco.aep.clip.dto.ClipVendorDtos.VendorOverviewDto;
import com.aistareco.aep.clip.service.*;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@RestController
@RequestMapping("/api/admin/clip")
public class AdminClipController {
    private final ClipTemplateService templates;private final ClipAssetService assets;private final ClipVendorService vendor;
    public AdminClipController(ClipTemplateService templates,ClipAssetService assets,ClipVendorService vendor){this.templates=templates;this.assets=assets;this.vendor=vendor;}
    @GetMapping("/templates") public ApiResponse<List<TemplateDto>> list(){return ApiResponse.of(templates.adminList());}
    @PostMapping("/templates") public ApiResponse<TemplateDto> create(@RequestBody UpsertTemplate r){return ApiResponse.of(templates.upsert(null,r));}
    @PutMapping("/templates/{id}") public ApiResponse<TemplateDto> update(@PathVariable String id,@RequestBody UpsertTemplate r){return ApiResponse.of(templates.upsert(id,r));}
    @DeleteMapping("/templates/{id}") public ApiResponse<Map<String,Object>> delete(@PathVariable String id){templates.delete(id);return ApiResponse.of(Map.of("ok",true));}
    /** 预置素材必须走运营上传路由；不允许靠 seed 把本机路径写进库。 */
    @PostMapping("/preset-assets") public ApiResponse<AssetDto> preset(@RequestPart("file")MultipartFile file,@RequestParam(defaultValue="video")String kind,@RequestParam(required=false)String label,@RequestParam(required=false)String group){return ApiResponse.of(assets.upload("admin",file,kind,label,true,group));}
    /** 删除预置素材（停用模板后清残留）。会连带清空引用它的模板片尾——调用前先确认没有在用的模板依赖它。 */
    @DeleteMapping("/preset-assets/{id}") public ApiResponse<Map<String,Object>> deletePreset(@PathVariable String id){assets.deletePreset(id);return ApiResponse.of(Map.of("ok",true,"id",id));}
    /**
     * 石榴 AI 供应商总览：额度快照 + 石榴侧对象清单 + 与我方 DB 的三类对账。
     * 实时打上游，不走缓存。<b>只读</b> —— 清理孤儿/悬挂要连本地记录与素材一起处理，不在这里做。
     */
    @GetMapping("/vendor/overview") public ApiResponse<VendorOverviewDto> vendorOverview(){return ApiResponse.of(vendor.overview());}
}
