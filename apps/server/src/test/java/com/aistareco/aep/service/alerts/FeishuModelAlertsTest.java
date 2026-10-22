package com.aistareco.aep.service.alerts;

import com.aistareco.common.BusinessException;
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
        alerts.enqueue("task","VIDEO_SUBMISSION_UNKNOWN","ABCDEF234567",new IllegalStateException("private"));
        new FeishuModelAlerts(db,config,client).enqueue("task","VIDEO_SUBMISSION_UNKNOWN","OTHERTRACE22",new IllegalStateException("again"));
        assertEquals(1,db.queryForObject("SELECT COUNT(*) FROM model_alert_delivery",Integer.class));
        when(client.send(anyString(),anyString())).thenReturn("om_message");
        doThrow(new IllegalStateException("Feishu code 99991672")).doNothing().when(client).urgent("om_message");
        alerts.deliver();assertEquals("pending",state());assertEquals("om_message",db.queryForObject("SELECT message_id FROM model_alert_delivery",String.class));
        db.update("UPDATE model_alert_delivery SET next_attempt_at=CURRENT_TIMESTAMP");alerts.deliver();alerts.deliver();
        assertEquals("sent",state());verify(client,times(1)).send(anyString(),anyString());verify(client,times(2)).urgent("om_message");
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
        assertTrue(missing.contains("未记录 HTTP 状态"));assertFalse(missing.contains("HTTP 500"));
        var error=new BusinessException(HttpStatus.BAD_GATEWAY,"VIDEO_SUBMISSION_UNKNOWN","safe",null,"provider HTTP 503");
        assertTrue(FeishuModelAlerts.message("task",error.getCode(),"ABCDEF234567",error).contains("HTTP 503"));
    }
    private String state(){return db.queryForObject("SELECT state FROM model_alert_delivery",String.class);}
}
