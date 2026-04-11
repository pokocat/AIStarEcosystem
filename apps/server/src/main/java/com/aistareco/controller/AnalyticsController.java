package com.aistareco.controller;

import com.aistareco.common.ApiResponse;
import com.aistareco.dto.AnalyticsDashboardPayload;
import com.aistareco.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    /** GET /api/analytics/dashboard */
    @GetMapping("/dashboard")
    public ApiResponse<AnalyticsDashboardPayload> dashboard() {
        return ApiResponse.of(analyticsService.getDashboard());
    }
}
