package com.aistareco.aep.ipstudio;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpTemplateDto;
import com.aistareco.aep.ipstudio.model.IpDemoTemplate;
import com.aistareco.aep.ipstudio.repository.IpDemoTemplateRepository;
import com.aistareco.aep.ipstudio.service.IpCatalogService;
import com.aistareco.aep.ipstudio.service.IpTemplateResolver;
import com.aistareco.aep.service.storage.FileStorageService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static com.aistareco.aep.ipstudio.IpStudioFixtures.OM;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 工作流目录：**列表能列出来的，建的时候必须也认得**。
 *
 * <p>这条不变量此前是破的：控制器的 {@code GET /templates} 把全局示例 + 内置模板拼起来返回，
 * 而 {@code IpProjectService.create} 只查 {@link IpCatalogService}（classpath 内置的那些）。
 * 运营存一个全局示例之后，目录里看得见、一点就报「内置工作流不存在」。
 *
 * <p>所以这里不测「示例能不能解析」这种表层，而是直接钉死那条不变量本身 ——
 * 以后不管谁往目录里加了什么源，只要忘了在解析侧同步，这个测试就红。
 */
class IpTemplateResolverTest {

    private final IpCatalogService catalog = new IpCatalogService(OM);

    private IpDemoTemplate demo(String id, String name, boolean enabled, String kind) {
        IpDemoTemplate d = demo(id, name, enabled);
        d.setKind(kind);
        return d;
    }

    private IpDemoTemplate demo(String id, String name, boolean enabled) {
        IpDemoTemplate d = new IpDemoTemplate();
        d.setId(id);
        d.setName(name);
        d.setSummary("演示");
        d.setDocJson("{\"nodes\":[],\"connections\":[]}");
        d.setEnabled(enabled);
        d.setCreatedAt(Instant.now());
        return d;
    }

    private IpTemplateResolver resolverWith(List<IpDemoTemplate> enabledDemos) {
        IpDemoTemplateRepository repo = mock(IpDemoTemplateRepository.class);
        when(repo.findByEnabledTrueOrderBySortOrderAscCreatedAtAsc()).thenReturn(enabledDemos);
        when(repo.findByKindAndEnabledTrueOrderBySortOrderAscCreatedAtAsc(org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(inv -> enabledDemos.stream()
                        .filter(d -> inv.getArgument(0, String.class).equals(d.getKind())).toList());
        FileStorageService storage = mock(FileStorageService.class);
        when(storage.signedUrl(anyString())).thenReturn("https://cdn.test/x.png");
        return new IpTemplateResolver(catalog, repo, storage, OM);
    }

    @Test
    void 目录里列出来的每一条都必须能按id解析出来() {
        IpTemplateResolver r = resolverWith(List.of(demo("IPD-abc123", "潮玩模板", true, IpDemoTemplate.KIND_TEMPLATE)));

        List<IpTemplateDto> listed = r.list();
        assertFalse(listed.isEmpty(), "目录不该是空的（至少有内置模板）");

        List<String> unresolvable = new ArrayList<>();
        for (IpTemplateDto t : listed) {
            if (r.resolve(t.id()).isEmpty()) unresolvable.add(t.id());
        }
        assertTrue(unresolvable.isEmpty(),
                "这些在目录里列出来了、按 id 却解析不到 —— 用户点了就是「工作流不存在」：" + unresolvable);
    }

    @Test
    void 全局示例排在内置模板前面() {
        IpTemplateResolver r = resolverWith(List.of(demo("IPD-abc123", "潮玩模板", true, IpDemoTemplate.KIND_TEMPLATE)));
        assertEquals("IPD-abc123", r.list().get(0).id(), "运营精选的模板应当排在最前");
    }

    @Test
    void 已下线的示例既不列出也解析不到() {
        // 只返回「启用中」的那批（repo 方法本身就是 findByEnabledTrue…），
        // 所以下线之后目录里没有，建项目时也不能还建得出来。
        IpTemplateResolver r = resolverWith(List.of());
        assertTrue(r.resolve("IPD-offline").isEmpty(), "下线的示例不该还能建出项目");
        assertTrue(r.list().stream().noneMatch(t -> "IPD-offline".equals(t.id())));
    }

    @Test
    void 内置模板照旧能解析() {
        IpTemplateResolver r = resolverWith(List.of());
        List<IpTemplateDto> builtins = catalog.templates();
        assertFalse(builtins.isEmpty(), "内置模板不该为空");
        for (IpTemplateDto t : builtins) {
            assertTrue(r.resolve(t.id()).isPresent(), "内置模板解析不到：" + t.id());
        }
    }

    @Test
    void 示例文档坏掉不该让整个目录打不开() {
        IpDemoTemplate broken = demo("IPD-broken", "坏示例", true);
        broken.setDocJson("{ 这不是 JSON");
        IpTemplateResolver r = resolverWith(List.of(broken));
        Optional<IpTemplateDto> got = r.resolve("IPD-broken");
        assertTrue(got.isPresent(), "解析不该抛异常");
        assertTrue(got.get().doc().isObject(), "坏文档应当退化成空画布而不是 null");
    }

    @Test
    void 模板进目录_实例不进目录但仍可按id解析() {
        IpTemplateResolver r = resolverWith(List.of(
                demo("IPD-tpl", "只有工作流", true, IpDemoTemplate.KIND_TEMPLATE),
                demo("IPD-ex", "带素材的成品", true, IpDemoTemplate.KIND_EXAMPLE)));

        List<String> catalogIds = r.list().stream().map(IpTemplateDto::id).toList();
        assertTrue(catalogIds.contains("IPD-tpl"), "模板应当出现在「开始一个 IP」那一排");
        assertFalse(catalogIds.contains("IPD-ex"), "实例不进模板目录 —— 它进画布列表");

        List<String> exampleIds = r.listExamples().stream().map(IpTemplateDto::id).toList();
        assertEquals(List.of("IPD-ex"), exampleIds, "实例列表只应有实例");

        // 但两种都要能按 id 解析：点一个实例是「照它复制一份」，走的也是按 id 建项目
        assertTrue(r.resolve("IPD-tpl").isPresent());
        assertTrue(r.resolve("IPD-ex").isPresent(), "实例点了必须建得出来，否则又是「工作流不存在」");
    }
}
