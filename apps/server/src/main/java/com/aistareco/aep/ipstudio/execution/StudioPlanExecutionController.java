package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dto.StudioPlanDtos.*;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

/** Plan execution commands (specs/openapi.yaml /v1/ip-studio/projects/{id}/plan-executions…). */
@RestController
@RequestMapping("/api/v1/ip-studio/projects/{id}/plan-executions")
public class StudioPlanExecutionController {
    private final StudioPlanExecutionService executions;
    public StudioPlanExecutionController(StudioPlanExecutionService executions) {this.executions=executions;}

    @PostMapping
    public ApiResponse<PlanExecution> create(Principal principal,@PathVariable String id,@RequestBody PlanExecutionCreateRequest request) {
        return ApiResponse.of(executions.create(principal.getName(),id,request));
    }
    @GetMapping("/{eid}")
    public ApiResponse<PlanExecution> read(Principal principal,@PathVariable String id,@PathVariable String eid) {
        return ApiResponse.of(executions.read(principal.getName(),id,eid));
    }
    @PostMapping("/{eid}/pause")
    public ApiResponse<PlanExecution> pause(Principal principal,@PathVariable String id,@PathVariable String eid,@RequestBody PlanExecutionControlRequest request) {
        return ApiResponse.of(executions.pause(principal.getName(),id,eid,request));
    }
    @PostMapping("/{eid}/resume")
    public ApiResponse<PlanExecution> resume(Principal principal,@PathVariable String id,@PathVariable String eid,@RequestBody PlanExecutionControlRequest request) {
        return ApiResponse.of(executions.resume(principal.getName(),id,eid,request));
    }
    @PostMapping("/{eid}/cancel")
    public ApiResponse<PlanExecution> cancel(Principal principal,@PathVariable String id,@PathVariable String eid,@RequestBody PlanExecutionControlRequest request) {
        return ApiResponse.of(executions.cancel(principal.getName(),id,eid,request));
    }
    @PostMapping("/{eid}/steps/{sid}/accept")
    public ApiResponse<PlanExecution> accept(Principal principal,@PathVariable String id,@PathVariable String eid,@PathVariable String sid,@RequestBody PlanExecutionAcceptRequest request) {
        return ApiResponse.of(executions.accept(principal.getName(),id,eid,sid,request));
    }
}
