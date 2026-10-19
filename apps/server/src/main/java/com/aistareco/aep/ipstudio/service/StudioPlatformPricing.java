package com.aistareco.aep.ipstudio.service;

import cn.aibuzz.platform.PlatformPricingClient;
import cn.aibuzz.platform.PlatformPricingClient.PricingException;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.math.BigDecimal;
import java.util.Arrays;

/** Maps platform prices to the application; CreditService still owns the wallet. */
@Service
public class StudioPlatformPricing {
    private static final Logger log=LoggerFactory.getLogger(StudioPlatformPricing.class);
    private final PlatformPricingClient client;private final String brandId,appCode;
    private final IpRunRepository runs;private final ObjectMapper json;private final TransactionTemplate tx;
    public StudioPlatformPricing(@Value("${aep.studio.platform-pricing.enabled:false}") boolean enabled,
            @Value("${aep.studio.platform-pricing.base-url:}") String url,
            @Value("${aep.studio.platform-pricing.credential:}") String credential,
            @Value("${aep.studio.platform-pricing.brand-id:}") String brandId,
            @Value("${aep.studio.platform-pricing.app-code:aistar-aiavatar}") String appCode,
            @Value("${aep.studio.platform-pricing.allow-local:false}") boolean allowLocal,
            Environment env,IpRunRepository runs,ObjectMapper json,PlatformTransactionManager manager) {
        this.brandId=brandId;this.appCode=appCode;this.runs=runs;this.json=json;this.tx=new TransactionTemplate(manager);
        boolean production=Arrays.stream(env.getActiveProfiles()).anyMatch(p->p.equals("mysql")||p.equals("prod")||p.equals("production"));
        if(production&&allowLocal)throw new IllegalArgumentException("Local platform HTTP is forbidden in production");
        if(enabled&&(brandId.isBlank()||appCode.isBlank()))throw new IllegalArgumentException("Platform brand and application required");
        this.client=enabled?new PlatformPricingClient(url,credential,allowLocal):null;
    }
    public boolean enabled(){return client!=null;}
    public StudioPointPricing.Rate find(String endpointId) {
        try {
            JsonNode response=client.publishedPricing(brandId,"studio.speech",endpointId),release=response.path("release"),d=release.path("definition");
            if(!appCode.equals(response.path("appCode").asText()))throw new IllegalArgumentException("Application does not match");
            if(!d.path("enabled").asBoolean())return null;
            if(!"second".equals(d.path("unit").asText())||!d.path("resolution").asText().isBlank()||!d.path("generationMode").asText().isBlank())throw new IllegalArgumentException("Speech requires per-second pricing without video dimensions");
            JsonNode strategy=d.path("strategy");BigDecimal price;
            if("fixed".equals(strategy.path("mode").asText()))price=decimal(strategy.path("pointsPerUnit"),false);
            else if("cost_plus".equals(strategy.path("mode").asText())) {
                JsonNode cost=release.path("costSnapshot"),ref=d.path("costReference");
                if(cost.isNull()||!cost.path("id").asText().equals(ref.path("id").asText())||cost.path("version").asInt()!=ref.path("version").asInt()||!endpointId.equals(cost.path("definition").path("modelKey").asText())||!"second".equals(cost.path("definition").path("unit").asText()))throw new IllegalArgumentException("Cost snapshot is invalid");
                price=decimal(cost.path("definition").path("amount"),false).multiply(decimal(strategy.path("pointsPerCostUnit"),true)).multiply(BigDecimal.ONE.add(decimal(strategy.path("markupPercent"),false).movePointLeft(2)));
            }else throw new IllegalArgumentException("Unsupported pricing strategy");
            return new StudioPointPricing.Rate(null,null,null,price,release.path("id").asText(),brandId,release.deepCopy());
        } catch(PricingException e) {
            log.warn("Platform speech pricing rejected endpoint={} status={} code={} response={}",endpointId,e.status(),e.code(),e.getMessage());
            if(e.status()==404)return null;
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"STUDIO_PLATFORM_PRICING_UNAVAILABLE","配音定价暂不可用，请检查运营平台成本与定价配置");
        } catch(IllegalArgumentException e) {
            log.warn("Platform speech pricing contract invalid endpoint={} detail={}",endpointId,e.getMessage());
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"STUDIO_PLATFORM_PRICING_INVALID","配音定价配置与模型不匹配，请联系运营核对");
        }
    }
    private static BigDecimal decimal(JsonNode value,boolean positive) {
        if(!value.isTextual()||!value.asText().matches("(0|[1-9][0-9]{0,8})(\\.[0-9]{1,6})?"))throw new IllegalArgumentException("Invalid decimal pricing");
        BigDecimal amount=new BigDecimal(value.asText());
        if(positive&&amount.signum()<=0)throw new IllegalArgumentException("Conversion ratio must be positive");
        return amount;
    }
    /** Persisted task rows are the durable receipt outbox. The query includes completed tasks. */
    @Scheduled(fixedDelay=15000,initialDelay=15000)
    public void deliverReceipts() {
        if(!enabled())return;
        for(var row:runs.pendingPricingReceipts(PageRequest.of(0,30))) {
            try {
                JsonNode snapshot=json.readTree(row.getInputJson()).path("_exec").path("pointPricing");
                if(snapshot.path("platformReleaseId").asText().isBlank()||snapshot.path("platformBrandId").asText().isBlank())continue;
                client.reportPricingApplied(snapshot.path("platformBrandId").asText(),snapshot.path("platformReleaseId").asText(),row.getId());
                tx.executeWithoutResult(status->{var current=runs.lockById(row.getId()).orElse(null);if(current==null)return;try{ObjectNode input=(ObjectNode)json.readTree(current.getInputJson());((ObjectNode)input.path("_exec")).put("pricingReported",true);current.setInputJson(json.writeValueAsString(input));runs.save(current);}catch(Exception e){throw new IllegalStateException(e);}});
            }catch(PricingException e){log.warn("Platform pricing receipt pending task={} status={} code={} response={}",row.getId(),e.status(),e.code(),e.getMessage());}
            catch(Exception e){log.warn("Platform pricing receipt pending task={} error={}",row.getId(),e.getClass().getSimpleName());}
        }
    }
}
