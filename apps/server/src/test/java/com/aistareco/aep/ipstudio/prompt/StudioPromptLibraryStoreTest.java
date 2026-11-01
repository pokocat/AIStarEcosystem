package com.aistareco.aep.ipstudio.prompt;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.ipstudio.dto.StudioSkillDtos.*;
import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.aep.ipstudio.skill.*;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * 提示词库在真实数据库上（docs/studio-prompt-architecture.md §4）：和制作做法同表、做法目录看不到它们；灌种子与文件变化自动出版本；
 * 后台发布后以库为准；切换导入以线上生效内容为准；冻结的版本照旧能渲染；后台预览。
 */
@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class StudioPromptLibraryStoreTest {
    @Autowired IpSkillRepository skills;
    @Autowired IpSkillVersionRepository versions;
    @Autowired PlatformTransactionManager manager;

    final ObjectMapper om = new ObjectMapper();
    final PromptService prompts = mock(PromptService.class);
    StudioSkillStore store;
    StudioSkillCatalog catalog;
    StudioPromptLibrary library;
    StudioPromptAssembler assembler;
    StudioSkillAdminService admin;

    @SuppressWarnings("unchecked")
    static <T> ObjectProvider<T> provider(T value) { ObjectProvider<T> p = mock(ObjectProvider.class); when(p.getIfAvailable()).thenReturn(value); return p; }

    @BeforeEach void setUp() {
        versions.deleteAll(); skills.deleteAll();
        store = new StudioSkillStore(skills, versions, om, manager);
        catalog = new StudioSkillCatalog(store);
        when(prompts.resolve(anyString())).thenReturn(new PromptService.ResolvedPrompt("", "", new PromptParamsDto(null, null, null), "code"));
        library = new StudioPromptLibrary(store, new PromptImports(prompts, store, provider(new SceneImports(provider(null), store))));
        assembler = new StudioPromptAssembler(library);
        ObjectProvider<AiAppSceneModelPolicyService> scenes = provider(null);
        ObjectProvider<StudioWorkflowService> workflow = provider(null);
        admin = new StudioSkillAdminService(catalog, store, prompts, mock(AiModelInvocationService.class), mock(AiModelEndpointRepository.class),
                mock(DapPricingService.class), scenes, workflow, om, manager, library, assembler);
    }

    void seedAll() {
        invoke(catalog, "seedRepositoryFiles");
        invoke(library, "seedRepositoryFiles");
    }

    @Test
    void entriesShareTheTablesButTheMethodCatalogOnlySeesWorkflowMethods() {
        seedAll();
        assertTrue(skills.findById("stage-scene-script").isPresent());
        assertTrue(skills.findById("scene-local-groupbuy").isPresent());
        assertTrue(catalog.available().stream().noneMatch(s -> s.key().startsWith("stage-") || s.key().startsWith("scene-") || s.key().equals("base")));
        assertTrue(catalog.find("video-generation").isPresent());
        assertEquals("stage", library.require("stage-scene-script").layer());
        var items = admin.list();
        assertEquals("method", items.stream().filter(i -> i.key().equals("video-generation")).findFirst().orElseThrow().layer());
        assertEquals("llm", items.stream().filter(i -> i.key().equals("stage-scene-script")).findFirst().orElseThrow().target());
        // the last active workflow method rule only counts methods: withdrawing a prompt entry is always allowed
        admin.setStatus("scene-ip-sheet", new StatusRequest("withdrawn"), "op");
        assertTrue(library.find("scene-ip-sheet").orElseThrow().withdrawn());
    }

    @Test
    void anAdminPublishWinsOverALaterFileAndAFrozenVersionStillRenders() {
        seedAll();
        var v1 = library.require("scene-local-groupbuy");
        Map<String, Integer> frozen = assembler.freeze(List.of("stage-scene-script", "scene-local-groupbuy"));
        var detail = admin.publish("scene-local-groupbuy", new PublishRequest(om.valueToTree(v1.header()), "运营改过的拍法", "改拍法", 1), "op");
        assertEquals(2, detail.currentVersion());
        library.invalidate();
        assertEquals("运营改过的拍法", library.require("scene-local-groupbuy").body());
        // a task accepted before the publish keeps rendering v1
        var pinned = assembler.assemble(new StudioPromptAssembler.Call("stage-scene-script", null, "scene-local-groupbuy", sample(), frozen));
        assertTrue(pinned.user().contains("拍法：开头亮出团购价格"));
        assertEquals(1, pinned.refs().stream().filter(r -> r.key().equals("scene-local-groupbuy")).findFirst().orElseThrow().version());
        // the repository file is re-read on the next start; the admin version stays current
        invoke(library, "seedRepositoryFiles");
        library.invalidate();
        assertEquals("运营改过的拍法", library.require("scene-local-groupbuy").body());
        // a key keeps its layer
        Map<String, Object> asStage = new LinkedHashMap<>(v1.header());
        asStage.put("layer", "stage");
        assertThrows(BusinessException.class, () -> admin.publish("scene-local-groupbuy", new PublishRequest(om.valueToTree(asStage), "x", null, 2), "op"));
    }

    @Test
    void anOperatorsEditInTheOldPromptTableIsImportedInsteadOfTheRepositoryText() {
        // a stage that declares importFrom: simulate it on the base entry's sibling by importing into a fresh key
        var seed = StudioPromptLibrary.loadSeeds().stream().filter(s -> s.entry().key().equals("stage-scene-script")).findFirst().orElseThrow();
        Map<String, Object> header = new LinkedHashMap<>(seed.header());
        header.put("importFrom", "dap.ip_studio_assistant");
        String[] repo = PromptService.resourceDefault("dap.ip_studio_assistant");
        String body = seed.entry().body().replace("你是资深短视频编导。", repo[0]);
        var withOld = new StudioPromptLibrary.Seed("stage-scene-script.md", StudioPromptEntry.fromHeader(header, body, "x"), header);
        when(prompts.resolve("dap.ip_studio_assistant")).thenReturn(new PromptService.ResolvedPrompt("运营改过的助手身份", repo[1], new PromptParamsDto(0.3, null, null), "db"));
        var imported = new PromptImports(prompts, store, provider(null)).live(withOld).orElseThrow();
        assertEquals(IpSkillVersion.SOURCE_IMPORT, imported.source());
        assertTrue(imported.body().contains("运营改过的助手身份"));
        assertFalse(imported.body().contains(repo[0]));
        assertEquals(Map.of("temperature", 0.3), imported.header().get("params"));
        // unchanged live content: no import, the repository seed is used
        when(prompts.resolve("dap.ip_studio_assistant")).thenReturn(new PromptService.ResolvedPrompt(repo[0], repo[1], new PromptParamsDto(null, null, null), "db"));
        assertTrue(new PromptImports(prompts, store, provider(null)).live(withOld).isEmpty());
    }

    @Test
    void aSceneTheOperatorsEditedIsImportedFromTheLiveCatalog() {
        var built = StudioSceneCatalog.load("ipstudio/scenes.json");
        var edited = built.with(built.image(), built.video().stream().map(s -> s.id().equals("local-groupbuy")
                ? s.withCreative("运营改过的团购拍法", s.brief()) : s).toList(), built.homeGoals());
        PlatformConfigService config = mock(PlatformConfigService.class);
        when(config.findByKey(StudioSceneCatalog.CONFIG_KEY)).thenReturn(Optional.of(new com.aistareco.aep.dto.PlatformConfigDto(
                StudioSceneCatalog.CONFIG_KEY, om.valueToTree(edited), 3, "场景", null, null)));
        var imports = new SceneImports(provider(config), store);
        var groupbuy = StudioPromptLibrary.loadSeeds().stream().filter(s -> s.entry().key().equals("scene-local-groupbuy")).findFirst().orElseThrow();
        var live = imports.live(groupbuy).orElseThrow();
        assertEquals("运营改过的团购拍法", live.body());
        assertEquals(IpSkillVersion.SOURCE_IMPORT, live.source());
        var untouched = StudioPromptLibrary.loadSeeds().stream().filter(s -> s.entry().key().equals("scene-ecom-talking")).findFirst().orElseThrow();
        assertTrue(imports.live(untouched).isEmpty());
    }

    @Test
    void thePreviewAssemblesAStageWithItsSampleAndCodeFormats() {
        seedAll();
        var preview = admin.preview(new PromptPreviewRequest("stage-scene-script", null, "scene-local-groupbuy", null));
        assertTrue(preview.system().contains("你是资深短视频编导"));
        assertTrue(preview.system().contains("客户没写到的价格"));
        assertTrue(preview.user().contains("写一条 25 秒的竖屏「同城团购」短视频脚本"));
        assertTrue(preview.user().contains("第1镜（0–3 秒）"));
        assertFalse(preview.user().contains("{{"));
        assertTrue(preview.formats().containsKey("shots"));
        assertThrows(BusinessException.class, () -> admin.preview(new PromptPreviewRequest("stage-nowhere", null, null, null)));
    }

    private static Map<String, Object> sample() {
        return new LinkedHashMap<>(StudioPromptStages.find("stage-scene-script").orElseThrow().sample());
    }

    private static void invoke(Object target, String method) {
        try {
            var m = target.getClass().getDeclaredMethod(method);
            m.setAccessible(true);
            m.invoke(target);
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
