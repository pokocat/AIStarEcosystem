package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.transaction.*;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.time.Instant;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class StudioSpeechLifecycleTest {
    final IpRunRepository runs=mock(IpRunRepository.class);final AiModelEndpointRepository endpoints=mock(AiModelEndpointRepository.class);
    final JusuanSpeechClient client=mock(JusuanSpeechClient.class);final CreditService credits=mock(CreditService.class);
    final FileStorageService storage=mock(FileStorageService.class);final ObjectMapper mapper=new ObjectMapper();
    final PlatformTransactionManager manager=mock(PlatformTransactionManager.class);
    final AiModelEndpoint endpoint=AiModelEndpoint.builder().id("tts").name("Qwen").build();
    StudioSpeechWorker worker;IpRun run;
    @BeforeEach void setup() {
        when(manager.getTransaction(any())).thenAnswer(i->{assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW,((TransactionDefinition)i.getArgument(0)).getPropagationBehavior());return new SimpleTransactionStatus();});
        worker=new StudioSpeechWorker(runs,endpoints,client,storage,credits,mock(AiModelUsageService.class),mapper,manager);
        run=IpRun.builder().id("r").kind("studio-audio").status("running").cost(8).ownerUserId("owner").heartbeatAt(Instant.now())
                .inputJson("{\"speaker\":\"Vivian\",\"text\":\"台词。\",\"_exec\":{\"endpointId\":\"tts\",\"baseUrl\":\"https://api.jusuanhub.com/v1\",\"requestBody\":\"original-bytes\"}}").outputJson("{}").build();
        when(runs.lockById("r")).thenReturn(Optional.of(run));when(endpoints.findById("tts")).thenReturn(Optional.of(endpoint));
    }
    @Test void restartQueriesOriginalJobAndCommitsExactlyOnce() throws Exception {
        when(client.submit(any(),anyString(),eq("original-bytes"),eq("r"),eq("owner"))).thenReturn(new JusuanSpeechClient.Job("job_r","https://api.jusuanhub.com/v1/jobs/job_r?model=qwen3-tts"));
        when(client.poll(any(),anyString(),anyString(),eq("r"),anyString())).thenReturn(mapper.readTree("{\"status\":\"succeeded\",\"outputs\":[{\"contentUrl\":\"https://api.jusuanhub.com/v1/assets/a/content?model=qwen3-tts\"}]}"));
        when(client.download(any(),anyString(),anyString(),anyString(),anyString())).thenReturn(new JusuanSpeechClient.Audio(new byte[200],"wav","audio/wav",4.2));
        when(storage.store(any(byte[].class),eq(IpProjectService.CATEGORY_GEN),eq("owner"),eq("wav"),eq("audio/wav")))
                .thenReturn(new FileStorageService.StoredFile("ipstudio_gen/owner/speech.wav",null,null,null,200,"audio/wav"));
        worker.step("r");assertEquals("running",run.getStatus());
        worker=new StudioSpeechWorker(runs,endpoints,client,storage,credits,mock(AiModelUsageService.class),mapper,manager);
        worker.step("r");worker.step("r");
        assertEquals("done",run.getStatus());assertEquals(4.2,mapper.readTree(run.getOutputJson()).path("durationSec").asDouble());
        verify(client,times(1)).submit(any(),anyString(),anyString(),anyString(),anyString());
        verify(credits,times(1)).commitHold(anyString(),eq("r"),eq(8L),anyString());verify(credits,never()).releaseHold(anyString(),anyString(),anyString());
    }
    @Test void transientPollingFailureKeepsHoldAndOriginalJob() throws Exception {
        run.setInputJson("{\"_exec\":{\"endpointId\":\"tts\",\"baseUrl\":\"https://api.jusuanhub.com/v1\",\"jobId\":\"job_r\",\"jobUrl\":\"url\"}}");
        when(client.poll(any(),anyString(),anyString(),anyString(),anyString())).thenThrow(new IllegalStateException("network"));
        worker.step("r");worker.step("r");assertEquals("running",run.getStatus());
        verify(client,never()).submit(any(),anyString(),anyString(),anyString(),anyString());verifyNoInteractions(credits);
    }
    @Test void rejectedSubmissionRefundsOnceWithoutBlindRetry() {
        when(client.submit(any(),anyString(),anyString(),anyString(),anyString())).thenThrow(new JusuanSpeechClient.Rejected("STUDIO_SPEECH_REJECTED","rejected"));
        worker.step("r");worker.step("r");assertEquals("failed",run.getStatus());assertEquals(0,run.getCost());
        verify(credits,times(1)).releaseHold(anyString(),eq("r"),anyString());
    }
    @Test void cancelledBeforeProviderAdmissionDoesNotSubmit() {
        run.setCancelRequested(true);worker.step("r");assertEquals("failed",run.getStatus());verifyNoInteractions(client);
    }
    @Test void lipSyncStagesBothAssetsAndRestartOnlyPollsTheOriginalJob() throws Exception {
        var lips=mock(JusuanLipSyncClient.class);
        org.springframework.test.util.ReflectionTestUtils.setField(worker,"lips",lips);
        run.setKind("studio-lip-sync");run.setCost(40);
        run.setInputJson("{\"videoStorageKey\":\"owned/video.mp4\",\"audioStorageKey\":\"owned/voice.wav\",\"_exec\":{\"endpointId\":\"tts\",\"baseUrl\":\"https://api.jusuanhub.com/v1\",\"audioDurationSec\":3.52,\"billableSeconds\":4}}");
        when(storage.openForRead(anyString())).thenAnswer(i->java.nio.file.Path.of((String)i.getArgument(0)));
        when(lips.upload(any(),anyString(),any(),eq("video"),eq("r"),anyString())).thenReturn("asset_video");
        when(lips.upload(any(),anyString(),any(),eq("audio"),eq("r"),anyString())).thenReturn("asset_audio");
        when(lips.submit(any(),anyString(),anyString(),eq("r"),anyString())).thenReturn(new JusuanSpeechClient.Job("job_lips","https://api.jusuanhub.com/v1/jobs/job_lips?model=x-dub"));
        when(lips.poll(any(),anyString(),anyString(),anyString(),anyString())).thenReturn(mapper.readTree("{\"status\":\"succeeded\",\"outputs\":[{\"contentUrl\":\"https://api.jusuanhub.com/v1/assets/a/content?model=x-dub\"}]}"));
        when(lips.download(any(),anyString(),anyString(),anyString())).thenReturn(new JusuanLipSyncClient.Video(new byte[200],3.52,720,1280));
        when(storage.store(any(byte[].class),eq(IpProjectService.CATEGORY_GEN),eq("owner"),eq("mp4"),eq("video/mp4"))).thenReturn(new FileStorageService.StoredFile("ipstudio_gen/owner/lips.mp4",null,null,null,200,"video/mp4"));
        worker.step("r");worker.step("r");worker.step("r");worker.step("r");assertEquals("running",run.getStatus());
        worker=new StudioSpeechWorker(runs,endpoints,client,storage,credits,mock(AiModelUsageService.class),mapper,manager);
        org.springframework.test.util.ReflectionTestUtils.setField(worker,"lips",lips);worker.step("r");worker.step("r");
        assertEquals("done",run.getStatus());assertTrue(mapper.readTree(run.getOutputJson()).path("lipSync").asBoolean());
        var bytes=org.mockito.ArgumentCaptor.forClass(String.class);verify(lips,times(1)).submit(any(),anyString(),bytes.capture(),eq("r"),anyString());
        JsonBody.assertNativeLipBody(mapper,bytes.getValue());
        verify(lips,times(2)).upload(any(),anyString(),any(),anyString(),anyString(),anyString());verifyNoInteractions(client);
        verify(credits,times(1)).commitHold(anyString(),eq("r"),eq(40L),anyString());
    }

    @Test void mirroredProfileAudioSettlesAndRecordsUsageExactlyOnce() {
        var assets=mock(com.aistareco.aep.dap.service.DapAssetService.class);org.springframework.test.util.ReflectionTestUtils.setField(worker,"assets",assets);
        run.setProjectId("p");run.setInputJson("{\"appliedVoice\":{\"voiceId\":\"v1\",\"name\":\"声音\",\"version\":1},\"_exec\":{\"endpointId\":\"tts\"}}");run.setOutputJson("{\"storageKey\":\"owned/audio.wav\"}");
        worker.step("r");worker.step("r");assertEquals("done",run.getStatus());
        verify(assets,times(1)).recordUsage(eq("owner"),eq("voice"),eq("v1"),eq("studio-project"),eq("p"),anyString(),eq("声音 · v1"),isNull());
        verify(credits,times(1)).commitHold(anyString(),eq("r"),eq(8L),anyString());verifyNoInteractions(client);
    }
    @Test void actualDurationSettlesSnapshotAndRefundsTheUnusedReservationOnlyOnce() {
        run.setCost(30);
        run.setInputJson("{\"_exec\":{\"endpointId\":\"tts\",\"holdTotal\":30,\"pointPricing\":{\"supplierPointsPerSecond\":1,\"supplierToPlatformRatio\":1,\"markupMultiplier\":1.5}}}");
        run.setOutputJson("{\"storageKey\":\"owned/audio.wav\",\"durationSec\":3.52}");
        worker.step("r");worker.step("r");
        assertEquals("done",run.getStatus());assertEquals(6,run.getCost());
        verify(credits,times(1)).commitHold(anyString(),eq("r"),eq(6L),anyString());
        verify(credits,times(1)).releaseHold(anyString(),eq("r"),anyString());verifyNoInteractions(client,storage);
    }
    @Test void audioBeyondApprovedCeilingFailsWithoutChargingMore() {
        run.setCost(3);
        run.setInputJson("{\"_exec\":{\"endpointId\":\"tts\",\"holdTotal\":3,\"pointPricing\":{\"supplierPointsPerSecond\":1,\"supplierToPlatformRatio\":1,\"markupMultiplier\":1.5}}}");
        run.setOutputJson("{\"storageKey\":\"owned/audio.wav\",\"durationSec\":3.52}");
        worker.step("r");worker.step("r");
        assertEquals("failed",run.getStatus());assertEquals(0,run.getCost());
        assertEquals("STUDIO_SPEECH_COST_LIMIT_EXCEEDED",run.getErrorCode());assertEquals("{}",run.getOutputJson());
        verify(credits,never()).commitHold(anyString(),anyString(),anyLong(),anyString());
        verify(credits,times(1)).releaseHold(anyString(),eq("r"),anyString());
    }
    private static class JsonBody {
        static void assertNativeLipBody(ObjectMapper mapper,String body)throws Exception {
            var value=mapper.readTree(body);assertEquals(3,value.size());assertEquals("x-dub",value.path("model").asText());
            assertEquals("asset_video",value.path("input_video_asset_id").asText());assertEquals("asset_audio",value.path("input_audio_asset_id").asText());
        }
    }
}
