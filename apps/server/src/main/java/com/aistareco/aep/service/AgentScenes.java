package com.aistareco.aep.service;

import com.aistareco.aep.dto.AgentSceneDto;

import java.util.List;

/**
 * 可绑定 agent bot 的业务场景目录（单一真源）。
 *
 * 新增一个 agent 平台功能：
 *   1) 这里加一个 scene 常量 + 目录项；
 *   2) 写一个薄 handler（鉴权 + 拼 prompt），按本 sceneKey 取 bot 配置；
 *   3) admin 在「Agent 平台」为该 sceneKey 配一行 bot（token / botId）。
 */
public final class AgentScenes {

    private AgentScenes() {}

    /** v3 形象锻造（艺人形象生成对话）。 */
    public static final String APPEARANCE_FORGE = "appearance-forge";

    public static List<AgentSceneDto> all() {
        return List.of(
                new AgentSceneDto(APPEARANCE_FORGE, "形象锻造",
                        "艺人形象生成对话（v3 形象锻造）。绑定后 /appearance-forge 的真实路径走该 bot。")
        );
    }
}
