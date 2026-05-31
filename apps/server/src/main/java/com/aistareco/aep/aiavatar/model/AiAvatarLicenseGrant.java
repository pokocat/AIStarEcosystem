package com.aistareco.aep.aiavatar.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 真人肖像授权（任务书 §3 LicenseGrant / §7 真人授权管理）。
 *
 * 电子肖像授权签署：范围 / 期限 / 平台；协议与照片绑定、加密存档。定稿 / 衍生前校验授权有效。
 */
@Entity
@Table(name = "aiavatar_license_grant", indexes = {
        @Index(name = "idx_aiavatar_license_avatar", columnList = "avatarId"),
        @Index(name = "idx_aiavatar_license_owner", columnList = "ownerUserId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiAvatarLicenseGrant {

    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String avatarId;

    @Column(length = 64, nullable = false)
    private String ownerUserId;

    /** 被授权肖像的真人姓名。 */
    @Column(length = 128)
    private String subjectName;

    /** 授权范围说明（如「商业代言 + 内容连载」）。 */
    @Column(length = 512)
    private String scope;

    /** 授权平台列表（如 ["douyin","xiaohongshu"]）。 */
    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "LONGTEXT")
    @Builder.Default
    private List<String> platforms = new ArrayList<>();

    @Column(nullable = false)
    private OffsetDateTime validFrom;

    @Column(nullable = false)
    private OffsetDateTime validTo;

    @Enumerated(EnumType.STRING)
    @Column(length = 16, nullable = false)
    private AiAvatarLicenseStatus status;

    /** 协议正文（加密前明文模板填充结果）。 */
    @Lob
    @Column(name = "agreement_text", columnDefinition = "LONGTEXT")
    private String agreementText;

    /** 签署人姓名。 */
    @Column(length = 128)
    private String signatureName;

    private OffsetDateTime signedAt;

    /** 协议绑定的照片 asset id（加密存档）。 */
    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "LONGTEXT")
    @Builder.Default
    private List<String> boundAssetIds = new ArrayList<>();

    /** 授权凭证下载 URL。 */
    @Column(length = 1024)
    private String credentialUrl;

    @Column(nullable = false)
    private OffsetDateTime createdAt;
}
