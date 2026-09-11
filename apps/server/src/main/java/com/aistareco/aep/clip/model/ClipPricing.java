package com.aistareco.aep.clip.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/**
 * 爱速拍六档生成单价（运营核定值）。
 *
 * <p><b>单行表</b>，id 恒为 {@link #ROW_ID}。不做成 key-value 多行，是因为这六个数必须
 * 一起生效：端上按 {@code /api/me/clip/pricing} 拿到的一组数算报价，服务端按同一组核对，
 * 差一分钱就是每次生成都 409。多行表在「改了三行、另外三行还没改」的中间状态下，
 * 两边会短暂读到不同的组合。
 *
 * <p><b>表是空的 = 运营没核定过</b>，此时回落 {@code ClipProperties}（application.yml）的
 * 兜底值，后台显示「当前是配置兜底价」。刻意不 seed 初始行 —— seed 就等于替运营做了定价决定。
 */
@Entity
@Table(name = "clip_pricing")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClipPricing {
    /** 单行表的固定主键。 */
    public static final String ROW_ID = "default";

    @Id
    @Column(length = 16)
    private String id;

    @Column(name = "avatar_second", nullable = false)
    private int avatarSecond;

    @Column(name = "tts_per_kchar", nullable = false)
    private int ttsPerKchar;

    @Column(nullable = false)
    private int assemble;

    @Column(name = "t2i_per_image", nullable = false)
    private int t2iPerImage;

    @Column(name = "t2v_second", nullable = false)
    private int t2vSecond;

    @Column(name = "i2v_second", nullable = false)
    private int i2vSecond;

    /** 谁改的。改价是营收动作，必须能倒查。 */
    @Column(name = "updated_by", length = 128)
    private String updatedBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
