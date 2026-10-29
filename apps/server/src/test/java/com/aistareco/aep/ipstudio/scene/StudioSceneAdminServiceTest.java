package com.aistareco.aep.ipstudio.scene;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 后台「Studio 场景模板」：整份保存带版本号，派生地址不进库，上传按字节判类型。 */
class StudioSceneAdminServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final PlatformConfigService config = mock(PlatformConfigService.class);
    private final FileStorageService storage = mock(FileStorageService.class);
    private final StudioSceneCatalog scenes = new StudioSceneCatalog();
    private final StudioSceneAdminService service;

    StudioSceneAdminServiceTest() {
        scenes.setConfig(config);
        when(config.findByKey(StudioSceneCatalog.CONFIG_KEY)).thenReturn(Optional.empty());
        when(storage.signedUrl(anyString())).thenAnswer(i -> "signed:" + i.getArgument(0));
        service = new StudioSceneAdminService(scenes, config, storage, mapper);
    }

    private void saved(StudioSceneCatalog.Catalog catalog, int version) {
        when(config.findByKey(StudioSceneCatalog.CONFIG_KEY)).thenReturn(Optional.of(new PlatformConfigDto(StudioSceneCatalog.CONFIG_KEY,
                mapper.valueToTree(catalog), version, null, null, null)));
    }

    @Test
    void savingStoresKeysOnlyAndTheNextReadServesTheSavedCatalog() {
        var c = scenes.builtIn();
        var first = c.video().get(0);
        var withUrls = new StudioSceneCatalog.Catalog(c.version(), c.imageGroups(), c.videoGroups(), c.image(), List.of(new StudioSceneCatalog.VideoScene(first.id(), first.group(), "改过的名字",
                first.description(), first.images(), first.video(), first.character(), first.voice(), first.placeholder(), first.textRequired(), first.durations(), first.duration(),
                first.ratio(), first.structure(), first.ideas(), first.skill(), true, StudioSceneCatalog.MEDIA_PREFIX + "c.webp", null, "https://cdn/expiring", List.of())));
        service.save(new StudioSceneAdminService.SaveRequest(withUrls, 0), "op");
        var body = ArgumentCaptor.forClass(JsonNode.class);
        verify(config).upsert(eq(StudioSceneCatalog.CONFIG_KEY), body.capture(), anyString(), eq("op"));
        assertThat(body.getValue().path("video").get(0).path("coverUrl").isNull()).isTrue();
        assertThat(body.getValue().path("video").get(0).path("coverKey").asText()).isEqualTo(StudioSceneCatalog.MEDIA_PREFIX + "c.webp");

        try { saved(mapper.treeToValue(body.getValue(), StudioSceneCatalog.Catalog.class), 1); } catch (Exception e) { throw new AssertionError(e); }
        assertThat(scenes.catalog().video()).singleElement().satisfies(s -> assertThat(s.title()).isEqualTo("改过的名字"));
        assertThat(service.view().source()).isEqualTo("custom");
    }

    @Test
    void someoneElsesNewerSaveIsNotOverwritten() {
        saved(scenes.builtIn(), 3);
        assertThatThrownBy(() -> service.save(new StudioSceneAdminService.SaveRequest(scenes.builtIn(), 2), "op"))
                .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getCode()).isEqualTo("STUDIO_SCENE_CATALOG_STALE"));
        assertThatThrownBy(() -> service.reset(0, "op"))
                .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getCode()).isEqualTo("STUDIO_SCENE_CATALOG_STALE"));
        verify(config, never()).upsert(any(), any(), any(), any());
    }

    @Test
    void aBrokenCatalogIsRefusedWithTheReason() {
        var c = scenes.builtIn();
        var broken = new StudioSceneCatalog.Catalog(c.version(), c.imageGroups(), c.videoGroups(), List.of(c.image().get(1), c.image().get(1)), c.video());
        assertThatThrownBy(() -> service.save(new StudioSceneAdminService.SaveRequest(broken, 0), "op"))
                .isInstanceOfSatisfying(BusinessException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("STUDIO_SCENE_CATALOG_INVALID");
                    assertThat(e.getMessage()).contains("重复");
                });
    }

    @Test
    void uploadsAreJudgedByTheirBytesNotTheirName() {
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 'I', 'H', 'D', 'R'};
        when(storage.store(any(byte[].class), eq(StudioSceneCatalog.MEDIA_CATEGORY), eq(StudioSceneCatalog.MEDIA_OWNER), eq("png"), eq("image/png")))
                .thenReturn(new FileStorageService.StoredFile(StudioSceneCatalog.MEDIA_PREFIX + "x.png", null, null, null, png.length, "image/png"));
        var uploaded = service.upload(new MockMultipartFile("file", "cover.mp4", "video/mp4", png));
        assertThat(uploaded.mediaType()).isEqualTo("image");
        assertThatThrownBy(() -> service.upload(new MockMultipartFile("file", "cover.png", "image/png", "not an image".getBytes())))
                .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getCode()).isEqualTo("STUDIO_SCENE_MEDIA_INVALID"));
    }
}
