package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.PostMessageRequest;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.aistareco.aep.ipstudio.skill.StudioSkill;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * S3 intent routing at turn start: single active, explicit choice, words scored with attachments as weight, attachments
 * alone never pick a method, a tie unbinds the thread for the model (2026-10-21; it used to be a 400, then kept the current
 * method when that was among the tied).
 */
class StudioDialogueRoutingTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final IpProjectService projects = mock(IpProjectService.class);
    private final IpRunRepository runs = mock(IpRunRepository.class);
    private final IpDialogueThreadRepository threads = mock(IpDialogueThreadRepository.class);
    private final IpDialogueMessageRepository messages = mock(IpDialogueMessageRepository.class);
    private final StudioFixtureProvider fixtures = mock(StudioFixtureProvider.class);
    private final CreditService credits = mock(CreditService.class);
    private final StudioSkillCatalog catalog = mock(StudioSkillCatalog.class);
    private final PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
    private final IpDialogueThread thread = IpDialogueThread.builder().id("IPT-P1").projectId("P1").ownerUserId("u1")
            .createdAt(Instant.now()).updatedAt(Instant.now()).lastOpenedAt(Instant.now()).build();
    private final Map<String, IpDialogueMessage> stored = new LinkedHashMap<>();
    private StudioDialogueService service;
    private StudioSkill video, script;

    static StudioSkill skill(String key, String triggers) throws Exception {
        String text = Files.readString(Path.of("src/main/resources/studio/skills/reference-video-recreation.md")).replace("key: reference-video-recreation", "key: " + key);
        int start = text.indexOf("triggers:"), end = text.indexOf("\n---", start);
        return StudioSkillCatalog.parse(text.substring(0, start) + triggers + text.substring(end));
    }

    @BeforeEach void setUp() throws Exception {
        video = skill("video-recreation", "triggers:\n  media: [video]\n  keywords: [复刻, 做一条]");
        script = skill("script-rewrite", "triggers:\n  media: [text]\n  keywords: [改脚本, 做一条]");
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(fixtures.enabled()).thenReturn(true); // free turns: routing is the only thing under test
        var project = IpProject.builder().id("P1").ownerUserId("u1").docJson(
                "{\"nodes\":[{\"id\":\"n1\",\"type\":\"text\",\"title\":\"文案\"},{\"id\":\"v1\",\"type\":\"video\",\"title\":\"原片\"}],\"connections\":[]}").build();
        when(projects.required("u1", "P1")).thenReturn(project);
        when(projects.requiredForUpdate("u1", "P1")).thenReturn(project);
        when(projects.readDoc(project)).thenAnswer(i -> mapper.readTree(project.getDocJson()));
        when(threads.findById("IPT-P1")).thenReturn(Optional.of(thread));
        when(threads.lockById("IPT-P1")).thenReturn(Optional.of(thread));
        when(messages.findByThreadIdAndClientMessageId(anyString(), anyString())).thenReturn(Optional.empty());
        when(messages.save(any())).thenAnswer(i -> { IpDialogueMessage m = i.getArgument(0); stored.put(m.getId(), m); return m; });
        var store = new StudioDialogueStore(threads, messages, mock(IpDialogueEventRepository.class), new StudioDialogueEventHub(), mapper, manager);
        service = new StudioDialogueService(projects, runs, mock(IpRunService.class), threads, messages, mock(IpDialogueSteeringRepository.class), store,
                mock(StudioDialogueTurnWorker.class), new StudioDialogueSignals(), catalog, fixtures, mock(AiModelInvocationService.class), mock(PromptService.class),
                mock(DapPricingService.class), credits, mapper, manager);
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach void clear() { if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization(); }

    private PostMessageRequest message(String id, String text, List<String> attachments, String skillKey) {
        return new PostMessageRequest(id, text, null, attachments, null, skillKey, null, null, null);
    }

    private String routedSkill() throws Exception {
        var run = ArgumentCaptor.forClass(IpRun.class);
        verify(runs).save(run.capture());
        return mapper.readTree(run.getValue().getInputJson()).path("_exec").path("skill").path("key").asText(null);
    }

    @Test void theOnlyActiveSkillIsNotBoundToAMessageThatDoesNotAskForIt() throws Exception {
        // Local e2e 2026-10-19: with only 参考视频复刻 on the shelf, 「生成商品宣传图」 was bound to it and kept it.
        when(catalog.available()).thenReturn(List.of(video));
        service.post("u1", "P1", "IPT-P1", message("c-1", "生成一张商品宣传图，9:16", null, null));
        assertNull(thread.getSkillKey(), "a message that matches no skill stays in 全能创作");
        assertNull(routedSkill());
        assertNull(service.toDto(thread).skillKey());
    }

    @Test void theOnlyActiveSkillIsBoundWhenTheFirstMessageAsksForIt() throws Exception {
        when(catalog.available()).thenReturn(List.of(video));
        service.post("u1", "P1", "IPT-P1", message("c-1b", "复刻这条视频", List.of("v1"), null));
        assertEquals("video-recreation", thread.getSkillKey());
        assertEquals("analysis", thread.getStage());
        assertEquals("video-recreation", routedSkill());
        assertEquals("video-recreation", service.toDto(thread).skillKey(), "the routing result is on the thread state");
    }

    @Test void anAttachedVideoWeighsInBetweenSkillsTheWordsNamed() throws Exception {
        when(catalog.available()).thenReturn(List.of(script, video));
        service.post("u1", "P1", "IPT-P1", message("c-2", "照这个做一条", List.of("v1"), null));
        assertEquals("video-recreation", thread.getSkillKey());
        assertEquals("video-recreation", routedSkill());
    }

    /** 2026-10-21: a pinned video is material; it does not make 「看看这条」 a recreation (nor switch a bound thread). */
    @Test void anAttachmentAloneNamesNoJob() throws Exception {
        when(catalog.available()).thenReturn(List.of(script, video));
        service.post("u1", "P1", "IPT-P1", message("c-2b", "看看这条", List.of("v1"), null));
        assertNull(thread.getSkillKey());
        assertNull(routedSkill());
    }

    /**
     * 2026-10-21 (production: 「用这几张图做一段视频」 right after the pictures stayed 出图): a tie no longer keeps the
     * current method even when it is one of the tied. The thread is unbound, the turn carries no skill, and the model binds
     * one with read_skill (which binds an unbound thread).
     */
    @Test void aTieUnbindsABoundThreadEvenWhenItsMethodIsAmongTheTied() throws Exception {
        thread.setSkillKey("script-rewrite"); thread.setSkillVersion(1); thread.setStage("production");
        when(catalog.find("script-rewrite")).thenReturn(Optional.of(script));
        when(catalog.available()).thenReturn(List.of(video, script));
        var result = service.post("u1", "P1", "IPT-P1", message("c-tie", "再做一条", null, null));
        assertNotNull(result.turnId(), "the turn is accepted, no 400");
        assertNull(thread.getSkillKey(), "the old method does not carry over");
        assertNull(thread.getSkillVersion());
        assertNull(thread.getStage());
        assertNull(routedSkill(), "the model picks inside the turn");
        var run = ArgumentCaptor.forClass(IpRun.class);
        verify(runs).save(run.capture());
        var input = mapper.readTree(run.getValue().getInputJson());
        assertFalse(input.has("skillKey"));
        assertFalse(input.path("_exec").has("stage"));
        assertNull(service.toDto(thread).skillKey());
    }

    @Test void keywordsRouteWhenNothingIsAttached() throws Exception {
        when(catalog.available()).thenReturn(List.of(video, script));
        service.post("u1", "P1", "IPT-P1", message("c-3", "帮我改脚本", null, null));
        assertEquals("script-rewrite", thread.getSkillKey());
    }

    @Test void aGreetingMatchesNoSkillAndIsAnsweredWithoutOne() throws Exception {
        when(catalog.available()).thenReturn(List.of(video, script));
        service.post("u1", "P1", "IPT-P1", message("c-4", "你好", null, null));
        assertNull(thread.getSkillKey());
        assertNull(routedSkill());
    }

    /** 意图直达 2026-10-20: a tie is the model's call inside the turn (read_skill), not a 400 that makes the UI ask the user. */
    @Test void aTieStartsTheTurnWithoutASkillSoTheModelPicksOne() throws Exception {
        var cut = skill("clip-cut", "triggers:\n  media: [video]\n  keywords: [剪辑]");
        when(catalog.available()).thenReturn(List.of(cut, video));
        var result = service.post("u1", "P1", "IPT-P1", message("c-4b", "剪辑一下再复刻这条", List.of("v1"), null));
        assertNotNull(result.turnId(), "the turn is accepted");
        assertNull(thread.getSkillKey());
        assertNull(routedSkill());
    }

    @Test void aDirectSkillBindsInProductionAndARecreationSkillInAnalysis() throws Exception {
        String file = Files.readString(Path.of("src/main/resources/studio/skills/image-generation.md"));
        var image = StudioSkillCatalog.parse(file);
        assertTrue(image.direct());
        when(catalog.available()).thenReturn(List.of(video, image));
        service.post("u1", "P1", "IPT-P1", message("c-img", "画一张国风少女海报", null, null));
        assertEquals("image-generation", thread.getSkillKey());
        assertEquals("production", thread.getStage(), "no analysis stage: the first plan is the production plan");
        var run = ArgumentCaptor.forClass(IpRun.class);
        verify(runs).save(run.capture());
        assertEquals("production", mapper.readTree(run.getValue().getInputJson()).path("_exec").path("stage").asText());
    }

    @Test void anExplicitChoiceWinsAndMustBeActive() throws Exception {
        when(catalog.available()).thenReturn(List.of(video, script));
        when(catalog.requireForNewSelection("script-rewrite")).thenReturn(script);
        when(catalog.requireForNewSelection("draft-skill")).thenThrow(StudioSkillCatalog.notFound());
        var e = assertThrows(BusinessException.class, () -> service.post("u1", "P1", "IPT-P1", message("c-5", "复刻", List.of("v1"), "draft-skill")));
        assertEquals("STUDIO_SKILL_NOT_FOUND", e.getCode());
        verify(runs, never()).save(any());
        service.post("u1", "P1", "IPT-P1", message("c-6", "复刻这条", List.of("v1"), "script-rewrite"));
        assertEquals("script-rewrite", thread.getSkillKey(), "explicit choice beats routing hints");
        assertEquals("script-rewrite", routedSkill());
    }

    /** 意图直达 2026-10-20: the skill is bound per job. Between jobs a message that names another job switches the thread. */
    @Test void aBoundThreadWithNoActiveExecutionIsReRoutedByTheNextMessage() throws Exception {
        thread.setSkillKey("script-rewrite"); thread.setSkillVersion(1); thread.setStage("production");
        when(catalog.find("script-rewrite")).thenReturn(Optional.of(script));
        when(catalog.available()).thenReturn(List.of(video, script));
        service.post("u1", "P1", "IPT-P1", message("c-7", "复刻这条", List.of("v1"), null));
        assertEquals("video-recreation", thread.getSkillKey(), "画完文案再复刻: the job changed, so did the method");
        assertEquals("analysis", thread.getStage(), "the new method starts in its own stage");
        assertEquals("video-recreation", routedSkill());
    }

    @Test void aFollowUpThatNamesNoJobKeepsTheBoundSkill() throws Exception {
        thread.setSkillKey("script-rewrite"); thread.setSkillVersion(1); thread.setStage("production");
        when(catalog.find("script-rewrite")).thenReturn(Optional.of(script));
        when(catalog.available()).thenReturn(List.of(video, script));
        service.post("u1", "P1", "IPT-P1", message("c-8", "再短一点", null, null));
        assertEquals("script-rewrite", thread.getSkillKey());
        // No execution is running, so the next plan starts in the method's first stage (main's rule, merged 2026-10-20):
        // this test method has an analysis stage, and a production plan without a running analysis could not be confirmed.
        assertEquals("analysis", thread.getStage());
        assertEquals("script-rewrite", routedSkill());
    }

    // ── 2026-10-23 不锁方法 (docs/ip-studio-dialogue-intents.md) ─────────────────────────────────────────────────

    private StudioSkill fileSkill(String key) throws Exception {
        return StudioSkillCatalog.parse(Files.readString(Path.of("src/main/resources/studio/skills/" + key + ".md")));
    }

    private StudioExecutionControl boundExecution(String status, boolean ends) {
        thread.setActiveExecutionId("PEX-1");
        var control = mock(StudioExecutionControl.class);
        when(control.active("u1", "P1", "IPT-P1")).thenReturn(Optional.of(new StudioExecutionControl.ExecutionView("PEX-1", thread.getStage(), status)));
        when(control.releaseForSwitch("u1", "P1", "PEX-1")).thenReturn(ends);
        ReflectionTestUtils.setField(service, "executionControl", control);
        return control;
    }

    /** A pending image card on the thread, like the one the image production was waiting on. */
    private IpDialogueMessage pendingCard() {
        var card = IpDialogueMessage.builder().id("IDM-card").threadId("IPT-P1").seq(1).role("assistant").text("")
                .blocksJson("[{\"type\":\"approval\",\"approvalId\":\"APV-img\",\"status\":\"pending\",\"stage\":\"production\"}]").status("done")
                .createdAt(Instant.now()).build();
        stored.put(card.getId(), card);
        when(messages.findByThreadIdOrderBySeqDesc(eq("IPT-P1"), any())).thenAnswer(i -> new ArrayList<>(stored.values()));
        return card;
    }

    /**
     * The production case (2026-10-23): an image production waits for its card, the user says 「把第一段做成视频」. The thread
     * switches to 出视频, the image card is superseded, the image production is released, and the new turn plans video from
     * the method's first stage. Nothing about stages or ranges goes to the user.
     */
    @Test void aMessageForAnotherJobSwitchesTheMethodEvenDuringAProduction() throws Exception {
        var image = fileSkill("image-generation");
        var video = fileSkill("video-generation");
        thread.setSkillKey("image-generation"); thread.setSkillVersion(image.version()); thread.setStage("production");
        when(catalog.find("image-generation")).thenReturn(Optional.of(image));
        when(catalog.available()).thenReturn(List.of(image, video));
        var control = boundExecution("needs_user", true);
        var card = pendingCard();
        var accepted = service.post("u1", "P1", "IPT-P1", message("c-11", "把第一段做成视频", null, null));
        assertEquals("accepted", accepted.queueState(), "no 409 / 400: the method follows the message");
        assertEquals("video-generation", thread.getSkillKey());
        assertNull(thread.getActiveExecutionId(), "the image production no longer belongs to the thread");
        assertEquals("production", thread.getStage(), "the new method's first stage");
        verify(control).releaseForSwitch("u1", "P1", "PEX-1");
        assertTrue(card.getBlocksJson().contains("\"superseded\""), "the old image card can no longer start anything");
        var exec = mapper.readTree(capturedRun().getInputJson()).path("_exec");
        assertEquals("video-generation", exec.path("skill").path("key").asText());
        assertFalse(exec.has("executionId"), "the turn is not inside the released production");
    }

    /** The same method again (「再来一张」 during an image production): the work stays in that production. */
    @Test void theSameMethodStaysInTheBoundProduction() throws Exception {
        var image = fileSkill("image-generation");
        thread.setSkillKey("image-generation"); thread.setSkillVersion(image.version()); thread.setStage("production");
        when(catalog.find("image-generation")).thenReturn(Optional.of(image));
        when(catalog.available()).thenReturn(List.of(image, fileSkill("video-generation")));
        var control = boundExecution("needs_user", true);
        service.post("u1", "P1", "IPT-P1", message("c-12", "再画一张海报", null, null));
        assertEquals("image-generation", thread.getSkillKey());
        assertEquals("PEX-1", thread.getActiveExecutionId());
        verify(control, never()).releaseForSwitch(anyString(), anyString(), anyString());
        assertEquals("PEX-1", mapper.readTree(capturedRun().getInputJson()).path("_exec").path("executionId").asText());
    }

    /** An explicit skillKey for another method during a production is a switch, not a 400 / 409. */
    @Test void anExplicitSwitchDuringAProductionIsAccepted() throws Exception {
        thread.setSkillKey("script-rewrite"); thread.setSkillVersion(1); thread.setStage("production");
        when(catalog.find("script-rewrite")).thenReturn(Optional.of(script));
        when(catalog.requireForNewSelection("video-recreation")).thenReturn(video);
        var control = boundExecution("paused", true);
        var accepted = service.post("u1", "P1", "IPT-P1", message("c-13", "复刻这条", List.of("v1"), "video-recreation"));
        assertEquals("accepted", accepted.queueState());
        assertEquals("video-recreation", thread.getSkillKey());
        assertEquals("analysis", thread.getStage());
        verify(control).releaseForSwitch("u1", "P1", "PEX-1");
    }

    /** 复刻 still in its analysis, the user says 「直接出视频」: the thread goes to 出视频. */
    @Test void aRecreationInAnalysisSwitchesToVideoWhenTheUserAsksForAVideoDirectly() throws Exception {
        var recreation = fileSkill("reference-video-recreation");
        var videoSkill = fileSkill("video-generation");
        thread.setSkillKey("reference-video-recreation"); thread.setSkillVersion(recreation.version()); thread.setStage("analysis");
        when(catalog.find("reference-video-recreation")).thenReturn(Optional.of(recreation));
        when(catalog.available()).thenReturn(List.of(recreation, videoSkill, fileSkill("image-generation")));
        var control = boundExecution("paused", false); // the analysis is still generating: detached, not cancelled
        service.post("u1", "P1", "IPT-P1", message("c-14", "不用分析了，直接出视频", null, null));
        assertEquals("video-generation", thread.getSkillKey());
        assertEquals("production", thread.getStage());
        assertNull(thread.getActiveExecutionId());
        verify(control).releaseForSwitch("u1", "P1", "PEX-1");
        verify(control, never()).stop(anyString(), anyString(), anyString(), anyString());
    }

    private IpRun capturedRun() {
        var run = ArgumentCaptor.forClass(IpRun.class);
        verify(runs).save(run.capture());
        return run.getValue();
    }
}
