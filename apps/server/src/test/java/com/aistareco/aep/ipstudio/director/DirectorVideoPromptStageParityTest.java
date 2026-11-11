package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.prompt.PromptTemplate;
import com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 视频提示词和首帧出片提示词搬进提示词库（stage-director-video / -frame）之后，库里第 1 版编出来的和搬家前的代码
 * （{@link CodedDirectorVideoPrompts}，原样保留）逐字一致。不一致的话，已采用的视频会被当成「提示词已修改」标成需更新。
 * 片段按会走到的分支组合：单张画面 / 2×2 宫格（2、3、4 镜）/ 长视频两张宫格（5–8 镜），有无参考图、商品、多角色、别名，
 * 画内画外、旁白、听着的人，有无台词、声音样本、音色描述，机位空、句末已有标点、非整数秒。
 */
class DirectorVideoPromptStageParityTest {
    private static final ObjectMapper OM = new ObjectMapper();
    private static final StudioPromptAssembler A = StudioPromptAssembler.classpath();
    private static final Map<String, String> NAMES = Map.of("c1", "陈默", "c2", "林小雅", "c3", "餐馆老板");
    private static final String[] SIZES = {"全景", "近景", "特写", "中景"};
    private static final String[][] SHOT_TEXT = {
            {"低角度仰拍", "陈默背影专注，林小雅侧面举相机", "陈默用细毛刷沿壁画底边慢慢刷"},
            {"", "林小雅手指指向壁画！", "林小雅身体前倾，指着飞仙的眼睛"},
            {"侧面特写", "老板端着面走过来", "门外传来陈默的声音。"},
            {"过肩镜头，从陈默背后看林小雅", "", "林小雅凑近壁画"},
    };

    private static ObjectNode shot(int i, double seconds, String... speakers) {
        String[] t = SHOT_TEXT[i % SHOT_TEXT.length];
        ObjectNode s = OM.createObjectNode().put("durationSec", seconds).put("size", SIZES[i % SIZES.length])
                .put("camera", t[0]).put("still", t[1]).put("action", t[2]);
        ArrayNode d = s.putArray("dialogue");
        for (String sp : speakers) {
            ObjectNode line = d.addObject().put("text", "第" + (i + 1) + "镜的台词，" + sp + "说的。");
            if (!sp.equals("-")) line.put("speakerId", sp);
        }
        return s;
    }

    private static List<JsonNode> clips() {
        List<JsonNode> out = new ArrayList<>();
        String[][][] dialogues = {
                {{}},
                {{"c2"}},
                {{}, {"c2"}},
                {{}, {"c2"}, {"c1"}},
                {{}, {"c2"}, {"c1", "c2"}, {"-"}},
                {{"c3"}, {}, {"c2"}, {}, {"c1"}},
                {{}, {"c2"}, {}, {"c1"}, {}, {"c2"}, {"c1"}},
                {{"c1"}, {"c2"}, {"c3"}, {}, {"-"}, {"c2"}, {}, {"c1"}},
                {{}, {}, {}, {}},
        };
        for (String[][] d : dialogues) {
            ObjectNode clip = OM.createObjectNode();
            ArrayNode shots = clip.putArray("shots");
            double total = 0;
            for (int i = 0; i < d.length; i++) {
                double sec = i % 3 == 1 ? 2.5 : 3;
                shots.add(shot(i, sec, d[i]));
                total += sec;
            }
            clip.put("durationSec", total);
            out.add(clip);
        }
        return out;
    }

    private record Refs(List<DirectorPrompts.Ref> refs, List<DirectorPrompts.VoiceRef> voices, Map<String, String> descs) {}

    private static List<Refs> refSets() {
        Map<String, String> descs = new LinkedHashMap<>();
        descs.put("林小雅", "二十多岁的女声，语速快");
        descs.put("陈默", "低沉的男声");
        return List.of(
                new Refs(List.of(), List.of(), Map.of()),
                new Refs(List.of(new DirectorPrompts.Ref("图2", "character", "陈默")), List.of(), Map.of()),
                new Refs(List.of(new DirectorPrompts.Ref("图2", "character", "陈默"), new DirectorPrompts.Ref("图3", "character", "林小雅"),
                        new DirectorPrompts.Ref("图4", "scene", "莫高窟"), new DirectorPrompts.Ref("图5", "prop", "细毛刷"),
                        new DirectorPrompts.Ref("图6", "product", "水光精华")),
                        List.of(new DirectorPrompts.VoiceRef("音频1", "林小雅")), descs),
                new Refs(List.of(new DirectorPrompts.Ref("图2", "character", "陈默"), new DirectorPrompts.Ref("图3", "character", "餐馆老板")),
                        List.of(new DirectorPrompts.VoiceRef("音频1", "陈默"), new DirectorPrompts.VoiceRef("音频2", "餐馆老板")), Map.of("陈默", "低沉的男声")));
    }

    private static final List<Map<String, List<String>>> ALIASES = List.of(Map.of(), Map.of("餐馆老板", List.of("老板")));

    @Test
    void videoPromptFromTheLibraryMatchesTheOldCode() {
        int checked = 0;
        for (String style : new String[]{"真人写实", "二次元"}) for (JsonNode clip : clips()) for (Refs r : refSets()) for (var aliases : ALIASES)
            for (int maxShots : new int[]{DirectorPrompts.MAX_SHOTS, DirectorPrompts.MAX_SHOTS * 2}) {
                ObjectNode settings = OM.createObjectNode().put("style", style);
                String old = CodedDirectorVideoPrompts.videoPrompt(settings, clip, r.refs(), NAMES, r.voices(), List.of(), r.descs(), aliases, maxShots);
                String now = DirectorPrompts.videoPrompt(A, null, settings, clip, r.refs(), NAMES, r.voices(), List.of(), r.descs(), aliases, maxShots);
                assertThat(now).as(style + " / " + clip.path("shots").size() + " 镜 / " + r.refs().size() + " 张参考 / maxShots " + maxShots).isEqualTo(old);
                checked++;
            }
        assertThat(checked).isEqualTo(2 * 9 * 4 * 2 * 2);
    }

    @Test
    void framePromptFromTheLibraryMatchesTheOldCode() {
        for (JsonNode clip : clips()) for (Map<String, String> descs : List.of(Map.<String, String>of(), Map.of("林小雅", "二十多岁的女声"))) {
            ObjectNode settings = OM.createObjectNode().put("style", "真人写实").put("aspectRatio", "16:9");
            assertThat(DirectorPrompts.framePrompt(A, null, settings, clip, NAMES, descs))
                    .isEqualTo(CodedDirectorVideoPrompts.framePrompt(settings, clip, NAMES, descs));
        }
    }

    /** 模板里用到的名字都登记过（后台改模板时照登记表填变量）。 */
    @Test
    void templatesOnlyUseRegisteredVariables() {
        for (String stage : List.of("stage-director-video", "stage-director-video-frame")) {
            var entry = A.library().find(stage).orElseThrow();
            assertThat(entry.target()).isEqualTo("video-model");
            assertThat(PromptTemplate.names(entry.body())).isNotEmpty();
        }
    }
}
