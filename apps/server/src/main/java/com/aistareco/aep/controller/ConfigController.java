package com.aistareco.aep.controller;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 平台配置公开读取接口：/api/config/*。
 * <p>安全配置已将 /api/config/** 列为 permitAll —— 前端无需登录即可获取。
 */
@RestController
@RequestMapping("/api/config")
public class ConfigController {

    private final PlatformConfigService service;

    public ConfigController(PlatformConfigService service) {
        this.service = service;
    }

    @GetMapping("/{key}")
    public ApiResponse<PlatformConfigDto> getByKey(@PathVariable String key) {
        return ApiResponse.of(service.requireByKey(key));
    }

    @GetMapping
    public ApiResponse<List<PlatformConfigDto>> listAll() {
        return ApiResponse.of(service.listAll());
    }
}
