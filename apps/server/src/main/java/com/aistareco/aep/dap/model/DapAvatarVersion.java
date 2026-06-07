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

/** 数字人版本时间线（详情页「版本」tab）。 */
@Entity
@Table(name = "dap_avatar_version", indexes = {
        @Index(name = "idx_dap_ver_avatar", columnList = "avatarId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapAvatarVersion {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 32)
    private String avatarId;

    /** 版本号（1 起）。 */
    private int v;

    /** 事件说明，如「初始选稿」「精调 · 脸型 +12」「定稿确认 · 5 张标准图」。 */
    @Column(length = 512)
    private String note;

    /** 事件类别（前端映射图标）：init|iterate|refine|template|finalize|archive|look|derive */
    @Column(length = 16)
    private String kind;

    /** 该版本主图 storage key（可空 = 沿用上一版）。 */
    @Column(length = 512)
    private String imageKey;

    private Instant createdAt;
}
