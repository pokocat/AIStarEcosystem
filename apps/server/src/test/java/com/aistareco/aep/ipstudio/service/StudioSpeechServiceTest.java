package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.ipstudio.dto.StudioSpeechDtos.*;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class StudioSpeechServiceTest {
    final IpProjectService projects=mock(IpProjectService.class); final IpRunRepository runs=mock(IpRunRepository.class);
    final AiModelInvocationService models=mock(AiModelInvocationService.class);final JusuanSpeechClient client=mock(JusuanSpeechClient.class);
    final StudioSpeechWorker worker=mock(StudioSpeechWorker.class); final CreditService credits=mock(CreditService.class);
    final AiAppEndpointCandidate candidate=AiAppEndpointCandidate.builder().creditCostOverride(8L).enabled(true).build();
    final SpeechRequest request=new SpeechRequest("key","node","tts","欢迎。","Vivian",null,8L);
    final AtomicReference<IpRun> saved=new AtomicReference<>();StudioSpeechService service;
    @BeforeEach void setup() {
        service=new StudioSpeechService(projects,runs,models,client,worker,credits,new ObjectMapper());
        var endpoint=AiModelEndpoint.builder().id("tts").model("qwen3-tts").baseUrl("https://api.jusuanhub.com/v1").enabled(true).build();
        when(models.resolveEndpoint(AiModelPurpose.DAP_AUDIO,"tts")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,candidate,true)));
        when(client.voices(endpoint)).thenReturn(List.of(new SpeechVoice("Vivian","Vivian","zh-CN","preset")));
        when(runs.findByProjectIdAndClientRequestId("p","key")).thenAnswer(i->Optional.ofNullable(saved.get()));
        when(runs.save(any())).thenAnswer(i->{saved.set(i.getArgument(0));return saved.get();});
        TransactionSynchronizationManager.initSynchronization();
    }
    @AfterEach void cleanup(){TransactionSynchronizationManager.clearSynchronization();}
    @Test void originalKeySurvivesReloadAndWhitelistingChangesWithoutSecondHold() {
        service.submit("owner","p",request);verifyNoInteractions(worker);
        String runId=saved.get().getId();TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCommit());verify(worker).execute(runId);
        reset(models,client);service.submit("owner","p",request);
        verify(credits,times(1)).hold(eq("owner"),eq(8L),anyString(),eq(runId),anyString());verifyNoInteractions(models,client);
        assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,()->service.submit("owner","p",new SpeechRequest("key","node","tts","改变台词。","Vivian",null,8L))).getCode());
    }
    @Test void priceChangesAndUnpricedModelsAreRejectedBeforeFreeze() {
        candidate.setCreditCostOverride(9L);
        assertEquals("STUDIO_PRICE_CHANGED",assertThrows(BusinessException.class,()->service.submit("owner","p",request)).getCode());
        candidate.setCreditCostOverride(null);
        assertEquals("STUDIO_SPEECH_PRICE_NOT_CONFIGURED",assertThrows(BusinessException.class,()->service.submit("owner","p",request)).getCode());
        verifyNoInteractions(credits,worker);verify(runs,never()).save(any());
    }
    @Test void foreignProjectAndUnsupportedVoiceNeverReachPaidProvider() {
        doThrow(BusinessException.badRequest("IP_PROJECT_NOT_FOUND","owner mismatch")).when(projects).requiredForUpdate("foreign","p");
        assertThrows(BusinessException.class,()->service.submit("foreign","p",request));
        assertEquals("STUDIO_SPEECH_VOICE_INVALID",assertThrows(BusinessException.class,()->service.submit("owner","p",new SpeechRequest("key","node","tts","欢迎。","Not Published",null,8L))).getCode());
        verifyNoInteractions(credits,worker);verify(client,never()).submit(any(),anyString(),anyString(),anyString(),anyString());
    }
    @Test void exactVoiceIsFrozenAndChangedStyleRejectedBeforeHold() {
        var profiles=mock(StudioVoiceService.class);org.springframework.test.util.ReflectionTestUtils.setField(service,"profiles",profiles);
        var v=com.aistareco.aep.dap.model.DapVoice.builder().id("v1").avatarId("a").name("声音").profileVersion(1).engineRef("Vivian").stylePrompt("温暖").build();
        when(profiles.requiredProfile("owner","a","v1")).thenReturn(v);
        assertEquals("STUDIO_VOICE_REQUEST_CHANGED",assertThrows(BusinessException.class,()->service.submit("owner","p",new SpeechRequest("key","node","tts","欢迎。","Vivian","不同",8L,"a","v1"))).getCode());verifyNoInteractions(credits);
        var exact=new SpeechRequest("key","node","tts","欢迎。","Vivian","温暖",8L,"a","v1");service.submit("owner","p",exact);
        assertTrue(saved.get().getInputJson().contains("appliedVoice"));assertTrue(saved.get().getInputJson().contains("\"version\":1"));
        reset(profiles,models,client);service.submit("owner","p",exact);verifyNoInteractions(profiles,models,client);verify(credits,times(1)).hold(anyString(),anyLong(),anyString(),anyString(),anyString());
    }
    @Test void oldUnboundRequestsKeepOriginalFingerprint() throws Exception {
        service.submit("owner","p",request);
        String legacy="{\"clientRequestId\":\"key\",\"nodeId\":\"node\",\"model\":\"tts\",\"text\":\"欢迎。\",\"speaker\":\"Vivian\",\"instruct\":null,\"maxCost\":8}";
        String hash=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(legacy.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        assertEquals(hash,saved.get().getInputFingerprint());
    }
    @Test void supplierPricingFreezesBudgetAndCannotFallbackToOldFlatPrice() throws Exception {
        var pricing=mock(StudioPointPricing.class);org.springframework.test.util.ReflectionTestUtils.setField(service,"pricing",pricing);
        when(pricing.enabled()).thenReturn(true);
        when(pricing.find("tts")).thenReturn(new StudioPointPricing.Rate(java.math.BigDecimal.ONE,java.math.BigDecimal.ONE,new java.math.BigDecimal("1.5")));
        var approved=new SpeechRequest("key","node","tts","欢迎。","Vivian",null,20L);
        service.submit("owner","p",approved);assertEquals(20,saved.get().getCost());
        assertEquals(1.5,new ObjectMapper().readTree(saved.get().getInputJson()).path("_exec").path("pointPricing").path("markupMultiplier").asDouble());
        verify(credits).hold(eq("owner"),eq(20L),anyString(),anyString(),anyString());
        reset(pricing);when(pricing.enabled()).thenReturn(true);
        service.submit("owner","p",approved); // replay does not consult a new price
        assertEquals("STUDIO_SPEECH_PRICE_NOT_CONFIGURED",assertThrows(BusinessException.class,()->service.submit("owner","p",new SpeechRequest("other","node","tts","欢迎。","Vivian",null,8L))).getCode());
        verify(credits,times(1)).hold(anyString(),anyLong(),anyString(),anyString(),anyString());
    }

}
