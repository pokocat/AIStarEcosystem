package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentSource;
import com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentStatus;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpCreateProjectRequest;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.*;
import com.aistareco.aep.ipstudio.execution.IpPlanExecution;
import com.aistareco.aep.ipstudio.execution.IpPlanExecutionRepository;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 「新对话」/「历史对话」 (docs/ip-studio-new-canvas-and-threads.md §3.2) on real persistence: the list shows threads with
 * messages plus the current one, newest activity first and capped; a new thread becomes current, an idle empty one is
 * reused, a key is idempotent; opening a thread makes it current and reading one does not; foreign threads get requireThread's codes. Nothing here
 * calls a model or touches the ledger. Assertions are on error codes, not wording (AGENTS.md §8.0.1 ⑩).
 */
@SpringBootTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "aep.seed.dev-data.enabled=false", "aep.cdn.driver=local", "aep.dev-auth.enabled=false", "aep.dev-fake-llm.enabled=false",
        "aep.dap.monthly-grant=0"})
@ActiveProfiles("test") @AutoConfigureMockMvc
class StudioDialogueThreadsTest {
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> "jdbc:h2:mem:studio-dialogue-threads;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000");
    }

    @Autowired StudioDialogueService dialogue;
    @Autowired IpProjectService projects;
    @Autowired IpRunRepository runs;
    @Autowired IpDialogueThreadRepository threads;
    @Autowired IpDialogueMessageRepository messages;
    @Autowired IpPlanExecutionRepository executions;
    @Autowired AepUserRepository users;
    @Autowired LedgerEntryRepository ledger;
    @Autowired EnrollmentService enrollment;
    @Autowired ObjectMapper json;
    @Autowired MockMvc mvc;

    private String person() {
        String id = UUID.randomUUID().toString();
        users.save(AepUser.builder().id(id).username(id).displayName("多段对话").status(AepUser.UserStatus.ACTIVE)
                .kind(AepUser.AccountKind.PERSONAL).phoneVerified(true).createdAt(Instant.now()).build());
        enrollment.upsert(id, "aiavatar", EnrollmentStatus.ACTIVE, EnrollmentSource.ADMIN, null);
        return id;
    }

    private String canvas(String user) { return projects.create(user, new IpCreateProjectRequest("多段对话", null)).id(); }

    /** A message written straight to the table (the turn machinery is covered elsewhere). */
    private IpDialogueMessage say(String threadId, String role, String text, Instant at) {
        var thread = threads.findById(threadId).orElseThrow();
        long seq = thread.getMessageSeq() + 1;
        thread.setMessageSeq(seq);
        threads.save(thread);
        return messages.save(IpDialogueMessage.builder().id("IDM-" + StudioDialogueStore.uuid20()).threadId(threadId).seq(seq).role(role)
                .text(text).blocksJson("[]").status(IpDialogueMessage.DONE).createdAt(at).updatedAt(at).build());
    }

    /** Threads are created "now"; tests that order by activity move the creation back before their messages. */
    private void createdAt(String threadId, Instant at) {
        var thread = threads.findById(threadId).orElseThrow();
        thread.setCreatedAt(at);
        threads.save(thread);
    }

    private static String code(Executable call) {
        return assertThrows(BusinessException.class, call).getCode();
    }

    @Test void titleIsTheFirstUserMessageCollapsedAndCutAtTwentyFourCodePoints() {
        assertEquals("新对话", StudioDialogueService.threadTitle(null));
        assertEquals("新对话", StudioDialogueService.threadTitle(" \n\t　"));
        assertEquals("做一条 洗衣液视频", StudioDialogueService.threadTitle("  做一条\n\n　洗衣液视频  "));
        String exactly = "一二三四五六七八九十一二三四五六七八九十一二三四";
        assertEquals(exactly, StudioDialogueService.threadTitle(exactly));
        assertEquals(exactly + "…", StudioDialogueService.threadTitle(exactly + "五"));
        String emoji = "🎬".repeat(30); // surrogate pairs: counted as one character each, never split
        assertEquals("🎬".repeat(24) + "…", StudioDialogueService.threadTitle(emoji));
    }

    @Test void theListShowsThreadsWithMessagesPlusTheCurrentOneLatestActivityFirst() {
        String user = person(), project = canvas(user);
        String main = dialogue.conversation(user, project).thread().id();
        var fresh = dialogue.threads(user, project);
        assertEquals(1, fresh.size(), "an empty canvas lists only its current (main) thread");
        assertEquals(main, fresh.get(0).id());
        assertTrue(fresh.get(0).current());
        assertEquals("新对话", fresh.get(0).title());
        assertEquals(0, fresh.get(0).messageCount());
        assertEquals(fresh.get(0).createdAt(), fresh.get(0).lastActivityAt(), "an empty thread's last activity is its creation");
        assertFalse(fresh.get(0).active());

        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        createdAt(main, now.minus(20, ChronoUnit.MINUTES));
        say(main, "system", "之前的对话「旧」", now.minus(11, ChronoUnit.MINUTES));
        say(main, "user", "", now.minus(10, ChronoUnit.MINUTES)); // attachments only: not a title
        say(main, "user", "  帮我\n\n做一条\t洗衣液的带货视频，要三十秒，突出去渍效果和香味  ", now.minus(10, ChronoUnit.MINUTES));
        say(main, "assistant", "好的", now.minus(9, ChronoUnit.MINUTES));
        String second = dialogue.createThread(user, project, new CreateThreadRequest("new-a")).thread().id();
        assertNotEquals(main, second);
        createdAt(second, now.minus(6, ChronoUnit.MINUTES));
        say(second, "user", "再做一张海报", now.minus(5, ChronoUnit.MINUTES));
        String third = dialogue.createThread(user, project, new CreateThreadRequest("new-b")).thread().id();
        assertNotEquals(second, third);

        var list = dialogue.threads(user, project);
        assertEquals(List.of(third, second, main), list.stream().map(ThreadSummary::id).toList(), "latest activity first; the empty current one is listed");
        assertEquals(List.of(true, false, false), list.stream().map(ThreadSummary::current).toList());
        var old = list.get(2);
        assertEquals("帮我 做一条 洗衣液的带货视频，要三十秒，突出去…", old.title());
        assertEquals(4, old.messageCount(), "every message the timeline shows is counted, system notes included");
        assertEquals(now.minus(9, ChronoUnit.MINUTES).toString(), old.lastActivityAt());
        assertEquals("再做一张海报", list.get(1).title());
        assertEquals("新对话", list.get(0).title());

        dialogue.openThread(user, project, main);
        assertEquals(List.of(second, main), dialogue.threads(user, project).stream().map(ThreadSummary::id).toList(),
                "an empty thread that is no longer current is not listed");

        var branch = dialogue.branch(user, project, main, new BranchRequest("br-1", messages.findByThreadIdAndSeqLessThanEqualOrderBySeqAsc(main, 4).get(3).getId()));
        var withBranch = dialogue.threads(user, project);
        var listedBranch = withBranch.stream().filter(t -> t.id().equals(branch.thread().id())).findFirst().orElseThrow();
        assertEquals(main, listedBranch.parentThreadId());
        assertTrue(listedBranch.current());
        assertNull(withBranch.stream().filter(t -> t.id().equals(main)).findFirst().orElseThrow().parentThreadId());
    }

    // A branch copies its messages with their original times; by the last message alone a branch made just now sorted
    // below the thread it came from (coordinator 2026-10-20: lastActivityAt = later of last message and creation).
    @Test void aBranchJustMadeSortsAboveTheThreadItCameFrom() {
        String user = person(), project = canvas(user);
        String main = dialogue.conversation(user, project).thread().id();
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        createdAt(main, now.minus(30, ChronoUnit.MINUTES));
        var asked = say(main, "user", "做一条洗衣液视频", now.minus(20, ChronoUnit.MINUTES));
        say(main, "assistant", "好的", now.minus(19, ChronoUnit.MINUTES));
        String branch = dialogue.branch(user, project, main, new BranchRequest("br-order", asked.getId())).thread().id();
        dialogue.openThread(user, project, main); // the branch is no longer current: its place comes from activity alone

        var list = dialogue.threads(user, project);
        assertEquals(List.of(branch, main), list.stream().map(ThreadSummary::id).toList(), "the fresh branch is listed above its source");
        var listedBranch = list.get(0);
        assertEquals(main, listedBranch.parentThreadId());
        assertEquals(listedBranch.createdAt(), listedBranch.lastActivityAt(), "its copied messages are older than the branch itself");
        assertEquals(now.minus(19, ChronoUnit.MINUTES).toString(), list.get(1).lastActivityAt(), "the source keeps its last message time");
    }

    @Test void theListIsCappedAndAlwaysKeepsTheCurrentThread() {
        String user = person(), project = canvas(user);
        String main = dialogue.conversation(user, project).thread().id();
        Instant base = Instant.now().minus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MILLIS);
        createdAt(main, base.minus(1, ChronoUnit.MINUTES));
        say(main, "user", "最早的一段", base);
        for (int i = 1; i <= 55; i++) {
            String id = "IPT-cap" + String.format("%02d", i) + StudioDialogueStore.uuid20().substring(0, 8);
            threads.save(IpDialogueThread.builder().id(id).projectId(project).ownerUserId(user).title("全能创作")
                    .lastOpenedAt(base).createdAt(base).updatedAt(base).build());
            say(id, "user", "第" + i + "段", base.plus(i, ChronoUnit.MINUTES));
        }
        dialogue.openThread(user, project, main); // the oldest thread becomes current
        var list = dialogue.threads(user, project);
        assertEquals(StudioDialogueService.THREAD_LIST_MAX, list.size());
        assertEquals("第55段", list.get(0).title());
        assertEquals(main, list.get(list.size() - 1).id(), "the current thread stays listed even past the cap");
        assertTrue(list.get(list.size() - 1).current());
    }

    @Test void aNewThreadBecomesCurrentReusesAnIdleEmptyOneAndIsIdempotentOnItsKey() {
        String user = person(), project = canvas(user);
        String main = dialogue.conversation(user, project).thread().id();
        assertEquals(main, dialogue.createThread(user, project, new CreateThreadRequest("k-0")).thread().id(),
                "the empty main thread is reused instead of creating a second empty one");
        say(main, "user", "第一段", Instant.now());

        State created = dialogue.createThread(user, project, new CreateThreadRequest("k-1"));
        String second = created.thread().id();
        assertNotEquals(main, second);
        assertTrue(created.messages().isEmpty());
        assertNull(created.thread().skillKey(), "a new thread inherits no skill");
        assertNull(created.thread().parentThreadId());
        assertEquals(second, dialogue.conversation(user, project).thread().id(), "GET /conversation returns the new thread");

        assertEquals(second, dialogue.createThread(user, project, new CreateThreadRequest("k-1")).thread().id(), "same key, same thread");
        assertEquals(second, dialogue.createThread(user, project, new CreateThreadRequest("k-2")).thread().id(), "an idle empty thread is reused");
        assertEquals(2, threads.findByProjectIdAndOwnerUserIdOrderByLastOpenedAtDescCreatedAtDesc(project, user).size());

        State opened = dialogue.openThread(user, project, main);
        assertEquals(main, opened.thread().id());
        assertEquals("第一段", opened.messages().get(0).text());
        assertEquals(main, dialogue.conversation(user, project).thread().id(), "opening a thread makes it current");
        assertEquals(second, dialogue.createThread(user, project, new CreateThreadRequest("k-1")).thread().id());
        assertEquals(second, dialogue.conversation(user, project).thread().id(), "a replayed key makes its thread current again");

        var busy = threads.findById(second).orElseThrow();
        busy.setActiveTurnId("TRN-busy");
        threads.save(busy);
        String third = dialogue.createThread(user, project, new CreateThreadRequest("k-3")).thread().id();
        assertNotEquals(second, third, "an empty thread with a reply in progress is not reused");
        assertEquals(3, threads.findByProjectIdAndOwnerUserIdOrderByLastOpenedAtDescCreatedAtDesc(project, user).size());

        assertTrue(runs.findByProjectIdOrderByCreatedAtDesc(project).isEmpty(), "no task is started");
        assertTrue(ledger.findAll().stream().noneMatch(e -> user.equals(e.getUserId())), "nothing is charged");
    }

    @Test void activeMeansAReplyInProgressOrAnExecutionThatHasNotEnded() {
        String user = person(), project = canvas(user);
        String main = dialogue.conversation(user, project).thread().id();
        say(main, "user", "做一条视频", Instant.now());
        assertFalse(dialogue.threads(user, project).get(0).active());

        var execution = executions.save(IpPlanExecution.builder().id("IPE-" + StudioDialogueStore.uuid20()).projectId(project).ownerUserId(user)
                .threadId(main).skillKey("video-generation").stage("production").planRunId("IPR-plan").planFingerprint("f")
                .status(IpPlanExecution.PAUSED).stepsJson("{}").budgetJson("{}").billingJson("{}").clientRequestId("exec-" + main)
                .createdAt(Instant.now()).updatedAt(Instant.now()).build());
        var thread = threads.findById(main).orElseThrow();
        thread.setActiveExecutionId(execution.getId());
        threads.save(thread);
        assertTrue(dialogue.threads(user, project).get(0).active(), "a paused execution keeps the thread in progress");

        execution.setStatus(IpPlanExecution.DONE);
        executions.save(execution);
        assertFalse(dialogue.threads(user, project).get(0).active(), "a pointer to an ended execution is not in progress");

        thread = threads.findById(main).orElseThrow();
        thread.setActiveTurnId("TRN-reply");
        threads.save(thread);
        assertTrue(dialogue.threads(user, project).get(0).active(), "a reply in progress");
    }

    @Test void invalidKeysAndForeignThreadsGetTheSameCodesAsEveryOtherDialogueEndpoint() {
        String user = person(), project = canvas(user), otherCanvas = canvas(user);
        String main = dialogue.conversation(user, project).thread().id();
        String elsewhere = dialogue.conversation(user, otherCanvas).thread().id();
        String stranger = person(), strangerCanvas = canvas(stranger);
        String strangerThread = dialogue.conversation(stranger, strangerCanvas).thread().id();

        for (var bad : Arrays.asList(null, new CreateThreadRequest(null), new CreateThreadRequest(""), new CreateThreadRequest("has space"),
                new CreateThreadRequest("x".repeat(65)))) {
            var e = assertThrows(BusinessException.class, () -> dialogue.createThread(user, project, bad));
            assertEquals("STUDIO_INPUT_INVALID", e.getCode());
            assertEquals(400, e.getStatus().value());
        }

        assertEquals(code(() -> dialogue.requireThread(user, project, elsewhere)), code(() -> dialogue.openThread(user, project, elsewhere)));
        assertEquals("STUDIO_THREAD_NOT_FOUND", code(() -> dialogue.openThread(user, project, elsewhere)), "a thread of my other canvas");
        assertEquals("STUDIO_THREAD_NOT_FOUND", code(() -> dialogue.openThread(user, project, strangerThread)), "someone else's thread");
        assertEquals("STUDIO_THREAD_NOT_FOUND", code(() -> dialogue.openThread(user, project, "IPT-missing")));
        assertEquals(code(() -> dialogue.requireThread(user, strangerCanvas, strangerThread)), code(() -> dialogue.openThread(user, strangerCanvas, strangerThread)));
        assertEquals("IP_PROJECT_NOT_FOUND", code(() -> dialogue.threads(user, strangerCanvas)));
        assertEquals("IP_PROJECT_NOT_FOUND", code(() -> dialogue.createThread(user, strangerCanvas, new CreateThreadRequest("k-x"))));
        assertEquals(main, dialogue.conversation(user, project).thread().id(), "a refused open changes nothing");

        // A key already used for something else is a changed request, not a replay.
        var said = say(main, "user", "第一段", Instant.now());
        dialogue.branch(user, project, main, new BranchRequest("used-for-branch", said.getId()));
        var branchKey = assertThrows(BusinessException.class, () -> dialogue.createThread(user, project, new CreateThreadRequest("used-for-branch")));
        assertEquals("STUDIO_REQUEST_CHANGED", branchKey.getCode());
        assertEquals(409, branchKey.getStatus().value());
        say(elsewhere, "user", "另一张画布", Instant.now());
        dialogue.createThread(user, otherCanvas, new CreateThreadRequest("used-elsewhere"));
        assertEquals("STUDIO_REQUEST_CHANGED", code(() -> dialogue.createThread(user, project, new CreateThreadRequest("used-elsewhere"))));
    }

    @Test void theRoutesCarryTheContractFields() throws Exception {
        String user = person(), project = canvas(user);
        String base = "/api/v1/ip-studio/projects/" + project + "/conversations";
        String main = dialogue.conversation(user, project).thread().id();
        say(main, "user", "第一段", Instant.now());

        JsonNode created = json.readTree(mvc.perform(post(base).with(user(user)).header("X-App-Code", "aiavatar")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"clientRequestId\":\"http-1\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
        String second = created.path("thread").path("id").asText();
        assertNotEquals(main, second);
        assertTrue(created.path("messages").isArray());

        JsonNode list = json.readTree(mvc.perform(get(base).with(user(user)).header("X-App-Code", "aiavatar"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
        assertEquals(2, list.size());
        JsonNode first = list.get(0);
        assertEquals(second, first.path("id").asText());
        for (String field : List.of("id", "title", "messageCount", "lastActivityAt", "createdAt", "current", "active"))
            assertTrue(first.has(field), field);
        assertFalse(first.has("parentThreadId"), "absent, not null, when the thread is not a branch");
        Instant.parse(first.path("lastActivityAt").asText()); // ISO 8601

        JsonNode read = json.readTree(mvc.perform(get(base + "/" + main).with(user(user)).header("X-App-Code", "aiavatar"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
        assertEquals(main, read.path("thread").path("id").asText());
        JsonNode opened = json.readTree(mvc.perform(post(base + "/" + main + "/open").with(user(user)).header("X-App-Code", "aiavatar"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
        assertEquals(main, opened.path("thread").path("id").asText());
        assertTrue(opened.path("messages").isArray());

        String invalid = mvc.perform(post(base).with(user(user)).header("X-App-Code", "aiavatar")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"clientRequestId\":\"bad key\"}"))
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
        assertEquals("STUDIO_INPUT_INVALID", json.readTree(invalid).path("error").path("code").asText());
        String noBody = mvc.perform(post(base).with(user(user)).header("X-App-Code", "aiavatar"))
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
        assertEquals("STUDIO_INPUT_INVALID", json.readTree(noBody).path("error").path("code").asText());
        mvc.perform(get(base + "/IPT-missing").with(user(user)).header("X-App-Code", "aiavatar")).andExpect(status().isNotFound());
        mvc.perform(post(base + "/IPT-missing/open").with(user(user)).header("X-App-Code", "aiavatar")).andExpect(status().isNotFound());
    }

    // A poll or catch-up read still on its way when the user switched conversations used the opening endpoint and took the
    // server's current thread back: the page showed B, a refresh landed in A (Codex review 2026-10-20). Reads are now read
    // only; the user's own choice in 「历史对话」 is the one call that makes a thread current.
    @Test void readingAThreadNeverMakesItCurrentOnlyOpeningDoes() throws Exception {
        String user = person(), project = canvas(user);
        String base = "/api/v1/ip-studio/projects/" + project + "/conversations";
        String main = dialogue.conversation(user, project).thread().id();
        say(main, "user", "第一段", Instant.now());
        String second = dialogue.createThread(user, project, new CreateThreadRequest("read-1")).thread().id();
        assertEquals(second, dialogue.conversation(user, project).thread().id());

        State read = dialogue.readThread(user, project, main);
        assertEquals(main, read.thread().id());
        assertEquals("第一段", read.messages().get(0).text());
        assertEquals(second, dialogue.conversation(user, project).thread().id(), "a read leaves the current thread alone");
        assertEquals(1, dialogue.messages(user, project, main, null, 200).size());
        assertEquals(second, dialogue.conversation(user, project).thread().id(), "reading a thread's messages (a branch's parent preview) does too");

        mvc.perform(get(base + "/" + main).with(user(user)).header("X-App-Code", "aiavatar")).andExpect(status().isOk());
        assertEquals(second, dialogue.conversation(user, project).thread().id(), "GET /conversations/{threadId} is read only");
        assertTrue(dialogue.threads(user, project).stream().filter(ThreadSummary::current).allMatch(t -> t.id().equals(second)));

        mvc.perform(post(base + "/" + main + "/open").with(user(user)).header("X-App-Code", "aiavatar")).andExpect(status().isOk());
        assertEquals(main, dialogue.conversation(user, project).thread().id(), "POST …/open makes it current");

        String stranger = person(), strangerCanvas = canvas(stranger);
        String strangerThread = dialogue.conversation(stranger, strangerCanvas).thread().id();
        assertEquals("STUDIO_THREAD_NOT_FOUND", code(() -> dialogue.readThread(user, project, strangerThread)), "someone else's thread");
        assertEquals(code(() -> dialogue.requireThread(user, strangerCanvas, strangerThread)), code(() -> dialogue.readThread(user, strangerCanvas, strangerThread)));
        assertTrue(runs.findByProjectIdOrderByCreatedAtDesc(project).isEmpty(), "no task is started");
        assertTrue(ledger.findAll().stream().noneMatch(e -> user.equals(e.getUserId())), "nothing is charged");
    }
}
