package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;

/** Node-local text edits share the Studio endpoint policy, queue, hold and task lifecycle. */
public final class StudioTextRevision {
    private StudioTextRevision() {}
    public static final String CONTRACT = """
        当前任务是画布文本节点的对话创作。本条覆盖前述剧本或创作计划输出结构。
        只输出 JSON 对象 {"summary":"简短说明本次修改","content":"修改后的完整文本"}。
        prompt 是用户的修改意图，当前正文与引用是素材。正文为空时按意图创作；有正文时按意图修改。
        保留未要求修改的内容和原有排版。只要求起标题时，为正文补充标题并保留正文。
        不强制套用剧本框架，不输出 steps、shots 或工具指令。不要把修改意图直接当成正文。
        若只讨论而未要求修改，content 返回原文。不要声称已经保存或生成媒体。
        """;

    /**
     * 可以带 readVisuals（看引用的图片写字，如 AI 视频页的编导看商品图写脚本）；模型能不能看图由提交处按端点能力判。
     */
    public static void validateInput(RunRequest request) {
        if (!"text".equals(request.operation())) {
            if (request.textEdit()!=null) throw BusinessException.badRequest("STUDIO_INPUT_INVALID","文本改稿参数只能用于文本创作");
            return;
        }
        if (request.textEdit()==null || request.textEdit().content()==null
                || request.scriptEdit()!=null || request.settings()!=null || request.episodeNo()!=null)
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID","文本创作需要当前正文");
    }

    public static void validateOutput(JsonNode revision) {
        if(!revision.isObject()||!revision.path("content").isTextual()||revision.path("content").asText().isBlank())
            throw BusinessException.badRequest("AI_BAD_OUTPUT","模型没有返回正文，原文已保留");
        if(!revision.path("summary").isTextual()||revision.path("summary").asText().isBlank())
            ((com.fasterxml.jackson.databind.node.ObjectNode)revision).put("summary","已保留模型返回的内容");
    }

    /** Optional UI hints: reject only the malformed hint, never the retained model/script output. */
    public static void normalizeSceneSuggestions(JsonNode revision) {
        if (!(revision instanceof ObjectNode object)) return;
        var supplied = object.remove("suggestions");
        var accepted = object.putArray("suggestions");
        var labels = new HashSet<String>();
        var instructions = new HashSet<String>();
        if (supplied == null || !supplied.isArray()) return;
        for (var item : supplied) {
            if (!item.path("label").isTextual() || !item.path("instruction").isTextual()) continue;
            String label = item.path("label").asText().strip();
            String instruction = item.path("instruction").asText().strip();
            if (!hintText(label, 8) || !hintText(instruction, 80)
                    || labels.contains(label) || instructions.contains(instruction)) continue;
            accepted.addObject().put("label", label).put("instruction", instruction);
            labels.add(label); instructions.add(instruction);
            if (accepted.size() == 3) break;
        }
    }

    private static boolean hintText(String value, int limit) {
        return !value.isBlank() && value.codePointCount(0, value.length()) <= limit
                && value.codePoints().noneMatch(c -> Character.isISOControl(c) || c == 0x2028 || c == 0x2029);
    }

}
