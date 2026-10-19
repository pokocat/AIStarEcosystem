package com.aistareco.aep.enterprise.controller;

import com.aistareco.aep.enterprise.dto.EnterprisePointsDtos.*;
import com.aistareco.aep.enterprise.service.EnterprisePointsService;
import com.aistareco.common.ApiResponse;
import com.aistareco.aep.dto.PageEnvelope;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController
@RequestMapping("/api/v1/ip-studio/enterprises/{id}/points")
@ConditionalOnProperty(name="aep.enterprise.enabled",havingValue="true")
public class EnterprisePointsController {
    private final EnterprisePointsService service;
    public EnterprisePointsController(EnterprisePointsService service) { this.service=service; }
    @PostMapping("/{direction:allocate|reclaim}/preview")
    public ApiResponse<Preview> preview(Principal p,@PathVariable String id,@PathVariable String direction,@RequestBody PreviewRequest r) {
        return ApiResponse.of(service.preview(p.getName(),id,direction,r));
    }
    @PostMapping("/{direction:allocate|reclaim}")
    public ApiResponse<Batch> submit(Principal p,@PathVariable String id,@PathVariable String direction,@RequestBody SubmitRequest r) {
        return ApiResponse.of(service.submit(p.getName(),id,direction,r));
    }
    @GetMapping("/batches/{batchId}")
    public ApiResponse<Batch> batch(Principal p,@PathVariable String id,@PathVariable String batchId) {
        return ApiResponse.of(service.batch(p.getName(),id,batchId));
    }
    @GetMapping("/transfers")
    public PageEnvelope<Transfer> transfers(Principal p,@PathVariable String id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int limit) {
        return PageEnvelope.from(service.transfers(p.getName(),id,page,limit));
    }
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public org.springframework.http.ResponseEntity<?> invalidBody() {
        return org.springframework.http.ResponseEntity.badRequest().body(java.util.Map.of("success",false,"error",
                java.util.Map.of("code","ENTERPRISE_POINTS_INPUT_INVALID","message","请输入整数积分和有效的请求内容")));
    }
}
