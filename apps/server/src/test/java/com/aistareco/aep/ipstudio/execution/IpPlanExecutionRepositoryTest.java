package com.aistareco.aep.ipstudio.execution;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Real H2 conditional updates: a lease is won by exactly one caller and lost holders cannot renew or release it. */
@DataJpaTest(showSql=false,properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop"})
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class IpPlanExecutionRepositoryTest {
    @Autowired IpPlanExecutionRepository executions;
    @BeforeEach void reset(){executions.deleteAll();}

    IpPlanExecution row(String id,String request,String status) {
        Instant now=Instant.now();
        return executions.saveAndFlush(IpPlanExecution.builder().id(id).projectId("p").ownerUserId("u").skillKey("k").skillVersion(1).stage("analysis")
                .planRunId("r").planRevision(1).planFingerprint("f").status(status).stepsJson("{}").budgetJson("{}").billingJson("{}")
                .clientRequestId(request).createdAt(now).updatedAt(now).startedAt(now).deadlineAt(now.plusSeconds(5400)).build());
    }

    @Test void simultaneousAcquirersFromTheSameVersionYieldOneWinner() throws Exception {
        row("e","c1","running");
        var pool=Executors.newFixedThreadPool(8);var start=new CountDownLatch(1);
        try {
            List<Future<Integer>> results=new java.util.ArrayList<>();
            for(int i=0;i<8;i++){String owner="w"+i;results.add(pool.submit(()->{start.await();Instant now=Instant.now();return executions.acquireLease("e",owner,0,now,now.plusSeconds(120));}));}
            start.countDown();int won=0;for(var r:results)won+=r.get(15,TimeUnit.SECONDS);
            assertEquals(1,won);
        } finally {pool.shutdownNow();}
        var after=executions.findById("e").orElseThrow();
        assertEquals(1,after.getLeaseVersion());
        Instant now=Instant.now();
        assertEquals(0,executions.acquireLease("e","intruder",1,now,now.plusSeconds(120)),"a live lease is not taken over");
        assertEquals(0,executions.renewLease("e","intruder",1,now.plusSeconds(120)));
        assertEquals(1,executions.renewLease("e",after.getLeaseOwner(),1,now.plusSeconds(240)));
        assertEquals(0,executions.releaseLease("e",after.getLeaseOwner(),0),"a stale version cannot release");
    }

    @Test void expiredLeasesAreRecoverableAndTakenOverWithANewVersion() {
        var e=row("e","c1","running");e.setLeaseOwner("dead");e.setLeaseUntil(Instant.now().minusSeconds(5));e.setLeaseVersion(4);executions.saveAndFlush(e);
        row("paused-idle","c2","paused");
        var tracking=row("paused-tracking","c3","paused");tracking.setInFlight(40);executions.saveAndFlush(tracking);
        row("done","c4","done");
        assertEquals(List.of("e","paused-tracking"),executions.recoverable(List.of("running","paused","needs_user","partial","canceled"),Instant.now()).stream().sorted().toList());
        Instant now=Instant.now();
        assertEquals(1,executions.acquireLease("e","next",4,now,now.plusSeconds(120)));
        assertEquals(0,executions.renewLease("e","dead",4,now.plusSeconds(120)),"the old holder lost its version");
        assertEquals(1,executions.releaseLease("e","next",5));
        assertNull(executions.findById("e").orElseThrow().getLeaseOwner());
    }

    @Test void transitionsAreConditionalAndPreemptTheHolder() {
        var e=row("e","c1","running");
        Instant now=Instant.now();executions.acquireLease("e","holder",0,now,now.plusSeconds(120));
        assertEquals(1,executions.transition("e",List.of("running","needs_user"),"paused",Instant.now()));
        assertEquals(0,executions.transition("e",List.of("running"),"canceled",Instant.now()),"only from the expected state");
        var after=executions.findById("e").orElseThrow();
        assertEquals("paused",after.getStatus());assertEquals(2,after.getLeaseVersion());assertNull(after.getLeaseOwner());
        assertEquals(0,executions.renewLease("e","holder",1,Instant.now().plusSeconds(60)));
    }

    @Test void oneRowPerOwnerRequest() {
        row("a","same","running");
        assertThrows(DataIntegrityViolationException.class,()->row("b","same","running"));
        assertTrue(executions.findByOwnerUserIdAndClientRequestId("u","same").isPresent());
    }
}
