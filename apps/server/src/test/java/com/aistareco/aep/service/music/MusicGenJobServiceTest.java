package com.aistareco.aep.service.music;

import com.aistareco.aep.model.MusicGenJob;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.aep.repository.MusicGenJobRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 下单链路的守则。
 *
 * <p>核心是**扣费顺序**：任何 preflight 失败都不能留下已冻结的积分。
 * 这类 bug 在生产上表现为「用户点了一下没出片，积分却少了」，
 * 而且要等 180 分钟的 sweeper 才退，所以必须用测试钉死。
 */
class MusicGenJobServiceTest {

    private MusicGenJobRepository jobRepo;
    private DigitalIpRepository digitalIpRepo;
    private MusicGenModelClient modelClient;
    private MusicGenWorker worker;
    private CreditService creditService;
    private MusicGenJobService service;

    private static final String OWNER = "user-1";

    @BeforeEach
    void setUp() {
        jobRepo = mock(MusicGenJobRepository.class);
        digitalIpRepo = mock(DigitalIpRepository.class);
        modelClient = mock(MusicGenModelClient.class);
        worker = mock(MusicGenWorker.class);
        creditService = mock(CreditService.class);
        PromptService promptService = mock(PromptService.class);
        service = new MusicGenJobService(jobRepo, digitalIpRepo, modelClient, worker,
                creditService, promptService, CdnUrlSigner.NOOP);

        when(jobRepo.save(any(MusicGenJob.class))).thenAnswer(i -> i.getArgument(0));
        when(jobRepo.findByOwnerUserIdAndClientRequestId(any(), any())).thenReturn(Optional.empty());
        when(modelClient.resolveCreditCost(any(), anyInt())).thenReturn(120L);
    }

    private MusicGenJobService.CreateSpec spec(String prompt, String lyrics, boolean instrumental, int duration) {
        return new MusicGenJobService.CreateSpec("req-1", null, prompt, lyrics,
                null, null, null, null, instrumental, duration, null);
    }

    @Test
    void holdsCreditsAndDispatchesAfterValidation() {
        var dto = service.submit(spec("夜晚城市", null, false, 120), OWNER);

        assertEquals("queued", dto.status());
        assertEquals(120L, dto.creditsHeld());
        // 校验必须发生在冻结之前
        var order = inOrder(modelClient, creditService, jobRepo);
        order.verify(modelClient).ensureConfigured(any());
        order.verify(modelClient).validateRequest(any(), eq(120), eq(false));
        order.verify(creditService).hold(eq(OWNER), eq(120L), eq(MusicGenJobService.CREDIT_REF_TYPE), any(), any());
        order.verify(jobRepo).save(any(MusicGenJob.class));
    }

    @Test
    void unconfiguredEndpointDoesNotChargeOrCreateJob() {
        doThrow(new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "MUSIC_NOT_CONFIGURED", "未配置"))
                .when(modelClient).ensureConfigured(any());

        var e = assertThrows(BusinessException.class,
                () -> service.submit(spec("夜晚城市", null, false, 120), OWNER));

        assertEquals("MUSIC_NOT_CONFIGURED", e.getCode());
        verify(creditService, never()).hold(any(), anyLong(), any(), any(), any());
        verify(jobRepo, never()).save(any(MusicGenJob.class));
    }

    @Test
    void illegalDurationDoesNotChargeOrCreateJob() {
        doThrow(new BusinessException(HttpStatus.BAD_REQUEST, "MUSIC_DURATION_UNSUPPORTED", "时长越界"))
                .when(modelClient).validateRequest(any(), anyInt(), anyBoolean());

        assertThrows(BusinessException.class, () -> service.submit(spec("x", null, false, 999), OWNER));

        verify(creditService, never()).hold(any(), anyLong(), any(), any(), any());
        verify(jobRepo, never()).save(any(MusicGenJob.class));
    }

    @Test
    void emptyInputRejectedBeforeAnySideEffect() {
        assertThrows(BusinessException.class, () -> service.submit(spec("  ", "  ", false, 120), OWNER));

        verify(modelClient, never()).ensureConfigured(any());
        verify(creditService, never()).hold(any(), anyLong(), any(), any(), any());
    }

    @Test
    void instrumentalWithLyricsRejected() {
        // 纯音乐不会演唱歌词，与其静默丢弃用户输入，不如当场说清楚
        var e = assertThrows(BusinessException.class,
                () -> service.submit(spec(null, "[verse] 一段词", true, 60), OWNER));
        assertEquals("MUSIC_INPUT_CONFLICT", e.getCode());
        verify(creditService, never()).hold(any(), anyLong(), any(), any(), any());
    }

    @Test
    void duplicateClientRequestReturnsExistingJobWithoutDoubleCharging() {
        MusicGenJob existing = MusicGenJob.builder()
                .id("mgj_existing").ownerUserId(OWNER).clientRequestId("req-1")
                .status("generating").progress(42).durationSec(120).creditsHeld(120L)
                .build();
        when(jobRepo.findByOwnerUserIdAndClientRequestId(OWNER, "req-1")).thenReturn(Optional.of(existing));

        var dto = service.submit(spec("夜晚城市", null, false, 120), OWNER);

        assertEquals("mgj_existing", dto.id());
        assertEquals(42, dto.progress());
        verify(creditService, never()).hold(any(), anyLong(), any(), any(), any());
        verify(jobRepo, never()).save(any(MusicGenJob.class));
    }

    @Test
    void foreignArtistRejected() {
        var artist = new com.aistareco.aep.model.DigitalIp();
        artist.setId("dip-1");
        artist.setOwnerUserId("someone-else");
        when(digitalIpRepo.findById("dip-1")).thenReturn(Optional.of(artist));

        var s = new MusicGenJobService.CreateSpec("req-2", "dip-1", "夜晚城市", null,
                null, null, null, null, false, 120, null);

        var e = assertThrows(BusinessException.class, () -> service.submit(s, OWNER));
        assertEquals("ARTIST_NOT_OWNED", e.getCode());
        verify(creditService, never()).hold(any(), anyLong(), any(), any(), any());
    }

    @Test
    void freeGenerationSkipsHold() {
        when(modelClient.resolveCreditCost(any(), anyInt())).thenReturn(0L);

        var dto = service.submit(spec("夜晚城市", null, false, 120), OWNER);

        assertEquals(0L, dto.creditsHeld());
        verify(creditService, never()).hold(any(), anyLong(), any(), any(), any());
        verify(jobRepo).save(any(MusicGenJob.class));
    }
}
