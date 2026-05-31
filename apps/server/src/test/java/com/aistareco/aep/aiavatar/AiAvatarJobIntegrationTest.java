package com.aistareco.aep.aiavatar;

import com.aistareco.aep.aiavatar.model.*;
import com.aistareco.aep.aiavatar.repository.*;
import com.aistareco.aep.aiavatar.service.AiAvatarService;
import com.aistareco.aep.aiavatar.service.AiAvatarJobWatchdog;
import com.aistareco.aep.aiavatar.dto.AiAvatarRequests;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.awaitility.Awaitility.await;
import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.*;

/**
 * AiAvatar异步管线 + 监控线程**真实 Bean** 集成测试（@SpringBootTest + H2）。
 *
 * 1. 真实派发打样任务 → 真实 @Async runner 跑完 → 落资产 + 建版本 + 推状态机 draft→sampling。
 * 2. 监控线程恢复（用户硬要求）：构造心跳过期的 RUNNING 任务 → 真实 watchdog.sweep() → 任务被续跑至成功。
 */
@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:aiavatar-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.seed.dev-data.enabled=true",
        "aep.aiavatar.app-mode=dev",
        "aep.aiavatar.credit-per-generation=0",
        "aep.aiavatar.watchdog-interval-ms=0",          // 禁用自动调度，测试里手动 sweep
        "aep.aiavatar.job-stale-ms=1000"
})
class AiAvatarJobIntegrationTest {

    @Autowired private AiAvatarService avatarService;
    @Autowired private AiAvatarJobWatchdog watchdog;
    @Autowired private AiAvatarRepository avatarRepo;
    @Autowired private AiAvatarJobRepository jobRepo;
    @Autowired private AiAvatarAssetRepository assetRepo;
    @Autowired private AiAvatarVersionRepository versionRepo;

    private static final String USER = "aiavatar-it-user";

    @Test
    void samplingPipeline_producesAssetsVersionAndAdvancesStatus() {
        AiAvatar avatar = avatarService.create(USER, new AiAvatarRequests.CreateAvatar(
                AiAvatarCreationMode.AI_ORIGINAL, "集成测试人", "未来机能风测试人设", "未来机能", null));

        AiAvatarJob job = avatarService.startSampling(avatar.getId(), USER,
                new AiAvatarRequests.SubmitJob(AiAvatarCapability.TXT2IMG, "测试", null, null, null, null, 3, null, null));

        // 真实 @Async runner 在 aiAvatarJobExecutor 线程跑完
        await().atMost(30, SECONDS).untilAsserted(() -> {
            AiAvatarJob fresh = jobRepo.findById(job.getId()).orElseThrow();
            assertEquals(AiAvatarJobStatus.SUCCEEDED, fresh.getStatus());
        });

        AiAvatarJob done = jobRepo.findById(job.getId()).orElseThrow();
        assertEquals(100, done.getProgress());
        assertNotNull(done.getVersionId());

        // 产出了 3 张草稿资产
        assertEquals(3, assetRepo.findByAvatarIdOrderByCreatedAtDesc(avatar.getId()).size());
        // 建了版本快照
        assertTrue(versionRepo.countByAvatarId(avatar.getId()) >= 1);
        // 状态机推进 draft → sampling
        assertEquals(AiAvatarStatus.SAMPLING, avatarRepo.findById(avatar.getId()).orElseThrow().getStatus());
    }

    @Test
    void watchdog_resumesStaleRunningJob_toCompletion() {
        AiAvatar avatar = avatarService.create(USER, new AiAvatarRequests.CreateAvatar(
                AiAvatarCreationMode.AI_ORIGINAL, "续跑测试人", "p", "赛博朋克", null));

        // 构造一个「异常中断」的任务：RUNNING + 心跳过期 + 未跑完
        AiAvatarJob stuck = AiAvatarJob.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(USER)
                .avatarId(avatar.getId())
                .capability(AiAvatarCapability.TXT2IMG)
                .status(AiAvatarJobStatus.RUNNING)
                .progress(35)
                .attempts(1)
                .maxAttempts(3)
                .title("打样")
                .inputJson("{\"variants\":2}")
                .heartbeatAt(OffsetDateTime.now().minusMinutes(30))   // 远超 job-stale-ms=1s
                .startedAt(OffsetDateTime.now().minusMinutes(31))
                .createdAt(OffsetDateTime.now().minusMinutes(31))
                .build();
        jobRepo.save(stuck);

        // 真实监控线程巡检 → 应判定异常中断并续跑
        watchdog.sweep();

        // 续跑后真实 runner 接管并跑到成功
        await().atMost(30, SECONDS).untilAsserted(() -> {
            AiAvatarJob fresh = jobRepo.findById(stuck.getId()).orElseThrow();
            assertEquals(AiAvatarJobStatus.SUCCEEDED, fresh.getStatus(),
                    "监控线程应把异常中断的任务续跑至成功，当前=" + fresh.getStatus());
        });
        assertTrue(jobRepo.findById(stuck.getId()).orElseThrow().getAttempts() >= 2,
                "续跑应至少再尝试一次");
    }

    @Test
    void watchdog_exhaustedJob_marksFailedNotResume() {
        AiAvatarJob exhausted = AiAvatarJob.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(USER)
                .capability(AiAvatarCapability.TXT2IMG)
                .status(AiAvatarJobStatus.RUNNING)
                .progress(10)
                .attempts(3)
                .maxAttempts(3)
                .title("打样")
                .heartbeatAt(OffsetDateTime.now().minusMinutes(30))
                .createdAt(OffsetDateTime.now().minusMinutes(31))
                .build();
        jobRepo.save(exhausted);

        watchdog.sweep();

        AiAvatarJob fresh = jobRepo.findById(exhausted.getId()).orElseThrow();
        assertEquals(AiAvatarJobStatus.FAILED, fresh.getStatus(), "达最大重试的卡死任务应置 FAILED，不再续跑");
        assertNotNull(fresh.getErrorMessage());
    }
}
