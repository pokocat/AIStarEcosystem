package com.aistareco.aep.controller;

import com.aistareco.aep.config.DramaConfigSeeder;
import com.aistareco.aep.service.CelebrityActionPricingService;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 短剧个性化配置（用户侧只读，v0.66）：扣费确认阈值 + 各 AI 动作单价。
 * 真值在 PlatformConfig（admin「短剧专区」可改）；clip 单价沿用 celebrity
 * 既有 action 定价 material.video-generate（admin「引擎价格」可改）。
 */
@RestController
@RequestMapping("/api/me/drama")
public class DramaConfigController {

    private final PlatformConfigService configs;
    private final CelebrityActionPricingService actionPricing;
    private final ObjectMapper om;

    public DramaConfigController(PlatformConfigService configs,
                                 CelebrityActionPricingService actionPricing,
                                 ObjectMapper om) {
        this.configs = configs;
        this.actionPricing = actionPricing;
        this.om = om;
    }

    @GetMapping("/config")
    public ApiResponse<JsonNode> config() {
        ObjectNode out = om.createObjectNode();
        out.put("confirmThreshold", configs.getLong(DramaConfigSeeder.KEY_CONFIRM_THRESHOLD, 10));
        ObjectNode prices = out.putObject("prices");
        prices.put("outlineTrial", configs.getLong(DramaConfigSeeder.KEY_OUTLINE_TRIAL, 6));
        prices.put("outlineFull", configs.getLong(DramaConfigSeeder.KEY_OUTLINE_FULL, 18));
        prices.put("epscript", configs.getLong(DramaConfigSeeder.KEY_EPSCRIPT, 10));
        prices.put("splitScene", configs.getLong(DramaConfigSeeder.KEY_SPLIT_SCENE, 6));
        prices.put("cast", configs.getLong(DramaConfigSeeder.KEY_CAST, 5));
        prices.put("frame", configs.getLong(DramaConfigSeeder.KEY_FRAME, 2));
        prices.put("shortEntry", configs.getLong(DramaConfigSeeder.KEY_SHORT_ENTRY, 10));
        Long clip = actionPricing.creditPriceOf(CelebrityActionPricingService.ACTION_VIDEO_GENERATE);
        prices.put("clip", clip != null ? clip : 30L);
        return ApiResponse.of(out);
    }
}
