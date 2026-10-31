package com.aistareco.aep.ipstudio.scene;

import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.Stream;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** ipstudio/scenes.json 是场景页唯一真源；拼话规则只在 StudioSceneCatalog 一处（docs/studio-scene-creation.md §7）。 */
class StudioSceneCatalogTest {
    private final StudioSceneCatalog catalog = new StudioSceneCatalog();

    private static StudioSceneCatalog.ComposeRequest image(String id, String text, String custom, Integer... filled) {
        return new StudioSceneCatalog.ComposeRequest("image", id, text, custom, List.of(filled), null, null, null, null, null, null);
    }
    private static StudioSceneCatalog.ComposeRequest video(String id, String text, List<String> images, String videoTitle, Integer duration, String ratio) {
        return new StudioSceneCatalog.ComposeRequest("video", id, text, null, null, images, "出镜人物", "声音样本", videoTitle, duration, ratio);
    }

    @Test
    void theShippedCatalogLoadsAndEveryVideoSceneNamesItsMethod() {
        var c = catalog.catalog();
        assertThat(c.image()).hasSizeGreaterThan(10).anyMatch(s -> s.id().equals(StudioSceneCatalog.FREE));
        assertThat(c.video()).hasSizeGreaterThan(10).allMatch(s -> !s.skill().isBlank());
        assertThat(catalog.video("recreation").orElseThrow().skill()).isEqualTo("reference-video-recreation");
        assertThat(catalog.video("ecom-talking").orElseThrow().skill()).isEqualTo("video-generation");
    }

    @Test
    void anImagePromptIsTheSceneDescriptionPlusWhatTheUserAdded() {
        String base = catalog.image("face-turnaround").orElseThrow().prompt();
        assertThat(catalog.compose(image("face-turnaround", "", null, 0)).text()).isEqualTo(base);
        assertThat(catalog.compose(image("face-turnaround", " 自然微笑 ", null, 0)).text()).isEqualTo(base + "\n补充要求：自然微笑");
        assertThat(catalog.compose(image("face-turnaround", "", "我自己写的", 0)).text()).isEqualTo("我自己写的");
        assertThat(catalog.compose(image("free", "一只猫", null)).text()).isEqualTo("一只猫");
    }

    @Test
    void aMissingRequiredPhotoOrAnEmptyFreeDrawingIsRefusedWithAPlainReason() {
        assertThatThrownBy(() -> catalog.compose(image("face-swap", "", null, 0)))
                .isInstanceOf(BusinessException.class).hasMessage("先放新面孔");
        assertThatThrownBy(() -> catalog.compose(image("free", " ", null)))
                .isInstanceOf(BusinessException.class).hasMessage("写一句想要的画面");
        assertThatThrownBy(() -> catalog.compose(image("no-such-scene", "", null)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("场景不存在");
    }

    @Test
    void theVideoBriefCarriesTheUsersLineAndMaterialsAsksForTheVideoAndForbidsInventedOffers() {
        var composed = catalog.compose(video("ecom-talking", "保湿精华，不黏腻", List.of("商品图 1"), null, 25, "9:16"));
        assertThat(composed.skillKey()).isEqualTo("video-generation");
        assertThat(composed.text()).contains("25 秒的竖屏", "我的要求：保湿精华，不黏腻", "「商品图 1」", "「出镜人物」")
                .contains(StudioSceneCatalog.FACT_RULE, "要的是做好的视频");
        var silent = catalog.compose(video("ecom-talking", "", List.of("商品图 1"), null, 25, "9:16")).text();
        assertThat(silent).doesNotContain("我的要求").contains("先看素材");
    }

    @Test
    void videoInputsTheSceneNeedsAreCheckedBeforeAnythingIsSent() {
        assertThatThrownBy(() -> catalog.compose(video("ecom-talking", "x", List.of(), null, 25, "9:16"))).hasMessage("先放商品图");
        assertThatThrownBy(() -> catalog.compose(video("drama-twist", " ", List.of(), null, 45, "9:16"))).hasMessage("先写一句要求");
        assertThatThrownBy(() -> catalog.compose(video("recreation", "换成我的", List.of(), null, 25, "9:16"))).hasMessage("先放参考视频");
        assertThatThrownBy(() -> catalog.compose(video("ecom-talking", "x", List.of("商品图 1"), null, 61, "9:16"))).hasMessage("请选择可用的时长");
        // 时长是页面上拖出来的，不必是场景预设的那几档；60 秒以内都交给助手分段做
        assertThat(catalog.compose(video("ecom-talking", "x", List.of("商品图 1"), null, 40, "9:16")).text()).isNotBlank();
    }

    // The canvas holds back a brief that asks to copy a reference video until the video is there
    // (apps/web-aiavatar/src/ip/studio-entry.ts studioBriefNeedsReference). Only 爆款复刻 may trip it.
    private static final Pattern NEEDS_REFERENCE = Pattern.compile("复刻|翻拍|拉片|做同款|照这条|参考视频|这条视频|原片");

    @Test
    void onlyTheRecreationSceneIsHeldBackForAReferenceVideo() {
        for (var scene : catalog.catalog().video()) {
            String text = String.join("；", scene.ideas());
            List<String> images = List.of(scene.images().label() + " 1");
            String brief = catalog.compose(video(scene.id(), text, images, scene.video() != null ? "参考视频" : null, scene.duration(), scene.ratio())).text();
            assertThat(NEEDS_REFERENCE.matcher(brief).find()).as(scene.id()).isEqualTo(scene.id().equals("recreation"));
        }
    }

    private static StudioSceneCatalog.ComposeRequest script(String id, String text, List<String> images, Integer duration, String revision) {
        return new StudioSceneCatalog.ComposeRequest("video-script", id, text, null, null, images, "出镜人物", null, null, duration, "9:16", null, revision);
    }

    @Test
    void theDirectorBriefNumbersThePicturesInTheOrderTheVideoModelGetsThem() {
        String brief = catalog.compose(script("ecom-talking", "", List.of("商品图 1", "商品图 2"), 10, null)).text();
        assertThat(brief).contains("10 秒", "图1「商品图 1」", "图2「商品图 2」", "图3「出镜人物」", "第1镜（0–2 秒）：画面……。旁白说：「……」", "括号里只写起止秒数", "正好 10 秒", "先看图", "已附图片", StudioSceneCatalog.FACT_RULE);
        // 一次出片的时长由所选模型决定，不受场景给助手用的可选时长限制；明显不对的数照样挡。
        assertThatThrownBy(() -> catalog.compose(script("ecom-talking", "", List.of("商品图 1"), 0, null))).hasMessage("请选择可用的时长");
        assertThatThrownBy(() -> catalog.compose(script("ecom-talking", "", List.of(), 10, null))).hasMessage("先放商品图");
        assertThat(catalog.compose(script("ecom-talking", "", List.of("商品图 1"), 10, "口语一点")).text())
                .startsWith("按这条修改意见改当前脚本，没提到的地方保持不变：口语一点").contains("原来的要求");
        // 剧情类必须写一句，但改稿时有修改意见就够了。
        assertThatThrownBy(() -> catalog.compose(script("drama-twist", " ", List.of(), 15, null))).hasMessage("先写一句要求");
        assertThat(catalog.compose(script("drama-twist", " ", List.of(), 15, "结尾再反转一次")).text()).contains("结尾再反转一次");
    }

    // 2026-10-30 审查 F07：编导按全部素材编号，出片时只认首帧的模型只拿第一张、纯文字模型一张都不拿，脚本里的「图2」视频模型看不到；
    // 写脚本的模型看不到图时还说「已附图片、先看图」，它就会编图里的东西。
    @Test
    void onlyPicturesTheVideoModelGetsAreNumberedAndABlindDirectorIsNotToldToLook() {
        var req = new StudioSceneCatalog.ComposeRequest("video-script", "ecom-talking", "", null, null, List.of("商品图 1"), "出镜人物", null, null, 10, "9:16",
                null, null, null, List.of("商品图 2"), true, false);
        String brief = catalog.compose(req).text();
        assertThat(brief).contains("图1「商品图 1」", "「商品图 2」「出镜人物」这个视频模型用不上", "不要写成图几", "看不到这些图", "不要编看不到的细节")
                .doesNotContain("图2", "已附图片", "先看图", "只给你看");
        // 什么图都不交给视频模型（纯文字模型），也不出现编号。
        var none = new StudioSceneCatalog.ComposeRequest("video-script", "ecom-talking", "保湿面霜", null, null, List.of(), null, null, null, 4, "9:16",
                null, null, null, List.of("商品图 1"), null, true);
        assertThat(catalog.compose(none).text()).contains("「商品图 1」这个视频模型用不上，只给你看").doesNotContain("图1", "交给视频模型的参考图");
        // 只放了出镜人物、没放商品图：人物照片不能顶替必填的商品图。
        var onlyPerson = new StudioSceneCatalog.ComposeRequest("video-script", "ecom-talking", "x", null, null, List.of(), "出镜人物", null, null, 4, "9:16",
                null, null, null, List.of(), true, true);
        assertThatThrownBy(() -> catalog.compose(onlyPerson)).hasMessage("先放商品图");
    }

    // 2026-10-30 审查 F01–F03：同城团购只有一句拍法，缺价格时还被要求「只引导关注或下单」，团购拍成了探店。
    @Test
    void aSceneBriefSaysWhatTheVideoIsForAndWhatToDoWhenRequiredFactsAreMissing() {
        assertThat(catalog.catalog().video()).allSatisfy(s -> assertThat(s.brief()).as(s.id()).isNotNull());
        String director = catalog.compose(script("local-groupbuy", "巷里火锅，双人套餐", List.of("门店照片 1"), 15, null)).text();
        assertThat(director).contains("这一条要做到：让附近的人买下套餐，到店来用", "店名和位置", "团购价", "原价（有原价才做对比）",
                "正文最前面单独一行写「还缺：……」", "【待补：……】", "结尾：说清怎么买、到哪用").doesNotContain(StudioSceneCatalog.MISSING_DEFAULT);
        String assistant = catalog.compose(video("local-groupbuy", "巷里火锅", List.of("门店照片 1"), null, 25, "9:16")).text();
        assertThat(assistant).contains("我没给的先问我").doesNotContain("【待补");
        // 到店实录不编故事：出镜的人不能写成真实顾客。
        assertThat(catalog.compose(script("local-visit", "巷里火锅", List.of("门店照片 1"), 15, null)).text()).contains(StudioSceneCatalog.NO_FICTION);
        assertThat(director).doesNotContain(StudioSceneCatalog.NO_FICTION);
    }

    @Test
    void aBriefWithTooManyRequiredFactsIsRefused() {
        var c = catalog.builtIn();
        var s = c.video().get(0);
        var f = new StudioSceneCatalog.Fact("一条", true, null);
        var tooMany = new StudioSceneCatalog.VideoScene(s.id(), s.group(), s.title(), s.description(), s.images(), s.video(), s.character(), s.voice(), s.placeholder(),
                s.textRequired(), s.durations(), s.duration(), s.ratio(), s.structure(), s.ideas(), s.skill(), s.options(), s.enabled(), null, null, null, null,
                new StudioSceneCatalog.Brief("目标", List.of(f, f, f, f, f), null, "story"));
        var bad = c.with(c.image(), java.util.stream.Stream.concat(Stream.of(tooMany), c.video().stream().skip(1)).toList(), c.goals());
        assertThatThrownBy(() -> StudioSceneCatalog.validate(bad)).hasMessageContaining("必须给的信息最多 4 条");
    }

    // 2026-10-30 线上验收：品牌故事首稿编了品牌年限、耐用测试次数和测试画面，summary 还说没写功效。
    @Test
    void bothVideoBriefsForbidInventedBrandYearsTestCountsAndSalesButKeepWhatTheUserGave() {
        String given = "山野户外，2009 年创立，帐篷做过 3000 次抗风测试，累计卖出 10 万顶";
        String script = catalog.compose(script("brand-story", given, List.of(), 30, null)).text();
        String assistant = catalog.compose(video("brand-story", given, List.of(), null, 30, "16:9")).text();
        for (String brief : List.of(script, assistant)) {
            assertThat(brief).contains(StudioSceneCatalog.FACT_RULE, "我的要求：" + given);
        }
        assertThat(StudioSceneCatalog.FACT_RULE).contains("价格", "优惠", "品牌创立年份", "多少年历史", "检测、测试、实验的次数和画面",
                "销量", "排名", "获奖", "认证", "门店数", "用户数", "功效", "不要写成品牌的真实经历", "不要给编出来的内容配上年份、次数、数量");
        assertThat(script).contains("只说脚本里实际写了什么", "虚构的人物或情节就直说", "不要写「没写功效」");
    }

    // 场景自己的拍法、思路、选项会原样交给模型，它们本身不能带数字或「真实经历」一类的说法，否则等于在请模型编。
    private static final Pattern INVITES_FACTS = Pattern.compile("\\d|年|销量|检测|测试|认证|获奖|排名|老店|老字号|历史|真实(人物|评价|经历)");

    @Test
    void sceneTextsSentToTheModelNameNoNumbersOrBrandClaims() {
        for (var scene : catalog.catalog().video()) {
            List<String> sent = new java.util.ArrayList<>(scene.ideas());
            sent.add(scene.structure());
            scene.optionGroups().forEach(g -> g.choices().forEach(o -> sent.add(o.prompt())));
            if (scene.brief() != null) {
                sent.add(scene.brief().goal()); sent.add(scene.brief().ending());
                scene.brief().factList().forEach(f -> { sent.add(f.label()); sent.add(f.use()); });
            }
            sent.removeIf(java.util.Objects::isNull);
            for (String text : sent) assertThat(INVITES_FACTS.matcher(text).find()).as(scene.id() + "：" + text).isFalse();
        }
        assertThat(catalog.video("brand-story").orElseThrow().structure()).contains("没给就讲一位用户的故事");
    }

    @Test
    void scenesTheOperatorsTookDownDisappearFromThePagesButOldDraftsStillResolve() {
        var c = catalog.catalog();
        var off = c.video().get(0);
        var edited = c.with(c.image(),
                c.video().stream().map(s -> s.id().equals(off.id()) ? s.withMedia(false, StudioSceneCatalog.MEDIA_PREFIX + "a.webp",
                        List.of(StudioSceneCatalog.MEDIA_PREFIX + "b.mp4"), null, null) : s).toList(), c.homeGoals());
        var custom = new StudioSceneCatalog(edited);
        var published = custom.published(k -> "signed:" + k);
        assertThat(published.video()).noneMatch(s -> s.id().equals(off.id())).allMatch(s -> s.coverKey() == null && s.enabled() == null);
        assertThat(custom.video(off.id())).isPresent();
        var withMedia = StudioSceneCatalog.withMedia(edited, k -> "signed:" + k).video().get(0);
        assertThat(withMedia.coverUrl()).isEqualTo("signed:" + StudioSceneCatalog.MEDIA_PREFIX + "a.webp");
        assertThat(withMedia.examples()).singleElement().satisfies(m -> assertThat(m.mediaType()).isEqualTo("video"));
    }

    @Test
    void aCatalogMayOnlyPointAtFilesUploadedForScenes() {
        var c = catalog.catalog();
        var s = c.image().get(1);
        var foreign = s.withMedia(true, "ipstudio_source/someone/photo.png", null, null, null);
        assertThatThrownBy(() -> StudioSceneCatalog.validate(new StudioSceneCatalog.Catalog(1, c.imageGroups(), c.videoGroups(), List.of(foreign), List.of())))
                .hasMessageContaining("后台上传");
        assertThatThrownBy(() -> StudioSceneCatalog.validateJson(new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode().put("version", 1)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void pickedOptionsBecomeSentencesAndAMissingGroupUsesItsDefault() {
        var scene = catalog.video("ecom-talking").orElseThrow();
        assertThat(scene.optionGroups()).isNotEmpty();
        String brief = catalog.compose(new StudioSceneCatalog.ComposeRequest("video-script", "ecom-talking", "", null, null, List.of("商品图 1"), null, null, null, 10, "9:16",
                null, null, java.util.Map.of("presenter", "product"))).text();
        assertThat(brief).contains("出镜方式：不出现人脸，只拍商品和手部操作", "语气：语气像朋友推荐");
        String image = catalog.compose(new StudioSceneCatalog.ComposeRequest("image", "white-background", "", null, List.of(0), null, null, null, null, null, null,
                null, null, java.util.Map.of("angle", "top"))).text();
        assertThat(image).startsWith(catalog.image("white-background").orElseThrow().prompt()).contains("拍摄角度：从正上方俯拍商品");
        assertThatThrownBy(() -> catalog.compose(new StudioSceneCatalog.ComposeRequest("image", "white-background", "", null, List.of(0), null, null, null, null, null, null,
                null, null, java.util.Map.of("angle", "gone")))).hasMessage("这个选项已经下架，请刷新后重选");
        assertThatThrownBy(() -> catalog.compose(new StudioSceneCatalog.ComposeRequest("image", "white-background", "", null, List.of(0), null, null, null, null, null, null,
                null, null, java.util.Map.of("nope", "x")))).hasMessage("这个选项已经下架，请刷新后重选");
    }

    @Test
    void homeCardsPointAtRealScenesAndDisappearWhenTheirSceneIsTakenDown() {
        var c = catalog.catalog();
        assertThat(c.goals()).extracting(StudioSceneCatalog.HomeGoal::id).contains("recreation", "commerce", "ip");
        var off = c.with(c.image(), c.video().stream().map(s -> s.id().equals("ecom-talking") ? s.withMedia(false, null, null, null, null) : s).toList(), c.homeGoals());
        assertThat(new StudioSceneCatalog(off).published(k -> k).goals()).extracting(StudioSceneCatalog.HomeGoal::sceneId).doesNotContain("ecom-talking");
        // 公开给首页的卡片只有显示用的字段：类型按落点场景判，封面按编号给（没传图时地址为空）。
        var cards = catalog.homeCards(k -> "signed:" + k);
        assertThat(cards).filteredOn(card -> card.id().equals("ip")).singleElement().satisfies(card -> {
            assertThat(card.kind()).isEqualTo("image");
            assertThat(card.covers()).extracting(StudioSceneCatalog.HomeCover::sceneId).containsExactly("ip-sheet", "ip-portrait");
            assertThat(card.covers()).allMatch(cover -> cover.coverUrl() == null);
        });
        var dangling = c.with(c.image(), c.video(), List.of(new StudioSceneCatalog.HomeGoal("x", "卡", "说明", "no-such-scene", List.of())));
        assertThatThrownBy(() -> StudioSceneCatalog.validate(dangling)).hasMessageContaining("指向的场景不存在");
        var badDefault = c.with(c.image().stream().map(s -> s.id().equals("white-background") ? new StudioSceneCatalog.ImageScene(s.id(), s.group(), s.title(), s.description(), s.refs(),
                s.prompt(), s.hint(), s.ratio(), List.of(new StudioSceneCatalog.OptionGroup("angle", "角度", List.of(new StudioSceneCatalog.OptionChoice("a", "A", "正面"),
                new StudioSceneCatalog.OptionChoice("b", "B", "侧面")), "c")), null, null, null, null, null) : s).toList(), c.video(), c.homeGoals());
        assertThatThrownBy(() -> StudioSceneCatalog.validate(badDefault)).hasMessageContaining("默认选项不在选项里");
    }

    @Test
    void aCatalogThatLeavesBlanksOrPointsAtMissingPhotosDoesNotStart() {
        var c = catalog.catalog();
        var broken = new StudioSceneCatalog.ImageScene("x", c.image().get(1).group(), "x", "x",
                List.of(new StudioSceneCatalog.SceneRef("人物照片", true, null)), "以图2为准，拍【风格】", "x", "1:1");
        assertThatThrownBy(() -> StudioSceneCatalog.validate(new StudioSceneCatalog.Catalog(1, c.imageGroups(), c.videoGroups(), List.of(broken), List.of())))
                .isInstanceOf(IllegalStateException.class);
        var duplicate = new StudioSceneCatalog.Catalog(1, c.imageGroups(), c.videoGroups(), List.of(c.image().get(1), c.image().get(1)), List.of());
        assertThatThrownBy(() -> StudioSceneCatalog.validate(duplicate)).hasMessageContaining("重复");
    }
}
