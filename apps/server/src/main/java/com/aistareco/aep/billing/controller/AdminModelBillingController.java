package com.aistareco.aep.billing.controller;

import com.aistareco.aep.billing.dto.ModelBillingDtos.*;
import com.aistareco.aep.billing.service.ModelBillingConfigService;
import com.aistareco.aep.billing.service.ModelBillingConfigService.*;
import com.aistareco.aep.billing.service.ModelBillingQueryService;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController
@RequestMapping("/api/admin/model-billing")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','OPERATOR','FINANCE_ADMIN')")
public class AdminModelBillingController {
    private final ModelBillingConfigService config;
    private final ModelBillingQueryService query;
    private final com.aistareco.aep.billing.service.ModelBillingAdminCatalog catalog;
    public AdminModelBillingController(ModelBillingConfigService config,ModelBillingQueryService query,com.aistareco.aep.billing.service.ModelBillingAdminCatalog catalog){this.config=config;this.query=query;this.catalog=catalog;}
    @GetMapping("/targets") public ApiResponse<java.util.List<TargetOption>> targets(){return ApiResponse.of(catalog.targets());}
    @GetMapping("/user-options") public PageEnvelope<UserOption> users(@RequestParam(required=false) String q,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return PageEnvelope.from(catalog.users(q,page(page,size)));}
    @GetMapping("/wallet-options") public PageEnvelope<WalletOption> wallets(@RequestParam(required=false) String q,@RequestParam(required=false) String accountType,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return PageEnvelope.from(catalog.wallets(q,accountType,page(page,size)));}
    @GetMapping("/enterprise-options") public PageEnvelope<EnterpriseOption> enterprises(@RequestParam(required=false) String q,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return PageEnvelope.from(catalog.enterprises(q,page(page,size)));}
    @GetMapping("/prices") public PageEnvelope<Price> prices(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return PageEnvelope.from(query.prices(page(page,size)));
    }
    @PostMapping("/prices") @PreAuthorize("hasAnyRole('SUPER_ADMIN','OPERATOR')")
    public ApiResponse<Price> createPrice(@RequestBody PriceInput input,Principal actor){return ApiResponse.of(query.price(config.savePrice(null,input,actor.getName())));}
    @PutMapping("/prices/{id}") @PreAuthorize("hasAnyRole('SUPER_ADMIN','OPERATOR')")
    public ApiResponse<Price> updatePrice(@PathVariable String id,@RequestBody PriceInput input,Principal actor){return ApiResponse.of(query.price(config.savePrice(id,input,actor.getName())));}
    @GetMapping("/discounts") public PageEnvelope<Discount> discounts(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return PageEnvelope.from(query.discounts(page(page,size)));
    }
    @PostMapping("/discounts") @PreAuthorize("hasAnyRole('SUPER_ADMIN','OPERATOR')")
    public ApiResponse<Discount> createDiscount(@RequestBody DiscountInput input,Principal actor){return ApiResponse.of(query.discount(config.saveDiscount(null,input,actor.getName())));}
    @PutMapping("/discounts/{id}") @PreAuthorize("hasAnyRole('SUPER_ADMIN','OPERATOR')")
    public ApiResponse<Discount> updateDiscount(@PathVariable String id,@RequestBody DiscountInput input,Principal actor){return ApiResponse.of(query.discount(config.saveDiscount(id,input,actor.getName())));}
    @GetMapping("/campaigns") public PageEnvelope<Campaign> campaigns(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return PageEnvelope.from(query.campaigns(page(page,size)));
    }
    @PostMapping("/campaigns") @PreAuthorize("hasAnyRole('SUPER_ADMIN','OPERATOR')")
    public ApiResponse<Campaign> createCampaign(@RequestBody CampaignInput input,Principal actor){return ApiResponse.of(query.campaign(config.saveCampaign(null,input,actor.getName())));}
    @PutMapping("/campaigns/{id}") @PreAuthorize("hasAnyRole('SUPER_ADMIN','OPERATOR')")
    public ApiResponse<Campaign> updateCampaign(@PathVariable String id,@RequestBody CampaignInput input,Principal actor){return ApiResponse.of(query.campaign(config.saveCampaign(id,input,actor.getName())));}
    @GetMapping("/grants") public PageEnvelope<Grant> grants(@RequestParam String walletId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return PageEnvelope.from(query.grants(walletId,page(page,size)));
    }
    private static Pageable page(int page,int size){return PageRequest.of(Math.max(0,page),Math.max(1,Math.min(size,100)),Sort.by("id"));}
}
