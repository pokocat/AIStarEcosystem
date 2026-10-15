package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.service.StudioImageReconciliationService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController
@org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('SUPER_ADMIN', 'OPERATOR')")
@RequestMapping("/api/admin/ip-studio/runs")
public class AdminStudioImageRunController {
    private final StudioImageReconciliationService service;
    public AdminStudioImageRunController(StudioImageReconciliationService service){this.service=service;}
    @GetMapping("/{id}") public ApiResponse<JsonNode> read(@PathVariable String id){return ApiResponse.of(service.read(id));}
    @PostMapping("/{id}/reconcile") public ApiResponse<JsonNode> recover(@PathVariable String id,
            @RequestBody StudioImageReconciliationService.RecoveryRequest request,Principal principal){return ApiResponse.of(service.recover(id,request,principal.getName()));}
    @PostMapping("/{id}/release-unknown") public ApiResponse<JsonNode> releaseUnknown(@PathVariable String id,
            @RequestBody StudioImageReconciliationService.UnknownReleaseRequest request,Principal principal){return ApiResponse.of(service.releaseUnknown(id,request,principal.getName()));}
}
