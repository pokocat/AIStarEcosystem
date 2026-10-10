package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.ipstudio.dto.StudioLipSyncDtos.*;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class StudioLipSyncServiceTest {
    final IpProjectService projects=mock(IpProjectService.class);final IpRunRepository runs=mock(IpRunRepository.class);
    final AiModelInvocationService models=mock(AiModelInvocationService.class);final StudioLipSyncMedia media=mock(StudioLipSyncMedia.class);
    final FileStorageService storage=mock(FileStorageService.class);final StudioSpeechWorker worker=mock(StudioSpeechWorker.class);final CreditService credits=mock(CreditService.class);
    final AiAppEndpointCandidate candidate=AiAppEndpointCandidate.builder().creditCostOverride(10L).enabled(true).build();
    final LipSyncRequest request=new LipSyncRequest("original","node","lips","owned/video.mp4","owned/voice.wav",40L);
    final AtomicReference<IpRun> saved=new AtomicReference<>();StudioLipSyncService service;
    @BeforeEach void setup() throws Exception {
        service=new StudioLipSyncService(projects,runs,models,media,storage,worker,credits,new ObjectMapper());
        var endpoint=AiModelEndpoint.builder().id("lips").model("x-dub").baseUrl("https://api.jusuanhub.com/v1").billingMode(AiModelBillingMode.PER_SECOND).enabled(true).build();
        when(models.resolveEndpoint(AiModelPurpose.DAP_LIP_SYNC,"lips")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,candidate,true)));
        when(projects.requireOwnedAssetKey(eq("owner"),anyString())).thenAnswer(i->i.getArgument(1));
        when(storage.openForRead(anyString())).thenAnswer(i->Path.of((String)i.getArgument(0)));
        when(media.inspect(any(),any())).thenReturn(new StudioLipSyncMedia.Inputs(3.52,5.07));
        when(runs.findByProjectIdAndClientRequestId("p","original")).thenAnswer(i->Optional.ofNullable(saved.get()));
        when(runs.save(any())).thenAnswer(i->{saved.set(i.getArgument(0));return saved.get();});TransactionSynchronizationManager.initSynchronization();
    }
    @AfterEach void cleanup(){TransactionSynchronizationManager.clearSynchronization();}
    @Test void exactDecodedAudioQuoteAndAfterCommitDispatchThenReplayAreIdempotent() {
        var q=service.quote("owner","p",new LipSyncInput("lips",request.videoStorageKey(),request.audioStorageKey()));assertEquals(40,q.cost());assertEquals(4,q.billableSeconds());verifyNoInteractions(credits,worker);
        service.submit("owner","p",request);verifyNoInteractions(worker);String id=saved.get().getId();
        TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCommit());verify(worker).execute(id);
        reset(models,media,storage);service.submit("owner","p",request);verifyNoInteractions(models,media,storage);
        verify(credits,times(1)).hold(eq("owner"),eq(40L),anyString(),eq(id),anyString());
        assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,()->service.submit("owner","p",new LipSyncRequest("original","node","lips","owned/another.mp4",request.audioStorageKey(),40L))).getCode());
    }
    @Test void ForeignAssetsAndPriceChangesCannotFreezeOrDispatch() {
        doThrow(BusinessException.badRequest("IP_ASSET_KEY_INVALID","foreign")).when(projects).requireOwnedAssetKey("owner","foreign/video.mp4");
        assertThrows(BusinessException.class,()->service.submit("owner","p",new LipSyncRequest("original","node","lips","foreign/video.mp4",request.audioStorageKey(),40L)));
        candidate.setCreditCostOverride(11L);assertEquals("STUDIO_PRICE_CHANGED",assertThrows(BusinessException.class,()->service.submit("owner","p",request)).getCode());
        candidate.setCreditCostOverride(null);assertEquals("STUDIO_LIP_SYNC_PRICE_NOT_CONFIGURED",assertThrows(BusinessException.class,()->service.submit("owner","p",request)).getCode());
        verifyNoInteractions(credits,worker);verify(runs,never()).save(any());
    }
    @Test void extractionOwnsExactCompletedRunAndReplaysWithoutNewStorageOrCharges() throws Exception {
        var result=mock(StudioLipSyncResult.class);org.springframework.test.util.ReflectionTestUtils.setField(service,"results",result);
        var run=IpRun.builder().id("r").projectId("p").ownerUserId("owner").kind("studio-lip-sync").status(IpRun.STATUS_DONE).cost(40)
                .inputJson("{\"videoStorageKey\":\"owned/video.mp4\"}").outputJson("{\"storageKey\":\"owned/result.mp4\",\"lipSyncNormalized\":true}").build();
        when(runs.lockById("r")).thenReturn(Optional.of(run));service.extract("owner","p","r");service.extract("owner","p","r");
        verifyNoInteractions(credits,worker,result,storage);
        assertThrows(BusinessException.class,()->service.extract("other","p","r"));assertThrows(BusinessException.class,()->service.extract("owner","other-project","r"));
        assertEquals(40,run.getCost());verify(runs,never()).save(any());
    }    @Test void fractionalSupplierMarkupUsesDecodedAudioSecondsAndOneTotalRounding() {
        var pricing=mock(StudioPointPricing.class);org.springframework.test.util.ReflectionTestUtils.setField(service,"pricing",pricing);
        when(pricing.enabled()).thenReturn(true);
        when(pricing.find("lips")).thenReturn(new StudioPointPricing.Rate(java.math.BigDecimal.ONE,java.math.BigDecimal.ONE,new java.math.BigDecimal("1.5")));
        var q=service.quote("owner","p",new LipSyncInput("lips",request.videoStorageKey(),request.audioStorageKey()));
        assertEquals(6,q.cost());assertEquals(4,q.billableSeconds());
        service.submit("owner","p",new LipSyncRequest("original","node","lips",request.videoStorageKey(),request.audioStorageKey(),6L));
        assertTrue(saved.get().getInputJson().contains("pointPricing"));assertEquals(6,saved.get().getCost());
    }

}
