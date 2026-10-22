package com.aistareco.aep.service;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Real H2 transactions, simultaneous callers, FIFO, independent endpoint pools and persisted recovery. */
@DataJpaTest(showSql=false,properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop"})
@Import(AiGenerationQueueService.class)
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class AiGenerationQueueConcurrencyTest {
    @Autowired AiModelEndpointRepository endpoints;
    @Autowired AiGenerationQueueRepository tickets;
    @Autowired AiGenerationQueueService queue;
    @Autowired com.aistareco.aep.ipstudio.repository.IpRunRepository runs;
    @Autowired MaterialVideoJobRepository videos;
    @BeforeEach void reset(){tickets.deleteAll();runs.deleteAll();videos.deleteAll();endpoints.deleteAll();}
    private void endpoint(String id,int limit){endpoints.saveAndFlush(AiModelEndpoint.builder().id(id).name(id)
        .providerType(AiModelProviderType.OPENAI_COMPATIBLE).baseUrl("http://localhost").upstreamApiKeyEncrypted("unused")
        .concurrencyLimit(limit==0?null:limit).build());}
    @Test void simultaneousWorkersNeverExceedTheEndpointLimit() throws Exception {
        endpoint("e",3);var pool=Executors.newFixedThreadPool(12);var start=new CountDownLatch(1);
        try {
            List<Future<AiGenerationQueueService.Admission>> results=new ArrayList<>();
            for(int i=0;i<12;i++){final int no=i;results.add(pool.submit(()->{start.await();return queue.acquire("ip-image","r"+no,"e",false);}));}
            start.countDown();long admitted=0;for(var result:results)if(result.get(15,TimeUnit.SECONDS)==AiGenerationQueueService.Admission.READY)admitted++;
            assertEquals(3,admitted);assertEquals(3,tickets.countByEndpointIdAndState("e","running"));
            assertEquals(9,tickets.countByEndpointIdAndState("e","waiting"));
        } finally {pool.shutdownNow();}
    }
    @Test void fifoReleaseAndCancellationSurviveNewServiceInstances() {
        endpoint("e",1);endpoint("other",1);
        assertEquals(AiGenerationQueueService.Admission.READY,queue.acquire("ip-image","first","e",false));
        assertEquals(AiGenerationQueueService.Admission.WAITING,queue.acquire("ip-image","second","e",false));
        assertEquals(AiGenerationQueueService.Admission.WAITING,queue.acquire("ip-image","third","e",false));
        assertEquals(AiGenerationQueueService.Admission.READY,queue.acquire("ip-image","independent","other",false));
        queue.finish("ip-image","first");
        assertEquals(AiGenerationQueueService.Admission.WAITING,queue.acquire("ip-image","third","e",false));
        queue.finish("ip-image","second"); // canceled before any upstream call
        assertEquals(AiGenerationQueueService.Admission.READY,queue.acquire("ip-image","third","e",false));
        assertEquals(AiGenerationQueueService.Admission.BUSY,queue.acquire("ip-image","third","e",false));
        assertEquals(4,tickets.count()); // original task IDs reused, never appended on retry
    }
    @Test void acceptedMediaKeepsItsSlotAcrossPollingStepsAndLimitChanges() {
        endpoint("e",2);
        assertEquals(AiGenerationQueueService.Admission.READY,queue.acquire("ip-speech","audio","e",true));
        assertEquals(AiGenerationQueueService.Admission.READY,queue.acquire("material-video","video","e",false));
        var config=endpoints.findById("e").orElseThrow();config.setConcurrencyLimit(1);endpoints.saveAndFlush(config);
        assertEquals(AiGenerationQueueService.Admission.READY,queue.acquire("ip-speech","audio","e",true));
        assertEquals(AiGenerationQueueService.Admission.WAITING,queue.acquire("ip-image","image","e",false));
        queue.finish("ip-speech","audio");
        assertEquals(AiGenerationQueueService.Admission.WAITING,queue.acquire("ip-image","image","e",false));
        queue.finish("material-video","video");
        assertEquals(AiGenerationQueueService.Admission.READY,queue.acquire("ip-image","image","e",false));
    }
    @Test void unknownImageReceiptsDoNotBlockNewImagesOrSynchronousEntrances() {
        endpoint("e",2);
        for(String id:List.of("unknown-one","unknown-two")) {
            runs.saveAndFlush(com.aistareco.aep.ipstudio.model.IpRun.builder().id(id).projectId("p").nodeId(id)
                .ownerUserId("owner").kind("generate").status("running").stage("image.provider.recovering")
                .pct(10).cost(30).errorCode("STUDIO_IMAGE_SUBMISSION_UNKNOWN")
                .inputJson("{\"_exec\":{\"imageJobs\":[{\"submitAttempted\":true,\"requestBody\":\"original\"}]}}")
                .build());
            queue.register("ip-image",id,"e",true);
        }
        assertEquals(2,tickets.countByEndpointIdAndState("e","running"));
        assertEquals(2,tickets.findNeedingAttention(org.springframework.data.domain.PageRequest.of(0,20)).getTotalElements());
        assertEquals(0,tickets.countOccupyingSlots("e"));
        assertEquals(AiGenerationQueueService.Admission.READY,queue.acquire("sync-call","http","e",false));
        assertEquals(AiGenerationQueueService.Admission.READY,queue.acquire("ip-image","next-one","e",false));
        assertEquals(AiGenerationQueueService.Admission.WAITING,queue.acquire("ip-image","next-two","e",false));
        assertEquals(2,queue.position("ip-image","next-two").running());
        var next=tickets.findByTaskTypeAndTaskId("ip-image","next-two").orElseThrow();
        assertFalse(queue.claimDispatch(next,false));
        queue.finish("sync-call","http");
        assertTrue(queue.claimDispatch(next,false));
        assertEquals(AiGenerationQueueService.Admission.READY,queue.acquire("ip-image","next-two","e",false));
        for(String id:List.of("unknown-one","unknown-two")) {
            var original=runs.findById(id).orElseThrow();
            assertEquals("STUDIO_IMAGE_SUBMISSION_UNKNOWN",original.getErrorCode());
            assertEquals("running",original.getStatus());assertEquals(30,original.getCost());
            assertTrue(original.getInputJson().contains("original"));
        }
        // Operator confirmation changes the same task back into a known accepted job; it counts again.
        var recovered=runs.findById("unknown-one").orElseThrow();
        recovered.setErrorCode("STUDIO_IMAGE_RECOVERING");runs.saveAndFlush(recovered);
        assertEquals(3,tickets.countOccupyingSlots("e"));
        assertEquals(AiGenerationQueueService.Admission.WAITING,queue.acquire("ip-image","later","e",false));
    }
    @Test void allReviewOnlyMediaReleaseCapacityButKeepReceiptsAndKnownJobsCountAgain() {
        endpoint("e",1);
        var video=MaterialVideoJob.builder().id("video").ownerUserId("owner").status("submitting")
            .progress(5).creditsHeld(520).errorCode("VIDEO_SUBMISSION_UNKNOWN").createdAt(java.time.OffsetDateTime.now()).build();
        videos.saveAndFlush(video);queue.register("material-video","video","e",true);
        for(String kind:List.of("studio-audio","studio-lip-sync")) {
            boolean lip=kind.equals("studio-lip-sync");
            runs.saveAndFlush(com.aistareco.aep.ipstudio.model.IpRun.builder().id(kind).projectId("p").nodeId(kind)
                .ownerUserId("owner").kind(kind).status("running").stage(lip?"lip-sync.submission_unknown":"audio.submission_unknown")
                .errorCode(lip?"STUDIO_LIP_SYNC_SUBMISSION_UNKNOWN":"STUDIO_SPEECH_SUBMISSION_UNKNOWN").cost(20)
                .inputJson("{\"_exec\":{\"submitAttempts\":3,\"requestBody\":\"original\"}}").build());
            queue.register("ip-speech",kind,"e",true);
        }
        assertEquals(3,tickets.countByEndpointIdAndState("e","running"));assertEquals(0,tickets.countOccupyingSlots("e"));
        var attention=tickets.findNeedingAttention(org.springframework.data.domain.PageRequest.of(0,2));
        assertEquals(3,attention.getTotalElements());assertEquals(2,attention.getContent().size());assertTrue(attention.hasNext());
        assertEquals(AiGenerationQueueService.Admission.READY,queue.acquire("material-video","next","e",false));
        assertEquals(AiGenerationQueueService.Admission.WAITING,queue.acquire("material-video","later","e",false));
        assertEquals(1,queue.position("material-video","later").running());
        assertEquals(520,videos.findById("video").orElseThrow().getCreditsHeld());
        queue.finish("material-video","next");
        assertTrue(queue.claimDispatch(tickets.findByTaskTypeAndTaskId("material-video","later").orElseThrow(),false));
        // Even an inconsistent old error code must not exclude an accepted video.
        video.setExternalTaskId("original");videos.saveAndFlush(video);assertEquals(1,tickets.countOccupyingSlots("e"));
        var audio=runs.findById("studio-audio").orElseThrow();audio.setStage("audio.recovering");audio.setErrorCode("STUDIO_SPEECH_RECOVERING");runs.saveAndFlush(audio);
        assertEquals(2,tickets.countOccupyingSlots("e"));
        var lip=runs.findById("studio-lip-sync").orElseThrow();lip.setStatus("failed");lip.setCost(0);runs.saveAndFlush(lip);
        queue.finish("ip-speech","studio-lip-sync");
        // Closed/refunded incidents remain visible; viewing never reopens a queue ticket.
        assertEquals(List.of("studio-lip-sync"),tickets.findNeedingAttention(org.springframework.data.domain.PageRequest.of(0,20)).stream().map(AiGenerationQueueEntry::getTaskId).toList());
    }
    @Test void unlimitedPolicyAndDispatchLeasesDoNotDuplicateTasks() {
        endpoint("e",1);
        queue.acquire("ip-image","first","e",false);queue.acquire("ip-image","second","e",false);
        var ticket=tickets.findByTaskTypeAndTaskId("ip-image","second").orElseThrow();
        assertFalse(queue.claimDispatch(ticket,false));
        var config=endpoints.findById("e").orElseThrow();config.setConcurrencyLimit(null);endpoints.saveAndFlush(config);
        assertTrue(queue.claimDispatch(ticket,false));assertFalse(queue.claimDispatch(ticket,false));
        assertEquals(AiGenerationQueueService.Admission.READY,queue.acquire("ip-image","second","e",false));
    }
    @Test void synchronousEntrancesShareWorkerSlotsWithoutNestedDeadlock() throws Exception {
        endpoint("e",1);queue.acquire("ip-workflow","script","e",false);
        try(var scope=queue.bind("ip-workflow","script")) {
            assertEquals("nested",queue.synchronous("e",java.time.Duration.ofSeconds(3),()->"nested"));
            assertEquals(1,tickets.count());
        }
        var pool=Executors.newSingleThreadExecutor();
        try {
            var result=pool.submit(()->queue.synchronous("e",java.time.Duration.ofSeconds(3),()->"other entrance"));
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(3);
            while(tickets.countByEndpointIdAndState("e","waiting")==0&&System.nanoTime()<deadline)Thread.sleep(10);
            assertFalse(result.isDone());queue.finish("ip-workflow","script");
            assertEquals("other entrance",result.get(5,TimeUnit.SECONDS));
            assertEquals(0,tickets.countByEndpointIdAndState("e","running"));
            assertEquals(0,tickets.countByEndpointIdAndState("e","waiting"));
        } finally {pool.shutdownNow();}
    }
    @Test void livePositionsAdvanceAfterPredecessorCancellationAndDisappearOnAdmission() {
        endpoint("e",1);endpoint("other",1);
        queue.acquire("ip-image","busy","e",false);
        queue.acquire("ip-image","first","e",false);
        queue.acquire("ip-image","second","e",false);
        queue.acquire("ip-image","unrelated","other",false);
        var before=queue.position("ip-image","second");
        assertEquals(2,before.position());assertEquals(2,before.waiting());assertEquals(1,before.running());
        assertEquals(1,before.concurrencyLimit());
        queue.finish("ip-image","first");
        var after=queue.position("ip-image","second");
        assertEquals(1,after.position());assertEquals(1,after.waiting());
        assertNull(queue.position("ip-image","first"));
        queue.finish("ip-image","busy");queue.acquire("ip-image","second","e",false);
        assertNull(queue.position("ip-image","second"));
    }
}
