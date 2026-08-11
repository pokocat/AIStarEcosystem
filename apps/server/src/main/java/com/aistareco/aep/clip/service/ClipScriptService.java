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
        for (Map<String, Object> row : segments) if (!"tail".equals(String.valueOf(row.get("role")))) {
            row.put("text", String.valueOf(row.getOrDefault("text", "")).replaceAll("[。.]$", "") + "。这也是我一路做下来的真实体会。");
            row.put("actualDurationSec", 0);
        }
        Map<String, Object> payload = new LinkedHashMap<>(p.getPayloadJson()); payload.put("segments", segments); p.setPayloadJson(payload); p.setUpdatedAt(Instant.now()); ClipProjectService.recompute(p); repo.save(p);
        return Map.of("scope", scope, "segments", segments, "mock", true);
    }

    public Map<String, Object> preview(String owner, String id, Integer no, String text) {
        projects.required(owner, id);
        if (no == null || text == null || text.isBlank()) throw BusinessException.badRequest("CLIP_PREVIEW_INVALID", "试听参数不完整");
        ShiliuGateway.Task task = shiliu.required().previewVoice(owner, avatars.requiredVoiceEngineRef(owner), text);
        if (!"succeeded".equals(task.status())) throw new BusinessException(HttpStatus.BAD_GATEWAY, "CLIP_TTS_FAILED", "试听合成失败");
        return Map.of("no", no, "audioUrl", task.outputRef() == null ? "" : task.outputRef(), "actualDurationSec", task.durationSec() == null ? Math.max(1, Math.round(text.length() / 4f)) : task.durationSec(), "mock", shiliu.mockMode());
    }
}
