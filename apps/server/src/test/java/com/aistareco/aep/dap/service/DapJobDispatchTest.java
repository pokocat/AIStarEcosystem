package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.repository.DapJobRepository;
import com.aistareco.aep.service.CreditService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 派发时机回归：{@link DapJobService#submit}/{@link DapJobService#retry} 在**有外层事务**时
 * 必须把 {@code runner.run(...)} 推到 afterCommit —— 否则 {@code @Async} worker 在自己的新事务里
 * 查不到这条尚未提交的作业（生产 MySQL READ_COMMITTED），静默退出，作业永远停在 running、
 * 冻结的积分等 180 分钟兜底才回收。没有外层事务时当场派发。
 */
class DapJobDispatchTest {

    private final DapJobRepository jobRepo = mock(DapJobRepository.class);
    private final CreditService creditService = mock(CreditService.class);
    private final DapAccountService accountService = mock(DapAccountService.class);
    private final DapSupport support = mock(DapSupport.class);
    private final DapProperties props = new DapProperties();
    private final DapPricingService pricing = mock(DapPricingService.class);
    private final DapJobRunner runner = mock(DapJobRunner.class);
    private final DapMultimodalClient multimodal = mock(DapMultimodalClient.class);

    private DapJobService service() {
        when(multimodal.isConfigured()).thenReturn(true);
        when(support.newId("JOB")).thenReturn("JOB-1");
        when(jobRepo.existsById("JOB-1")).thenReturn(false);
        return new DapJobService(jobRepo, creditService, accountService, support, props,
                pricing, runner, multimodal);
    }

    @AfterEach
    void clearSync() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void dispatchesImmediatelyWhenNoTransaction() {
        service().submit("u1", null, "generate", "人设", "engine", 0L, "eta", Map.of());
        verify(runner, times(1)).run("JOB-1");
    }

    @Test
    void defersDispatchUntilAfterCommitWhenTransactionActive() {
        TransactionSynchronizationManager.initSynchronization();
        try {
            service().submit("u1", null, "generate", "人设", "engine", 0L, "eta", Map.of());
            // 事务尚未提交：绝不能已经派发（worker 会查不到行）。
            verify(runner, never()).run(anyString());

            // 模拟事务提交：注册的 afterCommit 回调此时才跑。
            List<TransactionSynchronization> syncs =
                    TransactionSynchronizationManager.getSynchronizations();
            syncs.forEach(TransactionSynchronization::afterCommit);
            verify(runner, times(1)).run("JOB-1");
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }
}
