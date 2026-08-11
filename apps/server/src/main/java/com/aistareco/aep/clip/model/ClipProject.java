package com.aistareco.aep.clip.model;

import com.aistareco.common.JsonMapConverter;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "clip_project", indexes = {
        @Index(name = "idx_clip_project_external_owner", columnList = "externalOwnerId,updatedAt"),
        @Index(name = "idx_clip_project_status", columnList = "status,updatedAt")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClipProject {
    @Id @Column(length = 64) private String id;
    @Column(length = 64) private String ownerUserId;
    /** 方案 A 真属主：军师 userId。所有列表/读取/修改必须带此列过滤。 */
    @Column(nullable = false, length = 128) private String externalOwnerId;
    @Column(nullable = false, length = 64) private String templateId;
    @Column(nullable = false, length = 128) private String templateName;
    @Column(nullable = false, length = 160) private String title;
    @Column(nullable = false, length = 16) @Builder.Default private String status = "draft";
    @Convert(converter = JsonMapConverter.class) @Column(nullable = false, columnDefinition = "TEXT") private Map<String, Object> payloadJson;
    @Builder.Default private int durationSec = 0;
    @Builder.Default private int avatarSeconds = 0;
    @Builder.Default private int segmentCount = 0;
    @Builder.Default private int progress = 0;
    @Builder.Default private int step = 1;
    @Builder.Default private int creditsHeld = 0;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
}
