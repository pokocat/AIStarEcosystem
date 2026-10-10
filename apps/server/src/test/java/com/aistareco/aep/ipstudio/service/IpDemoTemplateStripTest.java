package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.IpStudioFixtures;
import com.aistareco.aep.ipstudio.model.IpDemoTemplate;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.repository.IpDemoTemplateRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 「存为全局模板」到底剥掉了什么（Codex 复核 v0.192 提出的两条）。
 *
 * <p>模板与实例的区别不是「少复制几个文件」：
 * <ul>
 *   <li><b>剥少了</b> —— 留着 {@code runId} / {@code videoTaskId}，别人打开模板时画布会判定
 *       「有任务号又没有 content = 上次没跑完」，自动去接<b>作者的</b>那次运行，
 *       被归属闸正确地拒掉 —— 干净的模板变成一堆报错节点。</li>
 *   <li><b>剥多了</b> —— 无条件删 {@code content} 会把文字节点的<b>正文</b>一起抹掉，
 *       而模板里那些「① 你的照片」正是工作流本身。用户看到一排空白方块。</li>
 * </ul>
 */
class IpDemoTemplateStripTest {

    private static final String OWNER = "u-1";
    private static final String PROJECT = "IPP-1";

    private final FileStorageService storage = IpStudioFixtures.storage();

    /**
     * 复制素材要真读一遍文件（{@code copyKey} → {@code openForRead}）。读不出来它会
     * 「跳过那一张」并只打 WARN —— 不喂真文件的话，实例那几条断言测的是「跳过」而不是「复制」。
     */
    {
        try {
            java.nio.file.Path f = java.nio.file.Files.createTempFile("ip-demo-src", ".png");
            java.nio.file.Files.write(f, IpStudioFixtures.pngBytes());
            f.toFile().deleteOnExit();
            when(storage.openForRead(anyString())).thenReturn(f);
        } catch (Exception e) {
            throw new AssertionError(e);
        }
    }
    private final IpDemoTemplateRepository demoRepo = mock(IpDemoTemplateRepository.class);
    private final IpProjectService projects = new IpProjectService(
            new IpStudioFixtures.Projects().repo, new IpStudioFixtures.Runs().repo,
            new IpCatalogService(IpStudioFixtures.OM), IpStudioFixtures.templateResolver(),
            storage, IpStudioFixtures.props(), IpStudioFixtures.videoJobs(), IpStudioFixtures.OM, org.mockito.Mockito.mock(com.aistareco.aep.ipstudio.repository.IpProjectRevisionRepository.class));

    /** 一份「跑完了的」画布：一个出过图的图节点 + 一个正文文字节点 + 一个出过片的视频节点。 */
    private ObjectNode busyDoc() {
        ObjectNode doc = IpStudioFixtures.OM.createObjectNode();
        ArrayNode nodes = doc.putArray("nodes");
        doc.putArray("connections");

        ObjectNode img = nodes.addObject();
        img.put("id", "n-img").put("type", "image").put("title", "主形象");
        ObjectNode im = img.putObject("metadata");
        im.put("prompt", "3D 玩偶，全身照");
        im.put("storageKey", IpStudioFixtures.OM.getNodeFactory().textNode(
                "ipstudio_gen/" + OWNER + "/master.png").asText());
        im.put("content", "https://cdn.test/ipstudio_gen/" + OWNER + "/master.png?sig=x");
        im.put("status", "success");
        im.put("runId", "IPR-aaa");
        ObjectNode cand = im.putArray("images").addObject();
        cand.put("id", "c1").put("status", "success")
                .put("storageKey", "ipstudio_gen/" + OWNER + "/c1.png")
                .put("content", "https://cdn.test/x?sig=y")
                .put("runId", "IPR-aaa");
        im.put("primaryImageId", "c1");
        // 蒙版编辑那次点名的参考图：存的是**裸 storageKey**，模板里留着就是作者的私有素材键
        im.put("generationType", "edit");
        im.putArray("references").add("ipstudio_source/" + OWNER + "/ref.png");

        ObjectNode text = nodes.addObject();
        text.put("id", "n-text").put("type", "text").put("title", "第一步");
        text.putObject("metadata")
                .put("content", "① 把你的照片拖到这里")
                .put("status", "success");

        ObjectNode video = nodes.addObject();
        video.put("id", "n-vid").put("type", "video").put("title", "开屏打招呼");
        ObjectNode vm = video.putObject("metadata");
        vm.put("prompt", "挥手打招呼 8s");
        vm.put("storageKey", "material-videos/mvj_1/video.mp4");
        vm.put("content", "https://cdn.test/mvj?sig=z");
        vm.put("videoTaskId", "mvj_1");
        vm.put("videoTaskProvider", "plugin");
        ObjectNode take = vm.putArray("videos").addObject();
        take.put("id", "v1").put("status", "success")
                .put("storageKey", "material-videos/mvj_0/video.mp4")
                .put("content", "https://cdn.test/old?sig=z");
        vm.put("primaryVideoId", "v1");
        return doc;
    }

    private IpDemoTemplateService svcWith(ObjectNode doc) {
        IpProject p = IpProject.builder().id(PROJECT).ownerUserId(OWNER).name("我的 IP")
                .docJson(doc.toString()).createdAt(Instant.now()).updatedAt(Instant.now()).build();
        var projRepo = new IpStudioFixtures.Projects();
        projRepo.repo.save(p);
        IpProjectService ps = new IpProjectService(
                projRepo.repo, new IpStudioFixtures.Runs().repo,
                new IpCatalogService(IpStudioFixtures.OM), IpStudioFixtures.templateResolver(),
                storage, IpStudioFixtures.props(), IpStudioFixtures.videoJobs(), IpStudioFixtures.OM, org.mockito.Mockito.mock(com.aistareco.aep.ipstudio.repository.IpProjectRevisionRepository.class));
        when(demoRepo.findById(anyString())).thenReturn(Optional.empty());
        when(demoRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        return new IpDemoTemplateService(demoRepo, ps, storage, IpStudioFixtures.OM);
    }

    private JsonNode publish(String kind) {
        IpDemoTemplateService svc = svcWith(busyDoc());
        svc.publishFromProject(OWNER, PROJECT, null, "潮玩三连", null, kind);
        ArgumentCaptor<IpDemoTemplate> cap = ArgumentCaptor.forClass(IpDemoTemplate.class);
        verify(demoRepo).save(cap.capture());
        try {
            return IpStudioFixtures.OM.readTree(cap.getValue().getDocJson());
        } catch (Exception e) {
            throw new AssertionError(e);
        }
    }

    private static Map<String, JsonNode> byId(JsonNode doc) {
        Map<String, JsonNode> m = new LinkedHashMap<>();
        for (JsonNode n : doc.path("nodes")) m.put(n.path("id").asText(), n.path("metadata"));
        return m;
    }

    @Test
    void publishedCharacterCopiesKeepGroupsAndRolesWithoutPrivateAvatarIdentity() throws Exception {
        ObjectNode doc=busyDoc();var nodes=(ArrayNode)doc.path("nodes");
        var main=(ObjectNode)nodes.get(0).path("metadata");
        main.set("studio",IpStudioFixtures.OM.readTree("{\"kind\":\"ip\",\"libraryAssetRole\":\"main\",\"adoption\":{\"avatarId\":\"private-avatar-1\",\"ipId\":\"private-ip\"}}"));
        var detail=nodes.addObject().put("id","detail").put("type","image").put("title","衣服细节");
        var md=detail.putObject("metadata").put("storageKey","ipstudio_gen/"+OWNER+"/detail.png");
        md.set("studio",IpStudioFixtures.OM.readTree("{\"kind\":\"ip\",\"libraryAssetRole\":\"detail\",\"adoption\":{\"avatarId\":\"private-avatar-1\"}}"));
        var other=nodes.addObject().put("id","other").put("type","image").put("title","另一人物");
        other.putObject("metadata").put("storageKey","ipstudio_gen/"+OWNER+"/other.png").putObject("studio").put("kind","ip").putObject("adoption").put("avatarId","private-avatar-2");
        var row=svcWith(doc).publishFromProject(OWNER,PROJECT,null,"角色包",null,IpDemoTemplate.KIND_EXAMPLE);
        var published=IpStudioFixtures.OM.readTree(row.getDocJson());
        var byId=byId(published);
        var mainPublic=byId.get("n-img").path("studio");var detailPublic=byId.get("detail").path("studio");
        assertEquals(mainPublic.path("libraryCharacterId"),detailPublic.path("libraryCharacterId"));
        assertFalse(mainPublic.path("libraryCharacterId").equals(byId.get("other").path("studio").path("libraryCharacterId")));
        assertEquals("主形象",detailPublic.path("libraryCharacterName").asText());
        assertEquals("detail",detailPublic.path("libraryAssetRole").asText());
        assertFalse(row.getDocJson().contains("private-avatar"));assertFalse(row.getDocJson().contains("private-ip"));
        var demos=mock(com.aistareco.aep.ipstudio.repository.IpDemoTemplateRepository.class);
        when(demos.findByEnabledTrueOrderBySortOrderAscCreatedAtAsc()).thenReturn(java.util.List.of(row));
        var library=new StudioIpAssetService(mock(com.aistareco.aep.dap.repository.DapAvatarRepository.class),mock(com.aistareco.aep.dap.repository.DapAvatarVersionRepository.class),storage,mock(com.aistareco.aep.dap.repository.DapLookRepository.class));
        org.springframework.test.util.ReflectionTestUtils.setField(library,"officialDemos",demos);
        var assets=library.officialAssets();assertEquals(3,assets.size());
        var mainAsset=assets.stream().filter(a->"主形象".equals(a.name())).findFirst().orElseThrow();
        var detailAsset=assets.stream().filter(a->"衣服细节".equals(a.name())).findFirst().orElseThrow();
        assertEquals(mainAsset.avatarId(),detailAsset.avatarId());assertEquals("主形象",detailAsset.characterName());assertEquals("detail",detailAsset.assetRole());
        assertTrue(mainAsset.current());assertFalse(detailAsset.current());assertNull(detailAsset.ipId());
    }

    @Test
    void studioPublicationKeepsAuthoredStructureButNoAuthorExecutionOrIdentity() throws Exception {
        ObjectNode doc=busyDoc();var md=(ObjectNode)doc.path("nodes").get(1).path("metadata");
        md.set("studio",IpStudioFixtures.OM.readTree("{\"kind\":\"script\",\"settings\":{\"episodeCount\":2},\"script\":{\"title\":\"原稿\"},\"request\":{\"clientRequestId\":\"old-request\"},\"runId\":\"IPR-author\",\"references\":[{\"storageKey\":\"private\",\"avatarId\":\"author-avatar\"}],\"adoption\":{\"ipId\":\"author-ip\"},\"conversation\":{\"turns\":[{\"content\":\"private chat\"}]},\"batch\":{\"approvedCost\":50}}"));
        var authorStudio=(ObjectNode)md.path("studio");
        authorStudio.putObject("speechRequest").put("clientRequestId","private-speech-request").put("text","private speech text");
        authorStudio.putObject("lipSyncRequest").put("clientRequestId","private-lip-request").put("videoStorageKey","private-video-key").put("audioStorageKey","private-audio-key");
        authorStudio.put("lipSyncNormalized",true);
        var svc=svcWith(doc);var row=svc.publishFromProject(OWNER,PROJECT,null,"模板",null,IpDemoTemplate.KIND_TEMPLATE);
        var published=IpStudioFixtures.OM.readTree(row.getDocJson());var studio=published.path("nodes").get(1).path("metadata").path("studio");
        assertEquals(2,studio.path("settings").path("episodeCount").asInt());assertEquals("原稿",studio.path("script").path("title").asText());
        for(String value:new String[]{"old-request","IPR-author","author-avatar","author-ip","private chat","approvedCost","private-speech-request","private speech text","private-lip-request","private-video-key","private-audio-key","lipSyncNormalized"})assertFalse(published.toString().contains(value));
    }

    @Test
    void exampleRemovesStudioRuntimeWhileRetainingCopiedOutput() throws Exception {
        ObjectNode doc=busyDoc();var md=(ObjectNode)doc.path("nodes").get(0).path("metadata");
        md.set("studio",IpStudioFixtures.OM.readTree("{\"kind\":\"shot\",\"shot\":{\"id\":\"shot-1\"},\"runId\":\"IPR-author\",\"request\":{\"clientRequestId\":\"old-request\"},\"adoption\":{\"avatarId\":\"author-avatar\"}}"));
        var row=svcWith(doc).publishFromProject(OWNER,PROJECT,null,"示例",null,IpDemoTemplate.KIND_EXAMPLE);
        var published=IpStudioFixtures.OM.readTree(row.getDocJson());var image=published.path("nodes").get(0).path("metadata");
        assertEquals("shot-1",image.path("studio").path("shot").path("id").asText());assertTrue(image.path("storageKey").asText().startsWith("ipstudio_demo/"));
        assertFalse(published.toString().contains("IPR-author"));assertFalse(published.toString().contains("author-avatar"));assertFalse(published.toString().contains("old-request"));
    }

    @Test
    void templateAndExampleExcludePrivateAssistantTextAndApprovedBatchNodes() throws Exception {
        for(String kind:java.util.List.of(IpDemoTemplate.KIND_TEMPLATE,IpDemoTemplate.KIND_EXAMPLE)) {
            ObjectNode doc=busyDoc();var nodes=(ArrayNode)doc.path("nodes");
            for(String auxiliary:java.util.List.of("assistant","batch")) {
                var node=nodes.addObject().put("id",auxiliary).put("type","text");
                var md=node.putObject("metadata").put("prompt","private request").put("content","private reply");
                md.putObject("studio").put("kind",auxiliary);
                ((ArrayNode)doc.path("connections")).addObject().put("fromNodeId","n-text").put("toNodeId",auxiliary);
            }
            ((ArrayNode)doc.path("connections")).addObject().put("fromNodeId","n-text").put("toNodeId","n-img");
            ((ObjectNode)nodes.get(1).path("metadata")).putObject("studio").put("kind","script").put("parentNodeId","assistant");
            var row=svcWith(doc).publishFromProject(OWNER,PROJECT,null,"公开内容",null,kind);
            var published=IpStudioFixtures.OM.readTree(row.getDocJson());
            assertEquals(3,published.path("nodes").size());assertEquals(1,published.path("connections").size());
            assertFalse(published.path("nodes").get(1).path("metadata").path("studio").has("parentNodeId"));
            assertFalse(published.toString().contains("private request"));assertFalse(published.toString().contains("private reply"));
        }
    }

    @Test
    void 模板保留文字正文() {
        JsonNode md = byId(publish(IpDemoTemplate.KIND_TEMPLATE)).get("n-text");
        assertEquals("① 把你的照片拖到这里", md.path("content").asText(),
                "文字节点的 content 是正文，删掉之后模板里只剩一排空白方块");
    }

    @Test
    void 模板剥掉素材与派生地址() {
        Map<String, JsonNode> md = byId(publish(IpDemoTemplate.KIND_TEMPLATE));
        for (String id : new String[]{"n-img", "n-vid"}) {
            JsonNode m = md.get(id);
            for (String f : new String[]{"storageKey", "content", "url", "images", "videos",
                    "primaryImageId", "primaryVideoId"}) {
                assertTrue(m.path(f).isMissingNode(), id + " 的 " + f + " 该被剥掉，实际还在：" + m);
            }
            assertEquals(true, m.hasNonNull("prompt"), id + " 的提示词是工作流本身，不能剥");
        }
    }

    @Test
    void 模板剥掉运行凭据_否则别人打开会去接作者的运行() {
        Map<String, JsonNode> md = byId(publish(IpDemoTemplate.KIND_TEMPLATE));
        assertTrue(md.get("n-img").path("runId").isMissingNode(),
                "留着 runId 且没有 content，画布会判定「上次没跑完」并去查作者的运行");
        assertTrue(md.get("n-vid").path("videoTaskId").isMissingNode(),
                "留着 videoTaskId 同理（hasResumableVideoTask）");
        assertTrue(md.get("n-vid").path("videoTaskProvider").isMissingNode());
    }

    @Test
    void 模板剥掉蒙版参考图_那是裸的私有素材键() {
        JsonNode md = byId(publish(IpDemoTemplate.KIND_TEMPLATE)).get("n-img");
        assertTrue(md.path("references").isMissingNode(),
                "references 里是 storageKey（不以 http/blob/data 开头的一律当 key，"
                        + "见 canvas-generation-helpers.ts），留着就是把作者的私有素材键发给所有人");
    }

    @Test
    void 模板深层不留任何素材指针() {
        String json = publish(IpDemoTemplate.KIND_TEMPLATE).toString();
        assertFalse(json.contains("storageKey"), "任意深度都不该留下 storageKey：" + json);
        assertFalse(json.contains("ipstudio_gen/"), "更不该留下作者的私有 key：" + json);
        assertFalse(json.contains("ipstudio_source/"), "上传的原始素材键同样不该留：" + json);
    }

    @Test
    void 实例把候选图与成片历史都复制进示例目录() {
        Map<String, JsonNode> md = byId(publish(IpDemoTemplate.KIND_EXAMPLE));
        String candKey = md.get("n-img").path("images").get(0).path("storageKey").asText();
        String takeKey = md.get("n-vid").path("videos").get(0).path("storageKey").asText();
        assertTrue(candKey.startsWith("ipstudio_demo/"),
                "候选图要复制进示例目录，否则别人签不出来：" + candKey);
        assertTrue(takeKey.startsWith("ipstudio_demo/"),
                "成片历史同样要复制 —— 漏掉就是「当前这版能放、切一版历史签不出来」：" + takeKey);
        assertTrue(md.get("n-img").path("images").get(0).path("content").isMissingNode(),
                "候选上的签名地址带 TTL，不该进示例");
    }

    @Test
    void 实例照旧保留素材() {
        Map<String, JsonNode> md = byId(publish(IpDemoTemplate.KIND_EXAMPLE));
        assertTrue(md.get("n-img").path("storageKey").asText().startsWith("ipstudio_demo/"),
                "实例是「做完的成品」，素材必须跟着走");
    }

    @Test
    void 已有示例改存成模板时旧封面要清掉() {
        IpDemoTemplateService svc = svcWith(busyDoc());
        IpDemoTemplate existing = IpDemoTemplate.builder()
                .id("IPD-old").name("旧示例").enabled(true).sortOrder(0)
                .kind(IpDemoTemplate.KIND_EXAMPLE)
                .coverKey("ipstudio_demo/IPD-old/cover.png")
                .createdAt(Instant.now()).build();
        when(demoRepo.findById("IPD-old")).thenReturn(Optional.of(existing));

        svc.publishFromProject(OWNER, PROJECT, "IPD-old", "改成模板", null,
                IpDemoTemplate.KIND_TEMPLATE);

        assertNull(existing.getCoverKey(),
                "模板不带素材，还挂着上一版示例的封面就是卡片和内容对不上");
        assertEquals(IpDemoTemplate.KIND_TEMPLATE, existing.getKind());
    }
}
