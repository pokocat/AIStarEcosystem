package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.director.DirectorPrompts;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.SegmentedText;
import com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler;
import com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints;
import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog;
import com.aistareco.aep.ipstudio.segmented.SegmentedPlan;
import com.aistareco.aep.ipstudio.segmented.SegmentedScript;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 长视频在连续制作里的两件事（docs/studio-segmented-video.md）：
 * <ol>
 *   <li>一键到底：用户点一次就做到成片，不在中途问。失败的步骤自动重试一次（确定会再失败的不试）；审稿失败就按原稿往下走；
 *       分镜图检查不合格自动重出一次，还不合格、或者判断不了，都接着做，记下来。其余情况（积分不够、重试后还失败）才停下等用户。</li>
 *   <li>提示词在做到那一步时才编：分镜图和视频的内容来自脚本，开始时还没有。格式用导演台的模板。</li>
 * </ol>
 * 只对带 {@code segmented} 状态的执行生效，别的连续制作不走这里。
 */
@Component
public class StudioSegmentedRun {
    private static final Logger log = LoggerFactory.getLogger(StudioSegmentedRun.class);
    /** 失败后隔多久再试：马上重试常常撞上同一次限流，白白用掉这唯一一次机会（2026-11-05 本地真跑）。靠每分钟的扫描接着做。 */
    private java.time.Duration retryDelay = java.time.Duration.ofSeconds(60);
    private final StudioPlanOutputs outputs;
    private final ObjectMapper mapper;
    @Autowired(required = false) private StudioPromptAssembler promptAssembler;

    public StudioSegmentedRun(StudioPlanOutputs outputs, ObjectMapper mapper) { this.outputs = outputs; this.mapper = mapper; }

    public static boolean applies(JsonNode state) { return state.path("segmented").isObject() || state.path("videoTask").isObject(); }

    private StudioPromptAssembler prompts() { return StudioPromptAssembler.or(promptAssembler); }

    // ── 一键到底 ───────────────────────────────────────────────────────────

    /** 在挑下一步之前调用（持行锁的事务里）：把能自己处理的失败和检查结果处理掉。 */
    void prepare(IpPlanExecution e, ObjectNode state) {
        for (JsonNode raw : PlanState.stageSteps(state, e.getStage())) {
            ObjectNode step = (ObjectNode) raw;
            String status = step.path("status").asText(), id = step.path("id").asText(), operation = step.path("operation").asText();
            if ("failed".equals(status)) {
                if (step.path("attempt").asInt(1) < 3 && retryable(step.path("errorCode").asText(null))) {
                    log.info("[segmented] retry step execution={} step={} code={}", e.getId(), id, step.path("errorCode").asText(""));
                    again(step);
                    step.put("notBefore", java.time.Instant.now().plus(retryDelay.multipliedBy(step.path("attempt").asInt()-1)).toString());
                } else if (!state.has("videoTask") && ("review".equals(id) || "check".equals(operation))) {
                    // 审不了不该挡住成片：审稿按原稿走，检查按没查过走，都记下来。
                    log.warn("[segmented] review skipped execution={} step={} reason={}", e.getId(), id, step.path("reason").asText(""));
                    softSkip(step, "没有审成：" + step.path("reason").asText("原因未知"));
                }
                continue;
            }
            if ("check".equals(operation) && "done".equals(status) && !"pass".equals(step.path("checkStatus").asText()) && !step.path("acknowledged").asBoolean(false)) {
                if(state.has("videoTask"))step.put("acknowledged",true); // advice never discards a valid delivered media file
                else resolveCheck(e, state, step);
            }
        }
        if(state.has("segmented"))skipUnusedBoards(e, state);
    }

    /** 分镜图不合格重出一次，连检查一起再来；判断不了、或者重出过了，接着往下做。 */
    private void resolveCheck(IpPlanExecution e, ObjectNode state, ObjectNode check) {
        ObjectNode target = PlanState.step(state, e.getStage(), check.path("definition").path("settings").path("targetStepId").asText());
        boolean canRedo = "fail".equals(check.path("checkStatus").asText()) && target != null && "done".equals(target.path("status").asText())
                && !target.path("autoFixed").asBoolean(false);
        if (!canRedo) {
            check.put("acknowledged", true);
            return;
        }
        String hint = outputs.chosenRun(e.getOwnerUserId(), e.getProjectId(), check)
                .flatMap(run -> outputs.run(e.getOwnerUserId(), e.getProjectId(), run)).map(dto -> problems(dto.output())).orElse("");
        log.info("[segmented] board redo execution={} step={}", e.getId(), target.path("id").asText());
        target.put("autoFixed", true).put("fixHint", hint);
        again(target);
        again(check);
        check.remove("checkStatus");
        check.remove("checkTargetRunId");
    }

    private static String problems(JsonNode output) {
        List<String> out = new ArrayList<>();
        if (output != null) for (JsonNode item : output.path("check").path("items")) {
            if (!"fail".equals(item.path("status").asText())) continue;
            String text = item.path("suggestion").asText(item.path("reason").asText("")).strip();
            if (!text.isEmpty()) out.add(text);
        }
        String joined = String.join("；", out);
        return joined.length() <= 400 ? joined : joined.substring(0, 400);
    }

    /** 再试一次：新的请求编号（attempt）；之前的任务留着，费用照算（同重新规划时的做法，放进 previousRunIds 才不会被读回成「已完成」）。 */
    static void again(ObjectNode step) {
        ArrayNode previous = step.withArray("previousRunIds");
        step.path("runIds").forEach(previous::add);
        step.putArray("runIds");
        step.put("status", "pending").put("attempt", step.path("attempt").asInt(1) + 1);
        step.remove(List.of("reason", "errorCode", "pendingRequestId", "cancelRequested"));
    }

    private static void softSkip(ObjectNode step, String reason) {
        step.put("status", "skipped").put("softSkipped", true).put("reason", reason);
        step.remove("errorCode");
    }

    /** 这几种再试也不会好：积分不够、人脸或内容被拒、输入不对、模型或价格没配、受理结果不明（不能重复提交）。 */
    static boolean retryable(String code) {
        if (code == null || code.isBlank()) return true;
        return !(code.equals(StudioPaymentMessage.CODE) || code.contains("INSUFFICIENT") || code.contains("RESTRICTED") || code.endsWith("_INVALID") || code.contains("NOT_CONFIGURED")
                || code.contains("PRICE") || code.contains("UNAVAILABLE") || code.contains("UNKNOWN") || code.contains("RECONCILIATION")
                || code.contains("RAW_ONLY") || code.contains("OUT_OF_SCOPE") || code.contains("MODERATION") || code.contains("UNSUPPORTED"));
    }

    /** 脚本定下来以后：这段镜头少，第二张分镜图用不上（费用不发生，报价是上限）。 */
    private void skipUnusedBoards(IpPlanExecution e, ObjectNode state) {
        JsonNode script = null;
        for (JsonNode raw : PlanState.stageSteps(state, e.getStage())) {
            ObjectNode step = (ObjectNode) raw;
            JsonNode info = step.path("definition").path("settings").path("segmented");
            if (info.path("part").asInt() != 1 || !"pending".equals(step.path("status").asText())) continue;
            if (script == null) script = finalScript(e, state);
            if (script == null) return;
            if (SegmentedScript.boardShots(script.path("segments").path(info.path("segment").asInt() - 1), 1).isEmpty())
                softSkip(step, "这一段镜头不多，一张分镜图放得下");
        }
    }

    /** 最后用哪版脚本：审过的，审不成就原稿。定下来后记在状态里，后面的步骤都按这一版。 */
    JsonNode finalScript(IpPlanExecution e, ObjectNode state) {
        ObjectNode info = (ObjectNode) state.path("segmented");
        if (info.path("finalScript").isObject()) return info.path("finalScript");
        ObjectNode review = PlanState.step(state, e.getStage(), "review");
        boolean settled = review != null && ("done".equals(review.path("status").asText()) || review.path("softSkipped").asBoolean(false));
        if (!settled) return null;
        JsonNode script = "done".equals(review.path("status").asText()) ? scriptOf(e, review) : null;
        if (script == null) script = scriptOf(e, PlanState.step(state, e.getStage(), "script"));
        if (script != null) info.set("finalScript", script.deepCopy());
        return script;
    }

    private JsonNode scriptOf(IpPlanExecution e, JsonNode step) {
        if (step == null) return null;
        return outputs.chosenRun(e.getOwnerUserId(), e.getProjectId(), step).flatMap(run -> outputs.run(e.getOwnerUserId(), e.getProjectId(), run))
                .map(dto -> dto.output() == null ? null : dto.output().path("segmented")).filter(JsonNode::isObject).orElse(null);
    }

    // ── 编提示词 ───────────────────────────────────────────────────────────

    /** 这一步实际要提交的定义：提示词（和用得上的参考）在这里定。同样的输入得到同样的结果，重启后重交是同一个请求。 */
    JsonNode materialize(IpPlanExecution e, ObjectNode state, ObjectNode step, JsonNode definition) {
        JsonNode segmented = definition.path("settings").path("segmented");
        ObjectNode compiled = definition.deepCopy();
        switch (segmented.path("kind").asText()) {
            case "review" -> {
                JsonNode script = scriptOf(e, PlanState.step(state, e.getStage(), "script"));
                if (script == null) throw StudioPlanOutputs.missing();
                ((ObjectNode) compiled.path("settings").path("editTarget")).put("snapshot", write(script));
            }
            case "board" -> {
                String prompt = boardPrompt(e, state, step, compiled);
                compiled.put("prompt", prompt);
                step.put("materializedPrompt", prompt);
            }
            case "check" -> {
                ObjectNode target = PlanState.step(state, e.getStage(), definition.path("settings").path("targetStepId").asText());
                String shown = target == null ? "" : target.path("materializedPrompt").asText("");
                compiled.put("prompt", assemble(StudioPromptCallPoints.SEGMENTED_BOARD_CHECK, Map.of("prompt", shown)));
            }
            case "video" -> compiled.put("prompt", videoPrompt(e, state, compiled));
            default -> { }
        }
        return compiled;
    }

    private JsonNode requireScript(IpPlanExecution e, ObjectNode state) {
        JsonNode script = finalScript(e, state);
        if (script == null) throw BusinessException.badRequest("STUDIO_PLAN_STALE", "分镜脚本还没有写好");
        return script;
    }

    private String boardPrompt(IpPlanExecution e, ObjectNode state, ObjectNode step, ObjectNode compiled) {
        JsonNode script = requireScript(e, state), settings = compiled.path("settings"), info = settings.path("segmented");
        JsonNode segment = script.path("segments").path(info.path("segment").asInt() - 1);
        ObjectNode clip = mapper.createObjectNode();
        ArrayNode shots = clip.putArray("shots");
        SegmentedScript.boardShots(segment, info.path("part").asInt()).forEach(shots::add);
        JsonNode materials = state.path("segmented").path("materials");
        List<DirectorPrompts.Ref> refs = new ArrayList<>();
        String prior = null;
        int label = 0;
        Set<String> covered = new HashSet<>();
        for (JsonNode binding : StudioPlanSteps.ordered(settings.path("referenceBindings"))) {
            label++;
            if (binding.hasNonNull("stepId")) { prior = "图" + label; continue; }
            DirectorPrompts.Ref ref = materialRef(script, materials, binding.path("nodeId").asText(), "图" + label);
            refs.add(ref);
            covered.add(ref.name());
        }
        String base = DirectorPrompts.boardPrompt(prompts(), style(script, state), clip, refs, null);
        if (base == null) throw new BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED", "分镜图提示词未配置");
        // 没有参考图的人和物：外观只在脚本里，第一张分镜图要照这个画，后面的照第一张。
        List<Map<String, Object>> described = new ArrayList<>();
        for (JsonNode a : script.path("assets")) {
            if (a.hasNonNull("ref") || covered.contains(a.path("name").asText()) || a.path("description").asText().isBlank()) continue;
            described.add(Map.of("name", a.path("name").asText(), "description", a.path("description").asText()));
        }
        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("assets", described);
        vars.put("prior", prior == null ? "" : prior);
        vars.put("fix", step.path("fixHint").asText(""));
        String notes = assemble(StudioPromptCallPoints.SEGMENTED_BOARD_NOTES, vars);
        return notes.isBlank() ? base : base.strip() + "\n" + notes.strip();
    }

    private String videoPrompt(IpPlanExecution e, ObjectNode state, ObjectNode compiled) {
        JsonNode script = requireScript(e, state);
        ObjectNode settings = (ObjectNode) compiled.path("settings");
        JsonNode segment = script.path("segments").path(settings.path("segmented").path("segment").asInt() - 1);
        // 用不上的第二张分镜图不交给模型，编号也跟着往前。
        ArrayNode kept = mapper.createArrayNode();
        for (JsonNode binding : StudioPlanSteps.ordered(settings.path("referenceBindings"))) {
            if (binding.hasNonNull("stepId")) {
                ObjectNode target = PlanState.step(state, e.getStage(), binding.path("stepId").asText());
                if (target == null || target.path("softSkipped").asBoolean(false)) continue;
            }
            ObjectNode copy = binding.deepCopy();
            copy.put("order", kept.size() + 1);
            kept.add(copy);
        }
        settings.set("referenceBindings", kept);
        Map<String, String> speakers = new LinkedHashMap<>();
        segment.path("shots").forEach(shot -> shot.path("dialogue").forEach(line -> { if (line.hasNonNull("speakerId")) speakers.put(line.path("speakerId").asText(), line.path("speakerId").asText()); }));
        Map<String, String> voiceDescs = new LinkedHashMap<>();
        JsonNode materials = state.path("segmented").path("materials");
        boolean frame = "frame".equals(state.path("segmented").path("mode").asText());
        if (frame) {
            for (JsonNode a : script.path("assets")) if (speakers.containsKey(a.path("name").asText()) && !a.path("voice").asText().isBlank()) voiceDescs.put(a.path("name").asText(), a.path("voice").asText());
            return DirectorPrompts.framePrompt(style(script, state), segment, speakers, voiceDescs);
        }
        List<DirectorPrompts.Ref> refs = new ArrayList<>();
        List<DirectorPrompts.VoiceRef> voices = new ArrayList<>();
        int label = 0, audio = 0;
        boolean sample = false;
        for (JsonNode binding : kept) {
            if ("reference-audio".equals(binding.path("role").asText())) { sample = true; continue; }
            label++;
            if (binding.hasNonNull("nodeId")) refs.add(materialRef(script, materials, binding.path("nodeId").asText(), "图" + label));
        }
        // 声音样本绑给这段第一个说话的人；别的人和没有样本时按脚本写的音色，段与段之间才听得出是同一个人。
        String sampled = sample ? speakers.keySet().stream().findFirst().orElse(null) : null;
        if (sample && sampled != null) voices.add(new DirectorPrompts.VoiceRef("音频" + (++audio), sampled));
        for (JsonNode a : script.path("assets")) {
            String name = a.path("name").asText();
            if (speakers.containsKey(name) && !name.equals(sampled) && !a.path("voice").asText().isBlank()) voiceDescs.put(name, a.path("voice").asText());
        }
        return DirectorPrompts.videoPrompt(style(script, state), segment, refs, speakers, voices, List.of(), voiceDescs, Map.of(), SegmentedPlan.SHOTS_PER_BOARD * 2);
    }

    private DirectorPrompts.Ref materialRef(JsonNode script, JsonNode materials, String nodeId, String label) {
        int number = 0;
        String title = "素材", slot = "image";
        for (JsonNode m : pictures(materials)) {
            number++;
            if (!nodeId.equals(m.path("nodeId").asText())) continue;
            title = m.path("title").asText("素材");
            slot = m.path("slot").asText("image");
            break;
        }
        // 脚本里写了这张图是谁（ref=图几），用脚本里的名字和类型；没写的出镜人物算人物，其余算物件。
        for (JsonNode a : script.path("assets")) if (("图" + number).equals(a.path("ref").asText())) return new DirectorPrompts.Ref(label, a.path("kind").asText("prop"), a.path("name").asText());
        return new DirectorPrompts.Ref(label, "character".equals(slot) ? "character" : "prop", title);
    }

    /** 写脚本时的编号顺序：场景图在前，出镜人物在后，声音不编号。 */
    private static List<JsonNode> pictures(JsonNode materials) {
        List<JsonNode> out = new ArrayList<>();
        for (JsonNode m : materials) if ("image".equals(m.path("slot").asText())) out.add(m);
        for (JsonNode m : materials) if ("character".equals(m.path("slot").asText())) out.add(m);
        return out;
    }

    private ObjectNode style(JsonNode script, ObjectNode state) {
        return mapper.createObjectNode().put("style", script.path("style").asText("真人写实")).put("aspectRatio", state.path("segmented").path("ratio").asText("9:16"));
    }

    private String assemble(String stage, Map<String, ?> vars) {
        prompts().requireStage(stage);
        return prompts().assemble(StudioPromptAssembler.Call.of(stage, vars, null, null)).user();
    }

    private String write(Object value) {
        try { return mapper.writeValueAsString(value); } catch (Exception e) { throw new IllegalStateException(e); }
    }

    // ── 文字步骤的输入 ─────────────────────────────────────────────────────

    /** 脚本和审稿步骤带上分段信息；只有写脚本这一步看图。 */
    RunRequest attach(ObjectNode state, JsonNode compiled, RunRequest request) {
        JsonNode info = compiled.path("settings").path("segmented"), segmented = state.path("segmented");
        String kind = info.path("kind").asText();
        if (!"script".equals(kind) && !"review".equals(kind)) return request;
        try {
            var compose = mapper.treeToValue(segmented.path("compose"), StudioSceneCatalog.ComposeRequest.class);
            List<SegmentedPlan.Segment> specs = new ArrayList<>();
            for (JsonNode s : segmented.path("segments")) specs.add(mapper.treeToValue(s, SegmentedPlan.Segment.class));
            List<String> issues = "review".equals(kind) ? SegmentedScript.issues(mapper.readTree(request.textEdit().content()), specs) : List.of();
            boolean single = "frame".equals(segmented.path("mode").asText());
            boolean visuals = "script".equals(kind) && segmented.path("visual").asBoolean(false) && segmented.path("refCount").asInt() > 0;
            return request.withSegmented(new SegmentedText(kind, compose, specs, segmented.path("hasScript").asBoolean(false), single, issues, segmented.path("refCount").asInt()), visuals ? Boolean.TRUE : null);
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
            throw new IllegalStateException("Corrupt segmented state", error);
        }
    }
}
