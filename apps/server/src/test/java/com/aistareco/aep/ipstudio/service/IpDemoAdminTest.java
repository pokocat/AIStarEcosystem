package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.IpStudioFixtures;
import com.aistareco.aep.ipstudio.model.IpDemoTemplate;
import com.aistareco.aep.ipstudio.repository.IpDemoTemplateRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 全局内容的**运营后台**（v0.192）。
 *
 * <p>发布端点一直有，下线端点也一直有 —— 但下线没有任何前端调用方，
 * 于是上线一条不合适的示例之后产品内撤不下来。补管理面时一并补的三件：
 * 看得到已下线的、能改排序、能真删（连素材副本）。
 */
class IpDemoAdminTest {

    private final FileStorageService storage = IpStudioFixtures.storage();
    private final IpDemoTemplateRepository repo = mock(IpDemoTemplateRepository.class);
    private final Map<String, IpDemoTemplate> rows = new LinkedHashMap<>();
    private final List<String> deletedKeys = new ArrayList<>();
    private IpDemoTemplateService svc;

    @BeforeEach
    void setUp() {
        when(repo.findAll()).thenAnswer(inv -> new ArrayList<>(rows.values()));
        when(repo.findById(anyString())).thenAnswer(inv ->
                Optional.ofNullable(rows.get(inv.getArgument(0, String.class))));
        when(repo.save(any())).thenAnswer(inv -> {
            IpDemoTemplate r = inv.getArgument(0);
            rows.put(r.getId(), r);
            return r;
        });
        doAnswer(inv -> rows.remove(inv.getArgument(0, IpDemoTemplate.class).getId()))
                .when(repo).delete(any());
        doAnswer(inv -> deletedKeys.add(inv.getArgument(0, String.class)))
                .when(storage).delete(anyString());
        svc = new IpDemoTemplateService(repo, mock(IpProjectService.class), storage, IpStudioFixtures.OM);
    }

    private IpDemoTemplate seed(String id, String kind, boolean enabled, int sortOrder, String doc) {
        IpDemoTemplate r = IpDemoTemplate.builder()
                .id(id).name(id).kind(kind).enabled(enabled).sortOrder(sortOrder)
                .docJson(doc).createdAt(Instant.now()).build();
        rows.put(id, r);
        return r;
    }

    private static String docWith(String... keys) {
        StringBuilder sb = new StringBuilder("{\"nodes\":[");
        for (int i = 0; i < keys.length; i++) {
            if (i > 0) sb.append(',');
            sb.append("{\"id\":\"n").append(i).append("\",\"type\":\"image\",\"metadata\":{\"storageKey\":\"")
                    .append(keys[i]).append("\"}}");
        }
        return sb.append("],\"connections\":[]}").toString();
    }

    @Test
    void 管理列表看得到已下线的_而目录接口看不到() {
        seed("IPD-on", IpDemoTemplate.KIND_EXAMPLE, true, 0, docWith());
        seed("IPD-off", IpDemoTemplate.KIND_EXAMPLE, false, 0, docWith());
        when(repo.findByKindAndEnabledTrueOrderBySortOrderAscCreatedAtAsc(anyString()))
                .thenAnswer(inv -> rows.values().stream()
                        .filter(r -> r.isEnabled() && r.getKind().equals(inv.getArgument(0)))
                        .toList());

        assertEquals(2, svc.listForAdmin().size(),
                "运营要看的是全集 —— 下线之后哪儿都看不见就等于「下线 = 消失」，重新上线只能靠记 id");
        assertEquals(1, svc.listExamples().size(), "用户目录只看得到启用中的");
    }

    @Test
    void 管理列表模板在前_各自按排序() {
        seed("IPD-e", IpDemoTemplate.KIND_EXAMPLE, true, 0, docWith());
        seed("IPD-t2", IpDemoTemplate.KIND_TEMPLATE, true, 2, docWith());
        seed("IPD-t1", IpDemoTemplate.KIND_TEMPLATE, true, 1, docWith());

        List<String> ids = svc.listForAdmin().stream().map(d -> d.id()).toList();
        assertEquals(List.of("IPD-t1", "IPD-t2", "IPD-e"), ids);
    }

    @Test
    void 概览数字数的是节点与挂着素材的那些() {
        seed("IPD-1", IpDemoTemplate.KIND_EXAMPLE, true, 0,
                docWith("ipstudio_demo/IPD-1/a.png", "ipstudio_demo/IPD-1/b.png"));
        var dto = svc.listForAdmin().get(0);
        assertEquals(2, dto.nodeCount());
        assertEquals(2, dto.assetCount(), "运营靠这两个数字判断「这条是不是空的 / 是不是那条重复的」");
    }

    @Test
    void 改展示信息_传null的字段不动() {
        IpDemoTemplate r = seed("IPD-1", IpDemoTemplate.KIND_EXAMPLE, true, 0, docWith());
        r.setSummary("原说明");
        svc.updateMeta("IPD-1", "新名字", null, 5);
        assertEquals("新名字", r.getName());
        assertEquals("原说明", r.getSummary(), "没传的字段不该被清空");
        assertEquals(5, r.getSortOrder(), "排序此前有字段却没人能设，恒为 0");
    }

    @Test
    void 删除连素材副本一起清() {
        seed("IPD-1", IpDemoTemplate.KIND_EXAMPLE, true, 0,
                docWith("ipstudio_demo/IPD-1/a.png", "ipstudio_demo/IPD-1/b.png"));
        svc.deleteDemo("IPD-1");
        assertFalse(rows.containsKey("IPD-1"));
        assertEquals(2, deletedKeys.size(),
                "下线只是藏起来，素材仍占存储、凭 key 任何登录用户可读；删除要撤干净：" + deletedKeys);
    }

    @Test
    void 删除不碰不属于这条示例的_key() {
        seed("IPD-1", IpDemoTemplate.KIND_EXAMPLE, true, 0, docWith(
                "ipstudio_demo/IPD-1/mine.png",
                "ipstudio_demo/IPD-other/notmine.png",   // 另一条示例的
                "ipstudio_gen/u-9/private.png"));        // 某个用户的私有素材
        svc.deleteDemo("IPD-1");
        assertEquals(List.of("ipstudio_demo/IPD-1/mine.png"), deletedKeys,
                "文档里混进别人的 key 时删掉就是把别人的东西一起毁了，而这个动作没有回收站");
    }

    /**
     * DTO 字段名必须和前端那份 1:1（§4.1）。
     *
     * <p>v0.163 的形状：前端手抄了一份 `IpRun`，把 `output` 写成 `outputs`，
     * 于是「画布出图一次都没成功过」—— 而单测是绿的，fixture 跟被测代码犯了同一个笔误。
     * 这里改成**读真源文件比字段名**：抄错一个字母，这条就红。
     */
    @Test
    void DTO字段名与前端共享类型逐字一致() throws Exception {
        java.nio.file.Path ts = java.nio.file.Path.of(
                "..", "..", "packages", "types", "src", "ip-studio.ts").toAbsolutePath().normalize();
        assertTrue(java.nio.file.Files.exists(ts), "找不到类型真源：" + ts);
        String src = java.nio.file.Files.readString(ts);
        int at = src.indexOf("export interface IpDemoAdmin");
        assertTrue(at > 0, "packages/types 里没有 IpDemoAdmin —— 类型真源在那儿，不许在前端手抄一份");
        String body = src.substring(at, src.indexOf('}', at));

        for (var c : com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpDemoAdminDto.class
                .getRecordComponents()) {
            assertTrue(body.contains(c.getName() + ":") || body.contains(c.getName() + "?:"),
                    "DTO 有 " + c.getName() + "，前端 IpDemoAdmin 里没有 —— 出 wire 的字段前端读不到：\n" + body);
        }
    }

    @Test
    void 删不存在的一条报404而不是静默成功() {
        BusinessException e = assertThrows(BusinessException.class, () -> svc.deleteDemo("IPD-nope"));
        assertTrue(e.getMessage().contains("示例不存在"), e.getMessage());
    }
}
