package com.aistareco.aep.service.alerts;

import com.aistareco.common.BusinessException;
import com.aistareco.aep.service.ai.ProviderResponseDiagnostics;
import db.migration.V64__model_alert_delivery;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.http.HttpStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FeishuModelAlertsTest {
    JdbcTemplate db;FeishuAlertConfig config;FeishuAlertClient client;FeishuModelAlerts alerts;
    @BeforeEach void setup() throws Exception {
        var ds=new DriverManagerDataSource("jdbc:h2:mem:alerts-"+java.util.UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1","sa","");
        db=new JdbcTemplate(ds);
        try(var c=ds.getConnection()){var context=mock(Context.class);when(context.getConnection()).thenReturn(c);new V64__model_alert_delivery().migrate(context);}
        config=new FeishuAlertConfig();config.setEnabled(true);config.setAppId("app");config.setAppSecret("secret");config.setChatId("oc_group");config.setUserId("ou_person");
        client=mock(FeishuAlertClient.class);alerts=new FeishuModelAlerts(db,config,client);
    }
    @Test void dedupesAcrossInstancesAndUrgencyFailureRetriesOnlyTheOriginalMessage() throws Exception {
        config.setUrgent(true);
        alerts.enqueue("task","VIDEO_SUBMISSION_UNKNOWN","ABCDEF234567",new IllegalStateException("private"));
        new FeishuModelAlerts(db,config,client).enqueue("task","VIDEO_SUBMISSION_UNKNOWN","OTHERTRACE22",new IllegalStateException("again"));
        assertEquals(1,db.queryForObject("SELECT COUNT(*) FROM model_alert_delivery",Integer.class));
        when(client.send(anyString(),anyString())).thenReturn("om_message");
        doThrow(new IllegalStateException("Feishu code 99991672")).doNothing().when(client).urgent("om_message");
        alerts.deliver();assertEquals("pending",state());assertEquals("om_message",db.queryForObject("SELECT message_id FROM model_alert_delivery",String.class));
        db.update("UPDATE model_alert_delivery SET next_attempt_at=CURRENT_TIMESTAMP");alerts.deliver();alerts.deliver();
        assertEquals("sent",state());verify(client,times(1)).send(anyString(),anyString());verify(client,times(2)).urgent("om_message");
    }
    @Test void defaultDeliverySendsOrdinaryMessageWithoutUrgency() throws Exception {
        assertFalse(config.isUrgent());
        alerts.enqueue("task","MODEL_TASK_FAILED","ABCDEF234567",new IllegalStateException("failure"));
        when(client.send(anyString(),anyString())).thenReturn("om_message");
        alerts.deliver();alerts.deliver();
        assertEquals("sent",state());
        verify(client,times(1)).send(anyString(),anyString());
        verify(client,never()).urgent(anyString());
    }
    @Test void failedDeliveryIsBoundedAndNeverTouchesTaskOrWalletState() throws Exception {
        db.execute("CREATE TABLE original_wallet(balance INT)");db.update("INSERT INTO original_wallet VALUES(520)");
        alerts.enqueue("task","VIDEO_SUBMISSION_UNKNOWN","ABCDEF234567",new IllegalStateException());
        when(client.send(anyString(),anyString())).thenThrow(new IllegalStateException("secret must not be persisted"));
        for(int i=0;i<7;i++){db.update("UPDATE model_alert_delivery SET next_attempt_at=CURRENT_TIMESTAMP");alerts.deliver();}
        assertEquals("failed",state());verify(client,times(5)).send(anyString(),anyString());verify(client,never()).urgent(anyString());
        assertEquals("Feishu delivery unavailable",db.queryForObject("SELECT last_error FROM model_alert_delivery",String.class));
        assertEquals(520,db.queryForObject("SELECT balance FROM original_wallet",Integer.class));
    }
    @Test void incompleteConfigurationAndUserCancellationNeverEnqueueOrSend() {
        config.setAppSecret("");alerts.enqueue("task","VIDEO_SUBMISSION_UNKNOWN","ABCDEF234567",new IllegalStateException());alerts.deliver();
        config.setAppSecret("secret");alerts.enqueue("cancel","IP_RUN_CANCELLED","ABCDEF234567",new IllegalStateException());
        assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM model_alert_delivery",Integer.class));verifyNoInteractions(client);
    }
    @Test void notificationContainsTraceIdsButNoPromptBodySecretOrSignedUrl() {
        var error=new BusinessException(HttpStatus.BAD_GATEWAY,"VIDEO_SUBMISSION_UNKNOWN","safe",null,
                "request_id=req_01a16341-b439-7371-b964-86cb9690732b body={prompt:private-prompt,token:secret-token,url:https://private/asset?signature=private-signature}");
        String message=FeishuModelAlerts.message("task","VIDEO_SUBMISSION_UNKNOWN","ABCDEF234567",error);
        assertTrue(message.contains("req_01a16341-b439-7371-b964-86cb9690732b"));assertTrue(message.contains("ABCDEF234567"));
        for(String secret:java.util.List.of("private-prompt","secret-token","private-signature"))assertFalse(message.contains(secret));
    }
    @Test void missingHttpEvidenceDoesNotInventAStatusAndProviderStatusWinsWhenPresent() {
        String missing=FeishuModelAlerts.message("task","VIDEO_SUBMISSION_UNKNOWN","ABCDEF234567",new IllegalStateException("historical submission"));
        assertFalse(missing.contains("远端 HTTP 状态"));assertFalse(missing.contains("HTTP 500"));
        var error=new BusinessException(HttpStatus.BAD_GATEWAY,"VIDEO_SUBMISSION_UNKNOWN","safe",null,"provider HTTP 503");
        assertTrue(FeishuModelAlerts.message("task",error.getCode(),"ABCDEF234567",error).contains("HTTP 503"));
        var localOnly=new BusinessException(HttpStatus.BAD_GATEWAY,"FAIL","safe");
        String local=FeishuModelAlerts.message("task","FAIL","trace",localOnly);
        assertFalse(local.contains("远端 HTTP 状态"));
        assertFalse(local.contains("我方 HTTP 状态"));
    }
    @Test void timeIsExplicitAndPersistedOnceEvenWhenDeliveryRetries() throws Exception {
        var instant=java.time.Instant.parse("2026-10-23T16:25:30.123Z");
        String message=FeishuModelAlerts.message("task","FAIL","trace",null,instant);
        assertTrue(message.contains("告警时间（北京时间）：2026-10-24 00:25:30.123"));
        assertFalse(message.contains("Unix"));assertFalse(message.contains("UTC"));
        alerts.enqueue("task","FAIL","trace",null);
        String saved=db.queryForObject("SELECT message_text FROM model_alert_delivery",String.class);
        var created=db.queryForObject("SELECT created_at FROM model_alert_delivery",java.sql.Timestamp.class).toInstant();
        assertTrue(saved.contains(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS").withZone(java.time.ZoneId.of("Asia/Shanghai")).format(created)));
        when(client.send(anyString(),anyString())).thenThrow(new IllegalStateException("Feishu unavailable")).thenReturn("om_message");
        alerts.deliver();db.update("UPDATE model_alert_delivery SET next_attempt_at=CURRENT_TIMESTAMP");alerts.deliver();
        verify(client,times(2)).send(anyString(),eq(saved));
    }
    @Test void headerAndBodyIdsAndSupplierErrorsSurviveExceptionWrapping() {
        var headers=java.net.http.HttpHeaders.of(java.util.Map.of(
                "X-Tt-Logid",java.util.List.of("20261023ABC"),
                "X-Request-Id",java.util.List.of("req-123"),
                "Authorization",java.util.List.of("Bearer hidden-secret")),(k,v)->true);
        var cause=ProviderResponseDiagnostics.attach(new IllegalStateException("safe"),429,headers,
                "{\"error\":{\"logid\":\"remote-9\",\"message\":\"private-prompt\"},\"ResponseMetadata\":{\"RequestId\":\"body-123\"},\"prompt\":\"request_id=private-should-not-copy\"}");
        String text=FeishuModelAlerts.message("task","FAIL","LOCAL123",new IllegalStateException("wrapper",cause));
        for(String id:java.util.List.of("x-tt-logid=20261023ABC","x-request-id=req-123","logid=remote-9","RequestId=body-123"))assertTrue(text.contains(id),text);
        assertTrue(text.contains("远端 HTTP 状态：HTTP 429"));
        assertTrue(text.contains("private-prompt"),"supplier error.message must reach the alert");
        assertFalse(text.contains("hidden-secret"));
    }
    @Test void legacyDiagnosticsKeepIdNamesAndRejectSecretsOrTruncatedIds() {
        String text=FeishuModelAlerts.message("task","FAIL","trace",new IllegalStateException(
                "status=503 log_id=abc.123 requestId=req_456 x-tt-logid: 789ABC trace_id=trace:789 request_id=sk-secret-value logid="+"a".repeat(257)));
        for(String id:java.util.List.of("log_id=abc.123","requestId=req_456","x-tt-logid=789ABC","trace_id=trace:789"))assertTrue(text.contains(id),text);
        assertTrue(text.contains("远端 HTTP 状态：HTTP 503"));
        assertFalse(text.contains("sk-secret"));
        String ids=text.lines().filter(line->line.startsWith("远端追踪号：")).findFirst().orElseThrow();
        assertFalse(ids.contains("a".repeat(100)));
    }
    @Test void modelContextIsPersistedInTheOutgoingMessage() {
        var context=mock(ModelAlertContext.class);
        when(context.describeForAlert("task")).thenReturn("供应商 / 端点：聚算\nAPI 基础地址：https://api.example/v1\n模型：minimax-h3\n任务参数：duration_sec=13");
        org.springframework.test.util.ReflectionTestUtils.setField(alerts,"modelContext",context);
        alerts.enqueue("task","VIDEO_SUBMISSION_UNKNOWN","ABCDEF234567",new IllegalStateException());
        String text=db.queryForObject("SELECT message_text FROM model_alert_delivery",String.class);
        assertTrue(text.contains("https://api.example/v1"));assertTrue(text.contains("minimax-h3"));assertTrue(text.contains("duration_sec=13"));
    }
    @Test void completeProviderErrorIsIncludedAndEmptyBoilerplateIsOmitted() {
        var error=ProviderResponseDiagnostics.attach(new IllegalStateException("模型返回内容不符合格式"),400,null,
                "{\"error\":{\"code\":\"invalid_parameter\",\"message\":\"max_tokens 超过模型上限\",\"details\":{\"limit\":8192,\"actual\":16000}},\"request_id\":\"remote-123\"}");
        String text=FeishuModelAlerts.message("task","STUDIO_RUN_FAILED","TRACE123",error);
        for(String value:java.util.List.of("模型返回内容不符合格式","invalid_parameter","max_tokens 超过模型上限","\"limit\":8192","\"actual\":16000","remote-123","服务方返回："))assertTrue(text.contains(value),text);
        for(String value:java.util.List.of("Unix","未获取","未记录","请查看后台详情","最终状态及积分","我方 HTTP 状态"))assertFalse(text.contains(value),text);
    }
    @Test void localFailureIncludesTheActualNestedCauseWithoutInventingAProviderResponse() {
        String text=FeishuModelAlerts.message("task","STUDIO_RUN_FAILED","TRACE123",new IllegalStateException("无法解析模型结果",new java.io.IOException("unexpected end of JSON")));
        assertTrue(text.contains("无法解析模型结果"));assertTrue(text.contains("unexpected end of JSON"));
        assertFalse(text.contains("服务方返回："));assertFalse(text.contains("远端 HTTP 状态"));
    }
    private String state(){return db.queryForObject("SELECT state FROM model_alert_delivery",String.class);}
}
