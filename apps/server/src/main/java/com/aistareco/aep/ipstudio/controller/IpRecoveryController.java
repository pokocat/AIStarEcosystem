package com.aistareco.aep.ipstudio.controller;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.*;
import com.aistareco.common.*;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.*;
@RestController @RequestMapping("/api/v1/ip-studio")
public class IpRecoveryController {
    private final IpProjectService projects;
    private final IpSavedAssetService assets;
    public IpRecoveryController(IpProjectService projects,IpSavedAssetService assets) {this.projects=projects;this.assets=assets;}
    private String uid(Principal p) {
        if(p==null) throw new BusinessException(org.springframework.http.HttpStatus.UNAUTHORIZED,"AUTH_REQUIRED","请先登录");
        return p.getName();
    }
    @GetMapping("/projects/{id}/history") public ApiResponse<List<IpRevisionDto>> history(Principal p,@PathVariable String id) {return ApiResponse.of(projects.history(uid(p),id));}
    @GetMapping("/projects/{id}/history/{revisionId}") public ApiResponse<IpRevisionDetailDto> revision(Principal p,@PathVariable String id,@PathVariable String revisionId) {return ApiResponse.of(projects.revision(uid(p),id,revisionId));}
    @GetMapping("/projects/{id}/runs") public com.aistareco.aep.dto.PageEnvelope<IpRunDto> runs(Principal p,@PathVariable String id,@RequestParam(defaultValue="0") int page) {return com.aistareco.aep.dto.PageEnvelope.from(projects.runHistory(uid(p),id,page));}
    @GetMapping("/saved-assets") public ApiResponse<List<JsonNode>> assets(Principal p) {return ApiResponse.of(assets.list(uid(p)));}
    @PostMapping("/saved-assets") public ApiResponse<JsonNode> save(Principal p,@RequestBody JsonNode body) {return ApiResponse.of(assets.save(uid(p),body));}
    @DeleteMapping("/saved-assets/{id}") public ApiResponse<Void> remove(Principal p,@PathVariable String id) {assets.remove(uid(p),id);return ApiResponse.of(null);}
}
