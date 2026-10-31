package com.aistareco.aep.dap.service;

import com.aistareco.aep.billing.service.*;
import com.aistareco.aep.dap.model.DapJob;
import com.aistareco.aep.dap.repository.DapJobRepository;
import com.aistareco.aep.dap.repository.DapLookRepository;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiChatTokenPricing;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/** Two ordinary model charges: text usage and image/video production. Promotions stay in CreditService. */
@Service
public class DapModelBilling {
    static final String PLAN="_modelBilling", USAGE="_modelTextUsage";
    private static final ThreadLocal<Execution> CURRENT=new ThreadLocal<>();
    private final AiModelInvocationService models;
    private final AiChatTokenPricing tokenPricing;
    private final CreditService credits;
    private final DapJobRepository jobs;
    private final DapLookRepository looks;
    private final DapCatalogService catalog;
    private final ObjectMapper json;

    public DapModelBilling(AiModelInvocationService models,AiChatTokenPricing tokenPricing,CreditService credits,
                           DapJobRepository jobs,DapLookRepository looks,DapCatalogService catalog,ObjectMapper json) {
        this.models=models;this.tokenPricing=tokenPricing;this.credits=credits;this.jobs=jobs;
        this.looks=looks;this.catalog=catalog;this.json=json;
    }

    public record Route(ModelChargeContext charge,String baseUrl) {}
    public record Plan(Route primary,Route text,AiChatTokenPricing.Rate textRate,long primaryCredits) {}
    public record Usage(long input,long output) {}
    public interface Scope extends AutoCloseable { @Override void close(); }

    /** Caller owns the job-creation transaction, so both holds and the job appear together. */
    @Transactional
    public void reserve(DapJob job,long primaryCredits) {
        boolean video=DapJob.T_DERIVE.equals(job.getType())&&"video".equals(payload(job).get("derivKey"));
        var accepted=plan(job);
        Route primary,text=null;AiChatTokenPricing.Rate rate=null;
        if(accepted!=null) {
            primary=accepted.primary();text=accepted.text();rate=accepted.textRate();primaryCredits=accepted.primaryCredits();
            requireAccepted(primary,video?AiModelPurpose.DAP_VIDEO:AiModelPurpose.DAP_IMAGE);
            if(text!=null)requireAccepted(text,AiModelPurpose.DAP_PERSONA);
        } else {
            var endpoint=endpoint(video?AiModelPurpose.DAP_VIDEO:AiModelPurpose.DAP_IMAGE);
            primary=new Route(ModelChargeContext.forCredits(endpoint,primaryCredits),endpoint.getBaseUrl());
        }
        if(accepted==null&&needsText(job)) {
            var chat=endpoint(AiModelPurpose.DAP_PERSONA);rate=tokenPricing.find(chat.getId());
            if(rate==null||rate.maxCost()<=0)throw unavailable("AI_TOKEN_PRICE_NOT_CONFIGURED","请在原模型价格配置中设置文本模型的 Token 售价");
            var context=ModelChargeContext.forCredits(chat,rate.maxCost());
            text=new Route(context,chat.getBaseUrl());
        }
        var plan=new Plan(primary,text,rate,primaryCredits);
        var payload=new LinkedHashMap<>(payload(job));payload.put(PLAN,json.convertValue(plan,Map.class));payload.remove(USAGE);payload.remove("_modelBillingFinished");job.setPayload(payload);
        String root=reference(job);
        credits.hold(job.getOwnerUserId(),primaryCredits,DapJobService.REF_TYPE,root+":media",job.getKind()+" · 媒体生成",primary.charge());
        if(text!=null)credits.hold(job.getOwnerUserId(),rate.maxCost(),DapJobService.REF_TYPE,root+":text",job.getKind()+" · 文本处理",text.charge());
        job.setCost(Math.addExact(primaryCredits,rate==null?0:rate.maxCost()));
    }

    public Plan plan(DapJob job) {
        Object value=payload(job).get(PLAN);
        return value==null?null:json.convertValue(value,Plan.class);
    }

    /** Bind only at the DAP runner boundary; Studio calls already have their own model charges. */
    public Scope open(DapJob job) {
        Execution previous=CURRENT.get();var plan=plan(job);
        if(plan==null)CURRENT.remove();else CURRENT.set(new Execution(job,plan));
        return ()->{if(previous==null)CURRENT.remove();else CURRENT.set(previous);};
    }

    static Execution current(){return CURRENT.get();}

    public final class Execution {
        private final DapJob job;private final Plan plan;
        Execution(DapJob job,Plan plan){this.job=job;this.plan=plan;}
        String endpointId(AiModelPurpose purpose) {return route(purpose).charge().target().endpointId();}
        void requireRoute(AiModelPurpose purpose,AiModelEndpoint endpoint) {
            var accepted=route(purpose);var target=accepted.charge().target();
            if(!Objects.equals(target.endpointId(),endpoint.getId())||!Objects.equals(target.providerModel(),ModelBillingTarget.providerModelOf(endpoint))
                    ||!Objects.equals(accepted.baseUrl(),endpoint.getBaseUrl()))
                throw unavailable("MODEL_BILLING_ROUTE_CHANGED","已受理任务的模型接入点已变化，请重新提交");
        }
        int outputLimit(int requested) {
            if(plan.textRate()==null)throw unavailable("AI_TOKEN_PRICE_NOT_CONFIGURED","此任务没有已定价的文本处理阶段");
            long left=plan.textRate().maxOutputTokens()-usage(job).output();
            if(left<=0)throw unavailable("AI_USAGE_LIMIT","文本处理已达到本次确认的用量上限");
            return (int)Math.min(requested,left);
        }
        void record(AiModelInvocationService.AiModelResponse response) {
            var before=usage(job);Long input=response.promptTokens(),output=response.completionTokens();
            if(input==null||output==null||input<0||output<0||input+output==0)
                throw unavailable("AI_USAGE_MISSING","文本模型未返回有效用量，本次文本调用未扣积分");
            var measured=new Usage(Math.addExact(before.input(),input),Math.addExact(before.output(),output));
            plan.textRate().settle(measured.input(),measured.output());
            var payload=new LinkedHashMap<>(payload(job));payload.put(USAGE,json.convertValue(measured,Map.class));job.setPayload(payload);jobs.save(job);
        }
        private Route route(AiModelPurpose purpose) {
            var route=purpose==AiModelPurpose.DAP_PERSONA?plan.text():plan.primary();
            if(route==null)throw unavailable("MODEL_BILLING_NOT_PREPARED","此任务未确认对应模型的费用，请重新提交");
            return route;
        }
    }

    /** Settled text survives a later image failure; each model releases only its own unused reservation. */
    @Transactional
    public boolean finish(DapJob job,boolean mediaSucceeded,String reason) {
        var plan=plan(job);if(plan==null)return false;
        if(Objects.equals(payload(job).get("_modelBillingFinished"),job.getRetryCount()))return true;
        String root=reference(job);
        if(plan.text()!=null) {
            var measured=usage(job);
            if(measured.input()+measured.output()>0) {
                long actual=plan.textRate().settle(measured.input(),measured.output());
                if(actual>0)credits.commitHold(DapJobService.REF_TYPE,root+":text",actual,job.getKind()+" · 文本处理完成",null);
            }
            credits.releaseHold(DapJobService.REF_TYPE,root+":text",job.getKind()+" · 释放未用文本额度");
        }
        if(mediaSucceeded)credits.commitHold(DapJobService.REF_TYPE,root+":media",plan.primaryCredits(),job.getKind()+" · 媒体生成完成",null);
        else credits.releaseHold(DapJobService.REF_TYPE,root+":media",job.getKind()+" · "+reason);
        var references=new ArrayList<String>();
        for(int i=0;i<=job.getRetryCount();i++){references.add(job.getId()+":r"+i+":text");references.add(job.getId()+":r"+i+":media");}
        references.removeIf(ref->credits.findHold(DapJobService.REF_TYPE,ref)==null);
        var receipt=credits.modelBillingBreakdown(DapJobService.REF_TYPE,references);
        if(receipt!=null) {
            job.setCost(receipt.displayedCost());
            var result=new LinkedHashMap<>(job.getResult()==null?Map.of():job.getResult());
            result.put("billingBreakdown",json.convertValue(receipt,Map.class));job.setResult(result);
        }
        var payload=new LinkedHashMap<>(payload(job));payload.put("_modelBillingFinished",job.getRetryCount());job.setPayload(payload);
        jobs.save(job);return true;
    }

    private static Map<String,Object> payload(DapJob job){return job.getPayload()==null?Map.of():job.getPayload();}
    private Usage usage(DapJob job){var value=payload(job).get(USAGE);return value==null?new Usage(0,0):json.convertValue(value,Usage.class);}
    private void requireAccepted(Route route,AiModelPurpose purpose) {
        var target=route.charge().target();
        var endpoint=models.resolveAcceptedEndpoint(purpose,target.endpointId(),"aiavatar")
                .orElseThrow(()->unavailable("MODEL_BILLING_ROUTE_CHANGED","原任务的模型接入点不可用，不能换模型重试")).endpoint();
        if(!Objects.equals(target.providerModel(),ModelBillingTarget.providerModelOf(endpoint))||!Objects.equals(route.baseUrl(),endpoint.getBaseUrl()))
            throw unavailable("MODEL_BILLING_ROUTE_CHANGED","原任务的模型配置已变化，请创建新任务");
    }
    private AiModelEndpoint endpoint(AiModelPurpose purpose){return models.resolveDefaultEndpoint(purpose,"aiavatar").orElseThrow(()->unavailable("DAP_ENGINE_NOT_CONFIGURED","请在后台为数字人用途绑定模型接入点"));}
    private boolean needsText(DapJob job) {
        if(DapJob.T_GENERATE.equals(job.getType())||DapJob.T_ITERATE.equals(job.getType()))return true;
        if(DapJob.T_LOOK.equals(job.getType())) {
            String id=String.valueOf(payload(job).getOrDefault("lookId",""));
            return looks.findById(id).map(look->catalog.scenePromptEn(look.getSceneId())==null&&look.getPrompt()!=null&&!look.getPrompt().isBlank()).orElse(false);
        }
        if(!DapJob.T_DERIVE.equals(job.getType()))return false;
        Object options=payload(job).get("options");
        if(!(options instanceof Map<?,?> map))return false;
        if(chinese(map.get("extraPrompt")))return true;
        if(map.get("items") instanceof List<?> items)return items.stream().anyMatch(item->item instanceof Map<?,?> entry&&chinese(entry.get("prompt")));
        return false;
    }
    private static boolean chinese(Object value){return value instanceof String text&&text.codePoints().anyMatch(c->c>=0x4E00&&c<=0x9FFF);}
    static String reference(DapJob job){return job.getId()+":r"+job.getRetryCount();}
    private static BusinessException unavailable(String code,String message){return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,code,message);}
}
