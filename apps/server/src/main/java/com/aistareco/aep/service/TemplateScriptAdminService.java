package com.aistareco.aep.service;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.TemplateScript;
import com.aistareco.aep.model.TemplateScriptKind;
import com.aistareco.aep.model.TemplateScriptStatus;
import com.aistareco.aep.repository.CelebrityTemplateRepository;
import com.aistareco.aep.repository.TemplateScriptRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 模板脚本 admin 服务（v0.5）。
 * CRUD / submitReview / publish / rollback / dryRun。
 */
@Service
@Transactional
public class TemplateScriptAdminService {

    private static final ObjectMapper OM = new ObjectMapper();

    private final TemplateScriptRepository repo;
    private final CelebrityTemplateRepository templateRepo;
    private final PromptAssemblyService assemblyService;
    private final AiModelInvocationService invocation;
    private final PromptService promptService;

    public TemplateScriptAdminService(TemplateScriptRepository repo,
                                       CelebrityTemplateRepository templateRepo,
                                       PromptAssemblyService assemblyService,
                                       AiModelInvocationService invocation,
                                       PromptService promptService) {
        this.repo = repo;
        this.templateRepo = templateRepo;
        this.assemblyService = assemblyService;
        this.invocation = invocation;
        this.promptService = promptService;
    }

    public List<TemplateScriptDto> list(String templateId, String status, String kind) {
        List<TemplateScript> rows;
        if (templateId != null && !templateId.isBlank()) {
            rows = repo.findByTemplateIdOrderByVersionDesc(templateId);
        } else {
            rows = repo.findAll();
        }
        if (status != null && !status.isBlank()) {
            TemplateScriptStatus s = TemplateScriptStatus.fromWire(status);
            rows = rows.stream().filter(r -> r.getStatus() == s).toList();
        }
        if (kind != null && !kind.isBlank()) {
            TemplateScriptKind k = TemplateScriptKind.fromWire(kind);
            rows = rows.stream().filter(r -> r.getKind() == k).toList();
        }
        return rows.stream().map(TemplateScriptDto::from).toList();
    }

    public TemplateScriptDto get(String id) {
        return TemplateScriptDto.from(load(id));
    }

    public TemplateScriptDto create(AdminTemplateScriptUpsertDto req) {
        if (req == null || req.templateId() == null || req.templateId().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "TPL_ID_REQUIRED", "templateId 必填");
        }
        if (!templateRepo.existsById(req.templateId())) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "TEMPLATE_NOT_FOUND",
                    "模板 " + req.templateId() + " 不存在");
        }
        TemplateScriptKind kind = req.kind() != null ? TemplateScriptKind.fromWire(req.kind()) : TemplateScriptKind.TEXT;
        // VIDEO_REF 必带 referenceClip
        if (kind == TemplateScriptKind.VIDEO_REF
                && (req.referenceClip() == null || req.referenceClip().isEmpty())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "REFERENCE_CLIP_REQUIRED",
                    "video_ref 模式必须提供 referenceClip");
        }
        TemplateScript entity = TemplateScript.builder()
                .id("script-" + UUID.randomUUID().toString().substring(0, 12))
                .templateId(req.templateId())
                .version(repo.nextVersionFor(req.templateId()))
                .status(TemplateScriptStatus.DRAFT)
                .language(req.language() != null ? req.language() : "zh-CN")
                .kind(kind)
                .createdAt(Instant.now())
                .build();
        applyFields(entity, req);
        return TemplateScriptDto.from(repo.save(entity));
    }

    public TemplateScriptDto update(String id, AdminTemplateScriptUpsertDto req) {
        TemplateScript entity = load(id);
        if (entity.getStatus() == TemplateScriptStatus.PUBLISHED
                || entity.getStatus() == TemplateScriptStatus.ARCHIVED) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "SCRIPT_LOCKED",
                    "脚本已 " + entity.getStatus().wire() + "，不可编辑；请新建草稿或回滚");
        }
        if (req.kind() != null) entity.setKind(TemplateScriptKind.fromWire(req.kind()));
        if (req.language() != null) entity.setLanguage(req.language());
        applyFields(entity, req);
        return TemplateScriptDto.from(repo.save(entity));
    }

    public TemplateScriptDto submitReview(String id) {
        TemplateScript entity = load(id);
        if (entity.getStatus() != TemplateScriptStatus.DRAFT) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "SCRIPT_NOT_DRAFT",
                    "仅 draft 可提交审核（当前 " + entity.getStatus().wire() + "）");
        }
        entity.setStatus(TemplateScriptStatus.IN_REVIEW);
        return TemplateScriptDto.from(repo.save(entity));
    }

    public TemplateScriptDto publish(String id, String operatorUserId) {
        TemplateScript entity = load(id);
        if (entity.getStatus() == TemplateScriptStatus.PUBLISHED
                || entity.getStatus() == TemplateScriptStatus.ARCHIVED) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "SCRIPT_NOT_PUBLISHABLE",
                    "脚本状态 " + entity.getStatus().wire() + " 不可发布");
        }
        // 同 templateId 仅一条 PUBLISHED：归档之前的
        repo.findTopByTemplateIdAndStatusOrderByVersionDesc(
                        entity.getTemplateId(), TemplateScriptStatus.PUBLISHED)
                .ifPresent(prev -> {
                    prev.setStatus(TemplateScriptStatus.ARCHIVED);
                    repo.save(prev);
                });
        entity.setStatus(TemplateScriptStatus.PUBLISHED);
        entity.setPublishedAt(Instant.now());
        entity.setPublishedBy(operatorUserId);
        return TemplateScriptDto.from(repo.save(entity));
    }

    /** 把当前 published 归档，把指定历史版本（archived）重新置 published。 */
    public TemplateScriptDto rollback(String id, String operatorUserId) {
        TemplateScript target = load(id);
        if (target.getStatus() != TemplateScriptStatus.ARCHIVED) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ROLLBACK_TARGET_INVALID",
                    "回滚目标必须是 archived 历史版本");
        }
        repo.findTopByTemplateIdAndStatusOrderByVersionDesc(
                        target.getTemplateId(), TemplateScriptStatus.PUBLISHED)
                .ifPresent(prev -> {
                    prev.setStatus(TemplateScriptStatus.ARCHIVED);
                    repo.save(prev);
                });
        target.setStatus(TemplateScriptStatus.PUBLISHED);
        target.setPublishedAt(Instant.now());
        target.setPublishedBy(operatorUserId);
        return TemplateScriptDto.from(repo.save(target));
    }

    /** 试跑：装配 prompt 但不调引擎；可对 draft 也试跑。 */
    public DryRunResponseDto dryRun(String id, DryRunRequestDto req) {
        if (req == null || req.engine() == null || req.engine().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ENGINE_REQUIRED", "engine 必填");
        }
        int duration = req.durationSec() != null ? req.durationSec() : 30;
        var result = assemblyService.assembleForScript(id, req.engine(), duration,
                req.product(), req.starId(), req.variables());
        return new DryRunResponseDto(result.scriptId(), result.scriptVersion(),
                result.request(), result.warnings());
    }

    /** 调真实 LLM 生成模板脚本草稿；未配置端点 / prompt / 调用失败时直接报错，不返回 stub。 */
    public Map<String, String> draftWithAi(String id, Map<String, Object> req) {
        TemplateScript script = load(id);
        String prompt = req != null && req.get("prompt") != null
                ? String.valueOf(req.get("prompt"))
                : "";
        if (!invocation.hasEndpointFor(AiModelPurpose.SCRIPT_DRAFT)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "未为「脚本起草」绑定 AI 模型端点，请先到管理后台配置真实模型。");
        }
        PromptService.ResolvedPrompt p = promptService.resolve(AiModelPurpose.SCRIPT_DRAFT);
        if ("code".equals(p.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "脚本起草 Prompt 模板缺失（promptKey=" + PromptService.KEY_SCRIPT_DRAFT + "）。");
        }

        List<Map<String, String>> messages = new ArrayList<>();
        if (p.system() != null && !p.system().isBlank()) {
            messages.add(Map.of("role", "system", "content", p.system()));
        }
        messages.add(Map.of("role", "user", "content", buildAiDraftPrompt(script, prompt)));

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", p.params().temperatureOrDefault());
        options.put("max_tokens", p.params().maxTokensOrDefault());

        AiModelInvocationService.AiModelResponse resp;
        try {
            resp = invocation.invokeChat(AiModelPurpose.SCRIPT_DRAFT, messages, options);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED",
                    "脚本起草大模型调用失败：" + e.getMessage());
        }
        String draft = resp.content() == null ? "" : resp.content().trim();
        if (draft.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT",
                    "脚本起草大模型未返回有效内容，请重试或更换模型。");
        }
        return Map.of("draft", draft);
    }

    /** v0.5：upload-clip 走 JSON URL 模式，无 multipart。 */
    public TemplateScriptDto uploadClip(String id, Map<String, Object> referenceClip) {
        TemplateScript entity = load(id);
        if (entity.getKind() != TemplateScriptKind.VIDEO_REF) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "KIND_NOT_VIDEO_REF",
                    "仅 video_ref 模式脚本可挂参考视频");
        }
        if (referenceClip == null || referenceClip.get("videoUrl") == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "VIDEO_URL_REQUIRED",
                    "videoUrl 必填");
        }
        // 默认 reviewStatus=approved（v0.5：运营自行保证版权 + NSFW）
        if (!referenceClip.containsKey("reviewStatus")) {
            referenceClip = new java.util.HashMap<>(referenceClip);
            referenceClip.put("reviewStatus", "approved");
        }
        entity.setReferenceClipJson(toJson(referenceClip));
        return TemplateScriptDto.from(repo.save(entity));
    }

    // ── 内部 ───────────────────────────────────────────────────────────────

    private TemplateScript load(String id) {
        return repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SCRIPT_NOT_FOUND",
                        "脚本不存在：" + id));
    }

    private void applyFields(TemplateScript entity, AdminTemplateScriptUpsertDto req) {
        if (req.persona() != null) entity.setPersonaJson(toJson(req.persona()));
        if (req.systemPrompt() != null) entity.setSystemPrompt(req.systemPrompt());
        if (req.scenes() != null) entity.setScenesJson(toJson(req.scenes()));
        if (req.visualStyle() != null) entity.setVisualStyleJson(toJson(req.visualStyle()));
        if (req.negativePrompt() != null) entity.setNegativePrompt(req.negativePrompt());
        if (req.variables() != null) entity.setVariablesJson(toJson(req.variables()));
        if (req.engineAdapters() != null) entity.setEngineAdaptersJson(toJson(req.engineAdapters()));
        if (req.durationVariants() != null) entity.setDurationVariantsJson(toJson(req.durationVariants()));
        if (req.postProcess() != null) entity.setPostProcessJson(toJson(req.postProcess()));
        if (req.safety() != null) entity.setSafetyJson(toJson(req.safety()));
        if (req.referenceClip() != null) entity.setReferenceClipJson(toJson(req.referenceClip()));
        if (req.experiment() != null) entity.setExperimentJson(toJson(req.experiment()));
        if (req.metrics() != null) entity.setMetricsJson(toJson(req.metrics()));
    }

    private String buildAiDraftPrompt(TemplateScript script, String instruction) {
        StringBuilder sb = new StringBuilder();
        sb.append("请基于当前模板脚本生成一版可直接给运营编辑器使用的中文带货脚本草稿。\n");
        if (instruction != null && !instruction.isBlank()) {
            sb.append("【运营要求】\n").append(instruction.strip()).append("\n\n");
        }
        sb.append("【模板脚本上下文】\n");
        sb.append("scriptId: ").append(script.getId()).append("\n");
        sb.append("templateId: ").append(script.getTemplateId()).append("\n");
        sb.append("kind: ").append(script.getKind() == null ? "" : script.getKind().wire()).append("\n");
        sb.append("language: ").append(script.getLanguage()).append("\n");
        appendBlock(sb, "persona", script.getPersonaJson());
        appendBlock(sb, "systemPrompt", script.getSystemPrompt());
        appendBlock(sb, "scenes", script.getScenesJson());
        appendBlock(sb, "visualStyle", script.getVisualStyleJson());
        appendBlock(sb, "negativePrompt", script.getNegativePrompt());
        appendBlock(sb, "variables", script.getVariablesJson());
        appendBlock(sb, "referenceClip", script.getReferenceClipJson());
        sb.append("\n输出要求：只输出草稿正文或结构化 JSON，不要解释你如何生成，不要返回 stub/mock 字样。");
        return sb.toString();
    }

    private static void appendBlock(StringBuilder sb, String label, String value) {
        if (value == null || value.isBlank()) return;
        sb.append(label).append(":\n").append(value.strip()).append("\n");
    }

    private static String toJson(Object value) {
        try {
            return OM.writeValueAsString(value);
        } catch (Exception e) {
            return null;
        }
    }
}
