package com.aistareco.aep.clip;

import com.aistareco.aep.clip.model.ClipTemplate;
import com.aistareco.aep.clip.repository.ClipTemplateRepository;
import com.aistareco.aep.clip.service.ClipTemplateService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * 只改上下架状态，别的字段一个都不许动。
 *
 * <p>这条路径存在的全部理由就是「不要走 upsert」：upsert 是整体替换语义，运营点一下「上架」
 * 却要回传整份模板，中间任何一次并发编辑都会被覆盖，漏传一个字段就静默清空配好的片尾和分镜。
 * 所以这组用例盯的不是「状态改没改对」，而是**别的字段有没有被碰**。
 */
class ClipTemplateStatusTest {
    private ClipTemplateRepository repo;
    private ClipTemplateService service;

    private ClipTemplate seed() {
        return ClipTemplate.builder()
                .id("ct_demo").name("门店故事").industry("本地生活").themeKey("daily").description("demo")
                .status("draft").ownerScope("official").ratio("9:16")
                .estDurationSec(42).avatarSecHint(8).creditHint(30)
                .scriptSkeletonJson(Map.of("segments", List.of(
                        Map.of("no", 1, "role", "avatar", "text", "大家好"),
                        Map.of("no", 2, "role", "tail", "text", "收尾", "durationSec", 6)
                )))
                .timelineJson(Map.of("tracks", List.of("a", "b")))
                .tailClipsJson(Map.of("items", List.of(Map.of("assetId", "ca_tail", "label", "门店信息卡", "durationSec", 6))))
                .brollPoolJson(Map.of("items", List.of("ca_broll_1")))
                .createdAt(Instant.now()).updatedAt(Instant.now())
                .build();
    }

    @BeforeEach
    void setUp() {
        repo = mock(ClipTemplateRepository.class);
        // dto() 会去 storage 换封面签名 URL；这条路径与本组用例无关，给个 mock 即可。
        var storage = mock(com.aistareco.aep.service.storage.FileStorageService.class);
        when(storage.signedUrl(anyString())).thenReturn("https://cdn.example/x");
        service = new ClipTemplateService(repo, storage, mock(com.aistareco.aep.clip.service.ClipAssetService.class),
                mock(com.aistareco.aep.clip.service.ClipProjectService.class));
        when(repo.save(any(ClipTemplate.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void publishOnlyTouchesStatusAndUpdatedAt() {
        ClipTemplate t = seed();
        when(repo.findById("ct_demo")).thenReturn(Optional.of(t));

        var dto = service.setStatus("ct_demo", "published");

        assertEquals("published", dto.status());
        // 下面这些是运营配了很久的东西。upsert 路径下漏传任一个就会被清空，这条路径不许。
        assertEquals("门店故事", t.getName());
        assertEquals("本地生活", t.getIndustry());
        assertEquals("daily", t.getThemeKey());
        assertEquals(Map.of("tracks", List.of("a", "b")), t.getTimelineJson(), "时间线被动过了");
        assertEquals(Map.of("items", List.of(Map.of("assetId", "ca_tail", "label", "门店信息卡", "durationSec", 6))),
                t.getTailClipsJson(), "片尾被清了 —— 这正是不走 upsert 的原因");
        assertEquals(Map.of("items", List.of("ca_broll_1")), t.getBrollPoolJson(), "空镜池被清了");
        assertEquals(8, t.getAvatarSecHint());
        assertEquals(30, t.getCreditHint());
    }

    @Test
    void unpublishGoesBackToDraft() {
        ClipTemplate t = seed();
        t.setStatus("published");
        when(repo.findById("ct_demo")).thenReturn(Optional.of(t));

        assertEquals("draft", service.setStatus("ct_demo", "draft").status());
    }

    @Test
    void unknownStatusIsRejectedRatherThanSilentlyCoercedToDraft() {
        when(repo.findById("ct_demo")).thenReturn(Optional.of(seed()));
        // upsert 里的写法是 `"published".equals(x) ? "published" : "draft"` —— 拼错一个字母
        // 就静默变成下架。运营点「上架」却下了架，还不报错，是最难查的那类。这里必须拒绝。
        BusinessException e = assertThrows(BusinessException.class, () -> service.setStatus("ct_demo", "Published"));
        assertEquals("CLIP_TEMPLATE_STATUS_INVALID", e.getCode());
        assertThrows(BusinessException.class, () -> service.setStatus("ct_demo", ""));
        assertThrows(BusinessException.class, () -> service.setStatus("ct_demo", "null"));
        verify(repo, never()).save(any());
    }

    @Test
    void deletedTemplateIsNotFound() {
        ClipTemplate t = seed();
        t.setDeletedAt(Instant.now());
        when(repo.findById("ct_gone")).thenReturn(Optional.of(t));
        // 软删的模板不该还能被上架回来 —— required() 已经把 deletedAt 过滤掉了，这条钉住它
        assertThrows(BusinessException.class, () -> service.setStatus("ct_gone", "published"));

        when(repo.findById(anyString())).thenReturn(Optional.empty());
        assertThrows(BusinessException.class, () -> service.setStatus("ct_nope", "published"));
    }
}
