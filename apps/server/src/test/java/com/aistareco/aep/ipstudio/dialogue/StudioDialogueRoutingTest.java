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

/** S3 intent routing on a thread without a skill: single active, explicit choice, scored by attachments, ambiguous → 400. */
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
        video = skill("video-recreation", "triggers:\n  media: [video]\n  keywords: [复刻]");
        script = skill("script-rewrite", "triggers:\n  media: [text]\n  keywords: [改脚本]");
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

    @Test void anAttachedVideoRoutesToTheVideoSkill() throws Exception {
        when(catalog.available()).thenReturn(List.of(script, video));
        service.post("u1", "P1", "IPT-P1", message("c-2", "照这个做一条", List.of("v1"), null));
        assertEquals("video-recreation", thread.getSkillKey());
        assertEquals("video-recreation", routedSkill());
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
        var cut = skill("clip-cut", "triggers:\n  media: [video]\n  keywords: [剪]");
        when(catalog.available()).thenReturn(List.of(cut, video));
        var result = service.post("u1", "P1", "IPT-P1", message("c-4b", "看看这条", List.of("v1"), null));
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
        assertEquals("production", thread.getStage());
        assertEquals("script-rewrite", routedSkill());
    }

    @Test void whileAnExecutionIsActiveTheMethodStaysAndAnExplicitSwitchIsRefused() throws Exception {
        thread.setSkillKey("script-rewrite"); thread.setSkillVersion(1); thread.setStage("production"); thread.setActiveExecutionId("PEX-1");
        when(catalog.find("script-rewrite")).thenReturn(Optional.of(script));
        when(catalog.requireForNewWork("script-rewrite")).thenReturn(script);
        when(catalog.requireForNewSelection("video-recreation")).thenReturn(video);
        var control = mock(StudioExecutionControl.class);
        when(control.active("u1", "P1", "IPT-P1")).thenReturn(Optional.of(new StudioExecutionControl.ExecutionView("PEX-1", "production", "needs_user")));
        ReflectionTestUtils.setField(service, "executionControl", control);
        service.post("u1", "P1", "IPT-P1", message("c-9", "复刻这条", List.of("v1"), null));
        assertEquals("script-rewrite", thread.getSkillKey(), "routing never touches a thread whose execution is active");
        verify(catalog, never()).available();
        thread.setActiveTurnId(null); thread.setActiveRunId(null); // the mocked worker never ends the turn; free the thread for the next message
        var e = assertThrows(BusinessException.class, () -> service.post("u1", "P1", "IPT-P1", message("c-10", "复刻这条", List.of("v1"), "video-recreation")));
        assertEquals("STUDIO_INPUT_INVALID", e.getCode());
        assertEquals("script-rewrite", thread.getSkillKey());
    }
}
