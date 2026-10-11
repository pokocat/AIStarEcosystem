package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;

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

    public static void validateInput(RunRequest request) {
        if (!"text".equals(request.operation())) {
            if (request.textEdit()!=null) throw BusinessException.badRequest("STUDIO_INPUT_INVALID","文本改稿参数只能用于文本创作");
            return;
        }
        if (request.textEdit()==null || request.textEdit().content()==null || request.textEdit().content().length()>48000
                || request.scriptEdit()!=null || request.settings()!=null || request.episodeNo()!=null || Boolean.TRUE.equals(request.readVisuals()))
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID","文本创作需要当前正文，最多 48000 字");
    }

    public static void validateOutput(JsonNode revision) {
        if (!revision.isObject() || !revision.path("summary").isTextual() || revision.path("summary").asText().isBlank()
                || revision.path("summary").asText().length()>4000 || !revision.path("content").isTextual()
                || revision.path("content").asText().isBlank() || revision.path("content").asText().length()>48000)
            throw BusinessException.badRequest("AI_BAD_OUTPUT","AI 返回的文本不完整，原文已保留，请重试");
    }
}
