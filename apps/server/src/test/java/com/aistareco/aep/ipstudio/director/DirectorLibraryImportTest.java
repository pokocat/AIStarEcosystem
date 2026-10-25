package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.dto.IpLibraryDtos.LibraryObject;
import com.aistareco.aep.ipstudio.dto.IpLibraryDtos.LibraryVersion;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** 从个人资产库导入到导演台作品：场景、道具带图直接采用；角色图只当形象参考；同名合并不覆盖已有的图。 */
class DirectorLibraryImportTest {

    private final ObjectMapper om = new ObjectMapper();
    private IpProjectService projects;
    private DirectorService service;
    private ObjectNode c;

    @BeforeEach
    void setUp() {
        projects = mock(IpProjectService.class);
        when(projects.requireOwnedAssetKey(eq("u1"), any())).thenAnswer(inv -> inv.getArgument(1));
        service = new DirectorService(null, null, projects, null, null, null, null, null, null, null, null, null, null, null, null,
                om, mock(PlatformTransactionManager.class));
        c = om.createObjectNode();
        c.putArray("assets");
    }

    private static LibraryObject object(String id, String kind, String name, String referenceKey, LibraryVersion... versions) {
        String main = versions.length == 0 ? null : versions[versions.length - 1].id();
        return new LibraryObject(id, kind, name, name + "的设定", "", null, referenceKey, null, main, List.of(versions), List.of(), null, "", "");
    }

    private static LibraryVersion version(String id, String key) {
        return new LibraryVersion(id, key, "https://x/" + key, "", "", null, false);
    }

    @Test
    void sceneImportAdoptsTheMainVersion() {
        service.importFromLibrary("u1", c, null, object("o1", "scene", "老宅", null, version("v1", "k/old.png"), version("v2", "k/new.png")), null, "ep1");
        ObjectNode a = (ObjectNode) c.path("assets").get(0);
        assertEquals("scene", a.path("kind").asText());
        assertEquals("老宅的设定", a.path("description").asText());
        assertEquals("o1", a.path("libraryObjectId").asText());
        assertEquals("ep1", a.path("episodeIds").get(0).asText());
        assertEquals("k/new.png", a.path("image").path("candidates").get(0).path("key").asText());
        assertEquals("library", a.path("image").path("candidates").get(0).path("source").asText());
        assertEquals(a.path("image").path("candidates").get(0).path("id").asText(), a.path("image").path("adoptedId").asText());
        assertEquals("user", a.path("image").path("adoptedBy").asText());
    }

    @Test
    void chosenVersionWinsAndMissingVersionIsAnError() {
        LibraryObject o = object("o1", "prop", "玉佩", null, version("v1", "k/a.png"), version("v2", "k/b.png"));
        service.importFromLibrary("u1", c, null, o, "v1", null);
        assertEquals("k/a.png", c.path("assets").get(0).path("image").path("candidates").get(0).path("key").asText());
        BusinessException e = assertThrows(BusinessException.class, () -> service.importFromLibrary("u1", c, null, o, "gone", null));
        assertEquals("DIRECTOR_LIBRARY_VERSION_NOT_FOUND", e.getCode());
    }

    @Test
    void characterImageBecomesReferenceNotTheCharacterSheet() {
        service.importFromLibrary("u1", c, null, object("o1", "character", "林晚", null, version("v1", "k/face.png")), null, null);
        ObjectNode a = (ObjectNode) c.path("assets").get(0);
        assertEquals("k/face.png", a.path("refImage").path("key").asText());
        assertEquals(0, a.path("image").path("candidates").size());
        assertTrue(a.path("image").path("adoptedId").isNull());
    }

    @Test
    void characterWithoutImageFallsBackToLibraryReference() {
        service.importFromLibrary("u1", c, null, object("o1", "character", "林晚", "k/ref.png"), null, null);
        assertEquals("k/ref.png", c.path("assets").get(0).path("refImage").path("key").asText());
    }

    @Test
    void sameNameMergesWithoutReplacingWhatIsThere() {
        service.importFromLibrary("u1", c, null, object("o1", "scene", "老宅", null, version("v1", "k/first.png")), null, null);
        service.importFromLibrary("u1", c, null, object("o2", "scene", "老宅", null, version("v2", "k/second.png")), null, null);
        assertEquals(1, c.path("assets").size());
        ObjectNode a = (ObjectNode) c.path("assets").get(0);
        assertEquals(2, a.path("image").path("candidates").size());
        assertEquals(a.path("image").path("candidates").get(0).path("id").asText(), a.path("image").path("adoptedId").asText());
    }

    @Test
    void reimportingTheSameObjectDoesNotDuplicate() {
        LibraryObject o = object("o1", "prop", "玉佩", null, version("v1", "k/a.png"));
        service.importFromLibrary("u1", c, null, o, null, null);
        service.importFromLibrary("u1", c, null, o, null, null);
        assertEquals(1, c.path("assets").size());
        assertEquals(1, c.path("assets").get(0).path("image").path("candidates").size());
    }

    @Test
    void explicitTargetTakesTheNewImage() {
        service.importFromLibrary("u1", c, null, object("o1", "scene", "老宅", null, version("v1", "k/first.png")), null, null);
        ObjectNode a = (ObjectNode) c.path("assets").get(0);
        service.importFromLibrary("u1", c, a, object("o9", "prop", "别的名字", null, version("v9", "k/pick.png")), null, null);
        assertEquals(1, c.path("assets").size());
        assertEquals("老宅", a.path("name").asText());
        assertEquals(a.path("image").path("candidates").get(1).path("id").asText(), a.path("image").path("adoptedId").asText());
    }

    @Test
    void borrowingAnImageDoesNotRebindTheTarget() {
        service.importFromLibrary("u1", c, null, object("o1", "scene", "老宅", null, version("v1", "k/first.png")), null, null);
        ObjectNode scene = (ObjectNode) c.path("assets").get(0);
        LibraryObject prop = object("o9", "prop", "玉佩", null, version("v9", "k/jade.png"));
        service.importFromLibrary("u1", c, scene, prop, null, null);
        assertEquals("o1", scene.path("libraryObjectId").asText());
        service.importFromLibrary("u1", c, null, prop, null, null);
        assertEquals(2, c.path("assets").size());
        assertEquals("玉佩", c.path("assets").get(1).path("name").asText());
    }

    @Test
    void mergeAddsTheEpisodeOnce() {
        LibraryObject o = object("o1", "prop", "玉佩", null, version("v1", "k/a.png"));
        service.importFromLibrary("u1", c, null, o, null, "ep1");
        service.importFromLibrary("u1", c, null, o, null, "ep2");
        service.importFromLibrary("u1", c, null, o, null, "ep2");
        assertEquals("[\"ep1\",\"ep2\"]", c.path("assets").get(0).path("episodeIds").toString());
    }

    @Test
    void explicitTargetNeedsAnImage() {
        service.importFromLibrary("u1", c, null, object("o1", "scene", "老宅", null, version("v1", "k/first.png")), null, null);
        ObjectNode a = (ObjectNode) c.path("assets").get(0);
        BusinessException e = assertThrows(BusinessException.class,
                () -> service.importFromLibrary("u1", c, a, object("o2", "scene", "空的", null), null, null));
        assertEquals("DIRECTOR_INPUT_INVALID", e.getCode());
        assertEquals(1, a.path("image").path("candidates").size());
    }

    @Test
    void tooLongNameIsRejectedNotTruncated() {
        BusinessException e = assertThrows(BusinessException.class,
                () -> service.importFromLibrary("u1", c, null, object("o1", "scene", "长".repeat(41), null), null, null));
        assertEquals("DIRECTOR_INPUT_INVALID", e.getCode());
        assertEquals(0, c.path("assets").size());
    }
}
