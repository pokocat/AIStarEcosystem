package com.aistareco.aep.ipstudio.skill;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

/**
 * Saves a finished distill run's result as a {@code draft} {@link IpSkillVersion} (source = distilled). Called by the
 * Studio worker inside the same transaction that settles the run, so "draft saved" and "credits committed" are one
 * outcome: if the draft cannot be saved the transaction rolls back and the run fails with a full refund.
 *
 * <p>A draft never changes {@code current_version} or the skill status, and never enters the runtime catalog; publishing
 * is an admin action ({@link StudioSkillAdminService#publishDraft}). Its YAML header is copied from the base version (the
 * model only revises the body), so a draft can never widen what the skill is allowed to do.
 */
@Component
public class StudioSkillDraftSink {
    private static final Logger log = LoggerFactory.getLogger(StudioSkillDraftSink.class);
    private final StudioSkillStore store;
    private final ObjectMapper mapper;

    public StudioSkillDraftSink(StudioSkillStore store, ObjectMapper mapper) { this.store = store; this.mapper = mapper; }

    /** {@code draft} is the normalized {@code output.skillDraft}; on return it carries the saved version and no body. */
    public void save(IpRun run, ObjectNode draft) {
        JsonNode input;
        try { input = mapper.readTree(run.getInputJson()); } catch (Exception e) { throw new IllegalStateException("Distill run input unreadable", e); }
        JsonNode exec = input.path("_exec").path("skillDistill");
        String key = exec.path("skillKey").asText(null);
        int base = exec.path("baseVersion").asInt(0);
        if (key == null || base < 1 || !key.equals(draft.path("skillKey").asText())) throw new IllegalStateException("Distill run binding missing");
        IpSkill row = store.skills().lockByKey(key).orElseThrow(() ->
                new BusinessException(HttpStatus.NOT_FOUND, "STUDIO_SKILL_NOT_FOUND", "这个制作方法已不存在，草稿没有保存，本次未扣积分"));
        IpSkillVersion baseRow = store.versions().findBySkillKeyAndVersion(key, base).orElseThrow(() ->
                new BusinessException(HttpStatus.NOT_FOUND, "STUDIO_SKILL_VERSION_NOT_FOUND", "草稿依据的版本已不存在，本次未扣积分"));
        Map<String, Object> header = store.header(baseRow.getFrontmatterJson());
        int next = store.versions().maxVersion(key) + 1;
        header.put("version", next);
        String body = draft.path("bodyMd").asText();
        StudioSkill skill;
        try { skill = StudioSkillCatalog.fromHeader(header, body, store.digest(header, body)); }
        catch (IllegalArgumentException e) { throw StudioSkillDistill.badOutput("整理出的方法草稿不完整，本次未扣积分"); }
        String operatorNote = exec.path("note").asText("").strip();
        String changeNote = draft.path("changeNote").asText("").strip();
        StringBuilder note = new StringBuilder();
        if (!operatorNote.isEmpty()) note.append("整理重点：").append(operatorNote).append('\n');
        note.append(changeNote.isEmpty() ? "（模型没有给出改动说明）" : changeNote);
        Instant now = Instant.now();
        store.versions().saveAndFlush(IpSkillVersion.builder().id(StudioSkillStore.versionId()).skillKey(key).version(next)
                .frontmatterJson(store.json(header)).bodyMd(skill.body()).contentDigest(skill.digest()).source(IpSkillVersion.SOURCE_DISTILLED)
                .status(IpSkillVersion.DRAFT).author(run.getOwnerUserId()).note(note.toString()).baseVersion(base)
                .sourceProjectId(run.getProjectId()).sourceExecutionId(exec.path("executionId").asText(null)).sourceRunId(run.getId())
                .createdAt(now).build());
        draft.put("version", next);
        draft.remove("bodyMd");
        log.info("[studio-skill] distilled draft {} v{} (base v{}, current v{}) from run={} execution={}", key, next, base,
                row.getCurrentVersion(), run.getId(), exec.path("executionId").asText());
    }
}
