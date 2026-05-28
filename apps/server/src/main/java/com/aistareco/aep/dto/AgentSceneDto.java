package com.aistareco.aep.dto;

/**
 * 可绑定 agent bot 的业务场景（admin 下拉用）。
 * 新增一个 agent 功能 = 在 AgentScenes 目录里加一个 scene + 写对应的薄 handler。
 */
public record AgentSceneDto(
        String key,
        String label,
        String description
) {}
