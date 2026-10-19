package com.aistareco.aep.ipstudio.controller;
import com.aistareco.aep.ipstudio.service.StudioConversationShareService;
import com.aistareco.common.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.Map;
@RestController @RequestMapping("/api/v1/ip-studio")
public class StudioConversationShareController {
    private final StudioConversationShareService shares;
    public StudioConversationShareController(StudioConversationShareService shares){this.shares=shares;}
    private static String owner(Principal p){if(p==null)throw new BusinessException(HttpStatus.UNAUTHORIZED,"UNAUTHORIZED","请先登录");return p.getName();}
    @GetMapping("/projects/{id}/conversations/{nodeId}/share")
    public ApiResponse<StudioConversationShareService.Preview> preview(Principal p,@PathVariable String id,@PathVariable String nodeId){return ApiResponse.of(shares.preview(owner(p),id,nodeId));}
    @PostMapping("/projects/{id}/conversations/{nodeId}/share")
    public ApiResponse<StudioConversationShareService.Share> create(Principal p,@PathVariable String id,@PathVariable String nodeId,@RequestBody StudioConversationShareService.CreateRequest request){return ApiResponse.of(shares.create(owner(p),id,nodeId,request));}
    @DeleteMapping("/projects/{id}/conversations/{nodeId}/share/{token}")
    public ApiResponse<Map<String,Boolean>> revoke(Principal p,@PathVariable String id,@PathVariable String nodeId,@PathVariable String token){shares.revoke(owner(p),id,nodeId,token);return ApiResponse.of(Map.of("revoked",true));}
    @GetMapping("/shared/conversations/{token}")
    public ResponseEntity<ApiResponse<StudioConversationShareService.PublicView>> read(@PathVariable String token){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Robots-Tag","noindex, nofollow").body(ApiResponse.of(shares.read(token)));}
    @PostMapping("/shared/conversations/{token}/copy")
    public ApiResponse<Map<String,String>> copy(Principal p,@PathVariable String token,@RequestBody StudioConversationShareService.CopyRequest request){return ApiResponse.of(Map.of("projectId",shares.copy(owner(p),token,request)));}
}
