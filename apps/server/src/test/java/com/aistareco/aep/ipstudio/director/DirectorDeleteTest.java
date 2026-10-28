package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.CreditHoldRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 导演台作品删除：真事务、真行锁（H2 MySQL 模式）。
 * 在途判断只看 ip_run 与原生视频任务；作品 JSON 里的 pending 快照只当额外线索。
 * 默认跑 H2；要在一个独立的本地 MySQL 上跑（H2 默认就是读已提交，测不出 MySQL 可重复读的快照差异）：
 * {@code DIRECTOR_DELETE_TEST_DB_URL=jdbc:mysql://127.0.0.1:13306/director_delete_test SPRING_DATASOURCE_USERNAME=root
 * ./mvnw test -Dtest='DirectorDelete*Test'}。只能指向一次性的测试库：ddl-auto=create-drop 会重建全部表。
 */
@SpringBootTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=${DIRECTOR_DELETE_TEST_DB_URL:jdbc:h2:mem:director-delete;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000}",
        "aep.seed.dev-data.enabled=false", "aep.cdn.driver=local", "aep.dev-auth.enabled=false", "aep.dev-fake-llm.enabled=false",
        "aep.director.initial-delay-ms=3600000"})
@ActiveProfiles("test")
class DirectorDeleteTest {
    @Autowired DirectorService director;
    @Autowired DirectorWorkRepository works;
    @Autowired IpRunRepository runs;
    @Autowired MaterialVideoJobRepository videoJobs;
    @Autowired LedgerEntryRepository ledger;
    @Autowired CreditHoldRepository holds;
    @Autowired PlatformTransactionManager tx;
    @Autowired ObjectMapper om;

    private String user() { return "u-" + UUID.randomUUID().toString().substring(0, 8); }

    private String work(String owner, ObjectNode pipeline) {
        ObjectNode c = om.createObjectNode().put("idea", "").put("draft", "剧本").put("draftRev", 0).put("seq", 0);
        c.putObject("settings"); c.putArray("episodes"); c.putArray("assets"); c.putArray("clips"); c.putArray("applied");
        c.putObject("taskMeta"); c.putNull("notice");
        if (pipeline == null) c.putNull("pipeline"); else c.set("pipeline", pipeline);
        DirectorWork w = new DirectorWork();
        w.setId("DW-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        w.setOwnerUserId(owner); w.setTitle("测试作品"); w.setRevision(1); w.setContentJson(c.toString());
        w.setCreatedAt(Instant.now()); w.setUpdatedAt(Instant.now());
        return works.save(w).getId();
    }

    private IpRun run(String workId, String owner, String node, String status, String stage, String inputJson) {
        return runs.save(IpRun.builder().id("IPR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20)).projectId(workId)
                .hostType(IpRun.HOST_DIRECTOR).ownerUserId(owner).nodeId(node).kind("studio-text").status(status).stage(stage).cost(0)
                .inputJson(inputJson == null ? "{}" : inputJson).outputJson("{}").createdAt(Instant.now()).heartbeatAt(Instant.now()).build());
    }

    private String videoJob(String owner, String status, String errorCode) {
        String id = "MVJ-" + UUID.randomUUID().toString().substring(0, 12);
        videoJobs.save(MaterialVideoJob.builder().id(id).ownerUserId(owner).app("ipstudio").status(status).errorCode(errorCode)
                .createdAt(OffsetDateTime.now()).build());
        return id;
    }

    private String boundVideo(String workId, String owner, String jobStatus, String errorCode) {
        String job = videoJob(owner, jobStatus, errorCode);
        run(workId, owner, "video:c1", IpRun.STATUS_DONE, "video.bound", "{\"_exec\":{\"nativeVideoJobIds\":[\"" + job + "\"]}}");
        return job;
    }

    private static void assertCode(String code, Executable call) {
        BusinessException e = assertThrows(BusinessException.class, call);
        assertEquals(code, e.getCode());
    }

    private DirectorWork reload(String id) { return works.findById(id).orElseThrow(); }

    @Test void ownerDeletesIdleWorkHiddenEverywhereAndRepeatSucceeds() {
        String u = user(), id = work(u, null);
        run(id, u, "script", IpRun.STATUS_DONE, "done", null);
        long ledgerBefore = ledger.count(), holdsBefore = holds.count(), runsBefore = runs.count();
        director.delete(u, id);
        DirectorWork w = reload(id);
        assertNotNull(w.getDeletedAt()); assertFalse(w.isActive());
        Instant first = w.getDeletedAt();
        director.delete(u, id); // 超时后重试：仍然成功，删除时间不变
        assertEquals(first, reload(id).getDeletedAt());
        assertTrue(director.list(u).isEmpty());
        assertFalse(works.activeIds().contains(id));
        // 作品 JSON 与任务记录保留，账本不动
        assertTrue(reload(id).getContentJson().contains("\"draft\":\"剧本\""));
        assertEquals(runsBefore, runs.count()); assertEquals(ledgerBefore, ledger.count()); assertEquals(holdsBefore, holds.count());
        for (Executable call : List.<Executable>of(
                () -> director.get(u, id),
                () -> director.patch(u, id, new DirectorService.PatchRequest("新名字", null, null, null, null)),
                () -> director.edit(u, id, new DirectorService.EditRequest("notice.dismiss", null, null, null)),
                () -> director.task(u, id, new DirectorService.TaskRequest("script", null, "r1", null, null, 0L)),
                () -> director.pipeline(u, id, new DirectorService.PipelineRequest("start", "work", null, "plan", 100L, null, true)),
                () -> director.quote(u, id, new DirectorService.QuoteRequest("video", List.of("c1"))),
                () -> director.estimate(u, id, new DirectorService.EstimateRequest("work", null, "plan"))))
            assertCode("DIRECTOR_WORK_NOT_FOUND", call);
        director.tick(id); // 后台推进跳过已删除作品
        assertEquals(first, reload(id).getDeletedAt());
    }

    @Test void othersAndMissingWorksAre404EvenWhenAlreadyDeleted() {
        String owner = user(), other = user(), id = work(owner, null);
        assertCode("DIRECTOR_WORK_NOT_FOUND", () -> director.delete(other, id));
        assertNull(reload(id).getDeletedAt());
        assertCode("DIRECTOR_WORK_NOT_FOUND", () -> director.delete(owner, "DW-missing"));
        director.delete(owner, id);
        assertCode("DIRECTOR_WORK_NOT_FOUND", () -> director.delete(other, id)); // 幂等不泄漏归属
    }

    @Test void runningIpRunBlocksDeleteUntilItEnds() {
        String u = user(), id = work(u, null);
        IpRun r = run(id, u, "board:c1", IpRun.STATUS_RUNNING, "image.provider.recovering", null);
        BusinessException e = assertThrows(BusinessException.class, () -> director.delete(u, id));
        assertEquals("DIRECTOR_WORK_BUSY", e.getCode());
        assertTrue(e.getMessage().contains("分镜图生成"), e.getMessage());
        assertNull(reload(id).getDeletedAt());
        r.setStatus(IpRun.STATUS_FAILED); runs.save(r);
        director.delete(u, id);
        assertNotNull(reload(id).getDeletedAt());
    }

    @Test void finishedVideoBindingWithLiveNativeJobBlocksDelete() {
        String u = user();
        for (String status : List.of("queued", "submitting", "generating")) {
            String id = work(u, null);
            boundVideo(id, u, status, null);
            assertCode("DIRECTOR_WORK_BUSY", () -> director.delete(u, id));
            assertNull(reload(id).getDeletedAt());
        }
        // 还没结案的未知受理 / 正在重新查询原任务：继续拦
        for (String code : List.of("VIDEO_SUBMISSION_UNKNOWN", "VIDEO_RECONCILIATION_PENDING")) {
            String unknown = work(u, null);
            boundVideo(unknown, u, "submitting", code);
            BusinessException e = assertThrows(BusinessException.class, () -> director.delete(u, unknown));
            assertEquals("DIRECTOR_WORK_BUSY", e.getCode());
            assertTrue(e.getMessage().contains("核对"), e.getMessage());
        }
        for (String status : List.of("succeeded", "failed")) {
            String id = work(u, null);
            boundVideo(id, u, status, null);
            director.delete(u, id);
            assertNotNull(reload(id).getDeletedAt());
        }
    }

    /**
     * 无有效回执的未知受理按全局规则（BUSINESS_RULES「模型任务异常状态与并发」）以 failed 结案、释放冻结和授权，
     * 不会再有结果回来；这类作品允许删除，否则会永远删不掉。
     */
    @Test void unknownSubmissionAlreadySettledAsFailedAllowsDelete() {
        String u = user(), id = work(u, null);
        boundVideo(id, u, "failed", "VIDEO_SUBMISSION_UNKNOWN");
        director.delete(u, id);
        assertNotNull(reload(id).getDeletedAt());
    }

    @Test void unconfirmableVideoJobBlocksDelete() throws Exception {
        String u = user();
        // 绑定指向一个查不到的原生任务
        String missing = work(u, null);
        run(missing, u, "video:c1", IpRun.STATUS_DONE, "video.bound", "{\"_exec\":{\"nativeVideoJobIds\":[\"MVJ-gone\"]}}");
        assertCode("DIRECTOR_WORK_BUSY", () -> director.delete(u, missing));
        // 作品 JSON 里有 pending 快照、没有绑定记录（外层事务回滚丢了绑定的情况反过来也覆盖）
        String pendingOnly = work(u, null);
        DirectorWork w = reload(pendingOnly);
        ObjectNode c = (ObjectNode) om.readTree(w.getContentJson());
        String job = videoJob(u, "generating", null);
        c.withArray("clips").addObject().put("id", "c1").putObject("video").putArray("pending").addObject().put("jobId", job);
        w.setContentJson(c.toString()); works.save(w);
        assertCode("DIRECTOR_WORK_BUSY", () -> director.delete(u, pendingOnly));
        // 原生任务不是本人的：同样无法确认
        String foreign = work(u, null);
        boundVideo(foreign, user(), "succeeded", null);
        assertCode("DIRECTOR_WORK_BUSY", () -> director.delete(u, foreign));
    }

    @Test void pipelineRunningMustStopFirstPausedOrWaitingStopsInSameTransaction() throws Exception {
        String u = user();
        String running = work(u, om.createObjectNode().put("status", "running").put("stage", "boards"));
        BusinessException e = assertThrows(BusinessException.class, () -> director.delete(u, running));
        assertEquals("DIRECTOR_WORK_BUSY", e.getCode());
        assertTrue(e.getMessage().contains("停止"), e.getMessage());
        for (String status : List.of("paused", "waiting")) {
            String id = work(u, om.createObjectNode().put("status", status).put("stage", "confirm-boards"));
            director.delete(u, id);
            DirectorWork w = reload(id);
            assertNotNull(w.getDeletedAt());
            assertEquals("stopped", om.readTree(w.getContentJson()).path("pipeline").path("status").asText());
        }
        // 暂停但还有在途任务：不删，流程也不改
        String pausedBusy = work(u, om.createObjectNode().put("status", "paused"));
        run(pausedBusy, u, "asset:a1", IpRun.STATUS_RUNNING, "generate", null);
        assertCode("DIRECTOR_WORK_BUSY", () -> director.delete(u, pausedBusy));
        assertEquals("paused", om.readTree(reload(pausedBusy).getContentJson()).path("pipeline").path("status").asText());
    }

    /** 提交任务的事务持着作品行锁、刚在独立事务里建好任务：删除要等它提交，再按新任务判忙。 */
    @Test void deleteWaitsForConcurrentSubmissionAndSeesItsTask() throws Exception {
        String u = user(), id = work(u, null);
        TransactionTemplate outer = new TransactionTemplate(tx);
        TransactionTemplate inner = new TransactionTemplate(tx);
        inner.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        CountDownLatch locked = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> submit = pool.submit(() -> outer.executeWithoutResult(s -> {
                works.lockById(id).orElseThrow();
                inner.executeWithoutResult(s2 -> run(id, u, "script", IpRun.STATUS_RUNNING, "queued", null));
                locked.countDown();
                try { Thread.sleep(600); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
            }));
            assertTrue(locked.await(10, TimeUnit.SECONDS));
            long start = System.nanoTime();
            Future<Throwable> delete = pool.submit(() -> {
                try { director.delete(u, id); return null; } catch (Throwable t) { return t; }
            });
            Throwable t = delete.get(30, TimeUnit.SECONDS);
            submit.get(30, TimeUnit.SECONDS);
            assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start) >= 300, "删除应等到提交任务的事务放锁");
            assertInstanceOf(BusinessException.class, t);
            assertEquals("DIRECTOR_WORK_BUSY", ((BusinessException) t).getCode());
            assertNull(reload(id).getDeletedAt());
        } finally { pool.shutdownNow(); }
    }

    /** 删除先拿到锁：之后排队的提交、后台推进都看到已删除，不再派发。 */
    @Test void submissionAfterDeleteSeesDeletedWork() throws Exception {
        String u = user(), id = work(u, om.createObjectNode().put("status", "paused"));
        long before = runs.findByProjectIdOrderByCreatedAtDesc(id).size();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch deleting = new CountDownLatch(1);
            TransactionTemplate outer = new TransactionTemplate(tx);
            Future<?> del = pool.submit(() -> outer.executeWithoutResult(s -> {
                director.delete(u, id);
                deleting.countDown();
                try { Thread.sleep(400); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
            }));
            assertTrue(deleting.await(10, TimeUnit.SECONDS));
            Future<Throwable> resume = pool.submit(() -> {
                try { director.pipeline(u, id, new DirectorService.PipelineRequest("resume", null, null, null, null, null, null)); return null; }
                catch (Throwable t) { return t; }
            });
            del.get(30, TimeUnit.SECONDS);
            Throwable t = resume.get(30, TimeUnit.SECONDS);
            assertInstanceOf(BusinessException.class, t);
            assertEquals("DIRECTOR_WORK_NOT_FOUND", ((BusinessException) t).getCode());
            director.tick(id);
            assertEquals(before, runs.findByProjectIdOrderByCreatedAtDesc(id).size());
        } finally { pool.shutdownNow(); }
    }
}
