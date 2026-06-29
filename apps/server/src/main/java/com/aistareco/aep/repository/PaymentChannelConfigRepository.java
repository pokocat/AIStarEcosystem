package com.aistareco.aep.repository;

import com.aistareco.aep.model.PaymentChannelConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 支付渠道配置仓库（v0.94）。
 */
public interface PaymentChannelConfigRepository extends JpaRepository<PaymentChannelConfig, String> {

    List<PaymentChannelConfig> findByEnabledTrueOrderBySortOrderAsc();

    List<PaymentChannelConfig> findAllByOrderBySortOrderAsc();
}
