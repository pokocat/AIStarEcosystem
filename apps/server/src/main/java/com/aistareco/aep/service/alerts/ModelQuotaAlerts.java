package com.aistareco.aep.service.alerts;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.ai.ModelProviderRejected;
import com.aistareco.aep.service.ai.ProviderAlertText;
import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Supplier quota alerts for the Feishu bot, one message per endpoint rather than one per failed task.
 *
 * Two sources: any model call the supplier refuses for lack of quota, and a balance check for endpoints listed in
 * platform config {@value #WATCH_KEY}, e.g. {"endpoints":{"ai-onetoken-sonnet55":{"usagePath":"/usage","warnBelow":10}}}.
 * Alerts never change model routing, tasks or wallets (a failed call still fails; see AGENTS.md §8.0).
 */
@Service
public class ModelQuotaAlerts {
    public static final String WATCH_KEY="ai.quota-watch";
    static final String EXHAUSTED="MODEL_QUOTA_EXHAUSTED", LOW="MODEL_QUOTA_LOW", UNREADABLE="MODEL_QUOTA_UNREADABLE";
    /** Balance is checked every 5 minutes, so this is half an hour of failed checks. */
    private static final int UNREADABLE_AFTER=6;
    private static final int BODY_LIMIT=1000;
    private static final ZoneId BEIJING=ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter HOUR=DateTimeFormatter.ofPattern("yyyyMMddHH").withZone(BEIJING);
    private static final DateTimeFormatter DAY=DateTimeFormatter.ofPattern("yyyyMMdd").withZone(BEIJING);
    private static final DateTimeFormatter TIME=DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(BEIJING);
    private static final List<String> RATE_LIMIT=List.of("rate_limit","rate limit","too many requests","请求频繁","请求速率","rpm","tpm");
    private static final List<String> LOAD_REFUSAL=List.of("rate_limit","rate limit","too many requests","too many concurrent","concurrency","concurrent",
            "overloaded","saturated","server is busy","queue is full","请求频繁","请求速率","请求过多","并发","限流","繁忙","负载已饱和","负载饱和","队列已满");
    private static final List<String> OUT_OF_QUOTA=List.of("quota_exhausted","quota exhausted","insufficient_quota","insufficient_user_quota",
            "exceeded your current quota","quota is not enough","insufficient_balance","insufficient balance","billing_hard_limit",
            "arrearage","accountoverdue","account_overdue","额度已用完","额度不足","配额已用完","余额不足","预扣费","欠费");
    private static final Logger log=LoggerFactory.getLogger(ModelQuotaAlerts.class);

    private final JdbcTemplate db;
    private final FeishuAlertConfig config;
    private final FeishuModelAlerts alerts;
    private final PlatformConfigService platformConfig;
    private final AiModelEndpointRepository endpoints;
    private final ObjectMapper mapper;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    /** Filled on the model call's thread, written by the alert scheduler: a model call never touches the database for this. */
    private final Map<String,ModelProviderRejected> refused=new ConcurrentHashMap<>();
    private final Map<String,Integer> failedChecks=new ConcurrentHashMap<>();

    public ModelQuotaAlerts(JdbcTemplate db,FeishuAlertConfig config,FeishuModelAlerts alerts,PlatformConfigService platformConfig,
                            AiModelEndpointRepository endpoints,ObjectMapper mapper) {
        this.db=db;this.config=config;this.alerts=alerts;this.platformConfig=platformConfig;this.endpoints=endpoints;this.mapper=mapper;
    }

    /** Reads the supplier's raw wording: the public message has had these words replaced (AGENTS.md §8.0.1 ①). */
    /** 明确说并发、限流、过载。不含 rpm / tpm：这里决定能否重交，请求号里碰巧有这几个字母不能算数。 */
    public static boolean isRateLimited(String body) {
        if(body==null||body.isBlank())return false;
        String text=(body.length()<=4000?body:body.substring(0,4000)).toLowerCase(Locale.ROOT);
        for(String phrase:LOAD_REFUSAL)if(text.contains(phrase))return true;
        return false;
    }

    public static boolean isOutOfQuota(String body) {
        if(body==null||body.isBlank())return false;
        String text=body.length()<=4000?body:body.substring(0,4000);
        text=text.toLowerCase(Locale.ROOT);
        for(String phrase:RATE_LIMIT)if(text.contains(phrase))return false;
        for(String phrase:OUT_OF_QUOTA)if(text.contains(phrase))return true;
        return false;
    }

    @EventListener
    public void onRejected(ModelProviderRejected rejected) {
        if(rejected.endpointId()==null||!isOutOfQuota(rejected.body()))return;
        refused.put(rejected.endpointId(),rejected);
    }

    @Scheduled(fixedDelay=10000,initialDelay=20000,scheduler="modelAlertScheduler")
    public void flushRefused() {
        for(var id:List.copyOf(refused.keySet())) {
            var rejected=refused.remove(id);
            if(rejected==null||!config.ready())continue;
            Instant now=Instant.now();
            try {
                send(id,EXHAUSTED,HOUR.format(now),now,exhaustedText(rejected,purposes(id),now));
            } catch(Exception failure) {
                log.warn("[model-quota] alert not stored endpoint={} type={}",id,failure.getClass().getSimpleName());
            }
        }
    }

    @Scheduled(fixedDelay=300000,initialDelay=60000,scheduler="modelAlertScheduler")
    public void checkBalances() {
        if(!config.ready())return;
        JsonNode watched=platformConfig.findByKey(WATCH_KEY).map(c->c.value().path("endpoints")).orElse(null);
        if(watched==null||!watched.isObject())return;
        for(var entry:watched.properties()) {
            try {checkBalance(entry.getKey(),entry.getValue());}
            catch(Exception failure){log.warn("[model-quota] check failed endpoint={} type={}",entry.getKey(),failure.getClass().getSimpleName());}
        }
    }

    private void checkBalance(String id,JsonNode watch) {
        AiModelEndpoint endpoint=endpoints.findById(id).orElse(null);
        if(endpoint==null||!endpoint.isEnabled()||endpoint.getUpstreamApiKeyEncrypted()==null)return;
        Instant now=Instant.now();
        Balance balance=null;String failure;
        try {
            var response=http.send(HttpRequest.newBuilder(URI.create(endpoint.getBaseUrl().replaceAll("/+$","")+watch.path("usagePath").asText("/usage")))
                    .timeout(Duration.ofSeconds(10)).header("Authorization","Bearer "+AepCryptoUtil.decrypt(endpoint.getUpstreamApiKeyEncrypted())).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()==200) {balance=parse(mapper.readTree(response.body()));failure=balance==null?"返回里没有 remaining":null;}
            else if(isOutOfQuota(response.body())) {
                refused.put(id,new ModelProviderRejected(id,endpoint.getName(),endpoint.getModel(),response.statusCode(),response.body()));
                failure=null;
            } else failure="HTTP "+response.statusCode();
        } catch(InterruptedException interrupted) {
            Thread.currentThread().interrupt();return;
        } catch(Exception error) {
            failure=error.getClass().getSimpleName();
        }
        if(failure!=null) {
            int count=failedChecks.merge(id,1,Integer::sum);
            log.warn("[model-quota] balance unreadable endpoint={} reason={} consecutive={}",id,failure,count);
            if(count==UNREADABLE_AFTER)send(id,UNREADABLE,DAY.format(now),now,unreadableText(endpoint,failure,now));
            return;
        }
        failedChecks.remove(id);
        if(balance==null)return;
        log.info("[model-quota] endpoint={} remaining={} unit={} mode={} valid={}",id,balance.remaining(),balance.unit(),balance.mode(),balance.valid());
        BigDecimal warnBelow=watch.path("warnBelow").decimalValue();
        if(!balance.valid()||balance.remaining().signum()<=0)
            send(id,EXHAUSTED,HOUR.format(now),now,emptyText(endpoint,balance,purposes(id),now));
        else if(balance.remaining().compareTo(warnBelow)<0)
            send(id,LOW,DAY.format(now),now,lowText(endpoint,balance,warnBelow,purposes(id),now));
    }

    static Balance parse(JsonNode usage) {
        if(!usage.path("remaining").isNumber())return null;
        return new Balance(usage.path("remaining").decimalValue(),usage.path("unit").asText(""),usage.path("mode").asText(""),usage.path("isValid").asBoolean(true),
                usage.path("usage").path("today").path("actual_cost").isNumber()?usage.path("usage").path("today").path("actual_cost").decimalValue():null);
    }

    record Balance(BigDecimal remaining,String unit,String mode,boolean valid,BigDecimal todayCost) {}

    /** The id is derived from endpoint + kind + time bucket, so restarts and repeats within the bucket send nothing new. */
    private void send(String id,String code,String bucket,Instant now,String text) {
        alerts.enqueueNotice("quota:"+id+":"+bucket,code,"quota-"+bucket,text,now);
    }

    private List<String> purposes(String id) {
        try {return db.queryForList("SELECT purpose FROM ai_app_binding WHERE endpoint_id=? ORDER BY purpose",String.class,id);}
        catch(Exception failure) {return new ArrayList<>();}
    }

    static String exhaustedText(ModelProviderRejected rejected,List<String> purposes,Instant at) {
        String body=ProviderAlertText.sanitize(rejected.body());
        if(body.length()>BODY_LIMIT)body=body.substring(0,BODY_LIMIT)+"…";
        return header("额度已用完",at)+endpointLine(rejected.endpointName(),rejected.endpointId())
                +"\n模型："+rejected.model()+impact(FAILING,purposes)
                +"\n远端 HTTP 状态：HTTP "+rejected.status()+"\n服务方返回：\n"+body
                +"\n处理：到服务方控制台提高或重置额度，或换 Key 后在后台更新。还在失败的话，每小时提醒一次。"+ADMIN;
    }

    static String emptyText(AiModelEndpoint endpoint,Balance balance,List<String> purposes,Instant at) {
        return header(balance.valid()?"余额已用完":"Key 已不可用",at)+endpointLine(endpoint.getName(),endpoint.getId())
                +"\n服务方余额："+balance.remaining().toPlainString()+" "+balance.unit()+impact(FAILING,purposes)
                +"\n处理：到服务方控制台充值或重置额度，或换 Key 后在后台更新。还没恢复的话，每小时提醒一次。"+ADMIN;
    }

    static String lowText(AiModelEndpoint endpoint,Balance balance,BigDecimal warnBelow,List<String> purposes,Instant at) {
        return header("余额偏低",at)+endpointLine(endpoint.getName(),endpoint.getId())
                +"\n服务方余额："+balance.remaining().toPlainString()+" "+balance.unit()+"（提醒线 "+warnBelow.toPlainString()+"）"
                +(balance.todayCost()==null?"":"\n今日已用："+balance.todayCost().toPlainString()+" "+balance.unit())
                +impact("余额用完后，走这个接入点的调用都会失败，不会自动换模型",purposes)+"\n处理：到服务方控制台充值。余额没恢复的话，每天提醒一次。"+ADMIN;
    }

    static String unreadableText(AiModelEndpoint endpoint,String failure,Instant at) {
        return header("余额查询失败",at)+endpointLine(endpoint.getName(),endpoint.getId())
                +"\n原因："+failure+"，已连续 "+UNREADABLE_AFTER+" 次（约半小时）"
                +"\n影响：余额提醒暂时不起作用，模型调用不受这个查询影响。"+ADMIN;
    }

    private static final String ADMIN="\n后台：https://admin.aibuzz.cn/admin/platform/ai-models";
    private static String header(String title,Instant at){return "【模型额度告警】"+title+"\n告警时间（北京时间）："+TIME.format(at);}
    private static String endpointLine(String name,String id){return "\n接入点："+name+"（"+id+"）";}
    private static final String FAILING="走这个接入点的调用都会失败，不会自动换模型";
    private static String impact(String effect,List<String> purposes) {
        return "\n影响："+effect+(purposes.isEmpty()?"":"\n默认绑定的用途："+String.join("、",purposes));
    }
}
