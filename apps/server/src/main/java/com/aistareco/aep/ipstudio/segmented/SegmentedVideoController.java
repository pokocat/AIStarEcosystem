package com.aistareco.aep.ipstudio.segmented;

import com.aistareco.aep.ipstudio.dto.StudioPlanDtos.PlanExecution;
import com.aistareco.aep.ipstudio.dto.StudioSegmentedDtos.*;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

/** AI 视频页的长视频（specs/openapi.yaml；进度、暂停、继续、停止走 plan-executions）。 */
@RestController
@RequestMapping("/api/v1/ip-studio")
public class SegmentedVideoController {
    private final SegmentedVideoService service;
    public SegmentedVideoController(SegmentedVideoService service) { this.service = service; }

    /** GET：页面上的价，未绑手机号的只读账号也能看（POST 会被拦下、整页跳去绑手机）。 */
    @GetMapping("/studio/segmented-video-price")
    public ApiResponse<SegmentedVideoPrice> price(Principal principal, @RequestParam(required = false) String model, @RequestParam(required = false) String tier,
            @RequestParam int duration, @RequestParam String ratio, @RequestParam(defaultValue = "0") int images,
            @RequestParam(defaultValue = "false") boolean character, @RequestParam(defaultValue = "false") boolean voice, @RequestParam(defaultValue = "true") boolean optimize,
            @RequestParam(defaultValue = "personal") String payer, @RequestParam(required = false) String enterpriseId) {
        return ApiResponse.of(service.price(principal.getName(), model, tier, duration, ratio, images, character, voice, optimize, new com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection(payer, enterpriseId)));
    }

    @PostMapping("/projects/{id}/segmented-videos")
    public ApiResponse<PlanExecution> start(Principal principal, @PathVariable String id, @RequestBody SegmentedVideoRequest request) {
        return ApiResponse.of(service.start(principal.getName(), id, request));
    }
}
