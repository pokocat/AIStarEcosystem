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
    @BeforeEach void reset(){tickets.deleteAll();endpoints.deleteAll();}
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
