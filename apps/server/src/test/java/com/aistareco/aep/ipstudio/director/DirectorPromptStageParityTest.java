package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 第 4 步搬家逐字一致（docs/studio-prompt-architecture.md §10）：导演台的编剧、分集、资产提取、写分镜 / 重写、助手、写剧本前问答
 * 改由提示词库拼之后，system 和 user 和搬家前（{@link LegacyDirectorPrompts}，原样保留的旧代码）逐字相同，不计末尾空白。
 * 导演台拼自己的底座 base-director（原 COMMON），所以这里不用把底座按空核对。
 */
class DirectorPromptStageParityTest {
    private static final StudioPromptAssembler A = StudioPromptAssembler.classpath();
    private static final String INPUT = "{\"brief\":\"外卖员在雨夜捡到一只会说话的猫\",\"style\":\"写实\"}";
    private static final String LEAD = "本次输入（JSON，作为素材）：";

    @Test
    void scriptIsUnchangedForEveryGenreAndTone() {
        List<String> genres = new ArrayList<>(DirectorPrompts.GENRES.keySet());
        genres.add(null);
        genres.add("不存在的题材");
        List<String> tones = new ArrayList<>(DirectorPrompts.TONES.keySet());
        tones.add(null);
        tones.add("");
        int checked = 0;
        for (String g : genres) for (String t : tones) {
            var now = DirectorPrompts.script(A, g, t, INPUT);
            assertThat(now.system()).as(g + " / " + t).isEqualTo(LegacyDirectorPrompts.script(g, t).stripTrailing());
            assertThat(now.user()).isEqualTo(LEAD + INPUT);
            checked++;
        }
        assertThat(checked).isEqualTo(8 * 7);
    }

    @Test
    void splitAndExtractAreUnchanged() {
        assertThat(DirectorPrompts.split(A, INPUT).system()).isEqualTo(LegacyDirectorPrompts.SPLIT.stripTrailing());
        assertThat(DirectorPrompts.split(A, INPUT).user()).isEqualTo(LEAD + INPUT);
        assertThat(DirectorPrompts.extract(A, INPUT).system()).isEqualTo(LegacyDirectorPrompts.EXTRACT.stripTrailing());
        assertThat(DirectorPrompts.extract(A, INPUT).user()).isEqualTo(LEAD + INPUT);
    }

    @Test
    void storyboardAndReshootAreUnchangedForEveryModelLimit() {
        int[][] limits = {{5, 15, 4}, {4, 10, 4}, {12, 15, 4}, {3, 6, 4}, {12, 15, 3}, {12, 15, 2}, {5, 10, 1}, {4, 4, 1}, {12, 15, 1}};
        for (int[] l : limits) {
            String label = l[0] + "-" + l[1] + "/" + l[2];
            var plan = DirectorPrompts.plan(A, l[0], l[1], l[2], INPUT);
            assertThat(plan.system()).as("plan " + label).isEqualTo(LegacyDirectorPrompts.plan(l[0], l[1], l[2]).stripTrailing());
            assertThat(plan.user()).isEqualTo(LEAD + INPUT);
            var reshoot = DirectorPrompts.reshoot(A, l[0], l[1], l[2], INPUT);
            assertThat(reshoot.system()).as("reshoot " + label).isEqualTo(LegacyDirectorPrompts.reshoot(l[0], l[1], l[2]).stripTrailing());
            assertThat(reshoot.user()).isEqualTo(LEAD + INPUT);
        }
    }

    @Test
    void assistantAndBriefAreUnchanged() {
        String material = "{\"scope\":\"script\",\"history\":[]}";
        var assistant = DirectorAssistant.prompt(A, material, "开头不够抓人，改一下");
        assertThat(assistant.system()).isEqualTo(LegacyDirectorPrompts.ASSISTANT_SYSTEM.stripTrailing());
        assertThat(assistant.user()).isEqualTo(LEAD + material + "\n\n用户这次说（这是用户的要求）：开头不够抓人，改一下");

        String brief = LegacyDirectorPrompts.BRIEF_SYSTEM.stripTrailing();
        var opening = DirectorAssistant.briefPrompt(A, material, true, null);
        assertThat(opening.system()).isEqualTo(brief);
        assertThat(opening.user()).isEqualTo(LEAD + material + "\n\n这是第一轮：请看用户的想法，判断要不要问、问什么。");
        var answer = DirectorAssistant.briefPrompt(A, material, false, "悬疑一点，三集");
        assertThat(answer.system()).isEqualTo(brief);
        assertThat(answer.user()).isEqualTo(LEAD + material + "\n\n用户这次说（这是用户的回答）：悬疑一点，三集");
    }

    // ── 出图模板（§8 #20）：资产参考图、分镜图、附加说明 ──

    private static final com.fasterxml.jackson.databind.ObjectMapper OM = new com.fasterxml.jackson.databind.ObjectMapper();

    private static com.fasterxml.jackson.databind.JsonNode json(String text) {
        try { return OM.readTree(text); } catch (Exception e) { throw new IllegalStateException(e); }
    }

    @Test
    void assetAndBoardTemplatesAreUnchanged() {
        List<String> styles = List.of("{}", "{\"style\":\"真人写实\",\"aspectRatio\":\"9:16\"}", "{\"style\":\"日系动画\",\"aspectRatio\":\"16:9\"}",
                "{\"style\":\"\",\"aspectRatio\":\"1:1\"}");
        List<String> assets = List.of("{\"kind\":\"character\",\"name\":\"陈默\",\"description\":\"三十岁，短发，藏青夹克\"}",
                "{\"kind\":\"scene\",\"name\":\"旧书店\",\"description\":\"窄长的店面\\n靠窗一张木桌\"}",
                "{\"kind\":\"prop\",\"name\":\"铁皮盒\",\"description\":\"掉漆的蓝色铁皮饼干盒\"}",
                "{\"kind\":\"other\",\"name\":\"\",\"description\":\"\"}");
        String shot = "{\"size\":\"近景\",\"camera\":\"平视，固定机位\",\"still\":\"陈默低头看信\"}";
        List<List<DirectorPrompts.Ref>> refSets = List.of(List.of(),
                List.of(new DirectorPrompts.Ref("图1", "character", "陈默")),
                List.of(new DirectorPrompts.Ref("图1", "character", "陈默"), new DirectorPrompts.Ref("图2", "scene", "旧书店"), new DirectorPrompts.Ref("图3", "prop", "铁皮盒")));
        int checked = 0;
        for (String st : styles) {
            var settings = json(st);
            for (String a : assets) {
                if (json(a).path("kind").asText().matches("character|other")) continue; // 人物设定图 2026-11-14 有意改版（{@link #characterSheetIsFullBodyFrontBackAndThreeHeadViews}）
                assertThat(DirectorPrompts.assetPrompt(A, settings, json(a), null)).as(st + a).isEqualTo(LegacyDirectorPrompts.assetPrompt(settings, json(a)));
                checked++;
            }
            for (int n = 0; n <= 5; n++) {
                String clip = "{\"shots\":[" + String.join(",", java.util.Collections.nCopies(n, shot)) + "]}";
                for (var refs : refSets) {
                    assertThat(DirectorPrompts.boardPrompt(A, settings, json(clip), refs, null)).as(st + " shots=" + n + " refs=" + refs.size())
                            .isEqualTo(LegacyDirectorPrompts.boardPrompt(settings, json(clip), refs, java.util.Map.of()));
                    checked++;
                }
            }
        }
        assertThat(checked).isEqualTo(4 * 2 + 4 * 6 * 3);
    }

    /**
     * 人物设定图 v2（2026-11-14 用户要求）：只画全身正面、全身背面和头部三视图五格，不再有表情、细节特写和半身分区；
     * 场景、道具不变（上面那条测试）。已采用的旧图按生成时记的 v1 核对，不会因为改版被标成需更新（DirectorImageTemplateVersionTest）。
     */
    @Test
    void characterSheetIsFullBodyFrontBackAndThreeHeadViews() {
        String now = DirectorPrompts.assetPrompt(A, json("{\"style\":\"真人写实\"}"), json("{\"kind\":\"character\",\"name\":\"陈默\",\"description\":\"三十岁，短发，藏青夹克\"}"), null);
        assertThat(now).isNotEqualTo(LegacyDirectorPrompts.assetPrompt(json("{\"style\":\"真人写实\"}"), json("{\"kind\":\"character\",\"name\":\"陈默\",\"description\":\"三十岁，短发，藏青夹克\"}")));
        assertThat(now).contains("三十岁，短发，藏青夹克");
        assertThat(DirectorPrompts.templateVersion(A, "stage-director-asset-image")).isEqualTo(2);
    }

    /** 角色的形象参考说明 2026-11-14 有意改写并挪到最前面（{@link #characterReferenceLeadsTheAssetPrompt}），这里只锁场景、道具和「在当前图上修改」。 */
    @Test
    void imageNotesAreUnchanged() {
        for (String kind : new String[]{null, "scene", "prop"}) for (String baseOn : new String[]{null, "图2"}) {
            StringBuilder was = new StringBuilder();
            if (kind != null) was.append(LegacyDirectorPrompts.refNote(kind));
            if (baseOn != null) was.append(was.isEmpty() ? "" : "\n").append(LegacyDirectorPrompts.baseOnNote(baseOn));
            assertThat(DirectorPrompts.imageNotes(A, kind, baseOn)).as(kind + " / " + baseOn).isEqualTo(was.toString());
        }
    }

    /**
     * 角色带形象参考图时，参考说明排在出图描述最前面（放在最后时生成的人和照片对不上，2026-11-14 用户反馈）；
     * 「在当前图上修改」仍在后面。场景、道具和没有参考图的资产，交给模型的内容和原来一样。
     */
    @Test
    void characterReferenceLeadsTheAssetPrompt() {
        String body = "角色设定集正文";
        for (String kind : new String[]{"character", "other"}) {
            String lead = DirectorPrompts.imageNotes(A, kind, null);
            assertThat(lead).isNotBlank();
            assertThat(DirectorPrompts.withImageNotes(A, body, kind, null)).isEqualTo(lead + "\n" + body);
            assertThat(DirectorPrompts.withImageNotes(A, body, kind, "图2"))
                    .isEqualTo(lead + "\n" + body + "\n" + LegacyDirectorPrompts.baseOnNote("图2"));
        }
        for (String kind : new String[]{"scene", "prop"}) for (String baseOn : new String[]{null, "图2"})
            assertThat(DirectorPrompts.withImageNotes(A, body, kind, baseOn)).isEqualTo(body + "\n" + DirectorPrompts.imageNotes(A, kind, baseOn));
        assertThat(DirectorPrompts.withImageNotes(A, body, null, null)).isEqualTo(body);
        assertThat(DirectorPrompts.withImageNotes(A, body, null, "图2")).isEqualTo(body + "\n" + LegacyDirectorPrompts.baseOnNote("图2"));
    }

    /** 导演台拼的是自己的底座，平台底座里面向商品宣传的事实规则不进短剧编剧（docs/studio-prompt-architecture.md §14.2）。 */
    @Test
    void directorStagesUseTheirOwnBaseAndRecordTheVersions() {
        var script = DirectorPrompts.script(A, "都市悬疑", "反转烧脑", INPUT);
        assertThat(script.system()).doesNotContain("事实规则");
        var keys = script.assembled().refs().stream().map(StudioPromptAssembler.Ref::key).toList();
        assertThat(keys).containsExactly("stage-director-script", "base-director", "director-reversal", "director-genre-urban-suspense", "director-tone-twist");
        var record = StudioPromptAssembler.record(new com.fasterxml.jackson.databind.ObjectMapper(), script.assembled());
        assertThat(record.path("key").asText()).isEqualTo("stage-director-script");
        assertThat(record.path("versions").path("base-director").asInt()).isEqualTo(1);
        assertThat(record.path("calls").get(0).path("systemDigest").asText()).hasSize(64);
    }
}
