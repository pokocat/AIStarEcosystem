package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.dto.IpLibraryDtos.LibraryObject;
import com.aistareco.aep.ipstudio.dto.IpLibraryDtos.LibraryVersion;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
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

/** 关联已有资产：作品里的资产记下资产库那一项，所选版本的图直接作为参考图（角色也一样），类型不对、没有图都拒绝。 */
class DirectorLibraryLinkTest {

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

    private ObjectNode asset(String kind, String name, String description) {
        ObjectNode a = ((com.fasterxml.jackson.databind.node.ArrayNode) c.path("assets")).addObject()
                .put("id", "a" + c.path("assets").size()).put("kind", kind).put("name", name).put("description", description);
        a.putArray("episodeIds");
        a.putObject("image").putArray("candidates");
        ((ObjectNode) a.path("image")).putNull("adoptedId");
        return a;
    }

    private static LibraryObject object(String id, String kind, String name, String referenceKey, LibraryVersion... versions) {
        String main = versions.length == 0 ? null : versions[versions.length - 1].id();
        return new LibraryObject(id, kind, name, name + "的设定", "", null, referenceKey, null, main, List.of(versions), List.of(), null, "", "");
    }

    private static LibraryVersion version(String id, String key) {
        return new LibraryVersion(id, key, "https://x/" + key, "", "", null, false);
    }

    @Test
    void sceneLinkAdoptsTheMainVersionAndRecordsTheLink() {
        ObjectNode a = asset("scene", "老宅", "");
        service.linkLibrary("u1", c, a, object("o1", "scene", "祖宅", null, version("v1", "k/old.png"), version("v2", "k/new.png")), null);
        assertEquals("o1", a.path("libraryObjectId").asText());
        assertEquals("老宅", a.path("name").asText(), "剧本里的叫法不变");
        assertEquals("祖宅的设定", a.path("description").asText(), "描述空着时补上");
        JsonNode m = a.path("image").path("candidates").get(0);
        assertEquals("k/new.png", m.path("key").asText());
        assertEquals("library", m.path("source").asText());
        assertEquals(m.path("id").asText(), a.path("image").path("adoptedId").asText());
        assertEquals("user", a.path("image").path("adoptedBy").asText());
    }

    @Test
    void chosenVersionWinsAndMissingVersionIsAnError() {
        ObjectNode a = asset("prop", "玉佩", "已有描述");
        LibraryObject o = object("o1", "prop", "玉佩", null, version("v1", "k/a.png"), version("v2", "k/b.png"));
        service.linkLibrary("u1", c, a, o, "v1");
        assertEquals("k/a.png", a.path("image").path("candidates").get(0).path("key").asText());
        assertEquals("已有描述", a.path("description").asText(), "已有描述不覆盖");
        BusinessException e = assertThrows(BusinessException.class, () -> service.linkLibrary("u1", c, a, o, "gone"));
        assertEquals("DIRECTOR_LIBRARY_VERSION_NOT_FOUND", e.getCode());
    }

    @Test
    void characterImageIsUsedDirectlyAsTheCharacterImage() {
        ObjectNode a = asset("character", "林晚", "");
        service.linkLibrary("u1", c, a, object("o1", "character", "林晚", null, version("v1", "k/face.png")), null);
        assertEquals("k/face.png", a.path("image").path("candidates").get(0).path("key").asText());
        assertEquals(a.path("image").path("candidates").get(0).path("id").asText(), a.path("image").path("adoptedId").asText());
        assertTrue(a.path("refImage").isMissingNode(), "不再只当形象参考");
    }

    @Test
    void characterWithoutImageFallsBackToLibraryReference() {
        ObjectNode a = asset("character", "林晚", "");
        service.linkLibrary("u1", c, a, object("o1", "character", "林晚", "k/ref.png"), null);
        assertEquals("k/ref.png", a.path("image").path("candidates").get(0).path("key").asText());
    }

    @Test
    void relinkingTakesTheNewImageAndRebinds() {
        ObjectNode a = asset("scene", "老宅", "");
        service.linkLibrary("u1", c, a, object("o1", "scene", "老宅", null, version("v1", "k/first.png")), null);
        service.linkLibrary("u1", c, a, object("o2", "scene", "另一处", null, version("v2", "k/second.png")), null);
        assertEquals("o2", a.path("libraryObjectId").asText());
        assertEquals(2, a.path("image").path("candidates").size());
        assertEquals(a.path("image").path("candidates").get(1).path("id").asText(), a.path("image").path("adoptedId").asText());
    }

    @Test
    void kindMustMatch() {
        ObjectNode a = asset("character", "林晚", "");
        BusinessException e = assertThrows(BusinessException.class,
                () -> service.linkLibrary("u1", c, a, object("o1", "scene", "老宅", null, version("v1", "k/x.png")), null));
        assertEquals("DIRECTOR_INPUT_INVALID", e.getCode());
        assertTrue(e.getMessage().contains("是场景，不能关联到角色「林晚」"), e.getMessage());
        assertEquals(0, a.path("image").path("candidates").size());
        assertTrue(a.path("libraryObjectId").isMissingNode());
    }

    @Test
    void linkNeedsAnImage() {
        ObjectNode a = asset("scene", "老宅", "");
        BusinessException e = assertThrows(BusinessException.class,
                () -> service.linkLibrary("u1", c, a, object("o2", "scene", "空的", null), null));
        assertEquals("DIRECTOR_INPUT_INVALID", e.getCode());
        assertTrue(a.path("libraryObjectId").isMissingNode());
    }

    @Test
    void linkingAnImageThatWasGeneratedBeforeTreatsItAsTheLibraryImage() {
        ObjectNode a = asset("character", "林晚", "");
        ((com.fasterxml.jackson.databind.node.ArrayNode) a.path("image").path("candidates")).addObject()
                .put("id", "m1").put("key", "k/face.png").put("source", "generated").put("fingerprint", "old").put("stale", true);
        service.linkLibrary("u1", c, a, object("o1", "character", "林晚", null, version("v1", "k/face.png")), null);
        JsonNode m = a.path("image").path("candidates").get(0);
        assertEquals(1, a.path("image").path("candidates").size());
        assertEquals("library", m.path("source").asText());
        assertTrue(m.path("stale").isMissingNode() && m.path("fingerprint").isMissingNode());
        assertEquals("m1", a.path("image").path("adoptedId").asText());
    }

    @Test
    void linkBumpsTheRevisionSoAnOlderEditCannotSilentlyClearTheFilledDescription() {
        ObjectNode a = asset("scene", "老宅", "");
        a.put("rev", 2);
        service.linkLibrary("u1", c, a, object("o1", "scene", "老宅", null, version("v1", "k/x.png")), null);
        assertEquals(3, a.path("rev").asLong());
    }
}
