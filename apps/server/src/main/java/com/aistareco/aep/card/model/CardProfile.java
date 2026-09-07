package com.aistareco.aep.card.model;

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

/**
 * AI 数字名片（一张名片 = 一行）。
 *
 * <p>名片是「个人 / 企业 IP 的对外发布面」，<b>不产生任何新资产</b>：形象一律以
 * {@code dapDisplayRef}（{@code look:<id>} / {@code deriv:<id>} / {@code null}=跟随定妆照）
 * 引用数字资产平台的形象，资产改了名片自动跟着变，永不拷贝图片。
 * 方案真源 {@code docs/digital-business-card-plan.md}。
 *
 * <p>{@code payloadJson} 是名片文档的整存整取字段。<b>只存 cdnKey 与 dapDisplayRef，
 * 绝不存签名 URL</b> —— 签名有 TTL，存下来一小时后全是裂图（§4.7.7）；出 wire 时
 * 才由 {@code CdnUrlSigner} 派生。
 */
@Entity
@Table(name = "card_profile", indexes = {
        @Index(name = "idx_card_profile_owner", columnList = "ownerUserId,deletedAt"),
        @Index(name = "idx_card_profile_avatar", columnList = "avatarId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CardProfile {

    public static final String STATUS_DRAFT = "draft";
    public static final String STATUS_PUBLISHED = "published";

    /** 业务 id，形如 CARD-3f9a1c02。 */
    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    /**
     * 短链，进 URL：{@code /card/p/<slug>}。全局唯一。
     * {@code demo} 是前端保留短链（后端未上线时的演示入口），服务层禁止真实名片占用。
     */
    @Column(nullable = false, length = 64, unique = true)
    private String slug;

    /** 登记号 BC-xxxx。与 slug 分离：换短链不换登记号。 */
    @Column(nullable = false, length = 32)
    private String regNo;

    @Column(nullable = false, length = 16)
    private String status;

    /** 引用的数字人形象 {@code DapAvatar.id}；每屏用哪个造型在 payload 里。 */
    @Column(length = 32)
    private String avatarId;

    @Lob
    @Column(nullable = false)
    private String payloadJson;

    private Instant publishedAt;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;

    public boolean isPublished() {
        return STATUS_PUBLISHED.equals(status) && deletedAt == null;
    }
}
