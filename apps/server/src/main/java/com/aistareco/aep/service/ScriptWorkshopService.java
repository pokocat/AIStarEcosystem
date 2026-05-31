package com.aistareco.aep.service;

import com.aistareco.aep.dto.ScriptDto;
import com.aistareco.aep.dto.ScriptVersionDto;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.WorkshopScript;
import com.aistareco.aep.model.WorkshopScriptVersion;
import com.aistareco.aep.repository.WorkshopScriptRepository;
import com.aistareco.aep.repository.WorkshopScriptVersionRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 脚本工坊服务（v0.45）：脚本 + 版本树 CRUD + AI 续写。按 ownerUserId 隔离。
 *
 * AI 续写复用 {@link AiModelInvocationService}（用途 DRAMA_SCRIPT_DRAFT，与短剧起草共享端点），
 * 但用内联续写提示词（非 JSON 输出）。未配置模型端点 → 503（不静默兜底）。
 */
@Service
public class ScriptWorkshopService {

    private static final Logger log = LoggerFactory.getLogger(ScriptWorkshopService.class);

    private final WorkshopScriptRepository scriptRepo;
    private final WorkshopScriptVersionRepository versionRepo;
    private final AiModelInvocationService invocation;

    public ScriptWorkshopService(WorkshopScriptRepository scriptRepo,
                                 WorkshopScriptVersionRepository versionRepo,
                                 AiModelInvocationService invocation) {
        this.scriptRepo = scriptRepo;
        this.versionRepo = versionRepo;
        this.invocation = invocation;
    }

    public List<ScriptDto> listScripts(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        return scriptRepo.findByOwnerUserIdOrderByUpdatedAtDesc(userId)
                .stream().map(ScriptDto::from).toList();
    }

    public ScriptDto getScript(String id, String userId) {
        return scriptRepo.findByIdAndOwnerUserId(id, userId).map(ScriptDto::from).orElse(null);
    }

    public List<ScriptVersionDto> listVersions(String scriptId, String userId) {
        if (scriptRepo.findByIdAndOwnerUserId(scriptId, userId).isEmpty()) return List.of();
        return versionRepo.findByScriptIdOrderByVersionAsc(scriptId)
                .stream().map(ScriptVersionDto::from).toList();
    }

    public ScriptVersionDto getVersion(String versionId, String userId) {
        WorkshopScriptVersion v = versionRepo.findById(versionId).orElse(null);
        if (v == null) return null;
        // owner 校验：版本所属脚本必须属于该用户
        if (scriptRepo.findByIdAndOwnerUserId(v.getScriptId(), userId).isEmpty()) return null;
        return ScriptVersionDto.from(v);
    }

    @Transactional
    public ScriptDto createScript(JsonNode body, String userId) {
        if (body == null || !body.isObject()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "SCRIPT_BODY_REQUIRED", "缺少脚本内容");
        }
        String title = text(body, "title");
        if (title == null || title.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "SCRIPT_TITLE_REQUIRED", "脚本标题必填");
        }
        OffsetDateTime now = OffsetDateTime.now();
        String author = orDefault(text(body, "authorName"), "我");
        WorkshopScript script = WorkshopScript.builder()
                .id("ws_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .ownerUserId(userId)
                .title(title)
                .kind(orDefault(text(body, "kind"), "drama"))
                .status("draft")
                .series(text(body, "series"))
                .episode(text(body, "episode"))
                .dramaId(text(body, "dramaId"))
                .progress(10)
                .authorName(author)
                .createdAt(now)
                .updatedAt(now)
                .build();

        WorkshopScriptVersion v1 = WorkshopScriptVersion.builder()
                .id("wsv_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .scriptId(script.getId())
                .version(1)
                .content(orDefault(text(body, "initialContent"), ""))
                .authorName(author)
                .aiAssisted(false)
                .note("初始版本")
                .createdAt(now)
                .build();
        versionRepo.save(v1);
        script.setCurrentVersionId(v1.getId());
        scriptRepo.save(script);
        return ScriptDto.from(script);
    }

    @Transactional
    public ScriptVersionDto commitVersion(String scriptId, JsonNode body, String userId) {
        WorkshopScript script = requireScript(scriptId, userId);
        String content = text(body, "content");
        if (content == null) content = "";
        int nextVersion = versionRepo.findFirstByScriptIdOrderByVersionDesc(scriptId)
                .map(v -> v.getVersion() + 1).orElse(1);
        OffsetDateTime now = OffsetDateTime.now();
        WorkshopScriptVersion v = WorkshopScriptVersion.builder()
                .id("wsv_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .scriptId(scriptId)
                .version(nextVersion)
                .content(content)
                .authorName(orDefault(text(body, "authorName"), script.getAuthorName()))
                .aiAssisted(body != null && body.path("aiAssisted").asBoolean(false))
                .note(text(body, "note"))
                .createdAt(now)
                .build();
        versionRepo.save(v);
        script.setCurrentVersionId(v.getId());
        script.setProgress(Math.min(100, script.getProgress() + 10));
        script.setUpdatedAt(now);
        scriptRepo.save(script);
        return ScriptVersionDto.from(v);
    }

    @Transactional
    public ScriptDto setStatus(String scriptId, String status, String userId) {
        WorkshopScript script = requireScript(scriptId, userId);
        if (status != null && !status.isBlank()) {
            script.setStatus(status);
            if ("approved".equalsIgnoreCase(status)) script.setProgress(100);
        }
        script.setUpdatedAt(OffsetDateTime.now());
        scriptRepo.save(script);
        return ScriptDto.from(script);
    }

    @Transactional
    public void deleteScript(String scriptId, String userId) {
        WorkshopScript script = scriptRepo.findByIdAndOwnerUserId(scriptId, userId).orElse(null);
        if (script == null) return;
        versionRepo.deleteByScriptId(scriptId);
        scriptRepo.delete(script);
    }

    @Transactional
    public ScriptDto cloneScript(String scriptId, String userId) {
        WorkshopScript src = requireScript(scriptId, userId);
        OffsetDateTime now = OffsetDateTime.now();
        WorkshopScript copy = WorkshopScript.builder()
                .id("ws_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .ownerUserId(userId)
                .title(src.getTitle() + "（副本）")
                .kind(src.getKind())
                .status("draft")
                .series(src.getSeries())
                .episode(src.getEpisode())
                .dramaId(src.getDramaId())
                .progress(src.getProgress())
                .authorName(src.getAuthorName())
                .createdAt(now)
                .updatedAt(now)
                .build();
        String srcContent = src.getCurrentVersionId() == null ? "" :
                versionRepo.findById(src.getCurrentVersionId()).map(WorkshopScriptVersion::getContent).orElse("");
        WorkshopScriptVersion v1 = WorkshopScriptVersion.builder()
                .id("wsv_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .scriptId(copy.getId())
                .version(1)
                .content(srcContent)
                .authorName(copy.getAuthorName())
                .aiAssisted(false)
                .note("克隆自 " + src.getTitle())
                .createdAt(now)
                .build();
        versionRepo.save(v1);
        copy.setCurrentVersionId(v1.getId());
        scriptRepo.save(copy);
        return ScriptDto.from(copy);
    }

    /** AI 续写 / 改写：返回模型生成的剧本正文（不落库；前端拿去后可作为新版本提交）。 */
    public String generate(String scriptId, String prompt, String userId) {
        WorkshopScript script = requireScript(scriptId, userId);
        if (!invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "脚本 AI 续写还没接入大模型：请在管理后台为「短剧脚本起草」用途绑定一个模型端点后再试。");
        }
        if (prompt == null || prompt.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "SCRIPT_PROMPT_REQUIRED", "请填写续写 / 改写要求");
        }
        String current = script.getCurrentVersionId() == null ? "" :
                versionRepo.findById(script.getCurrentVersionId()).map(WorkshopScriptVersion::getContent).orElse("");

        StringBuilder user = new StringBuilder();
        user.append("剧本标题：").append(orDefault(script.getTitle(), "未命名")).append("\n");
        if (!current.isBlank()) {
            user.append("当前剧本正文：\n").append(current).append("\n\n");
        }
        user.append("续写 / 改写要求：").append(prompt).append("\n");
        user.append("请直接输出剧本正文（中文，分场景 / 分镜 + 台词），不要解释、不要 JSON、不要 markdown 代码块。");

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content",
                "你是一位资深竖屏短剧编剧，擅长强钩子、快节奏、强冲突。根据用户的当前剧本与续写要求产出可直接拍摄的剧本正文。"));
        messages.add(Map.of("role", "user", "content", user.toString()));

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", 0.9);
        options.put("max_tokens", 4096);

        AiModelInvocationService.AiModelResponse resp;
        try {
            resp = invocation.invokeChat(AiModelPurpose.DRAMA_SCRIPT_DRAFT, messages, options);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "脚本 AI 续写调用失败，请稍后重试。");
        }
        String content = resp.content() == null ? "" : resp.content().trim();
        if (content.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "脚本 AI 续写返回空内容，请重试或换个说法。");
        }
        log.info("[script-workshop] generate ok user={} scriptId={} chars={} model={}",
                userId, scriptId, content.length(), resp.modelUsed());
        return content;
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private WorkshopScript requireScript(String scriptId, String userId) {
        return scriptRepo.findByIdAndOwnerUserId(scriptId, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SCRIPT_NOT_FOUND", "脚本不存在"));
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }
}
