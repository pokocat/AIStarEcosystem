package com.aistareco.aep.service.materialvideo;
import java.time.Instant;
public interface MaterialVideoInputAssetWriter {
    void remember(String id, String source, String asset, Instant expiry);
}
