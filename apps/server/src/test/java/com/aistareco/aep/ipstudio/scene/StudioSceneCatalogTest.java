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
        String role = "图1是要参照的人脸。\n";
        assertThat(catalog.compose(image("face-turnaround", "", null, 0)).text()).isEqualTo(role + base);
        assertThat(catalog.compose(image("face-turnaround", " 自然微笑 ", null, 0)).text()).isEqualTo(role + base + "\n补充要求：自然微笑");
        assertThat(catalog.compose(image("face-turnaround", "", "我自己写的", 0)).text()).isEqualTo(role + "我自己写的");
        assertThat(catalog.compose(image("free", "一只猫", null)).text()).isEqualTo("一只猫");
    }

    @Test
    void aMissingRequiredPhotoOrAnEmptyFreeDrawingIsRefusedWithAPlainReason() {
        assertThatThrownBy(() -> catalog.compose(image("face-swap", "", null, 0)))
                .isInstanceOf(BusinessException.class).hasMessage("先放人脸");
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
                .contains("只有这几样我没写就不要出现", "要的是做好的视频");
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
        assertThat(brief).contains("10 秒", "图1「商品图 1」", "图2「商品图 2」", "图3「出镜人物」", "第1镜（0–3 秒）这一镜的作用", "第2镜（3–6 秒）",
                "括号里只写起止秒数", "正好 10 秒", "补到 10 秒整", "先看图", "已附图片", "一、剧情概述", "四、场景与视觉设定", "六、全片保持与禁止");
        // 事实规则在底座里（system），不在 user 里重复（docs/studio-prompt-architecture.md §9.5）。
        var assembled = catalog.sceneScript(script("ecom-talking", "", List.of("商品图 1", "商品图 2"), 10, null), null, false, null);
        assertThat(assembled.system()).contains("你是资深短视频编导", "大胆创作", "只输出一个 JSON 对象");
        assertThat(assembled.user()).isEqualTo(brief).doesNotContain("{{", "}}");
        // 一次出片的时长由所选模型决定，不受场景给助手用的可选时长限制；明显不对的数照样挡。
        assertThatThrownBy(() -> catalog.compose(script("ecom-talking", "", List.of("商品图 1"), 0, null))).hasMessage("请选择可用的时长");
        assertThatThrownBy(() -> catalog.compose(script("ecom-talking", "", List.of(), 10, null))).hasMessage("先放商品图");
        assertThat(catalog.compose(script("ecom-talking", "", List.of("商品图 1"), 10, "口语一点")).text())
                .startsWith("按这条修改意见改当前脚本：口语一点").contains("重排镜头和台词", "原来的要求");
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
        assertThat(catalog.compose(none).text()).contains("「商品图 1」这个视频模型用不上，只给你看").doesNotContain("图1", "参考素材（");
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
        // §9.6 的新范式：目标、节拍、收尾已合进拍法，不再单列「这一条要做到」「结尾」两行。
        assertThat(director).contains("拍法：开头亮出团购价格", "先讲领券入口", "位置", "套餐内容与团购价", "原价（客户写了才比较）", "排队/人气（客户写了才必须出现）",
                "不留任何空白", "不写「还缺」「待补」").doesNotContain("这一条要做到", "结尾：", "拍法里要讲但我没给的", "【待补：");
        String assistant = catalog.compose(video("local-groupbuy", "巷里火锅", List.of("门店照片 1"), null, 25, "9:16")).text();
        assertThat(assistant).contains("不用问我").doesNotContain("【待补");
        // 到店实录不编故事：出镜的人不能写成真实顾客。
        assertThat(catalog.compose(script("local-visit", "巷里火锅", List.of("门店照片 1"), 15, null)).text()).contains("这条不编故事");
        assertThat(director).doesNotContain("这条不编故事");
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
        var assembled = catalog.sceneScript(script("brand-story", given, List.of(), 30, null), null, false, null);
        String script = assembled.user();
        String assistant = catalog.compose(video("brand-story", given, List.of(), null, 30, "16:9")).text();
        assertThat(script).contains("我的要求：" + given);
        assertThat(assistant).contains("我的要求：" + given, "只有这几样我没写就不要出现", "销量排名", "检测数据");
        // 编导的内容规则在底座（system）：写到的写准，没写的大胆创作，只有几样硬信息不凭空写（§9.5，2026-11-04 放宽）。
        assertThat(assembled.system()).contains("数字和名字不改", "大胆创作", "价格和优惠金额", "销量排名", "获奖认证", "检测数据");
        assertThat(script).contains("只说脚本里实际写了什么", "虚构的人物或情节就直说", "不要写「没写功效」");
    }

    // 场景自己的拍法、思路、选项会原样交给模型，它们本身不能带数字或「真实经历」一类的说法，否则等于在请模型编。
    // 2026-11-01 §9.6 的新范式会用「不给招牌编历史、年限」「客户写的排队 / 老字号…必须出现」这类说法点名要守的事实，
    // 词表因此只留数字和「真实经历」类的说法（这两样不论正说反说都不该出现在场景文字里）。
    private static final Pattern INVITES_FACTS = Pattern.compile("\\d|真实(人物|评价|经历)");

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
        assertThat(image).startsWith("图1是要做白底图的商品。\n" + catalog.image("white-background").orElseThrow().prompt()).contains("出图方式：商品单独居中，从正上方俯拍");
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

    private static StudioSceneCatalog.ComposeRequest counted(String id, Integer... counts) {
        return new StudioSceneCatalog.ComposeRequest("image", id, "", null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, List.of(counts));
    }

    @Test
    void picturesAreNumberedByWhatIsActuallySentAndTheDescriptionUsesNames() {
        String base = catalog.image("outfit-on-model").orElseThrow().prompt();
        assertThat(catalog.compose(counted("outfit-on-model", 1, 2, 1)).text()).isEqualTo(
                "图1是要穿衣服的模特。\n图2、图3是要穿上的上身或全身服装，可能是同一件的不同角度，也可能是要一起穿的几件。\n图4是要穿上的下装。\n" + base + "\n场景：模特走在干净的城市街边，姿态自然，自然光");
        // 上装空着：下装就是图2。
        assertThat(catalog.compose(counted("outfit-on-model", 1, 0, 1)).text()).startsWith("图1是要穿衣服的模特。\n图2是要穿上的下装。\n" + base);
        // 模特换脸：放了三张的是图2 到图4 这个人，图1 还是模特。
        assertThat(catalog.compose(counted("face-swap", 1, 3)).text()).startsWith("图1是要换脸的模特图。\n图2、图3、图4是同一个人的不同照片");
    }

    @Test
    void theSceneSaysHowManyPicturesEachSlotTakes() {
        assertThatThrownBy(() -> catalog.compose(counted("outfit-on-model", 1, 0, 0))).hasMessageContaining("先放上身/全身装或下装");
        assertThatThrownBy(() -> catalog.compose(counted("outfit-on-model", 1, 0, 2))).hasMessageContaining("下装最多放 1 张");
        assertThatThrownBy(() -> catalog.compose(counted("outfit-on-model", 0, 1, 0))).hasMessageContaining("先放模特");
        assertThatThrownBy(() -> catalog.compose(counted("face-turnaround", 4))).hasMessageContaining("人脸最多放 3 张");
        // 还没发版的旧页面只带 filled：每个位算一张。
        assertThat(catalog.compose(image("face-swap", "", null, 0, 1)).text()).startsWith("图1是要换脸的模特图。\n图2是要换上的人脸。\n");
    }

    @Test
    void theSlotsFollowTheReferenceSkillsOneByOne() {
        var expected = java.util.Map.ofEntries(
                java.util.Map.entry("free", "图片:9"), java.util.Map.entry("ip-sheet", "人物照片*:3"), java.util.Map.entry("ip-portrait", "人物照片*:3"), java.util.Map.entry("ip-expression", "人物照片*:3"),
                java.util.Map.entry("face-turnaround", "人脸*:3"), java.util.Map.entry("fullbody-sheet", "模特*:5"), java.util.Map.entry("face-swap", "模特*:1 人脸*:3"), java.util.Map.entry("face-fusion", "人脸1*:1 人脸2*:1"),
                java.util.Map.entry("outfit-on-model", "模特*:1 上身/全身装:3 下装:1"), java.util.Map.entry("product-in-use", "商品*:5 模特*:1"), java.util.Map.entry("white-background", "商品*:9"),
                java.util.Map.entry("selling-point", "商品*:5 版式参考:1"), java.util.Map.entry("outfit-restyle", "服装*:1 面料:1 印花:1"), java.util.Map.entry("scene-swap", "模特*:1 背景*:1"),
                java.util.Map.entry("product-scene", "商品*:5 场景:1"), java.util.Map.entry("realism", "人物图*:1 本人照片:3"), java.util.Map.entry("retouch", "原图*:1"));
        var actual = new java.util.HashMap<String, String>();
        for (var s : catalog.catalog().image()) actual.put(s.id(), String.join(" ", s.refs().stream().map(r -> r.label() + (r.required() ? "*" : "") + ":" + r.limit()).toList()));
        assertThat(actual).isEqualTo(expected);
    }

    @Test
    void theShippedDescriptionsNameTheMaterialsInsteadOfNumberingThem() {
        for (var s : catalog.catalog().image()) assertThat(s.prompt()).as(s.id()).doesNotContainPattern("图\\d");
        var c = catalog.catalog();
        java.util.function.Function<StudioSceneCatalog.ImageScene, StudioSceneCatalog.Catalog> with = s ->
                new StudioSceneCatalog.Catalog(1, c.imageGroups(), c.videoGroups(), List.of(s), List.of());
        var person = new StudioSceneCatalog.SceneRef("模特", true, null);
        assertThatThrownBy(() -> StudioSceneCatalog.validate(with.apply(new StudioSceneCatalog.ImageScene("x", c.image().get(1).group(), "x", "x", List.of(person), "以图1为准", "x", "1:1"))))
                .hasMessageContaining("不要写图1");
        assertThatThrownBy(() -> StudioSceneCatalog.validate(with.apply(new StudioSceneCatalog.ImageScene("x", c.image().get(1).group(), "x", "x",
                List.of(new StudioSceneCatalog.SceneRef("模特", true, null, 10, null, null)), "以模特为准", "x", "1:1")))).hasMessageContaining("1 到 9 张");
        assertThatThrownBy(() -> StudioSceneCatalog.validate(with.apply(new StudioSceneCatalog.ImageScene("x", c.image().get(1).group(), "x", "x", List.of(person), "以模特为准", "x", "1:1",
                null, null, null, null, null, null, List.of(0))))).hasMessageContaining("选填素材位");
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
