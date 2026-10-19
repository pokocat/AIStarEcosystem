package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.service.CanvasCoverService;
import com.aistareco.aep.security.InAppOperatorGuard;
import com.aistareco.common.ApiResponse;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api/v1/ip-studio/covers/{target}/{id}")
public class CanvasCoverController {
    private final CanvasCoverService covers; private final InAppOperatorGuard guard;
    public CanvasCoverController(CanvasCoverService covers,InAppOperatorGuard guard){this.covers=covers;this.guard=guard;}
    public record Selection(String storageKey) {}
    @PostMapping(consumes="multipart/form-data")
    public ApiResponse<CanvasCoverService.Cover> upload(Authentication auth,@PathVariable String target,@PathVariable String id,@RequestParam("file") MultipartFile file){
        return ApiResponse.of(covers.upload(auth.getName(),target,id,guard.isSuperAdmin(auth),file));
    }
    @PutMapping
    public ApiResponse<CanvasCoverService.Cover> select(Authentication auth,@PathVariable String target,@PathVariable String id,@RequestBody Selection request){
        return ApiResponse.of(covers.select(auth.getName(),target,id,guard.isSuperAdmin(auth),request.storageKey()));
    }
    @DeleteMapping
    public ApiResponse<CanvasCoverService.Cover> reset(Authentication auth,@PathVariable String target,@PathVariable String id){
        return ApiResponse.of(covers.reset(auth.getName(),target,id,guard.isSuperAdmin(auth)));
    }
}
