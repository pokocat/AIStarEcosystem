package com.aistareco.aep.aiavatar.provider;

import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.aistareco.aep.aiavatar.service.AiAvatarStorage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Provider 公共骨架：进度分步 + 输入读取小工具。 */
public abstract class AbstractCapabilityProvider implements CapabilityProvider {

    protected final AiAvatarCapability capability;
    protected final AiAvatarProviderMode mode;
    protected final String engine;
    protected final AiAvatarStorage storage;
    protected final ObjectMapper mapper;

    protected AbstractCapabilityProvider(AiAvatarCapability capability, AiAvatarProviderMode mode,
                                         String engine, AiAvatarStorage storage, ObjectMapper mapper) {
        this.capability = capability;
        this.mode = mode;
        this.engine = engine;
        this.storage = storage;
        this.mapper = mapper;
    }

    @Override public AiAvatarCapability capability() { return capability; }
    @Override public AiAvatarProviderMode mode() { return mode; }
    @Override public String engine() { return engine; }
    @Override public ProviderHealth healthcheck() { return ProviderHealth.ok(engine + " ready"); }

    /** 上报进度并模拟耗时（可被取消打断）。 */
    protected void step(AiAvatarJobContext ctx, int pct, String msg, long ms) {
        ctx.onProgress(pct, msg);
        sleepInterruptible(ms, ctx);
    }

    protected void sleepInterruptible(long ms, AiAvatarJobContext ctx) {
        long end = System.currentTimeMillis() + Math.max(0, ms);
        while (System.currentTimeMillis() < end) {
            if (ctx.isCancelled()) return;
            try {
                Thread.sleep(Math.min(80, Math.max(1, end - System.currentTimeMillis())));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    protected int intVal(JsonNode input, String field, int def) {
        if (input == null || !input.hasNonNull(field)) return def;
        return input.get(field).asInt(def);
    }

    protected String strVal(JsonNode input, String field, String def) {
        if (input == null || !input.hasNonNull(field)) return def;
        String v = input.get(field).asText();
        return v == null || v.isBlank() ? def : v;
    }

    protected double dblVal(JsonNode input, String field, double def) {
        if (input == null || !input.hasNonNull(field)) return def;
        return input.get(field).asDouble(def);
    }
}
