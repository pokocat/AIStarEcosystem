package com.aistareco.aep.ipstudio.scene;

import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.List;
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
                .containsPattern("没写的信息.*不要自己编").contains("要的是做好的视频");
        var silent = catalog.compose(video("ecom-talking", "", List.of("商品图 1"), null, 25, "9:16")).text();
        assertThat(silent).doesNotContain("我的要求").contains("先看素材");
    }

    @Test
    void videoInputsTheSceneNeedsAreCheckedBeforeAnythingIsSent() {
        assertThatThrownBy(() -> catalog.compose(video("ecom-talking", "x", List.of(), null, 25, "9:16"))).hasMessage("先放商品图");
        assertThatThrownBy(() -> catalog.compose(video("drama-twist", " ", List.of(), null, 45, "9:16"))).hasMessage("先写一句要求");
        assertThatThrownBy(() -> catalog.compose(video("recreation", "换成我的", List.of(), null, 25, "9:16"))).hasMessage("先放参考视频");
        assertThatThrownBy(() -> catalog.compose(video("ecom-talking", "x", List.of("商品图 1"), null, 7, "9:16"))).hasMessage("请选择可用的时长");
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
        assertThat(brief).contains("10 秒", "图1「商品图 1」", "图2「商品图 2」", "图3「出镜人物」", "镜头N", "正好 10 秒", "先看图")
                .containsPattern("没写的信息.*不要自己编");
        // 一次出片的时长由所选模型决定，不受场景给助手用的可选时长限制；明显不对的数照样挡。
        assertThatThrownBy(() -> catalog.compose(script("ecom-talking", "", List.of("商品图 1"), 0, null))).hasMessage("请选择可用的时长");
        assertThatThrownBy(() -> catalog.compose(script("ecom-talking", "", List.of(), 10, null))).hasMessage("先放商品图");
        assertThat(catalog.compose(script("ecom-talking", "", List.of("商品图 1"), 10, "口语一点")).text())
                .startsWith("按这条修改意见改当前脚本，没提到的地方保持不变：口语一点").contains("原来的要求");
        // 剧情类必须写一句，但改稿时有修改意见就够了。
        assertThatThrownBy(() -> catalog.compose(script("drama-twist", " ", List.of(), 15, null))).hasMessage("先写一句要求");
        assertThat(catalog.compose(script("drama-twist", " ", List.of(), 15, "结尾再反转一次")).text()).contains("结尾再反转一次");
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
