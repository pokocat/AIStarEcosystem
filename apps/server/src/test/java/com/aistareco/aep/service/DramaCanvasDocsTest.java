package com.aistareco.aep.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * DramaCanvasDocs：引用标记（parseRefs / stripRefs 的边界）、各查找函数、挑中版本、连线、收 key / 剥 url、规范化与指纹。
 * 运行记录服务依赖这些函数的行为，这里钉死。
 */
class DramaCanvasDocsTest {

    private static final ObjectMapper OM = new ObjectMapper();

    private static JsonNode json(String s) throws Exception {
        return OM.readTree(s.replace('\'', '"'));
    }

    // ── 引用标记 ────────────────────────────────────────────────────────────────

    @Test
    void parseRefs_findsAllThreeKinds_withPositions() {
        String t = "（4 秒）@[林微·成年](look:lk_ab12) 在 @[旧教室](scene:sc-1) 翻 @[铁盒](material:m1)。";
        List<DramaCanvasDocs.Ref> refs = DramaCanvasDocs.parseRefs(t);
        assertEquals(3, refs.size());
        assertEquals(new DramaCanvasDocs.Ref("look", "lk_ab12", "林微·成年",
                t.indexOf("@[林微"), t.indexOf("(look:lk_ab12)") + "(look:lk_ab12)".length()), refs.get(0));
        assertEquals("scene", refs.get(1).kind());
        assertEquals("sc-1", refs.get(1).id());
        assertEquals("旧教室", refs.get(1).label());
        assertEquals("material", refs.get(2).kind());
        assertEquals("m1", refs.get(2).id());
        // [start, end) 截出来正好是整个标记
        DramaCanvasDocs.Ref r = refs.get(1);
        assertEquals("@[旧教室](scene:sc-1)", t.substring(r.start(), r.end()));
    }

    @Test
    void parseRefs_labelMayContainChineseSpacesAndPunctuation() {
        List<DramaCanvasDocs.Ref> refs = DramaCanvasDocs.parseRefs("@[陈 屹 · 摘掉安全帽 (夜)](look:x)");
        assertEquals(1, refs.size());
        assertEquals("陈 屹 · 摘掉安全帽 (夜)", refs.get(0).label());
    }

    @Test
    void parseRefs_rejectsIllegalIdsKindsAndLengths() {
        assertTrue(DramaCanvasDocs.parseRefs("@[甲](look:a.b)").isEmpty(), "id 里不能有点");
        assertTrue(DramaCanvasDocs.parseRefs("@[甲](look:a/b)").isEmpty(), "id 里不能有斜杠");
        assertTrue(DramaCanvasDocs.parseRefs("@[甲](look:)").isEmpty(), "id 不能为空");
        assertTrue(DramaCanvasDocs.parseRefs("@[甲](prop:a1)").isEmpty(), "只认 look / scene / material");
        assertTrue(DramaCanvasDocs.parseRefs("@[](look:a1)").isEmpty(), "显示名不能为空");
        assertTrue(DramaCanvasDocs.parseRefs("@[" + "名".repeat(41) + "](look:a1)").isEmpty(), "显示名最多 40 个字符");
        assertEquals(1, DramaCanvasDocs.parseRefs("@[" + "名".repeat(40) + "](look:a1)").size());
        assertTrue(DramaCanvasDocs.parseRefs("@[甲](look:" + "a".repeat(65) + ")").isEmpty(), "id 最多 64 位");
        assertEquals(1, DramaCanvasDocs.parseRefs("@[甲](look:" + "a".repeat(64) + ")").size());
        assertTrue(DramaCanvasDocs.parseRefs("[甲](look:a1)").isEmpty(), "没有 @ 不算");
        assertTrue(DramaCanvasDocs.parseRefs(null).isEmpty());
        assertTrue(DramaCanvasDocs.parseRefs("").isEmpty());
    }

    @Test
    void parseRefs_doesNotCrossLineBreaks() {
        assertTrue(DramaCanvasDocs.parseRefs("@[林\n微](look:a1)").isEmpty(), "显示名里有换行不算");
        // 换行两边各自完整的照常认
        assertEquals(2, DramaCanvasDocs.parseRefs("@[甲](look:a1)\n@[乙](scene:b2)").size());
    }

    @Test
    void stripRefs_replacesMarkersWithLabels_keepsEverythingElse() {
        assertEquals("（4 秒）林微·成年 蹲在旧教室里。$1 不是反向引用",
                DramaCanvasDocs.stripRefs("（4 秒）@[林微·成年](look:lk_1) 蹲在@[旧教室](scene:s1)里。$1 不是反向引用"));
        // 显示名里的 $ 与 \ 原样保留（不能被当成替换语法）
        assertEquals("价格$5\\x", DramaCanvasDocs.stripRefs("@[价格$5\\x](material:m1)"));
        // 非法标记当普通文字
        assertEquals("@[甲](look:a.b)", DramaCanvasDocs.stripRefs("@[甲](look:a.b)"));
        assertEquals("", DramaCanvasDocs.stripRefs(null));
    }

    // ── 查找 ────────────────────────────────────────────────────────────────────

    private static final String DOC = "{"
            + "'schema':1,'source':'paste','style':{'id':'none','name':'无风格','prompt':''},"
            + "'script':{'episodes':[{'no':1,'title':'一','text':'a'},{'no':2,'title':'二','text':'b'}],'history':[]},"
            + "'characters':["
            + "  {'id':'c1','name':'林微','role':'lead','looks':["
            + "    {'id':'lk1','name':'基础造型','prompt':'p','episodes':[1],'images':{'versions':[{'key':'k/a.png'},{'key':'k/b.png'}],'pickedKey':'k/b.png'}},"
            + "    {'id':'lk2','name':'学生时期','prompt':'p','episodes':[2],'images':{'versions':[]}}]},"
            + "  {'id':'c2','name':'陈屹','role':'support','looks':[{'id':'lk3','name':'基础造型','prompt':'p','episodes':[1],'images':{'versions':[]}}]}],"
            + "'scenes':[{'id':'s1','name':'旧教室','prompt':'p','episodes':[1],'images':{'versions':[{'key':'k/s.png'}],'pickedKey':'gone.png'}}],"
            + "'materials':[{'id':'m1','name':'铁盒','kind':'image','images':{'versions':[{'key':'k/m.png'}]}},{'id':'m2','name':'说明','kind':'text','text':'t'}],"
            + "'board':{'positions':{},'edges':["
            + "  {'id':'e1','source':'m1','target':'lk1'},{'id':'e2','source':'m2','target':'s1'},{'id':'e3','source':'s1','target':'lk1'}],"
            + "  'collapsed':[],'viewport':{'x':0,'y':0,'zoom':1}},"
            + "'episodes':[{'no':1,'segments':["
            + "  {'id':'sg1','text':'x','durationSec':5,'frame':{'versions':[]},'video':{'versions':["
            + "     {'key':'v/1.mp4','lastFrameKey':'v/1.png','runId':'r1','createdAt':'2026-09-30T00:00:00Z'},"
            + "     {'key':'v/2.mp4','runId':'r2','createdAt':'2026-09-30T00:00:00Z'}],'pickedKey':'v/2.mp4'}}]}]"
            + "}";

    @Test
    void finders_locateByIdAndNo_andAreLenientOnMissing() throws Exception {
        JsonNode doc = json(DOC);
        assertEquals("学生时期", DramaCanvasDocs.findLook(doc, "lk2").orElseThrow().path("name").asText());
        assertEquals("陈屹", DramaCanvasDocs.findCharacterOfLook(doc, "lk3").orElseThrow().path("name").asText());
        assertEquals("c1", DramaCanvasDocs.findCharacterOfLook(doc, "lk1").orElseThrow().path("id").asText());
        assertEquals("旧教室", DramaCanvasDocs.findScene(doc, "s1").orElseThrow().path("name").asText());
        assertEquals("text", DramaCanvasDocs.findMaterial(doc, "m2").orElseThrow().path("kind").asText());
        assertEquals("b", DramaCanvasDocs.findScriptEpisode(doc, 2).orElseThrow().path("text").asText());
        assertEquals(1, DramaCanvasDocs.findEpisode(doc, 1).orElseThrow().path("segments").size());
        assertEquals(5, DramaCanvasDocs.findSegment(doc, 1, "sg1").orElseThrow().path("durationSec").asInt());

        assertTrue(DramaCanvasDocs.findLook(doc, "nope").isEmpty());
        assertTrue(DramaCanvasDocs.findLook(doc, null).isEmpty());
        assertTrue(DramaCanvasDocs.findCharacterOfLook(doc, "nope").isEmpty());
        assertTrue(DramaCanvasDocs.findScene(doc, "lk1").isEmpty(), "不跨类型找");
        assertTrue(DramaCanvasDocs.findScriptEpisode(doc, 3).isEmpty());
        assertTrue(DramaCanvasDocs.findEpisode(doc, 2).isEmpty(), "逐集制作里还没有第 2 集");
        assertTrue(DramaCanvasDocs.findSegment(doc, 1, "sg9").isEmpty());
        assertTrue(DramaCanvasDocs.findSegment(doc, 2, "sg1").isEmpty());
        // 形状不对的文档不抛
        JsonNode bad = json("{'characters':'x','script':5,'episodes':{'no':1}}");
        assertTrue(DramaCanvasDocs.findLook(bad, "lk1").isEmpty());
        assertTrue(DramaCanvasDocs.findScriptEpisode(bad, 1).isEmpty());
        assertTrue(DramaCanvasDocs.findEpisode(bad, 1).isEmpty());
        assertTrue(DramaCanvasDocs.findLook(null, "lk1").isEmpty());
    }

    @Test
    void findByNo_requiresIntegralNumber() throws Exception {
        JsonNode doc = json("{'episodes':[{'no':'1'},{'no':1.5},{'no':2}]}");
        assertTrue(DramaCanvasDocs.findEpisode(doc, 1).isEmpty(), "字符串 '1' 和 1.5 都不算第 1 集");
        assertTrue(DramaCanvasDocs.findEpisode(doc, 2).isPresent());
    }

    @Test
    void pickedImageKey_usesPickedWhenPresent_elseFirst_elseEmpty() throws Exception {
        JsonNode doc = json(DOC);
        assertEquals(Optional.of("k/b.png"), DramaCanvasDocs.pickedImageKey(DramaCanvasDocs.findLook(doc, "lk1").orElseThrow().path("images")));
        // pickedKey 指向不在 versions 里的图 → 第一张
        assertEquals(Optional.of("k/s.png"), DramaCanvasDocs.pickedImageKey(DramaCanvasDocs.findScene(doc, "s1").orElseThrow().path("images")));
        assertEquals(Optional.empty(), DramaCanvasDocs.pickedImageKey(DramaCanvasDocs.findLook(doc, "lk2").orElseThrow().path("images")));
        assertEquals(Optional.of("k/m.png"), DramaCanvasDocs.pickedImageKey(DramaCanvasDocs.findMaterial(doc, "m1").orElseThrow().path("images")));
        // 没有 key 的版本跳过
        assertEquals(Optional.of("k/2"), DramaCanvasDocs.pickedImageKey(json("{'versions':[{'runId':'r'},{'key':''},{'key':'k/2'}]}")));
        assertEquals(Optional.empty(), DramaCanvasDocs.pickedImageKey(null));
        assertEquals(Optional.empty(), DramaCanvasDocs.pickedImageKey(json("{'versions':'x'}")));
    }

    @Test
    void pickedVideo_returnsWholeVersion() throws Exception {
        JsonNode seg = DramaCanvasDocs.findSegment(json(DOC), 1, "sg1").orElseThrow();
        JsonNode v = DramaCanvasDocs.pickedVideo(seg.path("video")).orElseThrow();
        assertEquals("v/2.mp4", v.path("key").asText());
        assertEquals("r2", v.path("runId").asText());
        JsonNode first = DramaCanvasDocs.pickedVideo(json("{'versions':[{'key':'v/1.mp4','lastFrameKey':'v/1.png'}]}")).orElseThrow();
        assertEquals("v/1.png", first.path("lastFrameKey").asText());
        assertTrue(DramaCanvasDocs.pickedVideo(json("{'versions':[]}")).isEmpty());
    }

    @Test
    void incomingEdges_keepsDocumentOrder() throws Exception {
        List<JsonNode> in = DramaCanvasDocs.incomingEdges(json(DOC), "lk1");
        assertEquals(List.of("e1", "e3"), in.stream().map(e -> e.path("id").asText()).toList());
        assertEquals(1, DramaCanvasDocs.incomingEdges(json(DOC), "s1").size());
        assertTrue(DramaCanvasDocs.incomingEdges(json(DOC), "m1").isEmpty());
        assertTrue(DramaCanvasDocs.incomingEdges(json("{'board':{'edges':'x'}}"), "a").isEmpty());
    }

    // ── key / url ───────────────────────────────────────────────────────────────

    @Test
    void collectAssetKeys_findsKeyAndLastFrameKeyEverywhere() throws Exception {
        Set<String> keys = new LinkedHashSet<>();
        DramaCanvasDocs.collectAssetKeys(json(DOC), keys);
        assertEquals(Set.of("k/a.png", "k/b.png", "k/s.png", "k/m.png", "v/1.mp4", "v/1.png", "v/2.mp4"), keys);
        // pickedKey 不是资产本身（它指向 versions 里已有的那张）；非字符串的 key 不收
        Set<String> k2 = new LinkedHashSet<>();
        DramaCanvasDocs.collectAssetKeys(json("{'pickedKey':'p','key':5,'x':{'key':['a']},'y':[{'key':'ok'}]}"), k2);
        assertEquals(Set.of("ok"), k2);
    }

    @Test
    void stripDerivedUrls_removesUrlAndLastFrameUrlRecursively_butNotObjects() throws Exception {
        JsonNode doc = json("{'a':{'key':'k','url':'https://x?sig=1','lastFrameKey':'l','lastFrameUrl':'https://y'},"
                + "'b':[{'url':null},{'url':'u','keep':1}],"
                + "'board':{'positions':{'url':{'x':1,'y':2}}}}");
        DramaCanvasDocs.stripDerivedUrls(doc);
        assertEquals("{\"a\":{\"key\":\"k\",\"lastFrameKey\":\"l\"},\"b\":[{},{\"keep\":1}],"
                + "\"board\":{\"positions\":{\"url\":{\"x\":1,\"y\":2}}}}", OM.writeValueAsString(doc));
    }

    // ── 规范化与指纹 ────────────────────────────────────────────────────────────

    @Test
    void canonicalJson_sortsKeysRecursively_keepsArrayOrder() throws Exception {
        String a = DramaCanvasDocs.canonicalJson(json("{'b':1,'a':{'z':[3,1,2],'y':'中文'}}"));
        String b = DramaCanvasDocs.canonicalJson(json("{'a':{'y':'中文','z':[3,1,2]},'b':1}"));
        assertEquals("{\"a\":{\"y\":\"中文\",\"z\":[3,1,2]},\"b\":1}", a);
        assertEquals(a, b);
        assertNotEquals(a, DramaCanvasDocs.canonicalJson(json("{'b':1,'a':{'z':[1,2,3],'y':'中文'}}")), "数组顺序有意义");
    }

    @Test
    void docVersionOf_isSixteenHexOfSha256_andStable() {
        String v = DramaCanvasDocs.docVersionOf("{}");
        assertEquals("44136fa355b3678a", v); // sha256("{}") = 44136fa355b3678a1146ad16f7e8649e…
        assertTrue(DramaCanvasDocs.docVersionOf("{\"a\":1}").matches("[0-9a-f]{16}"));
        assertNotEquals(v, DramaCanvasDocs.docVersionOf("{\"a\":1}"));
        assertEquals(DramaCanvasDocs.docVersionOf("中"), DramaCanvasDocs.docVersionOf("中"));
    }

    @Test
    void docVersionOfWithTitle_coversTitle_andIsNotAmbiguous() {
        String doc = "{\"a\":1}";
        String v = DramaCanvasDocs.docVersionOf(doc, "标题");
        assertTrue(v.matches("[0-9a-f]{16}"));
        assertEquals(v, DramaCanvasDocs.docVersionOf(doc, "标题"));
        assertNotEquals(v, DramaCanvasDocs.docVersionOf(doc, "标题2"), "只改标题也要变");
        assertNotEquals(v, DramaCanvasDocs.docVersionOf("{\"a\":2}", "标题"));
        assertNotEquals(DramaCanvasDocs.docVersionOf(doc), v, "与只算文档的指纹不同");
        // 分隔符让「文档 + 标题」的拼接没有歧义
        assertNotEquals(DramaCanvasDocs.docVersionOf("ab", "c"), DramaCanvasDocs.docVersionOf("a", "bc"));
        assertEquals(DramaCanvasDocs.docVersionOf(doc, null), DramaCanvasDocs.docVersionOf(doc, ""));
    }
}
