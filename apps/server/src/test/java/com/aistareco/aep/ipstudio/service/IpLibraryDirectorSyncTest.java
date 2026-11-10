package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.director.DirectorWork;
import com.aistareco.aep.ipstudio.director.DirectorWorkRepository;
import com.aistareco.aep.ipstudio.model.IpLibraryRecord;
import com.aistareco.aep.ipstudio.repository.IpLibraryRecordRepository;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 导演台 → 资产库：有图才进、同一项只对应一张卡、不覆盖用户的修改、删掉的不回来。 */
class IpLibraryDirectorSyncTest {
    private static final String USER = "u1";
    private final ObjectMapper om = new ObjectMapper();
    private final Map<String, IpLibraryRecord> rows = new LinkedHashMap<>();
    private final Map<String, DirectorWork> works = new HashMap<>();
    private final IpSavedAssetService saved = mock(IpSavedAssetService.class);
    private final IpProjectService projects = mock(IpProjectService.class);
    private IpLibraryDirectorSync sync;

    @BeforeEach void setUp() {
        IpLibraryRecordRepository records = mock(IpLibraryRecordRepository.class);
        when(records.findById(anyString())).thenAnswer(i -> Optional.ofNullable(rows.get(i.getArgument(0))));
        when(records.save(any())).thenAnswer(i -> { IpLibraryRecord r = i.getArgument(0); rows.put(r.getId(), r); return r; });
        DirectorWorkRepository workRepo = mock(DirectorWorkRepository.class);
        when(workRepo.findById(anyString())).thenAnswer(i -> Optional.ofNullable(works.get(i.getArgument(0))));
        AepUserRepository users = mock(AepUserRepository.class);
        when(users.findByIdForUpdate(USER)).thenReturn(Optional.of(mock(AepUser.class)));
        IpRunRepository runs = mock(IpRunRepository.class);
        when(runs.findById(anyString())).thenReturn(Optional.empty());
        when(projects.ownsAssetKey(eq(USER), anyString())).thenAnswer(i -> !((String) i.getArgument(1)).startsWith("foreign/"));
        sync = new IpLibraryDirectorSync(workRepo, records, mock(IpLibraryService.class), saved, projects, runs, users, om);
    }

    private ObjectNode work(String id, String title) {
        ObjectNode c = om.createObjectNode();
        c.putArray("assets"); c.putArray("clips"); c.putArray("episodes"); c.putArray("exports");
        store(id, title, c);
        return c;
    }

    private void store(String id, String title, ObjectNode c) {
        DirectorWork w = new DirectorWork();
        w.setId(id); w.setOwnerUserId(USER); w.setTitle(title); w.setContentJson(c.toString());
        w.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        works.put(id, w);
    }

    private ObjectNode asset(ObjectNode c, String id, String kind, String name, String... keys) {
        ObjectNode a = ((com.fasterxml.jackson.databind.node.ArrayNode) c.path("assets")).addObject().put("id", id).put("kind", kind).put("name", name).put("description", name + "的设定");
        ObjectNode image = a.putObject("image");
        var candidates = image.putArray("candidates");
        int n = 0;
        for (String key : keys) candidates.addObject().put("id", "m" + (++n)).put("key", key).put("source", "generated").put("createdAt", "2026-11-01T00:00:00Z");
        return a;
    }

    private void run(String id, ObjectNode c) {
        store(id, works.get(id).getTitle(), c);
        sync.sync(new IpLibraryDirectorSync.Pending(id, USER));
    }

    private List<IpLibraryRecord> objects() { return rows.values().stream().filter(r -> "object".equals(r.getRecordType())).toList(); }

    private JsonNode json(IpLibraryRecord row) throws Exception { return om.readTree(row.getPayloadJson()); }

    @Test void anAssetEntersTheLibraryOnceItHasAnImage() throws Exception {
        ObjectNode c = work("DW-1", "食神");
        asset(c, "as1", "character", "林远", "ipstudio_gen/u1/a.png", "ipstudio_gen/u1/b.png");
        asset(c, "as2", "scene", "祖宅");
        run("DW-1", c);

        assertEquals(1, objects().size());
        JsonNode card = json(objects().get(0));
        assertEquals("林远", card.path("name").asText());
        assertEquals(2, card.path("versions").size());
        assertEquals("DW-1", card.path("sources").get(0).path("projectId").asText());
        assertEquals("director", card.path("sources").get(0).path("origin").asText());
        assertEquals("食神", card.path("sources").get(0).path("title").asText());
    }

    @Test void syncingAgainChangesNothing() {
        ObjectNode c = work("DW-1", "食神");
        asset(c, "as1", "character", "林远", "ipstudio_gen/u1/a.png");
        run("DW-1", c);
        clearInvocations(saved);
        run("DW-1", c);
        assertEquals(1, objects().size());
        verify(saved, never()).saveAutomatic(any(), any());
    }

    @Test void sameNameInTwoWorksStaysTwoCards() {
        ObjectNode a = work("DW-1", "食神"), b = work("DW-2", "废市");
        asset(a, "as1", "character", "老板", "ipstudio_gen/u1/a.png");
        asset(b, "as1", "character", "老板", "ipstudio_gen/u1/b.png");
        run("DW-1", a); run("DW-2", b);
        assertEquals(2, objects().size());
    }

    @Test void mainImageFollowsAdoptionUntilTheUserPicksOne() throws Exception {
        ObjectNode c = work("DW-1", "食神");
        ObjectNode a = asset(c, "as1", "character", "林远", "ipstudio_gen/u1/a.png", "ipstudio_gen/u1/b.png");
        ((ObjectNode) a.path("image")).put("adoptedId", "m2");
        run("DW-1", c);
        IpLibraryRecord row = objects().get(0);
        String second = versionId(row, "ipstudio_gen/u1/b.png"), first = versionId(row, "ipstudio_gen/u1/a.png");
        assertEquals(second, json(row).path("mainVersionId").asText());

        // 用户在资产库选了主图：之后导演台换采用版本也不跟。
        ObjectNode edited = (ObjectNode) json(row);
        edited.put("mainVersionId", first).put("mainAssigned", true);
        row.setPayloadJson(edited.toString());
        ((ObjectNode) a.path("image")).put("adoptedId", "m3");
        ((com.fasterxml.jackson.databind.node.ArrayNode) a.path("image").path("candidates")).addObject().put("id", "m3").put("key", "ipstudio_gen/u1/c.png").put("source", "generated");
        run("DW-1", c);
        assertEquals(3, json(objects().get(0)).path("versions").size());
        assertEquals(first, json(objects().get(0)).path("mainVersionId").asText());
    }

    @Test void nameAndDescriptionAreOnlyBroughtInOnce() throws Exception {
        ObjectNode c = work("DW-1", "食神");
        ObjectNode a = asset(c, "as1", "character", "林远", "ipstudio_gen/u1/a.png");
        run("DW-1", c);
        a.put("name", "林小远").put("description", "导演台改过");
        run("DW-1", c);
        JsonNode card = json(objects().get(0));
        assertEquals("林远", card.path("name").asText());
        assertEquals("林远的设定", card.path("description").asText());
    }

    @Test void aDescriptionClearedInTheLibraryStaysCleared() throws Exception {
        ObjectNode c = work("DW-1", "食神");
        ObjectNode a = asset(c, "as1", "character", "林远", "ipstudio_gen/u1/a.png");
        run("DW-1", c);
        IpLibraryRecord row = objects().get(0);
        ObjectNode edited = (ObjectNode) json(row);
        edited.put("description", "").put("prompt", "");
        row.setPayloadJson(edited.toString());
        // 导演台出新图会触发对账，清空的内容不能被填回去。
        ((com.fasterxml.jackson.databind.node.ArrayNode) a.path("image").path("candidates")).addObject().put("id", "m9").put("key", "ipstudio_gen/u1/z.png").put("source", "generated");
        run("DW-1", c);
        JsonNode card = json(objects().get(0));
        assertEquals(2, card.path("versions").size());
        assertEquals("", card.path("description").asText());
        assertEquals("", card.path("prompt").asText());
    }

    @Test void changingOnlyTheDescriptionDoesNotTouchTheCard() {
        ObjectNode c = work("DW-1", "食神");
        ObjectNode a = asset(c, "as1", "character", "林远", "ipstudio_gen/u1/a.png");
        run("DW-1", c);
        Instant before = objects().get(0).getUpdatedAt();
        a.put("description", "导演台改过");
        run("DW-1", c);
        assertEquals(before, objects().get(0).getUpdatedAt());
    }

    @Test void anOldLinkWithoutATimeKeepsReceivingNewImages() throws Exception {
        ObjectNode existing = om.createObjectNode().put("kind", "character").put("name", "林远").put("description", "").put("prompt", "").put("mainVersionId", "v-old");
        existing.putArray("versions").addObject().put("id", "v-old").put("storageKey", "ipstudio_gen/u1/old.png");
        existing.putArray("sources");
        Instant now = Instant.now();
        rows.put("ILO-existing", IpLibraryRecord.builder().id("ILO-existing").ownerUserId(USER).recordType("object").payloadJson(existing.toString()).createdAt(now).updatedAt(now).build());
        // 2026-11-07 之前关联的：作品里没有 libraryLinkedAt。
        ObjectNode c = work("DW-1", "食神");
        ObjectNode a = asset(c, "as1", "character", "小林", "ipstudio_gen/u1/before.png");
        a.put("libraryObjectId", "ILO-existing");
        run("DW-1", c);
        assertEquals(1, json(rows.get("ILO-existing")).path("versions").size(), "分不清的旧图不往原卡上加");
        String since = json(rows.get(IpLibraryDirectorSync.MARKER + "DW-1")).path("assets").path("as1").path("linkedSince").asText();
        assertFalse(since.isBlank());

        ((com.fasterxml.jackson.databind.node.ArrayNode) a.path("image").path("candidates")).addObject().put("id", "m2").put("key", "ipstudio_gen/u1/new.png").put("source", "generated").put("createdAt", Instant.now().plusSeconds(60).toString());
        run("DW-1", c);
        JsonNode card = json(rows.get("ILO-existing"));
        assertEquals(2, card.path("versions").size());
        assertEquals("ipstudio_gen/u1/new.png", card.path("versions").get(1).path("storageKey").asText());
        // 起点只记一次：之后再对账也不会后移，否则这之间的新图会漏。
        assertEquals(since, json(rows.get(IpLibraryDirectorSync.MARKER + "DW-1")).path("assets").path("as1").path("linkedSince").asText());
    }

    @Test void aDeletedCardDoesNotComeBack() {
        ObjectNode c = work("DW-1", "食神");
        ObjectNode a = asset(c, "as1", "character", "林远", "ipstudio_gen/u1/a.png");
        run("DW-1", c);
        objects().get(0).setDeletedAt(Instant.now());
        ((com.fasterxml.jackson.databind.node.ArrayNode) a.path("image").path("candidates")).addObject().put("id", "m9").put("key", "ipstudio_gen/u1/z.png").put("source", "generated");
        run("DW-1", c);
        assertEquals(1, objects().size());
        assertNotNull(objects().get(0).getDeletedAt());
    }

    @Test void aLinkedAssetAddsToTheOriginalCardWithoutMovingItsMainImage() throws Exception {
        ObjectNode existing = om.createObjectNode().put("kind", "character").put("name", "林远").put("description", "原设定").put("prompt", "原设定").put("mainVersionId", "v-old");
        existing.putArray("versions").addObject().put("id", "v-old").put("storageKey", "ipstudio_gen/u1/old.png");
        existing.putArray("sources");
        Instant now = Instant.now();
        rows.put("ILO-existing", IpLibraryRecord.builder().id("ILO-existing").ownerUserId(USER).recordType("object").payloadJson(existing.toString()).createdAt(now).updatedAt(now).build());
        ObjectNode c = work("DW-1", "食神");
        // 关联之前就有的那张（2026-11-01）不是原卡的，关联之后生成的才追加。
        ObjectNode a = asset(c, "as1", "character", "小林", "ipstudio_gen/u1/before.png", "ipstudio_gen/u1/new.png");
        a.put("libraryObjectId", "ILO-existing").put("libraryLinkedAt", "2026-11-02T00:00:00Z");
        ((ObjectNode) a.path("image").path("candidates").get(1)).put("createdAt", "2026-11-03T00:00:00Z");
        ((ObjectNode) a.path("image")).put("adoptedId", "m2");
        run("DW-1", c);

        assertEquals(1, objects().size());
        JsonNode card = json(rows.get("ILO-existing"));
        assertEquals(2, card.path("versions").size());
        assertEquals("ipstudio_gen/u1/new.png", card.path("versions").get(1).path("storageKey").asText());
        assertEquals("v-old", card.path("mainVersionId").asText());
        assertEquals("林远", card.path("name").asText());
        assertEquals("director-link", card.path("sources").get(0).path("origin").asText());
    }

    @Test void aForeignKeyIsSkippedAndTheWorkStillFinishes() throws Exception {
        ObjectNode c = work("DW-1", "食神");
        asset(c, "as1", "character", "林远", "foreign/x.png", "ipstudio_gen/u1/a.png");
        run("DW-1", c);
        assertEquals(1, json(objects().get(0)).path("versions").size());
        assertTrue(rows.containsKey(IpLibraryDirectorSync.MARKER + "DW-1"));
        assertEquals(works.get("DW-1").getUpdatedAt(), rows.get(IpLibraryDirectorSync.MARKER + "DW-1").getUpdatedAt());
    }

    @Test void productsAreNotCopiedAndClipMediaGetsARecognizableName() throws Exception {
        ObjectNode c = work("DW-1", "食神");
        asset(c, "as1", "product", "保温杯", "ipstudio_gen/u1/p.png");
        ((com.fasterxml.jackson.databind.node.ArrayNode) c.path("episodes")).addObject().put("id", "ep1").put("no", 2);
        ObjectNode clip = ((com.fasterxml.jackson.databind.node.ArrayNode) c.path("clips")).addObject().put("id", "cl1").put("episodeId", "ep1").put("order", 3);
        clip.putObject("board").putArray("candidates").addObject().put("id", "m1").put("key", "ipstudio_gen/u1/b.png").put("source", "generated");
        clip.putObject("video").putArray("candidates").addObject().put("id", "m2").put("key", "material-videos/j1/video.mp4").put("source", "generated");
        ((com.fasterxml.jackson.databind.node.ArrayNode) c.path("exports")).addObject().put("id", "e1").put("episodeId", "ep1").put("episodeNo", 2).put("status", "done").put("key", "ipstudio_gen/u1/final.mp4");
        run("DW-1", c);

        assertTrue(objects().isEmpty());
        var captured = org.mockito.ArgumentCaptor.forClass(JsonNode.class);
        verify(saved, times(3)).saveAutomatic(eq(USER), captured.capture());
        Map<String, JsonNode> byKey = new HashMap<>();
        for (JsonNode media : captured.getAllValues()) byKey.put(media.path("data").path("storageKey").asText(), media);
        assertEquals("第 2 集片段 3 · 分镜图", byKey.get("ipstudio_gen/u1/b.png").path("title").asText());
        assertEquals("video", byKey.get("material-videos/j1/video.mp4").path("kind").asText());
        assertEquals("第 2 集 · 成片", byKey.get("ipstudio_gen/u1/final.mp4").path("title").asText());
        assertEquals("DW-1", byKey.get("ipstudio_gen/u1/b.png").path("metadata").path("projectId").asText());
    }

    @Test void uploadedImagesReachTheFileLibraryAsUploads() {
        ObjectNode c = work("DW-1", "食神");
        ObjectNode a = asset(c, "as1", "scene", "祖宅", "ipstudio_source/u1/up.png");
        ((ObjectNode) a.path("image").path("candidates").get(0)).put("source", "upload");
        run("DW-1", c);
        var captured = org.mockito.ArgumentCaptor.forClass(JsonNode.class);
        verify(saved).saveAutomatic(eq(USER), captured.capture());
        assertEquals("用户上传", captured.getValue().path("source").asText());
        assertEquals("祖宅 · 场景图", captured.getValue().path("title").asText());
    }

    private String versionId(IpLibraryRecord row, String key) throws Exception {
        for (JsonNode v : json(row).path("versions")) if (key.equals(v.path("storageKey").asText())) return v.path("id").asText();
        throw new AssertionError(key);
    }
}
