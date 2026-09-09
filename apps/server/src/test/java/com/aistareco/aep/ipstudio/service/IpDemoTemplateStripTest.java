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
            storage, IpStudioFixtures.props(), IpStudioFixtures.videoJobs(), IpStudioFixtures.OM);

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
                storage, IpStudioFixtures.props(), IpStudioFixtures.videoJobs(), IpStudioFixtures.OM);
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
    void 模板深层不留任何素材指针() {
        String json = publish(IpDemoTemplate.KIND_TEMPLATE).toString();
        assertFalse(json.contains("storageKey"), "任意深度都不该留下 storageKey：" + json);
        assertFalse(json.contains("ipstudio_gen/"), "更不该留下作者的私有 key：" + json);
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
