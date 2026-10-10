package com.aistareco.aep.ipstudio.dto;

import java.util.List;

/** Native video + audio lip-sync, separate from ordinary image-to-video or audio replacement. */
public final class StudioLipSyncDtos {
    private StudioLipSyncDtos() {}
    public record LipSyncModel(String endpointId, String name, boolean isDefault, java.math.BigDecimal creditCostPerSecond) {}
    public record LipSyncCatalog(List<LipSyncModel> models, int maxAudioSeconds) {}
    public record LipSyncInput(String model, String videoStorageKey, String audioStorageKey) {}
    public record LipSyncQuote(long cost, long billableSeconds, double audioDurationSec, double videoDurationSec) {}
    public record LipSyncRequest(String clientRequestId, String nodeId, String model,
                                 String videoStorageKey, String audioStorageKey, Long maxCost) {}
}
