package com.aistareco.aep.service;

import com.aistareco.aep.dto.AsyncJobStartedDto;
import com.aistareco.aep.dto.GenerationJobProgressDto;
import com.aistareco.aep.model.GenerationJob;
import com.aistareco.aep.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * CelebrityZoneService 任务态持久化（v0.80）。
 *
 * <p>此前任务态是静态 ConcurrentHashMap，重启即丢：轮询误报「完成」(1/1)，
 * done 时不再 commit hold → 孤儿冻结额度。本测试锁定落表后行为：
 * 任务落 generation_jobs 表、重启后(repo 仍有记录)能继续按 startedAt 算进度、
 * done 时幂等 commit hold。</p>
 */
class CelebrityZoneServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final String USER = "u_owner";

    private Map<String, GenerationJob> db;
    private GenerationJobRepository jobRepo;
    private CreditService creditService;
    private PlatformConfigService configs;
    private CelebrityZoneService svc;

    @BeforeEach
    void setUp() {
        db = new HashMap<>();
        jobRepo = mock(GenerationJobRepository.class);
        when(jobRepo.save(any())).thenAnswer(inv -> {
            GenerationJob j = inv.getArgument(0);
            db.put(j.getId(), j);
            return j;
        });
        when(jobRepo.findById(anyString())).thenAnswer(inv ->
                Optional.ofNullable(db.get(inv.getArgument(0, String.class))));
        // markCommitted: CAS — returns 1 and flips the in-memory record if not yet committed; 0 otherwise.
        when(jobRepo.markCommitted(anyString())).thenAnswer(inv -> {
            String id = inv.getArgument(0, String.class);
            GenerationJob j = db.get(id);
            if (j != null && !j.isCommitted()) {
                j.setCommitted(true);
                return 1;
            }
            return 0;
        });
        // resetCommitted: compensation rollback — clear the committed flag.
        when(jobRepo.resetCommitted(anyString())).thenAnswer(inv -> {
            String id = inv.getArgument(0, String.class);
            GenerationJob j = db.get(id);
            if (j != null && j.isCommitted()) {
                j.setCommitted(false);
                return 1;
            }
            return 0;
        });

        creditService = mock(CreditService.class);
        configs = mock(PlatformConfigService.class);
        // pricing 配置缺失 → service 回落到内置默认价（KeLing=50 等），无需 seed
        when(configs.findByKey(anyString())).thenReturn(Optional.empty());

        svc = new CelebrityZoneService(
                mock(CelebrityStarRepository.class),
                mock(CelebrityProjectRepository.class),
                mock(CelebrityProjectVideoRepository.class),
                mock(CelebrityTemplateRepository.class),
                mock(CelebrityShowcaseRepository.class),
                mock(CelebrityStarAuthorizationRepository.class),
                creditService,
                configs,
                jobRepo);
    }

    private Map<String, Object> payload() {
        Map<String, Object> p = new HashMap<>();
        p.put("engine", "KeLing");
        p.put("durationSec", 15);
        p.put("starId", "star-1");
        return p;
    }

    @Test
    void startGeneration_persistsJobAndHolds() {
        AsyncJobStartedDto dto = svc.startGeneration(payload(), USER);

        assertNotNull(dto.jobId());
        assertTrue(db.containsKey(dto.jobId()), "任务应落 generation_jobs 表");
        GenerationJob saved = db.get(dto.jobId());
        assertEquals(USER, saved.getUserId());
        assertFalse(saved.isCommitted());
        assertTrue(saved.getCreditCost() > 0);
        // 冻结额度
        verify(creditService).hold(eq(USER), anyLong(), eq("celebrity_generation"), eq(dto.jobId()), anyString());
    }

    @Test
    void getJobProgress_freshJob_isNotDoneAndDoesNotCommit() {
        // startedAt = now → 几乎 0 进度
        db.put("gen-fresh", GenerationJob.builder()
                .id("gen-fresh").startedAt(Instant.now()).totalSec(60)
                .engine("KeLing").userId(USER).creditCost(50).committed(false)
                .createdAt(Instant.now()).build());

        GenerationJobProgressDto p = svc.getJobProgress("gen-fresh");

        assertNotEquals("done", p.state());
        verify(creditService, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void getJobProgress_persistedDoneJob_survivesRestartAndCommitsOnce() {
        // 模拟「重启」：任务仍在表里，startedAt 早于 totalSec 之前 → 应判定 done
        db.put("gen-old", GenerationJob.builder()
                .id("gen-old").startedAt(Instant.now().minusSeconds(3600)).totalSec(60)
                .engine("KeLing").userId(USER).creditCost(50).committed(false)
                .createdAt(Instant.now().minusSeconds(3600)).build());

        GenerationJobProgressDto p = svc.getJobProgress("gen-old");

        assertEquals("done", p.state());
        assertEquals(100, p.progress());
        // done → commit 一次 hold（此前重启后会丢，留孤儿 hold）
        verify(creditService, times(1))
                .commitHold("celebrity_generation", "gen-old", 50L, "AI 明星视频生成完成 · KeLing");
        assertTrue(db.get("gen-old").isCommitted(), "commit 后应标记 committed");
    }

    @Test
    void getJobProgress_doneJob_isIdempotent_noDoubleCommit() {
        db.put("gen-old", GenerationJob.builder()
                .id("gen-old").startedAt(Instant.now().minusSeconds(3600)).totalSec(60)
                .engine("KeLing").userId(USER).creditCost(50).committed(false)
                .createdAt(Instant.now().minusSeconds(3600)).build());

        svc.getJobProgress("gen-old");
        svc.getJobProgress("gen-old"); // 第二次轮询

        // committed 标记守门 → 只 commit 一次
        verify(creditService, times(1)).commitHold(anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void getJobProgress_unknownJob_returnsDoneFallbackWithoutCommit() {
        GenerationJobProgressDto p = svc.getJobProgress("gen-missing");

        // 任务不存在 → 回退完成态避免前端轮询卡死；但没有上下文 → 不 commit
        assertEquals("done", p.state());
        verify(creditService, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
    }
}
