package com.aistareco.aep.enterprise.controller;
import com.aistareco.aep.enterprise.dto.EnterpriseLifecycleDtos.*;
import com.aistareco.aep.enterprise.service.EnterpriseLifecycleService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import java.security.Principal;
@RestController @RequestMapping("/api/v1/ip-studio/enterprises/{id}/lifecycle")
@ConditionalOnProperty(name="aep.enterprise.enabled",havingValue="true")
public class EnterpriseLifecycleController {
    private final EnterpriseLifecycleService service;
    public EnterpriseLifecycleController(EnterpriseLifecycleService service){this.service=service;}
    @PostMapping("/preview") public ApiResponse<Preview> preview(Principal p,@PathVariable String id,@RequestBody PreviewRequest request){return ApiResponse.of(service.preview(p.getName(),id,request));}
    @PostMapping public ApiResponse<Result> apply(Principal p,@PathVariable String id,@RequestBody Request request){return ApiResponse.of(service.apply(p.getName(),id,request));}
}
