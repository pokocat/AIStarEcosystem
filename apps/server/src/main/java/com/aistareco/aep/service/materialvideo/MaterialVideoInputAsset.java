package com.aistareco.aep.service.materialvideo;

import jakarta.persistence.*;
import lombok.Data;
import java.time.Instant;

/** A supplier receipt for an owned, immutable source key. URLs and API keys never belong here. */
@Data
@Entity
@Table(name = "material_video_input_asset")
public class MaterialVideoInputAsset {
    @Id @Column(length = 64) private String id;
    @Column(nullable = false, length = 512) private String sourceKey;
    @Column(nullable = false, length = 255) private String assetId;
    private Instant expiresAt;
}
