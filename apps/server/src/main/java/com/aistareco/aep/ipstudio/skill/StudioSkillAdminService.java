package com.aistareco.aep.ipstudio.skill;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.ipstudio.dto.StudioSkillDtos.*;
import com.aistareco.aep.ipstudio.execution.StudioSkillRules;
import com.aistareco.aep.ipstudio.service.StudioPlanValidator;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Admin side of the skill registry (S3): list, view, publish immutable versions, status, rollback, publish distilled
 * drafts and dry-run a version through the {@code skill_plan} prompt (docs/ip-studio-conversational-video-recreation-plan.md
 * §第三阶段 S3; admin mirror of {@code PromptService}'s versions / rollback / test-run discipline).
 *
 * <p>Every write takes the skill row lock, validates the full content with {@link StudioSkillCatalog#fromHeader} (the same
 * rules as the repository files), inserts a new immutable {@link IpSkillVersion} and moves {@code current_version} in the
 * same transaction; the runtime cache is invalidated after commit. Version content is never updated in place. Accepted
 * work (dialogue turns, plans, executions) keeps the snapshot it was accepted with.
 */
@Service
public class StudioSkillAdminService {
    private static final Logger log = LoggerFactory.getLogger(StudioSkillAdminService.class);
    private static final Pattern ASSET_ID = Pattern.compile("[A-Za-z0-9_-]{1,32}");
    private static final int NOTE_MAX = 1000;

    private final StudioSkillCatalog catalog;
    private final StudioSkillStore store;
    private final PromptService prompts;
    private final AiModelInvocationService models;
    private final AiModelEndpointRepository endpoints;
    private final DapPricingService pricing;
    private final ObjectProvider<AiAppSceneModelPolicyService> scenePolicies;
    private final ObjectProvider<StudioWorkflowService> workflow;
    private final ObjectMapper mapper;
    private final TransactionTemplate tx;

    public StudioSkillAdminService(StudioSkillCatalog catalog, StudioSkillStore store, PromptService prompts, AiModelInvocationService models,
                                   AiModelEndpointRepository endpoints, DapPricingService pricing,
                                   ObjectProvider<AiAppSceneModelPolicyService> scenePolicies, ObjectProvider<StudioWorkflowService> workflow,
                                   ObjectMapper mapper, PlatformTransactionManager manager) {
        this.catalog = catalog; this.store = store; this.prompts = prompts; this.models = models; this.endpoints = endpoints;
        this.pricing = pricing; this.scenePolicies = scenePolicies; this.workflow = workflow; this.mapper = mapper;
        this.tx = new TransactionTemplate(manager);
    }

    // ── Reads ───────────────────────────────────────────────────────────────────────────────────────────────────

    public List<SkillAdminItem> list() {
        List<SkillAdminItem> out = new ArrayList<>();
        for (IpSkill row : store.skills().findAllByOrderBySkillKeyAsc()) out.add(item(row));
        return out;
    }

    public SkillAdminDetail detail(String key) {
        IpSkill row = requireRow(key);
        var item = item(row);
        var current = store.versions().findBySkillKeyAndVersion(row.getSkillKey(), row.getCurrentVersion()).map(v -> versionDto(v, row)).orElse(null);
        return new SkillAdminDetail(item.key(), item.name(), item.status(), item.currentVersion(), item.summary(), item.updatedBy(),
                item.createdAt(), item.updatedAt(), item.pendingDrafts(), item.skill(), item.seedFile(), current);
    }

    /** All versions newest first, drafts included (with their source, base version and origin ids). */
    public List<SkillVersion> versions(String key) {
        IpSkill row = requireRow(key);
        return store.versions().findBySkillKeyOrderByVersionDesc(row.getSkillKey()).stream().map(v -> versionDto(v, row)).toList();
    }

    public SkillVersion version(String key, int version) {
        IpSkill row = requireRow(key);
        return store.versions().findBySkillKeyAndVersion(row.getSkillKey(), version).map(v -> versionDto(v, row)).orElseThrow(StudioSkillAdminService::versionNotFound);
    }

    private SkillAdminItem item(IpSkill row) {
        SkillSummary summary = store.versions().findBySkillKeyAndVersion(row.getSkillKey(), row.getCurrentVersion()).map(v -> {
            try { return store.toSkill(v, row.getStatus()).summaryDto(); }
            catch (IllegalArgumentException e) { return null; } // shown without a summary; loadCurrent logs it as an error
        }).orElse(null);
        int drafts = (int) store.versions().countPendingDrafts(row.getSkillKey(), row.getCurrentVersion());
        return new SkillAdminItem(row.getSkillKey(), row.getName(), row.getStatus(), row.getCurrentVersion(), row.getSummary() == null ? "" : row.getSummary(),
                row.getUpdatedBy(), iso(row.getCreatedAt()), iso(row.getUpdatedAt()), drafts, summary, row.getSeedFile());
    }

    SkillVersion versionDto(IpSkillVersion v, IpSkill row) {
        Map<String, Object> header;
        try { header = store.header(v.getFrontmatterJson()); } catch (IllegalArgumentException e) { header = Map.of(); }
        return new SkillVersion(v.getId(), v.getSkillKey(), v.getVersion(), v.getStatus(), v.getSource(), v.getAuthor(), v.getNote(),
                iso(v.getCreatedAt()), header, v.getBodyMd(), row != null && row.getCurrentVersion() == v.getVersion() ? Boolean.TRUE : null,
                v.getBaseVersion(), v.getSourceProjectId(), v.getSourceExecutionId(), v.getSourceRunId(), iso(v.getPublishedAt()));
    }

    // ── Writes ──────────────────────────────────────────────────────────────────────────────────────────────────

    /** New skill from a whole file; the key comes from its front matter and must not exist yet. */
    public SkillAdminDetail create(CreateRequest request, String by) {
        if (request == null || request.markdown() == null || request.markdown().isBlank())
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "请粘贴完整的制作方法文件（YAML 头 + 正文）");
        if (request.markdown().length() > 80000) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "制作方法文件最多 80000 字");
        String note = note(request.note());
        StudioSkillCatalog.ParsedFile parsed;
        try { parsed = StudioSkillCatalog.parseFile(request.markdown()); }
        catch (IllegalArgumentException e) { throw invalid(e); }
        String key = parsed.skill().key();
        try {
            tx.executeWithoutResult(s -> {
                if (store.skills().findById(key).isPresent()) throw exists(key);
                Map<String, Object> header = store.normalize(parsed.header());
                header.put("version", 1);
                StudioSkill skill = validate(header, parsed.body(), store.digest(header, parsed.body()));
                if (skill.active()) requireNoOtherDefault(skill, null);
                Instant now = Instant.now();
                store.skills().saveAndFlush(IpSkill.builder().skillKey(key).name(skill.name()).status(skill.status()).currentVersion(1)
                        .summary(skill.summary()).updatedBy(actor(by)).createdAt(now).updatedAt(now).build());
                store.versions().saveAndFlush(IpSkillVersion.builder().id(StudioSkillStore.versionId()).skillKey(key).version(1)
                        .frontmatterJson(store.json(header)).bodyMd(skill.body()).contentDigest(skill.digest()).source(IpSkillVersion.SOURCE_ADMIN)
                        .status(IpSkillVersion.PUBLISHED).author(actor(by)).note(note).createdAt(now).publishedAt(now).build());
                catalog.invalidateAfterCommit();
            });
        } catch (DataIntegrityViolationException race) { throw exists(key); }
        log.info("[studio-skill] admin {} created {} v1", actor(by), key);
        return detail(key);
    }

    /** Publish a new immutable version (it becomes current). version / status in the given front matter are server-owned. */
    public SkillAdminDetail publish(String key, PublishRequest request, String by) {
        if (request == null || request.bodyMd() == null || request.bodyMd().isBlank())
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "请填写制作方法正文");
        Map<String, Object> given = frontmatter(request.frontmatter());
        String note = note(request.note());
        tx.executeWithoutResult(s -> {
            IpSkill row = lockRow(key);
            requireExpected(row, request.expectedVersion());
            if (!key.equals(String.valueOf(given.get("key"))))
                throw new BusinessException(HttpStatus.BAD_REQUEST, "STUDIO_SKILL_INVALID", "制作方法的格式不对：YAML 头里的 key 必须是「" + key + "」",
                        Map.of("reason", "key must equal the path key"));
            Map<String, Object> header = store.normalize(given);
            int next = store.versions().maxVersion(key) + 1;
            header.put("version", next);
            header.put("status", row.getStatus());
            StudioSkill skill = validate(header, request.bodyMd(), store.digest(header, request.bodyMd()));
            if (skill.active()) requireNoOtherDefault(skill, key);
            Instant now = Instant.now();
            store.versions().saveAndFlush(IpSkillVersion.builder().id(StudioSkillStore.versionId()).skillKey(key).version(next)
                    .frontmatterJson(store.json(header)).bodyMd(skill.body()).contentDigest(skill.digest()).source(IpSkillVersion.SOURCE_ADMIN)
                    .status(IpSkillVersion.PUBLISHED).author(actor(by)).note(note).createdAt(now).publishedAt(now).build());
            moveCurrent(row, skill, next, by, now);
        });
        log.info("[studio-skill] admin {} published {} v{}", actor(by), key, requireRow(key).getCurrentVersion());
        return detail(key);
    }

    /**
     * active | draft | withdrawn. Leaving no active skill at all is refused (409 STUDIO_SKILL_LAST_ACTIVE); all rows are
     * locked so two admins cannot each withdraw one of the last two. Running executions keep their snapshot.
     */
    public SkillAdminDetail setStatus(String key, StatusRequest request, String by) {
        String status = request == null ? null : request.status();
        if (status == null || !StudioSkillCatalog.STATUSES.contains(status))
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "状态只能是启用、草稿或停用");
        tx.executeWithoutResult(s -> {
            List<IpSkill> all = store.skills().lockAll();
            IpSkill row = all.stream().filter(r -> r.getSkillKey().equals(key)).findFirst().orElseThrow(StudioSkillCatalog::notFound);
            if (status.equals(row.getStatus())) return;
            boolean leavesActive = IpSkill.ACTIVE.equals(row.getStatus()) && !IpSkill.ACTIVE.equals(status);
            if (leavesActive && all.stream().noneMatch(r -> !r.getSkillKey().equals(key) && IpSkill.ACTIVE.equals(r.getStatus())))
                throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_SKILL_LAST_ACTIVE",
                        "这是唯一在用的制作方法，停用后用户就没有方法可用了；请先启用另一个方法");
            if (IpSkill.ACTIVE.equals(status)) {
                var current = store.versions().findBySkillKeyAndVersion(key, row.getCurrentVersion()).orElseThrow(StudioSkillCatalog::notFound);
                StudioSkill skill;
                try { skill = store.toSkill(current, IpSkill.ACTIVE); } catch (IllegalArgumentException e) { throw invalid(e); }
                requireNoOtherDefault(skill, key);
            }
            row.setStatus(status); row.setUpdatedBy(actor(by)); row.setUpdatedAt(Instant.now());
            store.skills().save(row);
            catalog.invalidateAfterCommit();
        });
        log.info("[studio-skill] admin {} set {} status={}", actor(by), key, status);
        return detail(key);
    }

    /** New version copying a published older one (source = rollback). Drafts were never in effect and are not rollback targets. */
    public SkillAdminDetail rollback(String key, int version, VersionActionRequest request, String by) {
        String note = note(request == null ? null : request.note());
        tx.executeWithoutResult(s -> {
            IpSkill row = lockRow(key);
            requireExpected(row, request == null ? null : request.expectedVersion());
            IpSkillVersion target = store.versions().findBySkillKeyAndVersion(key, version).orElseThrow(StudioSkillAdminService::versionNotFound);
            if (IpSkillVersion.DRAFT.equals(target.getStatus()))
                throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "草稿从没生效过，不能回滚到它；要用它请直接发布这份草稿");
            if (target.getVersion() == row.getCurrentVersion())
                throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "这已经是当前版本，不需要回滚");
            Map<String, Object> header = store.header(target.getFrontmatterJson());
            int next = store.versions().maxVersion(key) + 1;
            header.put("version", next);
            header.put("status", row.getStatus());
            StudioSkill skill = validate(header, target.getBodyMd(), store.digest(header, target.getBodyMd()));
            if (skill.active()) requireNoOtherDefault(skill, key);
            Instant now = Instant.now();
            store.versions().saveAndFlush(IpSkillVersion.builder().id(StudioSkillStore.versionId()).skillKey(key).version(next)
                    .frontmatterJson(store.json(header)).bodyMd(target.getBodyMd()).contentDigest(skill.digest()).source(IpSkillVersion.SOURCE_ROLLBACK)
                    .status(IpSkillVersion.PUBLISHED).author(actor(by)).note("回滚到 v" + version + (note == null ? "" : "：" + note))
                    .createdAt(now).publishedAt(now).build());
            moveCurrent(row, skill, next, by, now);
        });
        log.info("[studio-skill] admin {} rolled {} back to the content of v{}", actor(by), key, version);
        return detail(key);
    }

    /**
     * Publish a distilled draft as is: it must still be a revision of the current version (base = current), otherwise
     * 409 STUDIO_SKILL_DRAFT_STALE — publishing it would silently undo whatever was published after it was drafted.
     */
    public SkillAdminDetail publishDraft(String key, int version, VersionActionRequest request, String by) {
        String note = note(request == null ? null : request.note());
        tx.executeWithoutResult(s -> {
            IpSkill row = lockRow(key);
            requireExpected(row, request == null ? null : request.expectedVersion());
            IpSkillVersion draft = store.versions().findBySkillKeyAndVersion(key, version).orElseThrow(StudioSkillAdminService::versionNotFound);
            if (!IpSkillVersion.DRAFT.equals(draft.getStatus()))
                throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_SKILL_VERSION_CONFLICT", "这个版本已经发布过了，请刷新后再看");
            if (draft.getBaseVersion() == null || draft.getBaseVersion() != row.getCurrentVersion())
                throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_SKILL_DRAFT_STALE",
                        "这份草稿是在 v" + draft.getBaseVersion() + " 的基础上整理的，之后已经换成了 v" + row.getCurrentVersion()
                                + "；请对照当前版本手动合并后再发布", Map.of("baseVersion", String.valueOf(draft.getBaseVersion()), "currentVersion", row.getCurrentVersion()));
            StudioSkill skill;
            try { skill = store.toSkill(draft, row.getStatus()); } catch (IllegalArgumentException e) { throw invalid(e); }
            if (skill.active()) requireNoOtherDefault(skill, key);
            Instant now = Instant.now();
            draft.setStatus(IpSkillVersion.PUBLISHED); draft.setPublishedAt(now);
            if (note != null) draft.setNote((draft.getNote() == null ? "" : draft.getNote() + "\n") + "发布说明：" + note);
            store.versions().save(draft);
            moveCurrent(row, skill, draft.getVersion(), by, now);
        });
        log.info("[studio-skill] admin {} published draft {} v{}", actor(by), key, version);
        return detail(key);
    }

    private void moveCurrent(IpSkill row, StudioSkill skill, int version, String by, Instant now) {
        row.setCurrentVersion(version); row.setName(skill.name()); row.setSummary(skill.summary());
        row.setUpdatedBy(actor(by)); row.setUpdatedAt(now);
        store.skills().save(row);
        catalog.invalidateAfterCommit();
    }

    // ── Dry-run (试跑) ─────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * Run the {@code skill_plan} prompt once on an admin-chosen (or the default planning) text endpoint with sample inputs.
     * No user billing, no quote, nothing saved; the reply goes through the same plan validator as real planning. §8.0: no
     * configured endpoint → 503 AI_NOT_CONFIGURED, a missing prompt → 503 PROMPT_NOT_CONFIGURED, never a made-up plan.
     */
    public DryRunResult dryRun(String key, DryRunRequest request) {
        if (request == null || request.brief() == null || request.brief().isBlank())
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "请填写试跑用的用户目标");
        if (request.brief().length() > 16000) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "用户目标最多 16000 字");
        String analysis = request.analysisMarkdown() == null ? "" : request.analysisMarkdown();
        if (analysis.length() > 48000) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "原片分析最多 48000 字");
        String stage = request.stage() == null || request.stage().isBlank() ? StudioSkill.ANALYSIS : request.stage();
        if (!StudioSkillRules.STAGES.contains(stage)) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "请选择分析或制作阶段");
        var assets = mapper.createArrayNode();
        List<String> allowed = new ArrayList<>();
        List<DryRunAsset> given = request.assets() == null ? List.of() : request.assets();
        if (given.size() > 32) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "试跑素材最多 32 个");
        for (int i = 0; i < given.size(); i++) {
            DryRunAsset asset = given.get(i);
            if (asset == null || asset.type() == null || !StudioSkillCatalog.TRIGGER_MEDIA.contains(asset.type()))
                throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "试跑素材的类型只能是视频、图片、音频或文字");
            String id = asset.id() == null || asset.id().isBlank() ? "asset-" + (i + 1) : asset.id().strip();
            if (!ASSET_ID.matcher(id).matches() || allowed.contains(id)) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "试跑素材编号无效或重复");
            allowed.add(id);
            ObjectNode item = assets.addObject().put("id", id).put("type", asset.type()).put("title", clip(asset.title(), 64, "素材 " + (i + 1)));
            if (asset.description() != null && !asset.description().isBlank()) item.put("description", clip(asset.description(), 500, ""));
            if (asset.durationSec() != null && Double.isFinite(asset.durationSec()) && asset.durationSec() > 0) item.put("durationSec", asset.durationSec());
        }
        StudioSkill skill = dryRunSkill(key, request);
        StudioSkillRules.Rules rules = StudioSkillRules.rules(skill);

        PromptService.ResolvedPrompt prompt = prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_PLAN);
        if ("code".equals(prompt.origin())) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED", "尚未配置制作规划提示词");
        AiModelEndpoint endpoint = dryRunEndpoint(request.endpointId());
        Map<String, String> variables = new LinkedHashMap<>();
        String body = skill.body();
        variables.put("skill", body.length() > 16000 ? body.substring(0, 16000) : body);
        variables.put("stage", StudioWorkflowService.skillPlanStageText(stage));
        variables.put("constraints", StudioWorkflowService.skillPlanConstraints(mapper, rules, stage).toString());
        variables.put("brief", request.brief());
        variables.put("analysis", analysis.isBlank() ? "尚未分析。" : analysis);
        variables.put("assets", assets.toString());
        var planner = workflow.getIfAvailable();
        variables.put("capabilities", planner == null ? "{}" : planner.planCapabilities());
        variables.put("budget", "试跑：不涉及真实预算，也不报价。");
        variables.put("feedback", "无。");
        String user = PromptService.fill(prompt.userTemplate(), variables);
        int maxTokens = Math.max(8192, prompt.params().maxTokensOrDefault());
        if (endpoint.getChatMaxOutputTokens() != null) maxTokens = Math.min(maxTokens, endpoint.getChatMaxOutputTokens());
        var response = models.invokeChatOnEndpoint(endpoint, AiModelPurpose.DAP_PERSONA,
                List.of(Map.of("role", "system", "content", prompt.system()), Map.of("role", "user", "content", user)),
                Map.of("timeout_seconds", 300, "response_format", Map.of("type", "json_object"),
                        "temperature", prompt.params().temperatureOrDefault(), "max_tokens", maxTokens));

        List<String> errors = new ArrayList<>();
        JsonNode plan = null;
        if ("length".equals(response.finishReason())) errors.add("回复被截断：请提高这个模型的输出上限后再试");
        JsonNode answer = null;
        try { answer = response.content() == null ? null : mapper.readTree(response.content()); }
        catch (Exception e) { errors.add("模型回复不是 JSON 对象"); }
        if (answer != null && !answer.isObject()) { errors.add("模型回复不是 JSON 对象"); answer = null; }
        if (answer == null && errors.isEmpty()) errors.add("模型没有返回内容");
        if (answer != null && errors.isEmpty()) {
            try {
                ObjectNode normalized = StudioPlanValidator.validateSkillPlan(answer, rules, stage, allowed);
                normalized.put("skillKey", skill.key()).put("skillVersion", skill.version()).put("stage", stage);
                plan = normalized;
            } catch (BusinessException e) { errors.add(e.getMessage()); }
        }
        boolean ok = errors.isEmpty();
        log.info("[studio-skill] dry-run key={} version={} stage={} endpoint={} ok={} finish={} errors={}", skill.key(), skill.version(), stage,
                endpoint.getId(), ok, response.finishReason(), errors);
        String raw = ok || response.content() == null ? null : clip(response.content(), 2000, null);
        return new DryRunResult(plan, new DryRunValidation(ok, List.copyOf(errors)),
                new DryRunUsage(response.promptTokens(), response.completionTokens(), response.tokensUsed()),
                skill.key(), skill.version(), stage, endpoint.getId(), response.modelUsed(), response.finishReason(), raw);
    }

    /** Stored version (drafts included), an unsaved edit (validated like a publish), or the current version. */
    private StudioSkill dryRunSkill(String key, DryRunRequest request) {
        IpSkill row = requireRow(key);
        boolean inline = request.frontmatter() != null || request.bodyMd() != null;
        if (inline && request.version() != null) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "试跑只能选一个版本或一份未保存的修改");
        if (inline) {
            if (request.frontmatter() == null || request.bodyMd() == null || request.bodyMd().isBlank())
                throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "试跑未保存的修改需要同时提供 YAML 头和正文");
            Map<String, Object> header = store.normalize(frontmatter(request.frontmatter()));
            if (!key.equals(String.valueOf(header.get("key"))))
                throw new BusinessException(HttpStatus.BAD_REQUEST, "STUDIO_SKILL_INVALID", "制作方法的格式不对：YAML 头里的 key 必须是「" + key + "」",
                        Map.of("reason", "key must equal the path key"));
            header.put("version", row.getCurrentVersion() + 1);
            header.put("status", row.getStatus());
            return validate(header, request.bodyMd(), store.digest(header, request.bodyMd()));
        }
        if (request.version() != null) return catalog.snapshotFor(key, request.version()).orElseThrow(StudioSkillAdminService::versionNotFound);
        var current = store.versions().findBySkillKeyAndVersion(key, row.getCurrentVersion()).orElseThrow(StudioSkillCatalog::notFound);
        try { return store.toSkill(current, row.getStatus()); } catch (IllegalArgumentException e) { throw invalid(e); }
    }

    private AiModelEndpoint dryRunEndpoint(String endpointId) {
        if (endpointId != null && !endpointId.isBlank())
            return endpoints.findById(endpointId.strip())
                    .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ENDPOINT_NOT_FOUND", "AI 模型端点不存在"));
        var policies = scenePolicies.getIfAvailable();
        if (policies != null) {
            try { return policies.resolve("studio", "script", null, pricing.ipIdentity()).resolved().endpoint(); }
            catch (BusinessException e) {
                if (!"ENDPOINT_NOT_ALLOWED".equals(e.getCode())) throw e;
                throw notConfigured();
            }
        }
        return models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA, null, "studio").map(AiModelInvocationService.ResolvedEndpoint::endpoint)
                .orElseThrow(StudioSkillAdminService::notConfigured);
    }

    private static BusinessException notConfigured() {
        return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                "还没有配置可用的规划模型：请在后台「AI 模型」里为 Studio 创作绑定默认文本模型，或在试跑时选一个模型");
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** YAML text or a JSON object → header map; a string that is neither YAML mapping nor JSON is a 400. */
    Map<String, Object> frontmatter(JsonNode value) {
        if (value == null || value.isNull()) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "请填写制作方法的 YAML 头");
        try {
            if (value.isTextual()) {
                String text = value.asText().strip();
                if (text.startsWith("---")) text = text.replaceFirst("^---\\s*\\n", "").replaceFirst("\\n---\\s*$", "");
                return StudioSkillCatalog.loadYamlHeader(text);
            }
            if (value.isObject()) return store.normalize(mapper.convertValue(value, LinkedHashMap.class));
        } catch (IllegalArgumentException e) { throw invalid(e); }
        throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "YAML 头需为文本或 JSON 对象");
    }

    private StudioSkill validate(Map<String, Object> header, String body, String digest) {
        try { return StudioSkillCatalog.fromHeader(header, body, digest); }
        catch (IllegalArgumentException e) { throw invalid(e); }
    }

    /** At most one active default skill, so routing never has to guess between two fallbacks. */
    private void requireNoOtherDefault(StudioSkill skill, String self) {
        if (!skill.triggers().defaultSkill()) return;
        for (IpSkill other : store.skills().findAllByOrderBySkillKeyAsc()) {
            if (other.getSkillKey().equals(self) || other.getSkillKey().equals(skill.key()) || !IpSkill.ACTIVE.equals(other.getStatus())) continue;
            var version = store.versions().findBySkillKeyAndVersion(other.getSkillKey(), other.getCurrentVersion()).orElse(null);
            if (version == null) continue;
            boolean otherDefault;
            try { otherDefault = store.toSkill(version, other.getStatus()).triggers().defaultSkill(); }
            catch (IllegalArgumentException e) { otherDefault = false; }
            if (otherDefault) throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_SKILL_DEFAULT_CONFLICT",
                    "「" + other.getName() + "」已经是默认方法，同时只能有一个默认方法；请先去掉它的 default 再保存",
                    Map.of("skillKey", other.getSkillKey()));
        }
    }

    private static BusinessException invalid(IllegalArgumentException e) {
        return new BusinessException(HttpStatus.BAD_REQUEST, "STUDIO_SKILL_INVALID", "制作方法的格式不对：" + e.getMessage(), Map.of("reason", String.valueOf(e.getMessage())));
    }

    private static BusinessException exists(String key) {
        return new BusinessException(HttpStatus.CONFLICT, "STUDIO_SKILL_EXISTS", "已经有标识为「" + key + "」的制作方法，请换一个 key 或去那个方法里发布新版本");
    }

    static BusinessException versionNotFound() {
        return BusinessException.notFound("STUDIO_SKILL_VERSION_NOT_FOUND", "这个制作方法版本不存在");
    }

    private static void requireExpected(IpSkill row, Integer expected) {
        if (expected != null && expected != row.getCurrentVersion())
            throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_SKILL_VERSION_CONFLICT", "制作方法已被更新（当前是 v" + row.getCurrentVersion() + "），请核对最新版本后再保存");
    }

    private IpSkill requireRow(String key) {
        return store.skills().findById(key == null ? "" : key).orElseThrow(StudioSkillCatalog::notFound);
    }

    private IpSkill lockRow(String key) {
        return store.skills().lockByKey(key == null ? "" : key).orElseThrow(StudioSkillCatalog::notFound);
    }

    private static String note(String note) {
        if (note == null || note.isBlank()) return null;
        if (note.length() > NOTE_MAX) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "版本说明最多 " + NOTE_MAX + " 字");
        return note.strip();
    }

    private static String actor(String by) { return by == null || by.isBlank() ? "admin" : by.length() > 64 ? by.substring(0, 64) : by; }

    private static String clip(String text, int max, String fallback) {
        if (text == null || text.isBlank()) return fallback;
        String t = text.strip();
        return t.length() > max ? t.substring(0, max) : t;
    }

    static String iso(Instant at) { return at == null ? null : at.toString(); }
}
