package com.aistareco.aep.ipstudio;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioWorkerLifecycleTest {
    private final IpRunRepository runs=mock(IpRunRepository.class);
    private final StudioFixtureProvider fixtures=mock(StudioFixtureProvider.class);
    private final CreditService credits=mock(CreditService.class);
    private final AiModelInvocationService models=mock(AiModelInvocationService.class);
    private final PlatformTransactionManager transactions=mock(PlatformTransactionManager.class);
    private StudioWorkflowWorker worker() {
        when(transactions.getTransaction(any())).thenAnswer(i->{assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW,((TransactionDefinition)i.getArgument(0)).getPropagationBehavior());return new SimpleTransactionStatus();});
        return new StudioWorkflowWorker(runs,fixtures,mock(FileStorageService.class),models,mock(DramaAssembleService.class),credits,new ObjectMapper(),transactions,mock(com.aistareco.aep.dap.service.DapAssetService.class));
    }
    private IpRun run() {
        var run=IpRun.builder().id("r").status("running").cost(2).inputJson("{\"operation\":\"script\",\"mock\":true}").heartbeatAt(Instant.now()).build();
        when(runs.findById("r")).thenReturn(Optional.of(run));when(runs.lockById("r")).thenReturn(Optional.of(run));return run;
    }
    @Test void duplicateDispatchInvokesOnlyOnceAndCommitsOneHold() throws Exception {
        var run=run();var worker=worker();when(fixtures.script()).thenReturn(new ObjectMapper().readTree(Files.readString(Path.of("../../scripts/studio/fixtures/script.json"))));
        worker.runBlocking("r");worker.runBlocking("r");
        assertEquals("done",run.getStatus());verify(fixtures,times(1)).script();verify(credits,times(1)).commitHold(anyString(),eq("r"),eq(2L),anyString(), org.mockito.ArgumentMatchers.any());verifyNoInteractions(models);
    }
    @Test void cancelledBeforeDispatchDoesNotInvokeTheProvider() {
        var run=run();run.setCancelRequested(true);worker().runBlocking("r");
        assertEquals("failed",run.getStatus());assertEquals("IP_RUN_CANCELLED",run.getErrorCode());verifyNoInteractions(fixtures,models);verify(credits,times(1)).releaseHold(anyString(),eq("r"),anyString());
    }
    @Test void reaperCannotRefundACompletedOrFreshRun() {
        var run=run();var worker=worker();assertFalse(worker.expire("r",Instant.now().minusSeconds(60)));
        run.setStatus("done");run.setHeartbeatAt(Instant.now().minusSeconds(600));assertFalse(worker.expire("r",Instant.now().minusSeconds(60)));verifyNoInteractions(credits);
    }
    @Test void stoppingAnOrphanDirectorReleasesItsHoldAndAllowsNoNewDispatch() {
        var run=run();run.setKind("studio-director");run.setStartedAt(Instant.now().minusSeconds(60));
        var worker=worker();assertTrue(worker.stopDirectorTask("r"));assertFalse(worker.stopDirectorTask("r"));
        worker.runBlocking("r");
        assertEquals("failed",run.getStatus());assertEquals("IP_RUN_CANCELLED",run.getErrorCode());
        assertEquals(0,run.getCost());assertNotNull(run.getFinishedAt());
        verify(credits,times(1)).releaseHold(eq("ip-run"),eq("r"),anyString());verifyNoInteractions(models,fixtures);
    }
    @Test void stoppingAnAlreadyCompletedDirectorDoesNotRefundItsConsumption() {
        var run=run();run.setKind("studio-director");run.setStatus("done");
        assertFalse(worker().stopDirectorTask("r"));assertEquals(2,run.getCost());verifyNoInteractions(credits);
    }
    @Test void directorStopCannotCancelNativeMedia() {
        var run=run();run.setKind("studio-video");
        assertThrows(com.aistareco.common.BusinessException.class,()->worker().stopDirectorTask("r"));
        assertEquals("running",run.getStatus());verifyNoInteractions(credits);
    }
}
