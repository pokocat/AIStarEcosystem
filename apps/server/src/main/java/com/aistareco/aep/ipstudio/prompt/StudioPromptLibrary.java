package com.aistareco.aep.ipstudio.prompt;

import com.aistareco.aep.ipstudio.skill.IpSkill;
import com.aistareco.aep.ipstudio.skill.IpSkillVersion;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.ipstudio.skill.StudioSkillStore;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * 提示词库（docs/studio-prompt-architecture.md §4）：底座、环节、内容方法、场景的当前版本，和制作做法同存
 * {@code ip_skill} / {@code ip_skill_version}，生效规则也完全一样 —— 仓库文件（{@code resources/studio/prompts/**}）是种子，
 * 库里没有就灌入；后台没动过的条目文件一变自动出新版本；后台发布、回滚、改状态之后以库为准；每个版本写入后不再修改。
 * 不再有 {@code SEED_VERSION}。
 *
 * <p><b>切换时导入</b>（§4.6）：种子文件声明了 {@code importFrom} 且库里还没有这个条目时，先问 {@link PromptImports}
 * 线上旧路径实际生效的内容；和仓库文件不同，就以线上内容作为第一个版本（来源 {@code import}），之后仓库文件不再覆盖它。
 *
 * <p>没有数据库的构造（单测、工具）直接读仓库文件。当前版本缓存 60 秒，多节点自然收敛；写入后本节点立即失效。
 */
@Component
public class StudioPromptLibrary {
    private static final Logger log = LoggerFactory.getLogger(StudioPromptLibrary.class);
    static final String LOCATION = "classpath*:studio/prompts/**/*.md";
    static final long CACHE_TTL_MS = 60_000L;

    /** 一个仓库文件：文件名、解析后的条目、原始文件头。 */
    public record Seed(String file, StudioPromptEntry entry, Map<String, Object> header) {}

    private record Cache(Map<String, StudioPromptEntry> entries, long loadedAt) {}

    private final StudioSkillStore store;
    private final PromptImports imports;
    private final Map<String, StudioPromptEntry> fixed;
    private volatile Cache cache;

    /** 只读仓库文件（单测、工具）。 */
    public StudioPromptLibrary() { this(loadSeeds().stream().collect(LinkedHashMap::new, (m, s) -> m.put(s.entry().key(), s.entry()), Map::putAll)); }

    /** 指定条目的只读库（测试、对照用）。 */
    public static StudioPromptLibrary of(Collection<StudioPromptEntry> entries) {
        Map<String, StudioPromptEntry> map = new LinkedHashMap<>();
        for (StudioPromptEntry e : entries) map.put(e.key(), e);
        return new StudioPromptLibrary(map);
    }

    StudioPromptLibrary(Map<String, StudioPromptEntry> entries) {
        this.store = null; this.imports = null;
        this.fixed = Collections.unmodifiableMap(new LinkedHashMap<>(entries));
    }

    @Autowired
    public StudioPromptLibrary(StudioSkillStore store, PromptImports imports) {
        this.store = store; this.imports = imports; this.fixed = null;
    }

    @PostConstruct
    void seedRepositoryFiles() {
        if (store == null) return;
        Set<String> workflowKeys = new HashSet<>();
        for (var seed : StudioSkillCatalog.loadSeedFiles()) workflowKeys.add(seed);
        List<StudioSkillStore.SeedFile> files = new ArrayList<>();
        Set<String> stored = new HashSet<>();
        store.skills().findAll().forEach(row -> stored.add(row.getSkillKey()));
        for (Seed seed : loadSeeds()) {
            StudioPromptEntry e = seed.entry();
            if (workflowKeys.contains(e.key())) throw new IllegalStateException("提示词库条目 " + e.key() + " 和制作做法同名（" + seed.file() + "）");
            StudioSkillStore.SeedFile file = new StudioSkillStore.SeedFile(seed.file(), seed.header(), e.body(), e.key(), e.name(), e.status(),
                    e.summary(), e.digest(), IpSkillVersion.SOURCE_SEED);
            if (!stored.contains(e.key()) && e.importFrom() != null && imports != null) {
                var live = imports.live(seed);
                if (live.isPresent()) file = live.get();
            }
            files.add(file);
        }
        store.seedFiles(files);
        invalidate();
    }

    // ── 读 ─────────────────────────────────────────────────────────────────────────────────────────────────────

    private Map<String, StudioPromptEntry> entries() {
        if (store == null) return fixed;
        Cache current = cache;
        if (current != null && System.currentTimeMillis() - current.loadedAt() < CACHE_TTL_MS) return current.entries();
        synchronized (this) {
            current = cache;
            if (current != null && System.currentTimeMillis() - current.loadedAt() < CACHE_TTL_MS) return current.entries();
            try {
                current = new Cache(Collections.unmodifiableMap(loadCurrent()), System.currentTimeMillis());
            } catch (RuntimeException e) {
                if (current == null) throw e;
                log.warn("[studio-prompt] reload failed, serving the cached library: {}", e.toString());
                return current.entries();
            }
            cache = current;
            return current.entries();
        }
    }

    private Map<String, StudioPromptEntry> loadCurrent() {
        Map<String, StudioPromptEntry> out = new LinkedHashMap<>();
        for (var current : store.currentRows()) {
            if (store.isWorkflow(current.version())) continue;
            try { out.put(current.row().getSkillKey(), toEntry(current.version(), current.row().getStatus(), true)); }
            catch (IllegalArgumentException e) {
                log.error("[studio-prompt] {} v{} no longer validates ({}); unavailable until an admin publishes a valid version",
                        current.row().getSkillKey(), current.row().getCurrentVersion(), e.getMessage());
            }
        }
        return out;
    }

    /** 版本行 → 条目；{@code strict = false} 只用于读冻结在任务里的旧版本。 */
    public StudioPromptEntry toEntry(IpSkillVersion row, String status, boolean strict) {
        Map<String, Object> header = store.header(row.getFrontmatterJson());
        header.put("version", row.getVersion());
        header.put("status", status);
        return StudioPromptEntry.fromHeader(header, row.getBodyMd(), row.getContentDigest(), strict);
    }

    /** 当前版本（任何状态）。 */
    public Optional<StudioPromptEntry> find(String key) { return key == null ? Optional.empty() : Optional.ofNullable(entries().get(key)); }

    /** 新的生成要用的条目：存在且没停用。 */
    public StudioPromptEntry require(String key) {
        var entry = find(key).orElseThrow(() -> new IllegalStateException("提示词库缺少条目 " + key));
        if (entry.withdrawn()) throw new IllegalStateException("提示词库条目 " + key + " 已停用");
        return entry;
    }

    /** 指定版本（冻结在任务里的版本）；当前版本直接取缓存。 */
    public Optional<StudioPromptEntry> version(String key, int version) {
        var current = find(key);
        if (current.isPresent() && current.get().version() == version) return current;
        if (store == null) return Optional.empty();
        var row = store.versions().findBySkillKeyAndVersion(key, version).orElse(null);
        if (row == null) return Optional.empty();
        String status = store.skills().findById(key).map(IpSkill::getStatus).orElse(IpSkill.ACTIVE);
        try { return Optional.of(toEntry(row, status, false)); }
        catch (IllegalArgumentException e) { log.warn("[studio-prompt] {} v{} does not parse: {}", key, version, e.getMessage()); return Optional.empty(); }
    }

    /** 某一层的全部当前条目（后台列表、按场景找内容方法）。 */
    public List<StudioPromptEntry> layer(String layer) {
        return entries().values().stream().filter(e -> e.layer().equals(layer)).toList();
    }

    public void invalidate() {
        Cache current = cache;
        cache = current == null ? null : new Cache(current.entries(), 0L);
    }

    public void invalidateAfterCommit() {
        if (TransactionSynchronizationManager.isSynchronizationActive())
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { invalidate(); }
            });
        else invalidate();
    }

    // ── 仓库文件 ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** 全部仓库文件，严格解析；格式不对或重名直接让启动失败（AGENTS §8.0）。 */
    public static List<Seed> loadSeeds() {
        List<Seed> out = new ArrayList<>();
        Set<String> keys = new HashSet<>();
        Resource[] resources;
        try { resources = new PathMatchingResourcePatternResolver().getResources(LOCATION); }
        catch (java.io.IOException e) { throw new IllegalStateException("Studio prompt files cannot be listed", e); }
        Arrays.sort(resources, Comparator.comparing(r -> String.valueOf(r.getFilename())));
        for (Resource resource : resources) {
            String raw;
            try (var in = resource.getInputStream()) { raw = new String(in.readAllBytes(), StandardCharsets.UTF_8); }
            catch (java.io.IOException e) { throw new IllegalStateException("Studio prompt file unreadable: " + resource.getFilename(), e); }
            StudioSkillCatalog.SplitFile split;
            StudioPromptEntry entry;
            try {
                split = StudioSkillCatalog.splitFile(raw);
                entry = StudioPromptEntry.fromHeader(split.header(), split.body(), split.digest());
            } catch (IllegalArgumentException e) {
                throw new IllegalStateException("Studio prompt file " + resource.getFilename() + " is invalid: " + e.getMessage(), e);
            }
            if (!keys.add(entry.key())) throw new IllegalStateException("Duplicate studio prompt key " + entry.key() + " in " + resource.getFilename());
            out.add(new Seed(resource.getFilename(), entry, split.header()));
        }
        return out;
    }
}
