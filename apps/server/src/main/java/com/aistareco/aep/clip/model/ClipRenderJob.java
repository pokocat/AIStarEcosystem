package com.aistareco.aep.clip.model;

import com.aistareco.common.JsonMapConverter;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "clip_render_job", indexes = {
        @Index(name = "idx_clip_job_external_owner", columnList = "externalOwnerId,createdAt"),
        @Index(name = "idx_clip_job_status_heartbeat", columnList = "status,heartbeatAt"),
        @Index(name = "idx_clip_job_request", columnList = "externalOwnerId,clientRequestId", unique = true)
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClipRenderJob {
    @Id @Column(length = 64) private String id;
    @Column(nullable = false, length = 128) private String externalOwnerId;
    @Column(nullable = false, length = 64) private String projectId;
    @Column(nullable = false, length = 100) private String clientRequestId;
    @Column(nullable = false, length = 16) @Builder.Default private String status = "queued";
    @Column(nullable = false, length = 24) @Builder.Default private String stage = "tts";
    @Builder.Default private int progress = 0;
    private Instant heartbeatAt;
    @Column(length = 64) private String leaseOwner;
    private Instant leaseUntil;
    @Builder.Default private int creditsHeld = 0;
    @Convert(converter = JsonMapConverter.class) @Column(columnDefinition = "TEXT") private Map<String, Object> segmentJobsJson;
    @Column(length = 512) private String outputCdnKey;
    @Column(length = 512) private String thumbnailCdnKey;
    @Builder.Default private int durationSec = 0;
    @Column(columnDefinition = "TEXT") private String errorMessage;
    @Builder.Default private boolean mock = false;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant completedAt;
}
