package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.*;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.*;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class VideoPortraitReviewServiceTest {
    final MaterialVideoJobRepository jobs=mock(MaterialVideoJobRepository.class);
    final AiModelEndpointRepository endpoints=mock(AiModelEndpointRepository.class);
    final ArkPortraitLibrary portraits=mock(ArkPortraitLibrary.class);
    final AiGenerationQueueService queue=mock(AiGenerationQueueService.class);
    final AiModelAccessPolicyService access=mock(AiModelAccessPolicyService.class);
    VideoPortraitReviewService service;MaterialVideoJob job;
    @BeforeEach void setup(){
        service=new VideoPortraitReviewService(jobs,endpoints,portraits,queue);ReflectionTestUtils.setField(service,"access",access);
        job=MaterialVideoJob.builder().id("job").ownerUserId("owner").app("ipstudio").status("queued").errorCode(ArkPortraitLibrary.REVIEW_CODE).variantConfigJson("{\"endpoint_id\":\"model\",\"first_frame_key\":\"photo\"}").payloadJson("{}").build();
        when(jobs.findById("job")).thenReturn(Optional.of(job));
        AiModelEndpoint model=new AiModelEndpoint();model.setId("model");model.setAssetLibraryId("ark");model.setEnabled(true);
        when(endpoints.findById("model")).thenReturn(Optional.of(model));when(portraits.isOfficialLibrary("ark")).thenReturn(true);when(access.allows("model","studio")).thenReturn(true);
        when(portraits.itemsFor(eq("owner"),eq("ark"),anyCollection())).thenReturn(List.of(item("active")));when(portraits.reference("owner","ark","photo")).thenReturn("asset://photo");
    }
    private ArkPortraitLibrary.Item item(String state){return item("photo",state);}
    private ArkPortraitLibrary.Item item(String key,String state){return new ArkPortraitLibrary.Item("item-"+key,"ark",key,"image","照片",null,state,"person","person",null,Instant.now().toString(),false);}
    @Test void preparingUsesOnlyOfficialModelAndChecksOwnershipWithoutUploading(){
        var ready=service.check("owner","model",List.of("photo","new-photo"));
        assertEquals(List.of("new-photo"),ready.candidateKeys());assertTrue(ready.items().isEmpty());verify(portraits).requireOwnedKeys("owner",List.of("photo","new-photo"));
        when(portraits.isOfficialLibrary("ark")).thenReturn(false);assertNull(service.check("owner","model",List.of("photo")).libraryId());
        verifyNoInteractions(queue);verify(jobs,never()).resumePortraitReview(any(),any(),any());
    }
    @Test void differentOwnerCannotInspectOrResume(){
        assertThrows(BusinessException.class,()->service.get("other","job"));assertThrows(BusinessException.class,()->service.resume("other","job"));verifyNoInteractions(queue);
    }
    @Test void onlyFullyApprovedUnacceptedTaskCanContinue(){
        when(portraits.itemsFor(eq("owner"),eq("ark"),anyCollection())).thenReturn(List.of(item("processing")));
        assertThrows(BusinessException.class,()->service.resume("owner","job"));verify(jobs,never()).resumePortraitReview(any(),any(),any());
        job.setExternalTaskId("accepted");assertFalse(service.get("owner","job").awaiting());service.resume("owner","job");verifyNoInteractions(queue);
    }
    @Test void continuationSchedulesOnlyAfterCommitAndDoesNotSubmitOrCreateAnotherTask(){
        when(jobs.resumePortraitReview(eq("job"),eq("owner"),any())).thenReturn(1);
        TransactionSynchronizationManager.initSynchronization();
        try {
            var result=service.resume("owner","job");assertFalse(result.awaiting());verifyNoInteractions(queue);
            for(var synchronization:TransactionSynchronizationManager.getSynchronizations())synchronization.afterCommit();
            verify(queue).wakeWaiting(AiGenerationQueueService.VIDEO,"job");verify(jobs,never()).save(any());
        }finally{TransactionSynchronizationManager.clearSynchronization();}
        // A repeated request whose conditional update lost cannot dispatch a second time.
        reset(queue);when(jobs.resumePortraitReview(eq("job"),eq("owner"),any())).thenReturn(0);
        service.resume("owner","job");verifyNoInteractions(queue);
    }

    @Test void backgroundReviewPollsTheExactPendingAssetAndContinuesOnlyAfterEveryReferenceIsApproved(){
        job.setVariantConfigJson("{\"endpoint_id\":\"model\",\"first_frame_key\":\"photo\",\"last_frame_key\":\"board\"}");
        when(portraits.itemsFor("owner","ark",List.of("photo","board"))).thenReturn(
                List.of(item("active"),item("board","processing")),List.of(item("active"),item("board","processing")),
                List.of(item("active"),item("board","processing")),List.of(item("active"),item("board","active")));
        when(portraits.reference("owner","ark","board")).thenReturn("asset://board");
        when(jobs.resumePortraitReview(eq("job"),eq("owner"),any())).thenReturn(1);
        assertFalse(service.tryAutoResume(job));
        verify(jobs,never()).resumePortraitReview(any(),any(),any());
        assertTrue(service.tryAutoResume(job));
        verify(portraits,times(2)).refreshItem("owner","item-board");
        verify(portraits,never()).refreshItem("owner","item-photo");
        verify(jobs).resumePortraitReview(eq("job"),eq("owner"),any());
        verifyNoInteractions(queue);
    }

    @Test void backgroundReviewDoesNotRestartExpiredAcceptedOrRevokedJobs(){
        job.setPayloadJson("{\"portrait_review_since\":\"2020-01-01T00:00:00Z\"}");
        assertFalse(service.tryAutoResume(job));
        job.setPayloadJson("{}");
        job.setExternalTaskId("accepted");
        assertFalse(service.tryAutoResume(job));
        job.setExternalTaskId(null);
        when(portraits.reference("owner","ark","photo")).thenThrow(ArkPortraitLibrary.review());
        assertFalse(service.tryAutoResume(job));
        verify(portraits,never()).refreshItem(any(),any());
        verify(jobs,never()).resumePortraitReview(any(),any(),any());
    }
}
