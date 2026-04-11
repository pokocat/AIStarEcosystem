package com.aistareco.controller;

import com.aistareco.common.ApiResponse;
import com.aistareco.dto.SingerDetailDto;
import com.aistareco.dto.SingerWorkspacePayload;
import com.aistareco.service.SingerService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/singers")
@RequiredArgsConstructor
public class SingerController {

    private final SingerService singerService;

    /** GET /api/singers/my?lang=zh → full workspace payload */
    @GetMapping("/my")
    public ApiResponse<SingerWorkspacePayload> getWorkspace(
            @RequestParam(defaultValue = "zh") String lang) {
        return ApiResponse.of(singerService.getWorkspace(lang));
    }

    /** POST /api/singers?lang=zh → create blank draft singer */
    @PostMapping
    public ApiResponse<SingerDetailDto> create(
            @RequestParam(defaultValue = "zh") String lang) {
        return ApiResponse.of(singerService.create(lang));
    }

    /** PUT /api/singers/{id} → update singer */
    @PutMapping("/{id}")
    public ApiResponse<SingerDetailDto> update(
            @PathVariable String id,
            @RequestBody SingerDetailDto dto,
            @RequestParam(defaultValue = "zh") String lang) {
        return ApiResponse.of(singerService.update(id, dto, lang));
    }

    /** DELETE /api/singers/{id} */
    @DeleteMapping("/{id}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String id) {
        singerService.delete(id);
        return ApiResponse.of(Map.of("id", id, "deleted", true));
    }
}
