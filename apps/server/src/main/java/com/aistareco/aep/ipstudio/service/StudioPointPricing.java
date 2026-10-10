package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;

/** Supplier points are separate from endpoint unitPriceMicros (which measures money). */
@Service
public class StudioPointPricing {
    public static final String KEY = "ipstudio.supplier-point-pricing";
    private final PlatformConfigService configs;
    public StudioPointPricing(PlatformConfigService configs) { this.configs = configs; }
    public boolean enabled() { return configs.findByKey(KEY).isPresent(); }
    public Rate find(String endpointId) {
        var config = configs.findByKey(KEY).orElse(null);
        if (config == null) return null; // Accepted legacy local pricing remains readable.
        JsonNode value = config.value(), cost = value.path("endpointCosts").path(endpointId);
        if (!cost.isNumber() || cost.decimalValue().signum() < 0) return null;
        JsonNode ratio = value.path("supplierToPlatformRatio"), markup = value.path("markupPercent");
        if (!ratio.isNumber() || ratio.decimalValue().signum() <= 0 || !markup.isNumber() || markup.decimalValue().signum() < 0)
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "STUDIO_POINT_PRICING_INVALID", "模型积分换算尚未正确配置");
        return new Rate(cost.decimalValue(), ratio.decimalValue(), BigDecimal.ONE.add(markup.decimalValue().movePointLeft(2)));
    }
    public record Rate(BigDecimal supplierPointsPerSecond, BigDecimal supplierToPlatformRatio, BigDecimal markupMultiplier) {
        public BigDecimal platformPointsPerSecond() { return supplierPointsPerSecond.multiply(supplierToPlatformRatio).multiply(markupMultiplier); }
        public long cost(long seconds) { return platformPointsPerSecond().multiply(BigDecimal.valueOf(seconds)).setScale(0, RoundingMode.CEILING).longValueExact(); }
        public static Rate fromSnapshot(JsonNode node) {
            return new Rate(node.path("supplierPointsPerSecond").decimalValue(), node.path("supplierToPlatformRatio").decimalValue(), node.path("markupMultiplier").decimalValue());
        }
    }
    /** Reservation is a visible spending ceiling, not a claimed duration prediction. */
    public static long speechReservationSeconds(String text) { return Math.min(600, Math.max(10, text.codePointCount(0, text.length()) + 10L)); }
}
