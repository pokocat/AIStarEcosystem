package com.aistareco.aep.ipstudio.scene;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 「恢复内置」之后再保存（2026-10-30 复核）：旧做法删掉配置行，再保存又从第 1 版开始，
 * 缓存按版本号认，读到的还是删行前那份；停在第 1 版的旧页面也能把别人新存的第 1 版覆盖掉。
 */
class StudioSceneResetTest {
    /** 和真的一样：一行，upsert 版本号加一、过同一道校验，delete 删行。 */
    static class Rows extends PlatformConfigService {
        PlatformConfigDto row;
        Rows() { super(null, new ObjectMapper()); }
        @Override public Optional<PlatformConfigDto> findByKey(String key) { return Optional.ofNullable(row); }
        @Override public void lockExisting(String key) {}
        @Override public PlatformConfigDto upsert(String key, JsonNode value, String description, String updatedBy) {
            StudioSceneCatalog.validateJson(value);
            row = new PlatformConfigDto(key, value.deepCopy(), row == null ? 1 : row.version() + 1, description, null, updatedBy);
            return row;
        }
        @Override public void delete(String key) { row = null; }
    }

    private final ObjectMapper mapper = new ObjectMapper();
    private final Rows rows = new Rows();
    private final StudioSceneCatalog scenes = new StudioSceneCatalog();
    private final StudioSceneAdminService service;

    StudioSceneResetTest() {
        scenes.setConfig(rows);
        FileStorageService storage = mock(FileStorageService.class);
        when(storage.signedUrl(anyString())).thenAnswer(i -> "signed:" + i.getArgument(0));
        service = new StudioSceneAdminService(scenes, rows, storage, mapper);
    }

    private StudioSceneCatalog.Catalog titled(String title) {
        ObjectNode tree = mapper.valueToTree(scenes.builtIn());
        ((ObjectNode) tree.path("video").get(0)).put("title", title);
        try { return mapper.treeToValue(tree, StudioSceneCatalog.Catalog.class); } catch (Exception e) { throw new AssertionError(e); }
    }
    private String firstVideoTitle() { return scenes.catalog().video().get(0).title(); }

    @Test
    void savingAgainAfterRestoringTheBuiltInOneServesTheNewSave() {
        var first = service.save(new StudioSceneAdminService.SaveRequest(titled("目录 A"), 0), "op");
        assertThat(firstVideoTitle()).isEqualTo("目录 A");
        assertThat(first.source()).isEqualTo("custom");

        var restored = service.reset(first.version(), "op");
        assertThat(restored.source()).isEqualTo("default");
        assertThat(restored.version()).as("恢复内置也算一版，版本号不回到 0").isEqualTo(2);
        assertThat(firstVideoTitle()).isEqualTo(scenes.builtIn().video().get(0).title());

        var second = service.save(new StudioSceneAdminService.SaveRequest(titled("目录 B"), restored.version()), "op");
        assertThat(second.version()).isEqualTo(3);
        assertThat(firstVideoTitle()).isEqualTo("目录 B");
        assertThat(service.view().catalog().video().get(0).title()).isEqualTo("目录 B");
    }

    @Test
    void aPageOpenedBeforeTheRestoreCannotOverwriteWhatWasSavedAfterIt() {
        var stalePage = service.save(new StudioSceneAdminService.SaveRequest(titled("目录 A"), 0), "op");
        var restored = service.reset(stalePage.version(), "op");
        service.save(new StudioSceneAdminService.SaveRequest(titled("目录 B"), restored.version()), "op");

        assertThatThrownBy(() -> service.save(new StudioSceneAdminService.SaveRequest(titled("旧页面"), stalePage.version()), "op"))
                .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getCode()).isEqualTo("STUDIO_SCENE_CATALOG_STALE"));
        assertThat(firstVideoTitle()).isEqualTo("目录 B");
    }

    @Test
    void restoringWhenAlreadyOnTheBuiltInOneWritesNothing() {
        service.reset(0, "op");
        assertThat(rows.row).isNull();
        assertThat(service.view().source()).isEqualTo("default");
    }

    /** 线上已有的配置行可能就是旧做法留下的：删行后重存，同一个版本号对应两份内容。缓存要按内容认。 */
    @Test
    void theCacheFollowsWhatIsStoredNotTheVersionNumber() {
        rows.upsert(StudioSceneCatalog.CONFIG_KEY, mapper.valueToTree(titled("目录 A")), null, "op");
        assertThat(firstVideoTitle()).isEqualTo("目录 A");
        rows.delete(StudioSceneCatalog.CONFIG_KEY);
        rows.upsert(StudioSceneCatalog.CONFIG_KEY, mapper.valueToTree(titled("目录 B")), null, "op");
        assertThat(rows.row.version()).isEqualTo(1);
        assertThat(firstVideoTitle()).isEqualTo("目录 B");
    }
}
