package com.aistareco.aep.ipstudio.prompt;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/**
 * 每个调用点在这里登记它的环节（{@link StudioPromptStages.Stage}）：变量、必填项、输出格式和后台预览用的示例。
 * 调用点搬进提示词库时在这里加一项（docs/studio-prompt-architecture.md §8、§10）。
 */
final class StudioPromptCallPoints {
    private StudioPromptCallPoints() {}

    static void registerAll() {
        StudioPromptStages.register(sceneImage());
        StudioPromptStages.register(sceneHandoff());
        StudioPromptStages.register(sceneScript());
    }

    // ── AI 图片 / AI 视频（docs/studio-prompt-architecture.md §8 #12–#14） ───────────────────────────────────────

    static final String SCENE_IMAGE = "stage-scene-image", SCENE_HANDOFF = "stage-scene-handoff", SCENE_SCRIPT = "stage-scene-script";

    private static StudioPromptStages.Stage sceneImage() {
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("free", "自由出图（没有场景描述，只有用户写的那句）");
        vars.put("extra", "用户写的补充要求");
        vars.put("custom", "用户改过的完整描述，没改为空");
        vars.put("options", "选中的选项：[{label, prompt}]");
        Map<String, Object> sample = new LinkedHashMap<>();
        sample.put("free", false); sample.put("extra", "背景换成浅木色桌面");
        sample.put("options", List.of(Map.of("label", "风格", "prompt", "干净的棚拍质感")));
        return new StudioPromptStages.Stage(SCENE_IMAGE, StudioPromptEntry.IMAGE_MODEL, "AI 图片 · 场景出图", vars, Set.of(), Map.of(), sample);
    }

    private static StudioPromptStages.Stage sceneHandoff() {
        Map<String, String> vars = new LinkedHashMap<>(common());
        vars.put("hasMaterials", "画布上有素材");
        vars.put("materials", "素材：[{isVideo, isImages, isCharacter, isVoice, title, titles, label}]");
        vars.put("hasBrief", "场景写了要用到的信息");
        vars.put("goal", "（旧场景）这一条要做到");
        vars.put("ending", "（旧场景）结尾要观众做什么");
        Map<String, Object> sample = sample();
        sample.put("hasMaterials", true);
        sample.put("materials", List.of(Map.of("isVideo", false, "isImages", true, "isCharacter", false, "isVoice", false, "title", "", "titles", List.of("门店门头.jpg"), "label", "门店照片")));
        sample.put("hasBrief", true); sample.put("goal", ""); sample.put("ending", "");
        return new StudioPromptStages.Stage(SCENE_HANDOFF, StudioPromptEntry.MESSAGE, "AI 视频 · 交给助手的话", vars, Set.of("duration", "sceneTitle"), Map.of(), sample);
    }

    private static StudioPromptStages.Stage sceneScript() {
        Map<String, String> vars = new LinkedHashMap<>(common());
        vars.put("language", "台词语言");
        vars.put("revision", "用户写的修改意见");
        vars.put("settingsChanged", "设置变了什么（时长、画面、参考图），没变为空");
        vars.put("revising", "这是改稿（有修改意见或设置变了）");
        vars.put("hasRefs", "有交给视频模型的参考图");
        vars.put("refs", "参考图：[{n, title, label, person}]");
        vars.put("voice", "说话要用的声音名称");
        vars.put("voiceOnly", "没有参考图、只有声音");
        vars.put("hasSeen", "有视频模型用不上、只给编导看的图");
        vars.put("seen", "只给编导看的图的名称");
        vars.put("visual", "写脚本的模型这次能看到图");
        vars.put("blind", "有图但写脚本的模型看不到");
        vars.put("hasInferable", "有可以从素材推断的信息");
        vars.put("inferable", "可以从素材推断的信息名称");
        vars.put("current", "当前脚本（JSON 字符串），第一次写为空");
        Map<String, Function<Map<String, ?>, String>> formats = new LinkedHashMap<>();
        formats.put("output", v -> OUTPUT);
        formats.put("shots", StudioPromptCallPoints::shots);
        formats.put("attachments", v -> Boolean.TRUE.equals(v.get("readVisuals")) ? ATTACHMENTS : "");
        Map<String, Object> sample = sample();
        sample.put("language", "中文"); sample.put("hasRefs", true); sample.put("visual", true);
        sample.put("refs", List.of(Map.of("n", 1, "title", "门店门头.jpg", "label", "门店照片", "person", false),
                Map.of("n", 2, "title", "达人.jpg", "label", "出镜人物", "person", true)));
        sample.put("voice", "配音");
        sample.put("hasInferable", false);
        return new StudioPromptStages.Stage(SCENE_SCRIPT, StudioPromptEntry.LLM, "AI 视频 · 编导写脚本", vars,
                Set.of("duration", "sceneTitle", "language"), formats, sample);
    }

    /** 两个视频环节共用的变量。 */
    private static Map<String, String> common() {
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("duration", "时长（秒）");
        vars.put("orientation", "竖屏 / 横屏");
        vars.put("sceneTitle", "场景名称");
        vars.put("ask", "用户写的那句要求");
        vars.put("noAsk", "用户没写要求但放了素材");
        vars.put("options", "选中的选项：[{label, prompt}]");
        vars.put("hasFacts", "场景写了要用到的信息");
        vars.put("facts", "要用到的信息：[{label, use}]");
        vars.put("hasRequired", "有必须给的信息");
        vars.put("required", "必须给的信息名称（不含可以推断的）");
        vars.put("noFiction", "这条不编故事（场景设成只用给的）");
        return vars;
    }

    private static Map<String, Object> sample() {
        Map<String, Object> sample = new LinkedHashMap<>();
        sample.put("duration", 25); sample.put("orientation", "竖屏"); sample.put("sceneTitle", "同城团购");
        sample.put("ask", "位置在杭州市萧山区公安路188号；锅盔搞活动，原价19块一个，现价9.9一个；当地老字号；店门口很多人都在排队；我是达人去探店");
        sample.put("options", List.of());
        sample.put("hasFacts", true);
        sample.put("facts", List.of(Map.of("label", "位置", "use", ""), Map.of("label", "套餐内容与团购价", "use", "")));
        sample.put("hasRequired", true); sample.put("required", List.of("位置", "套餐内容与团购价"));
        return sample;
    }

    // ── 编导的输出格式（和 H3PromptRewrite 的解析、StudioTextRevision 的校验是一对，改了要一起改） ────────────────

    static final String OUTPUT = "只输出一个 JSON 对象 {\"summary\":\"一句话说明这一版的思路\",\"content\":\"完整脚本正文\"}，不要代码围栏；"
            + "不输出 steps、shots 或工具指令；不要声称已经保存或生成视频。";

    static final String ATTACHMENTS = "本次另附带精确节点 ID 标记的真实图片与视频采样帧。视频只有四个时间点的静态画面，不包含音轨，不代表全部连续动作；"
            + "音频节点只提供文字设定。只根据收到的画面及文字作答，不臆测未提供的声音或片段，保持 JSON 输出契约。";

    /**
     * 镜头行写法（docs/studio-prompt-architecture.md §9.4）：H3 改写认「第N镜（起 秒」和「名字说：「」」；给一个照抄就对的例子
     * （2026-10-31 本地 Agnes 照「起–止」模板把这几个字抄进了括号），例子里的秒数按时长算、不超过总时长。
     */
    static String shots(Map<String, ?> vars) {
        int d = vars.get("duration") instanceof Number n ? Math.max(1, n.intValue()) : 15;
        int a = Math.min(3, d), b = Math.min(6, d);
        StringBuilder out = new StringBuilder("每个镜头单独一行，像这样：\n");
        out.append("第1镜（0–").append(a).append(" 秒）：画面：……；景别/机位/焦点：……；音效：……；店员说：「……」；BGM：……\n");
        if (b > a) out.append("第2镜（").append(a).append("–").append(b).append(" 秒）：画面：……；景别/机位/焦点：……；音效：……；BGM：……\n");
        out.append("括号里只写起止秒数，第1镜从 0 秒开始，每一镜接着上一镜；所有镜头加起来正好 ").append(d).append(" 秒，最后一个镜头补到 ").append(d).append(" 秒整。\n");
        out.append("有人说话写「名字说：「台词」」，画面外的人说写「名字在画外说：「……」」，旁白写「旁白说：「……」」；没有台词就不写这一项。一句台词一个「」，台词里面不要再用「」。");
        return out.toString();
    }
}
