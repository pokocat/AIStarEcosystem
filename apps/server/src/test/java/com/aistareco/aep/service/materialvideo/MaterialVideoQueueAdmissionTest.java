package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.storage.StorageQuotaService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.OffsetDateTime;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class MaterialVideoQueueAdmissionTest {
    final MaterialVideoJobRepository jobs=mock(MaterialVideoJobRepository.class);
    final MaterialVideoModelClient client=mock(MaterialVideoModelClient.class);
    final CreditService credits=mock(CreditService.class);
    final AiGenerationQueueService queue=mock(AiGenerationQueueService.class);
    final MaterialVideoJob job=MaterialVideoJob.builder().id("job").ownerUserId("u").status("queued").durationSec(5)
        .creditsHeld(8).createdAt(OffsetDateTime.now()).build();
    MaterialVideoWorker worker;
    @BeforeEach void prepare(){
        when(jobs.findById("job")).thenReturn(Optional.of(job));when(jobs.save(any())).thenAnswer(i->i.getArgument(0));
        when(jobs.claimQueued(eq("job"),any())).thenAnswer(i->{job.setStatus("submitting");return 1;});
        when(queue.endpointFor(any(),any())).thenReturn("e");
        when(queue.acquire(AiGenerationQueueService.VIDEO,"job","e",false)).thenReturn(AiGenerationQueueService.Admission.READY);
        @SuppressWarnings("unchecked") ObjectProvider<CdnUploader> provider=mock(ObjectProvider.class);
        worker=new MaterialVideoWorker(jobs,client,new MaterialVideoProperties(),credits,mock(StorageQuotaService.class),provider,mock(MaterialVideoCover.class));
        ReflectionTestUtils.setField(worker,"queue",queue);
    }
    @Test void waitingNeverCallsProviderOrSettlesCredits(){
        when(queue.acquire(any(),any(),any(),eq(false))).thenReturn(AiGenerationQueueService.Admission.WAITING);
        worker.generateAsync("job");assertEquals("queued",job.getStatus());
        verifyNoInteractions(client,credits);verify(queue,never()).finish(any(),any());verify(jobs,never()).claimQueued(any(),any());
    }
    @Test void definiteRejectionReleasesCapacity(){
        when(client.submit(any(),anyInt(),any(),any(),any(),any(),any())).thenThrow(com.aistareco.common.BusinessException.badRequest("VIDEO_NOT_CONFIGURED","disabled"));
        worker.generateAsync("job");verify(queue).finish(AiGenerationQueueService.VIDEO,"job");
    }
    @Test void unknownSubmissionKeepsCapacityAndCannotBeResubmitted(){
        when(client.submit(any(),anyInt(),any(),any(),any(),any(),any())).thenThrow(new MaterialVideoModelClient.SubmissionUnknown("timeout"));
        worker.generateAsync("job");verify(queue,never()).finish(any(),any());
        worker.recoverQueuedGeneration("job");verify(client,times(1)).submit(any(),anyInt(),any(),any(),any(),any(),any());
    }
    @Test void originalJobRecoveryNeverSubmitsAnotherGeneration(){
        job.setStatus("failed");job.setExternalTaskId("original");
        var submitted=new MaterialVideoModelClient.SubmitResult("original",null,"provider","model","generic","e");
        when(client.resumeExistingTask(any(),any(),any(),any())).thenReturn(submitted);
        when(client.poll(submitted)).thenReturn(new MaterialVideoModelClient.PollResult("failed",null,null,"failed",100,"rejected",null,null));
        worker.recoverQueuedGeneration("job");verify(client,never()).submit(any(),anyInt(),any(),any(),any(),any(),any());
        verify(queue).finish(AiGenerationQueueService.VIDEO,"job");verifyNoInteractions(credits);
    }
}
