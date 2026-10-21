package com.aistareco.aep.ipstudio.skill;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Intent routing (意图直达 2026-10-20; tie and writing rules 2026-10-21, docs/ip-studio-dialogue-intents.md §4): a writing
 * intent goes to 写剧本与文案 whatever is attached; words outrank attachments and attachments alone never pick a method;
 * a unique best wins; nothing named keeps the bound skill (else none, 全能创作); a tie unbinds and is the model's call —
 * never the current skill by default, never a 400 that makes the UI ask which method.
 */
class StudioSkillRouterTest {
    static final Path FILE = Path.of("src/main/resources/studio/skills/reference-video-recreation.md");

    static StudioSkill skill(String key, String triggers) throws Exception {
        String text = Files.readString(FILE).replace("key: reference-video-recreation", "key: " + key);
        int start = text.indexOf("triggers:"), end = text.indexOf("\n---", start);
        return StudioSkillCatalog.parse(text.substring(0, start) + triggers + text.substring(end));
    }

    final StudioSkill video, script, plain;
    StudioSkillRouterTest() throws Exception {
        video = skill("video-recreation", "triggers:\n  media: [video]\n  keywords: [复刻, 拉片]\n  default: true");
        script = skill("script-rewrite", "triggers:\n  media: [text]\n  keywords: [改脚本, 文案]");
        plain = skill("poster", "triggers:\n  media: [image]\n  keywords: [海报]");
    }

    @Test void noActiveSkillMeansNoSkillAndASingleOneOnlyWhenTheMessageAsksForIt() {
        assertTrue(StudioSkillRouter.route(List.of(), Set.of("video"), "随便").isEmpty());
        assertEquals("script-rewrite", StudioSkillRouter.route(List.of(script), Set.of(), "帮我改脚本").orElseThrow().key());
        // The only skill on the shelf is still a method for one kind of job (local e2e 2026-10-19: 「生成商品宣传图」 bound 参考视频复刻).
        assertTrue(StudioSkillRouter.route(List.of(video), Set.of(), "生成商品宣传图，9:16").isEmpty());
        assertTrue(StudioSkillRouter.route(List.of(video), Set.of("image"), "做一张海报").isEmpty());
        assertEquals("video-recreation", StudioSkillRouter.route(List.of(video), Set.of("video", "image"), "复刻这条视频").orElseThrow().key());
        // A pinned video alone is material, not 「复刻」 (2026-10-21: with the clips pinned, 「合成成片」 used to become 复刻).
        assertTrue(StudioSkillRouter.route(List.of(video), Set.of("video", "image"), "照这条视频做").isEmpty());
    }

    @Test void wordsOutrankAttachmentsAndAUniqueBestWins() {
        assertEquals("script-rewrite", StudioSkillRouter.route(List.of(video, script), Set.of(), "帮我改脚本").orElseThrow().key());
        assertEquals("poster", StudioSkillRouter.route(List.of(video, script, plain), Set.of("image"), "做一张海报").orElseThrow().key());
        assertTrue(StudioSkillRouter.route(List.of(video, script, plain), Set.of("image"), "做一张").isEmpty(), "a pinned picture alone names no job");
        // An attached video is material; 「文案」 says what to make of it. With media weighted double, a product photo plus
        // 「写一段文案」 used to become an image job.
        assertEquals("script-rewrite", StudioSkillRouter.route(List.of(video, script), Set.of("video"), "文案也看看").orElseThrow().key());
        assertEquals("video-recreation", StudioSkillRouter.route(List.of(video, script), Set.of("video", "text"), "复刻这条").orElseThrow().key());
        assertEquals("script-rewrite", StudioSkillRouter.route(List.of(video, script), Set.of(), "改脚本 TEXT").orElseThrow().key());
        // Media still weighs in once the words named something: 复刻 + 文案 is a tie without the video, 复刻 with it.
        assertEquals(StudioSkillRouter.Kind.OPEN, StudioSkillRouter.decide(List.of(video, script), Set.of(), "复刻这条的文案", null).kind());
        assertEquals("video-recreation", StudioSkillRouter.route(List.of(video, script), Set.of("video"), "复刻这条的文案").orElseThrow().key());
    }

    @Test void noHitIsTheGeneralDialogueNotTheDefault() {
        assertTrue(StudioSkillRouter.route(List.of(video, script), Set.of(), "你好").isEmpty());
        assertTrue(StudioSkillRouter.route(List.of(script, plain), Set.of(), "你好").isEmpty());
        assertEquals(StudioSkillRouter.Kind.KEEP, StudioSkillRouter.decide(List.of(script, plain), Set.of(), "你好", null).kind());
    }

    @Test void noHitKeepsTheSkillTheThreadAlreadyHasWhileItIsActive() throws Exception {
        assertEquals("poster", StudioSkillRouter.route(List.of(video, script, plain), Set.of(), "再来一张，背景亮一点", plain).orElseThrow().key(),
                "a follow-up that names no job continues the current one");
        assertEquals("poster", StudioSkillRouter.route(List.of(video, script, plain), Set.of("video"), "亮一点", plain).orElseThrow().key(),
                "…whatever is pinned: a pinned video does not make it 复刻");
        assertEquals("script-rewrite", StudioSkillRouter.route(List.of(video, script, plain), Set.of(), "帮我改脚本", plain).orElseThrow().key(),
                "a message that names another job switches");
        var withdrawn = skill("gone", "triggers:\n  media: []\n  keywords: []").withRuntime("withdrawn", 1);
        assertTrue(StudioSkillRouter.route(List.of(video, script, plain), Set.of(), "谢谢", withdrawn).isEmpty(), "a withdrawn method never carries over");
        var offShelf = skill("off-shelf", "triggers:\n  media: []\n  keywords: []");
        assertTrue(StudioSkillRouter.route(List.of(video, script, plain), Set.of(), "谢谢", offShelf).isEmpty(), "nor one that is no longer offered");
    }

    /** 2026-10-21: a tie is the model's call even when the current skill is one of the tied — it used to keep it. */
    @Test void aTieIsLeftToTheModelNotToTheCurrentSkillADefaultOrA400() throws Exception {
        var both = skill("poster-recreation", "triggers:\n  media: [image]\n  keywords: [复刻]");
        var tie = StudioSkillRouter.decide(List.of(both, video), Set.of(), "复刻一下", null);
        assertEquals(StudioSkillRouter.Kind.OPEN, tie.kind(), "the default is a hint for the model, not a tie-break");
        assertNull(tie.skill());
        assertEquals(List.of("poster-recreation", "video-recreation"), tie.tied());
        var onTied = StudioSkillRouter.decide(List.of(both, video), Set.of(), "复刻一下", video);
        assertEquals(StudioSkillRouter.Kind.OPEN, onTied.kind(), "a tie that includes the current method no longer keeps it");
        assertTrue(StudioSkillRouter.route(List.of(both, video), Set.of(), "复刻一下", video).isEmpty());
        assertEquals(StudioSkillRouter.Kind.OPEN, StudioSkillRouter.decide(List.of(both, video), Set.of(), "复刻一下", plain).kind());
        // Two attachments and no words is not a tie: nothing was asked, so nothing changes.
        assertTrue(StudioSkillRouter.route(List.of(script, plain, video), Set.of("text", "image"), "").isEmpty());
        assertEquals("poster", StudioSkillRouter.route(List.of(script, plain, video), Set.of("text", "image"), "", plain).orElseThrow().key());
    }

    @Test void triggersParseLenientlyAndNeverReject() throws Exception {
        var odd = skill("odd", "triggers:\n  media: [video, hologram, 3]\n  keywords: [\"  复刻 \", \"\", 复刻]\n  default: yes-please");
        assertEquals(List.of("video"), odd.triggers().media());
        assertEquals(List.of("复刻"), odd.triggers().keywords());
        assertFalse(odd.triggers().defaultSkill());
        var notAMap = skill("odd2", "triggers: video");
        assertFalse(notAMap.triggers().declared());
        assertNull(notAMap.summaryDto().triggers());
        assertEquals("video", StudioSkillRouter.mediaOf("video"));
        assertEquals("audio", StudioSkillRouter.mediaOf("audio"));
        assertNull(StudioSkillRouter.mediaOf("config"));
    }

    // ── Writing intent ───────────────────────────────────────────────────────────────────────────────────────────

    @Test void aWritingVerbWithATextObjectIsWriting() {
        for (String text : List.of("用这张商品图写三条卖点文案", "做个视频脚本", "帮我写一段视频脚本，30 秒", "帮我写一个视频口播稿",
                "写一集 60 秒的短剧剧本：外卖小哥捡到一只会说话的猫", "给这张海报写几个标题", "这是我的商品图，帮我写三条卖点文案",
                "想几个标题", "出几条带货文案", "来一段口播", "润色一下这段口播", "把原来的文案改短一点", "起几个标题",
                "写个脚本，然后做成视频", "照这条视频写个口播", "编个故事", "列个大纲", "修改一下文案", "写一集 9:16 竖屏短剧的剧本",
                "写每个镜头的台词"))
            assertEquals(StudioSkillRouter.Writing.FIRST, StudioSkillRouter.writingIntent(text.toLowerCase(Locale.ROOT)), text);
    }

    @Test void textThatIsPartOfAPictureOrAVideoIsNotWriting() {
        for (String text : List.of("画一张海报，标题写「夏日特饮上新」", "画一张海报，写上标题「夏日特饮上新」", "做一张带标题的海报",
                "做个口播视频", "改一下海报上的标题", "出一张线稿", "做一张卖点图", "出分镜图", "做个人设定图", "用这张图做一段视频",
                "帮我做个封面，内容是「夏日特饮上新」", "动起来以后加字幕", "特写镜头", "写三条文案配图"))
            assertEquals(StudioSkillRouter.Writing.NONE, StudioSkillRouter.writingIntent(text.toLowerCase(Locale.ROOT)), text);
        for (String text : List.of("做一张海报，上面写标题：夏日特饮上新", "做一条视频，先写个脚本", "画一张海报，再写三条文案",
                "让这张图动起来，再写一段旁白", "复刻这条，写个新口播", "做一个海报然后写个标题"))
            assertEquals(StudioSkillRouter.Writing.AFTER_OTHER, StudioSkillRouter.writingIntent(text.toLowerCase(Locale.ROOT)), text);
        // Material that already exists is not another output asked for first.
        for (String text : List.of("这是我拍的视频，帮我写三条文案", "我拍了一条视频，写个口播稿", "用做好的图写几个标题", "生成的图不错，写个简介"))
            assertEquals(StudioSkillRouter.Writing.FIRST, StudioSkillRouter.writingIntent(text.toLowerCase(Locale.ROOT)), text);
    }

    // ── Table: the repository skill files, the sentences met in production (2026-10-21) and §7 of the intents doc ──

    private static final List<StudioSkill> ACTIVE = new StudioSkillCatalog().available();
    private static final String IMAGE = "image-generation", VIDEO = "video-generation", SCRIPT = "script-writing", RECREATE = "reference-video-recreation";
    /** Every thread state a message can arrive on: unbound, or bound to each method. */
    private static final List<String> BOUNDS = Arrays.asList(null, IMAGE, VIDEO, SCRIPT, RECREATE);
    /** Expected outcome tokens: a skill key (bound to it from any state), OPEN (a tie, unbound, the model picks), KEEP (unchanged). */
    private static final String OPEN = "OPEN", KEEP = "KEEP";

    private record Case(String text, Set<String> media, String expected) {}

    private static Case c(String text, String media, String expected) {
        return new Case(text, media.isEmpty() ? Set.of() : Set.of(media.split("\\+")), expected);
    }

    static final List<Case> TABLE = List.of(
            // Production 2026-10-21, with and without the picture / video attached.
            c("用这张图做一段视频", "", VIDEO), c("用这张图做一段视频", "image", VIDEO), c("用这张图做一段视频", "video", VIDEO),
            // 出图's bare 「几张图 / 一张图」 tied these with 出视频 and the tie kept 出图 on the thread that had just made the
            // pictures. 「用这几张图」 is material: 出图 now names the request (出几张图 / 生成一张图…), so 出视频 wins outright.
            c("用这几张图做一段视频", "", VIDEO), c("用这几张图做一段视频", "image", VIDEO), c("用这几张图做一段视频", "video", VIDEO),
            c("用一张图生成一段视频", "", VIDEO), c("用一张图生成一段视频", "image", VIDEO), c("用一张图生成一段视频", "video", VIDEO),
            c("再出几张图", "", IMAGE), c("生成一张图，国风少女", "", IMAGE),
            // 「商品图」 is still an 出图 word: with a video word too it is a tie, the model's call (real calls: 出视频 3/3).
            c("用这张商品图做一段视频", "image", OPEN),
            c("用这张商品图写三条卖点文案", "", SCRIPT), c("用这张商品图写三条卖点文案", "image", SCRIPT), c("用这张商品图写三条卖点文案", "video", SCRIPT),
            c("做个ip形象三视图", "", IMAGE), c("做个ip形象三视图", "image", IMAGE), c("做个ip形象三视图", "video", IMAGE),
            c("换个风格再出一张", "", IMAGE), c("换个风格再出一张", "image", IMAGE), c("换个风格再出一张", "video", IMAGE),
            c("把做好的片段合成一条成片", "", KEEP), c("把做好的片段合成一条成片", "image", KEEP), c("把做好的片段合成一条成片", "video", KEEP),
            c("写一集 60 秒的短剧剧本：外卖小哥捡到一只会说话的猫", "", SCRIPT), c("写一集 60 秒的短剧剧本：外卖小哥捡到一只会说话的猫", "image", SCRIPT),
            c("写一集 60 秒的短剧剧本：外卖小哥捡到一只会说话的猫", "video", SCRIPT),
            c("照这条视频的拍法，把商品换成我的", "", RECREATE), c("照这条视频的拍法，把商品换成我的", "video", RECREATE),
            c("照这条视频的拍法，把商品换成我的", "video+image", RECREATE),
            // The 14:36 hotfix put 「做个视频」 on 出视频, which took this one; the writing intent takes it back.
            c("做个视频脚本", "", SCRIPT), c("做个视频脚本", "image", SCRIPT), c("做个视频脚本", "video", SCRIPT),
            // Text that belongs to a picture stays with the picture.
            c("画一张海报，标题写「夏日特饮上新」", "", IMAGE), c("画一张海报，标题写「夏日特饮上新」", "image", IMAGE),
            c("做一张海报，上面写标题：夏日特饮上新", "", IMAGE), c("做一张海报，上面写标题：夏日特饮上新", "text", IMAGE),
            c("做一张带标题的海报", "", IMAGE),
            // docs/ip-studio-dialogue-intents.md §7.
            c("画一张国风少女海报，9:16", "", IMAGE), c("画一张国风少女海报，9:16", "image", IMAGE),
            c("把这张图动起来，5 秒", "image", VIDEO), c("把这张图动起来，5 秒", "", VIDEO),
            c("复刻这条，换成我的保温杯", "video+image", RECREATE), c("复刻这条，换成我的保温杯", "", RECREATE),
            c("照着参考视频做一条", "video", RECREATE), c("照着参考视频做一条", "", OPEN),
            c("再来一张，背景亮一点", "", IMAGE),
            c("这段文案怎么样，能更有力一点吗", "text", SCRIPT), c("这段文案怎么样，能更有力一点吗", "", SCRIPT),
            c("你好", "", KEEP), c("谢谢", "", KEEP),
            c("做张图", "", IMAGE),
            c("帮我做个封面，内容是「夏日特饮上新」", "", IMAGE), c("帮我做个封面，内容是「夏日特饮上新」", "image", IMAGE),
            c("画布上的这段剧本，出成视频", "text", VIDEO),
            // Was 复刻 by the pinned video alone; nothing in the words names a method (the dialogue says where dubbing is done).
            c("这个视频配个音", "video", KEEP),
            c("写一段视频脚本，30 秒", "", SCRIPT), c("写一段视频脚本，30 秒", "video", SCRIPT),
            // The job named first wins over text that is part of it (the video method writes its own narration step).
            c("做一条视频，先写个脚本", "", VIDEO), c("做一个海报然后写个标题", "", IMAGE),
            // Two named jobs with equal evidence: the model decides, even on a thread that is on one of them.
            c("复刻这条，换成我的保温杯，做一个视频", "video+image", OPEN));

    @Test void theRoutingTableHoldsFromEveryThreadState() {
        assertTrue(ACTIVE.stream().map(StudioSkill::key).toList().containsAll(List.of(IMAGE, VIDEO, SCRIPT, RECREATE)), "the repository skills are active");
        List<String> failures = new ArrayList<>();
        for (Case row : TABLE)
            for (String boundKey : BOUNDS) {
                StudioSkill bound = boundKey == null ? null : ACTIVE.stream().filter(s -> s.key().equals(boundKey)).findFirst().orElseThrow();
                var decision = StudioSkillRouter.decide(ACTIVE, row.media(), row.text(), bound);
                String got = decision.kind() == StudioSkillRouter.Kind.OPEN ? OPEN
                        : decision.kind() == StudioSkillRouter.Kind.KEEP ? KEEP + ":" + (decision.skill() == null ? "none" : decision.skill().key())
                        : decision.skill().key();
                String want = row.expected().equals(KEEP) ? KEEP + ":" + (boundKey == null ? "none" : boundKey) : row.expected();
                if (!want.equals(got)) failures.add("「" + row.text() + "」 media=" + row.media() + " bound=" + boundKey + " → " + got + "，应为 " + want);
            }
        assertTrue(failures.isEmpty(), String.join("\n", failures));
    }
}
