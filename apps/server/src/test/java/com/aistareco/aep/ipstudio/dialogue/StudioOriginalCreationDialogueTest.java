package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.ipstudio.dialogue.tools.*;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.NodeUpsertData;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.skill.StudioSkill;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.ipstudio.skill.StudioSkillRouter;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.AiModelInvocationService.ChatTurnResult;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * The 2026-10-20 production incidents at the tool boundary:
 * <ul>
 *   <li>IPP-51a92043: an original three-view request could only be bound to 「参考视频复刻」, whose analysis stage forbids images;</li>
 *   <li>IPP-45bead91: the assistant could only write 16:9 / 4 秒 / 男女主 + 客厅 into prose, the node kept 9:16 / 8 s / one image;</li>
 *   <li>IPT-2f13c2ed42994624907d: 「两张三视图我都读到了」 with no pixels ever read.</li>
 * </ul>
 */
class StudioOriginalCreationDialogueTest {
    static final ToolHandle HANDLE = new ToolHandle() {
        public String toolCallId() { return "tc-1"; }
        public void progress(String text) { }
        public void childRun(String runId) { }
    };
    final ObjectMapper om = new ObjectMapper();
    StudioSkill recreation, original;
    ToolContext.Effects effects;
    JsonNode doc;
    final List<NodeUpsertData> published = new ArrayList<>();

    @BeforeEach void setUp() throws Exception {
        recreation = skill("reference-video-recreation");
        original = skill("original-creation");
        doc = om.readTree("""
                {"nodes":[
                  {"id":"male","type":"image","title":"jimeng-6809.png","metadata":{"storageKey":"ipstudio_source/u1/male.png"}},
                  {"id":"female","type":"image","title":"jimeng-4439.png","metadata":{"storageKey":"ipstudio_source/u1/female.png"}},
                  {"id":"room","type":"image","title":"截屏 客厅.png","metadata":{"storageKey":"ipstudio_source/u1/room.png"}},
                  {"id":"empty","type":"image","title":"空图片","metadata":{}},
                  {"id":"clip","type":"video","title":"视频片段","metadata":{"prompt":"画幅 16:9，时长 4 秒","size":"720x1280","seconds":"8"}},
                  {"id":"busy","type":"video","title":"生成中","metadata":{"status":"loading"}}],
                 "connections":[{"fromNodeId":"male","toNodeId":"clip"}]}""");
        effects = mock(ToolContext.Effects.class);
        when(effects.readDoc()).thenAnswer(i -> doc);
        doAnswer(i -> { published.addAll(i.getArgument(0)); return null; }).when(effects).publishNodeUpserts(any());
    }

    StudioSkill skill(String key) throws Exception {
        try (var in = getClass().getResourceAsStream("/studio/skills/" + key + ".md")) {
            return StudioSkillCatalog.parse(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    ToolContext ctx(StudioSkill skill, String stage, String executionId, AiModelEndpoint endpoint) {
        return new ToolContext("u1", "P1", "IPT-P1", "TRN-1", "IPR-1", "IDM-A", "IDM-U", executionId, null, false, endpoint, null,
                DialogueLoop.TurnBudget.unmetered(8192, Clock.systemUTC()), skill, stage, () -> false, effects);
    }

    // ── 1. 原创创作 is a real method, production-only, and the thread can switch to it ───────────────────────────────

    @Test void theOriginalSkillIsProductionOnlyAndTheVideoSkillStillAnalysesFirst() {
        assertEquals("production", original.firstStage());
        assertTrue(original.stageOperations("analysis").isEmpty());
        assertTrue(original.allows("production", "image") && original.allows("production", "video"));
        assertEquals("analysis", recreation.firstStage());
    }

    @Test void theIncidentMessageRoutesToOriginalCreationAndAReferenceVideoStillRoutesToRecreation() {
        String incident = "帮我设计一个原创 IP 形象，要让人一眼记住。先聊思路，再出图。生成图片：生成短剧三视图：分别出正面侧面背面";
        assertEquals("original-creation", StudioSkillRouter.route(List.of(recreation, original), Set.of(), incident).orElseThrow().key());
        assertEquals("reference-video-recreation", StudioSkillRouter.route(List.of(recreation, original), Set.of("video"), "照着这条视频复刻一条").orElseThrow().key());
    }

    @Test void proposePlanNeedsNoAnalysisForTheOriginalSkillButStillDoesForTheVideoSkill() {
        var tool = new ProposePlanTool(null, null, null, null, om, null);
        var brief = om.createObjectNode().put("brief", "原创女性角色正侧背三张图");
        assertNull(tool.validate(brief, ctx(original, "production", null, null)));
        assertNull(tool.validate(brief.deepCopy().put("stage", "production"), ctx(original, "production", null, null)));
        assertNotNull(tool.validate(brief.deepCopy().put("stage", "analysis"), ctx(original, "production", null, null)), "no analysis stage to plan for");
        assertNotNull(tool.validate(brief.deepCopy().put("stage", "production"), ctx(recreation, "analysis", null, null)), "the video skill keeps its order");
        assertNotNull(tool.validate(brief, ctx(null, null, null, null)), "a plan still needs a method");
    }

    @Test void readSkillSwitchesAWronglyBoundThreadWhileNothingRunsAndRefusesDuringAnExecution() throws Exception {
        var catalog = mock(StudioSkillCatalog.class);
        when(catalog.requireForNewSelection("original-creation")).thenReturn(original);
        var tool = new ReadSkillTool(catalog);
        var args = om.createObjectNode().put("key", "original-creation");
        var idle = ctx(recreation, "analysis", null, null);
        assertNull(tool.validate(args, idle));
        var run = tool.run(args, idle, HANDLE);
        assertEquals("done", run.status());
        verify(effects).bindSkill(original);
        assertTrue(run.forModel().contains("original-creation"));
        assertNotNull(tool.validate(args, ctx(recreation, "production", "PEX-1", null)), "an execution keeps its method");
    }

    @Test void aMethodSwitchIsRefusedUnderTheThreadLockOnceAnExecutionIsBoundEvenInTheSameTurn() {
        var thread = IpDialogueThread.builder().id("IPT-P1").skillKey("reference-video-recreation").build();
        StudioDialogueTurnWorker.requireSkillSwitchAllowed(thread, true);
        thread.setActiveExecutionId("PEX-confirmed-this-turn");
        var e = assertThrows(BusinessException.class, () -> StudioDialogueTurnWorker.requireSkillSwitchAllowed(thread, true));
        assertEquals("STUDIO_SKILL_LOCKED", e.getCode());
        StudioDialogueTurnWorker.requireSkillSwitchAllowed(thread, false); // re-reading the bound method is fine
    }

    // ── 2. specs land on nodes as structured settings and edges ─────────────────────────────────────────────────────

    @Test void createNodesWritesRatioDurationCountAndEveryReferenceAsSettingsAndEdges() {
        var tool = new CreateNodesTool();
        var args = om.createObjectNode();
        var node = args.putArray("nodes").addObject().put("key", "shot1").put("type", "video").put("title", "镜 1").put("prompt", "两人分坐沙发两侧")
                .put("aspectRatio", "16:9").put("durationSec", 4).put("count", 1);
        var refs = node.putArray("references");
        refs.addObject().put("nodeId", "male").put("role", "character");
        refs.addObject().put("nodeId", "female").put("role", "character");
        refs.addObject().put("nodeId", "room").put("role", "scene");
        var context = ctx(original, "production", null, null);
        assertNull(tool.validate(args, context));
        assertEquals("done", tool.run(args, context, HANDLE).status());
        var created = published.stream().filter(u -> "create".equals(u.op())).findFirst().orElseThrow();
        JsonNode spec = created.node().path("metadata").path("studio").path("spec");
        assertEquals("16:9", spec.path("aspectRatio").asText());
        assertEquals(4, spec.path("durationSec").asInt());
        assertEquals(List.of("male", "female", "room"), spec.path("references").findValuesAsText("nodeId"));
        assertEquals(List.of("character", "character", "scene"), spec.path("references").findValuesAsText("role"));
        var edges = published.stream().filter(u -> "connect".equals(u.op())).map(u -> u.connection().fromNodeId() + ">" + u.connection().toNodeId()).toList();
        assertEquals(List.of("male>" + created.nodeId(), "female>" + created.nodeId(), "room>" + created.nodeId()), edges);
    }

    @Test void moreThanTwoFramesAreRefused() {
        var tool = new CreateNodesTool();
        var args = om.createObjectNode();
        var refs = args.putArray("nodes").addObject().put("key", "a").put("type", "video").put("title", "t").putArray("references");
        for (String id : List.of("male", "female", "room")) refs.addObject().put("nodeId", id).put("role", "frame");
        assertNotNull(tool.validate(args, ctx(original, "production", null, null)));
    }

    @Test void specsThatCannotBeHonestlyAppliedAreRefusedNotRewritten() {
        var tool = new CreateNodesTool();
        var context = ctx(original, "production", null, null);
        java.util.function.Function<String, String> refuse = json -> {
            try { return tool.validate(om.readTree("{\"nodes\":[" + json + "]}"), context); } catch (Exception e) { throw new RuntimeException(e); }
        };
        assertNotNull(refuse.apply("{\"key\":\"a\",\"type\":\"video\",\"title\":\"t\",\"aspectRatio\":\"16:10\"}"));
        assertNotNull(refuse.apply("{\"key\":\"a\",\"type\":\"image\",\"title\":\"t\",\"durationSec\":4}"), "an image has no duration");
        assertNotNull(refuse.apply("{\"key\":\"a\",\"type\":\"text\",\"title\":\"t\",\"aspectRatio\":\"16:9\"}"));
        assertNotNull(refuse.apply("{\"key\":\"a\",\"type\":\"video\",\"title\":\"t\",\"references\":[{\"nodeId\":\"hGeRlT1qrQUc09_OJUESx\",\"role\":\"character\"}]}"),
                "the incident's invented node id is refused instead of silently dropped");
        assertNotNull(refuse.apply("{\"key\":\"a\",\"type\":\"video\",\"title\":\"t\",\"references\":[{\"nodeId\":\"empty\",\"role\":\"character\"}]}"), "no picture yet");
        assertNotNull(refuse.apply("{\"key\":\"a\",\"type\":\"video\",\"title\":\"t\",\"count\":3}"));
        assertNotNull(refuse.apply("{\"key\":\"a\",\"type\":\"video\",\"title\":\"t\",\"durationSec\":4.5}"), "seconds must not be silently truncated");
        assertNotNull(refuse.apply("{\"key\":\"a\",\"type\":\"video\",\"title\":\"t\",\"count\":1.9}"), "count must not be silently truncated");
        assertNotNull(refuse.apply("{\"key\":\"a\",\"type\":\"video\",\"title\":\"t\",\"durationSec\":\"4\"}"), "the tool contract requires numeric seconds");
    }

    @Test void updateNodesPutsTheSpokenSpecOnTheUsersExistingNodeAndConnectsTheMissingMaterial() {
        var tool = new UpdateNodesTool();
        var args = om.createObjectNode();
        var item = args.putArray("nodes").addObject().put("id", "clip").put("aspectRatio", "16:9").put("durationSec", 4);
        item.putArray("references").addObject().put("nodeId", "female").put("role", "character");
        ((com.fasterxml.jackson.databind.node.ArrayNode) item.path("references")).addObject().put("nodeId", "room").put("role", "scene");
        var context = ctx(original, "production", null, null);
        assertNull(tool.validate(args, context));
        assertEquals("done", tool.run(args, context, HANDLE).status());
        var update = published.stream().filter(u -> "update".equals(u.op())).findFirst().orElseThrow();
        assertEquals("clip", update.nodeId());
        assertEquals("16:9", update.node().path("metadata").path("studio").path("spec").path("aspectRatio").asText());
        assertFalse(update.node().path("metadata").has("prompt"), "no prompt given, the user's text is untouched");
        assertEquals(2, published.stream().filter(u -> "connect".equals(u.op())).count());
        var busy = om.createObjectNode();
        busy.putArray("nodes").addObject().put("id", "busy").put("durationSec", 4);
        assertNotNull(tool.validate(busy, context), "a generating node is left alone");
        var self = om.createObjectNode();
        self.putArray("nodes").addObject().put("id", "clip").putArray("references").addObject().put("nodeId", "clip").put("role", "frame");
        assertNotNull(tool.validate(self, context));
    }

    // ── 4. view_images reads real pixels, only owned keys, only on a vision endpoint, inside the turn budget ──────────

    @TempDir Path dir;

    ViewImagesTool viewer(AiModelInvocationService models, IpProjectService projects) throws Exception {
        Path png = dir.resolve("a.png");
        ImageIO.write(new BufferedImage(40, 60, BufferedImage.TYPE_INT_RGB), "png", png.toFile());
        var storage = mock(FileStorageService.class);
        when(storage.openForRead(anyString())).thenReturn(png);
        return new ViewImagesTool(models, projects, storage);
    }

    static AiModelEndpoint endpoint(boolean vision) {
        return AiModelEndpoint.builder().id("ep-chat").model("qwen38-27b")
                .modelsJson("[{\"id\":\"qwen38-27b\",\"supportsVision\":" + vision + "}]").build();
    }

    @Test void withoutAVisionEndpointNothingIsSentAndTheModelIsToldToSaySo() throws Exception {
        var models = mock(AiModelInvocationService.class);
        var tool = viewer(models, mock(IpProjectService.class));
        var args = om.createObjectNode();
        args.putArray("nodeIds").add("male");
        var run = tool.run(args, ctx(original, "production", null, endpoint(false)), HANDLE);
        assertEquals("failed", run.status());
        assertEquals("STUDIO_VISION_UNAVAILABLE", run.errorCode());
        assertTrue(run.forModel().contains("不要根据文件名猜"));
        verifyNoInteractions(models);
    }

    @Test @SuppressWarnings("unchecked")
    void aVisionEndpointSeesTheRealImagesAndTheTokensCountInThisTurn() throws Exception {
        var models = mock(AiModelInvocationService.class);
        when(models.invokeChatTurnOnEndpoint(any(), any(), any(), any(), any(), any()))
                .thenReturn(new ChatTurnResult("对象1：一名短发男性，正面、侧面、背面三视角拼版。\n对象2：一名长发女性。", "stop", 1800L, 60L, List.of(), false, false, "qwen38-27b"));
        var projects = mock(IpProjectService.class);
        var tool = viewer(models, projects);
        var args = om.createObjectNode();
        args.putArray("nodeIds").add("male").add("female");
        var context = ctx(original, "production", null, endpoint(true));
        assertNull(tool.validate(args, context));
        var run = tool.run(args, context, HANDLE);
        assertEquals("done", run.status(), run.forModel());
        assertTrue(run.forModel().contains("短发男性"));
        verify(projects).requireOwnedAssetKey("u1", "ipstudio_source/u1/male.png");
        verify(projects).requireOwnedAssetKey("u1", "ipstudio_source/u1/female.png");
        ArgumentCaptor<List<Map<String, Object>>> sent = ArgumentCaptor.forClass(List.class);
        verify(models).invokeChatTurnOnEndpoint(same(context.endpoint), any(), sent.capture(), any(), isNull(), isNull());
        var content = (List<Map<String, Object>>) sent.getValue().get(1).get("content");
        assertEquals(2, content.stream().filter(p -> "image_url".equals(p.get("type"))).count(), "the pixels themselves, not names");
        assertFalse(sent.getValue().toString().contains("ipstudio_source"), "no storage key reaches the model");
        assertEquals(1800L, context.budget.inputTokens());
        assertEquals(1, context.budget.modelCalls());
    }

    @Test void aKeyTheUserDoesNotOwnIsRefusedBeforeAnyModelCall() throws Exception {
        var models = mock(AiModelInvocationService.class);
        var projects = mock(IpProjectService.class);
        when(projects.requireOwnedAssetKey(anyString(), anyString())).thenThrow(BusinessException.badRequest("STUDIO_ASSET_NOT_OWNED", "素材不属于你"));
        var tool = viewer(models, projects);
        var args = om.createObjectNode();
        args.putArray("nodeIds").add("male");
        var run = tool.run(args, ctx(original, "production", null, endpoint(true)), HANDLE);
        assertEquals("failed", run.status());
        verifyNoInteractions(models);
    }

    @Test void viewImagesRejectsTextNodesEmptyPicturesAndTooManyFrames() {
        var tool = new ViewImagesTool(null, null, null);
        var context = ctx(original, "production", null, endpoint(true));
        var empty = om.createObjectNode(); empty.putArray("nodeIds").add("empty");
        assertNotNull(tool.validate(empty, context));
        var none = om.createObjectNode(); none.putArray("nodeIds");
        assertNotNull(tool.validate(none, context));
        var five = om.createObjectNode(); var ids = five.putArray("nodeIds"); for (int i = 0; i < 5; i++) ids.add("male");
        assertNotNull(tool.validate(five, context));
    }

    @Test void theDigestSaysPicturesAreNotInItSoNamesAreNotReadAsContent() {
        String digest = DialogueCanvasDigest.build(doc, List.of(), List.of());
        assertTrue(digest.contains("画面要用 view_images 看"), digest);
    }
}
