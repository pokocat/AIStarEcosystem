package com.aistareco.aep.service.alerts;

import com.aistareco.common.BusinessException;
import com.aistareco.aep.service.ai.ProviderResponseDiagnostics;
import com.aistareco.aep.service.ai.ProviderAlertText;
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
    private static final java.time.format.DateTimeFormatter BEIJING_TIME = java.time.format.DateTimeFormatter
            .ofPattern("yyyy-MM-dd HH:mm:ss.SSS").withZone(java.time.ZoneId.of("Asia/Shanghai"));
    static final String ADMIN_LINK = "\n\n模型后台：https://admin.aibuzz.cn/admin/platform/ai-models";
    private static final Logger log=LoggerFactory.getLogger(FeishuModelAlerts.class);
    private final JdbcTemplate db;private final FeishuAlertConfig config;private final FeishuAlertClient client;
    @org.springframework.beans.factory.annotation.Autowired private ModelAlertContext modelContext;
    public FeishuModelAlerts(JdbcTemplate db,FeishuAlertConfig config,FeishuAlertClient client){this.db=db;this.config=config;this.client=client;}
    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public void enqueue(String taskId,String code,String logId,Throwable error) {
        enqueue(taskId,code,logId,error,null);
    }
    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public void enqueue(String taskId,String code,String logId,Throwable error,String ownerId) {
        if(!config.ready()||logId==null||"IP_RUN_CANCELLED".equals(code))return;
        String actualCode=code==null?"MODEL_TASK_FAILED":code;
        String id=UUID.nameUUIDFromBytes((taskId+"\n"+actualCode).getBytes(StandardCharsets.UTF_8)).toString();
        // MySQL and H2 MySQL mode both support INSERT IGNORE; the primary key is the cross-process dedupe gate.
        Instant occurredAt=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
        var details = modelContext == null ? ModelAlertContext.TaskDetails.EMPTY : modelContext.taskDetails(taskId);
        String user = modelContext == null ? ownerId : modelContext.userLabel(ownerId);
        String text=message(taskId,actualCode,logId,error,occurredAt,details,user);
        Boolean postgres=db.execute((org.springframework.jdbc.core.ConnectionCallback<Boolean>) c -> "PostgreSQL".equals(c.getMetaData().getDatabaseProductName()));
        String insert=Boolean.TRUE.equals(postgres)?"INSERT INTO ":"INSERT IGNORE INTO ";
        String conflict=Boolean.TRUE.equals(postgres)?" ON CONFLICT (id) DO NOTHING":"";
        db.update(insert+"model_alert_delivery (id,task_id,error_code,log_id,message_text,state,created_at,next_attempt_at) VALUES (?,?,?,?,?,'pending',?,?)"+conflict,
                id,taskId,actualCode,logId,text,Timestamp.from(occurredAt),Timestamp.from(occurredAt));
    }
    /** For alerts that are not about one task. Same delivery and dedupe as enqueue: the same taskId + code is stored once. */
    void enqueueNotice(String taskId,String code,String logId,String text,Instant occurredAt) {
        String id=UUID.nameUUIDFromBytes((taskId+"\n"+code).getBytes(StandardCharsets.UTF_8)).toString();
        Instant at=occurredAt.truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
        db.update("INSERT IGNORE INTO model_alert_delivery (id,task_id,error_code,log_id,message_text,state,created_at,next_attempt_at) VALUES (?,?,?,?,?,'pending',?,?)",
                id,taskId,code,logId,text,Timestamp.from(at),Timestamp.from(at));
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
                if(config.urgencyEnabled()&&messageId.startsWith("om_"))client.urgent(messageId);
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
        return message(task,code,logId,error,Instant.now());
    }
    static String message(String task,String code,String logId,Throwable error,Instant occurredAt) {
        return message(task,code,logId,error,occurredAt,ModelAlertContext.TaskDetails.EMPTY,null);
    }
    private static String message(String task,String code,String logId,Throwable error,Instant occurredAt,
                                  ModelAlertContext.TaskDetails details,String user) {
        Integer status=null, legacyStatus=null;
        Set<String> ids=new LinkedHashSet<>(), responses=new LinkedHashSet<>(), reasons=new LinkedHashSet<>();
        Set<Throwable> visited=Collections.newSetFromMap(new IdentityHashMap<>());
        for(Throwable cause=error;cause!=null&&visited.size()<8&&visited.add(cause);cause=cause.getCause()) {
            boolean hasResponseEvidence=false;
            for(Throwable diagnostic:cause.getSuppressed()) if(diagnostic instanceof ProviderResponseDiagnostics evidence) {
                hasResponseEvidence=true;
                if(status==null)status=evidence.status();
                ids.addAll(evidence.identifiers());
                if(!evidence.responseBody().isBlank())responses.add(evidence.responseBody());
            }
            String detail=cause instanceof BusinessException be?be.getInternalDetail():null;
            String source=String.valueOf(cause.getMessage())+"\n"+String.valueOf(detail);
            var http=java.util.regex.Pattern.compile("(?i)\\b(?:HTTP\\s+|status[= :]+)([1-5]\\d{2})\\b").matcher(source);
            if(legacyStatus==null&&http.find())legacyStatus=Integer.parseInt(http.group(1));
            if(!hasResponseEvidence)ids.addAll(ProviderResponseDiagnostics.legacyIdentifiers(source));
            String reason=ProviderAlertText.sanitize(cause.getMessage());
            if(!reason.isBlank())reasons.add(reason);
            // Older clients only retained internalDetail. Keep their actual error rather than a generic placeholder.
            if(responses.isEmpty()&&detail!=null&&!detail.isBlank()) {
                String safe=ProviderAlertText.sanitize(detail);
                if(!safe.isBlank())reasons.add(safe);
            }
        }
        if(status==null)status=legacyStatus;
        String reason=ProviderAlertText.sanitize(String.join("\n",reasons));
        if(reason.codePointCount(0, reason.length())>1200) reason=reason.substring(0,reason.offsetByCodePoints(0,1200))+"…";
        var text = new StringBuilder("【模型任务告警】\n\n");
        field(text, "告警时间（北京时间）", BEIJING_TIME.format(occurredAt));
        field(text, "错误原因", reason);
        field(text, "我方错误码", code);
        field(text, "用户", user);
        field(text, "操作", details.operation());
        field(text, "报错操作链接", details.page());
        text.append('\n');
        field(text, "我方任务", task);
        field(text, "我方追查号", logId);
        field(text, "远端任务 ID", details.remoteTask());
        field(text, "供应商 / 端点", details.endpoint());
        field(text, "模型", details.model());
        field(text, "远端 HTTP 状态", status == null ? "" : "HTTP " + status);
        field(text, "远端追踪号", String.join("；",ids.stream().limit(8).toList()));
        String response = ProviderAlertText.sanitize(String.join("\n", responses));
        text.append("\n---\n\n服务方返回：");
        text.append(response.isBlank() ? "—" : "\n" + response);
        return text.append(ADMIN_LINK).toString();
    }

    private static void field(StringBuilder text, String label, String value) {
        text.append("- ").append(label).append('：').append(value == null || value.isBlank() ? "—" : value).append('\n');
    }
}
