package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.service.StudioMediaJobs;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/v1/ip-studio/media")
public class StudioMediaJobController {
    private final StudioMediaJobs jobs;

    public StudioMediaJobController(StudioMediaJobs jobs) {
        this.jobs = jobs;
    }

    @GetMapping("/video-info")
    public ApiResponse<StudioMediaJobs.VideoInfo> info(Principal principal, @RequestParam String key) {
        return ApiResponse.of(jobs.info(principal.getName(), key));
    }

    @PostMapping("/clips")
    public ApiResponse<StudioMediaJobs.Status> clip(Principal principal, @RequestBody StudioMediaJobs.ClipRequest request) {
        return ApiResponse.of(jobs.clip(principal.getName(), request));
    }

    @GetMapping("/jobs/{id}")
    public ApiResponse<StudioMediaJobs.Status> status(Principal principal, @PathVariable String id) {
        return ApiResponse.of(jobs.status(principal.getName(), id));
    }

    @PostMapping("/jobs/{id}/retry")
    public ApiResponse<StudioMediaJobs.Status> retry(Principal principal, @PathVariable String id) {
        return ApiResponse.of(jobs.retry(principal.getName(), id));
    }
}
