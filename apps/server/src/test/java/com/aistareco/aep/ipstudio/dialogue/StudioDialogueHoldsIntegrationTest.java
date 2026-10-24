package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentSource;
import com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentStatus;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.enterprise.dto.EnterpriseDtos.*;
import com.aistareco.aep.enterprise.dto.EnterprisePointsDtos.*;
import com.aistareco.aep.enterprise.repository.EnterpriseBillingAuthorizationRepository;
import com.aistareco.aep.enterprise.service.EnterprisePointsService;
import com.aistareco.aep.enterprise.service.EnterpriseService;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpCreateProjectRequest;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpUpdateProjectRequest;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.*;
import com.aistareco.aep.ipstudio.model.IpRun;
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
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * docs/ip-studio-dialogue-no-continue.md §10, booted: real persistence, ledger, enterprise authorizations and a local
 * streaming vendor. One user message whose work costs several hold increments is one run and one reply: the run adds
 * holds while it works, settles real usage across them, and leaves nothing frozen; nothing asks for 「继续」.
 */
@SpringBootTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "aep.seed.dev-data.enabled=false", "aep.cdn.driver=local", "aep.dev-auth.enabled=false", "aep.dev-fake-llm.enabled=false",
        "aep.dap.monthly-grant=0", "aep.enterprise.enabled=true"})
@ActiveProfiles("test")
class StudioDialogueHoldsIntegrationTest {
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> "jdbc:h2:mem:studio-dialogue-holds;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000");
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
    @Autowired CreditHoldRepository holds;
    @Autowired EnrollmentService enrollment;
    @Autowired CreditService credits;
    @Autowired EnterpriseService enterprises;
    @Autowired EnterprisePointsService points;
    @Autowired EnterpriseBillingAuthorizationRepository authorizations;
    @Autowired ObjectMapper json;

    /** Vendor calls of the scripted job: seven reads of different objects, then the final answer. */
    static final int SCRIPTED_CALLS = 8;
    HttpServer http;
    String endpointId;
    final AtomicInteger calls = new AtomicInteger();
    final List<String> bodies = Collections.synchronizedList(new ArrayList<>());

    @BeforeEach void provider() throws Exception {
        calls.set(0); bodies.clear();
        http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        http.createContext("/", this::serve);
        http.start();
        endpointId = "dlg-chain-" + UUID.randomUUID();
        endpoints.save(AiModelEndpoint.builder().id(endpointId).name("本地对话").providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("http://127.0.0.1:" + http.getAddress().getPort()).model("local-dialogue")
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("local-key")).chatSupportsStreaming(true).chatSupportsTools(false).enabled(true).build());
        candidates.save(AiAppEndpointCandidate.builder().id("c-" + UUID.randomUUID()).purpose(AiModelPurpose.DAP_PERSONA).endpointId(endpointId).enabled(true).build());
        bindings.save(AiAppBinding.builder().purpose(AiModelPurpose.DAP_PERSONA).endpointId(endpointId).build());
        var price = json.createObjectNode();
        var rates = price.putObject("endpoints");
        endpoints.findAll().forEach(ep -> rates.putObject(ep.getId()).put("inputCreditsPerK", 1).put("outputCreditsPerK", 2)
                .put("maxInputTokens", 30000).put("maxOutputTokens", 4000));
        configs.upsert(AiChatTokenPricing.KEY, price, "确定性测试价格", "test");
        // The ordinary text ceiling (30 + 8 = 38 credits) is the hold increment, so the scripted job needs several holds.
    }

    @AfterEach void stop() { if (http != null) http.stop(0); }

    /**
     * Each call reports input tokens no larger than the server's estimate (a third of the request's characters) and 2000
     * output tokens, so a task of this ceiling holds two or three calls.
     */
    private void serve(HttpExchange exchange) throws java.io.IOException {
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        bodies.add(body);
        int call = calls.incrementAndGet();
        exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
        exchange.sendResponseHeaders(200, 0);
        try (OutputStream out = exchange.getResponseBody()) {
            String content = call < SCRIPTED_CALLS
                    ? "接着看第 " + call + " 段。\n<<<studio-actions>>>\n[{\"tool\":\"read_canvas\",\"args\":{\"nodeIds\":[\"n" + call + "\"]}}]"
                    : "三集剧本和拆镜都整理好了。";
            chunk(out, json.writeValueAsString(Map.of("choices", List.of(Map.of("delta", Map.of("content", content), "finish_reason", "stop")))));
            chunk(out, json.writeValueAsString(Map.of("choices", List.of(), "usage", Map.of("prompt_tokens", body.length() / 3, "completion_tokens", 2000))));
            out.write("data: [DONE]\n\n".getBytes(StandardCharsets.UTF_8));
        }
    }

    private static void chunk(OutputStream out, String data) throws java.io.IOException {
        out.write(("data: " + data + "\n\n").getBytes(StandardCharsets.UTF_8));
        out.flush();
    }

    private String person() {
        String id = UUID.randomUUID().toString();
        users.save(AepUser.builder().id(id).username(id).displayName("接续验收").status(AepUser.UserStatus.ACTIVE)
                .kind(AepUser.AccountKind.PERSONAL).phoneVerified(true).createdAt(Instant.now()).build());
        enrollment.upsert(id, "aiavatar", EnrollmentStatus.ACTIVE, EnrollmentSource.ADMIN, null);
        return id;
    }

    private String project(String user) throws Exception {
        var project = projects.create(user, new IpCreateProjectRequest("接续验收", null));
        var doc = json.createObjectNode();
        var nodes = doc.putArray("nodes");
        for (int i = 0; i <= SCRIPTED_CALLS; i++) nodes.addObject().put("id", "n" + i).put("type", "text").put("title", "第" + i + "段")
                .putObject("metadata").put("content", "第" + i + "段的已保存内容");
        doc.putArray("connections");
        doc.putObject("viewport").put("x", 0).put("y", 0).put("k", 1);
        projects.update(user, project.id(), new IpUpdateProjectRequest(null, doc));
        return project.id();
    }

    private void awaitIdle(String threadId) throws InterruptedException {
        long until = System.currentTimeMillis() + 60_000;
        while (System.currentTimeMillis() < until) {
            if (threads.findById(threadId).orElseThrow().getActiveTurnId() == null) return;
            Thread.sleep(100);
        }
        fail("the turn did not finish");
    }

    private IpRun onlyRun(String project) {
        var dialogueRuns = runs.findByProjectIdOrderByCreatedAtDesc(project).stream().filter(r -> StudioDialogueTurnWorker.KIND.equals(r.getKind())).toList();
        assertEquals(1, dialogueRuns.size(), "one user message = one run from start to end");
        return dialogueRuns.get(0);
    }

    /** The run: settled, charge = real usage at the snapshot price, within its holds, and none of its holds still frozen. */
    private List<DialogueHolds.Ref> assertSettled(IpRun run) throws Exception {
        assertEquals("done", run.getStatus(), run.getId());
        var billing = json.readTree(run.getOutputJson()).path("billing");
        var input = json.readTree(run.getInputJson());
        var rate = json.treeToValue(input.path("_exec").path("tokenPricing"), AiChatTokenPricing.Rate.class);
        assertEquals(rate.cost(billing.path("inputTokens").asLong(), billing.path("outputTokens").asLong()), run.getCost(), "charged = real usage");
        var refs = DialogueHolds.of(input, run.getId(), 0);
        assertTrue(run.getCost() <= DialogueHolds.total(refs), "never above what was held");
        for (var ref : refs) {
            var hold = holds.findByReferenceTypeAndReferenceId("ip-run", ref.ref()).orElseThrow();
            assertNotEquals(CreditHold.Status.ACTIVE, hold.getStatus(), "no hold stays frozen: " + ref.ref());
            assertEquals(ref.amount(), hold.getAmount());
        }
        return refs;
    }

    private void assertOneReply(String threadId, IpRun run) {
        var all = messages.findByThreadIdOrderBySeqDesc(threadId, PageRequest.of(0, 200));
        assertEquals(1, all.stream().filter(m -> "assistant".equals(m.getRole())).count(), "one assistant reply");
        assertTrue(all.stream().filter(m -> "assistant".equals(m.getRole())).allMatch(m -> run.getId().equals(m.getRunId())));
        var done = events.findByThreadIdAndSeqGreaterThanOrderBySeqAsc(threadId, 0, PageRequest.of(0, 1000)).stream()
                .filter(e -> "turn.done".equals(e.getType())).toList();
        assertEquals(1, done.size(), "one turn.done");
        assertTrue(all.stream().noneMatch(m -> m.getText() != null && m.getText().contains("继续") && !"user".equals(m.getRole())), "nothing says 「继续」");
        assertTrue(all.stream().noneMatch(m -> m.getRequestJson() != null && m.getRequestJson().contains("继续") && !"user".equals(m.getRole())), "no 「继续」 reply");
    }

    /** §10: one message, a job costing several increments: one run and one reply, holds added on the way, charge = usage. */
    @Test void aLongJobIsOneRunThatAddsHoldsAndChargesTheRealUsage() throws Exception {
        String user = person(), project = project(user);
        credits.creditAccount(user, 400, LedgerEntry.LedgerEntryType.GIFT, "test", UUID.randomUUID().toString(), "测试积分");
        long before = wallets.findByUserId(user).orElseThrow().getTotalBalance();
        String threadId = dialogue.conversation(user, project).thread().id();
        var posted = dialogue.post(user, project, threadId, new PostMessageRequest("long-1", "接续验收：写三集剧本并拆镜", null, null, null, null, null, null, null));
        assertEquals("accepted", posted.queueState());
        assertEquals(38, runs.findById(posted.runId()).orElseThrow().getCost(), "the first hold is one ordinary text increment");
        awaitIdle(threadId);
        assertEquals(SCRIPTED_CALLS, calls.get(), "the whole job ran from one message");
        var run = onlyRun(project);
        assertEquals(posted.runId(), run.getId());
        assertEquals("completed", json.readTree(run.getOutputJson()).path("reason").asText());
        var refs = assertSettled(run);
        assertTrue(refs.size() >= 2, "holds were added on the way: " + refs.size());
        assertEquals(run.getId() + "#1", refs.get(1).ref());
        var wallet = wallets.findByUserId(user).orElseThrow();
        assertEquals(before - run.getCost(), wallet.getTotalBalance(), "the ledger moved exactly the settled charge");
        assertEquals(0, wallet.getPendingBalance());
        assertOneReply(threadId, run);
        assertTrue(messages.findByThreadIdOrderBySeqDesc(threadId, PageRequest.of(0, 200)).stream().noneMatch(m -> "system".equals(m.getRole())));
        assertEquals(posted.runId(), dialogue.post(user, project, threadId, new PostMessageRequest("long-1", "接续验收：写三集剧本并拆镜", null, null, null, null, null, null, null)).runId());
        assertEquals(SCRIPTED_CALLS, calls.get(), "a resend starts nothing");
    }

    /** §10: the wallet runs out on the way: the turn stops with the recharge note, work stays, every hold settles. */
    @Test void aWalletThatRunsOutStopsTheTurnWithARechargeNoteAndSettlesEverything() throws Exception {
        String user = person(), project = project(user);
        credits.creditAccount(user, 30, LedgerEntry.LedgerEntryType.GIFT, "test", UUID.randomUUID().toString(), "测试积分");
        String threadId = dialogue.conversation(user, project).thread().id();
        dialogue.post(user, project, threadId, new PostMessageRequest("long-2", "接续验收：写三集剧本并拆镜", null, null, null, null, null, 38L, null));
        awaitIdle(threadId);
        assertTrue(calls.get() < SCRIPTED_CALLS, "the job stopped before its end");
        var run = onlyRun(project);
        assertSettled(run);
        var wallet = wallets.findByUserId(user).orElseThrow();
        assertEquals(30 - run.getCost(), wallet.getTotalBalance());
        assertEquals(0, wallet.getPendingBalance(), "nothing stays frozen");
        var output = json.readTree(run.getOutputJson());
        assertEquals("budget", output.path("limit").asText());
        assertEquals("balance", output.path("holdRefused").asText());
        var notes = messages.findByThreadIdOrderBySeqDesc(threadId, PageRequest.of(0, 200)).stream().filter(m -> "system".equals(m.getRole())).toList();
        assertEquals(1, notes.size());
        assertEquals(StudioDialogueTurnWorker.OUT_OF_CREDITS, notes.get(0).getText());
        assertEquals("recharge", dialogue.conversation(user, project).messages().stream().filter(m -> "system".equals(m.role())).findFirst().orElseThrow().notice());
        assertOneReply(threadId, run);
    }

    /**
     * §10: the same for an enterprise member's wallet: every added hold has its own authorization on the same member wallet,
     * all completed; the personal wallet is never touched; the added holds do not count against the active-job limit (2).
     */
    @Test void anEnterpriseMembersTurnAddsHoldsOnTheSameMemberWallet() throws Exception {
        var company = enterprises.create(person(), new CreateRequest("接续验收企业", UUID.randomUUID().toString()));
        var invite = enterprises.invite(company.member().userId(), company.enterprise().id(), new InvitationRequest(UUID.randomUUID().toString()));
        var member = enterprises.accept(person(), new AcceptRequest(invite.token()));
        String enterprise = company.enterprise().id(), actor = member.member().userId();
        var policy = enterprises.policy(company.member().userId(), enterprise);
        enterprises.updatePolicy(company.member().userId(), enterprise, new PolicyUpdate(List.of(endpointId), 2, policy.version()));
        var root = wallets.findByAccountKey("enterprise:" + enterprise).orElseThrow();
        credits.creditWallet(root.getId(), 400, LedgerEntry.LedgerEntryType.GIFT, "test", UUID.randomUUID().toString(), "测试企业资金");
        var items = List.of(new Item(member.member().id(), 400L));
        var preview = points.preview(company.member().userId(), enterprise, "allocate", new PreviewRequest(items));
        points.submit(company.member().userId(), enterprise, "allocate", new SubmitRequest(UUID.randomUUID().toString(), preview.confirmationFingerprint(), items));
        credits.creditAccount(actor, 999, LedgerEntry.LedgerEntryType.GIFT, "test", UUID.randomUUID().toString(), "个人积分");
        String project = project(actor);
        String threadId = dialogue.conversation(actor, project).thread().id();
        dialogue.post(actor, project, threadId, new PostMessageRequest("long-3", "接续验收：写三集剧本并拆镜", null, null, null, null,
                new BillingSelection("enterprise", enterprise), null, null));
        awaitIdle(threadId);
        assertEquals(SCRIPTED_CALLS, calls.get());
        var run = onlyRun(project);
        var refs = assertSettled(run);
        assertTrue(refs.size() > 2, "more holds than the active-job limit: " + refs.size());
        var memberWallet = wallets.findByAccountKey("enterprise_member:" + enterprise + ":" + actor).orElseThrow();
        assertEquals(400 - run.getCost(), memberWallet.getTotalBalance());
        assertEquals(0, memberWallet.getPendingBalance());
        assertEquals(999, wallets.findByUserId(actor).orElseThrow().getTotalBalance(), "never falls back to the personal wallet");
        Set<String> authorizationIds = new HashSet<>();
        for (var ref : refs) {
            var authorization = authorizations.findByReferenceTypeAndReferenceId("ip-run", ref.ref()).orElseThrow();
            assertNotNull(authorization.getTerminalAt(), "authorization completed: " + ref.ref());
            assertEquals(memberWallet.getId(), authorization.getWalletId());
            assertEquals(holds.findByReferenceTypeAndReferenceId("ip-run", ref.ref()).orElseThrow().getWalletId(), memberWallet.getId());
            authorizationIds.add(authorization.getId());
        }
        assertEquals(refs.size(), authorizationIds.size(), "one authorization per hold");
        assertOneReply(threadId, run);
    }
}
