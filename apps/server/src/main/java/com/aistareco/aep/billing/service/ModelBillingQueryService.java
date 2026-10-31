package com.aistareco.aep.billing.service;

import com.aistareco.aep.billing.dto.ModelBillingDtos.*;
import com.aistareco.aep.billing.model.*;
import com.aistareco.aep.billing.repository.*;
import com.aistareco.aep.enterprise.service.EnterpriseAccessService;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.repository.WalletRepository;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;

@Service
@Transactional(readOnly=true)
public class ModelBillingQueryService {
    private final ModelPriceRepository prices;
    private final ModelDiscountRepository discounts;
    private final CreditCampaignRepository campaigns;
    private final CreditGrantRepository grants;
    private final ModelBillingConfigService config;
    private final ScopedCreditService scoped;
    private final WalletRepository wallets;
    private final EnterpriseAccessService access;
    private final AiModelEndpointRepository endpoints;
    private final com.aistareco.aep.repository.AepUserRepository users;
    private final com.aistareco.aep.enterprise.repository.EnterpriseRepository enterprises;
    public ModelBillingQueryService(ModelPriceRepository prices,ModelDiscountRepository discounts,CreditCampaignRepository campaigns,
            CreditGrantRepository grants,ModelBillingConfigService config,ScopedCreditService scoped,WalletRepository wallets,
            EnterpriseAccessService access,AiModelEndpointRepository endpoints,com.aistareco.aep.repository.AepUserRepository users,
            com.aistareco.aep.enterprise.repository.EnterpriseRepository enterprises) {
        this.prices=prices;this.discounts=discounts;this.campaigns=campaigns;this.grants=grants;this.config=config;
        this.scoped=scoped;this.wallets=wallets;this.access=access;this.endpoints=endpoints;
        this.users=users;this.enterprises=enterprises;
    }
    public Page<Price> prices(Pageable page){return prices.findAll(page).map(this::price);}
    public Page<Discount> discounts(Pageable page){return discounts.findAll(page).map(this::discount);}
    public Page<Campaign> campaigns(Pageable page){return campaigns.findAll(page).map(this::campaign);}
    public Page<Grant> grants(String wallet,Pageable page){return grants.findByWalletId(wallet,page).map(this::grant);}
    public Page<Grant> mine(String actor,String enterpriseId,Pageable page) {
        if(enterpriseId==null || enterpriseId.isBlank())
            return wallets.findByUserId(actor).map(w->grants(w.getId(),page)).orElseGet(()->Page.empty(page));
        access.readMember(actor,enterpriseId);
        return wallets.findByAccountKey("enterprise_member:"+enterpriseId+":"+actor)
                .map(w->grants(w.getId(),page)).orElseGet(()->Page.empty(page));
    }
    public Price price(ModelPrice row){return new Price(row.getId(),row.getName(),config.target(row.getTargetJson()),
            row.getUnitPrice(),row.getOutputUnitPrice(),row.isActive(),row.getVersion(),row.getUpdatedAt());}
    public Discount discount(ModelDiscount row){return new Discount(row.getId(),row.getName(),config.target(row.getTargetJson()),
            row.getAudience(),row.getAudienceId(),row.getFactor(),row.isAllowGrants(),row.getStartsAt(),row.getExpiresAt(),row.isActive(),row.getVersion(),row.getUpdatedAt(),audienceLabel(row));}
    private String audienceLabel(ModelDiscount row) {
        if("user".equals(row.getAudience()))return users.findById(row.getAudienceId()).map(u->u.getDisplayName()==null?u.getUsername():u.getDisplayName()).orElse("已删除账号");
        if("enterprise".equals(row.getAudience()))return enterprises.findById(row.getAudienceId()).map(e->e.getName()).orElse("已删除企业");
        return "所有客户";
    }
    public Campaign campaign(CreditCampaign row){return new Campaign(row.getId(),row.getName(),scoped.targets(row),row.getTotalIssueLimit(),
            row.getPerWalletIssueLimit(),row.getResourceLimit(),row.getPerWalletDailyResourceLimit(),row.getMaxConcurrentPerWallet(),row.getStartsAt(),
            row.getExpiresAt(),row.isActive(),row.getVersion(),row.getIssued(),row.getResourceReserved(),row.getResourceUsed(),row.getUpdatedAt());}
    public Grant grant(CreditGrant row) {
        var campaign=campaigns.findById(row.getCampaignId()).orElseThrow();var targets=scoped.targets(campaign);var now=Instant.now();
        var labels=targets.stream().map(t->endpoints.findById(t.endpointId()).map(e->e.publicModelName()).orElse("已下线模型")).distinct().toList();
        boolean active=campaign.isActive() && !now.isBefore(campaign.getStartsAt()) && now.isBefore(campaign.getExpiresAt());
        return new Grant(row.getId(),row.getWalletId(),row.getCampaignId(),campaign.getName(),targets,labels,active,row.getAmount(),
                row.getAvailable(),row.getFrozen(),row.getSpent(),row.getExpired(),row.getExpiresAt(),row.getCreatedAt());
    }
}
