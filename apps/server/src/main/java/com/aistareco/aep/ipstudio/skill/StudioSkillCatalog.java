package com.aistareco.aep.ipstudio.skill;

import com.aistareco.aep.ipstudio.dto.StudioSkillDtos.SkillSummary;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Public catalog of the versioned repository skill files {@code resources/studio/skills/*.md}
 * (docs/ip-studio-conversational-video-recreation-plan.md §文件和版本). S1/S2 have no skill table: files take effect
 * through code review and deployment.
 *
 * <p>Parsing is strict on purpose. A header that fails to parse, names an unknown stage/operation, lets a stage exceed the
 * plan contract (analysis ⊆ recreation|text, production ⊆ text|image|video|check|assemble) or lists autoFixChecks outside
 * checks is rejected whole. The service refuses to start on such a file (fail-fast, AGENTS §8.0): a broken file must never
 * silently read as a wider or narrower permission. Method examples are explanatory only and never a whitelist.
 */
@Component
public class StudioSkillCatalog {
    private static final Logger log = LoggerFactory.getLogger(StudioSkillCatalog.class);
    static final String LOCATION = "classpath*:studio/skills/*.md";
    private static final Pattern KEY = Pattern.compile("[a-z0-9][a-z0-9-]{0,63}");
    private static final Pattern CHECK_ID = Pattern.compile("[a-z0-9][a-z0-9-]{0,63}");
    private static final Set<String> STATUSES = Set.of("active", "draft", "withdrawn");
    private static final Map<String, Set<String>> STAGE_OPERATIONS = Map.of(
            StudioSkill.ANALYSIS, Set.of("recreation", "text"),
            StudioSkill.PRODUCTION, Set.of("text", "image", "video", "check", "assemble"));
    private static final Set<String> HEADER_FIELDS = Set.of("key", "name", "version", "status", "planning", "summary",
            "methodExamples", "operations", "limits", "checks", "autoFixChecks", "requiredCapabilities");
    private static final Set<String> LIMIT_FIELDS = Set.of("maxSourceSec", "maxSegments", "maxSegmentSec", "maxSteps", "maxAutoFixPerSegment");

    private final Map<String, StudioSkill> skills;

    public StudioSkillCatalog() { this(loadClasspath()); }

    StudioSkillCatalog(Map<String, StudioSkill> skills) { this.skills = Collections.unmodifiableMap(new LinkedHashMap<>(skills)); }

    /** Skills offered for new work: everything not withdrawn, in file order. */
    public List<SkillSummary> list() {
        return skills.values().stream().filter(s -> !s.withdrawn()).map(StudioSkill::summaryDto).toList();
    }

    public List<StudioSkill> available() { return skills.values().stream().filter(s -> !s.withdrawn()).toList(); }

    /** Lookup for display or for settling already accepted work; includes withdrawn skills. */
    public Optional<StudioSkill> find(String key) { return key == null ? Optional.empty() : Optional.ofNullable(skills.get(key)); }

    /** New turns, plans and executions need a skill that is not withdrawn. Never freezes anything. */
    public StudioSkill requireForNewWork(String key) {
        var skill = find(key).orElseThrow(StudioSkillCatalog::notFound);
        if (skill.withdrawn()) throw notFound();
        return skill;
    }

    public static BusinessException notFound() {
        return new BusinessException(HttpStatus.NOT_FOUND, "STUDIO_SKILL_NOT_FOUND", "这个制作方法不存在或已停用，请换一种做法");
    }

    private static Map<String, StudioSkill> loadClasspath() {
        Map<String, StudioSkill> out = new LinkedHashMap<>();
        Resource[] resources;
        try { resources = new PathMatchingResourcePatternResolver().getResources(LOCATION); }
        catch (java.io.IOException e) { throw new IllegalStateException("Studio skill files cannot be listed", e); }
        Arrays.sort(resources, Comparator.comparing(r -> String.valueOf(r.getFilename())));
        for (Resource resource : resources) {
            String raw;
            try (var in = resource.getInputStream()) { raw = new String(in.readAllBytes(), StandardCharsets.UTF_8); }
            catch (java.io.IOException e) { throw new IllegalStateException("Studio skill file unreadable: " + resource.getFilename(), e); }
            StudioSkill skill;
            try { skill = parse(raw); }
            catch (IllegalArgumentException e) {
                throw new IllegalStateException("Studio skill file " + resource.getFilename() + " is invalid: " + e.getMessage(), e);
            }
            if (out.putIfAbsent(skill.key(), skill) != null)
                throw new IllegalStateException("Duplicate studio skill key " + skill.key() + " in " + resource.getFilename());
            log.info("[studio-skill] loaded key={} version={} status={} digest={}", skill.key(), skill.version(), skill.status(), skill.digest().substring(0, 12));
        }
        return out;
    }

    /** Parse one skill file. Throws {@link IllegalArgumentException} with a specific reason on any header problem. */
    public static StudioSkill parse(String text) {
        if (text == null) throw new IllegalArgumentException("empty file");
        String normalized = text.replace("\r\n", "\n");
        if (!normalized.startsWith("---\n")) throw new IllegalArgumentException("missing YAML front matter");
        int end = normalized.indexOf("\n---", 3);
        if (end < 0) throw new IllegalArgumentException("unterminated YAML front matter");
        int bodyStart = normalized.indexOf('\n', end + 1);
        String header = normalized.substring(4, end + 1);
        String body = bodyStart < 0 ? "" : normalized.substring(bodyStart + 1).strip();
        if (body.isBlank()) throw new IllegalArgumentException("method body is empty");
        Object loaded;
        try { loaded = new Yaml(new SafeConstructor(new LoaderOptions())).load(header); }
        catch (RuntimeException e) { throw new IllegalArgumentException("YAML header does not parse: " + e.getMessage()); }
        if (!(loaded instanceof Map<?, ?> map)) throw new IllegalArgumentException("header is not a mapping");
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

        return new StudioSkill(key, name, version, status, "dynamic", summary, methodExamples, Collections.unmodifiableMap(operations),
                maxSourceSec, maxSegments, maxSegmentSec, maxSteps, maxAutoFix, checks, autoFixChecks, capabilities, body, digest(normalized));
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

    private static String digest(String text) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
}
