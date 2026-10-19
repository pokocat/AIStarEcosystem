package com.aistareco.aep.ipstudio.skill;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.*;

/**
 * Persistence of skills and their immutable versions (V63). Owns seeding, the row → {@link StudioSkill} conversion and
 * the canonical serialization of headers; never decides permissions (validation is {@link StudioSkillCatalog#fromHeader}).
 *
 * <p><b>Seed precedence.</b> A repository file is inserted as v1 when the skill does not exist. When it exists and is still
 * untouched — every published version came from a seed and the skill row was last written by the seed — a changed file is
 * appended as a new immutable seed version that becomes current (the row's status follows the file). Anything an admin
 * did (publish, rollback, publish a draft, change the status) makes the DB win; the file is then only logged.
 */
@Component
public class StudioSkillStore {
    private static final Logger log = LoggerFactory.getLogger(StudioSkillStore.class);
    private static final TypeReference<LinkedHashMap<String, Object>> MAP = new TypeReference<>() {};

    private final IpSkillRepository skills;
    private final IpSkillVersionRepository versions;
    private final ObjectMapper mapper;
    private final TransactionTemplate tx;

    public StudioSkillStore(IpSkillRepository skills, IpSkillVersionRepository versions, ObjectMapper mapper, PlatformTransactionManager manager) {
        this.skills = skills; this.versions = versions; this.mapper = mapper;
        this.tx = new TransactionTemplate(manager);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public IpSkillRepository skills() { return skills; }
    public IpSkillVersionRepository versions() { return versions; }

    // ── Seeding ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** One transaction per file; a concurrent node that seeded the same key first wins (unique key), we just re-read. */
    void seed(List<StudioSkillCatalog.Seed> seeds) {
        for (var seed : seeds) {
            try { tx.executeWithoutResult(s -> seedOne(seed)); }
            catch (DataIntegrityViolationException race) {
                log.info("[studio-skill] seed of {} raced with another node; keeping the stored rows", seed.skill().key());
            }
        }
    }

    private void seedOne(StudioSkillCatalog.Seed seed) {
        StudioSkill file = seed.skill();
        Instant now = Instant.now();
        IpSkill row = skills.lockByKey(file.key()).orElse(null);
        if (row == null) {
            skills.saveAndFlush(IpSkill.builder().skillKey(file.key()).name(file.name()).status(file.status()).currentVersion(1)
                    .summary(file.summary()).updatedBy(IpSkill.SEED_AUTHOR).seedFile(seed.file()).createdAt(now).updatedAt(now).build());
            versions.saveAndFlush(seedVersion(seed, 1, now));
            log.info("[studio-skill] seeded {} v1 from {} (digest {})", file.key(), seed.file(), file.digest().substring(0, 12));
            return;
        }
        var latestSeed = versions.findBySkillKeyAndSourceOrderByVersionDesc(file.key(), IpSkillVersion.SOURCE_SEED).stream().findFirst().orElse(null);
        boolean changed = latestSeed == null || !file.digest().equals(latestSeed.getContentDigest());
        if (!changed) return;
        boolean untouched = IpSkill.SEED_AUTHOR.equals(row.getUpdatedBy()) && versions.countPublishedNonSeed(file.key()) == 0
                && latestSeed != null && latestSeed.getVersion() == row.getCurrentVersion();
        if (!untouched) {
            log.info("[studio-skill] repository file {} changed but {} has admin changes; the stored versions win (current v{})",
                    seed.file(), file.key(), row.getCurrentVersion());
            return;
        }
        int next = versions.maxVersion(file.key()) + 1;
        versions.saveAndFlush(seedVersion(seed, next, now));
        row.setCurrentVersion(next); row.setStatus(file.status()); row.setName(file.name()); row.setSummary(file.summary());
        row.setSeedFile(seed.file()); row.setUpdatedBy(IpSkill.SEED_AUTHOR); row.setUpdatedAt(now);
        skills.saveAndFlush(row);
        log.info("[studio-skill] re-seeded {} as v{} from changed file {} (digest {})", file.key(), next, seed.file(), file.digest().substring(0, 12));
    }

    private IpSkillVersion seedVersion(StudioSkillCatalog.Seed seed, int version, Instant now) {
        Map<String, Object> header = new LinkedHashMap<>(seed.header());
        header.put("version", version);
        return IpSkillVersion.builder().id(versionId()).skillKey(seed.skill().key()).version(version).frontmatterJson(json(header))
                .bodyMd(seed.body()).contentDigest(seed.skill().digest()).source(IpSkillVersion.SOURCE_SEED).status(IpSkillVersion.PUBLISHED)
                .author(IpSkill.SEED_AUTHOR).note("仓库文件 " + seed.file()).createdAt(now).publishedAt(now).build();
    }

    // ── Reads ───────────────────────────────────────────────────────────────────────────────────────────────────

    /** Current version of every skill, in key order. A stored version that no longer validates is skipped loudly. */
    Map<String, StudioSkill> loadCurrent() {
        Map<String, StudioSkill> out = new LinkedHashMap<>();
        for (IpSkill row : skills.findAllByOrderBySkillKeyAsc()) {
            var version = versions.findBySkillKeyAndVersion(row.getSkillKey(), row.getCurrentVersion()).orElse(null);
            if (version == null) { log.error("[studio-skill] {} points at missing v{}; skill unavailable", row.getSkillKey(), row.getCurrentVersion()); continue; }
            try { out.put(row.getSkillKey(), toSkill(version, row.getStatus())); }
            catch (IllegalArgumentException e) {
                log.error("[studio-skill] {} v{} no longer validates ({}); skill unavailable until an admin publishes a valid version",
                        row.getSkillKey(), row.getCurrentVersion(), e.getMessage());
            }
        }
        return out;
    }

    /** Any stored version as a skill (drafts included); status = the skill's for the current version, else the version's view. */
    Optional<StudioSkill> version(String key, int version) {
        var row = versions.findBySkillKeyAndVersion(key, version).orElse(null);
        if (row == null) return Optional.empty();
        var skill = skills.findById(key).orElse(null);
        String status = IpSkillVersion.DRAFT.equals(row.getStatus()) ? IpSkill.DRAFT : skill == null ? IpSkill.DRAFT : skill.getStatus();
        try { return Optional.of(toSkill(row, status)); }
        catch (IllegalArgumentException e) { log.warn("[studio-skill] {} v{} does not validate: {}", key, version, e.getMessage()); return Optional.empty(); }
    }

    /** Version row → skill under the given runtime status; the row's version number and digest are the truth. */
    public StudioSkill toSkill(IpSkillVersion row, String status) {
        Map<String, Object> header = header(row.getFrontmatterJson());
        header.put("version", row.getVersion());
        header.put("status", status);
        return StudioSkillCatalog.fromHeader(header, row.getBodyMd(), row.getContentDigest());
    }

    public Map<String, Object> header(String json) {
        try { return mapper.readValue(json, MAP); }
        catch (Exception e) { throw new IllegalArgumentException("stored front matter is not JSON"); }
    }

    public String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }

    /** Header as JSON (canonical for storage): YAML-only types such as dates are not allowed in a validated header. */
    public Map<String, Object> normalize(Map<String, ?> header) {
        try { return mapper.readValue(mapper.writeValueAsString(header), MAP); }
        catch (Exception e) { throw new IllegalArgumentException("front matter cannot be stored as JSON"); }
    }

    /** Digest of an admin-written version: canonical header JSON + body. */
    public String digest(Map<String, ?> header, String body) {
        return StudioSkillCatalog.digest(json(header) + "\n---\n" + (body == null ? "" : body.strip()));
    }

    static String versionId() { return "ISV-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20); }

}
