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

/** 真人捕获会话（CAP-xxx）：录制/上传动作素材 → 身份核验 → 生成授权。 */
@Entity
@Table(name = "dap_capture", indexes = {
        @Index(name = "idx_dap_cap_owner", columnList = "ownerUserId"),
        @Index(name = "idx_dap_cap_avatar", columnList = "avatarId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapCapture {

    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(length = 32)
    private String avatarId;

    /** created | footage_uploaded | verified | failed */
    @Column(nullable = false, length = 24)
    private String status;

    /** 动作素材（视频或图片）storage key。 */
    @Column(length = 512)
    private String footageKey;

    @Column(length = 64)
    private String footageContentType;

    /** 素材时长（秒，ffprobe 可得时）。 */
    @Builder.Default
    private double durationSec = 0;

    /** 从素材抽取的关键帧 storage key（生成形象的 i2i 输入）。 */
    @Column(length = 512)
    private String frameKey;

    @Builder.Default
    private long bytes = 0;

    private Instant verifiedAt;
    private Instant createdAt;
}
