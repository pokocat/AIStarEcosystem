package com.aistareco.aep.ipstudio.skill;

import org.junit.jupiter.api.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class StudioSkillCatalogTest {
    static final Path FILE = Path.of("src/main/resources/studio/skills/reference-video-recreation.md");

    @Test void repositorySkillFileParsesToTheContract() throws Exception {
        StudioSkill skill = StudioSkillCatalog.parse(Files.readString(FILE));
        assertEquals("reference-video-recreation", skill.key());
        assertEquals(1, skill.version());
        assertEquals("active", skill.status());
        assertEquals("dynamic", skill.planning());
        assertEquals(List.of("recreation", "text"), skill.stageOperations("analysis"));
        assertEquals(List.of("text", "image", "video", "check", "assemble"), skill.stageOperations("production"));
        assertEquals(28, skill.maxSteps(), "maxSegments * 3 + 4 with 8 segments");
        assertEquals("model", skill.maxSegmentSec());
        assertEquals(60, skill.maxSourceSec());
        assertEquals(7, skill.checks().size());
        assertTrue(skill.autoFixChecks().isEmpty());
        assertEquals(64, skill.digest().length());
        assertTrue(skill.body().startsWith("# 参考视频复刻"));
        var dto = skill.summaryDto();
        assertEquals("model", dto.limits().maxSegmentSec());
        assertEquals(List.of("remap-subject", "creative-rewrite", "preserve-audio-rebuild-visuals", "keyframe-rebuild"), dto.methodExamples());
    }

    @Test void classpathCatalogListsTheRepositorySkill() {
        var catalog = new StudioSkillCatalog();
        assertTrue(catalog.list().stream().anyMatch(s -> s.key().equals("reference-video-recreation")));
        assertEquals("reference-video-recreation", catalog.requireForNewWork("reference-video-recreation").key());
    }

    @Test void snapshotRoundTripsWithoutChangingTheRules() throws Exception {
        StudioSkill skill = StudioSkillCatalog.parse(Files.readString(FILE));
        StudioSkill back = StudioSkill.fromSnapshot(skill.snapshot(new com.fasterxml.jackson.databind.ObjectMapper()));
        assertEquals(skill.operations(), back.operations());
        assertEquals(skill.maxSteps(), back.maxSteps());
        assertEquals(skill.maxSegmentSec(), back.maxSegmentSec());
        assertEquals(skill.checks(), back.checks());
        assertEquals(skill.digest(), back.digest());
        assertEquals(skill.body(), back.body());
    }

    @Test void autoFixChecksOutsideChecksRejectTheFile() throws Exception {
        String text = Files.readString(FILE).replace("autoFixChecks: []", "autoFixChecks: [lip-sync]");
        var e = assertThrows(IllegalArgumentException.class, () -> StudioSkillCatalog.parse(text));
        assertTrue(e.getMessage().contains("subset"));
    }

    @Test void aStageCannotWhitelistAnOperationOutsideThePlanContract() throws Exception {
        String text = Files.readString(FILE).replace("analysis: [recreation, text]", "analysis: [recreation, text, video]");
        assertThrows(IllegalArgumentException.class, () -> StudioSkillCatalog.parse(text));
        String unknownStage = Files.readString(FILE).replace("production: [", "delivery: [");
        assertThrows(IllegalArgumentException.class, () -> StudioSkillCatalog.parse(unknownStage));
    }

    @Test void unknownHeaderFieldsAndBrokenYamlRejectTheFile() throws Exception {
        String extra = Files.readString(FILE).replace("planning: dynamic", "planning: dynamic\ngrantAll: true");
        assertThrows(IllegalArgumentException.class, () -> StudioSkillCatalog.parse(extra));
        assertThrows(IllegalArgumentException.class, () -> StudioSkillCatalog.parse("no front matter"));
        String broken = Files.readString(FILE).replace("limits:", "limits: [");
        assertThrows(IllegalArgumentException.class, () -> StudioSkillCatalog.parse(broken));
    }

    @Test void explicitSegmentSecondsAndIntegerStepsAreAccepted() throws Exception {
        String text = Files.readString(FILE).replace("maxSegmentSec: model", "maxSegmentSec: 12").replace("maxSteps: \"maxSegments * 3 + 4\"", "maxSteps: 20");
        StudioSkill skill = StudioSkillCatalog.parse(text);
        assertEquals(12, skill.maxSegmentSec());
        assertEquals(20, skill.maxSteps());
        assertThrows(IllegalArgumentException.class, () -> StudioSkillCatalog.parse(text.replace("maxSegmentSec: 12", "maxSegmentSec: -3")));
    }

    @Test void withdrawnSkillsAreNotOfferedForNewWork() throws Exception {
        StudioSkill withdrawn = StudioSkillCatalog.parse(Files.readString(FILE).replace("status: active", "status: withdrawn"));
        var catalog = new StudioSkillCatalog(Map.of(withdrawn.key(), withdrawn));
        assertTrue(catalog.list().isEmpty());
        assertTrue(catalog.find(withdrawn.key()).isPresent(), "accepted work can still look it up");
        var e = assertThrows(com.aistareco.common.BusinessException.class, () -> catalog.requireForNewWork(withdrawn.key()));
        assertEquals("STUDIO_SKILL_NOT_FOUND", e.getCode());
        assertEquals(404, e.getStatus().value());
    }

    @Test void limitExpressionsUseOnlyNamedLimitsAndIntegers() {
        assertEquals(28, StudioSkillExpression.evaluate("maxSegments * 3 + 4", Map.of("maxSegments", 8)));
        assertEquals(20, StudioSkillExpression.evaluate("(maxSegments + 2) * 2", Map.of("maxSegments", 8)));
        assertThrows(IllegalArgumentException.class, () -> StudioSkillExpression.evaluate("maxSegments * x", Map.of("maxSegments", 8)));
        assertThrows(IllegalArgumentException.class, () -> StudioSkillExpression.evaluate("maxSegments / 0", Map.of("maxSegments", 8)));
        assertThrows(IllegalArgumentException.class, () -> StudioSkillExpression.evaluate("Runtime.exec()", Map.of()));
    }
}
