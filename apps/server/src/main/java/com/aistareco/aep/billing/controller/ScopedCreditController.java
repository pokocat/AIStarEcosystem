package com.aistareco.aep.billing.controller;

import com.aistareco.aep.billing.dto.ModelBillingDtos.Grant;
import com.aistareco.aep.billing.service.ModelBillingQueryService;
import com.aistareco.aep.dto.PageEnvelope;
import org.springframework.data.domain.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController
@RequestMapping("/api/me/model-credits")
@PreAuthorize("isAuthenticated()")
public class ScopedCreditController {
    private final ModelBillingQueryService query;
    public ScopedCreditController(ModelBillingQueryService query){this.query=query;}
    @GetMapping public PageEnvelope<Grant> mine(Principal actor,@RequestParam(required=false) String enterpriseId,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return PageEnvelope.from(query.mine(actor.getName(),enterpriseId,PageRequest.of(Math.max(0,page),Math.max(1,Math.min(size,100)),Sort.by(Sort.Order.desc("expiresAt"),Sort.Order.asc("id")))));
    }
}
