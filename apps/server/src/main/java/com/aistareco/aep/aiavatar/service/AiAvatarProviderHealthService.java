package com.aistareco.aep.aiavatar.service;

import com.aistareco.aep.aiavatar.dto.AiAvatarProviderHealthDto;
import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.provider.CapabilityProvider;
import com.aistareco.aep.aiavatar.provider.AiAvatarProviderRegistry;
import com.aistareco.aep.aiavatar.provider.ProviderHealth;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 能力健康汇总（任务书 §6 GET /api/health/providers）。
 * 返回每能力当前 mode + healthcheck + engine + 首选方案，前端据此显示 MOCK 角标 / 实现来源。
 */
@Service
public class AiAvatarProviderHealthService {

    private final AiAvatarProviderRegistry registry;

    public AiAvatarProviderHealthService(AiAvatarProviderRegistry registry) {
        this.registry = registry;
    }

    public List<AiAvatarProviderHealthDto> report() {
        List<AiAvatarProviderHealthDto> out = new ArrayList<>();
        for (AiAvatarCapability cap : AiAvatarCapability.values()) {
            CapabilityProvider p = registry.active().get(cap);
            if (p == null) {
                out.add(new AiAvatarProviderHealthDto(cap, cap.label(), null, false, null, cap.approach(), "无可用实现"));
                continue;
            }
            ProviderHealth h = safeHealth(p);
            out.add(new AiAvatarProviderHealthDto(cap, cap.label(), p.mode(), h.healthy(), p.engine(),
                    cap.approach(), h.message()));
        }
        return out;
    }

    private ProviderHealth safeHealth(CapabilityProvider p) {
        try {
            return p.healthcheck();
        } catch (Exception e) {
            return ProviderHealth.down("healthcheck error: " + e.getMessage());
        }
    }
}
