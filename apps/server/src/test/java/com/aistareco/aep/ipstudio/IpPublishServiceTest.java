package com.aistareco.aep.ipstudio;

import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapLook;
import com.aistareco.aep.dap.repository.DapLookRepository;
import com.aistareco.aep.dap.service.DapAvatarService;
import com.aistareco.aep.dap.service.DapMultimodalClient;
import com.aistareco.aep.dap.service.DapSupport;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpPublishResultDto;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpPublishRequest;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.service.IpCatalogService;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpPublishService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.aistareco.aep.ipstudio.IpStudioFixtures.OM;
import static com.aistareco.aep.ipstudio.IpStudioFixtures.OTHER;
import static com.aistareco.aep.ipstudio.IpStudioFixtures.USER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** 发布：建 DapAvatar + DapLook、重复发布 409、未选图 400。 */
class IpPublishServiceTest {

    private static final String PID = "IPP-44444444";
    private static final String MASTER_RUN = "IPR-mrun0001";
    private static final String LOOK_RUN = "IPR-lrun0001";

    private IpStudioFixtures.Projects projects;
    private IpStudioFixtures.Runs runs;
    private Map<String, DapAvatar> avatarRows;
    private Map<String, DapLook> lookRows;
    private List<Object[]> versionCalls;
    private IpPublishService svc;
    private com.aistareco.aep.dap.repository.DapDerivativeRepository derivRepo;
    private final java.util.List<com.aistareco.aep.dap.model.DapDerivative> derivRows = new java.util.ArrayList<>();

    @BeforeEach
    void setUp() {
        projects = new IpStudioFixtures.Projects();
        runs = new IpStudioFixtures.Runs();
        avatarRows = new LinkedHashMap<>();
        lookRows = new LinkedHashMap<>();
        versionCalls = new ArrayList<>();

        IpProjectService projectService = new IpProjectService(projects.repo, runs.repo,
                new IpCatalogService(OM), IpStudioFixtures.storage(), IpStudioFixtures.props(), IpStudioFixtures.videoJobs(), OM);

        DapAvatarService avatars = mock(DapAvatarService.class);
        when(avatars.uniqueId(anyString())).thenReturn("DH-51234");
        doAnswer(inv -> {
            DapAvatar a = inv.getArgument(0);
            avatarRows.put(a.getId(), a);
            return null;
        }).when(avatars).save(any());
        doAnswer(inv -> {
            versionCalls.add(new Object[]{inv.getArgument(1), inv.getArgument(2), inv.getArgument(3)});
            return null;
        }).when(avatars).addVersionAt(any(), anyInt(), anyString(), anyString(), any());

        DapLookRepository lookRepo = mock(DapLookRepository.class);
        when(lookRepo.save(any())).thenAnswer(inv -> {
            DapLook l = inv.getArgument(0);
            lookRows.put(l.getId(), l);
            return l;
        });

        DapMultimodalClient multimodal = mock(DapMultimodalClient.class);
        when(multimodal.imageModel()).thenReturn("some-image-model");

        derivRepo = mock(com.aistareco.aep.dap.repository.DapDerivativeRepository.class);
        when(derivRepo.save(org.mockito.ArgumentMatchers.any(com.aistareco.aep.dap.model.DapDerivative.class)))
                .thenAnswer(i -> {
                    com.aistareco.aep.dap.model.DapDerivative d = i.getArgument(0);
                    derivRows.add(d);
                    return d;
                });
        svc = new IpPublishService(projectService, avatars, lookRepo, derivRepo,
                new DapSupport(), multimodal);
    }

    /** 主形象与变体都已经出好图的完整画布 —— 发布要求每个节点都真有图。 */
    private void seedPublishableProject() {
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(
                IpStudioFixtures.genKey(USER, "master-1.png"), 0);
        ObjectNode master = d.data("n-master");
        master.put("prompt", "脸型：鹅蛋脸\n五官：大眼高鼻\n标志性特征：左脸颊创可贴\n气质：安静少年感");
        var imgs = master.putArray("images");
        for (int i = 1; i <= 4; i++) {
            imgs.addObject().put("id", "img-" + i)
                    .put("storageKey", IpStudioFixtures.genKey(USER, "master-" + i + ".png"));
        }
        master.put("primaryImageId", "img-1");
        d.data("n-gen").put("storageKey", IpStudioFixtures.genKey(USER, "look.png"));
        d.node("n-note", "text").put("content", "一张便签");
        projects.repo.save(IpStudioFixtures.project(PID, USER, d));
        runs.repo.save(IpStudioFixtures.doneGenerateRun(MASTER_RUN, PID, "n-master", 4));
        runs.repo.save(IpStudioFixtures.doneGenerateRun(LOOK_RUN, PID, "n-gen", 2));
    }

    @Test
    void publishCreatesAvatarAndLooks() {
        seedPublishableProject();

        IpPublishResultDto result = svc.publish(USER, PID,
                new IpPublishRequest("小蓝", "n-master", List.of("n-gen")));

        assertEquals("DH-51234", result.avatarId());
        assertEquals(1, result.lookIds().size());

        DapAvatar a = avatarRows.get("DH-51234");
        assertNotNull(a);
        assertEquals("小蓝", a.getName());
        assertEquals("ai", a.getPath());
        assertEquals("finalized", a.getStatus());
        assertEquals(USER, a.getOwnerUserId());
        // 主图直接复用画布上那张图的 key，不重复上传
        assertEquals(IpStudioFixtures.genKey(USER, "master-1.png"), a.getImageKey());
        assertEquals(4, a.getVariantKeys().size(), "主形象的全部候选进 variantKeys");
        assertTrue(a.getDescPrompt().contains("创可贴"), "主形象的提示词就是它的设定：" + a.getDescPrompt());
        assertEquals("some-image-model", a.getEngine());
        // 提示词里「中文小标题：内容」那种行被解析进 dap 的设定档案
        assertEquals("鹅蛋脸 / 大眼高鼻", a.getDef().get("脸部特征"));
        assertEquals("左脸颊创可贴", a.getDef().get("标志性特征"));
        assertEquals("安静少年感", a.getDef().get("核心气质"));
        assertEquals("安静少年感", a.getTagline());
        assertEquals("AI IP 工作台", a.getDef().get("形象来源"));

        // v1 初始版本事件
        assertEquals(1, versionCalls.size());
        assertEquals("init", versionCalls.get(0)[2]);

        DapLook look = lookRows.values().iterator().next();
        assertTrue(look.getId().startsWith("LK-"), look.getId());
        assertEquals("DH-51234", look.getAvatarId());
        assertEquals("穿针织衫拿着手机", look.getLabel(), "造型名取节点标题");
        assertEquals("design", look.getSource());
        assertEquals("done", look.getStatus());
        assertEquals(IpStudioFixtures.genKey(USER, "look.png"), look.getImageKey());
        // 造型提示词取节点上用户写的那段 —— 比翻运行记录准：图可能是好几次运行之后才定下来的
        assertEquals("米白色针织冷帽，浅驼色露肩针织衫，双手持手机低头看屏幕", look.getPrompt());

        // 项目落成发布态并记下封面
        IpProject p = projects.rows.get(PID);
        assertEquals(IpProject.STATUS_PUBLISHED, p.getStatus());
        assertEquals("DH-51234", p.getPublishedAvatarId());
        assertEquals(IpStudioFixtures.genKey(USER, "master-1.png"), p.getCoverKey());
    }

    @Test
    void republishIs409() {
        seedPublishableProject();
        svc.publish(USER, PID, new IpPublishRequest("小蓝", "n-master", List.of("n-gen")));

        BusinessException e = assertThrows(BusinessException.class, () -> svc.publish(USER, PID,
                new IpPublishRequest("小蓝", "n-master", List.of("n-gen"))));
        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        assertEquals("IP_PROJECT_ALREADY_PUBLISHED", e.getCode());
    }

    @Test
    void masterWithoutSelectedCandidateIs400() {
        // master 节点没有 selectedRunId
        projects.repo.save(IpStudioFixtures.project(PID, USER, IpStudioFixtures.chainDoc(null, 0)));

        BusinessException e = assertThrows(BusinessException.class, () -> svc.publish(USER, PID,
                new IpPublishRequest("小蓝", "n-master", List.of())));
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        assertEquals("IP_PUBLISH_SELECTION_REQUIRED", e.getCode());
        assertTrue(avatarRows.isEmpty(), "校验不过就不许留下半个资产");
    }

    @Test
    void lookWithoutSelectedCandidateIs400() {
        // 主形象出好了，但变体那个节点还没出图 —— 发布它只会产出一个空壳造型
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(IpStudioFixtures.genKey(USER, "m.png"), 0);
        projects.repo.save(IpStudioFixtures.project(PID, USER, d));

        BusinessException e = assertThrows(BusinessException.class, () -> svc.publish(USER, PID,
                new IpPublishRequest("小蓝", "n-master", List.of("n-gen"))));
        assertEquals("IP_PUBLISH_SELECTION_REQUIRED", e.getCode());
        assertTrue(avatarRows.isEmpty());
        assertTrue(lookRows.isEmpty());
    }

    @Test
    void imageKeyOfAnotherOwnerIsRejected() {
        // doc 是客户端写的：把别人的图 key 抄进来就想发布成自己的资产。
        // 拦在 requireOwnedAssetKey（前缀闸）—— 属性不变，换了道门而已。
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(
                IpStudioFixtures.genKey(OTHER, "victim.png"), 0);
        projects.repo.save(IpStudioFixtures.project(PID, USER, d));

        assertEquals("IP_ASSET_KEY_INVALID", assertThrows(BusinessException.class,
                () -> svc.publish(USER, PID, new IpPublishRequest("小蓝", "n-master", List.of()))).getCode());
        assertTrue(avatarRows.isEmpty(), "越权 key 不该留下任何资产");
    }

    @Test
    void nonImageMasterNodeIs400() {
        seedPublishableProject();
        // 文字节点上没有图，发布它只会产出一个空壳资产
        assertEquals("IP_PUBLISH_SELECTION_REQUIRED", assertThrows(BusinessException.class,
                () -> svc.publish(USER, PID, new IpPublishRequest("小蓝", "n-note", List.of()))).getCode());
    }

    @Test
    void missingMasterNodeIdIs400() {
        seedPublishableProject();
        assertEquals("IP_PUBLISH_SELECTION_REQUIRED", assertThrows(BusinessException.class,
                () -> svc.publish(USER, PID, new IpPublishRequest("小蓝", " ", List.of()))).getCode());
    }

    @Test
    void otherOwnerCannotPublish() {
        seedPublishableProject();
        assertEquals("IP_PROJECT_NOT_FOUND", assertThrows(BusinessException.class,
                () -> svc.publish(OTHER, PID, new IpPublishRequest("小蓝", "n-master", List.of()))).getCode());
    }

    @Test
    void masterNodeIdIsNotDuplicatedIntoLooks() {
        seedPublishableProject();
        IpPublishResultDto result = svc.publish(USER, PID,
                new IpPublishRequest("小蓝", "n-master", List.of("n-master", "n-gen")));
        assertEquals(1, result.lookIds().size(), "主形象节点不能同时被当成造型");
        assertEquals("小蓝", avatarRows.get("DH-51234").getName());
    }

    @Test
    void blankAvatarNameIs400_insteadOfSilentlyUsingTheProjectName() {
        // 悄悄拿项目名替，用户会看到资产库里冒出一个叫「未命名 IP 项目」的资产，只会以为发布坏了
        seedPublishableProject();
        assertEquals("IP_PUBLISH_NAME_REQUIRED", assertThrows(BusinessException.class,
                () -> svc.publish(USER, PID, new IpPublishRequest(" ", "n-master", List.of()))).getCode());
        assertEquals("IP_PUBLISH_NAME_REQUIRED", assertThrows(BusinessException.class,
                () -> svc.publish(USER, PID, new IpPublishRequest(null, "n-master", List.of()))).getCode());
        assertTrue(avatarRows.isEmpty(), "校验不过就不许留下半个资产");
    }

    @Test
    void traversalImageKeyIsRejected() {
        // ../ 能把本机任意文件当图片发布成资产
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 0);
        d.data("n-master").put("storageKey", "ipstudio_gen/" + USER + "/../../../etc/passwd");
        projects.repo.save(IpStudioFixtures.project(PID, USER, d));

        assertEquals("IP_ASSET_KEY_INVALID", assertThrows(BusinessException.class,
                () -> svc.publish(USER, PID, new IpPublishRequest("小蓝", "n-master", List.of()))).getCode());
        assertTrue(avatarRows.isEmpty());
    }

    @Test
    @org.junit.jupiter.api.DisplayName("发布把画布上的成片登记成视频类衍生资产 —— 名片才有的选")
    void publishRegistersCanvasVideosAsAssets() throws Exception {
        seedPublishableProject();
        // 一条跑成的视频 + 一个还没跑出来的空节点
        IpProject p = projects.rows.get(PID);
        com.fasterxml.jackson.databind.JsonNode doc = IpStudioFixtures.OM.readTree(p.getDocJson());
        com.fasterxml.jackson.databind.node.ArrayNode nodes =
                (com.fasterxml.jackson.databind.node.ArrayNode) doc.get("nodes");
        addVideoNode(nodes, "n-v1", "开屏打招呼", IpStudioFixtures.genKey(USER, "v1.mp4"), "8");
        addVideoNode(nodes, "n-v2", "还没跑", null, null);
        p.setDocJson(doc.toString());

        svc.publish(USER, PID, new IpPublishRequest("潮玩个人IP", "n-master", java.util.List.of()));

        assertEquals(1, derivRows.size(), "只该登记已经跑出来的那条");
        var d = derivRows.get(0);
        assertEquals("video", d.getKind());
        assertEquals("video", d.getDerivKey());
        assertEquals("开屏打招呼", d.getLabel());
        assertEquals("8s · MP4", d.getSpec());
        org.junit.jupiter.api.Assertions.assertNull(d.getThumbKey(),
                "没有真封面就别塞一个指向 MP4 的假封面（那是一张裂图）");
    }

    private static void addVideoNode(com.fasterxml.jackson.databind.node.ArrayNode nodes,
                                     String id, String title, String key, String seconds) {
        com.fasterxml.jackson.databind.node.ObjectNode n = nodes.addObject();
        n.put("id", id).put("type", "video").put("title", title);
        n.putObject("position").put("x", 0).put("y", 0);
        n.put("width", 320).put("height", 480);
        com.fasterxml.jackson.databind.node.ObjectNode md = n.putObject("metadata");
        if (key != null) md.put("storageKey", key);
        if (seconds != null) md.put("seconds", seconds);
        md.put("status", "success");
    }

    @Test
    @org.junit.jupiter.api.DisplayName("视频资产名收拾成人话 —— 画布里那个「标题」其实是整段提示词")
    void videoLabelIsReadable() {
        // 真实的画布视频节点标题长这样（带分段标记 + 换行）
        assertEquals("主角是参考图中的潮玩女孩",
                IpPublishService.videoLabel("【主体与画风】主角是参考图中的潮玩女孩，纯白色干净棚拍背景。\n【运镜】缓慢推近", 0));
        // 只剩标记 / 空白 → 退回可读的默认名，不给一个空标签
        assertEquals("动态形象 2", IpPublishService.videoLabel("【运镜】", 1));
        assertEquals("动态形象 1", IpPublishService.videoLabel(null, 0));
        assertEquals("动态形象 1", IpPublishService.videoLabel("   ", 0));
    }
}
