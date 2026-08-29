package com.aistareco.aep.service.music;

import com.aistareco.aep.config.MusicGenProperties;
import com.aistareco.aep.model.MusicGenJob;
import com.aistareco.aep.service.CreditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 按真实时长结算。
 *
 * <p>音乐模型返回的实际成曲时长常与请求值不一致，而上游本身就是按实际秒数计费的。
 * 冻结按请求时长、结算按实际时长、差额退回 —— 少一步用户就会被多扣。
 */
class MusicGenWorkerSettlementTest {

    private CreditService creditService;
    private MusicGenWorker worker;

    @BeforeEach
    void setUp() {
        creditService = mock(CreditService.class);
        worker = new MusicGenWorker(
                mock(MusicGenJobState.class),
                mock(MusicGenModelClient.class),
                mock(MusicOutputStorage.class),
                creditService,
                new MusicGenProperties());
    }

    /** settleCredits 是私有的实现细节，但结算正确性值得直接钉住。 */
    private long settle(MusicGenJob job, Integer actualDurationSec) throws Exception {
        Method m = MusicGenWorker.class.getDeclaredMethod("settleCredits", MusicGenJob.class, Integer.class);
        m.setAccessible(true);
        return (long) m.invoke(worker, job, actualDurationSec);
    }

    private MusicGenJob job(long held, int requestedSec) {
        return MusicGenJob.builder()
                .id("mgj_1").ownerUserId("u1")
                .durationSec(requestedSec).creditsHeld(held)
                .build();
    }

    @Test
    void shorterActualDurationRefundsDifference() throws Exception {
        // 请求 120s 冻结 240 积分（2/秒），实际只出了 90s → 应结 180，退 60
        long settled = settle(job(240L, 120), 90);

        assertEquals(180L, settled);
        var amount = ArgumentCaptor.forClass(Long.class);
        verify(creditService).commitHold(eq(MusicGenJobService.CREDIT_REF_TYPE), eq("mgj_1"),
                amount.capture(), any());
        assertEquals(180L, amount.getValue());
        verify(creditService).releaseHold(eq(MusicGenJobService.CREDIT_REF_TYPE), eq("mgj_1"), any());
    }

    @Test
    void exactDurationCommitsAllAndSkipsRelease() throws Exception {
        long settled = settle(job(240L, 120), 120);

        assertEquals(240L, settled);
        verify(creditService).commitHold(any(), any(), eq(240L), any());
        verify(creditService, never()).releaseHold(any(), any(), any());
    }

    @Test
    void longerActualDurationNeverExceedsHold() throws Exception {
        // 上游给多了不能倒扣用户：结算封顶在已冻结额度
        long settled = settle(job(240L, 120), 200);

        assertEquals(240L, settled);
        verify(creditService).commitHold(any(), any(), eq(240L), any());
    }

    @Test
    void missingActualDurationFallsBackToHeld() throws Exception {
        long settled = settle(job(240L, 120), null);

        assertEquals(240L, settled);
        verify(creditService).commitHold(any(), any(), eq(240L), any());
    }

    @Test
    void freeJobSettlesNothing() throws Exception {
        assertEquals(0L, settle(job(0L, 120), 90));
        verifyNoInteractions(creditService);
    }

    @Test
    void commitFailureDoesNotReportPhantomCharge() throws Exception {
        doThrow(new RuntimeException("ledger down"))
                .when(creditService).commitHold(any(), any(), anyLong(), any());

        // 结算失败时不能对外声称扣了钱
        assertEquals(0L, settle(job(240L, 120), 90));
    }
}
