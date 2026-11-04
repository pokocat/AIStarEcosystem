package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.model.DapJob;
import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.enterprise.service.EnterpriseBillingService;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Who pays for a digital-asset creation. Paid DAP requests name it in the {@code X-Aep-Billing} header
 * ({@code personal} or {@code enterprise:<id>}), the one payer chooser every Studio feature uses; no header pays
 * personally, as before enterprise credits existed. A job keeps its payer in its payload, so a retry pays the same way.
 */
public final class DapPayer {
    public static final String HEADER = "X-Aep-Billing";
    static final String PAYLOAD = "_billing";

    private DapPayer() {}

    /** The payer this request names; personal when it names none or there is no request (scheduled work). */
    public static BillingSelection requested() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) return personal();
        return parse(attrs.getRequest().getHeader(HEADER));
    }

    static BillingSelection parse(String header) {
        if (header == null || header.isBlank() || "personal".equals(header.trim())) return personal();
        String value = header.trim();
        // normalize() rejects anything else with BILLING_SELECTION_INVALID, so a typo never falls back to personal.
        return EnterpriseBillingService.normalize(value.startsWith("enterprise:")
                ? new BillingSelection("enterprise", value.substring("enterprise:".length()))
                : new BillingSelection(value, null));
    }

    static BillingSelection of(DapJob job) {
        Object value = job.getPayload() == null ? null : job.getPayload().get(PAYLOAD);
        if (value instanceof Map<?, ?> map && "enterprise".equals(map.get("mode")) && map.get("enterpriseId") instanceof String id)
            return new BillingSelection("enterprise", id);
        return personal();
    }

    static void remember(DapJob job, BillingSelection payer) {
        if (!EnterpriseBillingService.enterprise(payer)) return;
        var payload = new LinkedHashMap<>(job.getPayload() == null ? Map.of() : job.getPayload());
        payload.put(PAYLOAD, Map.of("mode", "enterprise", "enterpriseId", payer.enterpriseId()));
        job.setPayload(payload);
    }

    private static BillingSelection personal() { return new BillingSelection("personal", null); }
}
