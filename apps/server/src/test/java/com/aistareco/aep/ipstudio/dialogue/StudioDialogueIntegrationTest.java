package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentSource;
import com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentStatus;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpCreateProjectRequest;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpUpdateProjectRequest;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.*;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.AiChatTokenPricing;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Booted context, real persistence and ledger, and a local OpenAI-compatible server that streams. Covers the whole S1
 * chain: legacy import, post → hold → async loop → streamed prose → JSON action → tool card → second call → settlement →
 * turn.done; idempotent resend; branch; a priority stop that closes a live stream; and the SSE cursor 410.
 */
@SpringBootTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "aep.seed.dev-data.enabled=false", "aep.cdn.driver=local", "aep.dev-auth.enabled=false", "aep.dev-fake-llm.enabled=false",
        "aep.dap.monthly-grant=0"})
@ActiveProfiles("test") @AutoConfigureMockMvc
class StudioDialogueIntegrationTest {
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> "jdbc:h2:mem:studio-dialogue-it;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000");
    }

    @Autowired StudioDialogueService dialogue;
    @Autowired IpProjectService projects;
    @Autowired IpRunRepository runs;
    @Autowired IpDialogueThreadRepository threads;
    @Autowired IpDialogueMessageRepository messages;
    @Autowired IpDialogueEventRepository events;
    @Autowired AiModelEndpointRepository endpoints;
    @Autowired AiAppBindingRepository bindings;
    @Autowired AiAppEndpointCandidateRepository candidates;
    @Autowired PlatformConfigService configs;
    @Autowired AepUserRepository users;
    @Autowired WalletRepository wallets;
    @Autowired EnrollmentService enrollment;
    @Autowired CreditService credits;
    @Autowired ObjectMapper json;
    @Autowired MockMvc mvc;
    @Autowired AiModelUsageRecordRepository modelUsage;

    HttpServer http;
    final AtomicInteger calls = new AtomicInteger();
    final List<String> bodies = Collections.synchronizedList(new ArrayList<>());
    final CountDownLatch slowStarted = new CountDownLatch(1);
    final CountDownLatch steeringWindow = new CountDownLatch(1), steeringPosted = new CountDownLatch(1);

    @BeforeEach void provider() throws Exception {
        http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        http.createContext("/", this::serve);
        http.start();
        String id = "dlg-text-" + UUID.randomUUID();
        endpoints.save(AiModelEndpoint.builder().id(id).name("本地对话").providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("http://127.0.0.1:" + http.getAddress().getPort()).model("local-dialogue")
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("local-key")).chatSupportsStreaming(true).chatSupportsTools(false).enabled(true).build());
        candidates.save(AiAppEndpointCandidate.builder().id("c-" + UUID.randomUUID()).purpose(AiModelPurpose.DAP_PERSONA).endpointId(id).enabled(true).build());
        bindings.save(AiAppBinding.builder().purpose(AiModelPurpose.DAP_PERSONA).endpointId(id).build());
        var price = json.createObjectNode();
        price.putObject("endpoints").putObject(id).put("inputCreditsPerK", 1).put("outputCreditsPerK", 2).put("maxInputTokens", 20000).put("maxOutputTokens", 4000);
        configs.upsert(AiChatTokenPricing.KEY, price, "确定性测试价格", "test"); // maxCost = 20 + 8 = 28
    }

    @AfterEach void stop() { if (http != null) http.stop(0); }

    /** Streams like a real vendor: separate chunks, the action block split across chunks, usage in the last chunk. */
    private void serve(HttpExchange exchange) throws java.io.IOException {
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        bodies.add(body);
        calls.incrementAndGet();
        exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
        exchange.sendResponseHeaders(200, 0);
        try (OutputStream out = exchange.getResponseBody()) {
            if (body.contains("用户在你工作时发来新消息")) {
                chunk(out, "{\"choices\":[{\"delta\":{\"content\":\"收到，改成三个女工。\"},\"finish_reason\":\"stop\"}]}");
                chunk(out, "{\"choices\":[],\"usage\":{\"prompt_tokens\":50,\"completion_tokens\":10}}");
            } else if (body.contains("稍等")) {
                chunk(out, "{\"choices\":[{\"delta\":{\"content\":\"我想一下\"}}]}");
                steeringWindow.countDown();
                try { steeringPosted.await(10, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                chunk(out, "{\"choices\":[{\"delta\":{\"content\":\"。\"},\"finish_reason\":\"stop\"}]}");
                chunk(out, "{\"choices\":[],\"usage\":{\"prompt_tokens\":50,\"completion_tokens\":10}}");
            } else if (body.contains("慢慢来")) {
                chunk(out, "{\"choices\":[{\"delta\":{\"content\":\"好的，我慢慢想\"}}]}");
                slowStarted.countDown();
                try { Thread.sleep(8000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                chunk(out, "{\"choices\":[{\"delta\":{\"content\":\"（不该出现）\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":10}}");
            } else if (body.contains("工具结果")) {
                chunk(out, "{\"choices\":[{\"delta\":{\"content\":\"画布上有 1 个\"}}]}");
                chunk(out, "{\"choices\":[{\"delta\":{\"content\":\"对象。\"},\"finish_reason\":\"stop\"}]}");
                chunk(out, "{\"choices\":[],\"usage\":{\"prompt_tokens\":200,\"completion_tokens\":50}}");
            } else {
                chunk(out, "{\"choices\":[{\"delta\":{\"content\":\"我先看一下画布。\\n<<<studio\"}}]}");
                chunk(out, "{\"choices\":[{\"delta\":{\"content\":\"-actions>>>\\n[{\\\"tool\\\":\\\"read_canvas\\\",\\\"args\\\":{}}]\"},\"finish_reason\":\"stop\"}]}");
                chunk(out, "{\"choices\":[],\"usage\":{\"prompt_tokens\":100,\"completion_tokens\":50}}");
            }
            out.write("data: [DONE]\n\n".getBytes(StandardCharsets.UTF_8));
        } catch (java.io.IOException closedByClient) { /* the stop test closes the stream */ }
    }

    private static void chunk(OutputStream out, String data) throws java.io.IOException {
        out.write(("data: " + data + "\n\n").getBytes(StandardCharsets.UTF_8));
        out.flush();
    }

    private String person() {
        String id = UUID.randomUUID().toString();
        users.save(AepUser.builder().id(id).username(id).displayName("对话验收").status(AepUser.UserStatus.ACTIVE)
                .kind(AepUser.AccountKind.PERSONAL).phoneVerified(true).createdAt(Instant.now()).build());
        enrollment.upsert(id, "aiavatar", EnrollmentStatus.ACTIVE, EnrollmentSource.ADMIN, null);
        credits.creditAccount(id, 100, LedgerEntry.LedgerEntryType.GIFT, "test", UUID.randomUUID().toString(), "测试积分");
        return id;
    }

    private String project(String user) throws Exception {
        var project = projects.create(user, new IpCreateProjectRequest("对话验收", null));
        var doc = json.readTree("{\"nodes\":[{\"id\":\"text-1\",\"type\":\"text\",\"title\":\"商品文案\",\"metadata\":{\"content\":\"一瓶洗衣液\"}}],"
                + "\"connections\":[],\"viewport\":{\"x\":0,\"y\":0,\"k\":1},\"assistantConversations\":[{\"id\":\"old-chat\",\"type\":\"text\",\"title\":\"旧对话\","
                + "\"metadata\":{\"studio\":{\"kind\":\"assistant\",\"runId\":\"IPR-old\",\"conversation\":{\"mode\":\"general\",\"turns\":[{\"role\":\"user\",\"content\":\"旧问题\"},"
                + "{\"role\":\"assistant\",\"content\":\"旧回答\"}],\"plan\":{\"summary\":\"旧方案\",\"steps\":[],\"questions\":[]}}}}}]}");
        projects.update(user, project.id(), new IpUpdateProjectRequest(null, doc));
        return project.id();
    }

    private void awaitTurnEnd(String threadId) throws InterruptedException {
        long until = System.currentTimeMillis() + 20_000;
        while (System.currentTimeMillis() < until) {
            if (threads.findById(threadId).orElseThrow().getActiveTurnId() == null) return;
            Thread.sleep(100);
        }
        fail("turn did not finish");
    }

    @Test void fullTurnStreamsRunsAToolSettlesRealUsageAndReplaysConsistently() throws Exception {
        String user = person(), project = project(user);
        State state = dialogue.conversation(user, project);
        String threadId = state.thread().id();
        assertEquals("IPT-" + project, threadId);
        assertEquals(List.of("system", "user", "assistant"), state.messages().stream().map(Message::role).toList(), "legacy history imported once");
        assertEquals("old-chat", state.messages().get(1).legacyNodeId());
        assertEquals("plan", state.messages().get(2).blocks().get(0).path("type").asText());
        assertTrue(runs.findByProjectIdOrderByCreatedAtDesc(project).isEmpty(), "import never runs or bills");
        assertEquals(3, dialogue.conversation(user, project).messages().size(), "import is idempotent");

        var posted = dialogue.post(user, project, threadId, new PostMessageRequest("c-1", "帮我看看画布", List.of("text-1"), null, null, null, null, 28L, null));
        assertEquals("accepted", posted.queueState());
        awaitTurnEnd(threadId);

        var run = runs.findById(posted.runId()).orElseThrow();
        assertEquals("done", run.getStatus());
        assertEquals("studio-dialogue", run.getKind());
        // (100+200)×1/1000 + (50+50)×2/1000 = 0.5 → 1 credit; the remaining 27 of the 28 hold are released.
        assertEquals(1L, run.getCost());
        var wallet = wallets.findByUserId(user).orElseThrow();
        assertEquals(99L, wallet.getTotalBalance());
        assertEquals(0L, wallet.getPendingBalance());
        assertEquals(2, calls.get());
        var observed = modelUsage.findAll().stream().filter(row -> user.equals(row.getUserId())).toList();
        assertEquals(2, observed.size(), "both async model calls retain the task owner, including the post-tool call");
        assertTrue(observed.stream().allMatch(row -> "aiavatar".equals(row.getAppCode())));
        assertEquals(400L, observed.stream().mapToLong(AiModelUsageRecord::getTotalTokens).sum());
        assertTrue(bodies.get(0).contains("\"stream\":true") && bodies.get(0).contains("include_usage"));
        assertTrue(bodies.get(0).contains("一瓶洗衣液"), "pinned node content reaches the model");
        assertTrue(bodies.get(1).contains("工具结果"), "tool result is fed back before the second call");

        var assistant = messages.findByThreadIdOrderBySeqDesc(threadId, PageRequest.of(0, 1)).get(0);
        assertEquals("assistant", assistant.getRole());
        assertEquals("done", assistant.getStatus());
        assertEquals("我先看一下画布。\n\n画布上有 1 个对象。", assistant.getText(), "the action block never reaches the user");
        JsonNode blocks = json.readTree(assistant.getBlocksJson());
        assertEquals("tool_call", blocks.get(0).path("type").asText());
        assertEquals("read_canvas", blocks.get(0).path("toolName").asText());
        assertEquals("done", blocks.get(0).path("status").asText());
        assertEquals(1L, json.readTree(assistant.getBillingJson()).path("credits").asLong());

        var rows = events.findByThreadIdAndSeqGreaterThanOrderBySeqAsc(threadId, 0, PageRequest.of(0, 500));
        for (int i = 0; i < rows.size(); i++) assertEquals(i + 1, rows.get(i).getSeq(), "seq is contiguous per thread");
        StringBuilder replay = new StringBuilder();
        List<String> types = new ArrayList<>();
        for (var row : rows) {
            types.add(row.getType());
            if ("message.delta".equals(row.getType())) replay.append(json.readTree(row.getDataJson()).path("delta").asText());
        }
        assertEquals(assistant.getText(), replay.toString(), "replayed deltas equal the saved text, no duplicates");
        assertTrue(types.indexOf("tool.started") < types.indexOf("tool.finished"));
        assertTrue(types.indexOf("message.delta") < types.indexOf("tool.started"), "prose streams before the tool runs");
        assertEquals("turn.done", types.get(types.size() - 1));
        JsonNode done = json.readTree(rows.get(rows.size() - 1).getDataJson());
        assertEquals("completed", done.path("reason").asText());
        assertEquals(1L, done.path("billing").path("credits").asLong());
        assertEquals(dialogue.conversation(user, project).latestSeq(), rows.get(rows.size() - 1).getSeq());

        var again = dialogue.post(user, project, threadId, new PostMessageRequest("c-1", "帮我看看画布", List.of("text-1"), null, null, null, null, 28L, null));
        assertEquals(posted.messageId(), again.messageId());
        assertEquals(1, runs.findByProjectIdOrderByCreatedAtDesc(project).size(), "a resend never starts a second paid turn");

        var branch = dialogue.branch(user, project, threadId, new BranchRequest("br-1", posted.messageId()));
        assertNotEquals(threadId, branch.thread().id());
        assertEquals(threadId, branch.thread().parentThreadId());
        assertEquals("帮我看看画布", branch.messages().get(branch.messages().size() - 1).text());
        assertEquals(branch.thread().id(), dialogue.conversation(user, project).thread().id(), "reopens the branch the user is in");
        assertEquals(branch.thread().id(), dialogue.branch(user, project, threadId, new BranchRequest("br-1", posted.messageId())).thread().id());

        String error = mvc.perform(get("/api/v1/ip-studio/projects/" + project + "/conversations/" + threadId + "/events").param("afterSeq", "99999")
                .with(user(user)).header("X-App-Code", "aiavatar")).andExpect(status().isGone()).andReturn().getResponse().getContentAsString();
        assertEquals("STUDIO_EVENT_CURSOR_EXPIRED", json.readTree(error).path("error").path("code").asText());
        String other = person();
        mvc.perform(get("/api/v1/ip-studio/projects/" + project + "/conversation").with(user(other)).header("X-App-Code", "aiavatar"))
                .andExpect(status().isNotFound());
    }

    @Test void aMessageSentWhileTheTurnRunsIsQueuedThenAppliedAtTheNextBoundary() throws Exception {
        String user = person(), project = project(user);
        String threadId = dialogue.conversation(user, project).thread().id();
        var first = dialogue.post(user, project, threadId, new PostMessageRequest("c-a", "稍等，帮我想想", null, null, null, null, null, 28L, null));
        assertTrue(steeringWindow.await(10, TimeUnit.SECONDS));
        var second = dialogue.post(user, project, threadId, new PostMessageRequest("c-b", "改成三个女工", null, null, null, null, null, 28L, null));
        assertEquals("queued", second.queueState(), "input is never refused because the assistant is busy");
        assertEquals(first.turnId(), second.turnId());
        steeringPosted.countDown();
        awaitTurnEnd(threadId);
        assertEquals("applied", messages.findById(second.messageId()).orElseThrow().getStatus());
        assertEquals(1, runs.findByProjectIdOrderByCreatedAtDesc(project).size(), "steering joins the running turn instead of starting a second paid one");
        assertTrue(bodies.stream().anyMatch(b -> b.contains("改成三个女工") && b.contains("用户在你工作时发来新消息")));
        var assistant = messages.findByThreadIdOrderBySeqDesc(threadId, PageRequest.of(0, 5)).stream().filter(m -> "assistant".equals(m.getRole())).findFirst().orElseThrow();
        assertEquals("我想一下。\n\n收到，改成三个女工。", assistant.getText());
    }

    @Test void priorityStopClosesALiveStreamAndChargesNothingUnknown() throws Exception {
        String user = person(), project = project(user);
        String threadId = dialogue.conversation(user, project).thread().id();
        var posted = dialogue.post(user, project, threadId, new PostMessageRequest("c-slow", "慢慢来，想清楚再说", null, null, null, null, null, 28L, null));
        assertTrue(slowStarted.await(10, TimeUnit.SECONDS));
        long stoppedAt = System.nanoTime();
        dialogue.control(user, project, threadId, new ControlRequest("ctl-1", "stop", null));
        awaitTurnEnd(threadId);
        assertTrue(System.nanoTime() - stoppedAt < TimeUnit.SECONDS.toNanos(6), "the stop does not wait for the vendor to finish");
        var run = runs.findById(posted.runId()).orElseThrow();
        assertEquals("interrupted", run.getStage());
        assertEquals(0L, run.getCost(), "usage of an interrupted stream is unknown and never estimated");
        assertEquals(100L, wallets.findByUserId(user).orElseThrow().getTotalBalance());
        var assistant = messages.findByThreadIdOrderBySeqDesc(threadId, PageRequest.of(0, 1)).get(0);
        assertEquals("interrupted", assistant.getStatus());
        assertEquals("好的，我慢慢想", assistant.getText());
        var last = events.findByThreadIdAndSeqGreaterThanOrderBySeqAsc(threadId, 0, PageRequest.of(0, 500));
        assertEquals("interrupted", json.readTree(last.get(last.size() - 1).getDataJson()).path("reason").asText());
        // A stop control is idempotent on controlId.
        dialogue.control(user, project, threadId, new ControlRequest("ctl-1", "stop", null));
    }
}
