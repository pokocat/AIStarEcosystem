package com.aistareco.aep.ipstudio.skill;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.ipstudio.dto.StudioSkillDtos.*;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.TextNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * S3 registry on a real database: seeding and re-seeding, DB precedence over a changed file, immutable versions,
 * status rules, rollback, distilled drafts (saved without activation, published only from the current base), and the
 * admin dry-run (one model call, validated, no billing; unconfigured endpoint → 503 with no call).
 */
@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class StudioSkillRegistryTest {
    static final Path FILE = Path.of("src/main/resources/studio/skills/reference-video-recreation.md");
    static final String KEY = "reference-video-recreation";

    @Autowired IpSkillRepository skills;
    @Autowired IpSkillVersionRepository versions;
    @Autowired PlatformTransactionManager manager;

    final ObjectMapper om = new ObjectMapper();
    final PromptService prompts = mock(PromptService.class);
    final AiModelInvocationService models = mock(AiModelInvocationService.class);
    final AiModelEndpointRepository endpoints = mock(AiModelEndpointRepository.class);
    StudioSkillStore store;
    StudioSkillCatalog catalog;
    StudioSkillAdminService admin;
    String text;

    @SuppressWarnings("unchecked")
    static <T> ObjectProvider<T> none() { ObjectProvider<T> p = mock(ObjectProvider.class); when(p.getIfAvailable()).thenReturn(null); return p; }

    @BeforeEach void setUp() throws Exception {
        versions.deleteAll(); skills.deleteAll();
        store = new StudioSkillStore(skills, versions, om, manager);
        catalog = new StudioSkillCatalog(store);
        ObjectProvider<AiAppSceneModelPolicyService> scenes = none();
        ObjectProvider<StudioWorkflowService> workflow = none();
        admin = new StudioSkillAdminService(catalog, store, prompts, models, endpoints, mock(DapPricingService.class), scenes, workflow, om, manager);
        text = Files.readString(FILE);
    }

    StudioSkillCatalog.Seed seed(String content) {
        var parsed = StudioSkillCatalog.parseFile(content);
        return new StudioSkillCatalog.Seed(parsed.skill().key() + ".md", content, parsed.header(), parsed.body(), parsed.skill());
    }

    String second() {
        return text.replace("key: reference-video-recreation", "key: script-rewrite").replace("name: 参考视频复刻", "name: 脚本改写")
                .replace("  default: true\n", "").replace("media: [video]", "media: [text]").replace("keywords: [复刻, 拉片, 参考视频, 照着这条, 做同款, 翻拍]", "keywords: [改脚本, 文案]");
    }

    PublishRequest edit(String body, Integer expected) {
        String header = text.substring(4, text.indexOf("\n---", 3) + 1);
        return new PublishRequest(TextNode.valueOf(header), body, "改一处说法", expected);
    }

    // ── Seeding and precedence ──────────────────────────────────────────────────────────────────────────────────

    @Test void repositoryFilesSeedAsVersionOneAndTheCatalogServesThem() {
        catalog.seedRepositoryFiles();
        IpSkill row = skills.findById(KEY).orElseThrow();
        assertEquals(1, row.getCurrentVersion());
        assertEquals("active", row.getStatus());
        assertEquals(IpSkill.SEED_AUTHOR, row.getUpdatedBy());
        IpSkillVersion v1 = versions.findBySkillKeyAndVersion(KEY, 1).orElseThrow();
        assertEquals("seed", v1.getSource());
        assertEquals("published", v1.getStatus());
        StudioSkill served = catalog.requireForNewSelection(KEY);
        assertEquals(StudioSkillCatalog.parse(text).digest(), served.digest(), "seed digest = file digest, so accepted snapshots stay comparable");
        assertEquals(28, served.maxSteps());
        assertTrue(served.triggers().defaultSkill());
        assertTrue(catalog.list().stream().anyMatch(s -> s.key().equals(KEY) && s.triggers() != null && s.triggers().defaultSkill()));
        catalog.seedRepositoryFiles(); // restart with the same file: nothing new
        assertEquals(1, versions.findBySkillKeyOrderByVersionDesc(KEY).size());
    }

    @Test void aChangedFileReseedsAnUntouchedSkillAsANewImmutableVersion() {
        store.seed(List.of(seed(text)));
        String v1Body = versions.findBySkillKeyAndVersion(KEY, 1).orElseThrow().getBodyMd();
        store.seed(List.of(seed(text.replace("## 分段规则", "## 分段规则\n- 新增一条规则。"))));
        catalog.invalidate();
        assertEquals(2, skills.findById(KEY).orElseThrow().getCurrentVersion());
        assertEquals("seed", versions.findBySkillKeyAndVersion(KEY, 2).orElseThrow().getSource());
        assertEquals(v1Body, versions.findBySkillKeyAndVersion(KEY, 1).orElseThrow().getBodyMd(), "v1 is never rewritten");
        assertTrue(catalog.find(KEY).orElseThrow().body().contains("新增一条规则"));
        assertEquals(2, catalog.find(KEY).orElseThrow().version());
    }

    @Test void onceAnAdminPublishedTheDatabaseWinsOverAChangedFile() {
        store.seed(List.of(seed(text)));
        admin.publish(KEY, edit(StudioSkillCatalog.parse(text).body() + "\n\n## 后台补充\n- 运营写的。", 1), "op1");
        store.seed(List.of(seed(text.replace("## 分段规则", "## 分段规则\n- 仓库里的新规则。"))));
        catalog.invalidate();
        assertEquals(2, skills.findById(KEY).orElseThrow().getCurrentVersion());
        assertEquals(2, versions.findBySkillKeyOrderByVersionDesc(KEY).size(), "no seed version appended");
        StudioSkill served = catalog.find(KEY).orElseThrow();
        assertTrue(served.body().contains("运营写的"));
        assertFalse(served.body().contains("仓库里的新规则"));
    }

    @Test void anAdminStatusChangeAlsoStopsReseeding() {
        store.seed(List.of(seed(text), seed(second())));
        admin.setStatus("script-rewrite", new StatusRequest("draft"), "op1");
        store.seed(List.of(seed(text), seed(second().replace("## 分段规则", "## 分段规则\n- 改了"))));
        assertEquals(1, skills.findById("script-rewrite").orElseThrow().getCurrentVersion());
        assertEquals("draft", skills.findById("script-rewrite").orElseThrow().getStatus());
    }

    // ── Versions and status ─────────────────────────────────────────────────────────────────────────────────────

    @Test void publishingAndRollingBackAppendVersionsAndNeverEditOldOnes() {
        store.seed(List.of(seed(text)));
        var v1 = versions.findBySkillKeyAndVersion(KEY, 1).orElseThrow();
        String body2 = StudioSkillCatalog.parse(text).body() + "\n\n## 补充\n- 第二版。";
        var detail = admin.publish(KEY, edit(body2, 1), "op1");
        assertEquals(2, detail.currentVersion());
        assertEquals("admin", detail.current().source());
        var rolled = admin.rollback(KEY, 1, new VersionActionRequest("第二版效果差", 2), "op2");
        assertEquals(3, rolled.currentVersion());
        var v3 = versions.findBySkillKeyAndVersion(KEY, 3).orElseThrow();
        assertEquals("rollback", v3.getSource());
        assertEquals(v1.getBodyMd(), v3.getBodyMd());
        var again = versions.findBySkillKeyAndVersion(KEY, 1).orElseThrow();
        assertEquals(v1.getBodyMd(), again.getBodyMd());
        assertEquals(v1.getFrontmatterJson(), again.getFrontmatterJson());
        assertEquals(v1.getContentDigest(), again.getContentDigest());
        assertTrue(versions.findBySkillKeyAndVersion(KEY, 2).orElseThrow().getBodyMd().contains("第二版"));
        assertEquals(3, admin.versions(KEY).size());
        assertTrue(catalog.snapshotFor(KEY, 2).orElseThrow().body().contains("第二版"), "any historical version is readable");
        assertFalse(catalog.find(KEY).orElseThrow().body().contains("第二版"));
        var stale = assertThrows(BusinessException.class, () -> admin.publish(KEY, edit(body2, 1), "op1"));
        assertEquals("STUDIO_SKILL_VERSION_CONFLICT", stale.getCode());
        assertEquals(409, stale.getStatus().value());
    }

    @Test void publishValidatesLikeTheRepositoryFiles() {
        store.seed(List.of(seed(text)));
        String header = text.substring(4, text.indexOf("\n---", 3) + 1);
        String body = StudioSkillCatalog.parse(text).body();
        for (String broken : List.of(header.replace("autoFixChecks: []", "autoFixChecks: [lip-sync]"),
                header.replace("analysis: [recreation, text]", "analysis: [recreation, text, video]"),
                header.replace("maxSteps: \"maxSegments * 3 + 4\"", "maxSteps: \"maxSegments * x\""),
                header.replace("maxSegments: 8", "maxSegments: 99"),
                header.replace("planning: dynamic", "planning: dynamic\ngrantAll: true"))) {
            var e = assertThrows(BusinessException.class, () -> admin.publish(KEY, new PublishRequest(TextNode.valueOf(broken), body, null, null), "op"));
            assertEquals("STUDIO_SKILL_INVALID", e.getCode());
            assertEquals(400, e.getStatus().value());
        }
        var wrongKey = assertThrows(BusinessException.class, () -> admin.publish(KEY,
                new PublishRequest(TextNode.valueOf(header.replace("key: reference-video-recreation", "key: other")), body, null, null), "op"));
        assertEquals("STUDIO_SKILL_INVALID", wrongKey.getCode());
        assertEquals(1, versions.findBySkillKeyOrderByVersionDesc(KEY).size(), "nothing written on a refused publish");
        // JSON front matter is accepted too, and status/version are server-owned.
        Map<String, Object> json = new LinkedHashMap<>(StudioSkillCatalog.parseFile(text).header());
        json.put("status", "withdrawn"); json.put("version", 99);
        var ok = admin.publish(KEY, new PublishRequest(om.valueToTree(json), body + "\n- 小改动。", null, null), "op");
        assertEquals(2, ok.currentVersion());
        assertEquals("active", ok.status(), "a version cannot change the skill's status");
    }

    @Test void theLastActiveSkillCannotBeWithdrawnAndWithdrawnSkillsBlockNewWork() {
        store.seed(List.of(seed(text)));
        var last = assertThrows(BusinessException.class, () -> admin.setStatus(KEY, new StatusRequest("withdrawn"), "op"));
        assertEquals("STUDIO_SKILL_LAST_ACTIVE", last.getCode());
        assertEquals(409, last.getStatus().value());
        assertThrows(BusinessException.class, () -> admin.setStatus(KEY, new StatusRequest("draft"), "op"));
        store.seed(List.of(seed(text), seed(second())));
        catalog.invalidate();
        admin.setStatus(KEY, new StatusRequest("withdrawn"), "op");
        assertEquals("STUDIO_SKILL_NOT_FOUND", assertThrows(BusinessException.class, () -> catalog.requireForNewWork(KEY)).getCode());
        assertTrue(catalog.find(KEY).isPresent(), "accepted work can still look it up");
        assertEquals(List.of("script-rewrite"), catalog.list().stream().map(SkillSummary::key).toList());
        admin.setStatus(KEY, new StatusRequest("draft"), "op");
        assertEquals("draft", catalog.requireForNewWork(KEY).status(), "a bound thread keeps working on a draft skill");
        assertEquals("STUDIO_SKILL_NOT_FOUND", assertThrows(BusinessException.class, () -> catalog.requireForNewSelection(KEY)).getCode());
        var bad = assertThrows(BusinessException.class, () -> admin.setStatus(KEY, new StatusRequest("deleted"), "op"));
        assertEquals("STUDIO_INPUT_INVALID", bad.getCode());
    }

    @Test void onlyOneActiveSkillMayBeTheDefault() {
        store.seed(List.of(seed(text), seed(second())));
        String header = second().substring(4, second().indexOf("\n---", 3) + 1).replace("keywords: [改脚本, 文案]", "keywords: [改脚本, 文案]\n  default: true");
        var e = assertThrows(BusinessException.class, () -> admin.publish("script-rewrite",
                new PublishRequest(TextNode.valueOf(header), StudioSkillCatalog.parse(second()).body(), null, null), "op"));
        assertEquals("STUDIO_SKILL_DEFAULT_CONFLICT", e.getCode());
    }

    @Test void createNeedsANewKey() {
        store.seed(List.of(seed(text)));
        var created = admin.create(new CreateRequest(second(), "新方法"), "op");
        assertEquals("script-rewrite", created.key());
        assertEquals(1, created.currentVersion());
        assertEquals("admin", created.current().source());
        var dup = assertThrows(BusinessException.class, () -> admin.create(new CreateRequest(text, null), "op"));
        assertEquals("STUDIO_SKILL_EXISTS", dup.getCode());
        var invalid = assertThrows(BusinessException.class, () -> admin.create(new CreateRequest("no front matter", null), "op"));
        assertEquals("STUDIO_SKILL_INVALID", invalid.getCode());
    }

    // ── Distilled drafts ────────────────────────────────────────────────────────────────────────────────────────

    IpRun distillRun(int base) {
        var input = om.createObjectNode().put("operation", "text").put("purpose", "skill-distill");
        input.putObject("_exec").putObject("skillDistill").put("skillKey", KEY).put("baseVersion", base).put("executionId", "PEX-1").put("note", "看检查");
        return IpRun.builder().id("IPR-distill" + base).projectId("P1").ownerUserId("op-user").nodeId("SKD-PEX-1").kind("studio-text")
                .status("running").inputJson(input.toString()).outputJson("{}").createdAt(Instant.now()).build();
    }

    void saveDraft(IpRun run, String body) {
        var draft = om.createObjectNode().put("skillKey", KEY).put("baseVersion", 1).put("bodyMd", body).put("changeNote", "补了一条分段经验");
        new TransactionTemplate(manager).executeWithoutResult(s -> new StudioSkillDraftSink(store, om).save(run, draft));
        assertFalse(draft.has("bodyMd"));
        assertTrue(draft.path("version").asInt() > 1);
    }

    @Test void aDistilledDraftIsSavedWithoutActivationAndPublishedOnlyFromTheCurrentBase() {
        store.seed(List.of(seed(text)));
        String body = StudioSkillCatalog.parse(text).body() + "\n\n- 草稿里的新经验。";
        saveDraft(distillRun(1), body);
        var draft = versions.findBySkillKeyAndVersion(KEY, 2).orElseThrow();
        assertEquals("draft", draft.getStatus());
        assertEquals("distilled", draft.getSource());
        assertEquals("op-user", draft.getAuthor());
        assertEquals(1, draft.getBaseVersion());
        assertEquals("PEX-1", draft.getSourceExecutionId());
        assertEquals(versions.findBySkillKeyAndVersion(KEY, 1).orElseThrow().getFrontmatterJson().replace("\"version\":1", "\"version\":2"),
                draft.getFrontmatterJson(), "the header is the base's: model text never touches operations or limits");
        IpSkill row = skills.findById(KEY).orElseThrow();
        assertEquals(1, row.getCurrentVersion(), "a draft never becomes current by itself");
        assertEquals("active", row.getStatus());
        catalog.invalidate();
        assertFalse(catalog.find(KEY).orElseThrow().body().contains("草稿里的新经验"));
        assertEquals(1, admin.list().get(0).pendingDrafts());
        assertEquals("draft", catalog.snapshotFor(KEY, 2).orElseThrow().status());
        var rollbackToDraft = assertThrows(BusinessException.class, () -> admin.rollback(KEY, 2, null, "op"));
        assertEquals("STUDIO_INPUT_INVALID", rollbackToDraft.getCode());

        // A second draft on the same base; publishing the first makes the second stale.
        saveDraft(distillRun(1), body + "\n- 另一份草稿。");
        var published = admin.publishDraft(KEY, 2, new VersionActionRequest("审过了", 1), "admin1");
        assertEquals(2, published.currentVersion());
        assertTrue(catalog.find(KEY).orElseThrow().body().contains("草稿里的新经验"));
        assertEquals("published", versions.findBySkillKeyAndVersion(KEY, 2).orElseThrow().getStatus());
        var stale = assertThrows(BusinessException.class, () -> admin.publishDraft(KEY, 3, null, "admin1"));
        assertEquals("STUDIO_SKILL_DRAFT_STALE", stale.getCode());
        var twice = assertThrows(BusinessException.class, () -> admin.publishDraft(KEY, 2, null, "admin1"));
        assertEquals("STUDIO_SKILL_VERSION_CONFLICT", twice.getCode());
    }

    // ── Dry-run ─────────────────────────────────────────────────────────────────────────────────────────────────

    static final String ANALYSIS_PLAN = """
            {"summary":"先拉片再编排","steps":[
              {"id":"cut","operation":"recreation","title":"拉片","prompt":"看懂原片结构",
               "settings":{"sourceNodeId":"source-video","mode":"segments","maxSegmentSec":"model","videoModel":"ep-h3"}},
              {"id":"compile","operation":"text","title":"编排制作计划","prompt":"按分析结果编排","settings":{"purpose":"plan-compile"}}],
             "questions":[]}""";

    DryRunRequest sample(String endpointId) {
        return new DryRunRequest("原片 40 秒，四段。", "换成我的保温杯", "analysis",
                List.of(new DryRunAsset("source-video", "video", "原片", null, 40.0)), endpointId, null, null, null);
    }

    void stubPrompt(String origin) {
        when(prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_PLAN)).thenReturn(
                new PromptService.ResolvedPrompt("规划员", "{{skill}}\n{{constraints}}\n{{brief}}\n{{analysis}}\n{{assets}}", new PromptParamsDto(null, null, null), origin));
    }

    @Test void dryRunCallsTheChosenEndpointOnceAndValidatesThePlanWithoutBilling() {
        store.seed(List.of(seed(text)));
        stubPrompt("resource");
        var endpoint = AiModelEndpoint.builder().id("ep-text").name("文本").model("m").enabled(true).build();
        when(endpoints.findById("ep-text")).thenReturn(Optional.of(endpoint));
        when(models.invokeChatOnEndpoint(eq(endpoint), any(), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(ANALYSIS_PLAN, "stop", 300L, "ep-text", "m", 200L, 100L));
        DryRunResult result = admin.dryRun(KEY, sample("ep-text"));
        assertTrue(result.validation().ok(), String.valueOf(result.validation().errors()));
        assertEquals(2, result.plan().path("steps").size());
        assertEquals(KEY, result.plan().path("skillKey").asText());
        assertFalse(result.plan().has("fingerprint"), "a dry-run plan is never confirmable");
        assertEquals(200L, result.usage().inputTokens());
        assertEquals("ep-text", result.endpointId());
        verify(models, times(1)).invokeChatOnEndpoint(eq(endpoint), any(), anyList(), anyMap());
        assertEquals(1, versions.findBySkillKeyOrderByVersionDesc(KEY).size(), "nothing saved");

        // A plan using an operation the analysis stage does not allow is reported, not executed or saved.
        when(models.invokeChatOnEndpoint(eq(endpoint), any(), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(ANALYSIS_PLAN.replace("\"operation\":\"text\"", "\"operation\":\"video\""), "stop", 300L, "ep-text", "m", 200L, 100L));
        DryRunResult refused = admin.dryRun(KEY, sample("ep-text"));
        assertFalse(refused.validation().ok());
        assertNull(refused.plan());
        assertFalse(refused.validation().errors().isEmpty());
        assertNotNull(refused.rawExcerpt());
    }

    @Test void dryRunOfAnUnsavedEditUsesTheEditAndRejectsAnInvalidOne() {
        store.seed(List.of(seed(text)));
        stubPrompt("resource");
        var endpoint = AiModelEndpoint.builder().id("ep-text").name("文本").model("m").enabled(true).build();
        when(endpoints.findById("ep-text")).thenReturn(Optional.of(endpoint));
        when(models.invokeChatOnEndpoint(eq(endpoint), any(), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(ANALYSIS_PLAN, "stop", 300L, "ep-text", "m", 200L, 100L));
        String header = text.substring(4, text.indexOf("\n---", 3) + 1);
        var edit = new DryRunRequest("", "换成我的保温杯", "analysis", List.of(new DryRunAsset("source-video", "video", "原片", null, null)), "ep-text", null,
                TextNode.valueOf(header.replace("analysis: [recreation, text]", "analysis: [recreation]")), "# 方法\n只拉片。");
        DryRunResult result = admin.dryRun(KEY, edit);
        assertFalse(result.validation().ok(), "the edited whitelist (no text in analysis) applies to the dry-run");
        var invalid = new DryRunRequest("", "x", "analysis", null, "ep-text", null, TextNode.valueOf(header.replace("autoFixChecks: []", "autoFixChecks: [x]")), "# 方法");
        assertEquals("STUDIO_SKILL_INVALID", assertThrows(BusinessException.class, () -> admin.dryRun(KEY, invalid)).getCode());
    }

    @Test void dryRunWithoutAConfiguredEndpointIs503AndCallsNothing() {
        store.seed(List.of(seed(text)));
        stubPrompt("resource");
        when(models.resolveAcceptedEndpoint(any(), isNull(), eq("studio"))).thenReturn(Optional.empty());
        var e = assertThrows(BusinessException.class, () -> admin.dryRun(KEY, sample(null)));
        assertEquals("AI_NOT_CONFIGURED", e.getCode());
        assertEquals(503, e.getStatus().value());
        verify(models, never()).invokeChatOnEndpoint(any(), any(), anyList(), anyMap());
        stubPrompt("code");
        assertEquals("PROMPT_NOT_CONFIGURED", assertThrows(BusinessException.class, () -> admin.dryRun(KEY, sample(null))).getCode());
    }
}
