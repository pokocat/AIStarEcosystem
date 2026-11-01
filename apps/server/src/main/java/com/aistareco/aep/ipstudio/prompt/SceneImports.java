package com.aistareco.aep.ipstudio.prompt;

import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog;
import com.aistareco.aep.ipstudio.skill.IpSkillVersion;
import com.aistareco.aep.ipstudio.skill.StudioSkillStore;
import com.aistareco.aep.service.PlatformConfigService;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * 场景条目的切换导入（docs/studio-prompt-architecture.md §4.6、§5）。拿线上生效的场景目录（后台保存过的平台配置）和仓库里的
 * {@code ipstudio/scenes.json}（切换前的随包内容）逐个场景比创作文字：一样说明运营没改过，照常用仓库里的新条目；不一样就以线上
 * 内容作为这个场景条目的第一个版本（来源 {@code import}），之后仓库文件不再覆盖它，发布记录里要列出这些场景人工核对。
 */
@Component
public class SceneImports {
    private static final Logger log = LoggerFactory.getLogger(SceneImports.class);
    private static final ObjectMapper JSON = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
            .setSerializationInclusion(JsonInclude.Include.NON_NULL);

    private final ObjectProvider<PlatformConfigService> config;
    private final StudioSkillStore store;
    private volatile StudioSceneCatalog.Catalog repo;

    public SceneImports(ObjectProvider<PlatformConfigService> config, StudioSkillStore store) { this.config = config; this.store = store; }

    public Optional<StudioSkillStore.SeedFile> live(StudioPromptLibrary.Seed seed) {
        StudioPromptEntry entry = seed.entry();
        String id = entry.sceneId();
        PlatformConfigService service = config.getIfAvailable();
        if (id == null || service == null) return Optional.empty();
        var saved = service.findByKey(StudioSceneCatalog.CONFIG_KEY).orElse(null);
        if (saved == null || saved.value() == null || saved.value().path(StudioSceneCatalog.BUILT_IN_FIELD).asBoolean(false)) return Optional.empty();
        StudioSceneCatalog.Catalog live;
        try { live = JSON.treeToValue(saved.value(), StudioSceneCatalog.Catalog.class); }
        catch (Exception e) { log.error("[studio-prompt] 线上场景目录读不出来，场景条目照常用仓库内容：{}", e.getMessage()); return Optional.empty(); }
        StudioSceneCatalog.Catalog built = repo();
        String body;
        Map<String, Object> header = new LinkedHashMap<>(seed.header());
        if ("image".equals(header.get("sceneKind"))) {
            var now = live.image().stream().filter(s -> id.equals(s.id())).findFirst().orElse(null);
            var was = built.image().stream().filter(s -> id.equals(s.id())).findFirst().orElse(null);
            if (now == null || was == null || Objects.equals(strip(now.prompt()), strip(was.prompt()))) return Optional.empty();
            body = strip(now.prompt());
        } else {
            var now = live.video().stream().filter(s -> id.equals(s.id())).findFirst().orElse(null);
            var was = built.video().stream().filter(s -> id.equals(s.id())).findFirst().orElse(null);
            if (now == null || was == null) return Optional.empty();
            boolean same = Objects.equals(strip(now.structure()), strip(was.structure())) && Objects.equals(JSON.valueToTree(now.brief()), JSON.valueToTree(was.brief()));
            if (same) return Optional.empty();
            body = strip(now.structure());
            Map<String, Object> scene = new LinkedHashMap<>();
            if (now.brief() != null) scene.putAll(JSON.convertValue(now.brief(), Map.class));
            if (seed.entry().scene().get("avoid") != null) scene.put("avoid", seed.entry().scene().get("avoid"));
            header.put("scene", scene);
        }
        try { StudioPromptEntry.fromHeader(header, body, "import"); }
        catch (IllegalArgumentException e) {
            log.error("[studio-prompt] 场景 {} 的线上内容导入后不能通过校验（{}）；照常用仓库内容，请人工核对", id, e.getMessage());
            return Optional.empty();
        }
        log.warn("[studio-prompt] 场景 {} 在后台改过，按线上内容导入第一个版本，仓库里的新内容不会覆盖它；请人工核对是否换成新内容", id);
        return Optional.of(new StudioSkillStore.SeedFile(seed.file(), header, body, entry.key(), entry.name(), entry.status(), entry.summary(),
                store.digest(header, body), IpSkillVersion.SOURCE_IMPORT));
    }

    private StudioSceneCatalog.Catalog repo() {
        var r = repo;
        if (r == null) repo = r = StudioSceneCatalog.load("ipstudio/scenes.json");
        return r;
    }

    private static String strip(String s) { return s == null ? "" : s.strip(); }
}
