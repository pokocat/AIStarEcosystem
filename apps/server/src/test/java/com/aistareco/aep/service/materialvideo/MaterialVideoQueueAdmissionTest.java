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
        var props=new MaterialVideoProperties();props.setPollIntervalSeconds(1);
        worker=new MaterialVideoWorker(jobs,client,props,credits,mock(StorageQuotaService.class),provider,mock(MaterialVideoCover.class));
        ReflectionTestUtils.setField(worker,"queue",queue);
    }
    @Test void waitingNeverCallsProviderOrSettlesCredits(){
        when(queue.acquire(any(),any(),any(),eq(false))).thenReturn(AiGenerationQueueService.Admission.WAITING);
        worker.generateAsync("job");assertEquals("queued",job.getStatus());
        verifyNoInteractions(client,credits);verify(queue,never()).finish(any(),any());verify(jobs,never()).claimQueued(any(),any());
    }
    @Test void definiteRejectionReleasesCapacity(){
        when(client.submit(any(),anyInt(),any(),any(),any(),any(),any(),any())).thenThrow(com.aistareco.common.BusinessException.badRequest("VIDEO_NOT_CONFIGURED","disabled"));
        worker.generateAsync("job");verify(queue).finish(AiGenerationQueueService.VIDEO,"job");
    }
    @Test void unknownSubmissionFailsRefundsAndCannotAutomaticallyResubmit(){
        when(client.submit(any(),anyInt(),any(),any(),any(),any(),any(),any())).thenThrow(new MaterialVideoModelClient.SubmissionUnknown("timeout"));
        worker.generateAsync("job");verify(queue).finish(AiGenerationQueueService.VIDEO,"job");
        assertEquals("failed",job.getStatus());assertEquals("VIDEO_SUBMISSION_UNKNOWN",job.getErrorCode());
        verify(credits).releaseHold(eq(MaterialVideoJobService.CREDIT_REF_TYPE),eq("job"),any());
        worker.generateAsync("job");worker.recoverQueuedGeneration("job");verify(client,times(1)).submit(any(),anyInt(),any(),any(),any(),any(),any(),any());
    }
    @Test void historicalUnknownIsClosedOnceWithoutAnyProviderCall() {
        job.setStatus("submitting");job.setErrorCode("VIDEO_SUBMISSION_UNKNOWN");
        worker.failUnconfirmedSubmission("job");worker.failUnconfirmedSubmission("job");
        assertEquals("failed",job.getStatus());assertTrue(job.getErrorMessage().startsWith(com.aistareco.aep.service.GenerationSubmissionFailure.MESSAGE),job.getErrorMessage());
        verify(credits,times(1)).releaseHold(eq(MaterialVideoJobService.CREDIT_REF_TYPE),eq("job"),anyString());
        verifyNoInteractions(client);
    }
    @Test void acceptedJobIsNeverRefundedByUnknownReceiptCleanup() {
        job.setStatus("submitting");job.setErrorCode("VIDEO_SUBMISSION_UNKNOWN");job.setExternalTaskId("original");
        worker.failUnconfirmedSubmission("job");assertEquals("submitting",job.getStatus());verifyNoInteractions(client,credits);
    }
    @Test void originalJobRecoveryNeverSubmitsAnotherGeneration(){
        job.setStatus("failed");job.setExternalTaskId("original");
        var submitted=new MaterialVideoModelClient.SubmitResult("original",null,"provider","model","generic","e");
        when(client.resumeExistingTask(any(),any(),any(),any(),any(),any(),any())).thenReturn(submitted);
        when(client.poll(submitted)).thenReturn(new MaterialVideoModelClient.PollResult("failed",null,null,"failed",100,"rejected",null,null));
        worker.recoverQueuedGeneration("job");verify(client,never()).submit(any(),anyInt(),any(),any(),any(),any(),any(),any());
        verify(queue).finish(AiGenerationQueueService.VIDEO,"job");verifyNoInteractions(credits);
    }
    @Test void recoverySettlementFailureKeepsItsCapacityUntilLocalTerminalCommits(){
        job.setStatus("generating");job.setExternalTaskId("original");
        var submitted=new MaterialVideoModelClient.SubmitResult("original",null,"provider","model","generic","e");
        when(client.resumeExistingTask(any(),any(),any(),any(),any(),any(),any())).thenReturn(submitted);
        when(client.poll(submitted)).thenReturn(new MaterialVideoModelClient.PollResult("failed",null,null,"failed",100,"rejected",null,null));
        doThrow(new IllegalStateException("settlement transaction failed")).when(credits).releaseHold(any(),any(),any());
        worker.recoverQueuedGeneration("job");
        assertEquals("generating",job.getStatus());verify(queue,never()).finish(any(),any());
        verify(client,never()).submit(any(),anyInt(),any(),any(),any(),any(),any(),any());
    }    @Test void portraitRefusalPausesOriginalTaskWithoutAnotherHoldOrProviderAttempt() {
        when(client.submit(any(),anyInt(),any(),any(),any(),any(),any(),any())).thenThrow(ArkPortraitLibrary.review());
        worker.generateAsync("job");
        assertEquals("queued",job.getStatus());assertEquals(ArkPortraitLibrary.REVIEW_CODE,job.getErrorCode());
        assertTrue(job.getPayloadJson().contains("portrait_review_since"));
        worker.generateAsync("job");
        verify(client,times(1)).submit(any(),anyInt(),any(),any(),any(),any(),any(),any());
        verifyNoInteractions(credits);verify(queue,never()).finish(any(),any());
        verify(queue).requeue(AiGenerationQueueService.VIDEO,"job",java.time.Duration.ofSeconds(30));
    }
    @Test void abandonedPortraitReviewExpiresAndReleasesTheOriginalHoldOnce() {
        job.setErrorCode(ArkPortraitLibrary.REVIEW_CODE);
        job.setPayloadJson("{\"portrait_review_since\":\""+java.time.Instant.now().minusSeconds(1900)+"\"}");
        worker.generateAsync("job");worker.generateAsync("job");
        assertEquals("failed",job.getStatus());assertEquals("VIDEO_ASSET_REVIEW_TIMEOUT",job.getErrorCode());
        verify(credits,times(1)).releaseHold(eq(MaterialVideoJobService.CREDIT_REF_TYPE),eq("job"),any());verifyNoInteractions(client);
    }
    @Test void approvalWakesTheOriginalJobThroughNormalAdmissionWithoutASecondHold() {
        job.setErrorCode(ArkPortraitLibrary.REVIEW_CODE);
        var reviews=mock(VideoPortraitReviewService.class);
        ReflectionTestUtils.setField(worker,"portraitReviews",reviews);
        when(reviews.tryAutoResume(job)).thenAnswer(i->{job.setErrorCode(null);return true;});
        worker.checkPortraitReviewAsync("job");
        verify(queue).wakeWaiting(AiGenerationQueueService.VIDEO,"job");
        verifyNoInteractions(credits,client);
        verify(queue,never()).acquire(any(),any(),any(),anyBoolean());
        when(queue.acquire(any(),any(),any(),eq(false))).thenReturn(AiGenerationQueueService.Admission.WAITING);
        worker.generateAsync("job");
        verify(queue).acquire(AiGenerationQueueService.VIDEO,"job","e",false);
        verifyNoInteractions(credits,client);
    }
    @Test void acceptedTaskCannotEnterPortraitPauseOrBeRecreated() {
        when(client.submit(any(),anyInt(),any(),any(),any(),any(),any(),any())).thenAnswer(i->{job.setExternalTaskId("accepted");throw ArkPortraitLibrary.review();});
        worker.generateAsync("job");assertNotEquals(ArkPortraitLibrary.REVIEW_CODE,job.getErrorCode());
        verify(credits,never()).releaseHold(any(),any(),any());
    }

}
