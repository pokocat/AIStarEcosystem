package com.aistareco.aep.service;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.materialvideo.MaterialVideoWorker;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Instant;
import java.util.*;
import static org.mockito.Mockito.*;

class AiGenerationQueueDispatcherTest {
    final AiGenerationQueueService queue=mock(AiGenerationQueueService.class);
    final IpRunRepository runs=mock(IpRunRepository.class);
    final MaterialVideoJobRepository videos=mock(MaterialVideoJobRepository.class);
    final IpRunWorker images=mock(IpRunWorker.class);
    final MaterialVideoWorker videoWorker=mock(MaterialVideoWorker.class);
    AiGenerationQueueDispatcher dispatcher;

    @SuppressWarnings("unchecked") private <T> ObjectProvider<T> provider(T worker) {
        ObjectProvider<T> provider=mock(ObjectProvider.class);when(provider.getObject()).thenReturn(worker);return provider;
    }
    @BeforeEach void prepare() {
        dispatcher=new AiGenerationQueueDispatcher(queue,runs,videos,provider(images),provider(mock(StudioWorkflowWorker.class)),
            provider(mock(StudioSpeechWorker.class)),provider(videoWorker));
        ReflectionTestUtils.setField(dispatcher,"mapper",new ObjectMapper());
        when(queue.endpointFor(any(),any())).thenReturn("e");
    }
    @Test void legacyAcceptedOrUncertainSpeechRunsCountAsExecuting() {
        var accepted=IpRun.builder().id("accepted").kind("studio-audio").status("running").stage("audio.running")
            .inputJson("{\"_exec\":{\"jobId\":\"original\"}}").build();
        var uncertain=IpRun.builder().id("uncertain").kind("studio-lip-sync").status("running").stage("lip-sync.submission_unknown")
            .inputJson("{\"_exec\":{\"submitAttempts\":1}}").build();
        var waiting=IpRun.builder().id("waiting").kind("studio-audio").status("running").stage("endpoint.queued")
            .inputJson("{\"_exec\":{}}").build();
        when(runs.findByStatus("running")).thenReturn(List.of(accepted,uncertain,waiting));
        dispatcher.dispatch();
        verify(queue).register(AiGenerationQueueService.SPEECH,"accepted","e",true);
        verify(queue).register(AiGenerationQueueService.SPEECH,"uncertain","e",true);
        verify(queue).register(AiGenerationQueueService.SPEECH,"waiting","e",false);
    }
    @Test void waitingImageResumesOriginalRunOncePerDispatchLease() {
        var ticket=ticket(AiGenerationQueueService.IMAGE,"run","waiting");
        when(queue.openEntries()).thenReturn(List.of(ticket));
        when(runs.findById("run")).thenReturn(Optional.of(IpRun.builder().status("running").build()));
        when(queue.claimDispatch(ticket,false)).thenReturn(true,false);
        dispatcher.dispatch();dispatcher.dispatch();
        verify(images,times(1)).execute("run");verifyNoInteractions(videoWorker);
    }
    @Test void acceptedVideoRecoveryOnlyQueriesOriginalTask() {
        var ticket=ticket(AiGenerationQueueService.VIDEO,"video","running");
        when(queue.openEntries()).thenReturn(List.of(ticket));
        when(videos.findById("video")).thenReturn(Optional.of(MaterialVideoJob.builder().status("generating").externalTaskId("original").build()));
        when(queue.claimDispatch(ticket,true)).thenReturn(true);
        dispatcher.dispatch();verify(videoWorker).recoverQueuedGeneration("video");
        verify(videoWorker,never()).generateAsync(any());
    }
    private AiGenerationQueueEntry ticket(String type,String id,String state) {
        var ticket=new AiGenerationQueueEntry();ticket.setId(1L);ticket.setTaskType(type);ticket.setTaskId(id);
        ticket.setEndpointId("e");ticket.setState(state);ticket.setDispatchAfter(Instant.now());return ticket;
    }
}
