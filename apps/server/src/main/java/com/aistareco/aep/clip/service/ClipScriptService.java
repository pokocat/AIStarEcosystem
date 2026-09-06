package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.aep.clip.repository.ClipProjectRepository;
import com.aistareco.aep.clip.service.shiliu.*;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
public class ClipScriptService {
    private final ClipProjectService projects; private final ClipProjectRepository repo; private final ShiliuService shiliu; private final ClipAvatarService avatars;
    public ClipScriptService(ClipProjectService projects, ClipProjectRepository repo, ShiliuService shiliu, ClipAvatarService avatars) { this.projects = projects; this.repo = repo; this.shiliu = shiliu; this.avatars = avatars; }

    /** 一句话 brief 的长度上限，与 WORKPLAN §1.3 的口径一致。 */
    static final int MAX_INSTRUCTION_CHARS = 500;

    /**
     * 文案改写。
     *
     * <p><b>{@code scope="all"} 时 {@code text} 是「改写/生成指令」</b>（WORKPLAN 2026-09-05 §1.3）：
     * 用户的一句话 brief 进来，按模板骨架逐段生成全篇。**不改段数、不改 role**，
     * 结尾固定段一个字都不碰 —— 骨架是模板作者定的节奏，AI 只填内容不动结构。
     * {@code text} 留空时退回「在现有文案上润色」的老行为，端上的「帮我改改」按钮不受影响。
     *
     * <p><b>当前只有确定性引擎</b>：真模型没接，非 mock 网关一律 503
     * {@code CLIP_SCRIPT_ENGINE_NOT_CONFIGURED}，不会拿模板句冒充生成结果。
     * 调用方（军师 BFF）要在生产用「一句话生成全片」，得走自己的 LLM 网关。
     */
    @Transactional
    public Map<String, Object> rewrite(String owner, String id, String scope, Integer no, String text) {
        ShiliuGateway gateway = shiliu.required();
        if (!gateway.mock()) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "CLIP_SCRIPT_ENGINE_NOT_CONFIGURED", "口播文案改写模型尚未完成配置");
        ClipProject p = projects.required(owner, id); List<Map<String, Object>> segments = ClipDtos.mapListValue(p.getPayloadJson().get("segments"));
        if ("segment".equals(scope)) {
            if (no == null || text == null || text.isBlank()) throw BusinessException.badRequest("CLIP_REWRITE_INVALID", "单句改写参数不完整");
            String result = text.replaceAll("[。.]$", "") + "，这是我守着这份生意最想说的一句话。";
            return Map.of("scope", scope, "no", no, "text", result, "mock", true);
        }
        if (!"all".equals(scope)) throw BusinessException.badRequest("CLIP_REWRITE_INVALID", "改写范围不支持");
        String instruction = text == null ? "" : text.trim();
        if (instruction.length() > MAX_INSTRUCTION_CHARS) {
            throw BusinessException.badRequest("CLIP_REWRITE_INVALID", "改写指令最多 " + MAX_INSTRUCTION_CHARS + " 字");
        }
        List<Map<String, Object>> speech = segments.stream().filter(row -> !"tail".equals(String.valueOf(row.get("role")))).toList();
        if (speech.isEmpty()) throw BusinessException.badRequest("CLIP_NO_SEGMENTS", "这套模板没有可改写的口播段");
        List<String> clauses = instruction.isBlank() ? List.of() : clauses(instruction);
        for (int index = 0; index < speech.size(); index++) {
            Map<String, Object> row = speech.get(index);
            row.put("text", instruction.isBlank()
                    ? String.valueOf(row.getOrDefault("text", "")).replaceAll("[。.]$", "") + "。这也是我一路做下来的真实体会。"
                    : compose(clauses.get(index % clauses.size()), String.valueOf(row.getOrDefault("hint", "")).trim(), index, speech.size()));
            // 文案变了，上一版的真实配音时长立刻作废：留着会让报价和时间轴按旧音频算。
            row.put("actualDurationSec", 0);
        }
        List<Map<String,Object>> shots = ClipShotPlan.defaultShots(segments);
        Map<String, Object> payload = new LinkedHashMap<>(p.getPayloadJson()); payload.put("segments", segments); payload.put("shots", shots); p.setPayloadJson(payload); p.setUpdatedAt(Instant.now()); ClipProjectService.recompute(p); repo.save(p);
        return Map.of("scope", scope, "segments", segments, "shots", shots, "mock", true);
    }

    /** 把一句话 brief 切成可以分配到各段的短句。切不出来就整句复用，绝不返回空表。 */
    static List<String> clauses(String instruction) {
        List<String> result = new ArrayList<>();
        for (String part : instruction.split("[，,。.；;！!？?\\n]+")) {
            String value = part.trim();
            if (!value.isEmpty()) result.add(value);
        }
        if (result.isEmpty()) result.add(instruction.trim());
        return result;
    }

    /**
     * 确定性的成段方式。<b>这不是模型</b>，是在真模型接上之前把「指令→逐段文案」这条链路先跑通，
     * 好让端上和 BFF 有确定的东西可以对。真模型接上后整个方法应当被替换掉。
     */
    private static String compose(String clause, String hint, int index, int total) {
        String body = clause.replaceAll("[。.！!？?]+$", "");
        if (!hint.isBlank()) body = body + "，" + hint.replaceAll("[。.！!？?]+$", "");
        if (index == 0) return body + "。";
        if (index == total - 1) return body + "，这就是我想让你知道的。";
        return body + "。";
    }

    public Map<String, Object> preview(String owner, String id, Integer no, String text) {
        ClipProject project = projects.required(owner, id);
        if (no == null || text == null || text.isBlank()) throw BusinessException.badRequest("CLIP_PREVIEW_INVALID", "试听参数不完整");
        String avatarId = ClipDtos.string(project.getPayloadJson().get("avatarId"));
        String voiceId = ClipDtos.string(project.getPayloadJson().get("voiceId"));
        String voiceRef = (avatarId == null || avatarId.isBlank()) && (voiceId == null || voiceId.isBlank())
                ? avatars.requiredVoiceEngineRef(owner) : avatars.requiredVoiceEngineRef(owner, avatarId, voiceId);
        ShiliuGateway.Task task = shiliu.required().previewVoice(owner, voiceRef, text);
        if (!"succeeded".equals(task.status())) throw new BusinessException(HttpStatus.BAD_GATEWAY, "CLIP_TTS_FAILED", "试听合成失败");
        return Map.of("no", no, "audioUrl", task.outputRef() == null ? "" : task.outputRef(), "actualDurationSec", task.durationSec() == null ? Math.max(1, Math.round(text.length() / 4f)) : task.durationSec(), "mock", shiliu.mockMode());
    }
}
