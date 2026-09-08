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
import java.util.ArrayList;
import java.util.List;

import static com.aistareco.aep.ipstudio.IpStudioFixtures.OM;
import static com.aistareco.aep.ipstudio.IpStudioFixtures.OTHER;
import static com.aistareco.aep.ipstudio.IpStudioFixtures.USER;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
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
        IpProjectDto dto = svc.create(USER, new IpCreateProjectRequest(null, "ip-toy-figure"));
        assertTrue(dto.id().startsWith("IPP-"), dto.id());
        assertEquals("ip-toy-figure", dto.templateId());
        assertEquals(IpProject.STATUS_DRAFT, dto.status());
        assertEquals("潮玩 IP · 一张照片起一整套", dto.name());
        // 模板骨架已预排好：说明便签 + 照片位 + 招牌形象 + 五套变体
        assertEquals(8, dto.doc().path("nodes").size());
        assertEquals(6, dto.doc().path("connections").size());
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
        assertEquals(5, dto.doc().path("nodes").size());
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
    void derivedImageUrlsAreStrippedBeforePersisting() {
        // 出 wire 时服务端会给每个 key 现签一个带 TTL 的地址；画布读进状态后，
        // 之后任何一次编辑都会把整份文档 PUT 回来 —— 签名就这么进了库，一小时后全裂。
        // 指望前端自己剥是靠不住的：文档是客户端拥有的。
        projects.repo.save(IpStudioFixtures.project(PID, USER, new IpStudioFixtures.Doc()));
        IpStudioFixtures.Doc d = new IpStudioFixtures.Doc();
        ObjectNode md = d.imageNode("n-1", IpStudioFixtures.genKey(USER, "a.png"));
        md.put("url", "https://cdn.test/a.png?sig=WILL_EXPIRE");
        md.putArray("images").addObject()
                .put("id", "i1").put("storageKey", IpStudioFixtures.genKey(USER, "b.png"))
                .put("content", "https://cdn.test/b.png?sig=WILL_EXPIRE");

        svc.update(USER, PID, new IpUpdateProjectRequest(null, d.root));

        String stored = projects.rows.get(PID).getDocJson();
        assertFalse(stored.contains("WILL_EXPIRE"), "签名地址不该落库：" + stored);
        assertTrue(stored.contains("a.png") && stored.contains("b.png"), "key 是真值，必须留着");
    }

    @Test
    void nodeLevelSignedContentIsStrippedBeforePersisting() {
        // 画布把节点级的图 / 视频 / 音频地址放在 metadata.content（不是 url）。
        // 此前落库只剥 url，于是签名地址原样进库，一小时后 TTL 过期 ——
        // 表现是「昨天做的画布今天全裂」「出的视频播不了」。
        projects.repo.save(IpStudioFixtures.project(PID, USER, new IpStudioFixtures.Doc()));
        IpStudioFixtures.Doc d = new IpStudioFixtures.Doc();
        ObjectNode vid = d.node("n-video", "video");
        vid.put("storageKey", IpStudioFixtures.genKey(USER, "clip.mp4"));
        vid.put("content", "https://cdn.test/clip.mp4?sig=WILL_EXPIRE");

        svc.update(USER, PID, new IpUpdateProjectRequest(null, d.root));

        String stored = projects.rows.get(PID).getDocJson();
        assertFalse(stored.contains("WILL_EXPIRE"), "签名地址不该落库：" + stored);
        assertTrue(stored.contains("clip.mp4"), "key 是真值，必须留着");
    }

    @Test
    void textNodeContentSurvivesStripping() {
        // text 节点的 content 是正文本身，不是派生地址 —— 剥错了就是用户写的字没了。
        // 靠「有没有 storageKey」把它挡在外面。
        projects.repo.save(IpStudioFixtures.project(PID, USER, new IpStudioFixtures.Doc()));
        IpStudioFixtures.Doc d = new IpStudioFixtures.Doc();
        d.node("n-text", "text").put("content", "这段字是用户写的，不能剥");

        svc.update(USER, PID, new IpUpdateProjectRequest(null, d.root));

        assertTrue(projects.rows.get(PID).getDocJson().contains("这段字是用户写的"),
                "文字节点的正文被当成派生地址剥掉了");
    }

    @Test
    void staleSaveIsRejectedInsteadOfOverwriting() {
        // 两个标签页各改各的：后到的那次会把先到的整块画布抹掉，且不可逆。
        // 画布是整存整取的 —— 覆盖掉的不是一个字段，是那边一整份工作。
        projects.repo.save(IpStudioFixtures.project(PID, USER, new IpStudioFixtures.Doc()));

        assertEquals("IP_PROJECT_STALE", assertThrows(BusinessException.class,
                () -> svc.update(USER, PID, new IpUpdateProjectRequest(
                        null, new IpStudioFixtures.Doc().root, "0000000000000000"))).getCode());
    }

    @Test
    void saveWithMatchingVersionGoesThrough() {
        projects.repo.save(IpStudioFixtures.project(PID, USER, new IpStudioFixtures.Doc()));
        String version = svc.detail(USER, PID).docVersion();

        IpProjectDto dto = svc.update(USER, PID, new IpUpdateProjectRequest(
                "改个名", new IpStudioFixtures.Doc().root, version));
        assertEquals("改个名", dto.name());
    }

    @Test
    void connectedSaveDoesNotFalselyConflict() {
        // v0.162 的回归：早先比的是 updatedAt 字符串 —— 内存里纳秒、落库微秒，
        // 存进去再读出来就不相等，于是**只开一个窗口也会一直报「在别处改过了」**。
        // 连着存两次必须都过。
        projects.repo.save(IpStudioFixtures.project(PID, USER, new IpStudioFixtures.Doc()));

        IpStudioFixtures.Doc first = new IpStudioFixtures.Doc();
        first.node("n-1", "text").put("content", "第一次");
        IpProjectDto a = svc.update(USER, PID, new IpUpdateProjectRequest(
                null, first.root, svc.detail(USER, PID).docVersion()));

        IpStudioFixtures.Doc second = new IpStudioFixtures.Doc();
        second.node("n-1", "text").put("content", "第二次");
        assertDoesNotThrow(() -> svc.update(USER, PID, new IpUpdateProjectRequest(
                null, second.root, a.docVersion())));
    }

    @Test
    void publishDoesNotInvalidateTheClientsDocVersion() {
        // 发布只改 status / publishedAvatarId，不动文档。此前它会 bump updatedAt，
        // 于是「发布完接着改画布」必冲突。指纹只看文档，发布不该影响它。
        IpProject p = IpStudioFixtures.project(PID, USER, new IpStudioFixtures.Doc());
        projects.repo.save(p);
        String before = svc.detail(USER, PID).docVersion();

        p.setStatus(IpProject.STATUS_PUBLISHED);
        p.setPublishedAvatarId("DH-1");
        p.setUpdatedAt(java.time.Instant.now());
        projects.repo.save(p);

        assertEquals(before, svc.detail(USER, PID).docVersion(), "发布不改文档，指纹不该变");
    }

    @Test
    void doneRunsWithUnplacedImagesStayRecoverable() {
        // 画布出图不绑节点（nodeId 一律 adhoc），而 runsById 原本「每个节点只留最新一次」——
        // 于是一旦保存没落盘，之前那些已生成、已扣费的图就再也找不回来了。
        // 客户端的「放回画布」靠这份投影，所以跑完出了图的运行必须都在里面。
        projects.repo.save(IpStudioFixtures.project(PID, USER, new IpStudioFixtures.Doc()));
        for (int i = 1; i <= 3; i++) {
            runs.repo.save(IpStudioFixtures.doneGenerateRun("IPR-recov" + i, PID, "adhoc", 1));
        }

        IpProjectDto dto = svc.detail(USER, PID);
        assertEquals(3, dto.runsById().size(), "跑完出了图的运行必须都能被客户端看到");
    }

    @Test
    void tooManyKeysToSignIsRejectedWholesale() {
        // 砍尾会静默丢掉几个：前端表现成「签不出来」，调用方分不清是超限、非法 key 还是存储故障；
        // 而且被丢掉的那些根本没过归属闸。
        List<String> many = new ArrayList<>();
        for (int i = 0; i < 201; i++) many.add(IpStudioFixtures.genKey(USER, "k" + i + ".png"));
        assertEquals("IP_SIGN_TOO_MANY",
                assertThrows(BusinessException.class, () -> svc.signOwnedKeys(USER, many)).getCode());
    }

    @Test
    void docWithSomeoneElsesKeyIsNotSignedOnRead() {
        // 文档是客户端拥有的：用户完全可以把别人的 key 写进自己的画布，
        // 然后靠读自己的项目换出一个指向别人图片的签名地址。
        // 这跟 signOwnedKeys 是同一个洞的另一扇门 —— 出 wire 重签必须同样过归属闸。
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 0);
        d.data("n-source").put("storageKey", IpStudioFixtures.genKey(OTHER, "victim.png"));
        projects.repo.save(IpStudioFixtures.project(PID, USER, d));

        IpProjectDto dto = svc.detail(USER, PID);

        com.fasterxml.jackson.databind.JsonNode src = null;
        for (com.fasterxml.jackson.databind.JsonNode n : dto.doc().get("nodes")) {
            if ("n-source".equals(n.path("id").asText())) src = n;
        }
        assertNotNull(src);
        // 别人的 key 不签 —— 项目照常打开（不抛），只是这一张没有地址
        assertTrue(src.path("metadata").path("url").isMissingNode()
                        || src.path("metadata").path("url").asText("").isEmpty(),
                "非本人的 key 不该被签出地址：" + src.path("metadata"));
    }

    @Test
    void runsProjectionKeepsLatestPerNodePlusTheSelectedOlderRun() {
        // 同一个节点跑了两次；用户画布上留着的还是第一次那张图
        String oldRunId = "IPR-old00001";
        String newRunId = "IPR-new00001";
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(
                IpStudioFixtures.genKey(USER, "old.png"), 0);
        d.data("n-master").put("runId", oldRunId);
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
        // 被节点 metadata.runId 指着的旧运行放进 runsById，否则用户翻回一张老图时看不到它的提示词和花费；最新那次也在里面
        assertNotNull(dto.runsById().get(oldRunId));
        assertEquals(oldRunId, dto.runsById().get(oldRunId).id());
        assertEquals(newRunId, dto.runsById().get(newRunId).id());
        assertEquals(2, dto.runsById().size());
    }

    @Test
    void detailResignsSourceAndReferenceImageUrlsFromAssetKey() {
        // §4.7.7：doc 里存的图片地址是上传当时派生的签名值（一小时就过期），出 wire 必须按 storageKey 重签。
        // 不重签的结果是：画布开着开着，图一张张裂掉。
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 1);
        d.data("n-source").put("url", "http://localhost:8080/cdn/stale.jpg");
        projects.repo.save(IpStudioFixtures.project(PID, USER, d));

        IpProjectDto dto = svc.detail(USER, PID);
        for (com.fasterxml.jackson.databind.JsonNode n : dto.doc().get("nodes")) {
            String key = n.path("metadata").path("storageKey").asText(null);
            if (key == null) continue;
            // 断言必须查 content：图片 / 视频 / 音频节点在画布里读的都是 metadata.content。
            // 此前这里查的是 url —— 而**没有任何地方读 url**，于是断言绿着、节点却显示不出图。
            assertEquals("https://cdn.test/" + key + "?sig=x", n.path("metadata").path("content").asText(),
                    "节点 " + n.path("id").asText() + " 的图片地址没有按 key 重签到 content");
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
