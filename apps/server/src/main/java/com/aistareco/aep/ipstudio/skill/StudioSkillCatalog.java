package com.aistareco.aep.ipstudio.skill;

import com.aistareco.aep.ipstudio.dto.StudioSkillDtos.SkillSummary;
import com.aistareco.common.BusinessException;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Runtime catalog of Studio skills (docs/ip-studio-conversational-video-recreation-plan.md §文件和版本 / §第三阶段 S3).
 *
 * <p><b>S3: DB-backed, repository files are seeds.</b> At startup every {@code resources/studio/skills/*.md} is seeded into
 * {@code ip_skill / ip_skill_version} if absent ({@link StudioSkillStore#seed}). A seeded skill nobody has touched in admin
 * (only seed versions published, row last written by the seed) is re-seeded as a new immutable version when the file
 * changes; once an admin has published, rolled back, published a draft or changed the status, the DB wins and the file is
 * ignored. The current version of each skill is cached in memory (60 s TTL, so other nodes converge) and invalidated
 * after every committed write on this node. Without a store (unit tests) the catalog serves the classpath files as is.
 *
 * <p>Parsing is strict on purpose. A header that fails to parse, names an unknown stage/operation, lets a stage exceed the
 * plan contract (analysis ⊆ recreation|text, production ⊆ text|image|video|check|assemble) or lists autoFixChecks outside
 * checks is rejected whole. The service refuses to start on such a seed file (fail-fast, AGENTS §8.0) and admin writes are
 * refused with 400 {@code STUDIO_SKILL_INVALID}: a broken header must never silently read as a wider or narrower
 * permission. Method examples are explanatory only and never a whitelist; {@code triggers} are routing hints only.
 *
 * <p>Status: {@code active} skills are offered for new selection (list, routing, explicit choice on a new thread);
 * {@code draft} skills are visible in admin only, but threads already bound to one keep working; {@code withdrawn} blocks
 * new turns, plans and executions ({@link #requireForNewWork}). Accepted work keeps its own snapshot either way.
 */
@Component
public class StudioSkillCatalog {
    private static final Logger log = LoggerFactory.getLogger(StudioSkillCatalog.class);
    static final String LOCATION = "classpath*:studio/skills/*.md";
    static final long CACHE_TTL_MS = 60_000L;
    private static final Pattern KEY = Pattern.compile("[a-z0-9][a-z0-9-]{0,63}");
    private static final Pattern CHECK_ID = Pattern.compile("[a-z0-9][a-z0-9-]{0,63}");
    static final Set<String> STATUSES = Set.of("active", "draft", "withdrawn");
    private static final Map<String, Set<String>> STAGE_OPERATIONS = Map.of(
            StudioSkill.ANALYSIS, Set.of("recreation", "text"),
            StudioSkill.PRODUCTION, Set.of("text", "image", "video", "check", "assemble"));
    private static final Set<String> HEADER_FIELDS = Set.of("key", "name", "version", "status", "planning", "summary",
            "methodExamples", "operations", "limits", "checks", "autoFixChecks", "requiredCapabilities", "triggers");
    private static final Set<String> LIMIT_FIELDS = Set.of("maxSourceSec", "maxSegments", "maxSegmentSec", "maxSteps", "maxAutoFixPerSegment");
    static final Set<String> TRIGGER_MEDIA = Set.of("video", "image", "audio", "text");

    /** One repository seed file: its name, normalized text, parsed header and the parsed skill. */
    public record Seed(String file, String text, Map<String, Object> header, String body, StudioSkill skill) {}

    /** A parsed skill file: header (as loaded from YAML), body and the validated skill. */
    public record ParsedFile(Map<String, Object> header, String body, StudioSkill skill) {}

    private record Cache(Map<String, StudioSkill> skills, long loadedAt) {}

    private final StudioSkillStore store;
    private final Map<String, StudioSkill> fixed;
    private volatile Cache cache;

    /** Classpath-only catalog (unit tests and tools): serves the repository files, no DB. */
    public StudioSkillCatalog() { this(loadClasspathSkills()); }

    StudioSkillCatalog(Map<String, StudioSkill> skills) {
        this.store = null;
        this.fixed = Collections.unmodifiableMap(new LinkedHashMap<>(skills));
    }

    /** The application catalog: DB-backed, seeded from the repository files at startup. */
    @Autowired
    public StudioSkillCatalog(StudioSkillStore store) {
        this.store = store;
        this.fixed = null;
    }

    @PostConstruct
    void seedRepositoryFiles() {
        if (store == null) return;
        store.seed(loadSeeds()); // fail-fast on an invalid seed file (startup refuses), like the S1/S2 file loader
        invalidate();
    }

    private Map<String, StudioSkill> skills() {
        if (store == null) return fixed;
        Cache current = cache;
        long now = System.currentTimeMillis();
        if (current != null && now - current.loadedAt() < CACHE_TTL_MS) return current.skills();
        synchronized (this) {
            current = cache;
            if (current != null && System.currentTimeMillis() - current.loadedAt() < CACHE_TTL_MS) return current.skills();
            try {
                current = new Cache(Collections.unmodifiableMap(new LinkedHashMap<>(store.loadCurrent())), System.currentTimeMillis());
            } catch (RuntimeException e) {
                if (current == null) throw e;
                // Availability over freshness: keep serving the last loaded versions and retry on the next read.
                log.warn("[studio-skill] reload failed, serving the cached catalog: {}", e.toString());
                return current.skills();
            }
            cache = current;
            return current.skills();
        }
    }

    /** Mark the cached current versions stale; the next read reloads from the DB (and keeps them only if that read fails). */
    public void invalidate() {
        Cache current = cache;
        cache = current == null ? null : new Cache(current.skills(), 0L);
    }

    /** Invalidate once the caller's transaction commits (immediately when there is none). */
    public void invalidateAfterCommit() {
        if (TransactionSynchronizationManager.isSynchronizationActive())
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { invalidate(); }
            });
        else invalidate();
    }

    /** Skills offered for new selection: active ones, in key order. */
    public List<SkillSummary> list() {
        return available().stream().map(StudioSkill::summaryDto).toList();
    }

    /** Active skills (offered for routing, explicit choice and the dialogue's skill list). */
    public List<StudioSkill> available() { return skills().values().stream().filter(StudioSkill::active).toList(); }

    /** Lookup for display or for settling already accepted work; any status, current version. */
    public Optional<StudioSkill> find(String key) { return key == null ? Optional.empty() : Optional.ofNullable(skills().get(key)); }

    /** New turns, plans and executions on work already bound to a skill need one that is not withdrawn. Never freezes anything. */
    public StudioSkill requireForNewWork(String key) {
        var skill = find(key).orElseThrow(StudioSkillCatalog::notFound);
        if (skill.withdrawn()) throw notFound();
        return skill;
    }

    /** Choosing a skill for a thread that has none yet (explicit key, read_skill, routing): only active skills. */
    public StudioSkill requireForNewSelection(String key) {
        var skill = find(key).orElseThrow(StudioSkillCatalog::notFound);
        if (!skill.active()) throw notFound();
        return skill;
    }

    /**
     * Any stored version (drafts included) as a skill, for admin views, diffs and dry-runs. Execution snapshots already
     * carry their own content; this never feeds new work by itself. Status is the version's own row view: the skill's
     * runtime status for the current version, otherwise {@code draft} for drafts and the skill status for history.
     */
    public Optional<StudioSkill> snapshotFor(String key, int version) {
        if (key == null) return Optional.empty();
        if (store == null) return Optional.ofNullable(fixed.get(key)).filter(s -> s.version() == version);
        return store.version(key, version);
    }

    public static BusinessException notFound() {
        return new BusinessException(HttpStatus.NOT_FOUND, "STUDIO_SKILL_NOT_FOUND", "这个制作方法不存在或已停用，请换一种做法");
    }

    private static Map<String, StudioSkill> loadClasspathSkills() {
        Map<String, StudioSkill> out = new LinkedHashMap<>();
        for (Seed seed : loadSeeds()) out.put(seed.skill().key(), seed.skill());
        return out;
    }

    /** Every repository skill file, parsed strictly; a broken or duplicate file stops startup. */
    static List<Seed> loadSeeds() {
        List<Seed> out = new ArrayList<>();
        Set<String> keys = new HashSet<>();
        Resource[] resources;
        try { resources = new PathMatchingResourcePatternResolver().getResources(LOCATION); }
        catch (java.io.IOException e) { throw new IllegalStateException("Studio skill files cannot be listed", e); }
        Arrays.sort(resources, Comparator.comparing(r -> String.valueOf(r.getFilename())));
        for (Resource resource : resources) {
            String raw;
            try (var in = resource.getInputStream()) { raw = new String(in.readAllBytes(), StandardCharsets.UTF_8); }
            catch (java.io.IOException e) { throw new IllegalStateException("Studio skill file unreadable: " + resource.getFilename(), e); }
            ParsedFile parsed;
            try { parsed = parseFile(raw); }
            catch (IllegalArgumentException e) {
                throw new IllegalStateException("Studio skill file " + resource.getFilename() + " is invalid: " + e.getMessage(), e);
            }
            StudioSkill skill = parsed.skill();
            if (!keys.add(skill.key()))
                throw new IllegalStateException("Duplicate studio skill key " + skill.key() + " in " + resource.getFilename());
            log.info("[studio-skill] repository file key={} version={} status={} digest={}", skill.key(), skill.version(), skill.status(), skill.digest().substring(0, 12));
            out.add(new Seed(resource.getFilename(), raw.replace("\r\n", "\n"), parsed.header(), parsed.body(), skill));
        }
        return out;
    }

    /** Parse one skill file. Throws {@link IllegalArgumentException} with a specific reason on any header problem. */
    public static StudioSkill parse(String text) { return parseFile(text).skill(); }

    /** Parse one skill file and keep its header map and body (for seeding and admin create). */
    public static ParsedFile parseFile(String text) {
        if (text == null) throw new IllegalArgumentException("empty file");
        String normalized = text.replace("\r\n", "\n");
        if (!normalized.startsWith("---\n")) throw new IllegalArgumentException("missing YAML front matter");
        int end = normalized.indexOf("\n---", 3);
        if (end < 0) throw new IllegalArgumentException("unterminated YAML front matter");
        int bodyStart = normalized.indexOf('\n', end + 1);
        String header = normalized.substring(4, end + 1);
        String body = bodyStart < 0 ? "" : normalized.substring(bodyStart + 1).strip();
        Map<String, Object> map = loadYamlHeader(header);
        return new ParsedFile(map, body, fromHeader(map, body, digest(normalized)));
    }

    /** YAML front matter text (without the {@code ---} fences) as a mapping; SafeConstructor, no custom types. */
    public static Map<String, Object> loadYamlHeader(String header) {
        Object loaded;
        try { loaded = new Yaml(new SafeConstructor(new LoaderOptions())).load(header == null ? "" : header); }
        catch (RuntimeException e) { throw new IllegalArgumentException("YAML header does not parse: " + e.getMessage()); }
        if (!(loaded instanceof Map<?, ?> map)) throw new IllegalArgumentException("header is not a mapping");
        Map<String, Object> out = new LinkedHashMap<>();
        map.forEach((k, v) -> out.put(String.valueOf(k), v));
        return out;
    }

    /**
     * Validate a header mapping plus Markdown body into a skill. The single place every rule lives: repository files,
     * admin publishes, rollbacks, drafts and DB loads all pass through here, so no path can be looser than another.
     */
    public static StudioSkill fromHeader(Map<String, ?> map, String body, String digest) {
        if (body == null || body.isBlank()) throw new IllegalArgumentException("method body is empty");
        body = body.strip();
        if (body.length() > 64000) throw new IllegalArgumentException("method body too long (max 64000 characters)");
        for (Object field : map.keySet())
            if (!HEADER_FIELDS.contains(String.valueOf(field))) throw new IllegalArgumentException("unknown header field " + field);

        String key = string(map.get("key"), "key", 64);
        if (!KEY.matcher(key).matches()) throw new IllegalArgumentException("invalid key");
        String name = string(map.get("name"), "name", 64);
        int version = integer(map.get("version"), "version");
        if (version < 1) throw new IllegalArgumentException("version must be >= 1");
        String status = string(map.get("status"), "status", 16);
        if (!STATUSES.contains(status)) throw new IllegalArgumentException("invalid status " + status);
        if (!"dynamic".equals(map.get("planning"))) throw new IllegalArgumentException("planning must be dynamic");
        String summary = map.get("summary") == null ? "" : string(map.get("summary"), "summary", 500);
        List<String> methodExamples = map.get("methodExamples") == null ? List.of() : list(map.get("methodExamples"), "methodExamples", null);

        if (!(map.get("operations") instanceof Map<?, ?> ops)) throw new IllegalArgumentException("operations missing");
        Map<String, List<String>> operations = new LinkedHashMap<>();
        for (var entry : ops.entrySet()) {
            String stage = String.valueOf(entry.getKey());
            Set<String> allowed = STAGE_OPERATIONS.get(stage);
            if (allowed == null) throw new IllegalArgumentException("unknown stage " + stage);
            List<String> list = list(entry.getValue(), "operations." + stage, null);
            for (String op : list) if (!allowed.contains(op)) throw new IllegalArgumentException("operation " + op + " is not allowed in stage " + stage);
            operations.put(stage, List.copyOf(list));
        }
        for (String stage : STAGE_OPERATIONS.keySet())
            if (!operations.containsKey(stage)) throw new IllegalArgumentException("operations." + stage + " missing");

        if (!(map.get("limits") instanceof Map<?, ?> limits)) throw new IllegalArgumentException("limits missing");
        for (Object field : limits.keySet())
            if (!LIMIT_FIELDS.contains(String.valueOf(field))) throw new IllegalArgumentException("unknown limit " + field);
        int maxSourceSec = integer(limits.get("maxSourceSec"), "limits.maxSourceSec");
        if (maxSourceSec < 1 || maxSourceSec > 3600) throw new IllegalArgumentException("limits.maxSourceSec out of range");
        int maxSegments = integer(limits.get("maxSegments"), "limits.maxSegments");
        if (maxSegments < 1 || maxSegments > 16) throw new IllegalArgumentException("limits.maxSegments out of range");
        Object rawSegmentSec = limits.get("maxSegmentSec");
        Object maxSegmentSec;
        if ("model".equals(rawSegmentSec)) maxSegmentSec = "model";
        else if (rawSegmentSec instanceof Integer n && n > 0 && n <= 600) maxSegmentSec = n;
        else throw new IllegalArgumentException("limits.maxSegmentSec must be a positive integer or \"model\"");
        int maxAutoFix = limits.get("maxAutoFixPerSegment") == null ? 0 : integer(limits.get("maxAutoFixPerSegment"), "limits.maxAutoFixPerSegment");
        if (maxAutoFix < 0 || maxAutoFix > 10) throw new IllegalArgumentException("limits.maxAutoFixPerSegment out of range");
        Object rawSteps = limits.get("maxSteps");
        int maxSteps;
        if (rawSteps instanceof Integer n) maxSteps = n;
        else if (rawSteps instanceof String expression)
            maxSteps = StudioSkillExpression.evaluate(expression, Map.of("maxSourceSec", maxSourceSec, "maxSegments", maxSegments, "maxAutoFixPerSegment", maxAutoFix));
        else throw new IllegalArgumentException("limits.maxSteps must be an integer or an expression");
        if (maxSteps < 1 || maxSteps > 64) throw new IllegalArgumentException("limits.maxSteps out of range");

        List<String> checks = list(map.get("checks"), "checks", CHECK_ID);
        if (checks.isEmpty()) throw new IllegalArgumentException("checks must not be empty");
        List<String> autoFixChecks = map.get("autoFixChecks") == null ? List.of() : list(map.get("autoFixChecks"), "autoFixChecks", CHECK_ID);
        if (!new HashSet<>(checks).containsAll(autoFixChecks)) throw new IllegalArgumentException("autoFixChecks must be a subset of checks");
        List<String> capabilities = map.get("requiredCapabilities") == null ? List.of() : list(map.get("requiredCapabilities"), "requiredCapabilities", null);
        StudioSkill.Triggers triggers = triggers(map.get("triggers"));

        return new StudioSkill(key, name, version, status, "dynamic", summary, methodExamples, Collections.unmodifiableMap(operations),
                maxSourceSec, maxSegments, maxSegmentSec, maxSteps, maxAutoFix, checks, autoFixChecks, capabilities, body, digest, triggers);
    }

    /**
     * Lenient on purpose: routing hints never grant anything, so an odd value is dropped rather than rejecting the file.
     * media keeps only video|image|audio|text; keywords are trimmed, de-duplicated, at most 32 of at most 32 characters.
     */
    static StudioSkill.Triggers triggers(Object raw) {
        if (!(raw instanceof Map<?, ?> map)) return StudioSkill.Triggers.NONE;
        List<String> media = new ArrayList<>();
        if (map.get("media") instanceof List<?> items)
            for (Object item : items) if (item instanceof String s && TRIGGER_MEDIA.contains(s.strip()) && !media.contains(s.strip())) media.add(s.strip());
        List<String> keywords = new ArrayList<>();
        if (map.get("keywords") instanceof List<?> items)
            for (Object item : items) {
                if (!(item instanceof String s) || s.isBlank() || s.strip().length() > 32 || keywords.size() >= 32) continue;
                if (!keywords.contains(s.strip())) keywords.add(s.strip());
            }
        boolean defaultSkill = Boolean.TRUE.equals(map.get("default"));
        return new StudioSkill.Triggers(List.copyOf(media), List.copyOf(keywords), defaultSkill);
    }

    private static String string(Object value, String field, int max) {
        if (!(value instanceof String s) || s.isBlank()) throw new IllegalArgumentException(field + " missing");
        if (s.strip().length() > max) throw new IllegalArgumentException(field + " too long");
        return s.strip();
    }

    private static int integer(Object value, String field) {
        if (!(value instanceof Integer n)) throw new IllegalArgumentException(field + " must be an integer");
        return n;
    }

    private static List<String> list(Object value, String field, Pattern pattern) {
        if (!(value instanceof List<?> items)) throw new IllegalArgumentException(field + " must be a list");
        List<String> out = new ArrayList<>();
        for (Object item : items) {
            if (!(item instanceof String s) || s.isBlank() || s.length() > 64) throw new IllegalArgumentException(field + " has an invalid item");
            if (pattern != null && !pattern.matcher(s).matches()) throw new IllegalArgumentException(field + " has an invalid id " + s);
            if (out.contains(s)) throw new IllegalArgumentException(field + " repeats " + s);
            out.add(s);
        }
        return List.copyOf(out);
    }

    static String digest(String text) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
}
