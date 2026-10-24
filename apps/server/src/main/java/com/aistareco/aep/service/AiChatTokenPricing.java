package com.aistareco.aep.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;

/** Shared persisted customer token rates. Supplier costs remain a dated pricing reference. */
@Service
public class AiChatTokenPricing {
    public static final String KEY="ai.chat-token-pricing";
    public static final String DIALOGUE_BUDGET_KEY="studio.dialogue-token-budget";
    // A turn repeatedly sends context: 16 dialogue steps plus vision, planning and history calls share this budget.
    public static final int DIALOGUE_INPUT_TOKENS=1_048_576;
    public static final int DIALOGUE_OUTPUT_TOKENS=65_536;
    private final PlatformConfigService configs;
    public AiChatTokenPricing(PlatformConfigService configs){this.configs=configs;}
    public Rate find(String endpointId) {
        var config=configs.findByKey(KEY);
        if(config.isEmpty())return null; // Caller rejects unpriced new text runs; accepted snapshots remain valid.
        var node=config.get().value().path("endpoints").path(endpointId);
        if(node.isMissingNode())throw unavailable("AI_TOKEN_PRICE_NOT_CONFIGURED","此模型尚未配置 Token 积分售价");
        return parse(node);
    }
    /** Same unit prices, independently configured cumulative limits. Never change a run's accepted rate snapshot. */
    public Rate findDialogue(String endpointId) {
        Rate text=find(endpointId);
        if(text==null)return null;
        var config=configs.findByKey(DIALOGUE_BUDGET_KEY);
        int input=DIALOGUE_INPUT_TOKENS,output=DIALOGUE_OUTPUT_TOKENS;
        if(config.isPresent()) {
            JsonNode value=config.get().value();
            validateDialogueBudget(value);
            JsonNode budget=value.path("endpoints").path(endpointId);
            if(budget.isMissingNode())budget=value;
            input=positive(budget,"maxInputTokens");
            output=positive(budget,"maxOutputTokens");
        }
        return new Rate(text.inputCreditsPerK(),text.outputCreditsPerK(),input,output);
    }
    public static void validateDialogueBudget(JsonNode value) {
        try {
            validateBudget(value);
            JsonNode endpoints=value.path("endpoints");
            if(!endpoints.isMissingNode()) {
                if(!endpoints.isObject())throw new IllegalArgumentException();
                endpoints.elements().forEachRemaining(AiChatTokenPricing::validateBudget);
            }
        } catch(RuntimeException e) {
            throw BusinessException.badRequest("STUDIO_DIALOGUE_BUDGET_INVALID","对话用量上限配置无效，请填写 1 到 2000000 的整数，输出上限至少 256");
        }
    }
    private static void validateBudget(JsonNode value) {
        positive(value,"maxInputTokens");
        if(positive(value,"maxOutputTokens")<256)throw new IllegalArgumentException();
    }
    public static void validate(JsonNode value) {
        var endpoints=value==null?null:value.path("endpoints");
        if(endpoints==null||!endpoints.isObject()||endpoints.isEmpty())throw BusinessException.badRequest("AI_TOKEN_PRICE_INVALID","请配置至少一个模型的 Token 售价");
        endpoints.elements().forEachRemaining(AiChatTokenPricing::parse);
    }
    private static Rate parse(JsonNode node) {
        try{return new Rate(decimal(node,"inputCreditsPerK"),decimal(node,"outputCreditsPerK"),positive(node,"maxInputTokens"),positive(node,"maxOutputTokens"));}
        catch(RuntimeException e){throw unavailable("AI_TOKEN_PRICE_INVALID","模型 Token 售价或用量上限配置无效");}
    }
    private static BigDecimal decimal(JsonNode n,String key){var v=n.path(key);if(!v.isNumber()||v.decimalValue().signum()<0||v.decimalValue().compareTo(BigDecimal.valueOf(1000000))>0)throw new IllegalArgumentException();return v.decimalValue();}
    private static int positive(JsonNode n,String key){var v=n.path(key);if(!v.isIntegralNumber()||!v.canConvertToInt()||v.intValue()<1||v.intValue()>2000000)throw new IllegalArgumentException();return v.intValue();}
    public record Rate(BigDecimal inputCreditsPerK,BigDecimal outputCreditsPerK,int maxInputTokens,int maxOutputTokens) {
        /** A dialogue ceiling is a spending limit, not a requirement to authorize the server's larger default. */
        public Rate withinBudget(long ceiling) {
            if (ceiling < 0) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "费用上限不能为负数");
            if (maxCost() <= ceiling) return this;
            if (cost(1, 256) > ceiling)
                throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_PRICE_CHANGED","本次费用上限不足以回复，请重新确认对话费用");
            // Preserve the configured allocation ratio and unit prices. The accepted snapshot is used both by the
            // invocation budget and settlement, including continued turns; nothing can spend above the old consent.
            int low=0,high=1_000_000;
            while(low<high) {
                int mid=low+(high-low+1)/2;
                if(cost(Math.max(1,(long)maxInputTokens*mid/1_000_000),Math.max(256,(long)maxOutputTokens*mid/1_000_000))<=ceiling) low=mid;
                else high=mid-1;
            }
            return new Rate(inputCreditsPerK,outputCreditsPerK,Math.max(1,(int)((long)maxInputTokens*low/1_000_000)),
                    Math.max(256,(int)((long)maxOutputTokens*low/1_000_000)));
        }
        @com.fasterxml.jackson.annotation.JsonProperty(access=com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
        public long maxCost(){return cost(maxInputTokens,maxOutputTokens);}
        public long cost(long input,long output){return inputCreditsPerK.multiply(BigDecimal.valueOf(input)).add(outputCreditsPerK.multiply(BigDecimal.valueOf(output))).divide(BigDecimal.valueOf(1000),0,RoundingMode.CEILING).longValueExact();}
        public long settle(Long input,Long output) {
            if(input==null||output==null||input<0||output<0||input+output==0)throw unavailable("AI_USAGE_MISSING","模型未返回有效 Token 用量，本次未扣积分");
            if(input>maxInputTokens||output>maxOutputTokens)throw unavailable("AI_USAGE_LIMIT","模型返回用量超出已确认上限，本次未扣积分");
            return cost(input,output);
        }
        /**
         * A Studio dialogue turn: real usage at this rate's unit prices, bounded only by the credits frozen for the turn
         * ({@code held}, every hold of its run), not by maxCost or the input / output split.
         */
        public long settleWithin(Long input,Long output,long held) {
            if(input==null||output==null||input<0||output<0||input+output==0)throw unavailable("AI_USAGE_MISSING","模型未返回有效 Token 用量，本次未扣积分");
            long actual=cost(input,output);
            if(actual>held)throw unavailable("AI_USAGE_LIMIT","模型返回费用超出已冻结积分，本次未扣积分");
            return actual;
        }
        /** Continued work shares the approved monetary ceiling, rather than fixed input/output partitions. */
        public long settleContinued(Long input,Long output) {
            if(input==null||output==null||input<0||output<0||input+output==0)throw unavailable("AI_USAGE_MISSING","模型未返回有效 Token 用量，本次未扣积分");
            long actual=cost(input,output);
            if(actual>maxCost())throw unavailable("AI_USAGE_LIMIT","模型返回费用超出已确认预算，本次未扣积分");
            return actual;
        }
    }
    private static BusinessException unavailable(String code,String message){return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,code,message);}
}
