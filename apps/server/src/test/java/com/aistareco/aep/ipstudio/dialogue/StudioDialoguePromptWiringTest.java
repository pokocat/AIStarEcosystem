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
}
