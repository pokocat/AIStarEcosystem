package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.ipstudio.skill.StudioSkill;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The dialogue and planner prompts are contracts with the model (AGENTS §8.0.1 ⑦): every tool they name must exist, every
 * method they route to must be a repository skill by that exact name, and every variable the worker fills must still be
 * in the template. Copy is not asserted; the wiring is.
 */
class StudioDialoguePromptWiringTest {
    static final Path DIALOGUE = Path.of("src/main/resources/prompts/material/dap.ip_studio_skill_dialogue.md");
    static final Path PLAN = Path.of("src/main/resources/prompts/material/dap.ip_studio_skill_plan.md");
    static final Path TOOLS = Path.of("src/main/java/com/aistareco/aep/ipstudio/dialogue/tools");
    static final Path SKILLS = Path.of("src/main/resources/studio/skills");
    static final Pattern TOOL_NAME = Pattern.compile("public String name\\(\\) \\{ return \"([a-z_]+)\"; \\}");
    static final Pattern SNAKE = Pattern.compile("\\b([a-z]+_[a-z_]+)\\b");

    static Set<String> toolNames() throws IOException {
        Set<String> names = new TreeSet<>();
        try (Stream<Path> files = Files.list(TOOLS)) {
            for (Path file : files.toList()) {
                Matcher m = TOOL_NAME.matcher(Files.readString(file));
                while (m.find()) names.add(m.group(1));
            }
        }
        return names;
    }

    static List<StudioSkill> skills() throws IOException {
        List<StudioSkill> out = new ArrayList<>();
        try (Stream<Path> files = Files.list(SKILLS)) {
            for (Path file : files.toList()) out.add(StudioSkillCatalog.parse(Files.readString(file)));
        }
        return out;
    }

    @Test void everyToolTheDialoguePromptNamesExists() throws Exception {
        Set<String> tools = toolNames();
        assertTrue(tools.containsAll(List.of("read_skill", "propose_plan", "request_approval", "confirm_approval", "ask_question", "create_nodes", "propose_text")), tools.toString());
        String prompt = Files.readString(DIALOGUE);
        Matcher m = SNAKE.matcher(prompt);
        Set<String> named = new TreeSet<>();
        while (m.find()) named.add(m.group(1));
        named.remove("studio_actions");
        assertFalse(named.isEmpty(), "the prompt names the tools it routes through");
        for (String name : named) assertTrue(tools.contains(name), "prompt names a tool that does not exist: " + name);
    }

    @Test void theIntentTableRoutesToRepositorySkillsByTheirOwnNames() throws Exception {
        String prompt = Files.readString(DIALOGUE);
        Map<String, StudioSkill> byName = new HashMap<>();
        for (StudioSkill s : skills()) byName.put(s.name(), s);
        for (String name : List.of("出图", "写剧本与文案", "出视频", "参考视频复刻")) {
            assertTrue(byName.containsKey(name), "no repository skill named " + name);
            assertTrue(prompt.contains("→ " + name + "。") || prompt.contains("→ " + name + "，") || prompt.contains("→ " + name + "\n") || prompt.contains("→ " + name + "）"),
                    "the intent table routes to " + name);
        }
        // The one-card rule names exactly the direct skills; recreation keeps its two stages.
        for (StudioSkill s : skills()) {
            if (s.direct() && s.active()) assertTrue(prompt.contains(s.name()), s.name() + " is a direct skill the prompt must route to");
        }
        assertFalse(byName.get("参考视频复刻").direct());
        assertTrue(prompt.contains("stage 填 production"), "the direct skills' propose_plan stage is spelled out");
    }

    @Test void theWorkerVariablesAreStillInBothTemplates() throws Exception {
        String dialogue = Files.readString(DIALOGUE);
        for (String v : List.of("skill", "stage", "tools", "context", "history", "steering", "input"))
            assertTrue(dialogue.contains("{{" + v + "}}"), "dialogue template lost {{" + v + "}}");
        String plan = Files.readString(PLAN);
        for (String v : List.of("skill", "stage", "constraints", "brief", "analysis", "assets", "capabilities", "budget", "feedback"))
            assertTrue(plan.contains("{{" + v + "}}"), "plan template lost {{" + v + "}}");
        assertTrue(plan.indexOf("\n---\n") > 0, "system / user split marker");
    }

    @Test void theQuestionBudgetIsOneAndTheRulesAgreeAcrossBothPrompts() throws Exception {
        String dialogue = Files.readString(DIALOGUE), plan = Files.readString(PLAN);
        assertTrue(dialogue.contains("一轮最多问一个问题"), "dialogue: one question per turn");
        assertTrue(plan.contains("最多 1 条"), "planner: at most one question");
        assertTrue(dialogue.contains("可选的一律用方法里的默认值，不问也不编"), "dialogue: optional slots are defaulted, never asked");
        assertTrue(plan.contains("可选项有默认值的一律不问"), "planner: same rule");
        // The dialogue still carries the charging words v17 fixed (AGENTS: never say chatting is free).
        assertTrue(dialogue.contains("不要说「不确认不会花钱」「聊天免费」"));
        assertTrue(dialogue.contains("confirm_approval"));
    }
    /**
     * The complete action example at the end of the dialogue prompt (v21) must itself be an action the parser accepts and
     * view_images must declare the arguments it uses: a model copies the example's shape exactly (2026-10-21, without an
     * example it wrote 「[调用工具 view_images]」 and nothing ran).
     */
    @Test void theActionExampleInTheDialoguePromptParsesAsTheToolItNames() throws Exception {
        String prompt = Files.readString(DIALOGUE);
        String system = prompt.substring(0, prompt.indexOf("\n---\n"));
        int at = system.lastIndexOf("\n" + DialogueActionProtocol.MARKER + "\n");
        assertTrue(at > 0, "the prompt shows the marker on its own line in a complete example");
        int proseStart = system.lastIndexOf('\n', at - 1) + 1;
        var parsed = DialogueActionProtocol.parse(system.substring(proseStart), toolNames());
        assertNull(parsed.parseError(), parsed.parseError());
        assertEquals(1, parsed.actions().size());
        assertEquals("view_images", parsed.actions().get(0).tool());
        assertFalse(parsed.visibleText().isBlank(), "the example shows one sentence of prose before the action");
        String declared = Files.readString(TOOLS.resolve("ViewImagesTool.java"));
        parsed.actions().get(0).args().fieldNames().forEachRemaining(arg ->
                assertTrue(declared.contains("\"" + arg + "\""), "view_images does not declare " + arg));
    }

    /**
     * 2026-10-21 14:10 the model closed the action array with the marker again, three tries in a row, and the turn ran
     * nothing. The parser now forgives a closing line, but a model copies what it is shown: the prompt and the correction
     * both say the marker is written once, and the example shows it once with nothing after its array. The rule sentence
     * is asserted because it is the contract with the model, not copy for the user (AGENTS §8.0.1 ⑩).
     */
    @Test void theMarkerIsAskedForAndShownOnce() throws Exception {
        String prompt = Files.readString(DIALOGUE);
        String system = prompt.substring(0, prompt.indexOf("\n---\n"));
        assertTrue(system.contains("分隔行 `" + DialogueActionProtocol.MARKER + "` 只写一次，数组后面不要再写"), "dialogue prompt");
        assertTrue(DialogueLoop.correctionText("x").contains(DialogueActionProtocol.MARKER + " 只写一次，数组后面不要再写"), "correction");
        assertEquals(1, system.lines().filter(l -> l.strip().equals(DialogueActionProtocol.MARKER)).count(), "one marker line in the example");
        assertTrue(system.stripTrailing().endsWith("]"), "nothing follows the example's array");
    }
    /**
     * 2026-10-21: a routing tie leaves the turn without a method and the model binds one with read_skill. On qwen38-27b the
     * model bound in the first step only once the unbound text said to bind alongside looking and not to ask before binding
     * (0 of 9 → 9 of 9); and propose_plan's description no longer sends it to the withdrawn 「原创创作」. Contract with the
     * model, not user copy (§8.0.1 ⑩).
     */
    @Test void anUnboundTurnIsToldToBindFirstAndOnlyMethodsOnTheShelfAreNamed() throws Exception {
        String worker = Files.readString(Path.of("src/main/java/com/aistareco/aep/ipstudio/dialogue/StudioDialogueTurnWorker.java"));
        assertTrue(worker.contains("read_skill 选定对应的方法") && worker.contains("可以和看图放在同一批动作里")
                && worker.contains("选定方法之前不要向用户提问"), "the unbound skill text");
        String propose = Files.readString(TOOLS.resolve("ProposePlanTool.java"));
        for (StudioSkill s : skills()) {
            if (s.withdrawn()) assertFalse(propose.contains("「" + s.name() + "」"), "propose_plan names the withdrawn method " + s.name());
            else if (s.direct()) assertTrue(propose.contains(s.name()), "propose_plan names the direct method " + s.name());
        }
    }

    /**
     * §6.1 / §6.2 (docs/ip-studio-new-canvas-and-threads.md), production 2026-10-21 IPP-655ea55a: the executor made a second
     * node beside the assistant's prepared one, and a 1:1 first frame was stretched to 9:16. The planner's JSON shape names
     * the field the validator reads, the rule says when to fill it, and both prompts and the video skill say the clip
     * follows its first frame unless the user named a 画幅. Contract with the model, not user copy (§8.0.1 ⑩).
     */
    @Test void thePlannerIsToldToFillThePreparedObjectAndTheClipFollowsItsFirstFrame() throws Exception {
        String plan = Files.readString(PLAN);
        String system = plan.substring(0, plan.indexOf("\n---\n"));
        assertTrue(system.contains("dependsOn[],targetNodeId?}"), "targetNodeId is in the planner's JSON shape");
        assertTrue(system.contains("在这一步填 targetNodeId") && system.contains("不要另建"), "the rule for filling it");
        assertTrue(system.contains("aspectRatio 跟首帧图一致"), "planner: 画幅 follows the first frame");
        String dialogue = Files.readString(DIALOGUE);
        assertTrue(dialogue.substring(0, dialogue.indexOf("\n---\n")).contains("视频画幅跟首帧图一致"), "dialogue rule 11");
        String video = Files.readString(SKILLS.resolve("video-generation.md"));
        assertTrue(video.contains("有首帧图时跟首帧图一致") && video.contains("targetNodeId"), "video skill");
        // The validator reads exactly the field the prompt names.
        var raw = new com.fasterxml.jackson.databind.ObjectMapper().readTree("""
            {"summary":"一段视频","steps":[{"id":"s1","operation":"video","title":"转身","prompt":"转身","targetNodeId":"dlg-1",
              "settings":{"video":{"mode":"t2v","resolutionTier":"768p"},"durationSec":5,"aspectRatio":"1:1","count":1}}],"questions":[]}""");
        var rules = com.aistareco.aep.ipstudio.execution.StudioSkillRules.rules(StudioSkillCatalog.parse(video));
        assertEquals("dlg-1", com.aistareco.aep.ipstudio.service.StudioPlanValidator.validateSkillPlan(raw, rules, "production", List.of("dlg-1"))
                .path("steps").get(0).path("targetNodeId").asText());
    }
}
