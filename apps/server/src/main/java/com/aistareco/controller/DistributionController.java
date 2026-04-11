package com.aistareco.controller;

import com.aistareco.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/distribution")
@RequiredArgsConstructor
public class DistributionController {

    /** POST /api/distribution/publish */
    @PostMapping("/publish")
    public ApiResponse<Map<String, Object>> publish(@RequestBody Map<String, Object> request) {
        String jobId = "publish-" + UUID.randomUUID().toString().substring(0, 8);
        return ApiResponse.of(Map.of("success", true, "publishJobId", jobId));
    }
}
