package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.enterprise.service.EnterpriseBillingService.BillingAccount;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import java.util.Objects;

/** Durable payer binding is internal; product resources remain owned by the requesting user. */
final class StudioRunBilling {
    private StudioRunBilling() {}
    static void apply(IpRun run, BillingAccount account) {
        if(account==null)return;
        run.setBillingWalletId(account.walletId());run.setEnterpriseId(account.enterpriseId());
        run.setMembershipId(account.membershipId());run.setBillingAuthorizationId(account.billingAuthorizationId());
    }
    static BillingSelection selection(IpRun run,com.fasterxml.jackson.databind.ObjectMapper mapper) {
        if(run.getEnterpriseId()!=null)return new BillingSelection("enterprise",run.getEnterpriseId());
        try {
            var input=mapper.readTree(run.getInputJson());
            var original=input.has("studioRequest")?input.path("studioRequest"):input;
            var billing=original.path("billing");
            if("personal".equals(billing.path("mode").asText()))return mapper.treeToValue(billing,BillingSelection.class);
        } catch(Exception ignored) { /* Legacy tasks omitted billing; preserve that omission on replay. */ }
        return null;
    }
    static void requireSamePayer(IpRun run,BillingSelection requested) {
        boolean enterprise=requested!=null&&"enterprise".equals(requested.mode());
        if(enterprise != (run.getEnterpriseId()!=null)
                || enterprise&&!Objects.equals(run.getEnterpriseId(),requested.enterpriseId()))
            throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_REQUEST_CHANGED","同一请求的付款账户已改变，请重新提交");
    }
}
