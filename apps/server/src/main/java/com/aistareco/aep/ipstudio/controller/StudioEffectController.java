package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.dto.StudioEffectDtos.*;
import com.aistareco.aep.ipstudio.service.StudioEffectService;
import com.aistareco.aep.security.InAppOperatorGuard;
import com.aistareco.common.ApiResponse;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.List;

@RestController @RequestMapping("/api/v1/ip-studio/video-effects")
public class StudioEffectController {
    private final StudioEffectService service;private final InAppOperatorGuard guard;
    public StudioEffectController(StudioEffectService service,InAppOperatorGuard guard){this.service=service;this.guard=guard;}
    @GetMapping public ApiResponse<List<Effect>> list(Principal principal){return ApiResponse.of(service.list(principal.getName()));}
    @PostMapping public ApiResponse<Effect> publish(Principal principal,Authentication auth,@RequestBody Publish request){
        if(request!=null && "official".equals(request.visibility()))guard.requireSuperAdmin(auth,"只有超级管理员能发布官方特效");
        return ApiResponse.of(service.publish(principal.getName(),request));
    }
    @PutMapping("/{id}/favorite") public ApiResponse<Effect> favorite(Principal principal,@PathVariable String id,@RequestBody Favorite request){return ApiResponse.of(service.favorite(principal.getName(),id,request.favorite()));}
    @PostMapping("/{id}/apply") public ApiResponse<Effect> apply(Principal principal,@PathVariable String id,@RequestBody Apply request){return ApiResponse.of(service.apply(principal.getName(),id,request.model()));}
}
