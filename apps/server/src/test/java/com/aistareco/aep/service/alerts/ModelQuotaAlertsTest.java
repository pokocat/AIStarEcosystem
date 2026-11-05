package com.aistareco.aep.service.alerts;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.ai.ModelCallCtx;
import com.aistareco.aep.service.ai.ModelProviderRejected;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import db.migration.V64__model_alert_delivery;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class ModelQuotaAlertsTest {
    /** Verbatim from production, 2026-11-05 07:54 CST. */
    private static final String ONETOKEN_429="{\"code\":\"API_KEY_QUOTA_EXHAUSTED\",\"message\":\"API key quota exhausted (API key 额度已用完). Raise or reset this key's quota in Console → API Keys, or use another key. 请在控制台 → API Keys 提高或重置该 Key 额度，或使用其他 Key。\"}";
    /** The fields of a real OneToken GET /v1/usage response, 2026-11-05. */
    private static final String USAGE="{\"balance\":%s,\"isValid\":%s,\"mode\":\"unrestricted\",\"planName\":\"钱包余额\",\"remaining\":%s,\"unit\":\"USD\",\"usage\":{\"today\":{\"actual_cost\":0.55,\"requests\":25}}}";

    JdbcTemplate db;FeishuAlertConfig config;FeishuAlertClient client;FeishuModelAlerts delivery;
    PlatformConfigService platform;AiModelEndpointRepository endpoints;ModelQuotaAlerts alerts;HttpServer server;
    final AtomicReference<String> usageBody=new AtomicReference<>();final AtomicInteger usageStatus=new AtomicInteger(200);final AtomicReference<String> auth=new AtomicReference<>();
    final ObjectMapper mapper=new ObjectMapper();

    @BeforeEach void setup() throws Exception {
        var ds=new DriverManagerDataSource("jdbc:h2:mem:quota-"+java.util.UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1","sa","");
        db=new JdbcTemplate(ds);
        try(var c=ds.getConnection()){var context=mock(Context.class);when(context.getConnection()).thenReturn(c);new V64__model_alert_delivery().migrate(context);}
        db.execute("CREATE TABLE ai_app_binding (purpose VARCHAR(40), endpoint_id VARCHAR(64))");
        db.update("INSERT INTO ai_app_binding VALUES ('DAP_PERSONA','ep-1'),('GENERAL','ep-1'),('DAP_IMAGE','ep-other')");
        config=new FeishuAlertConfig();config.setEnabled(true);config.setAppId("app");config.setAppSecret("secret");config.setChatId("oc_group");config.setUserId("ou_person");
        client=mock(FeishuAlertClient.class);when(client.send(anyString(),anyString())).thenReturn("om_message");
        delivery=new FeishuModelAlerts(db,config,client);
        platform=mock(PlatformConfigService.class);endpoints=mock(AiModelEndpointRepository.class);
        alerts=new ModelQuotaAlerts(db,config,delivery,platform,endpoints,mapper);
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/v1/usage",exchange->{
            auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] reply=usageBody.get().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(usageStatus.get(),reply.length);
            try(var out=exchange.getResponseBody()){out.write(reply);}
        });
        server.start();
    }
    @AfterEach void stop(){server.stop(0);}

    private AiModelEndpoint endpoint() {
        return AiModelEndpoint.builder().id("ep-1").name("OneToken").providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("http://127.0.0.1:"+server.getAddress().getPort()+"/v1").model("claude-sonnet-5-5")
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("the-real-key")).enabled(true).build();
    }
    private void watch(String warnBelow) throws Exception {
        var value=mapper.readTree("{\"endpoints\":{\"ep-1\":{\"usagePath\":\"/usage\",\"warnBelow\":"+warnBelow+"}}}");
        when(platform.findByKey(ModelQuotaAlerts.WATCH_KEY)).thenReturn(Optional.of(new PlatformConfigDto(ModelQuotaAlerts.WATCH_KEY,value,1,null,Instant.now(),null)));
        when(endpoints.findById("ep-1")).thenReturn(Optional.of(endpoint()));
    }
    private void usage(String remaining,boolean valid){usageBody.set(USAGE.formatted(remaining,valid,remaining));}
    private int rows(){return db.queryForObject("SELECT COUNT(*) FROM model_alert_delivery",Integer.class);}
    private String code(){return db.queryForObject("SELECT error_code FROM model_alert_delivery",String.class);}
    private String text(){return db.queryForObject("SELECT message_text FROM model_alert_delivery",String.class);}

    @ParameterizedTest
    @ValueSource(strings={ONETOKEN_429,"{\"error\":{\"code\":\"insufficient_quota\",\"message\":\"You exceeded your current quota\"}}",
            "{\"error\":{\"message\":\"预扣费额度失败, 用户剩余额度: ¥0.0\"}}","{\"error\":{\"code\":\"Arrearage\",\"message\":\"account in arrears\"}}","余额不足"})
    void recognisesSuppliersRunningOutOfQuota(String body){assertTrue(ModelQuotaAlerts.isOutOfQuota(body));}

    @ParameterizedTest
    @ValueSource(strings={"{\"error\":{\"code\":\"rate_limit_exceeded\",\"message\":\"Rate limit reached, quota exhausted for this minute\"}}",
            "{\"error\":\"Too Many Requests\"}","{\"message\":\"invalid api key\"}","{\"error\":\"content_policy_violation\"}","<html>502</html>",""})
    void doesNotTreatOtherFailuresAsQuota(String body){assertFalse(ModelQuotaAlerts.isOutOfQuota(body));}

    @Test void manyRefusedCallsBecomeOneAlertNamingTheEndpointAndItsPurposes() throws Exception {
        for(int i=0;i<5;i++)alerts.onRejected(new ModelProviderRejected("ep-1","OneToken","claude-sonnet-5-5",429,ONETOKEN_429));
        alerts.flushRefused();
        alerts.onRejected(new ModelProviderRejected("ep-1","OneToken","claude-sonnet-5-5",429,ONETOKEN_429));
        alerts.flushRefused();
        assertEquals(1,rows());assertEquals(ModelQuotaAlerts.EXHAUSTED,code());
        String message=text();
        assertTrue(message.contains("ep-1"));assertTrue(message.contains("API_KEY_QUOTA_EXHAUSTED"));
        assertTrue(message.contains("DAP_PERSONA"));assertTrue(message.contains("GENERAL"));assertFalse(message.contains("DAP_IMAGE"));
        delivery.deliver();
        assertEquals("sent",db.queryForObject("SELECT state FROM model_alert_delivery",String.class));
        verify(client).send(anyString(),eq(message));
    }

    @Test void differentEndpointsAlertSeparately() {
        alerts.onRejected(new ModelProviderRejected("ep-1","A","m",429,ONETOKEN_429));
        alerts.onRejected(new ModelProviderRejected("ep-2","B","m",429,ONETOKEN_429));
        alerts.flushRefused();
        assertEquals(2,rows());
    }

    @Test void otherRefusalsAndMissingConfigStoreNothing() {
        alerts.onRejected(new ModelProviderRejected("ep-1","A","m",429,"{\"error\":\"Too Many Requests\"}"));
        alerts.onRejected(new ModelProviderRejected(null,"A","m",429,ONETOKEN_429));
        alerts.flushRefused();
        assertEquals(0,rows());
        config.setEnabled(false);
        alerts.onRejected(new ModelProviderRejected("ep-1","A","m",429,ONETOKEN_429));
        alerts.flushRefused();
        assertEquals(0,rows());
    }

    @Test void balanceAboveTheLineSendsNothingAndUsesTheEndpointKey() throws Exception {
        watch("10");usage("72.6",true);
        alerts.checkBalances();
        assertEquals(0,rows());assertEquals("Bearer the-real-key",auth.get());
    }

    @Test void balanceBelowTheLineWarnsOnceADayAndNeverPrintsTheKey() throws Exception {
        watch("10");usage("9.5",true);
        alerts.checkBalances();alerts.checkBalances();
        assertEquals(1,rows());assertEquals(ModelQuotaAlerts.LOW,code());
        assertTrue(text().contains("9.5 USD"));assertTrue(text().contains("余额用完后"),"calls still work while the balance is merely low");assertTrue(text().contains("0.55"));assertFalse(text().contains("the-real-key"));
    }

    @Test void emptyBalanceAndInvalidKeyAreExhausted() throws Exception {
        watch("10");usage("0",true);
        alerts.checkBalances();
        assertEquals(ModelQuotaAlerts.EXHAUSTED,code());
        db.update("DELETE FROM model_alert_delivery");
        usage("50",false);
        alerts.checkBalances();
        assertEquals(ModelQuotaAlerts.EXHAUSTED,code());
    }

    @Test void aRefusedBalanceCheckCountsAsOutOfQuota() throws Exception {
        watch("10");usageStatus.set(429);usageBody.set(ONETOKEN_429);
        alerts.checkBalances();alerts.flushRefused();
        assertEquals(ModelQuotaAlerts.EXHAUSTED,code());
    }

    @Test void aCheckThatKeepsFailingAlertsOnceAndRecovers() throws Exception {
        watch("10");usageStatus.set(500);usageBody.set("oops");
        for(int i=0;i<5;i++)alerts.checkBalances();
        assertEquals(0,rows());
        for(int i=0;i<4;i++)alerts.checkBalances();
        assertEquals(1,rows());assertEquals(ModelQuotaAlerts.UNREADABLE,code());
        usageStatus.set(200);usage("72.6",true);
        alerts.checkBalances();
        assertEquals(1,rows());
    }

    @Test void aResponseWithoutRemainingIsAFailedCheckNotAHealthyOne() throws Exception {
        watch("10");usageBody.set("{\"balance\":1}");
        for(int i=0;i<6;i++)alerts.checkBalances();
        assertEquals(ModelQuotaAlerts.UNREADABLE,code());
    }

    @Test void disabledEndpointIsNotChecked() throws Exception {
        watch("10");usage("0",true);
        var off=endpoint();off.setEnabled(false);
        when(endpoints.findById("ep-1")).thenReturn(Optional.of(off));
        alerts.checkBalances();
        assertEquals(0,rows());assertNull(auth.get());
    }

    @Test void theHttpLayerAnnouncesRefusalsAndAFailingObserverDoesNotChangeTheResult() throws Exception {
        server.createContext("/v1/chat/completions",exchange->{
            byte[] reply=ONETOKEN_429.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(429,reply.length);
            try(var out=exchange.getResponseBody()){out.write(reply);}
        });
        List<Object> seen=new ArrayList<>();
        ApplicationEventPublisher publisher=event->{seen.add(event);throw new IllegalStateException("observer broke");};
        var http=new UpstreamModelHttp(mock(AiModelUsageService.class));
        ReflectionTestUtils.setField(http,"events",publisher);
        var ctx=ModelCallCtx.builder(AiModelPurpose.GENERAL).client(HttpClient.newHttpClient()).endpoint("ep-1","OneToken").model("m").recordFailureUsage(false).build();
        var uri=URI.create("http://127.0.0.1:"+server.getAddress().getPort()+"/v1/chat/completions");
        var plain=http.sendJson(HttpRequest.newBuilder(uri).POST(HttpRequest.BodyPublishers.noBody()).build(),ctx);
        assertEquals(429,plain.statusCode());
        var stream=http.sendStream(HttpRequest.newBuilder(uri).POST(HttpRequest.BodyPublishers.noBody()).build(),ctx,line->true,()->false,java.time.Duration.ofSeconds(5),java.time.Duration.ofSeconds(5));
        assertEquals(429,stream.status());
        assertEquals(2,seen.size());
        var event=assertInstanceOf(ModelProviderRejected.class,seen.get(1));
        assertEquals("ep-1",event.endpointId());assertEquals(ONETOKEN_429,event.body());
    }
}
