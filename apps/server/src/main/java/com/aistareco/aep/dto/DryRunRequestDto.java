package com.aistareco.aep.dto;

import java.util.Map;

/**
 * admin POST /admin/template-scripts/{id}/dry-run 请求体。
 * 模拟一次生成请求（不实际调引擎），返回装配后的 prompt。
 */
public record DryRunRequestDto(
        String engine,                              // KeLing / HiGen / MiniMax
        Integer durationSec,                        // 15 / 30 / 60
        Map<String, Object> product,                // 商品 input（CelebrityProductInput）
        String starId,
        Map<String, Object> variables               // 额外手填的 manual 变量
) {}
