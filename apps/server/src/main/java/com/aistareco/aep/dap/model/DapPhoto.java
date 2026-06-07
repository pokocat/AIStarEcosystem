package com.aistareco.aep.dap.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** 形象照片素材（上传照片创建路径的输入）。 */
@Entity
@Table(name = "dap_photo", indexes = {
        @Index(name = "idx_dap_photo_avatar", columnList = "avatarId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapPhoto {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 32)
    private String avatarId;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(length = 512)
    private String fileKey;

    @Column(length = 64)
    private String contentType;

    @Builder.Default
    private long bytes = 0;

    private Instant createdAt;
}
