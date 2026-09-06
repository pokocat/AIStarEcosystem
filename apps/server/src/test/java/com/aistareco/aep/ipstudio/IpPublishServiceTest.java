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

    @BeforeEach
    void setUp() {
        projects = new IpStudioFixtures.Projects();
        runs = new IpStudioFixtures.Runs();
        avatarRows = new LinkedHashMap<>();
        lookRows = new LinkedHashMap<>();
        versionCalls = new ArrayList<>();

        IpProjectService projectService = new IpProjectService(projects.repo, runs.repo,
                new IpCatalogService(OM), IpStudioFixtures.storage(), IpStudioFixtures.props(), OM);

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

        svc = new IpPublishService(projectService, avatars, lookRepo,
                new DapSupport(), multimodal);
    }

    /** 主形象与形象卡都已选好图的完整画布。 */
    private void seedPublishableProject() {
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(MASTER_RUN, 0);
        ObjectNode gen = (ObjectNode) d.root.path("nodes").get(5).path("data");
        gen.put("selectedRunId", LOOK_RUN).put("selectedIndex", 0);
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
        // 主图复用 generate 阶段的 key，不重复上传
        assertEquals(IpStudioFixtures.genKey(USER, "n-master-1.png"), a.getImageKey());
        assertEquals(4, a.getVariantKeys().size(), "主 generate 的全部候选进 variantKeys");
        assertEquals("same person, consistent facial identity, oval face", a.getBasePrompt());
        assertTrue(a.getDescPrompt().contains("创可贴"));
        assertEquals("some-image-model", a.getEngine());
        // 特征卡的中文小标题被解析进 dap 的 def 键
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
        assertEquals("穿针织衫拿着手机", look.getLabel(), "造型名取上游形象卡的标题");
        assertEquals("design", look.getSource());
        assertEquals("done", look.getStatus());
        assertEquals(IpStudioFixtures.genKey(USER, "n-gen-0.png"), look.getImageKey());
        assertEquals("a rendered prompt for n-gen", look.getPrompt());

        // 项目落成发布态并记下封面
        IpProject p = projects.rows.get(PID);
        assertEquals(IpProject.STATUS_PUBLISHED, p.getStatus());
        assertEquals("DH-51234", p.getPublishedAvatarId());
        assertEquals(IpStudioFixtures.genKey(USER, "n-master-1.png"), p.getCoverKey());
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
        // master 选好了，但 look 的 generate 没选图
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(MASTER_RUN, 0);
        projects.repo.save(IpStudioFixtures.project(PID, USER, d));
        runs.repo.save(IpStudioFixtures.doneGenerateRun(MASTER_RUN, PID, "n-master", 4));

        BusinessException e = assertThrows(BusinessException.class, () -> svc.publish(USER, PID,
                new IpPublishRequest("小蓝", "n-master", List.of("n-gen"))));
        assertEquals("IP_PUBLISH_SELECTION_REQUIRED", e.getCode());
        assertTrue(avatarRows.isEmpty());
        assertTrue(lookRows.isEmpty());
    }

    @Test
    void selectedRunFromAnotherProjectIsRejected() {
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(MASTER_RUN, 0);
        projects.repo.save(IpStudioFixtures.project(PID, USER, d));
        // 指向的 run 属于另一个项目 —— 不能靠伪造 doc 把别处的图拿来发布
        runs.repo.save(IpStudioFixtures.doneGenerateRun(MASTER_RUN, "IPP-elsewhere", "n-master", 4));

        assertEquals("IP_PUBLISH_SELECTION_REQUIRED", assertThrows(BusinessException.class,
                () -> svc.publish(USER, PID, new IpPublishRequest("小蓝", "n-master", List.of()))).getCode());
    }

    @Test
    void nonGenerateMasterNodeIs400() {
        seedPublishableProject();
        assertEquals("IP_PUBLISH_SELECTION_REQUIRED", assertThrows(BusinessException.class,
                () -> svc.publish(USER, PID, new IpPublishRequest("小蓝", "n-style", List.of()))).getCode());
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
    void selectedRunOfAnotherOwnerIsRejected() {
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(MASTER_RUN, 0);
        projects.repo.save(IpStudioFixtures.project(PID, USER, d));
        // 项目 id 对得上，但那次运行是别人的 —— 只按 runId 查就会把别人的图登记成本人的资产
        var foreign = IpStudioFixtures.doneGenerateRun(MASTER_RUN, PID, "n-master", 4);
        foreign.setOwnerUserId(OTHER);
        runs.repo.save(foreign);

        assertEquals("IP_PUBLISH_SELECTION_REQUIRED", assertThrows(BusinessException.class,
                () -> svc.publish(USER, PID, new IpPublishRequest("小蓝", "n-master", List.of()))).getCode());
        assertTrue(avatarRows.isEmpty());
    }
}
