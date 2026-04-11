package com.aistareco.controller;

import com.aistareco.common.ApiResponse;
import com.aistareco.dto.TrackSummaryDto;
import com.aistareco.dto.TrackWorkspacePayload;
import com.aistareco.service.TrackService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/tracks")
@RequiredArgsConstructor
public class TrackController {

    private final TrackService trackService;

    /** GET /api/tracks/my?lang=zh */
    @GetMapping("/my")
    public ApiResponse<TrackWorkspacePayload> getWorkspace(
            @RequestParam(defaultValue = "zh") String lang) {
        return ApiResponse.of(trackService.getWorkspace(lang));
    }

    /** POST /api/tracks/generate?lang=zh */
    @PostMapping("/generate")
    public ApiResponse<TrackSummaryDto> generate(
            @RequestParam(defaultValue = "zh") String lang,
            @RequestBody Map<String, Object> request) {
        return ApiResponse.of(trackService.generate(lang, request));
    }
}
