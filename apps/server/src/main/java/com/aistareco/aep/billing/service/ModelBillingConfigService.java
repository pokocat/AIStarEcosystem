package com.aistareco.aep.billing.service;

import com.aistareco.aep.billing.model.*;
import com.aistareco.aep.billing.repository.*;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/** Validated operations configuration. Controllers enforce staff permissions; prices never alter procurement. */
@Service
public class ModelBillingConfigService {
    private final ModelPriceRepository prices;
    private final ModelDiscountRepository discounts;
    private final CreditCampaignRepository campaigns;
    private final CreditGrantRepository grants;
    private final AiModelEndpointRepository endpoints;
    private final ObjectMapper mapper;
    private final EntityManager em;
    private final com.aistareco.aep.repository.AuditLogRepository audits;
    private final com.aistareco.aep.repository.AepUserRepository users;
    private final com.aistareco.aep.enterprise.repository.EnterpriseRepository enterprises;
    private final com.aistareco.aep.service.materialvideo.MaterialVideoModelClient videos;

    public ModelBillingConfigService(ModelPriceRepository prices,ModelDiscountRepository discounts,
            CreditCampaignRepository campaigns,CreditGrantRepository grants,AiModelEndpointRepository endpoints,
            ObjectMapper mapper,EntityManager em,com.aistareco.aep.repository.AuditLogRepository audits,
            com.aistareco.aep.repository.AepUserRepository users,com.aistareco.aep.enterprise.repository.EnterpriseRepository enterprises,
            com.aistareco.aep.service.materialvideo.MaterialVideoModelClient videos) {
        this.prices=prices;this.discounts=discounts;this.campaigns=campaigns;this.grants=grants;
        this.endpoints=endpoints;this.mapper=mapper;this.em=em;this.audits=audits;
        this.users=users;this.enterprises=enterprises;this.videos=videos;
    }
    public record PriceInput(String name,ModelBillingTarget target,BigDecimal unitPrice,BigDecimal outputUnitPrice,
                             boolean active,Long expectedVersion) {}
    public record DiscountInput(String name,ModelBillingTarget target,String audience,String audienceId,BigDecimal factor,
                                boolean allowGrants,Instant startsAt,Instant expiresAt,boolean active,Long expectedVersion) {}
    public record CampaignInput(String name,List<ModelBillingTarget> targets,long totalIssueLimit,long perWalletIssueLimit,
                                BigDecimal resourceLimit,BigDecimal perWalletDailyResourceLimit,int maxConcurrentPerWallet,
                                Instant startsAt,Instant expiresAt,boolean active,Long expectedVersion) {}

    @Transactional
    public ModelPrice savePrice(String id,PriceInput input,String actor) {
        throw bad("MODEL_PRICE_USE_ENDPOINT_CONFIG","请在现有模型接入点及其价格配置中修改售价，这里只管理赠款和折扣");
    }

    @Transactional
    public ModelDiscount saveDiscount(String id,DiscountInput input,String actor) {
        if(input==null)throw bad("MODEL_CONFIG_REQUIRED","缺少优惠配置");
        name(input.name());validateTarget(input.target());window(input.startsAt(),input.expiresAt());
        BigDecimal factor=ModelBillingMath.factor(input.factor());
        if(input.audience()==null || !Set.of("all","user","enterprise").contains(input.audience()))throw bad("MODEL_DISCOUNT_AUDIENCE_INVALID","请选择优惠对象");
        if("all".equals(input.audience())?input.audienceId()!=null&&!input.audienceId().isBlank():input.audienceId()==null||input.audienceId().isBlank()||input.audienceId().length()>64)
            throw bad("MODEL_DISCOUNT_AUDIENCE_INVALID","优惠对象与所选范围不一致");
        if("user".equals(input.audience())&&!users.existsById(input.audienceId())
                ||"enterprise".equals(input.audience())&&!enterprises.existsById(input.audienceId()))
            throw bad("MODEL_DISCOUNT_AUDIENCE_INVALID","优惠对象不存在，请重新选择");
        var row=id==null?new ModelDiscount():discounts.lockById(id).orElseThrow(()->notFound("优惠"));
        if(id!=null){em.refresh(row,LockModeType.PESSIMISTIC_WRITE);version(row.getVersion(),input.expectedVersion());}
        row.setId(id==null?UUID.randomUUID().toString():id);row.setName(input.name());row.setTargetKey(input.target().endpointKey());row.setTargetJson(json(input.target()));
        row.setAudience(input.audience());row.setAudienceId("all".equals(input.audience())?null:input.audienceId());row.setFactor(factor);
        row.setAllowGrants(true);row.setStartsAt(input.startsAt());row.setExpiresAt(input.expiresAt());row.setActive(input.active());
        row.setUpdatedAt(Instant.now());row.setUpdatedBy(actor);var saved=discounts.saveAndFlush(row);audit("discount",saved.getId(),actor,input,saved.getVersion());return saved;
    }

    @Transactional
    public CreditCampaign saveCampaign(String id,CampaignInput input,String actor) {
        if(input==null)throw bad("MODEL_CONFIG_REQUIRED","缺少活动配置");
        name(input.name());window(input.startsAt(),input.expiresAt());
        if(input.targets()==null || input.targets().isEmpty() || input.targets().size()>100)throw bad("SCOPED_TARGETS_INVALID","请选择 1 至 100 个适用模型接入点");
        input.targets().forEach(this::validateTarget);
        String unit="credit";
        if(input.targets().stream().map(ModelBillingTarget::endpointId).distinct().count()!=input.targets().size())
            throw bad("SCOPED_TARGETS_INVALID","不能重复选择同一个模型接入点");
        if(input.totalIssueLimit()<=0 || input.totalIssueLimit()>ModelBillingMath.MAX_CREDITS || input.perWalletIssueLimit()<=0
                || input.perWalletIssueLimit()>input.totalIssueLimit())
            throw bad("SCOPED_LIMIT_INVALID","请设置有效的发放总额度和单账户额度");
        var limit=BigDecimal.valueOf(input.totalIssueLimit());
        var daily=BigDecimal.valueOf(input.perWalletIssueLimit());
        var row=id==null?new CreditCampaign():campaigns.lockById(id).orElseThrow(()->notFound("活动"));
        if(id!=null) {
            em.refresh(row,LockModeType.PESSIMISTIC_WRITE);version(row.getVersion(),input.expectedVersion());
            if(input.totalIssueLimit()<row.getIssued() || limit.compareTo(row.getResourceReserved().add(row.getResourceUsed()))<0)
                throw bad("SCOPED_LIMIT_BELOW_USED","新限额不能低于已发放或已使用和预占的资源");
            if(row.getIssued()>0 && (!unit.equals(row.getResourceUnit()) || input.expiresAt().isBefore(row.getExpiresAt())))
                throw bad("SCOPED_CAMPAIGN_IMMUTABLE","这个活动已经发过赠款，不能缩短有效期，也不能改计量方式。要停止使用可以停用活动");
            // Issued grants follow their campaign's targets, so changing them would silently re-scope every recipient's balance.
            if(row.getIssued()>0 && !storedEndpointIds(row.getTargetsJson()).equals(endpointIds(input.targets())))
                throw bad("SCOPED_CAMPAIGN_TARGETS_LOCKED","这个活动已经发过赠款，适用模型不能再改。要换模型请停用它，再新建一个活动");
        }
        row.setId(id==null?UUID.randomUUID().toString():id);row.setName(input.name());row.setTargetsJson(json(input.targets()));row.setResourceUnit(unit);
        row.setTotalIssueLimit(input.totalIssueLimit());row.setPerWalletIssueLimit(input.perWalletIssueLimit());row.setResourceLimit(limit);
        row.setPerWalletDailyResourceLimit(daily);row.setMaxConcurrentPerWallet(100);row.setStartsAt(input.startsAt());row.setExpiresAt(input.expiresAt());row.setActive(input.active());
        row.setUpdatedAt(Instant.now());row.setUpdatedBy(actor);var saved=campaigns.saveAndFlush(row);audit("campaign",saved.getId(),actor,input,saved.getVersion());return saved;
    }
    private static Set<String> endpointIds(List<ModelBillingTarget> targets) {
        return targets.stream().map(ModelBillingTarget::endpointId).collect(java.util.stream.Collectors.toSet());
    }
    private Set<String> storedEndpointIds(String json) {
        try{return endpointIds(mapper.readValue(json,new com.fasterxml.jackson.core.type.TypeReference<List<ModelBillingTarget>>(){}));}
        catch(Exception e){throw new IllegalStateException("Invalid campaign targets",e);}
    }
    public ModelBillingTarget target(String json) {
        try{return mapper.readValue(json,ModelBillingTarget.class);}catch(Exception e){throw new IllegalStateException("Invalid model billing target",e);}
    }
    private void validateTarget(ModelBillingTarget target) {
        if(target==null)throw bad("MODEL_BILLING_TARGET_INVALID","请选择模型接入点");
        if(!endpoints.existsById(target.endpointId()))
            throw bad("MODEL_BILLING_TARGET_INVALID","所选模型接入点不存在，请重新选择");
    }
    private void audit(String kind,String id,String actor,Object input,long version) {
        if(actor==null || actor.isBlank())throw bad("MODEL_CONFIG_ACTOR_REQUIRED","缺少配置操作人");
        audits.save(com.aistareco.aep.model.AuditLog.builder().id(UUID.randomUUID().toString()).userId(actor).appCode("admin")
                .action("model_billing."+kind+".save").resourceType("model_billing_"+kind).resourceId(id)
                .result(com.aistareco.aep.model.AuditLog.AuditResult.SUCCESS).detail(json(Map.of("config",input,"version",version)))
                .createdAt(Instant.now()).build());
    }
    private String json(Object value){try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
    private static void name(String name){if(name==null || name.isBlank() || name.length()>128)throw bad("MODEL_CONFIG_NAME_INVALID","请填写不超过 128 字的名称");}
    private static void window(Instant from,Instant until){if(from==null || until==null || !until.isAfter(from))throw bad("MODEL_CONFIG_WINDOW_INVALID","结束时间应晚于开始时间");}
    private static void version(long actual,Long expected){if(expected==null || actual!=expected)throw new BusinessException(HttpStatus.CONFLICT,"MODEL_CONFIG_VERSION_CONFLICT","配置已变更，请刷新后重新编辑");}
    private static BusinessException notFound(String name){return new BusinessException(HttpStatus.NOT_FOUND,"MODEL_CONFIG_NOT_FOUND",name+"不存在");}
    private static BusinessException bad(String code,String message){return BusinessException.badRequest(code,message);}
}
