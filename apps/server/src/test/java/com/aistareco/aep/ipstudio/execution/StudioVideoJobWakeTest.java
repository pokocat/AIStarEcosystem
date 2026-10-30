package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.service.materialvideo.MaterialVideoJobEnded;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** A Studio video job that ends wakes its owner's tracked plans at once instead of after the 60 s scan (local real run 2026-10-29). */
class StudioVideoJobWakeTest {
    private final IpPlanExecutionRepository executions = mock(IpPlanExecutionRepository.class);
    private final StudioPlanExecutor executor = mock(StudioPlanExecutor.class);
    @SuppressWarnings("unchecked")
    private final ObjectProvider<StudioPlanExecutor> provider = mock(ObjectProvider.class);
    private final StudioVideoJobWake wake = new StudioVideoJobWake(executions, provider);

    private static IpPlanExecution execution(String id) {
        IpPlanExecution e = new IpPlanExecution();
        e.setId(id);
        return e;
    }

    @Test
    void aStudioVideoJobThatEndsWakesEveryTrackedPlanOfItsOwner() {
        when(provider.getIfAvailable()).thenReturn(executor);
        when(executions.findByOwnerUserIdAndStatusIn(eq("u1"), eq(StudioPlanExecutor.TRACKED))).thenReturn(List.of(execution("PEX-a"), execution("PEX-b")));
        wake.onEnded(new MaterialVideoJobEnded("mvj_1", "u1", "ipstudio", "failed"));
        verify(executor).wake("PEX-a");
        verify(executor).wake("PEX-b");
    }

    @Test
    void jobsFromOtherProductsAreIgnored() {
        when(provider.getIfAvailable()).thenReturn(executor);
        wake.onEnded(new MaterialVideoJobEnded("mvj_2", "u1", "celebrity", "succeeded"));
        verify(executions, never()).findByOwnerUserIdAndStatusIn(any(), any());
        verify(executor, never()).wake(any());
    }

    @Test
    void aLookupFailureOnlyMeansWaitingForTheScan() {
        when(provider.getIfAvailable()).thenReturn(executor);
        when(executions.findByOwnerUserIdAndStatusIn(any(), any())).thenThrow(new IllegalStateException("db down"));
        wake.onEnded(new MaterialVideoJobEnded("mvj_3", "u1", "ipstudio", "failed"));
        verify(executor, never()).wake(any());
    }
}
