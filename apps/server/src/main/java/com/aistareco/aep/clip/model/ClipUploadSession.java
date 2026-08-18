package com.aistareco.aep.clip.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/** 客户端直传对象与异步克隆受理状态；owner + clientRequestId 是业务幂等真源。 */
@Entity
@Table(name = "clip_upload_session", indexes = {
        @Index(name = "idx_clip_upload_owner_request", columnList = "externalOwnerId,clientRequestId", unique = true),
        @Index(name = "idx_clip_upload_status_updated", columnList = "status,updatedAt")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClipUploadSession {
    @Id @Column(length = 48) private String id;
    @Column(nullable = false, length = 128) private String externalOwnerId;
    @Column(nullable = false, length = 100) private String clientRequestId;
    @Column(nullable = false, length = 16) private String kind;
    @Column(nullable = false, length = 512) private String objectKey;
    @Column(nullable = false, length = 255) private String originalFilename;
    @Column(nullable = false, length = 128) private String contentType;
    @Column(nullable = false) private long declaredBytes;
    @Column(nullable = false, length = 20) @Builder.Default private String status = "issued";
    @Column(length = 64) private String avatarId;
    @Column(length = 64) private String voiceId;
    @Column(length = 64) private String errorCode;
    @Column(columnDefinition = "TEXT") private String errorMessage;
    private Instant expiresAt;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant completedAt;
}
