package com.aistareco.aep.service;

import com.aistareco.aep.dto.PromptDryRunDto;
import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.dto.PromptTemplateDto;
import com.aistareco.aep.dto.PromptTemplateUpsertDto;
import com.aistareco.aep.dto.PromptTemplateVersionDto;
import com.aistareco.aep.dto.PromptTestRunRequestDto;
import com.aistareco.aep.dto.PromptTestRunResultDto;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.PromptTemplate;
import com.aistareco.aep.model.PromptTemplateVersion;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.repository.PromptTemplateRepository;
import com.aistareco.aep.repository.PromptTemplateVersionRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Prompt 模板解析与管理（MATERIAL_OPS_AI_TEXT_PLAN §6）。
 *
 * resolve(key) 解析顺序：
 *   ① 1min 内存缓存（admin 改后立即失效）—— 沿用 CelebrityActionPricingService 模式
 *   ② DB prompt_template（enabled=true）
 *   ③ resource 默认（resources/prompts/material/&lt;key&gt;.md，按首个 "---" 行分隔 system / user）
 *   ④ 代码内常量兜底（保证永不 NPE / 永远可降级）
 *
 * 字段级回退：DB 行 system/user 为空时，单独回落到 resource 同字段（而非整块丢弃）。
 */
@Service
public class PromptService {

    private static final Logger log = LoggerFactory.getLogger(PromptService.class);
    private static final long CACHE_TTL_MS = 60_000L;
    private static final String RESOURCE_DIR = "prompts/material/";
    private static final Pattern VAR_PATTERN = Pattern.compile("\\{\\{\\s*([A-Za-z0-9_.-]+)\\s*}}");

    /** 素材运营文本三件的标准 promptKey（与 AiModelPurpose 对齐）。 */
    public static final String KEY_SCRIPT_DRAFT = "material.script_draft";
    public static final String KEY_SELLING_POINTS = "material.selling_points";
    public static final String KEY_VARIABLE_EXTRACT = "material.variable_extract";
    public static final String KEY_VIDEO_REF_ANALYSIS = "material.video_ref_analysis";
    /** v0.43+: 形象锻造对话（music/drama 形象顾问）。 */
    public static final String KEY_APPEARANCE_FORGE = "appearance.forge";
    /** v0.43+: 短剧脚本起草（drama 短视频脚本生成）。 */
    public static final String KEY_DRAMA_SCRIPT_DRAFT = "drama.script_draft";
    /** v0.71+: 短剧六阶段工作台各 AI 动作（共用 DRAMA_SCRIPT_DRAFT 端点绑定，prompt 各自可配）。 */
    public static final String KEY_DRAMA_OUTLINE = "drama.outline";
    public static final String KEY_DRAMA_EPSCRIPT = "drama.epscript";
    public static final String KEY_DRAMA_SPLIT_SCENE = "drama.split_scene";
    public static final String KEY_DRAMA_CAST = "drama.cast";
    /** v0.72+: 分镜出图 / 出片提示词（图像 / 视频生成，单 prompt，无 system）。
     *  workbench=短剧工作台分镜；short=短视频工坊分镜。 */
    public static final String KEY_DRAMA_FRAME_IMAGE = "drama.frame_image";
    public static final String KEY_DRAMA_CLIP_VIDEO = "drama.clip_video";
    public static final String KEY_DRAMA_SHORT_FRAME_IMAGE = "drama.short_frame_image";
    public static final String KEY_DRAMA_SHORT_CLIP_VIDEO = "drama.short_clip_video";
    /** v0.85+: 视觉一致性中间件（移植自 ViMax 的参考注入思路，不引入其依赖）。
     *  ref_select=出图前从候选参考池里挑参考图 + 改写参考使用说明（文本 chat，复用 DRAMA_SCRIPT_DRAFT 端点）；
     *  character_portrait=角色定妆三视图（正/侧/背）生成（图像，单 prompt 无 system）。 */
    public static final String KEY_DRAMA_REF_SELECT = "drama.ref_select";
    public static final String KEY_DRAMA_CHARACTER_PORTRAIT = "drama.character_portrait";
    /** v0.73+: 把一部爆款短剧反向蒸馏成「可复用配方 Recipe」（抽 skill 飞轮）。 */
    public static final String KEY_DRAMA_RECIPE_EXTRACT = "drama.recipe_extract";
    /** v0.79+: 互动剧（剧情互动短剧，DramaProject 的形态）—— 一句话主题起草整张剧集分支图。
     *  各集视频仍走六阶段（drama.epscript / frame_image / clip_video），互动剧不另起出片提示词。 */
    public static final String KEY_DRAMA_INTERACTIVE_DRAFT = "drama.interactive_draft";
    /** v0.51+: 数字人资产平台（dap）各大模型调用点位（DapMultimodalClient / DapJobRunner）。 */
    public static final String KEY_DAP_PERSONA = "dap.persona";
    public static final String KEY_DAP_TRANSLATE_EDIT = "dap.translate_edit";
    public static final String KEY_DAP_IMAGE_GENERATE = "dap.image_generate";
    public static final String KEY_DAP_IMAGE_CLONE = "dap.image_clone";
    public static final String KEY_DAP_IMAGE_ITERATE = "dap.image_iterate";
    public static final String KEY_DAP_IMAGE_WARP = "dap.image_warp";
    public static final String KEY_DAP_IMAGE_LOOK = "dap.image_look";
    public static final String KEY_DAP_IMAGE_ATLAS = "dap.image_atlas";
    public static final String KEY_DAP_IMAGE_DERIV = "dap.image_deriv";
    public static final String KEY_DAP_VIDEO_ORBIT = "dap.video_orbit";

    /** admin 列表 / seeder 默认覆盖的已知 key（顺序即展示顺序）。 */
    public static final List<String> KNOWN_KEYS =
            List.of(KEY_SCRIPT_DRAFT, KEY_SELLING_POINTS, KEY_VARIABLE_EXTRACT, KEY_VIDEO_REF_ANALYSIS,
                    KEY_APPEARANCE_FORGE, KEY_DRAMA_SCRIPT_DRAFT,
                    KEY_DRAMA_OUTLINE, KEY_DRAMA_EPSCRIPT, KEY_DRAMA_SPLIT_SCENE, KEY_DRAMA_CAST,
                    KEY_DRAMA_FRAME_IMAGE, KEY_DRAMA_CLIP_VIDEO,
                    KEY_DRAMA_SHORT_FRAME_IMAGE, KEY_DRAMA_SHORT_CLIP_VIDEO,
                    KEY_DRAMA_REF_SELECT, KEY_DRAMA_CHARACTER_PORTRAIT,
                    KEY_DRAMA_RECIPE_EXTRACT,
                    KEY_DRAMA_INTERACTIVE_DRAFT,
                    KEY_DAP_PERSONA, KEY_DAP_TRANSLATE_EDIT, KEY_DAP_IMAGE_GENERATE, KEY_DAP_IMAGE_CLONE,
                    KEY_DAP_IMAGE_ITERATE, KEY_DAP_IMAGE_WARP, KEY_DAP_IMAGE_LOOK, KEY_DAP_IMAGE_ATLAS,
                    KEY_DAP_IMAGE_DERIV, KEY_DAP_VIDEO_ORBIT);

    /** 代码内最终兜底（resource 也缺失时）。故意通用，仅保证非空可降级。 */
    private static final String CODE_FALLBACK_SYSTEM =
            "你是一个严谨的中文助手。只输出符合要求的 JSON，不要任何解释或 markdown 代码块。";
    private static final String CODE_FALLBACK_USER = "{{input}}";

    private final PromptTemplateRepository repo;
    private final PromptTemplateVersionRepository versionRepo;
    private final AiModelEndpointRepository endpointRepo;
    private final AiModelInvocationService invocation;
    private final ObjectMapper om;

    private record CacheEntry(ResolvedPrompt prompt, long fetchedAt) {}
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public PromptService(PromptTemplateRepository repo,
                         PromptTemplateVersionRepository versionRepo,
                         AiModelEndpointRepository endpointRepo,
                         AiModelInvocationService invocation,
                         ObjectMapper om) {
        this.repo = repo;
        this.versionRepo = versionRepo;
        this.endpointRepo = endpointRepo;
        this.invocation = invocation;
        this.om = om;
    }

    /**
     * 解析结果：system / user 模板 + 调用参数（params 永不为 null）。
     * origin 标记主内容来源：db（运营落库）/ resource（.md 默认）/ code（最终兜底，视为「prompt 未配置」）。
     */
    public record ResolvedPrompt(String system, String userTemplate, PromptParamsDto params, String origin) {}

    /** promptKey ↔ AiModelPurpose 映射（文本三件）。 */
    public static String promptKeyFor(AiModelPurpose purpose) {
        return switch (purpose) {
            case SCRIPT_DRAFT -> KEY_SCRIPT_DRAFT;
            case SELLING_POINTS -> KEY_SELLING_POINTS;
            case VARIABLE_EXTRACT -> KEY_VARIABLE_EXTRACT;
            case VIDEO_REF_ANALYSIS -> KEY_VIDEO_REF_ANALYSIS;
            case APPEARANCE_FORGE -> KEY_APPEARANCE_FORGE;
            case DRAMA_SCRIPT_DRAFT -> KEY_DRAMA_SCRIPT_DRAFT;
            case DAP_PERSONA -> KEY_DAP_PERSONA;
            case DAP_IMAGE -> KEY_DAP_IMAGE_GENERATE;
            case DAP_VIDEO -> KEY_DAP_VIDEO_ORBIT;
            default -> "material." + purpose.wire().toLowerCase();
        };
    }

    // ── 解析（运行时调用方用） ─────────────────────────────────────────────────

    public ResolvedPrompt resolve(AiModelPurpose purpose) {
        return resolve(promptKeyFor(purpose));
    }

    public ResolvedPrompt resolve(String promptKey) {
        CacheEntry c = cache.get(promptKey);
        long now = System.currentTimeMillis();
        if (c != null && now - c.fetchedAt() < CACHE_TTL_MS) return c.prompt();
        ResolvedPrompt fresh = load(promptKey);
        cache.put(promptKey, new CacheEntry(fresh, now));
        return fresh;
    }

    private ResolvedPrompt load(String promptKey) {
        String[] resourceDefault = loadResource(promptKey); // [system, user] 或 null
        String resSystem = resourceDefault != null ? resourceDefault[0] : null;
        String resUser = resourceDefault != null ? resourceDefault[1] : null;

        String dbSystem = null, dbUser = null;
        PromptParamsDto dbParams = null;
        PromptTemplate row = repo.findByPromptKey(promptKey).filter(PromptTemplate::isEnabled).orElse(null);
        if (row != null) {
            dbSystem = row.getSystemPrompt();
            dbUser = row.getUserTemplate();
            dbParams = parseParams(row.getParamsJson());
        }

        String system = firstNonBlank(dbSystem, resSystem, CODE_FALLBACK_SYSTEM);
        String user = firstNonBlank(dbUser, resUser, CODE_FALLBACK_USER);
        PromptParamsDto params = dbParams != null
                ? dbParams
                : new PromptParamsDto(null, null, null); // 全 null → 各自取默认
        // origin：有 db 内容 → db；否则有 resource 内容 → resource；都没有 → code（视为未配置）
        boolean dbReal = (dbSystem != null && !dbSystem.isBlank()) || (dbUser != null && !dbUser.isBlank());
        boolean resReal = (resSystem != null && !resSystem.isBlank()) || (resUser != null && !resUser.isBlank());
        String origin = dbReal ? "db" : (resReal ? "resource" : "code");
        return new ResolvedPrompt(system, user, params, origin);
    }

    /** 读 classpath resources/prompts/material/&lt;key&gt;.md；按首个独占 "---" 行分隔。 */
    private String[] loadResource(String promptKey) {
        try {
            ClassPathResource res = new ClassPathResource(RESOURCE_DIR + promptKey + ".md");
            if (!res.exists()) return null;
            String raw;
            try (var in = res.getInputStream()) {
                raw = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
            return splitSystemUser(raw);
        } catch (Exception e) {
            log.warn("[prompt] load resource failed for {}: {}", promptKey, e.getMessage());
            return null;
        }
    }

    /** 把 .md 内容按首个独占 "---" 行拆成 [system, user]；无分隔则整块当 user。 */
    static String[] splitSystemUser(String raw) {
        if (raw == null) return null;
        String[] lines = raw.split("\n", -1);
        int sep = -1;
        for (int i = 0; i < lines.length; i++) {
            if (lines[i].strip().equals("---")) { sep = i; break; }
        }
        if (sep < 0) return new String[]{"", raw.strip()};
        StringBuilder sys = new StringBuilder();
        StringBuilder usr = new StringBuilder();
        for (int i = 0; i < sep; i++) sys.append(lines[i]).append('\n');
        for (int i = sep + 1; i < lines.length; i++) usr.append(lines[i]).append('\n');
        return new String[]{sys.toString().strip(), usr.toString().strip()};
    }

    private PromptParamsDto parseParams(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return om.readValue(json, PromptParamsDto.class);
        } catch (Exception e) {
            log.warn("[prompt] bad params json: {}", e.getMessage());
            return null;
        }
    }

    private static String firstNonBlank(String... vals) {
        for (String v : vals) if (v != null && !v.isBlank()) return v;
        return null;
    }

    // ── 占位符填充（纯字符串替换，不引模板引擎） ────────────────────────────────

    /** 把 {{key}} / {{ key }} 替换为 vars.get(key)；缺失的 key 替换为空串。 */
    public static String fill(String template, Map<String, String> vars) {
        if (template == null) return "";
        Map<String, String> safeVars = vars == null ? Map.of() : vars;
        Matcher matcher = VAR_PATTERN.matcher(template);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String value = safeVars.get(matcher.group(1));
            matcher.appendReplacement(out, Matcher.quoteReplacement(value == null ? "" : value));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    // ── seeder 支持 ────────────────────────────────────────────────────────────

    /** seeder 用：promptKey 不存在才插入 resource 默认（缺行才插，不覆盖运营改过的行）。 */
    public boolean seedIfAbsent(String promptKey) {
        if (repo.existsByPromptKey(promptKey)) return false;
        String[] def = loadResource(promptKey);
        if (def == null) {
            log.warn("[prompt] seed skip {}: resource default missing", promptKey);
            return false;
        }
        PromptTemplate row = PromptTemplate.builder()
                .id(UUID.randomUUID().toString())
                .promptKey(promptKey)
                .systemPrompt(def[0])
                .userTemplate(def[1])
                .paramsJson(null) // 用 PromptParamsDto 默认值
                .version(1)
                .enabled(true)
                .updatedAt(Instant.now())
                .updatedBy("seed")
                .build();
        repo.save(row);
        return true;
    }

    /**
     * seeder 推新基线用：仅当行仍是 seed 基线（version==1，运营没改过）时，用 resource 默认刷新
     * system/user，保持 version==1。运营改过的行（version&gt;1）不动。失效缓存。
     */
    public boolean reseedBaselineIfUntouched(String promptKey) {
        PromptTemplate row = repo.findByPromptKey(promptKey).orElse(null);
        if (row == null || row.getVersion() != 1) return false;
        String[] def = loadResource(promptKey);
        if (def == null) return false;
        row.setSystemPrompt(def[0]);
        row.setUserTemplate(def[1]);
        row.setUpdatedAt(Instant.now());
        row.setUpdatedBy("seed");
        repo.save(row); // version 保持 1
        cache.remove(promptKey);
        return true;
    }

    // ── admin CRUD ─────────────────────────────────────────────────────────────

    public List<PromptTemplateDto> listForAdmin() {
        // 已落库的 + 未落库但有 resource 默认的已知 key，都展示出来。
        Map<String, PromptTemplateDto> byKey = new LinkedHashMap<>();
        for (String key : KNOWN_KEYS) {
            repo.findByPromptKey(key).ifPresent(r -> byKey.put(key, toDto(r)));
            byKey.computeIfAbsent(key, this::virtualDefaultDto);
        }
        // 其它（非已知）已落库的 key 也带上
        for (PromptTemplate r : repo.findAll()) {
            byKey.putIfAbsent(r.getPromptKey(), toDto(r));
        }
        return new ArrayList<>(byKey.values());
    }

    public PromptTemplateDto getForAdmin(String promptKey) {
        return repo.findByPromptKey(promptKey)
                .map(this::toDto)
                .orElseGet(() -> {
                    PromptTemplateDto v = virtualDefaultDto(promptKey);
                    if (v == null) {
                        throw new BusinessException(HttpStatus.NOT_FOUND, "PROMPT_NOT_FOUND",
                                "prompt 不存在且无 resource 默认: " + promptKey);
                    }
                    return v;
                });
    }

    /** admin PUT：upsert 并立即失效缓存。version 自增。 */
    public PromptTemplateDto upsert(String promptKey, PromptTemplateUpsertDto in, String updatedBy) {
        if (promptKey == null || promptKey.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PROMPT_KEY_REQUIRED", "promptKey 必填");
        }
        PromptTemplate row = repo.findByPromptKey(promptKey).orElse(null);
        if (row == null) {
            // 新建时用 resource 默认填补未提供的字段
            String[] def = loadResource(promptKey);
            row = PromptTemplate.builder()
                    .id(UUID.randomUUID().toString())
                    .promptKey(promptKey)
                    .systemPrompt(def != null ? def[0] : "")
                    .userTemplate(def != null ? def[1] : "")
                    .version(0)
                    .enabled(true)
                    .build();
        }
        if (in.systemPrompt() != null) row.setSystemPrompt(in.systemPrompt());
        if (in.userTemplate() != null) row.setUserTemplate(in.userTemplate());
        if (in.params() != null) row.setParamsJson(writeParams(in.params()));
        if (in.enabled() != null) row.setEnabled(in.enabled());
        row.setVersion(row.getVersion() + 1);
        row.setUpdatedAt(Instant.now());
        row.setUpdatedBy(updatedBy == null ? "admin" : updatedBy);
        repo.save(row);
        saveVersion(row, row.getUpdatedBy(), in.changeNote());
        cache.remove(promptKey); // 立即失效
        return toDto(row);
    }

    /** admin 试运行：用样例参数 fill 出最终 messages（不真调模型）。 */
    public PromptDryRunDto dryRun(String promptKey, Map<String, String> sampleVars) {
        ResolvedPrompt p = resolve(promptKey);
        Map<String, String> vars = sampleVars == null ? Map.of() : sampleVars;
        String user = fill(p.userTemplate(), vars);
        List<String> variables = extractVariables(p.system(), p.userTemplate());
        return new PromptDryRunDto(promptKey, p.system(), user, p.params(),
                variables, missingVariables(variables, vars), vars);
    }

    /** admin 真试运行：填充模板后真实调一次模型。 */
    public PromptTestRunResultDto testRun(String promptKey, PromptTestRunRequestDto req) {
        PromptDryRunDto dry = dryRun(promptKey, req == null ? null : req.vars());
        AiModelPurpose purpose = purposeForPromptKey(promptKey);
        AiModelEndpoint endpoint = null;
        if (req != null && req.endpointId() != null && !req.endpointId().isBlank()) {
            endpoint = endpointRepo.findById(req.endpointId())
                    .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ENDPOINT_NOT_FOUND", "AI 模型端点不存在"));
        } else {
            endpoint = invocation.resolveEndpoint(purpose)
                    .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                            "未为该 Prompt 对应用途绑定可用端点"));
        }
        Map<String, Object> options = optionsFromParams(dry.params());
        AiModelInvocationService.AiModelResponse response = invocation.invokeChatOnEndpoint(
                endpoint,
                purpose,
                List.of(
                        Map.of("role", "system", "content", dry.system()),
                        Map.of("role", "user", "content", dry.user())
                ),
                options);
        return new PromptTestRunResultDto(
                dry.promptKey(), dry.system(), dry.user(), dry.params(),
                dry.variables(), dry.missingVariables(), dry.sampleVars(),
                response.content(), response.finishReason(), response.tokensUsed(),
                response.endpointUsed(), response.modelUsed());
    }

    public List<PromptTemplateVersionDto> versions(String promptKey) {
        return versionRepo.findByPromptKeyOrderByVersionDesc(promptKey).stream()
                .map(v -> PromptTemplateVersionDto.from(v, om))
                .toList();
    }

    public PromptTemplateDto rollback(String promptKey, int version, String updatedBy) {
        PromptTemplateVersion snapshot = versionRepo.findByPromptKeyAndVersion(promptKey, version)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "PROMPT_VERSION_NOT_FOUND",
                        "指定 Prompt 版本不存在"));
        PromptTemplate row = repo.findByPromptKey(promptKey).orElseGet(() -> PromptTemplate.builder()
                .id(UUID.randomUUID().toString())
                .promptKey(promptKey)
                .version(0)
                .enabled(true)
                .build());
        row.setSystemPrompt(snapshot.getSystemPrompt());
        row.setUserTemplate(snapshot.getUserTemplate());
        row.setParamsJson(snapshot.getParamsJson());
        row.setEnabled(snapshot.isEnabled());
        row.setVersion(row.getVersion() + 1);
        row.setUpdatedAt(Instant.now());
        row.setUpdatedBy(updatedBy == null ? "admin" : updatedBy);
        repo.save(row);
        saveVersion(row, row.getUpdatedBy(), "rollback to v" + version);
        cache.remove(promptKey);
        return toDto(row);
    }

    private PromptTemplateDto virtualDefaultDto(String promptKey) {
        String[] def = loadResource(promptKey);
        if (def == null) return null;
        List<String> variables = extractVariables(def[0], def[1]);
        return new PromptTemplateDto(
                null, promptKey, def[0], def[1],
                new PromptParamsDto(null, null, null),
                variables,
                0, true, null, "default");
    }

    private PromptTemplateDto toDto(PromptTemplate row) {
        return PromptTemplateDto.from(row, om, extractVariables(row.getSystemPrompt(), row.getUserTemplate()));
    }

    private void saveVersion(PromptTemplate row, String by, String note) {
        versionRepo.save(PromptTemplateVersion.builder()
                .id("ptv-" + UUID.randomUUID().toString().substring(0, 16))
                .promptKey(row.getPromptKey())
                .version(row.getVersion())
                .systemPrompt(row.getSystemPrompt())
                .userTemplate(row.getUserTemplate())
                .paramsJson(row.getParamsJson())
                .enabled(row.isEnabled())
                .createdAt(Instant.now())
                .createdBy(by == null ? "admin" : by)
                .changeNote(note)
                .build());
    }

    public static List<String> extractVariables(String... templates) {
        LinkedHashMap<String, Boolean> out = new LinkedHashMap<>();
        if (templates != null) {
            for (String template : templates) {
                if (template == null) continue;
                Matcher matcher = VAR_PATTERN.matcher(template);
                while (matcher.find()) out.put(matcher.group(1), Boolean.TRUE);
            }
        }
        return new ArrayList<>(out.keySet());
    }

    private static List<String> missingVariables(List<String> variables, Map<String, String> vars) {
        List<String> out = new ArrayList<>();
        for (String key : variables) {
            String value = vars.get(key);
            if (value == null || value.isBlank()) out.add(key);
        }
        return out;
    }

    private static Map<String, Object> optionsFromParams(PromptParamsDto params) {
        if (params == null) return Map.of();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("temperature", params.temperatureOrDefault());
        out.put("max_tokens", params.maxTokensOrDefault());
        if (params.jsonModeOrDefault()) {
            out.put("response_format", Map.of("type", "json_object"));
        }
        return out;
    }

    private static AiModelPurpose purposeForPromptKey(String promptKey) {
        if (promptKey == null) return AiModelPurpose.GENERAL;
        if (promptKey.startsWith("drama.")) return AiModelPurpose.DRAMA_SCRIPT_DRAFT;
        if (promptKey.startsWith("dap.video")) return AiModelPurpose.DAP_VIDEO;
        if (promptKey.startsWith("dap.image")) return AiModelPurpose.DAP_IMAGE;
        if (promptKey.startsWith("dap.")) return AiModelPurpose.DAP_PERSONA;
        if (promptKey.startsWith("appearance.")) return AiModelPurpose.APPEARANCE_FORGE;
        return switch (promptKey) {
            case KEY_SCRIPT_DRAFT -> AiModelPurpose.SCRIPT_DRAFT;
            case KEY_SELLING_POINTS -> AiModelPurpose.SELLING_POINTS;
            case KEY_VARIABLE_EXTRACT -> AiModelPurpose.VARIABLE_EXTRACT;
            case KEY_VIDEO_REF_ANALYSIS -> AiModelPurpose.VIDEO_REF_ANALYSIS;
            default -> AiModelPurpose.GENERAL;
        };
    }

    private String writeParams(PromptParamsDto params) {
        try {
            return om.writeValueAsString(params);
        } catch (Exception e) {
            return null;
        }
    }
}
