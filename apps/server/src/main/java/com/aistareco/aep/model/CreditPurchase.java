package com.aistareco.aep.model;

import com.aistareco.common.JsonMapConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.Map;

/**
 * 用户购买积分包的历史记录。
 * 仅作订单凭证；实际余额变更在 {@link Wallet}，流水在 {@link LedgerEntry}。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_credit_purchases")
public class CreditPurchase {

    @Id
    private String id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String packId;

    private long priceCents;

    private long creditsAdded;

    private Instant createdAt;

    /** 支付渠道元信息（渠道 id、交易号、风控结果等），结构随渠道演进。 */
    @Column(name = "payment_meta_json", columnDefinition = "LONGTEXT")
    @Convert(converter = JsonMapConverter.class)
    private Map<String, Object> paymentMetaJson;
}
