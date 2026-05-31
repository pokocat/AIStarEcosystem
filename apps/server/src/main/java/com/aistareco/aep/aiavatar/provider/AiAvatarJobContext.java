package com.aistareco.aep.aiavatar.provider;

import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.aistareco.aep.aiavatar.service.AiAvatarStorage;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.function.BiConsumer;
import java.util.function.Supplier;

/**
 * 任务执行上下文（任务书 §5 JobContext）。
 *
 * 把进度上报、取消检测、文件落盘三类副作用抽象给 Provider，使 Provider 实现保持纯粹。
 */
public class AiAvatarJobContext {

    private final String jobId;
    private final String ownerUserId;
    private final String avatarId;
    private final AiAvatarCapability capability;
    private final AiAvatarProviderMode mode;
    private final AiAvatarStorage storage;
    private final ObjectMapper mapper;
    private final BiConsumer<Integer, String> progressSink;
    private final Supplier<Boolean> cancelledSupplier;

    public AiAvatarJobContext(String jobId, String ownerUserId, String avatarId,
                        AiAvatarCapability capability, AiAvatarProviderMode mode,
                        AiAvatarStorage storage, ObjectMapper mapper,
                        BiConsumer<Integer, String> progressSink,
                        Supplier<Boolean> cancelledSupplier) {
        this.jobId = jobId;
        this.ownerUserId = ownerUserId;
        this.avatarId = avatarId;
        this.capability = capability;
        this.mode = mode;
        this.storage = storage;
        this.mapper = mapper;
        this.progressSink = progressSink;
        this.cancelledSupplier = cancelledSupplier;
    }

    public String jobId() { return jobId; }
    public String ownerUserId() { return ownerUserId; }
    public String avatarId() { return avatarId; }
    public AiAvatarCapability capability() { return capability; }
    public AiAvatarProviderMode mode() { return mode; }
    public AiAvatarStorage storage() { return storage; }
    public ObjectMapper mapper() { return mapper; }

    /** 上报进度（0–100）。Provider 应在关键节点调用，驱动状态条 + SSE。 */
    public void onProgress(int pct, String message) {
        if (progressSink != null) {
            progressSink.accept(Math.max(0, Math.min(100, pct)), message);
        }
    }

    /** 是否已被用户取消；Provider 长任务循环中应检查并提前 return。 */
    public boolean isCancelled() {
        return cancelledSupplier != null && Boolean.TRUE.equals(cancelledSupplier.get());
    }
}
