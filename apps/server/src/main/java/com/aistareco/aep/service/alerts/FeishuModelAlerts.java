package com.aistareco.aep.service.alerts;

import com.aistareco.common.BusinessException;
import org.slf4j.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

/** Durable, bounded delivery: one message per task/error code; urgency retry never sends another message. */
@Service
public class FeishuModelAlerts {
    private static final Logger log=LoggerFactory.getLogger(FeishuModelAlerts.class);
    private final JdbcTemplate db;private final FeishuAlertConfig config;private final FeishuAlertClient client;
    public FeishuModelAlerts(JdbcTemplate db,FeishuAlertConfig config,FeishuAlertClient client){this.db=db;this.config=config;this.client=client;}
    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public void enqueue(String taskId,String code,String logId,Throwable error) {
        if(!config.ready()||logId==null||"IP_RUN_CANCELLED".equals(code))return;
        String actualCode=code==null?"MODEL_TASK_FAILED":code;
        String id=UUID.nameUUIDFromBytes((taskId+"\n"+actualCode).getBytes(StandardCharsets.UTF_8)).toString();
        // MySQL and H2 MySQL mode both support INSERT IGNORE; the primary key is the cross-process dedupe gate.
        db.update("INSERT IGNORE INTO model_alert_delivery (id,task_id,error_code,log_id,message_text,state,created_at,next_attempt_at) VALUES (?,?,?,?,?,'pending',?,?)",
                id,taskId,actualCode,logId,message(taskId,actualCode,logId,error),Timestamp.from(Instant.now()),Timestamp.from(Instant.now()));
    }
    @Scheduled(fixedDelay=10000,initialDelay=15000,scheduler="modelAlertScheduler")
    public void deliver() {
        if(!config.ready())return;
        try {
            var due=db.queryForList("SELECT * FROM model_alert_delivery WHERE state IN ('pending','sending') AND next_attempt_at<=? ORDER BY created_at,id LIMIT 1",Timestamp.from(Instant.now()));
            if(due.isEmpty())return;
            var row=due.get(0);String id=(String)row.get("id");
            int claimed=db.update("UPDATE model_alert_delivery SET state='sending',attempts=attempts+1,next_attempt_at=? WHERE id=? AND state IN ('pending','sending') AND next_attempt_at<=?",
                    Timestamp.from(Instant.now().plusSeconds(60)),id,Timestamp.from(Instant.now()));
            if(claimed!=1)return;
            int attempts=((Number)row.get("attempts")).intValue()+1;
            try {
                String messageId=(String)row.get("message_id");
                if(messageId==null) {
                    messageId=client.send(id,(String)row.get("message_text"));
                    db.update("UPDATE model_alert_delivery SET message_id=? WHERE id=?",messageId,id);
                }
                if(config.isUrgent())client.urgent(messageId);
                db.update("UPDATE model_alert_delivery SET state='sent',sent_at=?,last_error=NULL WHERE id=?",Timestamp.from(Instant.now()),id);
            } catch(Exception error) {
                // Only our fixed diagnostic strings leave this boundary; never print SDK/request objects with credentials.
                String reason=error.getMessage();if(reason==null||!reason.startsWith("Feishu "))reason="Feishu delivery unavailable";
                db.update("UPDATE model_alert_delivery SET state=?,last_error=?,next_attempt_at=? WHERE id=?",attempts>=5?"failed":"pending",reason,
                        Timestamp.from(Instant.now().plusSeconds(30L*(1L<<Math.min(attempts-1,4)))),id);
                log.warn("[model-alert] delivery deferred id={} attempts={} reason={}",id,attempts,reason);
            }
        }catch(Exception error){log.error("[model-alert] delivery storage unavailable type={}",error.getClass().getSimpleName());}
    }
    static String message(String task,String code,String logId,Throwable error) {
        Integer status=error instanceof BusinessException be?be.getStatus().value():null;
        String reason=code.endsWith("_SUBMISSION_UNKNOWN")?"生成服务未返回有效任务信息，已触发失败处理":"模型任务调用异常，请查看后台详情";
        // Extract only provider trace identifiers. Never send prompts, response bodies, URLs or internal credentials to chat.
        Set<String> ids=new LinkedHashSet<>();Set<Throwable> visited=Collections.newSetFromMap(new IdentityHashMap<>());
        for(Throwable cause=error;cause!=null&&visited.size()<8&&visited.add(cause);cause=cause.getCause()) {
            String source=String.valueOf(cause.getMessage())+(cause instanceof BusinessException be?String.valueOf(be.getInternalDetail()):"");
            var http=java.util.regex.Pattern.compile("HTTP\\s+(\\d{3})").matcher(source);
            if(http.find())status=Integer.parseInt(http.group(1));
            var matches=java.util.regex.Pattern.compile("\\breq_[A-Za-z0-9_-]{8,100}\\b|(?i:(?:request[_ -]?id|log[_ -]?id))[\\\"' :=]+([A-Za-z0-9_-]{8,100})").matcher(source);
            while(matches.find()&&ids.size()<5)ids.add(matches.group(1)==null?matches.group():matches.group(1));
        }
        return "【模型任务告警】\n原因："+reason+"\n错误码："+code+"\n接口状态："+(status==null?"未记录 HTTP 状态":"HTTP "+status)+"\n我方任务："+task
                +"\n追查号："+logId+(ids.isEmpty()?"":"\n供应商追踪号："+String.join("、",ids))
                +"\n后台：https://admin.aibuzz.cn/admin/platform/ai-models\n同一任务同类错误只提醒一次；最终状态及积分以后台记录为准。";
    }
}
