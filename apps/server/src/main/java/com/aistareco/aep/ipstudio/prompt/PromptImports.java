package com.aistareco.aep.ipstudio.prompt;

import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.ipstudio.skill.IpSkillVersion;
import com.aistareco.aep.ipstudio.skill.StudioSkillStore;
import com.aistareco.aep.service.PromptService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * 切换时导入线上实际在用的内容（docs/studio-prompt-architecture.md §4.6）。只在库里还没有这个条目时用一次：
 * 旧路径生效的内容和仓库里的旧文件一样，就照常灌种子；不一样（运营在后台改过），以线上内容作为第一个版本，
 * 来源记 {@code import}，之后仓库文件不再覆盖它。
 *
 * <p>旧 Prompt 管理（{@code importFrom: <prompt key>}）：搬家阶段环节正文逐字包含旧文件的 system / user，导入时把这两段换成
 * {@link PromptService#resolve} 的结果（库里启用的行优先、空字段逐项回退到文件），参数换成线上的 {@code params_json}。
 * 环节内容已经改过、正文里找不到旧文字时没法自动合并：照常灌新内容，打 ERROR 日志，发布前用线上库副本核对时会看到。
 *
 * <p>场景（{@code importFrom: scene-catalog}）由 {@link SceneImports} 处理。
 */
@Component
public class PromptImports {
    private static final Logger log = LoggerFactory.getLogger(PromptImports.class);
    public static final String SCENE_CATALOG = "scene-catalog";

    private final PromptService prompts;
    private final StudioSkillStore store;
    private final ObjectProvider<SceneImports> scenes;

    public PromptImports(PromptService prompts, StudioSkillStore store, ObjectProvider<SceneImports> scenes) {
        this.prompts = prompts; this.store = store; this.scenes = scenes;
    }

    /** 需要导入时返回要写入的第一个版本；不需要（线上和仓库一样，或没有可导入的来源）返回空。 */
    public Optional<StudioSkillStore.SeedFile> live(StudioPromptLibrary.Seed seed) {
        StudioPromptEntry entry = seed.entry();
        String from = entry.importFrom();
        if (from == null) return Optional.empty();
        if (SCENE_CATALOG.equals(from)) {
            SceneImports s = scenes.getIfAvailable();
            return s == null ? Optional.empty() : s.live(seed);
        }
        if (!entry.stage()) return Optional.empty();
        return fromPromptTable(seed, from);
    }

    private Optional<StudioSkillStore.SeedFile> fromPromptTable(StudioPromptLibrary.Seed seed, String key) {
        String[] repo = PromptService.resourceDefault(key);
        PromptService.ResolvedPrompt live = prompts.resolve(key);
        if (repo == null || live == null || "code".equals(live.origin())) return Optional.empty();
        String liveSystem = live.system() == null ? "" : live.system().strip(), liveUser = live.userTemplate() == null ? "" : live.userTemplate().strip();
        boolean sameText = repo[0].equals(liveSystem) && repo[1].equals(liveUser);
        Map<String, Object> liveParams = params(live.params());
        boolean sameParams = liveParams.isEmpty() || Objects.equals(liveParams, params(seed.entry().params()));
        if (sameText && sameParams) return Optional.empty();
        String body = seed.entry().body();
        if (!sameText) {
            // 只要求改了的那一段还在仓库正文里：运营只改了 system，user 那段即使环节已经换了写法也不影响导入
            boolean systemChanged = !repo[0].equals(liveSystem), userChanged = !repo[1].equals(liveUser);
            boolean hasSystem = !systemChanged || repo[0].isEmpty() || body.contains(repo[0]);
            boolean hasUser = !userChanged || repo[1].isEmpty() || body.contains(repo[1]);
            if (!hasSystem || !hasUser) {
                log.error("[studio-prompt] {} 线上 Prompt 管理里的「{}」被改过，但仓库里的环节已经换了内容，没法自动合并；照常使用仓库内容，请人工核对",
                        seed.entry().key(), key);
                return Optional.empty();
            }
            if (systemChanged && !repo[0].isEmpty()) body = body.replace(repo[0], liveSystem);
            if (userChanged && !repo[1].isEmpty()) body = body.replace(repo[1], liveUser);
        }
        Map<String, Object> header = new LinkedHashMap<>(seed.header());
        if (!sameParams) header.put("params", liveParams);
        try { StudioPromptEntry.fromHeader(header, body, "import"); }
        catch (IllegalArgumentException e) {
            log.error("[studio-prompt] {} 导入线上「{}」后不能通过校验（{}）；照常使用仓库内容，请人工核对", seed.entry().key(), key, e.getMessage());
            return Optional.empty();
        }
        log.warn("[studio-prompt] {} 按线上 Prompt 管理「{}」导入第一个版本（文字{}，参数{}），之后仓库文件不再覆盖它",
                seed.entry().key(), key, sameText ? "相同" : "不同", sameParams ? "相同" : "不同");
        return Optional.of(new StudioSkillStore.SeedFile(seed.file(), header, body, seed.entry().key(), seed.entry().name(), seed.entry().status(),
                seed.entry().summary(), store.digest(header, body), IpSkillVersion.SOURCE_IMPORT));
    }

    /** 非空的参数项，按文件头的写法（temperature / maxTokens / jsonMode）。 */
    static Map<String, Object> params(PromptParamsDto p) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (p == null) return out;
        if (p.temperature() != null) out.put("temperature", p.temperature());
        if (p.maxTokens() != null) out.put("maxTokens", p.maxTokens());
        if (p.jsonMode() != null) out.put("jsonMode", p.jsonMode());
        return out;
    }

    /** 测试用：哪些导入来源是旧 Prompt 管理的 key。 */
    static List<String> promptKeys(List<StudioPromptLibrary.Seed> seeds) {
        return seeds.stream().map(s -> s.entry().importFrom()).filter(f -> f != null && !SCENE_CATALOG.equals(f)).toList();
    }
}
