package com.aistareco.aep.clip.model;

import com.aistareco.common.JsonMapConverter;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.Map;

/**
 * 一个项目的配音预览时间线（WORKPLAN 2026-09-05 §1.5）。
 *
 * <p>每个 (externalOwnerId, projectId) 只有一行：预览是「当前这版文案 + 当前这个音色」的投影，
 * 换一版就该整体作废。{@code timelineHash} 是那一版的指纹，POST 幂等和 GET 作废判定都只看它。
 *
 * <p>{@code segmentsJson} 里存的是我方存储 key（{@code audioCdnKey}），出 wire 时才派生短期签名 URL。
 * 签名 URL 落库会在 TTL 到期后变成一堆 403，这是 §4.7.4 的既有口径。
 */
@Entity
@Table(name = "clip_tts_preview", indexes = {
        @Index(name = "uk_clip_tts_preview_project", columnList = "externalOwnerId,projectId", unique = true),
        @Index(name = "idx_clip_tts_preview_status", columnList = "status,heartbeatAt")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClipTtsPreview {
    @Id @Column(length = 64) private String id;
    @Column(nullable = false, length = 128) private String externalOwnerId;
    @Column(nullable = false, length = 64) private String projectId;
    @Column(nullable = false, length = 96) private String timelineHash;
    @Column(length = 64) private String voiceId;
    /** generating | ready | failed —— 与 §1.5 响应体的 status 同一套取值。 */
    @Column(nullable = false, length = 16) @Builder.Default private String status = "generating";
    @Convert(converter = JsonMapConverter.class) @Column(columnDefinition = "TEXT") private Map<String, Object> segmentsJson;
    @Builder.Default private double totalDurationSec = 0;
    /** Scheme A 下 clip 域不扣钻石，恒为 0；非 0 表示调用方必须先 hold。 */
    @Builder.Default private int credits = 0;
    @Column(length = 64) private String errorCode;
    @Column(columnDefinition = "TEXT") private String errorMessage;
    @Builder.Default private int attempts = 0;
    @Column(length = 64) private String leaseOwner;
    private Instant leaseUntil;
    private Instant heartbeatAt;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant completedAt;
}
