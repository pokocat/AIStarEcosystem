package com.aistareco.aep.service;

import com.aistareco.aep.model.ErrorLog;
import com.aistareco.aep.repository.ErrorLogRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ErrorLogTaskTest {
    @Test void recordsOwnerAndTaskInAnIndependentTransaction() {
        var repo = mock(ErrorLogRepository.class);
        var manager = mock(PlatformTransactionManager.class);
        var status = mock(TransactionStatus.class);
        when(manager.getTransaction(any())).thenReturn(status);
        var service = new ErrorLogService(repo);
        ReflectionTestUtils.setField(service, "taskTransactions", manager);
        String id = service.recordTask(new IllegalStateException("provider failure"), "UPSTREAM_FAILED", "owner", "run");
        assertNotNull(id);
        var entry = ArgumentCaptor.forClass(ErrorLog.class);
        verify(repo).save(entry.capture());
        assertEquals("owner", entry.getValue().getUserId());
        assertEquals("async:run", entry.getValue().getEndpoint());
        assertEquals(id, entry.getValue().getLogId());
        var definition = ArgumentCaptor.forClass(TransactionDefinition.class);
        verify(manager).getTransaction(definition.capture());
        assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW, definition.getValue().getPropagationBehavior());
    }
    @Test void loggingCommitFailureNeverEscapesIntoTheTaskTransaction() {
        var repo = mock(ErrorLogRepository.class);
        var manager = mock(PlatformTransactionManager.class);
        var status = mock(TransactionStatus.class);
        when(manager.getTransaction(any())).thenReturn(status);
        doThrow(new IllegalStateException("log database unavailable")).when(manager).commit(status);
        var service = new ErrorLogService(repo);
        ReflectionTestUtils.setField(service, "taskTransactions", manager);
        assertNull(service.recordTask(new IllegalStateException("provider failure"), "UPSTREAM_FAILED", "owner", "run"));
    }
}
