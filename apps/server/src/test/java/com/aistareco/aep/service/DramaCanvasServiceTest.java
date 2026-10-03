package com.aistareco.aep.service;

import com.aistareco.aep.dto.DramaCanvasDetailDto;
import com.aistareco.aep.dto.DramaCanvasSummaryDto;
import com.aistareco.aep.dto.SaveDramaCanvasResultDto;
import com.aistareco.aep.dto.SplitCanvasScriptResultDto;
import com.aistareco.aep.model.DramaCanvas;
import com.aistareco.aep.repository.DramaCanvasRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DramaCanvasService：新建（粘贴 / 想法两种 source、校验）、保存（409 / 400 / 413、剥 url、指纹、时间）、
 * 读出只签本人的 key、step 推导、列表封面、软删、切集接口、给运行记录服务的三个公共方法。
 *
 * <p>断言一律断契约（错误码、状态码、结构、字段），不断可视文案（AGENTS.md §8.0.1 ⑩）。
 * repo 用内存 Map 背书（条件更新照数据库语义）；归属闸 mock 成「key 以 own/ 开头才是本人的」；签名 mock 成可辨认的地址。
 */
class DramaCanvasServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final String ME = "u_me";
    private static final String OTHER = "u_other";
    private static final DramaCanvasService.Style STYLE = new DramaCanvasService.Style("film90", "90 年代写实", "胶片颗粒，暖黄调");

    private Map<String, DramaCanvas> store;
    private DramaCanvasRepository repo;
    private DramaCanvasOwnership ownership;
    private CdnUrlSigner signer;
    private DramaCanvasService svc;

    @BeforeEach
    void setup() {
        store = new LinkedHashMap<>();
        repo = mock(DramaCanvasRepository.class);
        when(repo.save(any())).thenAnswer(inv -> {
            DramaCanvas c = inv.getArgument(0);
            store.put(c.getId(), c);
            return c;
        });
        when(repo.existsById(anyString())).thenAnswer(inv -> store.containsKey(inv.<String>getArgument(0)));
        when(repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(anyString(), anyString())).thenAnswer(inv -> {
            DramaCanvas c = store.get(inv.<String>getArgument(0));
            if (c == null || c.getDeletedAt() != null || !Objects.equals(c.getOwnerUserId(), inv.getArgument(1))) {
                return Optional.empty();
            }
            return Optional.of(c);
        });
        when(repo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(anyString())).thenAnswer(inv -> {
            List<DramaCanvas> out = new ArrayList<>();
            for (DramaCanvas c : store.values()) {
                if (c.getDeletedAt() == null && Objects.equals(c.getOwnerUserId(), inv.getArgument(0))) out.add(c);
            }
            out.sort((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()));
            return out;
        });
        // 条件更新：和数据库一样，只有版本还对得上才写
        when(repo.updateDocIfVersion(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), any()))
                .thenAnswer(inv -> {
                    DramaCanvas c = store.get(inv.<String>getArgument(0));
                    if (c == null || c.getDeletedAt() != null || !Objects.equals(c.getOwnerUserId(), inv.getArgument(1))
                            || !Objects.equals(c.getDocVersion(), inv.getArgument(2))) return 0;
                    c.setDocJson(inv.getArgument(3));
                    c.setDocVersion(inv.getArgument(4));
                    c.setTitle(inv.getArgument(5));
                    c.setUpdatedAt(inv.getArgument(6));
                    return 1;
                });
        when(repo.softDelete(anyString(), anyString(), any())).thenAnswer(inv -> {
            DramaCanvas c = store.get(inv.<String>getArgument(0));
            if (c == null || c.getDeletedAt() != null || !Objects.equals(c.getOwnerUserId(), inv.getArgument(1))) return 0;
            c.setDeletedAt(inv.getArgument(2));
            return 1;
        });

        ownership = mock(DramaCanvasOwnership.class);
        when(ownership.ownedKeys(anyString(), any())).thenAnswer(inv -> {
            Collection<String> keys = inv.getArgument(1);
            Set<String> out = new LinkedHashSet<>();
            for (String k : keys) if (k != null && k.startsWith("own/")) out.add(k);
            return out;
        });

        signer = mock(CdnUrlSigner.class);
        when(signer.signKey(anyString())).thenAnswer(inv -> "https://cdn.test/" + inv.getArgument(0) + "?sig=1");

        svc = new DramaCanvasService(repo, ownership, signer, OM);
    }

    // ── 新建 ───────────────────────────────────────────────────────────────────

    private DramaCanvasService.CreateBody idea(String idea) {
        return new DramaCanvasService.CreateBody(null, "9:16", "idea", idea, null, null, null, STYLE);
    }

    private DramaCanvasService.CreateBody paste(String text) {
        return new DramaCanvasService.CreateBody(null, "16:9", "paste", null, text, null, null, STYLE);
    }

    @Test
    void createFromIdea_writesIdeaAndDefaults_emptyEverythingElse_titleIsFirst20Chars() {
        String ideaText = "南方县城老中学即将拆除，回来整理旧物的女老师在抽屉里摸到一个生锈的铁盒";
        DramaCanvasDetailDto d = svc.create(ME, idea("  " + ideaText + "  "));

        assertTrue(d.id().matches("dcv_[0-9a-f]{12}"), d.id());
        assertEquals(ideaText.substring(0, 20), d.title());
        assertEquals("9:16", d.ratio());
        assertEquals("script", d.step());
        JsonNode doc = d.doc();
        assertEquals(1, doc.path("schema").asInt());
        assertEquals("idea", doc.path("source").asText());
        assertEquals("film90", doc.at("/style/id").asText());
        assertEquals("胶片颗粒，暖黄调", doc.at("/style/prompt").asText());
        assertEquals(ideaText, doc.at("/script/idea").asText());
        assertEquals(10, doc.at("/script/targetEpisodes").asInt());
        assertEquals(60, doc.at("/script/episodeDurationSec").asInt());
        assertEquals(0, doc.at("/script/episodes").size());
        assertTrue(doc.at("/script/history").isArray());
        assertFalse(doc.path("script").has("setting"));
        assertFalse(doc.path("script").has("extractedAt"));
        for (String f : List.of("characters", "scenes", "materials", "episodes")) {
            assertTrue(doc.path(f).isArray() && doc.path(f).isEmpty(), f);
        }
        assertTrue(doc.at("/board/positions").isObject());
        assertTrue(doc.at("/board/edges").isArray());
        assertTrue(doc.at("/board/collapsed").isArray());
        assertEquals(1, doc.at("/board/viewport/zoom").asInt());
        // 新建出来的文档本身就能过保存的外形校验
        assertNull(DramaCanvasService.shapeProblem(doc));

        assertEquals(0, d.episodeCount());
        assertNull(d.coverUrl());
        assertTrue(d.docVersion().matches("[0-9a-f]{16}"));
        DramaCanvas row = store.get(d.id());
        assertEquals(DramaCanvasDocs.docVersionOf(row.getDocJson(), row.getTitle()), d.docVersion());
        assertEquals(DramaCanvasDocs.canonicalJson(doc), row.getDocJson());
        assertNotNull(Instant.parse(d.createdAt()));
        verify(ownership, never()).ownedKeys(anyString(), any());
    }

    @Test
    void createFromIdea_customEpisodesAndDuration_andExplicitTitle() {
        DramaCanvasDetailDto d = svc.create(ME, new DramaCanvasService.CreateBody("  我的剧  ", "16:9", "idea", "想法",
                null, 3, 90, STYLE));
        assertEquals("我的剧", d.title());
        assertEquals(3, d.doc().at("/script/targetEpisodes").asInt());
        assertEquals(90, d.doc().at("/script/episodeDurationSec").asInt());
    }

    @Test
    void createFromPaste_splitsIntoEpisodes_defaultTitle_noIdeaFields() {
        DramaCanvasDetailDto d = svc.create(ME, paste("第1集 重逢\n正文一\n第2集 真相\n正文二"));
        assertEquals(DramaCanvasService.DEFAULT_TITLE, d.title());
        assertEquals("paste", d.doc().path("source").asText());
        ArrayNode eps = (ArrayNode) d.doc().at("/script/episodes");
        assertEquals(2, eps.size());
        assertEquals(1, eps.get(0).path("no").asInt());
        assertEquals("重逢", eps.get(0).path("title").asText());
        assertEquals("正文二", eps.get(1).path("text").asText());
        assertFalse(d.doc().path("script").has("idea"));
        assertFalse(d.doc().path("script").has("targetEpisodes"));
        assertEquals(2, d.episodeCount());
        assertEquals("script", d.step());
    }

    @Test
    void createFromPaste_withoutMarkers_returnsSplitNotesOnce_detailAndIdeaCreateDoNot() throws Exception {
        DramaCanvasDetailDto d = svc.create(ME, paste("日 内 旧教室\n林微：你好。"));
        assertNotNull(d.splitNotes());
        assertFalse(d.splitNotes().isEmpty());
        assertEquals(1, d.doc().at("/script/episodes").size());
        assertTrue(OM.valueToTree(d).has("splitNotes"));

        // GET 详情不带（NON_NULL，wire 上没有这个字段）
        DramaCanvasDetailDto got = svc.detail(ME, d.id());
        assertNull(got.splitNotes());
        assertFalse(OM.valueToTree(got).has("splitNotes"));
        // 想法新建也不带
        assertFalse(OM.valueToTree(svc.create(ME, idea("一句话"))).has("splitNotes"));
        // 文档里不落切集说明
        assertFalse(store.get(d.id()).getDocJson().contains("splitNotes"));
    }

    @Test
    void create_validation() {
        assertBodyInvalid(new DramaCanvasService.CreateBody(null, "4:3", "idea", "x", null, null, null, STYLE), "ratio");
        assertBodyInvalid(new DramaCanvasService.CreateBody(null, null, "idea", "x", null, null, null, STYLE), "ratio");
        assertBodyInvalid(new DramaCanvasService.CreateBody(null, "9:16", "blank", "x", null, null, null, STYLE), "source");
        assertBodyInvalid(idea("   "), "idea");
        assertBodyInvalid(idea("字".repeat(501)), "idea");
        assertBodyInvalid(new DramaCanvasService.CreateBody(null, "9:16", "idea", "x", null, 0, null, STYLE), "targetEpisodes");
        assertBodyInvalid(new DramaCanvasService.CreateBody(null, "9:16", "idea", "x", null, 81, null, STYLE), "targetEpisodes");
        assertBodyInvalid(new DramaCanvasService.CreateBody(null, "9:16", "idea", "x", null, null, 29, STYLE), "episodeDurationSec");
        assertBodyInvalid(new DramaCanvasService.CreateBody(null, "9:16", "idea", "x", null, null, 181, STYLE), "episodeDurationSec");
        assertBodyInvalid(paste(""), "text");
        assertBodyInvalid(paste("字".repeat(100_001)), "text");
        assertBodyInvalid(new DramaCanvasService.CreateBody(null, "9:16", "idea", "x", null, null, null, null), "style");
        assertBodyInvalid(new DramaCanvasService.CreateBody(null, "9:16", "idea", "x", null, null, null,
                new DramaCanvasService.Style("", "名", "")), "style");
        assertBodyInvalid(new DramaCanvasService.CreateBody(null, "9:16", "idea", "x", null, null, null,
                new DramaCanvasService.Style("custom", "自定义", "字".repeat(301))), "style.prompt");
        assertTrue(store.isEmpty(), "校验不过一行都不落");

        // 边界值都能建
        svc.create(ME, idea("字".repeat(500)));
        svc.create(ME, new DramaCanvasService.CreateBody(null, "9:16", "idea", "x", null, 80, 180, STYLE));
        svc.create(ME, new DramaCanvasService.CreateBody(null, "9:16", "idea", "x", null, 1, 30,
                new DramaCanvasService.Style("none", "无风格", null)));
        assertEquals(3, store.size());
    }

    private void assertBodyInvalid(DramaCanvasService.CreateBody body, String field) {
        BusinessException e = assertThrows(BusinessException.class, () -> svc.create(ME, body));
        assertEquals("DRAMA_CANVAS_BODY_INVALID", e.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        assertEquals(field, ((Map<?, ?>) e.getDetails()).get("field"));
    }

    // ── 保存 ───────────────────────────────────────────────────────────────────

    private DramaCanvasDetailDto fresh() {
        return svc.create(ME, paste("第1集\n正文"));
    }

    /** 一份合法的空文档（不经 service，免得多建一张画布）。 */
    private static ObjectNode baseDoc() throws Exception {
        return (ObjectNode) OM.readTree("""
                {"schema":1,"source":"paste","style":{"id":"none","name":"无风格","prompt":""},
                 "script":{"episodes":[{"no":1,"title":"","text":"正文"}],"history":[]},
                 "characters":[],"scenes":[],"materials":[],
                 "board":{"positions":{},"edges":[],"collapsed":[],"viewport":{"x":0,"y":0,"zoom":1}},
                 "episodes":[]}""");
    }

    /** 一份带资产的文档：两个造型（一张本人的、一张别人的）、一个场景、一个片段（首帧 + 视频 + 末帧）、一集成片。 */
    private ObjectNode docWithAssets(String extractedAt) throws Exception {
        ObjectNode doc = baseDoc();
        ObjectNode script = (ObjectNode) doc.get("script");
        if (extractedAt != null) script.put("extractedAt", extractedAt);
        doc.set("characters", OM.readTree("""
                [{"id":"c1","name":"林微","role":"lead","looks":[
                   {"id":"lk1","name":"基础造型","prompt":"p","episodes":[1],
                    "images":{"versions":[{"key":"theirs/x.png"},{"key":"own/a.png","url":"https://old?sig=0"}],"pickedKey":"theirs/x.png"}},
                   {"id":"lk2","name":"学生时期","prompt":"p","episodes":[1],
                    "images":{"versions":[{"key":"own/b.png"}]}}]}]"""));
        doc.set("scenes", OM.readTree("""
                [{"id":"s1","name":"旧教室","prompt":"p","episodes":[1],"images":{"versions":[{"key":"own/s.png"}]}}]"""));
        doc.set("episodes", OM.readTree("""
                [{"no":1,"segments":[
                   {"id":"sg1","text":"t","durationSec":5,"frame":{"versions":[{"key":"own/f.png"}]},
                    "video":{"versions":[{"key":"own/v.mp4","url":"https://old-v","lastFrameKey":"own/lf.png","lastFrameUrl":"https://old-lf",
                                          "runId":"r1","createdAt":"2026-09-30T00:00:00Z"}]}},
                   {"id":"sg2","text":"t","durationSec":4,"frame":{"versions":[]},"video":{"versions":[]}}],
                  "assembled":{"key":"own/ep1.mp4","url":"https://old-ep","durationSec":9,"at":"2026-09-30T00:00:00Z",
                               "videoKeys":["own/v.mp4"],"runId":"r9"}}]"""));
        return doc;
    }

    @Test
    void save_stripsDerivedUrlsEverywhere_keepsKeys_advancesVersion_andReturnsExactUpdatedAt() throws Exception {
        DramaCanvasDetailDto d = fresh();
        ObjectNode doc = docWithAssets(null);
        SaveDramaCanvasResultDto r = svc.save(ME, d.id(), new DramaCanvasService.SaveBody(doc, "改个名", d.docVersion()));

        DramaCanvas row = store.get(d.id());
        assertFalse(row.getDocJson().contains("\"url\""), row.getDocJson());
        assertFalse(row.getDocJson().contains("lastFrameUrl"), row.getDocJson());
        JsonNode stored = OM.readTree(row.getDocJson());
        assertEquals("own/a.png", stored.at("/characters/0/looks/0/images/versions/1/key").asText());
        assertEquals("own/lf.png", stored.at("/episodes/0/segments/0/video/versions/0/lastFrameKey").asText());
        assertNotEquals(d.docVersion(), r.docVersion());
        assertEquals(DramaCanvasDocs.docVersionOf(row.getDocJson(), row.getTitle()), r.docVersion());
        assertEquals(r.docVersion(), row.getDocVersion());
        assertEquals("改个名", row.getTitle());
        // 返回的 updatedAt 与之后读回来的逐字相同（微秒截断、UTC）
        assertEquals(r.updatedAt(), svc.detail(ME, d.id()).updatedAt());
        assertEquals(0, Instant.parse(r.updatedAt()).getNano() % 1000);
        // 调用方的树没被动过
        assertTrue(doc.at("/characters/0/looks/0/images/versions/1").has("url"));
    }

    @Test
    void save_sameContentDifferentFieldOrder_sameVersion() throws Exception {
        DramaCanvasDetailDto d = fresh();
        ObjectNode doc = docWithAssets(null);
        SaveDramaCanvasResultDto r1 = svc.save(ME, d.id(), new DramaCanvasService.SaveBody(doc, null, d.docVersion()));
        // 同一份内容换字段顺序 + 带上派生 url → 指纹不变
        ObjectNode reordered = OM.createObjectNode();
        List<String> names = new ArrayList<>();
        doc.fieldNames().forEachRemaining(names::add);
        java.util.Collections.reverse(names);
        for (String n : names) reordered.set(n, doc.get(n).deepCopy());
        ((ObjectNode) reordered.at("/scenes/0/images/versions/0")).put("url", "https://new?sig=2");
        SaveDramaCanvasResultDto r2 = svc.save(ME, d.id(), new DramaCanvasService.SaveBody(reordered, null, r1.docVersion()));
        assertEquals(r1.docVersion(), r2.docVersion());
    }

    @Test
    void save_withOldVersion_is409_andNothingWritten() throws Exception {
        DramaCanvasDetailDto d = fresh();
        SaveDramaCanvasResultDto r1 = svc.save(ME, d.id(), new DramaCanvasService.SaveBody(docWithAssets(null), null, d.docVersion()));
        String before = store.get(d.id()).getDocJson();

        // 另一个标签页还拿着旧版本
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.save(ME, d.id(), new DramaCanvasService.SaveBody(baseDoc(), null, d.docVersion())));
        assertEquals("DRAMA_CANVAS_STALE", e.getCode());
        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        assertEquals(r1.docVersion(), ((Map<?, ?>) e.getDetails()).get("docVersion"));
        assertEquals(before, store.get(d.id()).getDocJson());

        // 缺版本号也算对不上
        BusinessException e2 = assertThrows(BusinessException.class,
                () -> svc.save(ME, d.id(), new DramaCanvasService.SaveBody(baseDoc(), null, null)));
        assertEquals("DRAMA_CANVAS_STALE", e2.getCode());
    }

    @Test
    void save_renameOnly_changesVersion_soStalePageCannotOverwriteNewTitle() throws Exception {
        DramaCanvasDetailDto d = fresh();
        // A、B 两个页面拿着同一版本；A 只改标题、文档一字没动
        SaveDramaCanvasResultDto a = svc.save(ME, d.id(), new DramaCanvasService.SaveBody(d.doc(), "新标题", d.docVersion()));
        assertNotEquals(d.docVersion(), a.docVersion(), "只改标题也要换版本");
        // B 带旧版本保存（旧标题 / 不带标题都一样）→ 409，新标题不被盖掉
        for (String bTitle : java.util.Arrays.asList(DramaCanvasService.DEFAULT_TITLE, null)) {
            BusinessException e = assertThrows(BusinessException.class,
                    () -> svc.save(ME, d.id(), new DramaCanvasService.SaveBody(baseDoc(), bTitle, d.docVersion())));
            assertEquals("DRAMA_CANVAS_STALE", e.getCode());
            assertEquals(a.docVersion(), ((Map<?, ?>) e.getDetails()).get("docVersion"));
        }
        assertEquals("新标题", store.get(d.id()).getTitle());
        // 改回原标题 + 原文档 → 版本也回到原值（版本只由内容和标题决定）
        SaveDramaCanvasResultDto back = svc.save(ME, d.id(),
                new DramaCanvasService.SaveBody(d.doc(), DramaCanvasService.DEFAULT_TITLE, a.docVersion()));
        assertEquals(d.docVersion(), back.docVersion());
    }

    @Test
    void save_lostRaceInDatabase_is409() throws Exception {
        DramaCanvasDetailDto d = fresh();
        // 内存比对通过之后、条件更新之前被别人抢先改了
        doAnswer(inv -> {
            store.get(d.id()).setDocVersion("ffffffffffffffff");
            return 0;
        }).when(repo).updateDocIfVersion(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), any());
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.save(ME, d.id(), new DramaCanvasService.SaveBody(docWithAssets(null), null, d.docVersion())));
        assertEquals("DRAMA_CANVAS_STALE", e.getCode());
        assertEquals("ffffffffffffffff", ((Map<?, ?>) e.getDetails()).get("docVersion"));
    }

    @Test
    void save_badShape_is400_withPath() throws Exception {
        DramaCanvasDetailDto d = fresh();
        assertInvalidDoc(d, doc -> doc.put("schema", 2), "schema");
        assertInvalidDoc(d, doc -> doc.put("schema", "1"), "schema");
        assertInvalidDoc(d, doc -> doc.put("source", "blank"), "source");
        assertInvalidDoc(d, doc -> doc.remove("style"), "style");
        assertInvalidDoc(d, doc -> doc.remove("script"), "script");
        assertInvalidDoc(d, doc -> ((ObjectNode) doc.get("script")).put("episodes", "x"), "script.episodes");
        assertInvalidDoc(d, doc -> ((ObjectNode) doc.get("script")).remove("history"), "script.history");
        assertInvalidDoc(d, doc -> doc.putObject("characters"), "characters");
        assertInvalidDoc(d, doc -> doc.putArray("scenes").add("not-an-object"), "scenes");
        assertInvalidDoc(d, doc -> doc.remove("materials"), "materials");
        assertInvalidDoc(d, doc -> doc.put("episodes", 1), "episodes");
        assertInvalidDoc(d, doc -> doc.remove("board"), "board");
        assertInvalidDoc(d, doc -> ((ObjectNode) doc.get("board")).putArray("positions"), "board.positions");
        assertInvalidDoc(d, doc -> ((ObjectNode) doc.get("board")).remove("edges"), "board.edges");
        assertInvalidDoc(d, doc -> ((ObjectNode) doc.get("board")).remove("collapsed"), "board.collapsed");
        assertInvalidDoc(d, doc -> ((ObjectNode) doc.get("board")).remove("viewport"), "board.viewport");

        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.save(ME, d.id(), new DramaCanvasService.SaveBody(OM.readTree("[]"), null, d.docVersion())));
        assertEquals("DRAMA_CANVAS_INVALID_DOC", e.getCode());
        BusinessException e2 = assertThrows(BusinessException.class,
                () -> svc.save(ME, d.id(), new DramaCanvasService.SaveBody(null, null, d.docVersion())));
        assertEquals("DRAMA_CANVAS_INVALID_DOC", e2.getCode());
        assertEquals(d.docVersion(), store.get(d.id()).getDocVersion(), "一次都没写进去");
    }

    private void assertInvalidDoc(DramaCanvasDetailDto d, Consumer<ObjectNode> breakIt, String path) {
        ObjectNode doc = d.doc().deepCopy();
        breakIt.accept(doc);
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.save(ME, d.id(), new DramaCanvasService.SaveBody(doc, null, d.docVersion())), path);
        assertEquals("DRAMA_CANVAS_INVALID_DOC", e.getCode(), path);
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus(), path);
        assertEquals(path, ((Map<?, ?>) e.getDetails()).get("path"));
    }

    @Test
    void save_over4MB_is413_underLimitSaves() throws Exception {
        DramaCanvasDetailDto d = fresh();
        ObjectNode big = d.doc().deepCopy();
        ObjectNode ep = (ObjectNode) big.at("/script/episodes/0");
        // 中文 3 字节：140 万字 ≈ 4.2MB
        ep.put("text", "字".repeat(1_400_000));
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.save(ME, d.id(), new DramaCanvasService.SaveBody(big, null, d.docVersion())));
        assertEquals("DRAMA_CANVAS_TOO_LARGE", e.getCode());
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, e.getStatus());
        assertEquals(d.docVersion(), store.get(d.id()).getDocVersion());

        // 大小按剥掉 url 之后算：一大串派生地址不占额度
        ObjectNode ok = d.doc().deepCopy();
        ((ObjectNode) ok.at("/script/episodes/0")).put("text", "字".repeat(1_300_000)); // ≈ 3.9MB
        ((ObjectNode) ok.at("/style")).put("url", "u".repeat(500_000));
        svc.save(ME, d.id(), new DramaCanvasService.SaveBody(ok, null, d.docVersion()));
    }

    @Test
    void save_otherUsersCanvas_is404() throws Exception {
        DramaCanvasDetailDto d = fresh();
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.save(OTHER, d.id(), new DramaCanvasService.SaveBody(d.doc(), null, d.docVersion())));
        assertEquals("DRAMA_CANVAS_NOT_FOUND", e.getCode());
        assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
    }

    // ── 读出 ───────────────────────────────────────────────────────────────────

    @Test
    void detail_signsOnlyOwnedKeys_oneOwnershipQuery_andCoverIsFirstOwnedLookImage() throws Exception {
        DramaCanvasDetailDto d = fresh();
        svc.save(ME, d.id(), new DramaCanvasService.SaveBody(docWithAssets("2026-09-30T01:00:00Z"), null, d.docVersion()));
        clearInvocations(ownership);

        DramaCanvasDetailDto out = svc.detail(ME, d.id());
        JsonNode doc = out.doc();
        JsonNode versions = doc.at("/characters/0/looks/0/images/versions");
        assertFalse(versions.get(0).has("url"), "别人的 key 不签");
        assertEquals("theirs/x.png", versions.get(0).path("key").asText(), "也不删，原样给回去");
        assertEquals("https://cdn.test/own/a.png?sig=1", versions.get(1).path("url").asText());
        JsonNode video = doc.at("/episodes/0/segments/0/video/versions/0");
        assertEquals("https://cdn.test/own/v.mp4?sig=1", video.path("url").asText());
        assertEquals("https://cdn.test/own/lf.png?sig=1", video.path("lastFrameUrl").asText());
        assertEquals("https://cdn.test/own/ep1.mp4?sig=1", doc.at("/episodes/0/assembled/url").asText());
        assertEquals("https://cdn.test/own/f.png?sig=1", doc.at("/episodes/0/segments/0/frame/versions/0/url").asText());
        // 第一个造型挑中的是别人的图 → 封面往后找：第二个造型的图
        assertEquals("https://cdn.test/own/b.png?sig=1", out.coverUrl());
        // 归属一次查完（不 N+1）
        verify(ownership, times(1)).ownedKeys(eq(ME), any());
        verify(signer, never()).signKey(startsWith("theirs/"));

        // 统计与步骤
        assertEquals("episodes", out.step());
        assertEquals(1, out.episodeCount());
        assertEquals(1, out.characterCount());
        assertEquals(1, out.sceneCount());
        assertEquals(2, out.segmentsTotal());
        assertEquals(1, out.segmentsDone());
        assertEquals(1, out.episodesAssembled());
    }

    @Test
    void detail_signerReturnsNull_leavesUrlOut() throws Exception {
        DramaCanvasDetailDto d = fresh();
        svc.save(ME, d.id(), new DramaCanvasService.SaveBody(docWithAssets(null), null, d.docVersion()));
        when(signer.signKey(anyString())).thenReturn(null);
        DramaCanvasDetailDto out = svc.detail(ME, d.id());
        Set<String> urls = new HashSet<>();
        out.doc().findValues("url").forEach(v -> urls.add(v.asText()));
        assertTrue(urls.isEmpty(), urls.toString());
        assertNull(out.coverUrl());
    }

    @Test
    void step_scriptThenAssetsThenEpisodes() throws Exception {
        DramaCanvasDetailDto d = fresh();
        assertEquals("script", d.step());

        ObjectNode doc = d.doc().deepCopy();
        ((ObjectNode) doc.get("script")).put("extractedAt", "2026-09-30T01:00:00Z");
        String v = svc.save(ME, d.id(), new DramaCanvasService.SaveBody(doc, null, d.docVersion())).docVersion();
        assertEquals("assets", svc.detail(ME, d.id()).step());

        // 有一集但没有片段 → 仍是 assets
        doc.set("episodes", OM.readTree("[{\"no\":1,\"segments\":[]}]"));
        v = svc.save(ME, d.id(), new DramaCanvasService.SaveBody(doc, null, v)).docVersion();
        assertEquals("assets", svc.detail(ME, d.id()).step());

        doc.set("episodes", OM.readTree("[{\"no\":1,\"segments\":[{\"id\":\"s\",\"text\":\"\",\"durationSec\":0,"
                + "\"frame\":{\"versions\":[]},\"video\":{\"versions\":[]}}]}]"));
        svc.save(ME, d.id(), new DramaCanvasService.SaveBody(doc, null, v));
        DramaCanvasDetailDto out = svc.detail(ME, d.id());
        assertEquals("episodes", out.step());
        assertEquals(1, out.segmentsTotal());
        assertEquals(0, out.segmentsDone());

        // extractedAt 被清掉（比如用户手动删了）→ 回到 script
        assertEquals("script", DramaCanvasService.stats(OM.readTree("{\"script\":{\"extractedAt\":\"\"},\"episodes\":[]}")).step());
    }

    @Test
    void list_newestFirst_coverFromOwnedOnly_oneOwnershipQueryForAll() throws Exception {
        DramaCanvasDetailDto a = fresh();
        svc.save(ME, a.id(), new DramaCanvasService.SaveBody(docWithAssets(null), null, a.docVersion()));
        DramaCanvasDetailDto b = svc.create(ME, idea("第二张"));
        store.get(b.id()).setUpdatedAt(OffsetDateTime.now().plusMinutes(5));
        svc.create(OTHER, idea("别人的"));
        clearInvocations(ownership, signer);

        List<DramaCanvasSummaryDto> list = svc.list(ME);
        assertEquals(List.of(b.id(), a.id()), list.stream().map(DramaCanvasSummaryDto::id).toList());
        assertNull(list.get(0).coverUrl());
        assertEquals("https://cdn.test/own/b.png?sig=1", list.get(1).coverUrl());
        assertEquals(2, list.get(1).segmentsTotal());
        verify(ownership, times(1)).ownedKeys(eq(ME), any());
        // 列表不签整份文档，只签封面
        verify(signer, times(1)).signKey(anyString());
    }

    @Test
    void list_corruptRowDoesNotBreakList_butDetailReportsIt() {
        DramaCanvasDetailDto a = fresh();
        store.get(a.id()).setDocJson("{not json");
        List<DramaCanvasSummaryDto> list = svc.list(ME);
        assertEquals(1, list.size());
        assertEquals(0, list.get(0).episodeCount());
        BusinessException e = assertThrows(BusinessException.class, () -> svc.detail(ME, a.id()));
        assertEquals("DRAMA_CANVAS_DOC_CORRUPT", e.getCode());
    }

    // ── 删除 / 公共方法 / 切集 ──────────────────────────────────────────────────

    @Test
    void delete_softDeletes_thenEverythingIs404() {
        DramaCanvasDetailDto d = fresh();
        assertThrows(BusinessException.class, () -> svc.delete(OTHER, d.id()));
        svc.delete(ME, d.id());
        assertNotNull(store.get(d.id()).getDeletedAt());
        assertTrue(svc.list(ME).isEmpty());
        for (Runnable r : List.<Runnable>of(
                () -> svc.detail(ME, d.id()),
                () -> svc.delete(ME, d.id()),
                () -> svc.requireCanvas(ME, d.id()))) {
            BusinessException e = assertThrows(BusinessException.class, r::run);
            assertEquals("DRAMA_CANVAS_NOT_FOUND", e.getCode());
        }
    }

    @Test
    void publicMethods_requireCanvas_readDoc_requireVersion() throws Exception {
        DramaCanvasDetailDto d = fresh();
        svc.save(ME, d.id(), new DramaCanvasService.SaveBody(docWithAssets(null), null, d.docVersion()));
        DramaCanvas c = svc.requireCanvas(ME, d.id());

        JsonNode doc = svc.readDoc(c);
        assertFalse(doc.toString().contains("\"url\""), "库里那份没有 url");
        ((ObjectNode) doc).put("mutated", true);
        assertFalse(svc.readDoc(c).has("mutated"), "每次一份新树");

        svc.requireVersion(c, c.getDocVersion());
        svc.requireVersion(c, " " + c.getDocVersion() + " ");
        for (String bad : java.util.Arrays.asList(null, "", d.docVersion())) {
            BusinessException e = assertThrows(BusinessException.class, () -> svc.requireVersion(c, bad));
            assertEquals("DRAMA_CANVAS_STALE", e.getCode());
            assertEquals(HttpStatus.CONFLICT, e.getStatus());
        }

        for (String[] args : new String[][]{{OTHER, d.id()}, {ME, "dcv_nope"}, {ME, null}, {null, d.id()}}) {
            BusinessException e = assertThrows(BusinessException.class, () -> svc.requireCanvas(args[0], args[1]));
            assertEquals("DRAMA_CANVAS_NOT_FOUND", e.getCode());
        }
    }

    @Test
    void signAssets_signsOnlyOwnedKeys_othersAbsent_oneOwnershipQuery() {
        DramaCanvasDetailDto d = fresh();
        clearInvocations(ownership, signer);
        var r = svc.signAssets(ME, d.id(), new DramaCanvasService.SignBody(
                java.util.Arrays.asList("own/a.png", "theirs/x.png", "own/a.png", null, " ", "own/v.mp4", "nope")));
        assertEquals(Map.of("own/a.png", "https://cdn.test/own/a.png?sig=1", "own/v.mp4", "https://cdn.test/own/v.mp4?sig=1"),
                r.urls());
        verify(ownership, times(1)).ownedKeys(eq(ME), any());
        verify(signer, never()).signKey(startsWith("theirs/"));

        // 签名失败（返回 null）的也不出现，不报错
        when(signer.signKey("own/a.png")).thenReturn(null);
        assertEquals(Set.of("own/v.mp4"),
                svc.signAssets(ME, d.id(), new DramaCanvasService.SignBody(List.of("own/a.png", "own/v.mp4"))).urls().keySet());
    }

    @Test
    void signAssets_validationAndOwnership() {
        DramaCanvasDetailDto d = fresh();
        List<String> tooMany = new ArrayList<>();
        for (int i = 0; i < 101; i++) tooMany.add("own/" + i + ".png");
        for (DramaCanvasService.SignBody bad : java.util.Arrays.asList(
                new DramaCanvasService.SignBody(tooMany), new DramaCanvasService.SignBody(List.of()),
                new DramaCanvasService.SignBody(null), null)) {
            BusinessException e = assertThrows(BusinessException.class, () -> svc.signAssets(ME, d.id(), bad));
            assertEquals("DRAMA_CANVAS_BODY_INVALID", e.getCode());
            assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        }
        // 正好 100 个可以
        assertEquals(100, svc.signAssets(ME, d.id(), new DramaCanvasService.SignBody(tooMany.subList(0, 100))).urls().size());
        // 别人的画布 404（先判画布，再看 key）
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.signAssets(OTHER, d.id(), new DramaCanvasService.SignBody(List.of("own/a.png"))));
        assertEquals("DRAMA_CANVAS_NOT_FOUND", e.getCode());
    }

    @Test
    void split_returnsEpisodesAndNotes_withoutTouchingDoc() {
        DramaCanvasDetailDto d = fresh();
        SplitCanvasScriptResultDto r = svc.split(ME, d.id(), new DramaCanvasService.SplitBody("第一集 甲\na\n第二集 乙\nb"));
        assertEquals(List.of(new SplitCanvasScriptResultDto.Episode(1, "甲", "a"), new SplitCanvasScriptResultDto.Episode(2, "乙", "b")),
                r.episodes());
        assertFalse(r.notes().isEmpty());
        assertEquals(d.docVersion(), store.get(d.id()).getDocVersion());
        verify(repo, never()).updateDocIfVersion(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), any());

        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.split(ME, d.id(), new DramaCanvasService.SplitBody(" ")));
        assertEquals("DRAMA_CANVAS_BODY_INVALID", e.getCode());
        BusinessException e2 = assertThrows(BusinessException.class,
                () -> svc.split(OTHER, d.id(), new DramaCanvasService.SplitBody("x")));
        assertEquals("DRAMA_CANVAS_NOT_FOUND", e2.getCode());
    }
}
