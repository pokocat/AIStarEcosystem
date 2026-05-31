package com.aistareco.aep.aiavatar.provider;

import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * 能力 Provider 统一接口（任务书 §5 核心设计）。
 *
 * Mock 与 Real（Backend / SelfHost）实现可互换；同一组 Provider 契约测试对两种 Bean 执行
 * （{@code AiAvatarProviderContractTest}）。
 *
 * <pre>{@code
 * public interface CapabilityProvider {
 *     AiAvatarCapability capability();         // faceClone | txt2img | faceWarp | ...
 *     AiAvatarProviderMode mode();             // MOCK | BACKEND | SELFHOST
 *     ProviderResult run(JsonNode input, AiAvatarJobContext ctx);  // 通过 ctx.onProgress(pct) 上报进度
 *     ProviderHealth healthcheck();
 * }
 * }</pre>
 */
public interface CapabilityProvider {

    AiAvatarCapability capability();

    AiAvatarProviderMode mode();

    /** 实现来源标识（"MOCK" / "InstantID" / "SDXL" / "TripoSR" / "GFPGAN" / "LLM-Gateway" …）。 */
    String engine();

    /** 执行能力。通过 {@code ctx.onProgress(pct, msg)} 上报进度；可读 {@code ctx.isCancelled()} 提前退出。 */
    ProviderResult run(JsonNode input, AiAvatarJobContext ctx) throws Exception;

    ProviderHealth healthcheck();
}
