package com.aistareco.aep.dto;

import java.util.List;
import java.util.Map;

/**
 * admin POST/PUT /api/admin/celebrity/stars[/{id}] 请求体。
 *
 * 字段集 = 前端真源 apps/web/src/types/celebrity-zone.ts CelebrityStar 全集。
 * photos / videos 用 List<Map> 保持灵活（与 DTO 读取端 CelebrityStarDto 对齐）。
 *
 * 设计：
 *   - POST 时 id 可填（运营指定）或留空（service 生成）
 *   - PUT 整体替换（除 photos/videos 外）；photos/videos 走单独 append/remove 接口避免并发
 *   - subCategories / tags / 数据 stats 等都直接传，service 内序列化为 JSON 列
 */
public record AdminCelebrityStarUpsertDto(
        String id,
        String name,
        String avatar,
        String cover,
        String category,
        List<String> subCategories,
        Boolean isHot,
        String description,
        String startingPrice,
        String pricingTier,
        Integer quotaUsed,
        Integer quotaTotal,
        Map<String, Object> authorization,    // 陈列态默认；登录用户的真实授权走 CelebrityStarAuthorization 表
        Map<String, Object> stats,
        List<Map<String, Object>> sampleVideos,
        List<Map<String, Object>> pricing,
        // ── v0.4 字段 ────────────────────────────────────────
        String bio,
        String location,
        Long fans,
        Integer cooperationCount,
        Long avgGmv
        // photos / videos 不在此 record（走专用 append/remove 端点）
) {}
