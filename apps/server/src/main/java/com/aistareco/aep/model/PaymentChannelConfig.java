package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 支付渠道运行时配置（v0.94 多渠道直连）。一行 = 一个收银台渠道（alipay / wechat …）。
 *
 * <p>取代「env 固定单一 driver + @ConditionalOnProperty 启动选 bean」的老做法：渠道启用 + 机密
 * 改为 admin 后台「支付配置」DB 运行时可配，多渠道并存、用户收银台自选。env 仅在 DB 尚无配置时
 * 作 bootstrap 种子（{@code PaymentChannelSeeder}）。
 *
 * <p>机密（appId / 私钥 / 公钥 / apiKey / 证书…）以 AES-GCM 加密整块 JSON 存 {@code credsEncrypted}
 * （照 AiModelEndpoint.apiKey 范式，密钥 {@code AEP_SECRET_KEY}）；出 wire 一律脱敏，绝不明文返回。
 * §8.0：渠道启用但机密缺失 → 下单期抛 503，不静默回退 shadow。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_payment_channels")
public class PaymentChannelConfig {

    /** 渠道代码（主键）：alipay / wechat。与 PaymentGateway.driverName() 对齐。 */
    @Id
    @Column(length = 32)
    private String code;

    /** 是否启用（收银台是否列出 + 是否允许下单）。 */
    private boolean enabled;

    /** 沙箱标识（仅日志 / 提示；真正环境切换靠各渠道的 gatewayHost / baseUrl）。 */
    private boolean sandbox;

    /** 收银台展示名（如「支付宝」「微信支付」）。 */
    @Column(length = 64)
    private String label;

    /** 收银台排序（小在前）。 */
    private int sortOrder;

    /** 默认支付方式 wayCode（alipay→ALI_PC / wechat→WX_NATIVE）。 */
    @Column(length = 32)
    private String defaultWayCode;

    /** 渠道机密：AES-GCM 加密后的 JSON 对象（字段随渠道而异）。绝不出 wire。 */
    @Column(name = "creds_encrypted", columnDefinition = "LONGTEXT")
    private String credsEncrypted;

    /** 每次更新自增；网关据此判断是否需要重新 init SDK（避免每次下单都重配）。 */
    private int version;

    private Instant updatedAt;

    /** 最后修改者（adminUserId / system / seed）。 */
    @Column(length = 64)
    private String updatedBy;
}
