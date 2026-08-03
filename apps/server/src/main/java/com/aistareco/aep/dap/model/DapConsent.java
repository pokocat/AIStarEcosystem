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

/**
 * 真人数字形象授权确认快照。
 *
 * <p>七牛 modelink 的 {@code active} 只是真人刷脸与同人一致性的技术证据；本表保存用户对
 * 平台业务条款的主动确认。最终 LIC 必须同时关联本表与 active 的 liveness 分组。
 */
@Entity
@Table(name = "dap_consent", indexes = {
        @Index(name = "idx_dap_consent_owner", columnList = "ownerUserId"),
        @Index(name = "idx_dap_consent_capture", columnList = "captureId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DapConsent {

    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(length = 32)
    private String avatarId;

    @Column(nullable = false, length = 32)
    private String captureId;

    @Column(nullable = false, length = 64)
    private String agreementVersion;

    @Column(nullable = false, length = 160)
    private String agreementTitle;

    @Column(nullable = false, length = 64)
    private String agreementHash;

    /** 用户实际确认的完整正文快照；不能只依赖未来可能变化的代码常量。 */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String agreementText;

    @Column(nullable = false, length = 512)
    private String scope;

    @Builder.Default
    private int periodMonths = 24;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private List<String> platforms = new ArrayList<>();

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private List<String> processors = new ArrayList<>();

    @Column(length = 64)
    private String clientIp;

    @Column(length = 512)
    private String clientUserAgent;

    @Column(nullable = false)
    private Instant acceptedAt;

    @Column(nullable = false)
    private Instant createdAt;
}
