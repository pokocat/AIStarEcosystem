package com.aistareco.aep.dto;

import java.util.List;

/**
 * 明星专区前端 UI 字典（v0.5.1 新增）。
 *
 * 用于消除小程序里的硬编码：durations / languages / 商品类目 / 默认卖点建议。
 * v0.6 起这些字段会上移到 ConfigItem 表（运营可配），本期由 server 提供静态默认值
 * （miniprogram 已在 utils/api.js 层 mock 这同一份）。
 */
public record CelebrityDictionariesDto(
        List<Integer> durations,            // [15, 30, 60]
        List<String> languages,             // ["普通话", "粤语", "英语"]
        List<String> categories,            // 市场分类 ["全部", "美食", "美妆", ...]
        List<String> keypointSuggestions    // 默认卖点建议（用户未选商品时）
) {}
