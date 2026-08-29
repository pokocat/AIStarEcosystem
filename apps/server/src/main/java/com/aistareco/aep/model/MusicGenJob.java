package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 音乐创作 · 歌曲生成任务（真实调用音乐大模型，异步 submit + 轮询）。
 *
 * 生命周期：queued → submitting → generating → succeeded | failed
 *
 * 与 {@link MaterialVideoJob} 同构（音乐模型同样是「提交拿 TaskID → 轮询拿音频」的原子异步），
 * 但吸取了三条 clip 域的经验：
 *   1. {@code clientRequestId} 唯一索引 —— 前端双击 / 弱网重试不会重复建单重复扣费；
 *   2. 产物只落 {@code audioCdnKey} 不落 URL —— §4.7.4 真值是 key，URL 出 wire 时派生 + 签名；
 *   3. 配套 @Scheduled reaper —— 进程重启时在途任务不会永久卡在 generating。
 *
 * 计费：hold 按「请求时长 × 单价」冻结，成功后按上游回报的**实际时长**结算，差额释放
 * （音乐模型的实际成曲时长常与请求时长不等，见 MusicGenWorker#settleCredits）。
 *
 * 建表：JPA ddl-auto=update 自动建；MySQL 侧另有 Flyway 迁移补 ai_app_binding 的 purpose 枚举值。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "music_gen_job", indexes = {
        @Index(name = "idx_mgj_owner", columnList = "owner_user_id"),
        @Index(name = "idx_mgj_status", columnList = "status"),
        @Index(name = "idx_mgj_song", columnList = "song_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_mgj_owner_request", columnNames = {"owner_user_id", "client_request_id"})
})
public class MusicGenJob {

    @Id
    @Column(length = 64)
    private String id;

    /** 归属人（AepUser.id）；仅本人可见 / 可查。 */
    @Column(name = "owner_user_id", length = 64, nullable = false)
    private String ownerUserId;

    /**
     * 幂等键：同一 owner 下重复提交同一 clientRequestId 直接返回已有任务，
     * 不重复建单、不重复冻结积分。前端每次「开始创作」生成一个新值。
     */
    @Column(name = "client_request_id", length = 64)
    private String clientRequestId;

    /** 可选：绑定的艺人（DigitalIp.id）。为空 = 自由创作，作品直接归属账号。 */
    @Column(name = "artist_id", length = 36)
    private String artistId;

    /** 成功后落地的歌曲（Song.id）；失败为 null。 */
    @Column(name = "song_id", length = 64)
    private String songId;

    // ── 创作输入 ────────────────────────────────────────────────────────────

    /** 灵感提示词（与 lyrics 二选一）。 */
    @Column(columnDefinition = "LONGTEXT")
    private String prompt;

    /** 用户自备歌词（优先级高于 prompt）；含 [verse]/[chorus] 结构标签。 */
    @Column(columnDefinition = "LONGTEXT")
    private String lyrics;

    /** 曲风 / 情绪 / 音色 / 演唱性别 —— 直接透传给模型，取值范围由端点 capability 约束。 */
    @Column(length = 128)
    private String genre;

    @Column(length = 128)
    private String mood;

    @Column(length = 128)
    private String timbre;

    @Column(length = 16)
    private String gender;

    /** 是否纯音乐（无人声 BGM）。 */
    @Column(name = "instrumental")
    private boolean instrumental;

    /** 请求时长（秒）。人声 30–240；BGM ≤60。 */
    @Column(name = "duration_sec")
    private int durationSec;

    /** 完整请求快照（wire 形状），便于排障与回放。 */
    @Column(name = "payload_json", columnDefinition = "LONGTEXT")
    private String payloadJson;

    /** 端点选择等选项，含 {@code endpoint_id} 透传键。 */
    @Column(name = "options_json", columnDefinition = "LONGTEXT")
    private String optionsJson;

    // ── 状态机 ──────────────────────────────────────────────────────────────

    /** queued | submitting | generating | succeeded | failed */
    @Column(length = 24)
    private String status;

    /** 0–100。上游有真实进度用真实值，否则按耗时估算，封顶 95。 */
    private int progress;

    /** 上游任务句柄（轮询用；也是人工对账恢复的唯一凭据）。 */
    @Column(name = "external_task_id", length = 128)
    private String externalTaskId;

    // ── 产物（§4.7.4：只落 key，URL 出 wire 派生）──────────────────────────

    @Column(name = "audio_cdn_key", length = 512)
    private String audioCdnKey;

    @Column(name = "audio_bytes")
    private long audioBytes;

    /** 上游返回的真实成曲时长（秒），后付费按此结算。 */
    @Column(name = "actual_duration_sec")
    private Integer actualDurationSec;

    /** 模型生成 / 回填的歌词正文。 */
    @Column(name = "result_lyrics", columnDefinition = "LONGTEXT")
    private String resultLyrics;

    /** 歌词字幕（带时间戳，上游 Captions 原文）。 */
    @Column(name = "result_captions", columnDefinition = "LONGTEXT")
    private String resultCaptions;

    // ── 错误 / 观测 ─────────────────────────────────────────────────────────

    @Column(name = "error_message", length = 1024)
    private String errorMessage;

    @Column(name = "provider_used", length = 128)
    private String providerUsed;

    @Column(name = "model_used", length = 128)
    private String modelUsed;

    // ── 计费 ────────────────────────────────────────────────────────────────

    /** 提交时冻结的积分（按请求时长固化，后续改价不影响在途任务）。0 = 不计费。 */
    @Column(name = "credits_held")
    private long creditsHeld;

    /** 实际结算的积分（按真实时长）。 */
    @Column(name = "credits_settled")
    private long creditsSettled;

    // ── 时间 ────────────────────────────────────────────────────────────────

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    /** worker 心跳；reaper 据此判定僵死任务。 */
    @Column(name = "heartbeat_at")
    private OffsetDateTime heartbeatAt;
}
