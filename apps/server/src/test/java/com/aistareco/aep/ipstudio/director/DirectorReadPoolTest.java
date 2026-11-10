package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.service.StudioVideoService;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * 导演台读作品不能在持着作品行锁时再要第二条连接（2026-11-10 线上事故）。
 * 一个账号 10 秒内对同一部作品发了 125 个读取：旧实现在锁内另开 REQUIRES_NEW 读任务列表，
 * 拿到锁的那个等不到第二条连接（池子被等锁的请求占满），其余的等锁超时，读作品连续 500，全站接口跟着失败。
 * 这里连接池只开 3 条、取连接超时 1.2 秒，并发读取多于池容量也要全部成功。
 * <p>同时守住 2026-10-24 的问题：本次请求里在独立事务中刚建的任务，出 wire 时要列出来。
 * H2 默认就是读已提交，这一条只有在 MySQL（可重复读）上才有区分度：
 * {@code DIRECTOR_DELETE_TEST_DB_URL=jdbc:mysql://127.0.0.1:13306/director_delete_test SPRING_DATASOURCE_USERNAME=root
 * ./mvnw test -Dtest='DirectorReadPoolTest'}，只能指向一次性的测试库（ddl-auto=create-drop 会重建全部表）。
 */
@SpringBootTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=${DIRECTOR_DELETE_TEST_DB_URL:jdbc:h2:mem:director-read-pool;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000}",
        "spring.datasource.hikari.maximum-pool-size=3", "spring.datasource.hikari.minimum-idle=0",
        "spring.datasource.hikari.connection-timeout=1200",
        "aep.seed.dev-data.enabled=false", "aep.cdn.driver=local", "aep.dev-auth.enabled=false",
        "aep.dev-fake-llm.enabled=false", "aep.director.initial-delay-ms=3600000"})
@ActiveProfiles("test")
class DirectorReadPoolTest {
    @Autowired DirectorService director;
    @Autowired DirectorWorkRepository works;
    @Autowired IpRunRepository runs;
    @Autowired PlatformTransactionManager tx;
    /** 读作品时回投视频要查原生视频任务；这里借这一步模拟「本次请求里另一个事务刚建了任务」。 */
    @MockBean MaterialVideoJobService videoJobs;
    /** 下面两条续接用例：H3 视频模型、视频提交、文字任务提交都换成桩，只看连接和建了几条任务。 */
    @MockBean StudioVideoService videoModels;
    @MockBean IpRunService imageRuns;
    @SpyBean StudioWorkflowService textRuns;
    @Autowired ObjectMapper om;

    private String work(String owner, String content) {
        DirectorWork w = new DirectorWork();
        w.setId("DW-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        w.setOwnerUserId(owner); w.setTitle("读取"); w.setRevision(1);
        w.setCreatedAt(Instant.now()); w.setUpdatedAt(Instant.now());
        w.setContentJson(content);
        return works.save(w).getId();
    }

    private String work(String owner) {
        return work(owner, "{\"idea\":\"\",\"draft\":\"剧本\",\"draftRev\":0,\"seq\":0,\"settings\":{},\"notice\":null,\"clips\":[],\"assets\":[],\"episodes\":[],\"applied\":[],\"taskMeta\":{},\"pipeline\":null}");
    }

    private IpRun runOf(String workId, String owner) {
        return IpRun.builder().id("IPR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20)).projectId(workId)
                .hostType(IpRun.HOST_DIRECTOR).ownerUserId(owner).nodeId("script").kind("studio-director").status(IpRun.STATUS_RUNNING)
                .stage("queued").cost(0).inputJson("{}").outputJson("{}").createdAt(Instant.now()).heartbeatAt(Instant.now()).build();
    }

    private static List<String> taskIds(JsonNode view) {
        List<String> out = new ArrayList<>();
        view.path("tasks").forEach(t -> out.add(t.path("id").asText()));
        return out;
    }

    /** 控制器的真实形态：同一部作品的并发读取多于连接数，各自起事务排队拿锁，全部成功、都看得到任务。 */
    @Test void moreConcurrentReadsOfOneWorkThanConnectionsAllSucceed() throws Exception {
        String u = "read-" + UUID.randomUUID().toString().substring(0, 8);
        String id = work(u);
        String run = runs.save(runOf(id, u)).getId();
        int n = 12;
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(n);
        try {
            List<Future<Object>> futures = new ArrayList<>();
            for (int i = 0; i < n; i++) futures.add(pool.submit(() -> {
                try { go.await(); return director.get(u, id); } catch (Throwable t) { return t; }
            }));
            go.countDown();
            List<Object> errors = new ArrayList<>();
            for (Future<Object> f : futures) {
                Object r = f.get(60, TimeUnit.SECONDS);
                if (r instanceof Throwable) errors.add(r);
                else assertEquals(List.of(run), taskIds((JsonNode) r));
            }
            assertTrue(errors.isEmpty(), "并发读取失败：" + errors);
        } finally { go.countDown(); pool.shutdownNow(); }
    }

    /** 池子被占满：每个线程已持一条连接和自己作品的行锁（读已提交，同入口声明），再同时读作品。读取必须复用这条连接。 */
    @Test void readsInsideHeldConnectionsDoNotNeedASecondOne() throws Exception {
        String u = "read-" + UUID.randomUUID().toString().substring(0, 8);
        List<String> ids = List.of(work(u), work(u), work(u));
        CountDownLatch held = new CountDownLatch(ids.size());
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(ids.size());
        try {
            List<Future<Throwable>> futures = new ArrayList<>();
            for (String id : ids) futures.add(pool.submit(() -> {
                try {
                    TransactionTemplate t = new TransactionTemplate(tx);
                    t.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
                    t.executeWithoutResult(s -> {
                        works.lockById(id).orElseThrow();
                        held.countDown();
                        try { if (!go.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("barrier"); }
                        catch (InterruptedException e) { throw new RuntimeException(e); }
                        director.get(u, id);
                    });
                    return null;
                } catch (Throwable t) { return t; }
            }));
            assertTrue(held.await(10, TimeUnit.SECONDS), "三条连接都应被占住");
            go.countDown();
            List<Throwable> errors = new ArrayList<>();
            for (Future<Throwable> f : futures) { Throwable t = f.get(20, TimeUnit.SECONDS); if (t != null) errors.add(t); }
            assertTrue(errors.isEmpty(), "并发读取失败：" + errors);
        } finally { go.countDown(); pool.shutdownNow(); }
    }

    /**
     * 2026-10-24：读作品的事务已经读过任务表（MySQL 可重复读在这一刻定下快照），之后另一个事务提交了新任务，
     * 出 wire 的任务列表仍要有它，否则页面以为没在生成、也不轮询。
     */
    @Test void taskCommittedByAnotherTransactionDuringTheReadIsListed() {
        String u = "read-" + UUID.randomUUID().toString().substring(0, 8);
        String id = work(u, "{\"idea\":\"\",\"draft\":\"剧本\",\"draftRev\":0,\"seq\":0,\"settings\":{},\"notice\":null,\"clips\":[{\"id\":\"c1\",\"video\":{\"pending\":[{\"jobId\":\"MVJ-pending\",\"stage\":\"queued\",\"at\":\"2026-11-10T08:00:00Z\"}]}}],"
                + "\"assets\":[],\"episodes\":[],\"applied\":[],\"taskMeta\":{},\"pipeline\":null}");
        TransactionTemplate independent = new TransactionTemplate(tx);
        independent.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        String[] created = new String[1];
        when(videoJobs.getJob(anyString(), anyString(), anyString())).thenAnswer(inv -> {
            if (created[0] == null) created[0] = independent.execute(s -> runs.save(runOf(id, u)).getId());
            return null; // 视频任务还没查到：当作还在跑
        });
        JsonNode view = director.get(u, id);
        assertNotNull(created[0], "回投视频时应查过原生视频任务");
        assertTrue(taskIds(view).contains(created[0]), "刚提交的任务应出现在任务列表里：" + view.path("tasks"));
    }

    // ── 读作品时回投触发的续接（PR 187 评审）：改写完成接着出视频、改写不合格自动重试 ─────────────────────
    // 旧实现在作品行锁内另开 REQUIRES_NEW 提交：并发读取时持锁的等不到第二条连接，连接超时被回投吞掉、任务照样记成已回投，
    // 之后再也不会续接。现在锁内只记意图，锁放开后由后台线程提交一次。

    /** 图片 key 用全局示例前缀：所有登录用户可读，出 wire 能签名（不是本人的 key 签名失败会让整次请求回滚）。 */
    private String h3Work(String owner) {
        return work(owner, """
                {"idea":"","draft":"剧本","draftRev":0,"seq":0,"notice":null,"pipeline":null,"episodes":[],"applied":[],"taskMeta":{},
                 "settings":{"style":"真人写实","aspectRatio":"9:16","language":"中文"},
                 "assets":[
                  {"id":"as4","kind":"character","name":"陈默","description":"25-30岁男性，瘦削。","image":{"candidates":[{"id":"m1","key":"ipstudio_demo/read-pool/chen.png","source":"generated"}],"adoptedId":"m1","adoptedBy":"user"}},
                  {"id":"as5","kind":"character","name":"老赵","description":"50-60岁男性，安保人员。","image":{"candidates":[{"id":"m2","key":"ipstudio_demo/read-pool/zhao.png","source":"generated"}],"adoptedId":"m2","adoptedBy":"user"}}],
                 "clips":[{"id":"cl1","episodeId":"ep1","order":1,"title":"通道对话","durationSec":12,"assetIds":["as4","as5"],
                  "shots":[
                   {"durationSec":5,"size":"全景","camera":"固定机位","still":"陈默走出洞窟","action":"陈默提着饼干盒走向通道尽头","dialogue":[]},
                   {"durationSec":7,"size":"中景","camera":"越过陈默肩膀拍老赵","still":"老赵掐灭烟头","action":"老赵盯着陈默","dialogue":[
                     {"speakerId":"as5","text":"又熬通宵？小陈啊，你这身子骨，再这么干下去，怕是要先于壁画塌了。"},
                     {"speakerId":"as4","text":"赵叔，我这人吧，就是闲不住。看见那墙上有灰，心里就难受。"},
                     {"speakerId":"as5","text":"难受？那你昨晚听见啥动静没？"}]}],
                  "board":{"candidates":[{"id":"b1","key":"ipstudio_demo/read-pool/board.png","source":"generated"}],"adoptedId":"b1","adoptedBy":"user"},
                  "video":{"candidates":[],"adoptedId":null,"pending":[]}}]}""");
    }

    /** 文字任务提交的桩：真写一条 ip_run（同真实实现，按请求编号幂等），记下每次调用的请求编号。 */
    private List<String> stubTextSubmissions() {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("universal_reference_video", false, false, null, null)),
                List.of(new VideoStudioTier("768p", List.of(new VideoStudioCanvas("9:16", 768, 1344)))), 4, 15, 7000, 0L);
        when(videoModels.models()).thenReturn(List.of(new VideoStudioModel("ep-h3", "MiniMax H3", true, true, true, contract, null)));
        when(videoModels.quote(anyString(), any())).thenReturn(600L);
        doReturn(5L).when(textRuns).videoRewriteHold();
        List<String> requestIds = java.util.Collections.synchronizedList(new ArrayList<>());
        doAnswer(inv -> {
            String host = inv.getArgument(1), node = inv.getArgument(2), requestId = inv.getArgument(5);
            requestIds.add(requestId);
            IpRun prior = runs.findByProjectIdAndClientRequestId(host, requestId).orElse(null);
            String runId = prior != null ? prior.getId() : runs.save(IpRun.builder().id("IPR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20))
                    .projectId(host).hostType(IpRun.HOST_DIRECTOR).ownerUserId(inv.getArgument(0)).nodeId(node).kind("studio-director")
                    .status(IpRun.STATUS_RUNNING).stage("queued").cost(0).clientRequestId(requestId)
                    .inputJson(om.createObjectNode().set("_director", inv.<ObjectNode>getArgument(6)).toString()).outputJson("{}")
                    .createdAt(Instant.now()).heartbeatAt(Instant.now()).build()).getId();
            return new IpRunDto(runId, host, node, "studio-director", "running", "queued", 0, 5, null, null, null, null, "t", null, null);
        }).when(textRuns).submitDirectorText(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), any(), any(), any(), any());
        return requestIds;
    }

    /** 点「生成视频」：H3 先发提示词改写，返回这条改写任务。 */
    private IpRun startVideo(String u, String id) {
        director.task(u, id, new DirectorService.TaskRequest("video", "cl1", "r1", om.createObjectNode(), null, 600L));
        return runs.findByProjectIdAndClientRequestId(id, "u-r1-p").orElseThrow();
    }

    private ObjectNode rewriteOutput(JsonNode meta) {
        ObjectNode o = om.createObjectNode().put("subject_definitions", "<Subject 1> is Chen Mo in <Picture 2>. <Subject 2> is Lao Zhao in <Picture 3>.")
                .put("summary", "[reference generation] Two men talk in a sandy corridor.").put("retention_analysis", "<Subject 1> (appears in [Shot 1], [Shot 2]): fully_preserved - face.\n<Picture 1> ([Shot 1]–[Shot 2] storyboard): fully_preserved - layout.")
                .put("style", "Live-action, cinematic.").put("overall_soundscape", "Wind blows sand along the corridor.").put("non_diegetic_music", "N/A");
        ArrayNode shots = o.putArray("shots");
        shots.add("A static wide shot as <Subject 1> walks out of the cave carrying a tin box.");
        shots.add("the camera cuts to <Subject 2> over the shoulder of <Subject 1>. <Subject 2> says in a rough voice: {{L1}} <Subject 1> replies quietly: {{L2}} <Subject 2> asks: {{L3}}");
        ObjectNode out = om.createObjectNode();
        out.set("director", DirectorPrompts.validate(om, meta, o));
        return out;
    }

    /** 12 个并发读取，全部成功。 */
    private void readConcurrently(String u, String id) throws Exception {
        int n = 12;
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(n);
        try {
            List<Future<Object>> futures = new ArrayList<>();
            for (int i = 0; i < n; i++) futures.add(pool.submit(() -> {
                try { go.await(); return director.get(u, id); } catch (Throwable t) { return t; }
            }));
            go.countDown();
            List<Object> errors = new ArrayList<>();
            for (Future<Object> f : futures) { Object r = f.get(60, TimeUnit.SECONDS); if (r instanceof Throwable) errors.add(r); }
            assertTrue(errors.isEmpty(), "并发读取失败：" + errors);
        } finally { go.countDown(); pool.shutdownNow(); }
    }

    /** 等后台线程把续接提交完、结果记回作品。 */
    private JsonNode awaitFollowUpsDone(String id) throws Exception {
        long deadline = System.currentTimeMillis() + 20_000;
        while (true) {
            JsonNode c = om.readTree(works.findById(id).orElseThrow().getContentJson());
            if (c.path("followUps").isEmpty()) return c;
            if (System.currentTimeMillis() > deadline) fail("续接没有提交完：" + c.path("followUps"));
            Thread.sleep(100);
        }
    }

    @Test void aFinishedRewriteSubmitsItsVideoOnceUnderConcurrentReads() throws Exception {
        String u = "read-" + UUID.randomUUID().toString().substring(0, 8);
        String id = h3Work(u);
        stubTextSubmissions();
        when(imageRuns.generateVideoForDirector(anyString(), anyString(), anyString(), any()))
                .thenReturn(om.createObjectNode().put("id", "MVJ-chained").put("stage", "queued").put("progress_pct", 0));
        IpRun rewrite = startVideo(u, id);
        JsonNode meta = om.readTree(rewrite.getInputJson()).path("_director");
        rewrite.setStatus(IpRun.STATUS_DONE); rewrite.setStage("done");
        rewrite.setOutputJson(rewriteOutput(meta).toString());
        runs.save(rewrite);

        readConcurrently(u, id);
        JsonNode c = awaitFollowUpsDone(id);
        verify(imageRuns, times(1)).generateVideoForDirector(eq(u), eq(id), eq("video:cl1"), any());
        JsonNode pending = c.path("clips").get(0).path("video").path("pending");
        assertEquals(1, pending.size(), pending.toString());
        assertEquals("MVJ-chained", pending.get(0).path("jobId").asText());
        assertTrue(c.path("applied").toString().contains(rewrite.getId()));
        assertTrue(taskIds(director.get(u, id)).contains("MVJ-chained"));
    }

    @Test void aRewriteThatFailedValidationIsRetriedOnceUnderConcurrentReads() throws Exception {
        String u = "read-" + UUID.randomUUID().toString().substring(0, 8);
        String id = h3Work(u);
        List<String> requestIds = stubTextSubmissions();
        IpRun rewrite = startVideo(u, id);
        rewrite.setStatus(IpRun.STATUS_FAILED); rewrite.setStage("failed"); rewrite.setErrorCode("AI_BAD_OUTPUT");
        rewrite.setErrorMessage("视频提示词改写不合格，本次未扣积分，请重试");
        runs.save(rewrite);

        readConcurrently(u, id);
        JsonNode c = awaitFollowUpsDone(id);
        assertEquals(1, requestIds.stream().filter("u-r1-p2"::equals).count(), "重试只提交一次：" + requestIds);
        IpRun retry = runs.findByProjectIdAndClientRequestId(id, "u-r1-p2").orElseThrow();
        assertTrue(c.path("taskMeta").has(retry.getId()), "重试任务要记在作品上：" + c.path("taskMeta"));
        assertTrue(taskIds(director.get(u, id)).contains(retry.getId()));
        verify(imageRuns, never()).generateVideoForDirector(anyString(), anyString(), anyString(), any());
    }
}
