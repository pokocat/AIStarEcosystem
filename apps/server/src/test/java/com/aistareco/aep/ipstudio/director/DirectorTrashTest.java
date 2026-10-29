package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.repository.CreditHoldRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 导演台回收站与恢复：真事务、真行锁（默认 H2 MySQL 模式）。
 * 要在一次性的本地 MySQL 上跑，同 {@link DirectorDeleteTest} 的类注释（DIRECTOR_DELETE_TEST_DB_URL，只能指向临时库）。
 * 恢复后回投旧任务不接着付费派发的逐分支验证在 {@code DirectorH3VideoFlowTest}（那里能走到真的改写重试与视频提交）。
 */
@SpringBootTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=${DIRECTOR_DELETE_TEST_DB_URL:jdbc:h2:mem:director-trash;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000}",
        "aep.seed.dev-data.enabled=false", "aep.cdn.driver=local", "aep.dev-auth.enabled=false", "aep.dev-fake-llm.enabled=false",
        "aep.director.initial-delay-ms=3600000"})
@ActiveProfiles("test")
class DirectorTrashTest {
    @Autowired DirectorService director;
    @Autowired DirectorWorkRepository works;
    @Autowired IpRunRepository runs;
    @Autowired MaterialVideoJobRepository videoJobs;
    @Autowired LedgerEntryRepository ledger;
    @Autowired CreditHoldRepository holds;
    @Autowired PlatformTransactionManager tx;
    @Autowired FileStorageService storage;
    @Autowired ObjectMapper om;

    private String user() { return "u-" + UUID.randomUUID().toString().substring(0, 8); }

    /** 和真实作品一样用本人的存储 key（列表会给封面签名，非本人的 key 会被归属闸拒绝）。 */
    private String key(String owner, String file) { return storage.allocateKey(IpProjectService.CATEGORY_GEN, owner, file); }

    /** 有剧本、分集、资产、分镜、候选、导出、助手历史、已回投任务记录的作品。 */
    private ObjectNode rich(String owner, ObjectNode pipeline) {
        ObjectNode c = om.createObjectNode().put("idea", "夜班分拣员").put("logline", "包裹").put("draft", "").put("draftRev", 3).put("seq", 9);
        c.putObject("settings").put("style", "真人写实").put("aspectRatio", "9:16");
        c.putArray("episodes").addObject().put("id", "e1").put("no", 1).put("title", "第一集").put("content", "第一场。分拣站。").put("rev", 2);
        ObjectNode asset = c.putArray("assets").addObject().put("id", "a1").put("kind", "character").put("name", "周小满").put("rev", 4);
        asset.putArray("episodeIds").add("e1");
        asset.putObject("image").put("adoptedId", "m1").put("adoptedBy", "user")
                .putArray("candidates").addObject().put("id", "m1").put("key", key(owner, "a1.png")).put("source", "generated");
        ObjectNode clip = c.putArray("clips").addObject().put("id", "c1").put("episodeId", "e1").put("order", 1).put("title", "开场").put("rev", 5);
        clip.putArray("assetIds").add("a1");
        clip.putObject("board").put("adoptedId", "b1").putArray("candidates").addObject().put("id", "b1").put("key", key(owner, "b1.png"));
        clip.putObject("video").put("adoptedId", "v1").putArray("candidates").addObject().put("id", "v1").put("key", key(owner, "v1.mp4"));
        c.putArray("exports").addObject().put("id", "IPR-export").put("episodeId", "e1").put("status", "done").put("key", key(owner, "e1.mp4"));
        c.putArray("applied");
        c.putObject("taskMeta");
        c.putObject("assistant").putArray("messages").addObject().put("role", "user").put("text", "把第一场改得紧张一点");
        c.putNull("notice");
        if (pipeline == null) c.putNull("pipeline"); else c.set("pipeline", pipeline);
        return c;
    }

    /** 存一部作品，连同一条已回投过的任务（taskMeta 与 applied 里都有、ip_run 也在 —— 真实作品就是这样）。 */
    private DirectorWork save(String owner, ObjectNode content, Instant deletedAt, boolean active) {
        DirectorWork w = new DirectorWork();
        w.setId("DW-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        IpRun old = runs.save(IpRun.builder().id("IPR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20)).projectId(w.getId())
                .hostType(IpRun.HOST_DIRECTOR).ownerUserId(owner).nodeId("board:c1").kind("studio-director").status(IpRun.STATUS_DONE).stage("done")
                .cost(8).inputJson("{}").outputJson("{}").createdAt(Instant.now().minus(1, ChronoUnit.DAYS)).heartbeatAt(Instant.now()).build());
        content.withArray("applied").add(old.getId());
        ((ObjectNode) content.path("taskMeta")).putObject(old.getId()).put("node", "board:c1");
        w.setOwnerUserId(owner); w.setTitle("作品 " + w.getId().substring(3, 9)); w.setRevision(7); w.setContentJson(content.toString());
        w.setCreatedAt(Instant.now().minus(2, ChronoUnit.DAYS)); w.setUpdatedAt(Instant.now().minus(1, ChronoUnit.DAYS));
        w.setDeletedAt(deletedAt); w.setActive(active);
        return works.save(w);
    }

    private DirectorWork reload(String id) { return works.findById(id).orElseThrow(); }

    private ObjectNode content(String id) throws Exception { return (ObjectNode) om.readTree(reload(id).getContentJson()); }

    /** 恢复唯一加的字段是 restoredAt（见 DirectorService#beforeRestore）；比较内容时去掉它。 */
    private ObjectNode withoutRestoreStamp(ObjectNode c) { ObjectNode copy = c.deepCopy(); copy.remove("restoredAt"); return copy; }

    private static void assertCode(String code, Executable call) {
        BusinessException e = assertThrows(BusinessException.class, call);
        assertEquals(code, e.getCode());
    }

    private static List<String> ids(List<JsonNode> items) { return items.stream().map(n -> n.path("id").asText()).toList(); }

    @Test void trashListsOnlyMyDeletedWorksIncludingHistoricSoftDeletes() throws Exception {
        String u = user(), other = user();
        String normal = save(u, rich(u, null), null, false).getId();
        String deleted = save(u, rich(u, null), null, false).getId();
        director.delete(u, deleted);
        // 功能上线前的软删除：只写了 deletedAt，一键制作的状态也没停
        String historic = save(u, rich(u, om.createObjectNode().put("status", "running")), Instant.now().minus(3, ChronoUnit.DAYS), false).getId();
        String foreign = save(other, rich(other, null), Instant.now(), false).getId();
        String historicJson = reload(historic).getContentJson();

        List<JsonNode> trash = director.trash(u);
        assertEquals(List.of(deleted, historic), ids(trash), "最近删除的在前，只列本人");
        for (JsonNode item : trash) {
            assertTrue(item.hasNonNull("deletedAt"));
            assertFalse(item.path("running").asBoolean(true));
            assertTrue(item.path("title").asText().startsWith("作品"));
            assertTrue(item.path("coverUrl").isTextual(), "封面照常签名");
        }
        assertEquals(List.of(normal), ids(director.list(u)), "正常列表与回收站互不混");
        assertEquals(List.of(foreign), ids(director.trash(other)));
        assertEquals(historicJson, reload(historic).getContentJson(), "回收站是只读投影，不改内容");
        assertEquals(7, reload(historic).getRevision());
    }

    @Test void trashDoesNotApplyFinishedTasks() {
        String u = user(), id = save(u, rich(u, null), Instant.now(), false).getId();
        runs.save(IpRun.builder().id("IPR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20)).projectId(id)
                .hostType(IpRun.HOST_DIRECTOR).ownerUserId(u).nodeId("board:c1").kind("studio-director").status(IpRun.STATUS_DONE)
                .stage("done").cost(8).inputJson("{}").outputJson("{}").createdAt(Instant.now()).heartbeatAt(Instant.now()).build());
        String json = reload(id).getContentJson();
        director.trash(u);
        assertEquals(json, reload(id).getContentJson(), "还没回投的结果留给恢复后的读取，回收站不回投");
        assertEquals(7, reload(id).getRevision());
    }

    @Test void restoreBringsBackTheSameWorkWithAllContentAndTaskHistory() throws Exception {
        String u = user();
        String id = save(u, rich(u, null), null, false).getId();
        ObjectNode before = content(id);
        long runsBefore = runs.count(), jobsBefore = videoJobs.count(), ledgerBefore = ledger.count(), holdsBefore = holds.count(), worksBefore = works.count();

        director.delete(u, id);
        assertTrue(director.list(u).isEmpty());
        director.restore(u, id);

        DirectorWork back = reload(id);
        assertNull(back.getDeletedAt());
        assertFalse(back.isActive());
        assertTrue(content(id).path("restoredAt").isTextual());
        assertEquals(before, withoutRestoreStamp(content(id)), "剧本、分集、资产、分镜、候选、导出、助手历史、任务记录一字不动");
        assertEquals(List.of(id), ids(director.list(u)), "回到正常列表，原 ID");
        assertTrue(director.trash(u).isEmpty());
        assertEquals(worksBefore, works.count(), "不复制作品");
        assertEquals(runsBefore, runs.count(), "不重提任务");
        assertEquals(jobsBefore, videoJobs.count());
        assertEquals(ledgerBefore, ledger.count(), "不扣费、不退款");
        assertEquals(holdsBefore, holds.count(), "不冻结");
    }

    @Test void restoredWorkStaysStoppedAndTheSchedulerDoesNotResume() throws Exception {
        String u = user();
        // 删除时暂停中：删除把它停掉
        String paused = save(u, rich(u, om.createObjectNode().put("status", "paused").put("stage", "boards")), null, false).getId();
        director.delete(u, paused);
        // 历史软删：流程还写着 running、active 还是 true（旧删除逻辑只设 deletedAt）
        String historic = save(u, rich(u, om.createObjectNode().put("status", "running").put("stage", "videos")),
                Instant.now().minus(1, ChronoUnit.DAYS), true).getId();
        ObjectNode historicBefore = content(historic);
        long runsBefore = runs.count(), holdsBefore = holds.count();

        for (String id : List.of(paused, historic)) {
            director.restore(u, id);
            assertNull(reload(id).getDeletedAt());
            assertFalse(reload(id).isActive());
            assertFalse(works.activeIds().contains(id), "后台调度不扫");
            assertEquals("stopped", content(id).path("pipeline").path("status").asText());
            director.tick(id); // 即使被调度到，也不推进已停止的流程
            assertEquals("stopped", content(id).path("pipeline").path("status").asText());
            assertFalse(reload(id).isActive());
        }
        assertEquals(runsBefore, runs.count(), "恢复和推进都不派发任务");
        assertEquals(holdsBefore, holds.count());
        // 历史作品：除了流程状态和恢复时间，别的内容不动
        ObjectNode actual = withoutRestoreStamp(content(historic));
        for (ObjectNode c : List.of(actual, historicBefore)) ((ObjectNode) c.path("pipeline")).remove(List.of("status", "message", "finishedAt"));
        assertEquals(historicBefore, actual);
    }

    /**
     * 终态但还没回投的手动视频提示词改写 → 删除（在途检查放行）→ 恢复 → 第一次读取 / 推进：结果写进作品，
     * 不接着提交视频、不自动重试改写、不新建冻结。删除逻辑上线前的历史软删同样走恢复这一道。
     * 逐分支（真的走到视频提交与改写重试）在 DirectorH3VideoFlowTest 的 restore 用例。
     */
    @Test void finishedButUnappliedManualRewriteDoesNotChainAfterRestore() throws Exception {
        String u = user();
        for (boolean historic : List.of(false, true)) {
            String id = save(u, rich(u, null), historic ? Instant.now().minus(2, ChronoUnit.DAYS) : null, false).getId();
            ObjectNode then = om.createObjectNode().put("requestId", "u-r1").put("maxCost", 600).put("fingerprint", "fp");
            ObjectNode in = om.createObjectNode();
            in.putObject("_director").put("task", "videoPrompt").put("targetId", "c1").put("hash", "h").set("then", then);
            ObjectNode done = om.createObjectNode();
            done.putObject("director").put("template", "A static wide shot.").put("usable", true);
            IpRun rewrite = runs.save(IpRun.builder().id("IPR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20)).projectId(id)
                    .hostType(IpRun.HOST_DIRECTOR).ownerUserId(u).nodeId("videoPrompt:c1").kind("studio-director").status(IpRun.STATUS_DONE)
                    .stage("done").cost(2).inputJson(in.toString()).outputJson(done.toString()).createdAt(Instant.now().minusSeconds(5))
                    .heartbeatAt(Instant.now()).build());
            IpRun failed = runs.save(IpRun.builder().id("IPR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20)).projectId(id)
                    .hostType(IpRun.HOST_DIRECTOR).ownerUserId(u).nodeId("videoPrompt:c1").kind("studio-director").status(IpRun.STATUS_FAILED)
                    .stage("failed").errorCode("AI_BAD_OUTPUT").errorMessage("视频提示词改写不合格，本次未扣积分，请重试").cost(0)
                    .inputJson(in.toString()).outputJson("{}").createdAt(Instant.now().minusSeconds(4)).heartbeatAt(Instant.now()).build());
            if (!historic) director.delete(u, id); // 都已结束：删除放行
            director.restore(u, id);
            long runsBefore = runs.count(), holdsBefore = holds.count(), jobsBefore = videoJobs.count(), ledgerBefore = ledger.count();

            director.tick(id); // 与第一次 get 走同一个 reconcile
            ObjectNode c = content(id);
            assertTrue(c.path("applied").toString().contains(rewrite.getId()), "正常回投");
            assertTrue(c.path("applied").toString().contains(failed.getId()));
            assertEquals("A static wide shot.", c.path("clips").get(0).path("videoPromptEn").path("template").asText(), "改写结果保存下来");
            assertEquals(0, c.path("clips").get(0).path("video").path("pending").size(), "没有提交视频");
            assertEquals(runsBefore, runs.count(), "没有自动重试改写");
            assertEquals(holdsBefore, holds.count(), "没有新的冻结");
            assertEquals(jobsBefore, videoJobs.count());
            assertEquals(ledgerBefore, ledger.count());
            assertFalse(reload(id).isActive());
        }
    }

    /** 前端据 restoredAt 决定打开作品时不自动发起付费任务（如创意对话开场），所以读作品要带出它；没恢复过是 null。 */
    @Test void readingAWorkTellsWhetherItWasRestored() {
        String u = user();
        String fresh = save(u, rich(u, null), null, false).getId();
        String back = save(u, rich(u, null), Instant.now(), false).getId();
        director.restore(u, back);
        assertTrue(director.get(u, fresh).path("restoredAt").isNull());
        assertTrue(director.get(u, back).path("restoredAt").isTextual());
    }

    @Test void restoringANormalWorkIsANoOpEvenWhileItIsRunning() throws Exception {
        String u = user();
        String id = save(u, rich(u, om.createObjectNode().put("status", "running").put("stage", "boards")), null, true).getId();
        runs.save(IpRun.builder().id("IPR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20)).projectId(id)
                .hostType(IpRun.HOST_DIRECTOR).ownerUserId(u).nodeId("board:c1").kind("studio-director").status(IpRun.STATUS_RUNNING)
                .stage("generate").cost(0).inputJson("{}").outputJson("{}").createdAt(Instant.now()).heartbeatAt(Instant.now()).build());
        DirectorWork before = reload(id);
        director.restore(u, id);
        director.restore(u, id);
        DirectorWork after = reload(id);
        assertNull(after.getDeletedAt());
        assertTrue(after.isActive(), "不打断正在跑的任务");
        assertEquals(before.getRevision(), after.getRevision());
        assertEquals(before.getUpdatedAt(), after.getUpdatedAt());
        assertEquals(before.getContentJson(), after.getContentJson(), "不写 restoredAt，不重写内容");
        assertEquals("running", content(id).path("pipeline").path("status").asText());
    }

    @Test void repeatedRestoreAfterRestoreIsSafe() throws Exception {
        String u = user();
        String id = save(u, rich(u, null), Instant.now(), false).getId();
        director.restore(u, id);
        DirectorWork first = reload(id);
        director.restore(u, id); // 超时重试
        DirectorWork second = reload(id);
        assertEquals(first.getRevision(), second.getRevision());
        assertEquals(first.getContentJson(), second.getContentJson(), "restoredAt 不被重试刷新");
        assertNull(second.getDeletedAt());
    }

    @Test void othersAndMissingWorksAre404AndStayDeleted() {
        String owner = user(), other = user();
        String id = save(owner, rich(owner, null), Instant.now(), false).getId();
        assertCode("DIRECTOR_WORK_NOT_FOUND", () -> director.restore(other, id));
        assertNotNull(reload(id).getDeletedAt());
        assertCode("DIRECTOR_WORK_NOT_FOUND", () -> director.restore(owner, "DW-missing"));
        String live = save(owner, rich(owner, null), null, false).getId();
        assertCode("DIRECTOR_WORK_NOT_FOUND", () -> director.restore(other, live)); // 正常作品也不泄漏归属
        assertTrue(director.trash(other).isEmpty());
    }

    /** 恢复不占新建额度（见 DirectorService#restore 注释）；新建的上限照旧。 */
    @Test void restoreDoesNotUseTheCreationQuotaAndCreateKeepsItsLimit() {
        String u = user();
        for (int i = 0; i < 200; i++) {
            DirectorWork w = new DirectorWork();
            w.setId("DW-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
            w.setOwnerUserId(u); w.setTitle("占位"); w.setRevision(1); w.setContentJson("{\"pipeline\":null}");
            w.setCreatedAt(Instant.now()); w.setUpdatedAt(Instant.now());
            works.save(w);
        }
        String id = save(u, rich(u, null), Instant.now(), false).getId();
        director.restore(u, id);
        assertNull(reload(id).getDeletedAt());
        assertCode("DIRECTOR_WORK_LIMIT", () -> director.create(u, new DirectorService.CreateRequest("新作品", "创意", null)));
    }

    /** 恢复先拿到锁：删除排在后面，等恢复提交后再删，最后是已删除，内容不丢。 */
    @Test void deleteQueuedBehindRestoreDeletesAfterIt() throws Exception {
        String u = user(), id = save(u, rich(u, null), Instant.now(), false).getId();
        ObjectNode before = content(id);
        assertNull(race(() -> director.restore(u, id), () -> director.delete(u, id)));
        assertNotNull(reload(id).getDeletedAt());
        assertEquals(List.of(id), ids(director.trash(u)));
        assertEquals(before, withoutRestoreStamp(content(id)));
    }

    /** 删除先拿到锁：恢复排在后面，看到已删除，把它恢复回来。 */
    @Test void restoreQueuedBehindDeleteRestoresAfterIt() throws Exception {
        String u = user(), id = save(u, rich(u, null), null, false).getId();
        ObjectNode before = content(id);
        assertNull(race(() -> director.delete(u, id), () -> director.restore(u, id)));
        assertNull(reload(id).getDeletedAt());
        assertEquals(before, withoutRestoreStamp(content(id)));
        assertEquals(List.of(id), ids(director.list(u)));
    }

    /** 恢复与后台推进：推进排在恢复后面，看到的是已停止的流程，不派发。 */
    @Test void tickQueuedBehindRestoreDoesNotDispatch() throws Exception {
        String u = user();
        String id = save(u, rich(u, om.createObjectNode().put("status", "running").put("stage", "boards")), Instant.now(), true).getId();
        long runsBefore = runs.count();
        assertNull(race(() -> director.restore(u, id), () -> director.tick(id)));
        assertEquals("stopped", content(id).path("pipeline").path("status").asText());
        assertFalse(reload(id).isActive());
        assertEquals(runsBefore, runs.count());
    }

    /** first 在持着作品行锁的事务里执行并停一会再提交；second 在它拿锁之后开始，必须等它提交。返回 second 的异常。 */
    private Throwable race(Runnable first, Runnable second) throws Exception {
        CountDownLatch locked = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> a = pool.submit(() -> new TransactionTemplate(tx).executeWithoutResult(s -> {
                first.run();
                locked.countDown();
                try { Thread.sleep(500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            }));
            assertTrue(locked.await(10, TimeUnit.SECONDS));
            long start = System.nanoTime();
            Future<Throwable> b = pool.submit(() -> { try { second.run(); return null; } catch (Throwable e) { return e; } });
            Throwable t = b.get(30, TimeUnit.SECONDS);
            a.get(30, TimeUnit.SECONDS);
            assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start) >= 300, "后到的一方应等前一方放锁");
            return t;
        } finally { pool.shutdownNow(); }
    }
}
