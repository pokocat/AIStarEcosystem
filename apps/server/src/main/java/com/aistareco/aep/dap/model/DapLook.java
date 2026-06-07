package com.aistareco.aep.dap.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** 数字人造型（造型档案 / 设计新造型 / 场景替换）。 */
@Entity
@Table(name = "dap_look", indexes = {
        @Index(name = "idx_dap_look_avatar", columnList = "avatarId"),
        @Index(name = "idx_dap_look_owner", columnList = "ownerUserId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapLook {

    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 32)
    private String avatarId;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(length = 128)
    private String label;

    /** design（文字描述）| scene（场景替换）| upload（上传素材）| final（定妆主图镜像） */
    @Column(length = 16)
    private String source;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String prompt;

    @Column(length = 32)
    private String sceneId;

    /** running | done | failed */
    @Column(nullable = false, length = 16)
    private String status;

    @Column(length = 32)
    private String jobId;

    @Column(length = 512)
    private String imageKey;

    @Builder.Default
    private long bytes = 0;

    private Instant createdAt;
}
