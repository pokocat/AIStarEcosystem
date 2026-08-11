package com.aistareco.aep.clip.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "clip_asset", indexes = {
        @Index(name = "idx_clip_asset_owner_kind", columnList = "externalOwnerId,kind"),
        @Index(name = "idx_clip_asset_preset", columnList = "preset,kind")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClipAsset {
    @Id @Column(length = 64) private String id;
    @Column(length = 128) private String externalOwnerId;
    @Column(nullable = false, length = 16) private String kind;
    @Column(nullable = false, length = 128) private String label;
    @Column(length = 128) private String tag;
    @Column(length = 1024) private String localPath;
    @Column(length = 512) private String cdnKey;
    @Column(length = 512) private String thumbnailCdnKey;
    @Column(nullable = false, length = 128) private String mimeType;
    private long bytes;
    @Builder.Default private double durationSec = 0;
    @Builder.Default private int usedCount = 0;
    @Builder.Default private boolean preset = false;
    @Column(length = 64) private String presetGroup;
    private Instant createdAt;
    private Instant deletedAt;
}
