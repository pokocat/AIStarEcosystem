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
public final class StudioPromptCallPoints {
    private StudioPromptCallPoints() {}

    static void registerAll() {
        StudioPromptStages.register(sceneImage());
        StudioPromptStages.register(sceneHandoff());
        StudioPromptStages.register(sceneScript());
        registerStepThree();
        registerDirector();
        registerDirectorImages();
    }

    // ── 第 4 步：导演台文字任务（docs/studio-prompt-architecture.md §8 #17–#19）。原文逐字搬来，JSON 格式句在 StudioPromptFormats ──
    // 导演台拼自己的底座 base-director（原 DirectorPrompts.COMMON）；题材、调性、反转线是内容方法，由代码按作品的选择传进来。

    public static final String DIRECTOR_BASE = "base-director";
    public static final String DIRECTOR_SCRIPT = "stage-director-script", DIRECTOR_SPLIT = "stage-director-split", DIRECTOR_EXTRACT = "stage-director-extract",
            DIRECTOR_STORYBOARD = "stage-director-storyboard", DIRECTOR_ASSISTANT = "stage-director-assistant", DIRECTOR_BRIEF = "stage-director-brief",
            DIRECTOR_ASSET_IMAGE = "stage-director-asset-image", DIRECTOR_BOARD = "stage-director-board", DIRECTOR_IMAGE_NOTES = "stage-director-image-notes";

    private static void registerDirector() {
        Map<String, String> input = vars("input", "本次输入（JSON，作为素材）");
        String sampleInput = "{\"brief\":\"外卖员在雨夜捡到一只会说话的猫\",\"style\":\"写实\"}";
        StudioPromptStages.register(director(DIRECTOR_SCRIPT, "导演台编剧", input, Set.of("input"), formats("output", StudioPromptFormats.DIRECTOR_SCRIPT_OUTPUT),
                Map.of("input", sampleInput)));
        StudioPromptStages.register(director(DIRECTOR_SPLIT, "导演台分集", input, Set.of("input"), formats("output", StudioPromptFormats.DIRECTOR_SPLIT_OUTPUT),
                Map.of("input", "{\"paragraphs\":[{\"i\":0,\"text\":\"第1集\"}]}")));
        StudioPromptStages.register(director(DIRECTOR_EXTRACT, "导演台资产提取", input, Set.of("input"), formats("output", StudioPromptFormats.DIRECTOR_EXTRACT_OUTPUT),
                Map.of("input", "{\"episodes\":[],\"existingAssets\":[]}")));
        Map<String, String> storyboard = vars("input", "本次输入（JSON，作为素材）", "minSec", "片段最短秒数（视频模型合同）", "maxSec", "片段最长秒数（视频模型合同）",
                "maxShots", "每段最多镜头数", "lo", "建议贴近的下限：max(最短, 最长 − 3)", "shotsLo", "每段至少镜头数：min(3, 最多镜头数)",
                "single", "视频模型只按首帧出片（每段 1 个镜头）", "reshoot", "重写指定片段（片段划分不变）");
        Map<String, Function<Map<String, ?>, String>> storyboardFormats = new LinkedHashMap<>();
        storyboardFormats.put("output", v -> Boolean.TRUE.equals(v.get("reshoot")) ? StudioPromptFormats.DIRECTOR_RESHOOT_OUTPUT : StudioPromptFormats.DIRECTOR_PLAN_OUTPUT);
        Map<String, Object> storyboardSample = new LinkedHashMap<>();
        storyboardSample.put("input", "{\"episodeNo\":1,\"content\":\"……\",\"assets\":[]}");
        storyboardSample.put("minSec", 5); storyboardSample.put("maxSec", 15); storyboardSample.put("maxShots", 4);
        storyboardSample.put("lo", 12); storyboardSample.put("shotsLo", 3); storyboardSample.put("single", false); storyboardSample.put("reshoot", false);
        StudioPromptStages.register(director(DIRECTOR_STORYBOARD, "导演台写分镜脚本", storyboard, Set.of("input"), storyboardFormats, storyboardSample));
        StudioPromptStages.register(director(DIRECTOR_ASSISTANT, "导演台创作助手", vars("input", "作品与当前对象（JSON，作为素材）", "text", "用户这次说的话"),
                Set.of("input", "text"), formats("output", StudioPromptFormats.DIRECTOR_ASSISTANT_OUTPUT),
                Map.of("input", "{\"scope\":\"script\"}", "text", "开头不够抓人，改一下")));
        StudioPromptStages.register(director(DIRECTOR_BRIEF, "导演台写剧本前的问答",
                vars("input", "创意与之前的问答（JSON，作为素材）", "opening", "这是第一轮", "text", "用户这次的回答", "maxQuestions", "一轮最多几个问题"),
                Set.of("input"), formats("output", StudioPromptFormats.DIRECTOR_BRIEF_OUTPUT),
                Map.of("input", "{\"idea\":\"外卖员在雨夜捡到一只会说话的猫\"}", "opening", true, "text", "", "maxQuestions", 2)));
    }

    /** 导演台交给画图模型的两份描述（§8 #20）和出图附加说明：不拼底座；生成时记下版本，核对旧图按那一版编。 */
    private static void registerDirectorImages() {
        Map<String, Object> asset = new LinkedHashMap<>();
        asset.put("style", "真人写实"); asset.put("name", "周桂芬"); asset.put("description", "五十岁上下，短卷发，深蓝色工装外套。");
        asset.put("live", true); asset.put("isScene", false); asset.put("isProp", false); asset.put("isCharacter", true);
        StudioPromptStages.register(new StudioPromptStages.Stage(DIRECTOR_ASSET_IMAGE, StudioPromptEntry.IMAGE_MODEL, "导演台资产参考图",
                vars("style", "画面风格", "name", "资产名称", "description", "外观与设定", "live", "真人实拍类风格（按风格文字判断）",
                        "isScene", "这是场景", "isProp", "这是道具", "isCharacter", "这是角色（不是场景也不是道具）"), Set.of(), Map.of(), asset));
        Map<String, Object> board = new LinkedHashMap<>();
        board.put("style", "真人写实"); board.put("aspect", "9:16"); board.put("single", false); board.put("live", true); board.put("blanks", true);
        board.put("hasRefs", true);
        board.put("refs", List.of(Map.of("label", "图1", "name", "周桂芬", "isScene", false, "isProp", false, "isCharacter", true)));
        board.put("cells", List.of(Map.of("position", "左上", "size", "近景", "camera", "平视，固定机位", "still", "周桂芬抬头看向门口"),
                Map.of("position", "右上", "size", "中景", "camera", "越过肩膀拍门口，镜头缓慢推近", "still", "门被推开一条缝")));
        StudioPromptStages.register(new StudioPromptStages.Stage(DIRECTOR_BOARD, StudioPromptEntry.IMAGE_MODEL, "导演台分镜图",
                vars("style", "画面风格", "aspect", "画幅", "single", "只有一个镜头（单张画面，不是 2×2）", "refs", "参考图：[{label, name, isScene, isProp, isCharacter}]",
                        "hasRefs", "有参考图", "cells", "每格：[{position（左上 / 右上 / 左下 / 右下）, size, camera, still}]", "blanks", "2×2 板有空着的格子",
                        "live", "真人实拍类风格"), Set.of(), Map.of(), board));
        StudioPromptStages.register(new StudioPromptStages.Stage(DIRECTOR_IMAGE_NOTES, StudioPromptEntry.MESSAGE, "导演台出图附加说明",
                vars("refScene", "带了用户的场景参考图", "refProp", "带了用户的道具参考图", "refCharacter", "带了用户的形象参考照片",
                        "baseOn", "在当前图上修改时，当前图的编号（如「图2」）"), Set.of(), Map.of(),
                new LinkedHashMap<>(Map.of("refScene", false, "refProp", false, "refCharacter", true, "baseOn", "图2"))));
    }

    private static StudioPromptStages.Stage director(String key, String title, Map<String, String> vars, Set<String> required,
                                                     Map<String, Function<Map<String, ?>, String>> formats, Map<String, ?> sample) {
        return new StudioPromptStages.Stage(key, StudioPromptEntry.LLM, title, vars, required, formats, new LinkedHashMap<>(sample), DIRECTOR_BASE);
    }

    // ── 第 3 步：画布与对话（docs/studio-prompt-architecture.md §8 #1–#9、#15）。原文逐字搬来，JSON 格式句在 StudioPromptFormats ──

    static final String SKILL_CHECK = "stage-skill-check", SKILL_DISTILL = "stage-skill-distill", SKILL_PLAN = "stage-skill-plan",
            CANVAS_TEXT = "stage-canvas-text", CANVAS_SCRIPT = "stage-canvas-script", ASSET_EXTRACT = "stage-asset-extract",
            DIALOGUE = "stage-dialogue", DIALOGUE_SUMMARY = "stage-dialogue-summary", VIEW_IMAGES = "stage-view-images", IMAGE = "stage-image";

    private static void registerStepThree() {
        StudioPromptStages.register(stage(SKILL_CHECK, StudioPromptEntry.LLM, "成片检查",
                vars("checklist", "检查清单（id 与判法）", "target", "目标说明", "frames", "采样画面（带原片时间）"),
                Set.of("checklist", "frames"), formats("output", StudioPromptFormats.CHECK_OUTPUT, "contracts", "", "appendix", ""),
                Map.of("checklist", "- subject-consistency：主体一致", "target", "（无）", "frames", "第 1 帧（0.0 秒）")));
        StudioPromptStages.register(stage(SKILL_DISTILL, StudioPromptEntry.LLM, "技能整理草稿",
                vars("skillName", "方法名称", "baseVersion", "现行版本号", "executionVersion", "这次制作用的版本号", "skill", "现行正文",
                        "execution", "制作记录（JSON）", "note", "运营补充的整理重点"),
                Set.of("skill", "execution"), formats("output", StudioPromptFormats.DISTILL_OUTPUT),
                Map.of("skillName", "出视频", "baseVersion", 1, "executionVersion", 1, "skill", "# 出视频", "execution", "{}", "note", "无。")));
        StudioPromptStages.register(stage(SKILL_PLAN, StudioPromptEntry.LLM, "制作方案规划",
                vars("skill", "制作做法正文", "stage", "阶段说明", "constraints", "本阶段允许的操作与上限", "brief", "用户目标与补充",
                        "analysis", "原片分析", "assets", "素材清单", "capabilities", "可用模型与合同", "budget", "已批准的预算", "feedback", "用户对上一版方案的反馈"),
                Set.of("skill", "brief"), formats("output", StudioPromptFormats.PLAN_OUTPUT, "contracts", "", "appendix", ""),
                Map.of("skill", "# 出视频", "stage", "制作阶段", "constraints", "{}", "brief", "做一条 10 秒的商品展示", "analysis", "（无）",
                        "assets", "（无）", "capabilities", "[]", "budget", "尚未批准", "feedback", "（无）")));
        StudioPromptStages.register(stage(CANVAS_TEXT, StudioPromptEntry.LLM, "画布文字创作与改稿",
                vars("mode", "模式：general / original / adapt / director", "input", "用户的话或修改意图", "canvasContext", "所选画布内容",
                        "characterContext", "人物设定", "history", "近期对话（JSON）"),
                Set.of("input"), formats("output", StudioPromptFormats.ASSISTANT_OUTPUT, "contracts", "", "appendix", ""),
                Map.of("mode", "general", "input", "起一个标题", "canvasContext", "[]", "characterContext", "[]", "history", "[]")));
        Map<String, String> scriptVars = vars("operation", "创作方式：script / storyboard", "input", "创作要求及当前编辑内容", "characterContext", "已选人物设定",
                "settings", "结构化创作设定（JSON）", "episodeNo", "本次创作分集");
        Map<String, Object> scriptSample = Map.of("operation", "script", "input", "写一集都市悬疑", "characterContext", "[]", "settings", "null", "episodeNo", "全部");
        StudioPromptStages.register(stage(CANVAS_SCRIPT, StudioPromptEntry.LLM, "剧本与分镜", scriptVars, Set.of("input"),
                formats("output", StudioPromptFormats.SCRIPT_OUTPUT, "contracts", "", "appendix", ""), scriptSample));
        StudioPromptStages.register(stage(ASSET_EXTRACT, StudioPromptEntry.LLM, "剧本资产提取", scriptVars, Set.of("input"),
                formats("contracts", "", "appendix", ""), scriptSample));
        StudioPromptStages.register(stage(DIALOGUE, StudioPromptEntry.LLM, "创作助手对话",
                vars("skill", "技能（方法）与其它方法的说明", "stage", "当前阶段", "tools", "可用工具", "context", "画布与素材概要", "history", "近期对话",
                        "steering", "接续信息与待应用的用户调整", "input", "用户最新消息"),
                Set.of("input", "tools"), formats("actions", StudioPromptFormats.DIALOGUE_ACTIONS),
                Map.of("skill", "还没有选定方法。", "stage", "未开始", "tools", "- read_skill", "context", "（空画布）", "history", "（无）", "steering", "（无）", "input", "做一张海报")));
        StudioPromptStages.register(stage(DIALOGUE_SUMMARY, StudioPromptEntry.LLM, "对话历史摘要", vars("material", "已有要点和新增对话"), Set.of("material"),
                Map.of(), Map.of("material", "用户：做一张海报")));
        StudioPromptStages.register(stage(VIEW_IMAGES, StudioPromptEntry.LLM, "对话里看图", vars("question", "助手想重点确认的事，可以为空"), Set.of(),
                Map.of(), Map.of("question", "哪张是正面")));
        StudioPromptStages.register(stage(IMAGE, StudioPromptEntry.IMAGE_MODEL, "画布出图包装",
                vars("prompt", "用户的出图指令", "refLead", "参考图开场说明（代码生成）", "refOrder", "参考图顺序说明（代码生成）", "refNotes", "参考图备注（代码生成）"),
                Set.of("prompt"), Map.of(), Map.of("prompt", "a red apple on a desk", "refLead", "", "refOrder", "", "refNotes", "")));
        // 复刻与拉片（§8 #10–#11）：画面素材是代码拼的多模态内容，这几个环节只放 system；material 只在后台预览里用
        StudioPromptStages.register(stage(RECREATION, StudioPromptEntry.LLM, "复刻全片拆解", vars("input", "用户补充关注点"), Set.of("input"),
                formats("output", StudioPromptFormats.RECREATION_OUTPUT, "contracts", "", "appendix", ""), Map.of("input", "开头怎么抓人")));
        StudioPromptStages.register(stage(RECREATION_OBSERVE, StudioPromptEntry.LLM, "复刻逐页观察", vars("material", "预览用的示例素材说明"), Set.of(),
                formats("output", StudioPromptFormats.OBSERVE_OUTPUT, "evidence", ""), Map.of("material", "（采样画面）")));
        StudioPromptStages.register(stage(FILM_PLAN, StudioPromptEntry.LLM, "拉片分段", vars("material", "预览用的示例素材说明"), Set.of(),
                formats("output", StudioPromptFormats.FILM_PLAN_OUTPUT, "cap", ""), Map.of("material", "（全片文档与采样画面）")));
        StudioPromptStages.register(stage(FILM_SEGMENT, StudioPromptEntry.LLM, "拉片逐段分析", vars("material", "预览用的示例素材说明"), Set.of(),
                formats("output", StudioPromptFormats.FILM_SEGMENT_OUTPUT), Map.of("material", "（本段采样画面）")));
    }

    static final String RECREATION = "stage-recreation", RECREATION_OBSERVE = "stage-recreation-observe",
            FILM_PLAN = "stage-film-study-plan", FILM_SEGMENT = "stage-film-study";
    /** 复刻任务受理时一起冻结的环节：拆解、逐页观察、拉片分段、逐段分析。 */
    public static final java.util.List<String> RECREATION_STAGES = java.util.List.of(RECREATION, RECREATION_OBSERVE, FILM_PLAN, FILM_SEGMENT);

    private static StudioPromptStages.Stage stage(String key, String target, String title, Map<String, String> vars, Set<String> required,
                                                  Map<String, Function<Map<String, ?>, String>> formats, Map<String, ?> sample) {
        return new StudioPromptStages.Stage(key, target, title, vars, required, formats, new LinkedHashMap<>(sample));
    }

    private static Map<String, String> vars(String... pairs) {
        Map<String, String> out = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) out.put(pairs[i], pairs[i + 1]);
        return out;
    }

    /** 名字 → 固定文字（「这次请求才算得出来」的格式由调用点传入，这里只给预览用的默认值）。 */
    private static Map<String, Function<Map<String, ?>, String>> formats(String... pairs) {
        Map<String, Function<Map<String, ?>, String>> out = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) { String text = pairs[i + 1]; out.put(pairs[i], v -> text); }
        return out;
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
