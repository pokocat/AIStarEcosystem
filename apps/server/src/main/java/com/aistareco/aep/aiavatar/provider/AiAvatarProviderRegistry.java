package com.aistareco.aep.aiavatar.provider;

import com.aistareco.aep.aiavatar.config.AiAvatarProperties;
import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.aistareco.aep.aiavatar.provider.impl.*;
import com.aistareco.aep.aiavatar.service.AiAvatarStorage;
import com.aistareco.aep.service.AiModelInvocationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.Map;

/**
 * Provider 注册表（任务书 §5/§6）—— 按「全局 appMode + 每能力覆盖」选择实现来源，
 * 每能力一个 Mock + 一或多个 Real 实现，运行时按 {@code aep.aiavatar.providers.<capability>} 选 Bean。
 *
 * 选择规则（任务书 §6.2）：
 *  1. {@code aep.aiavatar.providers.<capabilityWire>} 显式指定 mock|backend|selfhost → 用它；
 *  2. 否则按 appMode：dev → MOCK；prod → 该能力的「首选真实实现」（见 defaultRealMode）。
 *  3. faceWarp 例外：永远走真实确定性算法（即便 dev），任务书 §4 明确要求。
 *  4. 选了 real 但该 real 不可用（如 backend 未配端点 / selfhost 无 url）→ dev 回退 mock 并告警；
 *     prod 保留 real（其 run() 会抛可见错误）。
 */
@Component
public class AiAvatarProviderRegistry {

    private static final Logger log = LoggerFactory.getLogger(AiAvatarProviderRegistry.class);

    private final AiAvatarProperties props;
    private final AiAvatarStorage storage;
    private final ObjectMapper mapper;
    private final AiModelInvocationService gateway;

    /** capability → 选中的 Provider（构造期一次性解析）。 */
    private final Map<AiAvatarCapability, CapabilityProvider> active = new EnumMap<>(AiAvatarCapability.class);
    /** capability → 该能力所有候选实现（健康检查 / 调试用）。 */
    private final Map<AiAvatarCapability, Map<AiAvatarProviderMode, CapabilityProvider>> all = new EnumMap<>(AiAvatarCapability.class);

    public AiAvatarProviderRegistry(AiAvatarProperties props, AiAvatarStorage storage, ObjectMapper mapper,
                              @Autowired(required = false) AiModelInvocationService gateway) {
        this.props = props;
        this.storage = storage;
        this.mapper = mapper;
        this.gateway = gateway;
        build();
    }

    private void build() {
        for (AiAvatarCapability cap : AiAvatarCapability.values()) {
            Map<AiAvatarProviderMode, CapabilityProvider> candidates = candidatesFor(cap);
            all.put(cap, candidates);

            AiAvatarProviderMode desired = resolveMode(cap);
            CapabilityProvider chosen = candidates.get(desired);

            // real 不可用时的回退
            if (chosen == null || !chosen.healthcheck().healthy()) {
                if (props.isProd() && chosen != null) {
                    // prod 保留 real（run 时抛可见错误），不静默回退
                    log.warn("[aiavatar-provider] {} desired={} unhealthy in prod — kept (will surface error). msg={}",
                            cap.wire(), desired, chosen.healthcheck().message());
                } else {
                    CapabilityProvider mock = candidates.get(AiAvatarProviderMode.MOCK);
                    if (chosen == null) {
                        log.info("[aiavatar-provider] {} has no {} impl → fallback MOCK", cap.wire(), desired);
                    } else {
                        log.warn("[aiavatar-provider] {} desired={} unhealthy → fallback MOCK. msg={}",
                                cap.wire(), desired, chosen.healthcheck().message());
                    }
                    chosen = mock != null ? mock : chosen;
                }
            }
            active.put(cap, chosen);
            if (chosen != null) {
                log.info("[aiavatar-provider] {} → mode={} engine={}", cap.wire(), chosen.mode(), chosen.engine());
            }
        }
    }

    /** 构建一个能力的全部候选实现（mock 必有；real 视能力而定）。 */
    private Map<AiAvatarProviderMode, CapabilityProvider> candidatesFor(AiAvatarCapability cap) {
        Map<AiAvatarProviderMode, CapabilityProvider> m = new EnumMap<>(AiAvatarProviderMode.class);

        // MOCK —— 每能力都有
        m.put(AiAvatarProviderMode.MOCK, mockFor(cap));

        // SELFHOST —— 通用 HTTP 编排（任意能力可包微服务）；faceWarp 用真实 in-process 实现
        if (cap == AiAvatarCapability.FACE_WARP) {
            m.put(AiAvatarProviderMode.SELFHOST, new RealFaceWarpProvider(storage, mapper));
        } else {
            String url = props.getSelfhostBaseUrls().get(cap.wire());
            m.put(AiAvatarProviderMode.SELFHOST, new SelfHostHttpProvider(cap, url, storage, mapper));
        }

        // BACKEND —— 走平台大模型网关；当前 nlu 有专门实现，其余能力 backend 复用 selfhost 语义（多模态网关）
        if (cap == AiAvatarCapability.NLU) {
            m.put(AiAvatarProviderMode.BACKEND, new BackendNluProvider(gateway, storage, mapper));
        } else {
            // 其它能力的 backend：占位走 selfhost-http（大模型多模态网关也可包成同协议）。
            String url = props.getSelfhostBaseUrls().get(cap.wire());
            if (url != null && !url.isBlank()) {
                m.put(AiAvatarProviderMode.BACKEND, new SelfHostHttpProvider(cap, url, storage, mapper));
            }
        }
        return m;
    }

    private CapabilityProvider mockFor(AiAvatarCapability cap) {
        return switch (cap) {
            case FACE_DETECT -> new MockFaceDetectProvider(storage, mapper);
            case NLU -> new MockNluProvider(storage, mapper);
            case IMG23D -> new Mock3dProvider(storage, mapper);
            case IMG2VIDEO -> new MockVideoProvider(storage, mapper);
            case SEGMENT -> new MockSegmentProvider(storage, mapper);
            case FACE_WARP -> new RealFaceWarpProvider(storage, mapper); // 即便 mock 槽也用真实算法
            default -> new MockImageProvider(cap, storage, mapper);       // faceClone/txt2img/img2img/inpaint/makeup/hair/restore
        };
    }

    /** 解析某能力期望的实现来源。 */
    private AiAvatarProviderMode resolveMode(AiAvatarCapability cap) {
        // faceWarp 永远真实（确定性算法）
        if (cap == AiAvatarCapability.FACE_WARP) return AiAvatarProviderMode.SELFHOST;

        String override = props.getProviders().get(cap.wire());
        if (override != null && !override.isBlank()) {
            return AiAvatarProviderMode.fromWire(override);
        }
        return props.isProd() ? defaultRealMode(cap) : AiAvatarProviderMode.MOCK;
    }

    private AiAvatarProviderMode defaultRealMode(AiAvatarCapability cap) {
        // nlu 默认走大模型网关；其余真实能力默认 selfhost 微服务
        return cap == AiAvatarCapability.NLU ? AiAvatarProviderMode.BACKEND : AiAvatarProviderMode.SELFHOST;
    }

    public CapabilityProvider get(AiAvatarCapability cap) {
        CapabilityProvider p = active.get(cap);
        if (p == null) {
            throw new IllegalStateException("无可用 Provider: " + cap.wire());
        }
        return p;
    }

    public Map<AiAvatarCapability, CapabilityProvider> active() {
        return active;
    }
}
