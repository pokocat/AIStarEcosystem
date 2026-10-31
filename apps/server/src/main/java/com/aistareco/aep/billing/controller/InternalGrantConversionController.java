package com.aistareco.aep.billing.controller;

import com.aistareco.aep.billing.repository.CreditCampaignRepository;
import com.aistareco.aep.billing.service.ModelBillingAdminCatalog;
import com.aistareco.aep.billing.service.ModelBillingConfigService;
import com.aistareco.aep.billing.service.ModelGrantConversionService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * One-off operator entry for converting customers' gift credits into a model grant without an admin login
 * (2026-10-26, the user asked Claude to run the conversion directly on the server).
 *
 * Only callable on the box itself: X-Internal-Secret (InternalAuthFilter) and no proxy headers, since nginx adds them
 * to every outside request. The money path is the same {@link ModelGrantConversionService} the admin page uses, so the
 * ledger, idempotency and per-customer rollback rules are unchanged. Remove once the conversion is done.
 */
@RestController
@RequestMapping("/api/internal/ops/grant-conversion")
public class InternalGrantConversionController {
    private final ModelGrantConversionService conversions;
    private final ModelBillingConfigService config;
    private final ModelBillingAdminCatalog catalog;
    private final CreditCampaignRepository campaigns;

    public InternalGrantConversionController(ModelGrantConversionService conversions, ModelBillingConfigService config,
                                             ModelBillingAdminCatalog catalog, CreditCampaignRepository campaigns) {
        this.conversions = conversions; this.config = config; this.catalog = catalog; this.campaigns = campaigns;
    }

    public record PreviewInput(int days, long keep) {}
    public record RunInput(String requestId, String actorAdminId, String endpointId, String campaignName,
                           int days, long keep, int validDays, String reason) {}

    @PostMapping("/preview")
    public ApiResponse<List<ModelGrantConversionService.Line>> preview(@RequestBody PreviewInput input, HttpServletRequest http) {
        localOnly(http);
        return ApiResponse.of(conversions.candidates(input.days(), input.keep()));
    }

    /** Creates the campaign on first call (reused by name on retry), then converts every candidate with something to convert. */
    @PostMapping("/run")
    public ApiResponse<Map<String, Object>> run(@RequestBody RunInput input, HttpServletRequest http) {
        localOnly(http);
        if (input.campaignName() == null || input.campaignName().isBlank())
            throw BusinessException.badRequest("GRANT_CONVERSION_INVALID", "缺少赠款活动名称");
        var lines = conversions.candidates(input.days(), input.keep());
        var userIds = lines.stream().filter(l -> l.amount() > 0).map(ModelGrantConversionService.Line::userId).toList();
        if (userIds.isEmpty()) throw BusinessException.badRequest("GRANT_CONVERSION_EMPTY", "没有需要转换的客户");
        long total = lines.stream().mapToLong(ModelGrantConversionService.Line::amount).sum();
        long perWallet = lines.stream().mapToLong(ModelGrantConversionService.Line::amount).max().orElse(0);
        var campaign = campaigns.findAll().stream().filter(c -> input.campaignName().equals(c.getName())).findFirst()
                .orElseGet(() -> {
                    var target = catalog.targets().stream().filter(t -> input.endpointId().equals(t.target().endpointId()))
                            .findFirst().orElseThrow(() -> BusinessException.badRequest("GRANT_CONVERSION_INVALID", "找不到这个模型接入点"));
                    var now = Instant.now();
                    // Headroom so a customer topped up between preview and run still fits; unused limit grants nothing.
                    return config.saveCampaign(null, new ModelBillingConfigService.CampaignInput(input.campaignName(),
                            List.of(target.target()), total * 2, Math.max(perWallet * 2, 1), null, null, 100,
                            now, now.plus(Duration.ofDays(input.validDays())).plus(Duration.ofHours(1)), true, null),
                            input.actorAdminId());
                });
        var result = conversions.execute(new ModelGrantConversionService.Request(input.requestId(), campaign.getId(),
                input.keep(), input.validDays(), userIds, input.reason()), input.actorAdminId());
        return ApiResponse.of(Map.of("campaignId", campaign.getId(), "lines", result));
    }

    private static void localOnly(HttpServletRequest http) {
        String addr = http.getRemoteAddr();
        boolean loopback = "127.0.0.1".equals(addr) || "0:0:0:0:0:0:0:1".equals(addr) || "::1".equals(addr);
        if (!loopback || http.getHeader("X-Forwarded-For") != null || http.getHeader("X-Real-IP") != null)
            throw new BusinessException(org.springframework.http.HttpStatus.FORBIDDEN, "GRANT_CONVERSION_LOCAL_ONLY", "只能在服务器本机调用");
    }
}
