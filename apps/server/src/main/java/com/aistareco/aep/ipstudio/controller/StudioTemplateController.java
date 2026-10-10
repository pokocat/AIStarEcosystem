package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.*;
import com.aistareco.aep.ipstudio.service.StudioTemplateService;
import com.aistareco.aep.ipstudio.service.StudioTemplateExecutionService;
import com.aistareco.aep.ipstudio.service.StudioTemplatePackageService;
import com.aistareco.aep.ipstudio.service.StudioTemplateMetricsService;
import java.util.List;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.AdoptRequest;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.security.InAppOperatorGuard;
import com.aistareco.common.ApiResponse;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController @RequestMapping("/api/v1/ip-studio")
public class StudioTemplateController {
    private final StudioTemplateService service;private final InAppOperatorGuard guard;private final StudioTemplateExecutionService execution;private final StudioTemplatePackageService packages;private final StudioTemplateMetricsService metrics;
    public StudioTemplateController(StudioTemplateService service,InAppOperatorGuard guard,StudioTemplateExecutionService execution,StudioTemplatePackageService packages,StudioTemplateMetricsService metrics){this.service=service;this.guard=guard;this.execution=execution;this.packages=packages;this.metrics=metrics;}
    @PostMapping("/projects/{id}/template-versions")
    public ApiResponse<Version> publish(Principal principal,Authentication auth,@PathVariable String id,@RequestBody PublishRequest request) {
        if("official".equals(request.visibility()))guard.requireSuperAdmin(auth,"只有超级管理员能发布官方模板");
        return ApiResponse.of(service.publish(principal.getName(),id,request));
    }
    @GetMapping("/template-versions/{versionId}")
    public ApiResponse<Version> read(Principal principal,@PathVariable String versionId){return ApiResponse.of(service.read(principal.getName(),versionId));}
    public record Availability(boolean enabled) {}
    @PutMapping("/templates/{templateId}/availability")
    public ApiResponse<Void> availability(Principal principal,Authentication auth,@PathVariable String templateId,@RequestBody Availability request) {
        service.availability(principal.getName(),templateId,request.enabled(),guard.isSuperAdmin(auth));return ApiResponse.of(null);
    }
    @PostMapping("/template-plan")
    public ApiResponse<Plan> preview(Principal principal,@RequestBody UseRequest request){return ApiResponse.of(service.preview(principal.getName(),request));}
    @PostMapping("/template-instances")
    public ApiResponse<Instance> instantiate(Principal principal,@RequestBody UseRequest request){return ApiResponse.of(service.instantiate(principal.getName(),request));}
    @GetMapping("/projects/{id}/template-instance")
    public ApiResponse<Instance> instance(Principal principal,@PathVariable String id){return ApiResponse.of(service.instance(principal.getName(),id));}
    @GetMapping("/projects/{id}/template-execution")
    public ApiResponse<Execution> execution(Principal principal,@PathVariable String id){return ApiResponse.of(execution.read(principal.getName(),id));}
    @PostMapping("/projects/{id}/template-steps/{stepId}/runs")
    public ApiResponse<IpRunDto> execute(Principal principal,@PathVariable String id,@PathVariable String stepId,@RequestBody ExecuteRequest request){return ApiResponse.of(execution.execute(principal.getName(),id,stepId,request));}
    @PostMapping("/projects/{id}/template-steps/{stepId}/accept")
    public ApiResponse<Execution> accept(Principal principal,@PathVariable String id,@PathVariable String stepId,@RequestBody AcceptRequest request){return ApiResponse.of(execution.accept(principal.getName(),id,stepId,request));}
    @PostMapping("/projects/{id}/template-steps/{stepId}/archive")
    public ApiResponse<Execution> archive(Principal principal,@PathVariable String id,@PathVariable String stepId,@RequestBody AdoptRequest request){return ApiResponse.of(execution.archive(principal.getName(),id,stepId,request));}
    @GetMapping("/projects/{id}/template-packages")
    public ApiResponse<List<AssetPackage>> packages(Principal principal,@PathVariable String id){return ApiResponse.of(packages.list(principal.getName(),id));}
    @PostMapping("/projects/{id}/template-packages")
    public ApiResponse<AssetPackage> createPackage(Principal principal,@PathVariable String id,@RequestBody PackageRequest request){return ApiResponse.of(packages.create(principal.getName(),id,request));}
    @GetMapping("/template-versions/{versionId}/metrics")
    public ApiResponse<Metrics> metrics(Principal principal,@PathVariable String versionId){return ApiResponse.of(metrics.read(principal.getName(),versionId));}
}
