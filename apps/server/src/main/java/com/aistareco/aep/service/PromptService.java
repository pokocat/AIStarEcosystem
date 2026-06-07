package com.aistareco.aep.service;

import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.dto.PromptTemplateDto;
import com.aistareco.aep.dto.PromptTemplateUpsertDto;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.PromptTemplate;
import com.aistareco.aep.repository.PromptTemplateRepository;
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
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

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

    /** 素材运营文本三件的标准 promptKey（与 AiModelPurpose 对齐）。 */
    public static final String KEY_SCRIPT_DRAFT = "material.script_draft";
    public static final String KEY_SELLING_POINTS = "material.selling_points";
    public static final String KEY_VARIABLE_EXTRACT = "material.variable_extract";
    public static final String KEY_VIDEO_REF_ANALYSIS = "material.video_ref_analysis";
    /** v0.43+: 形象锻造对话（music/drama 形象顾问）。 */
    public static final String KEY_APPEARANCE_FORGE = "appearance.forge";
    /** v0.43+: 短剧脚本起草（drama 短剧生成）。 */
    public static final String KEY_DRAMA_SCRIPT_DRAFT = "drama.script_draft";
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
                    KEY_DAP_PERSONA, KEY_DAP_TRANSLATE_EDIT, KEY_DAP_IMAGE_GENERATE, KEY_DAP_IMAGE_CLONE,
                    KEY_DAP_IMAGE_ITERATE, KEY_DAP_IMAGE_WARP, KEY_DAP_IMAGE_LOOK, KEY_DAP_IMAGE_ATLAS,
                    KEY_DAP_IMAGE_DERIV, KEY_DAP_VIDEO_ORBIT);

    /** 代码内最终兜底（resource 也缺失时）。故意通用，仅保证非空可降级。 */
    private static final String CODE_FALLBACK_SYSTEM =
            "你是一个严谨的中文助手。只输出符合要求的 JSON，不要任何解释或 markdown 代码块。";
    private static final String CODE_FALLBACK_USER = "{{input}}";

    private final PromptTemplateRepository repo;
    private final ObjectMapper om;

    private record CacheEntry(ResolvedPrompt prompt, long fetchedAt) {}
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public PromptService(PromptTemplateRepository repo, ObjectMapper om) {
        this.repo = repo;
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

    /** 把 {{key}} 替换为 vars.get(key)；缺失的 key 替换为空串。 */
    public static String fill(String template, Map<String, String> vars) {
        if (template == null) return "";
        String out = template;
        for (Map.Entry<String, String> e : vars.entrySet()) {
            out = out.replace("{{" + e.getKey() + "}}", e.getValue() == null ? "" : e.getValue());
        }
        return out;
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
            repo.findByPromptKey(key).ifPresent(r -> byKey.put(key, PromptTemplateDto.from(r, om)));
            byKey.computeIfAbsent(key, this::virtualDefaultDto);
        }
        // 其它（非已知）已落库的 key 也带上
        for (PromptTemplate r : repo.findAll()) {
            byKey.putIfAbsent(r.getPromptKey(), PromptTemplateDto.from(r, om));
        }
        return new ArrayList<>(byKey.values());
    }

    public PromptTemplateDto getForAdmin(String promptKey) {
        return repo.findByPromptKey(promptKey)
                .map(r -> PromptTemplateDto.from(r, om))
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
        cache.remove(promptKey); // 立即失效
        return PromptTemplateDto.from(row, om);
    }

    /** admin 试运行：用样例参数 fill 出最终 messages（不真调模型）。 */
    public Map<String, Object> dryRun(String promptKey, Map<String, String> sampleVars) {
        ResolvedPrompt p = resolve(promptKey);
        String user = fill(p.userTemplate(), sampleVars == null ? Map.of() : sampleVars);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("promptKey", promptKey);
        out.put("system", p.system());
        out.put("user", user);
        out.put("params", p.params());
        return out;
    }

    private PromptTemplateDto virtualDefaultDto(String promptKey) {
        String[] def = loadResource(promptKey);
        if (def == null) return null;
        return new PromptTemplateDto(
                null, promptKey, def[0], def[1],
                new PromptParamsDto(null, null, null),
                0, true, null, "default");
    }

    private String writeParams(PromptParamsDto params) {
        try {
            return om.writeValueAsString(params);
        } catch (Exception e) {
            return null;
        }
    }
}
