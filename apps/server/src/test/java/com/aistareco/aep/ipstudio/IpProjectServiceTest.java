package com.aistareco.aep.ipstudio;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpProjectDto;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpCreateProjectRequest;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpUpdateProjectRequest;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.IpCatalogService;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import com.aistareco.aep.ipstudio.config.IpStudioProperties;
import org.springframework.mock.web.MockMultipartFile;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.util.List;

import static com.aistareco.aep.ipstudio.IpStudioFixtures.OM;
import static com.aistareco.aep.ipstudio.IpStudioFixtures.OTHER;
import static com.aistareco.aep.ipstudio.IpStudioFixtures.USER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 项目 CRUD、属主隔离、软删、runs 投影（最新 + 被选中的旧运行）、上传校验。 */
class IpProjectServiceTest {

    private static final String PID = "IPP-33333333";

    private IpStudioFixtures.Projects projects;
    private IpStudioFixtures.Runs runs;
    private FileStorageService storage;
    private IpProjectService svc;

    @BeforeEach
    void setUp() {
        projects = new IpStudioFixtures.Projects();
        runs = new IpStudioFixtures.Runs();
        storage = IpStudioFixtures.storage();
        svc = new IpProjectService(projects.repo, runs.repo, new IpCatalogService(OM), storage,
                IpStudioFixtures.props(), OM);
    }

    // ── 创建 ─────────────────────────────────────────────────

    @Test
    void createFromTemplate_prefillsNodeGraph() {
        IpProjectDto dto = svc.create(USER, new IpCreateProjectRequest(null, "portrait-bjd-trio"));
        assertTrue(dto.id().startsWith("IPP-"), dto.id());
        assertEquals("portrait-bjd-trio", dto.templateId());
        assertEquals(IpProject.STATUS_DRAFT, dto.status());
        assertEquals("个人照片 → 潮玩 IP 三连", dto.name());
        // 模板骨架已预排好：三张形象卡 + 主形象 + 发布节点
        assertEquals(11, dto.doc().path("nodes").size());
        assertEquals(13, dto.doc().path("edges").size());
        assertTrue(dto.runs().isEmpty());
    }

    @Test
    void createBlank_hasEmptyCanvas() {
        IpProjectDto dto = svc.create(USER, new IpCreateProjectRequest("我的 IP", null));
        assertEquals("我的 IP", dto.name());
        assertEquals(0, dto.doc().path("nodes").size());
        assertNotNull(dto.doc().path("viewport"));
    }

    @Test
    void createWithUnknownTemplate_is400() {
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.create(USER, new IpCreateProjectRequest(null, "nope")));
        assertEquals("IP_TEMPLATE_NOT_FOUND", e.getCode());
    }

    // ── 属主隔离 / 软删 ──────────────────────────────────────

    @Test
    void otherOwnerSeesNothing() {
        projects.repo.save(IpStudioFixtures.project(PID, USER, IpStudioFixtures.chainDoc(null, 0)));
        assertEquals(1, svc.list(USER).size());
        assertTrue(svc.list(OTHER).isEmpty());
        BusinessException e = assertThrows(BusinessException.class, () -> svc.detail(OTHER, PID));
        assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
        assertEquals("IP_PROJECT_NOT_FOUND", e.getCode());
    }

    @Test
    void softDeleteHidesFromListAndDetail() {
        projects.repo.save(IpStudioFixtures.project(PID, USER, IpStudioFixtures.chainDoc(null, 0)));
        svc.remove(USER, PID);
        assertNotNull(projects.rows.get(PID).getDeletedAt(), "软删：行还在，只是打了时间");
        assertTrue(svc.list(USER).isEmpty());
        assertEquals("IP_PROJECT_NOT_FOUND",
                assertThrows(BusinessException.class, () -> svc.detail(USER, PID)).getCode());
    }

    // ── 保存文档 ─────────────────────────────────────────────

    @Test
    void updateStoresDocVerbatim() {
        projects.repo.save(IpStudioFixtures.project(PID, USER, new IpStudioFixtures.Doc()));
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 2);
        // 客户端自造的未知字段也必须原样保留 —— 文档是客户端拥有的
        ((ObjectNode) d.root).put("clientOnlyField", "keep-me");

        IpProjectDto dto = svc.update(USER, PID, new IpUpdateProjectRequest("改个名", d.root));
        assertEquals("改个名", dto.name());
        assertEquals("keep-me", dto.doc().path("clientOnlyField").asText());
        assertEquals(8, dto.doc().path("nodes").size());
    }

    @Test
    void malformedDocIsRejected() {
        projects.repo.save(IpStudioFixtures.project(PID, USER, new IpStudioFixtures.Doc()));
        ObjectNode bad = OM.createObjectNode();
        bad.put("nodes", "not-an-array");
        assertEquals("IP_DOC_INVALID", assertThrows(BusinessException.class,
                () -> svc.update(USER, PID, new IpUpdateProjectRequest(null, bad))).getCode());
    }

    @Test
    void oversizedDocIs400() {
        projects.repo.save(IpStudioFixtures.project(PID, USER, new IpStudioFixtures.Doc()));
        IpStudioFixtures.Doc d = new IpStudioFixtures.Doc();
        String filler = "x".repeat(4096);
        for (int i = 0; i < 600; i++) {
            d.node("n-" + i, "look").put("details", filler);
        }
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.update(USER, PID, new IpUpdateProjectRequest(null, d.root)));
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        assertEquals("IP_DOC_TOO_LARGE", e.getCode());
    }

    // ── runs 投影 ───────────────────────────────────────────

    @Test
    void runsProjectionKeepsLatestPerNodePlusTheSelectedOlderRun() {
        // 同一个 master 节点跑了两次；用户仍在用第一次的第 2 张候选
        String oldRunId = "IPR-old00001";
        String newRunId = "IPR-new00001";
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(oldRunId, 0);
        projects.repo.save(IpStudioFixtures.project(PID, USER, d));

        IpRun old = IpStudioFixtures.doneGenerateRun(oldRunId, PID, "n-master", 4);
        old.setCreatedAt(Instant.now().minusSeconds(3600));
        runs.repo.save(old);
        IpRun fresh = IpStudioFixtures.doneGenerateRun(newRunId, PID, "n-master", 4);
        fresh.setCreatedAt(Instant.now());
        runs.repo.save(fresh);

        IpProjectDto dto = svc.detail(USER, PID);
        // 节点键位给最新一次
        assertEquals(newRunId, dto.runs().get("n-master").id());
        // runs 只按 nodeId 键，不混入 runId 键
        assertNull(dto.runs().get(oldRunId));
        // 被 selectedRunId 指着的旧运行放进 runsById，否则画布上的选中图会变空白；最新那次也在里面
        assertNotNull(dto.runsById().get(oldRunId));
        assertEquals(oldRunId, dto.runsById().get(oldRunId).id());
        assertEquals(newRunId, dto.runsById().get(newRunId).id());
        assertEquals(2, dto.runsById().size());
    }

    @Test
    void detailResignsSourceAndReferenceImageUrlsFromAssetKey() {
        // §4.7.7：doc 里存的 imageUrl 是上传当时的派生值（会过期 / 带 dev 端口），出 wire 必须按 assetKey 重签
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 1);
        ((ObjectNode) d.nodes.get(0).get("data")).put("imageUrl", "http://localhost:8080/cdn/stale.jpg");
        projects.repo.save(IpStudioFixtures.project(PID, USER, d));

        IpProjectDto dto = svc.detail(USER, PID);
        String sourceUrl = dto.doc().get("nodes").get(0).get("data").get("imageUrl").asText();
        assertEquals("https://cdn.test/" + IpStudioFixtures.sourceKey(USER, "photo.jpg") + "?sig=x", sourceUrl);
        for (com.fasterxml.jackson.databind.JsonNode n : dto.doc().get("nodes")) {
            if (!"reference".equals(n.get("type").asText())) continue;
            String key = n.get("data").get("assetKey").asText();
            assertEquals("https://cdn.test/" + key + "?sig=x", n.get("data").get("imageUrl").asText());
        }
    }

    @Test
    void runsProjectionSignsCandidateUrlsAndHidesExecPlan() {
        String runId = "IPR-sign0001";
        projects.repo.save(IpStudioFixtures.project(PID, USER, IpStudioFixtures.chainDoc(runId, 0)));
        IpRun run = IpStudioFixtures.doneGenerateRun(runId, PID, "n-master", 2);
        ObjectNode inputs = OM.createObjectNode();
        inputs.put("prompt", "p");
        inputs.putObject("_exec").put("secret", "ipstudio/source/photo.jpg");
        try {
            run.setInputJson(OM.writeValueAsString(inputs));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        runs.repo.save(run);

        var dto = svc.detail(USER, PID).runs().get("n-master");
        assertTrue(dto.output().path("candidates").get(0).path("url").asText().startsWith("https://cdn.test/"));
        assertTrue(dto.output().path("candidates").get(0).path("key").asText()
                .startsWith(IpStudioFixtures.genKey(USER, "")));
        assertTrue(dto.inputs().path("_exec").isMissingNode(), "执行参数不出 wire");
    }

    // ── 上传 ─────────────────────────────────────────────────

    @Test
    void uploadAcceptsPngAndReturnsKeyPlusSignedUrl() throws Exception {
        var result = svc.upload(USER, new MockMultipartFile("file", "me.png", "image/png", pngBytes(120, 160)));
        // key 形状 = FileStorageService.buildKey 归一后的 ipstudio_source/<uid>/<uuid>.<ext>
        assertTrue(result.key().startsWith(IpStudioFixtures.sourceKey(USER, "")), result.key());
        assertTrue(result.url().startsWith("https://cdn.test/"));
        assertEquals(120, result.width());
        assertEquals(160, result.height());
        assertEquals("me.png", result.fileName());
    }

    @Test
    void uploadRejectsWrongType() {
        BusinessException e = assertThrows(BusinessException.class, () -> svc.upload(USER,
                new MockMultipartFile("file", "clip.mp4", "video/mp4", new byte[]{1, 2, 3})));
        assertEquals("IP_UPLOAD_INVALID", e.getCode());
    }

    @Test
    void uploadRejectsNonImageBytesEvenWithImageExtension() {
        BusinessException e = assertThrows(BusinessException.class, () -> svc.upload(USER,
                new MockMultipartFile("file", "fake.png", "image/png", "not really a png".getBytes())));
        assertEquals("IP_UPLOAD_INVALID", e.getCode());
    }

    @Test
    void uploadRejectsWebpBecauseTheJdkCannotDecodeIt() {
        // 宣传支持 WebP 但标准 ImageIO 没有 WebP 读取器 —— 收下来必然在读尺寸时 400，
        // 不如从入口就说清楚（前端 accept 同步去掉 image/webp）
        BusinessException e = assertThrows(BusinessException.class, () -> svc.upload(USER,
                new MockMultipartFile("file", "me.webp", "image/webp", new byte[]{
                        'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' '})));
        assertEquals("IP_UPLOAD_INVALID", e.getCode());
        assertTrue(e.getMessage().contains("JPG"), e.getMessage());
    }

    @Test
    void uploadRejectsOversizedDimensionsBeforeDecoding() throws Exception {
        // 只看字节数挡不住 decompression bomb：一张小 PNG 可以声明 50000×50000
        IpStudioProperties tight = IpStudioFixtures.props();
        tight.setUploadMaxDimension(64);
        IpProjectService tightSvc = new IpProjectService(projects.repo, runs.repo,
                new IpCatalogService(OM), storage, tight, OM);

        BusinessException e = assertThrows(BusinessException.class, () -> tightSvc.upload(USER,
                new MockMultipartFile("file", "huge.png", "image/png", pngBytes(200, 40))));
        assertEquals("IP_UPLOAD_INVALID", e.getCode());
        assertTrue(e.getMessage().contains("尺寸过大"), e.getMessage());

        // 界内的照样过
        assertEquals(40, tightSvc.upload(USER,
                new MockMultipartFile("file", "ok.png", "image/png", pngBytes(40, 40))).width());
    }

    @Test
    void defaultUploadDimensionCapIs8000() {
        assertEquals(8000, IpStudioFixtures.props().getUploadMaxDimension());
    }

    // ── 资产 key 归属闸 ──────────────────────────────────────

    @Test
    void requireOwnedAssetKeyAcceptsOwnSourceAndGenKeys() {
        assertEquals(IpStudioFixtures.sourceKey(USER, "a.png"),
                svc.requireOwnedAssetKey(USER, IpStudioFixtures.sourceKey(USER, "a.png")));
        assertEquals(IpStudioFixtures.genKey(USER, "b.png"),
                svc.requireOwnedAssetKey(USER, IpStudioFixtures.genKey(USER, "b.png")));
        assertNull(svc.requireOwnedAssetKey(USER, null), "没填 key 不是错误，是「还没上传」");
    }

    @Test
    void requireOwnedAssetKeyRejectsForeignAndTraversalAndOtherCategories() {
        for (String bad : List.of(
                IpStudioFixtures.sourceKey(OTHER, "victim.jpg"),          // 别人的照片
                "ipstudio_source/" + USER + "/../../secret.png",           // 路径穿越
                "ipstudio_source\\" + USER + "\\x.png",                    // 反斜杠
                "/etc/passwd",                                             // 绝对路径
                "dap_avatar/" + USER + "/x.png",                           // 别的业务域
                "ipstudio_source/x.png")) {                                // 缺 owner 段
            BusinessException e = assertThrows(BusinessException.class,
                    () -> svc.requireOwnedAssetKey(USER, bad), bad);
            assertEquals("IP_ASSET_KEY_INVALID", e.getCode(), bad);
        }
    }

    @Test
    void candidateKeyOfIsScopedToOwnerAndProject() {
        projects.repo.save(IpStudioFixtures.project(PID, USER, IpStudioFixtures.chainDoc(null, 0)));
        runs.repo.save(IpStudioFixtures.doneGenerateRun("IPR-own00001", PID, "n-master", 2));
        var foreignProject = IpStudioFixtures.doneGenerateRun("IPR-other001", "IPP-elsewhere", "n-master", 2);
        runs.repo.save(foreignProject);
        var foreignOwner = IpStudioFixtures.doneGenerateRun("IPR-other002", PID, "n-master", 2);
        foreignOwner.setOwnerUserId(OTHER);
        runs.repo.save(foreignOwner);

        assertEquals(IpStudioFixtures.genKey(USER, "n-master-1.png"),
                svc.candidateKeyOf(USER, PID, "IPR-own00001", 1));
        assertEquals("IP_RUN_NOT_FOUND", assertThrows(BusinessException.class,
                () -> svc.candidateKeyOf(USER, PID, "IPR-other001", 0)).getCode());
        assertEquals("IP_RUN_NOT_FOUND", assertThrows(BusinessException.class,
                () -> svc.candidateKeyOf(USER, PID, "IPR-other002", 0)).getCode());
        assertEquals("IP_RUN_NOT_FOUND", assertThrows(BusinessException.class,
                () -> svc.candidateKeyOf(USER, PID, "IPR-nosuch01", 0)).getCode());
    }

    @Test
    void uploadNormalizesUnreadableWechatTempFilename() throws Exception {
        var result = svc.upload(USER, new MockMultipartFile("file",
                "tmp_a1b2c3d4e5f6a7b8c9d0.png", "image/png", pngBytes(40, 40)));
        assertEquals("上传图片.png", result.fileName());
        assertFalse(result.fileName().contains("tmp_"));
    }

    private static byte[] pngBytes(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "png", bos);
        return bos.toByteArray();
    }
}
