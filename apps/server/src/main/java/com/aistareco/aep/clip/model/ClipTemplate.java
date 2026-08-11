package com.aistareco.aep.clip.model;

import com.aistareco.common.JsonMapConverter;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "clip_template", indexes = {
        @Index(name = "idx_clip_template_status", columnList = "status,industry,themeKey")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClipTemplate {
    @Id @Column(length = 64) private String id;
    @Column(nullable = false, length = 128) private String name;
    @Column(nullable = false, length = 64) private String industry;
    @Column(nullable = false, length = 64) private String themeKey;
    @Column(nullable = false, columnDefinition = "TEXT") private String description;
    @Column(nullable = false, length = 16) @Builder.Default private String status = "draft";
    @Column(nullable = false, length = 16) @Builder.Default private String ownerScope = "official";
    @Convert(converter = JsonMapConverter.class) @Column(nullable = false, columnDefinition = "TEXT") private Map<String, Object> scriptSkeletonJson;
    @Convert(converter = JsonMapConverter.class) @Column(columnDefinition = "TEXT") private Map<String, Object> timelineJson;
    @Convert(converter = JsonMapConverter.class) @Column(columnDefinition = "TEXT") private Map<String, Object> tailClipsJson;
    @Convert(converter = JsonMapConverter.class) @Column(columnDefinition = "TEXT") private Map<String, Object> brollPoolJson;
    @Column(length = 512) private String previewCoverKey;
    @Column(length = 512) private String previewVideoKey;
    @Column(nullable = false, length = 8) @Builder.Default private String ratio = "9:16";
    @Builder.Default private int estDurationSec = 0;
    @Builder.Default private int avatarSecHint = 0;
    private Integer creditHint;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
}
