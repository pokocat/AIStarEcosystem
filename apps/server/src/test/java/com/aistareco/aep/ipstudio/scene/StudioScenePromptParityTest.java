package com.aistareco.aep.ipstudio.scene;

import com.aistareco.aep.ipstudio.prompt.StudioPromptEntry;
import com.aistareco.aep.ipstudio.prompt.StudioPromptLibrary;
import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog.*;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 搬家逐字一致（docs/studio-prompt-architecture.md §10 原则）：「场景出图」「交给助手」两个环节改由提示词库拼之后，同样的场景内容、
 * 同样的输入，拼出来的话和搬家前的代码逐字相同。下面的 {@code Old} 是搬家前 {@code StudioSceneCatalog} 里的拼话原样抄过来的，
 * 只作对照；这一步上线后可以删掉这个测试。
 *
 * <p>场景内容用搬家前的 {@code ipstudio/scenes.json}（库里的场景条目已经换成 §9.6 的新内容，那是有意的内容改动，不在这里比）。
 */
class StudioScenePromptParityTest {
    private static final ObjectMapper JSON = new ObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL);
    private final Catalog old = StudioSceneCatalog.load("ipstudio/scenes.json");
    private final StudioSceneCatalog catalog = new StudioSceneCatalog(old, libraryWithOldScenes(old));

    /** 仓库里的环节 + 空底座 + 按旧 scenes.json 建的场景条目。 */
    static StudioPromptLibrary libraryWithOldScenes(Catalog c) {
        List<StudioPromptEntry> entries = new ArrayList<>();
        for (var seed : StudioPromptLibrary.loadSeeds()) if (seed.entry().stage()) entries.add(seed.entry());
        entries.add(StudioPromptEntry.fromHeader(Map.of("key", "base", "name", "底座", "version", 1, "status", "active", "layer", "base"), "", "test"));
        for (ImageScene s : c.image()) {
            if (StudioSceneCatalog.FREE.equals(s.id())) continue;
            entries.add(StudioPromptEntry.fromHeader(scene(s.id(), "image", null), s.prompt(), "test"));
        }
        for (VideoScene s : c.video())
            entries.add(StudioPromptEntry.fromHeader(scene(s.id(), "video", s.brief() == null ? null : JSON.convertValue(s.brief(), Map.class)), s.structure(), "test"));
        return StudioPromptLibrary.of(entries);
    }

    private static Map<String, Object> scene(String id, String kind, Map<?, ?> brief) {
        Map<String, Object> h = new LinkedHashMap<>(Map.of("key", "scene-" + id, "name", id, "version", 1, "status", "active", "layer", "scene",
                "sceneId", id, "sceneKind", kind));
        if (brief != null) h.put("scene", brief);
        return h;
    }

    @Test
    void imagePromptsAreUnchangedForEveryScene() {
        int checked = 0;
        for (ImageScene s : old.image()) {
            List<Integer> filled = new ArrayList<>();
            for (int i = 0; i < s.refs().size(); i++) filled.add(i);
            for (String text : List.of("", " 加点阳光 ")) for (String custom : Arrays.asList(null, "我自己写的描述")) for (Map<String, String> options : optionVariants(s.optionGroups())) {
                if (StudioSceneCatalog.FREE.equals(s.id()) && text.isBlank()) continue;
                var r = new ComposeRequest("image", s.id(), text, custom, filled, null, null, null, null, null, null, null, null, options);
                assertThat(catalog.compose(r).text()).as(s.id() + " " + text + " " + custom + " " + options).isEqualTo(Old.image(s, r));
                checked++;
            }
        }
        assertThat(checked).isGreaterThan(60);
    }

    @Test
    void handoffBriefsAreUnchangedForEveryScene() {
        int checked = 0;
        for (VideoScene s : old.video()) {
            int max = s.images().max() == null ? 2 : Math.min(2, s.images().max());
            for (int n = s.images().required() ? 1 : 0; n <= max; n++) {
                List<String> images = new ArrayList<>();
                for (int i = 1; i <= n; i++) images.add(s.images().label() + " " + i);
                for (String text : List.of("保湿精华，不黏腻", "")) for (String character : Arrays.asList(null, "出镜人物")) for (String voice : Arrays.asList(null, "声音样本"))
                    for (String ratio : List.of("9:16", "16:9")) for (Map<String, String> options : optionVariants(s.optionGroups())) {
                        if (s.textRequired() && text.isEmpty()) continue;
                        var r = new ComposeRequest("video", s.id(), text, null, null, images, character, voice, s.video() != null ? "参考视频" : null,
                                s.duration(), ratio, null, null, options);
                        var composed = catalog.compose(r);
                        assertThat(composed.text()).as(s.id() + " " + r).isEqualTo(Old.handoff(s, r));
                        assertThat(composed.skillKey()).isEqualTo(s.skill());
                        checked++;
                    }
            }
        }
        assertThat(checked).isGreaterThan(300);
    }

    /** 默认选项，加上每组每个选项各换一次。 */
    private static List<Map<String, String>> optionVariants(List<OptionGroup> groups) {
        List<Map<String, String>> out = new ArrayList<>();
        out.add(null);
        for (OptionGroup g : groups) for (OptionChoice c : g.choices()) out.add(Map.of(g.key(), c.value()));
        return out;
    }

    /** 搬家前的拼话，抄自 2026-11-01 之前的 StudioSceneCatalog（imagePrompt / videoBrief / briefLines / FACT_RULE）；2026-11-04 放宽限制时内容规则跟着改。 */
    static final class Old {
        static final String FACT_RULE = "痛点、使用场景、使用感受、人物和情节可以大胆写，开头要抓人。只有这几样我没写就不要出现：具体的价格和优惠金额、地址、销量排名、获奖认证、检测数据、治病或绝对化的功效。";
        static final String MISSING_DEFAULT = "拍法里要讲但我没给的，就只引导关注或下单。";
        static final String NO_FICTION = "这条不编故事：不要编人物经历，不要把出镜的人写成真实顾客、店员的亲身评价。";

        static List<String> optionLines(List<OptionGroup> groups, Map<String, String> picked) {
            Map<String, String> chosen = picked == null ? Map.of() : picked;
            List<String> lines = new ArrayList<>();
            for (OptionGroup g : groups) {
                String value = chosen.getOrDefault(g.key(), g.defaultValue());
                OptionChoice choice = g.choices().stream().filter(c -> c.value().equals(value)).findFirst().orElseThrow();
                lines.add(g.label() + "：" + choice.prompt());
            }
            return lines;
        }

        static String image(ImageScene scene, ComposeRequest r) {
            String extra = trim(r.text());
            if (StudioSceneCatalog.FREE.equals(scene.id())) {
                List<String> options = optionLines(scene.optionGroups(), r.options());
                return options.isEmpty() ? extra : extra + "\n" + String.join("\n", options);
            }
            String base = r.custom() != null && !r.custom().isBlank() ? r.custom().trim() : scene.prompt().trim();
            List<String> options = optionLines(scene.optionGroups(), r.options());
            if (!options.isEmpty()) base = base + "\n" + String.join("\n", options);
            return extra.isEmpty() ? base : base + "\n补充要求：" + extra;
        }

        static List<String> briefLines(VideoScene scene) {
            Brief b = scene.brief();
            if (b == null) return List.of(MISSING_DEFAULT);
            List<String> lines = new ArrayList<>();
            if (!blank(b.goal())) lines.add("这一条要做到：" + b.goal().trim() + "。");
            List<String> facts = b.factList().stream().filter(f -> f != null && !blank(f.label()))
                    .map(f -> f.label().trim() + (blank(f.use()) ? "" : "（" + f.use().trim() + "）")).toList();
            if (!facts.isEmpty()) lines.add("要讲到这些：" + String.join("；", facts) + "。我写了的按我的意思讲，价格、数字、地址一个字不改，其它的翻成说得出口的话。");
            List<String> required = b.factList().stream().filter(f -> f != null && f.required() && !blank(f.label())).map(f -> f.label().trim()).toList();
            if (!required.isEmpty()) lines.add("其中" + String.join("、", required) + "是这条要讲的重点：我没给的，图里看得出、常识说得通的就直接写好，不用问我；价格、优惠金额、地址没给就不提具体数字，换一种说法讲。");
            else lines.add(MISSING_DEFAULT);
            if (!blank(b.ending())) lines.add("结尾：" + b.ending().trim() + "。");
            if (b.noFiction()) lines.add(NO_FICTION);
            return lines;
        }

        static String handoff(VideoScene scene, ComposeRequest r) {
            List<String> images = r.imageTitles() == null ? List.of() : r.imageTitles().stream().filter(t -> t != null && !t.isBlank()).toList();
            String text = trim(r.text());
            int duration = r.duration() == null ? scene.duration() : r.duration();
            String ratio = r.ratio() == null ? scene.ratio() : r.ratio();
            List<String> lines = new ArrayList<>();
            lines.add("帮我做一条 " + duration + " 秒的" + ("16:9".equals(ratio) ? "横屏" : "竖屏") + "短视频，类型是「" + scene.title() + "」。");
            if (!text.isEmpty()) lines.add("我的要求：" + text);
            lines.addAll(optionLines(scene.optionGroups(), r.options()));
            List<String> materials = new ArrayList<>();
            if (!blank(r.videoTitle())) materials.add("「" + r.videoTitle().trim() + "」是要复刻的参考视频");
            if (!images.isEmpty()) materials.add(String.join("", images.stream().map(t -> "「" + t.trim() + "」").toList()) + "是上传的" + scene.images().label() + "，画面里出现时要和它一致");
            if (!blank(r.characterTitle())) materials.add("「" + r.characterTitle().trim() + "」是出镜人物，长相和穿着保持一致");
            if (!blank(r.voiceTitle())) materials.add("「" + r.voiceTitle().trim() + "」是配音要用的声音");
            if (!materials.isEmpty()) lines.add("画布上的素材：" + String.join("；", materials) + "。");
            if (text.isEmpty() && !materials.isEmpty()) lines.add("我没写具体要求，先看素材，再按下面的拍法出方案。");
            lines.addAll(briefLines(scene));
            lines.add("拍法：" + scene.structure());
            lines.add(FACT_RULE);
            lines.add("要的是做好的视频，不只是脚本：把文案、分镜和每段视频一起排进方案，报总共要花的积分，我确认后一次生成。");
            return String.join("\n", lines);
        }

        private static boolean blank(String v) { return v == null || v.isBlank(); }
        private static String trim(String v) { return v == null ? "" : v.trim(); }
    }
}
