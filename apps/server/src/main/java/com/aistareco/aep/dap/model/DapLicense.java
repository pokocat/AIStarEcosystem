package com.aistareco.aep.dap.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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
import java.util.ArrayList;
import java.util.List;

/** 真人肖像电子授权（LIC-xxxx）。 */
@Entity
@Table(name = "dap_license", indexes = {
        @Index(name = "idx_dap_lic_owner", columnList = "ownerUserId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapLicense {

    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    /** 肖像权人，如「周野（高管）」。 */
    @Column(nullable = false, length = 128)
    private String subject;

    /** 关联数字人资产 id（可空）。 */
    @Column(length = 32)
    private String avatarId;

    @Column(length = 256)
    private String scope;

    private Instant periodStart;
    private Instant periodEnd;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private List<String> platforms = new ArrayList<>();

    /** active | pending | expired */
    @Column(nullable = false, length = 16)
    private String status;

    private Instant signedAt;

    /** 绑定加密素材数量。 */
    @Builder.Default
    private int photoCount = 0;

    /** 授权凭证文件 storage key（首次下载时生成）。 */
    @Column(length = 512)
    private String certKey;

    private Instant createdAt;
}
