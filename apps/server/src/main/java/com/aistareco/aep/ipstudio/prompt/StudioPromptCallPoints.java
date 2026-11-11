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
        StudioPromptStages.register(sceneVariables());
        registerStepThree();
        registerDirector();
        registerDirectorImages();
        registerSegmented();
    }

    // ── AI 视频页的长视频（docs/studio-segmented-video.md）。分镜图和视频提示词用导演台的模板，这里只有脚本、审稿和两段补充 ──

    public static final String SEGMENTED_SCRIPT = "stage-segmented-script", SEGMENTED_REVIEW = "stage-segmented-review",
            SEGMENTED_BOARD_NOTES = "stage-segmented-board-notes", SEGMENTED_BOARD_CHECK = "stage-segmented-board-check";

    private static void registerSegmented() {
        Map<String, String> script = new LinkedHashMap<>(common());
        script.put("language", "台词语言");
        script.put("hasScript", "用户已经写好脚本，ask 是脚本");
        script.put("hasRefs", "有交给视频模型的参考图");
        script.put("refs", "参考图：[{n, title, label, person}]");
        script.put("voice", "说话要用的声音名称");
        script.put("voiceOnly", "没有参考图、只有声音");
        script.put("visual", "写脚本的模型这次能看到图");
        script.put("blind", "有图但写脚本的模型看不到");
        script.put("hasInferable", "有可以从素材推断的信息");
        script.put("inferable", "可以从素材推断的信息名称");
        script.put("segments", "定好的分段：[{no, seconds, shotsLo, shotsHi}]");
        script.put("singleShot", "所选视频模型只按首帧出片，每段一个镜头");
        Map<String, Function<Map<String, ?>, String>> scriptFormats = new LinkedHashMap<>();
        scriptFormats.put("output", v -> StudioPromptFormats.SEGMENTED_SCRIPT_OUTPUT);
        scriptFormats.put("attachments", v -> Boolean.TRUE.equals(v.get("readVisuals")) ? ATTACHMENTS : "");
        Map<String, Object> scriptSample = sample();
        scriptSample.put("duration", 60); scriptSample.put("language", "中文"); scriptSample.put("hasRefs", false); scriptSample.put("visual", true); scriptSample.put("hasInferable", false);
        scriptSample.put("hasScript", false); scriptSample.put("singleShot", false);
        scriptSample.put("segments", List.of(Map.of("no", 1, "seconds", 30, "shotsLo", 6, "shotsHi", 8), Map.of("no", 2, "seconds", 30, "shotsLo", 6, "shotsHi", 8)));
        StudioPromptStages.register(new StudioPromptStages.Stage(SEGMENTED_SCRIPT, StudioPromptEntry.LLM, "AI 视频 · 写分段脚本", script,
                Set.of("duration", "sceneTitle", "language"), scriptFormats, scriptSample));
        Map<String, Object> reviewSample = new LinkedHashMap<>();
        reviewSample.put("duration", 60); reviewSample.put("orientation", "竖屏"); reviewSample.put("ask", "探店锅盔");
        reviewSample.put("segments", scriptSample.get("segments")); reviewSample.put("hasIssues", true);
        reviewSample.put("issues", List.of("第 1 段第 2 镜 3 秒有 20 个字，念不完")); reviewSample.put("current", "{\"segments\":[]}");
        StudioPromptStages.register(new StudioPromptStages.Stage(SEGMENTED_REVIEW, StudioPromptEntry.LLM, "AI 视频 · 审分段脚本",
                vars("duration", "总时长（秒）", "orientation", "竖屏 / 横屏", "ask", "用户写的要求", "segments", "定好的分段：[{no, seconds, shotsLo, shotsHi}]",
                        "hasIssues", "程序查出了问题", "issues", "程序查出的问题", "current", "当前脚本（JSON）"),
                Set.of("duration", "current"), formats("output", StudioPromptFormats.SEGMENTED_REVIEW_OUTPUT), reviewSample));
        Map<String, Object> notesSample = new LinkedHashMap<>();
        notesSample.put("assets", List.of(Map.of("name", "小夏", "description", "二十多岁，短发，白衬衫")));
        notesSample.put("prior", "图2"); notesSample.put("fix", "第三格多了一只手");
        StudioPromptStages.register(new StudioPromptStages.Stage(SEGMENTED_BOARD_NOTES, StudioPromptEntry.IMAGE_MODEL, "AI 视频 · 分镜图补充说明",
                vars("assets", "没有参考图的人和物：[{name, description}]", "prior", "前面那张分镜图的编号", "fix", "上一版没通过检查的问题"), Set.of(), Map.of(), notesSample).withoutBase());
        StudioPromptStages.register(new StudioPromptStages.Stage(SEGMENTED_BOARD_CHECK, StudioPromptEntry.MESSAGE, "AI 视频 · 分镜图检查要点",
                vars("prompt", "这张分镜图的出图描述"), Set.of("prompt"), Map.of(), Map.of("prompt", "左上格：近景，固定机位。小夏举起锅盔。")).withoutBase());
    }

    // ── 第 4 步：导演台文字任务（docs/studio-prompt-architecture.md §8 #17–#19）。原文逐字搬来，JSON 格式句在 StudioPromptFormats ──
    // 导演台拼自己的底座 base-director（原 DirectorPrompts.COMMON）；题材、调性、反转线是内容方法，由代码按作品的选择传进来。

    public static final String DIRECTOR_BASE = "base-director";
    public static final String DIRECTOR_SCRIPT = "stage-director-script", DIRECTOR_SCRIPT_MORE = "stage-director-script-more", DIRECTOR_SPLIT = "stage-director-split", DIRECTOR_EXTRACT = "stage-director-extract",
            DIRECTOR_STORYBOARD = "stage-director-storyboard", DIRECTOR_ASSISTANT = "stage-director-assistant", DIRECTOR_BRIEF = "stage-director-brief",
            DIRECTOR_ASSET_IMAGE = "stage-director-asset-image", DIRECTOR_BOARD = "stage-director-board", DIRECTOR_IMAGE_NOTES = "stage-director-image-notes",
            DIRECTOR_SCENE_VIEWS = "stage-director-scene-views", DIRECTOR_VIDEO = "stage-director-video", DIRECTOR_VIDEO_FRAME = "stage-director-video-frame";

    private static void registerDirector() {
        Map<String, String> input = vars("input", "本次输入（JSON，作为素材）");
        String sampleInput = "{\"brief\":\"外卖员在雨夜捡到一只会说话的猫\",\"style\":\"写实\"}";
        StudioPromptStages.register(director(DIRECTOR_SCRIPT, "导演台编剧", vars("input", "本次输入（JSON，作为素材）", "commerce", "带货短剧且作品里有商品：不给道具外观的示例，免得模型照着把商品写旧"), Set.of("input"), formats("output", StudioPromptFormats.DIRECTOR_SCRIPT_OUTPUT),
                Map.of("input", sampleInput)));
        StudioPromptStages.register(director(DIRECTOR_SCRIPT_MORE, "导演台接着写剧本", input, Set.of("input"), formats("output", StudioPromptFormats.DIRECTOR_SCRIPT_MORE_OUTPUT),
                Map.of("input", "{\"format\":{\"totalEpisodes\":10,\"secondsPerEpisode\":90,\"writeFrom\":4,\"writeTo\":6},\"written\":\"……\"}")));
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
                Map.of("input", "{\"idea\":\"外卖员在雨夜捡到一只会说话的猫\"}", "opening", true, "text", "", "maxQuestions", 4)));
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
        board.put("hasProduct", false);
        board.put("refs", List.of(Map.of("label", "图1", "name", "周桂芬", "isScene", false, "isProp", false, "isProduct", false, "isCharacter", true)));
        board.put("cells", List.of(Map.of("position", "左上", "size", "近景", "camera", "平视，固定机位", "still", "周桂芬抬头看向门口"),
                Map.of("position", "右上", "size", "中景", "camera", "越过肩膀拍门口，镜头缓慢推近", "still", "门被推开一条缝")));
        StudioPromptStages.register(new StudioPromptStages.Stage(DIRECTOR_BOARD, StudioPromptEntry.IMAGE_MODEL, "导演台分镜图",
                vars("style", "画面风格", "aspect", "画幅", "single", "只有一个镜头（单张画面，不是 2×2）", "refs", "参考图：[{label, name, isScene, isProp, isProduct, isCharacter}]",
                        "hasRefs", "有参考图", "hasProduct", "参考图里有商品", "cells", "每格：[{position（左上 / 右上 / 左下 / 右下）, size, camera, still}]", "blanks", "2×2 板有空着的格子",
                        "live", "真人实拍类风格"), Set.of(), Map.of(), board));
        StudioPromptStages.register(new StudioPromptStages.Stage(DIRECTOR_IMAGE_NOTES, StudioPromptEntry.MESSAGE, "导演台出图附加说明",
                vars("refScene", "带了用户的场景参考图", "refProp", "带了用户的道具参考图", "refCharacter", "带了用户的形象参考照片",
                        "form", "正在画角色的这个形态（图1 是主形象）", "baseOn", "在当前图上修改时，当前图的编号（如「图2」）"), Set.of(), Map.of(),
                new LinkedHashMap<>(Map.of("refScene", false, "refProp", false, "refCharacter", true, "form", "", "baseOn", "图2"))));
        StudioPromptStages.register(new StudioPromptStages.Stage(DIRECTOR_SCENE_VIEWS, StudioPromptEntry.IMAGE_MODEL, "导演台场景四视图",
                vars("style", "画面风格", "name", "场景名称", "description", "场景设定"), Set.of(), Map.of(),
                new LinkedHashMap<>(Map.of("style", "真人写实", "name", "周桂芬的小面馆", "description", "老街转角的小面馆，门在左侧，靠里是收银台。"))));
        registerDirectorVideo();
    }

    /**
     * 导演台交给视频模型的两份中文提示词（2026-11-11 从 DirectorPrompts 的代码搬进库，第 1 版与搬家前逐字一致）。
     * 谁在画面里、画内画外、切镜时间由代码算好传进来，这里只管怎么写。生成时记下版本，已生成的视频按那一版核对，换模板不算内容变化。
     */
    private static void registerDirectorVideo() {
        Map<String, Object> video = new LinkedHashMap<>();
        video.put("hasPeople", true);
        video.put("refs", List.of(Map.of("label", "图2", "name", "周桂芬", "isScene", false, "isProp", false, "isProduct", false, "isCharacter", true),
                Map.of("label", "图3", "name", "小面馆", "isScene", true, "isProp", false, "isProduct", false, "isCharacter", false)));
        video.put("characters", "周桂芬"); video.put("manyCharacters", false);
        video.put("grid", true); video.put("blanks", true); video.put("second", false); video.put("secondCells", List.of()); video.put("secondBlanks", false);
        video.put("cells", List.of(Map.of("position", "左上格", "no", 1), Map.of("position", "右上格", "no", 2)));
        video.put("style", "真人写实");
        video.put("shots", List.of(
                shot(1, "0", "3", "近景，平视，固定机位。", "周桂芬抬头看向门口。", "", "周桂芬", List.of(Map.of("narrator", false, "who", "周桂芬", "offscreen", false, "mute", false, "text", "谁啊？")), ""),
                shot(2, "3", "6", "中景，越过肩膀拍门口，镜头缓慢推近。", "门被推开一条缝。", "", "", List.of(), "")));
        video.put("hasSound", false); video.put("noDialogue", false); video.put("voices", List.of()); video.put("voiceDescs", List.of());
        StudioPromptStages.register(new StudioPromptStages.Stage(DIRECTOR_VIDEO, StudioPromptEntry.VIDEO_MODEL, "导演台片段视频",
                vars("hasPeople", "有参考图（写【人物】）", "refs", "参考图：[{label, name, isScene, isProp, isProduct, isCharacter}]",
                        "characters", "这一段有参考图的角色，用「和」连起来（没有为空）", "manyCharacters", "角色不止一个",
                        "grid", "分镜图是 2×2 宫格（不是单张画面）", "cells", "第一张宫格：[{position（左上格 / 右上格…）, no（第几镜）}]", "blanks", "第一张宫格有空着的格子",
                        "second", "有第二张宫格（AI 视频页长视频一段 5–8 镜）", "secondCells", "第二张宫格，同 cells", "secondBlanks", "第二张宫格有空着的格子",
                        "style", "画面风格",
                        "shots", "逐镜：[{no, start（本镜开始秒数）, end（本镜结束秒数）, framing（景别、机位，已补句号）, still, action, only（画面里只有这一个人时是名字，否则为空）, "
                                + "lines: [{narrator（没有说话人）, who, offscreen（在画外说）, mute（画外说时画面里的人嘴闭着）, text}], listeners（听着的人，顿号连起来）}]",
                        "hasSound", "要写【声音】", "noDialogue", "这一段没有台词", "voices", "声音参考：[{name, label（音频1…）}]", "voiceDescs", "音色描述：[{name, desc}]"),
                Set.of(), Map.of(), video));
        Map<String, Object> frame = new LinkedHashMap<>();
        frame.put("seconds", 5); frame.put("aspect", "9:16"); frame.put("style", "真人写实");
        frame.put("shots", List.of(Map.of("size", "近景", "camera", "固定机位", "action", "周桂芬抬头看向门口",
                "lines", List.of(Map.of("narrator", false, "speaker", "周桂芬", "text", "谁啊？")))));
        frame.put("voiceDescs", List.of(Map.of("name", "周桂芬", "desc", "五十岁的女声，嗓门大")));
        StudioPromptStages.register(new StudioPromptStages.Stage(DIRECTOR_VIDEO_FRAME, StudioPromptEntry.VIDEO_MODEL, "导演台首帧出片",
                vars("seconds", "片段秒数", "aspect", "画幅", "style", "画面风格", "shots", "逐镜：[{size, camera, action, lines: [{narrator（没有说话人）, speaker, text}]}]", "voiceDescs", "音色描述：[{name, desc}]"),
                Set.of(), Map.of(), frame));
    }

    private static Map<String, Object> shot(int no, String start, String end, String framing, String still, String action, String only,
                                            List<Map<String, Object>> lines, String listeners) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("no", no); m.put("start", start); m.put("end", end); m.put("framing", framing); m.put("still", still); m.put("action", action);
        m.put("only", only); m.put("lines", lines); m.put("listeners", listeners);
        return m;
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
                planVars(), Set.of("skill", "brief"), formats("output", StudioPromptFormats.PLAN_OUTPUT, "contracts", "", "appendix", ""), planSample()));
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
                Map.of(), Map.of("question", "哪张是正面")).withoutBase());
        StudioPromptStages.register(stage(IMAGE, StudioPromptEntry.IMAGE_MODEL, "画布出图包装",
                vars("prompt", "用户的出图指令", "identity", "只有一张参考图、用户也没自己点名参考图（加「保持同一个人」那句）",
                        "ordered", "有两张以上参考图（写参考图编号）", "refs", "参考图：[{n, note}]，note 没有有效说明时为空"),
                Set.of("prompt"), Map.of(), Map.of("prompt", "a red apple on a desk", "identity", true, "ordered", false,
                        "refs", List.of(Map.of("n", 1, "note", "人物设定图")))));
        // 复刻与拉片（§8 #10–#11）：画面素材是代码拼的多模态内容，这几个环节只放 system；material 只在后台预览里用
        StudioPromptStages.register(stage(RECREATION, StudioPromptEntry.LLM, "复刻全片拆解", vars("input", "用户补充关注点"), Set.of("input"),
                formats("output", StudioPromptFormats.RECREATION_OUTPUT, "contracts", "", "appendix", ""), Map.of("input", "开头怎么抓人")));
        StudioPromptStages.register(stage(RECREATION_OBSERVE, StudioPromptEntry.LLM, "复刻逐页观察", vars("first", "本页第一帧的全局编号", "last", "本页最后一帧的全局编号"),
                Set.of(), formats("output", StudioPromptFormats.OBSERVE_OUTPUT, "evidence", ""), Map.of("first", 1, "last", 8)).withoutBase());
        registerStepThreeRest();
        StudioPromptStages.register(stage(FILM_PLAN, StudioPromptEntry.LLM, "拉片分段", vars("material", "预览用的示例素材说明"), Set.of(),
                formats("output", StudioPromptFormats.FILM_PLAN_OUTPUT, "cap", ""), Map.of("material", "（全片文档与采样画面）")).withoutBase());
        StudioPromptStages.register(stage(FILM_SEGMENT, StudioPromptEntry.LLM, "拉片逐段分析", vars("material", "预览用的示例素材说明"), Set.of(),
                formats("output", StudioPromptFormats.FILM_SEGMENT_OUTPUT), Map.of("material", "（本段采样画面）")).withoutBase());
        StudioPromptStages.register(stage(VIDEO_BREAKDOWN, StudioPromptEntry.LLM, "拉片 · 直接看视频",
                vars("duration", "视频总长（秒）", "cuts", "代码检测到的切镜时间，已用顿号连好", "focus", "用户这次要做的（可空）"), Set.of("duration", "cuts"),
                formats("output", StudioPromptFormats.VIDEO_BREAKDOWN_OUTPUT), Map.of("duration", 14.2, "cuts", "2.1、3.9、5.9", "focus", "人物换成图1")).withoutBase());
        StudioPromptStages.register(stage(VIDEO_SHOT_DETAIL, StudioPromptEntry.LLM, "拉片 · 逐镜细读",
                vars("range", "这一小段在原片里的时间", "offset", "这一小段从原片第几秒开始", "shots", "这一小段里的镜头：[{no, range, visual（第一遍拉片的画面描述）}]"),
                Set.of("range", "shots"), formats("output", StudioPromptFormats.VIDEO_SHOT_DETAIL_OUTPUT),
                Map.of("range", "0–5.8 秒", "offset", "0", "shots", List.of(Map.of("no", 1, "range", "0–1.8 秒", "visual", "手从右侧伸出比框，镜头推向女生")))).withoutBase());
        Map<String, Object> compile = new LinkedHashMap<>();
        compile.put("requirement", "人物换成图1，杯子换成图2");
        compile.put("materials", List.of(Map.of("label", "图1", "title", "小美", "slot", "出镜人物"), Map.of("label", "图2", "title", "保温杯", "slot", "替换素材")));
        compile.put("breakdown", "（拉片文档）");
        compile.put("units", List.of(Map.of("no", 1, "range", "0–6 秒", "seconds", 6, "shots", "（这段的分镜表）",
                "refs", List.of(Map.of("label", "视频1", "what", "原片这一段"), Map.of("label", "图1", "what", "小美（出镜人物）")))));
        Map<String, Object> keyframe = new LinkedHashMap<>();
        keyframe.put("layout", "女生在画面中上部，离镜头约 5 米，身高只占画面高度的十分之一，正好夹在前景两根手指之间");
        keyframe.put("trick", "前景手指捏住远处很小的女生，随后镜头冲到她面前");
        keyframe.put("refs", List.of(Map.of("label", "图2", "what", "替换素材 4（替换素材）")));
        keyframe.put("instruction", "把画面里的女生换成图2里的女生，脸、发型和衣服按图2，大小和位置不变");
        StudioPromptStages.register(new StudioPromptStages.Stage(RECREATION_KEYFRAME, StudioPromptEntry.IMAGE_MODEL, "爆款复刻 · 改开场画面",
                vars("layout", "原片这一刻的构图（逐镜细读）", "trick", "这个镜头的看点（逐镜细读）", "refs", "图1 之后的参考图：[{label, what}]", "instruction", "写提示词的模型给的修改要求"),
                Set.of("instruction"), Map.of(), keyframe).withoutBase());
        // 检查要点和重出说明（2026-11-10 审查：原先写在 StudioRecreationTaskPlan / StudioSegmentedRun 里）
        StudioPromptStages.register(new StudioPromptStages.Stage(RECREATION_KEYFRAME_CHECK, StudioPromptEntry.MESSAGE, "爆款复刻 · 开场画面检查要点",
                vars(), Set.of(), Map.of(), Map.of()).withoutBase());
        StudioPromptStages.register(new StudioPromptStages.Stage(RECREATION_VIDEO_CHECK, StudioPromptEntry.MESSAGE, "爆款复刻 · 每段成片检查要点",
                vars("hasRefs", "这段有参考图", "keyframes", "这段的开场画面：[{shot（全片镜号）, at（这段里约第几秒起）, label（图N）}]",
                        "sameFrames", "这段里重复用的画面：[{shot, at, of（是哪一镜的开场）, label}]", "refs", "这段交给视频模型的图：[{label, what（开场画面 / 哪份素材）}]"), Set.of(), Map.of(),
                Map.of("hasRefs", true, "keyframes", List.of(Map.of("shot", 2, "at", "1.8", "label", "图2")))).withoutBase());
        StudioPromptStages.register(new StudioPromptStages.Stage(RECREATION_REDO_NOTE, StudioPromptEntry.IMAGE_MODEL, "爆款复刻 · 开场画面重出说明",
                vars("fix", "上一版没通过检查的问题"), Set.of("fix"), Map.of(), Map.of("fix", "人物还戴着原片的贝雷帽")).withoutBase());
        StudioPromptStages.register(stage(RECREATION_COMPILE, StudioPromptEntry.LLM, "爆款复刻 · 写每段视频提示词",
                vars("requirement", "用户写的要求", "materials", "替换素材：[{label, title, slot}]", "breakdown", "拉片文档（Markdown）",
                        "units", "分段：[{no, range（原片时间）, seconds（生成秒数）, shots（这段的分镜表）, refs:[{label, what}], keyframes:[{shot, label, detail}], sameFrames:[{shot, at, of, label}]（这一镜 at 秒的画面就是第 of 镜的开场画面）}]"),
                Set.of("breakdown", "units"), formats("output", StudioPromptFormats.RECREATION_COMPILE_OUTPUT), compile));
        // 深度复刻 / 元素替换：每段的视频1 是原片这一段（转成的动作参考 / 原片本身），没有开场画面（StudioCloneVideoPlan）
        for (String key : List.of(RECREATION_COMPILE_DEPTH, RECREATION_COMPILE_REPLACE))
            StudioPromptStages.register(stage(key, StudioPromptEntry.LLM, RECREATION_COMPILE_DEPTH.equals(key) ? "爆款复刻 · 深度复刻 · 写每段视频提示词" : "爆款复刻 · 元素替换 · 写每段视频提示词",
                    vars("requirement", "用户写的要求", "materials", "替换素材：[{label, title, slot}]", "breakdown", "拉片文档（Markdown）",
                            "units", "分段：[{no, range（原片时间）, seconds（生成秒数）, shots（这段的分镜表）, refs:[{label, what}]（视频1 是原片这一段）}]"),
                    Set.of("breakdown", "units"), formats("output", StudioPromptFormats.RECREATION_COMPILE_OUTPUT), compile));
    }

    /** 爆款复刻写每段提示词的环节：三种方式各一份（{@code StudioCloneVideoPlan}）。 */
    public static String recreationCompile(String method) {
        return switch (method == null ? "" : method) {
            case "depth" -> RECREATION_COMPILE_DEPTH;
            case "replacement" -> RECREATION_COMPILE_REPLACE;
            default -> RECREATION_COMPILE;
        };
    }

    static final String RECREATION = "stage-recreation", RECREATION_OBSERVE = "stage-recreation-observe",
            FILM_PLAN = "stage-film-study-plan", FILM_SEGMENT = "stage-film-study";
    /** 拉片 v2 与爆款复刻的提示词（docs/ip-studio-recreation.md「直接看视频的拉片」）。 */
    public static final String VIDEO_BREAKDOWN = "stage-video-breakdown", VIDEO_SHOT_DETAIL = "stage-video-shot-detail", RECREATION_COMPILE = "stage-recreation-compile",
            RECREATION_KEYFRAME = "stage-recreation-keyframe", RECREATION_KEYFRAME_CHECK = "stage-recreation-keyframe-check",
            RECREATION_VIDEO_CHECK = "stage-recreation-video-check", RECREATION_REDO_NOTE = "stage-recreation-redo-note",
            RECREATION_COMPILE_DEPTH = "stage-recreation-compile-depth", RECREATION_COMPILE_REPLACE = "stage-recreation-compile-replace";
    public static final String DIALOGUE_SKILL = "stage-dialogue-skill", DIALOGUE_PHASE = "stage-dialogue-phase", ANALYSIS_FOCUS = "stage-analysis-focus",
            VISION_BATCH = "stage-vision-batch", RECREATION_MERGE = "stage-recreation-merge";
    /** 复刻任务受理时一起冻结的环节：拆解、逐页观察、汇总、拉片分段、逐段分析、用户关注点、分批读图。 */
    public static final java.util.List<String> RECREATION_STAGES = java.util.List.of(RECREATION, RECREATION_OBSERVE, RECREATION_MERGE, FILM_PLAN, FILM_SEGMENT,
            ANALYSIS_FOCUS, VISION_BATCH, VIDEO_BREAKDOWN, VIDEO_SHOT_DETAIL);

    /** 方案规划的变量（对话的 propose_plan、文字任务、后台试跑三处共用）。阶段和预算那两句的说法在环节正文里，代码只给开关。 */
    private static Map<String, String> planVars() {
        return vars("skill", "制作做法正文", "analysisStage", "分析阶段（否则是制作阶段）", "constraints", "本阶段允许的操作与上限", "brief", "用户目标与补充",
                "analysis", "原片分析", "assets", "素材清单", "capabilities", "可用模型与合同", "dryRun", "后台试跑", "running", "已有进行中的制作",
                "approvedCap", "本阶段已批准的积分（没有批准就不给）", "feedback", "用户对上一版方案的反馈");
    }

    private static Map<String, Object> planSample() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("skill", "# 出视频"); out.put("analysisStage", false); out.put("constraints", "{}"); out.put("brief", "做一条 10 秒的商品展示");
        out.put("analysis", "（无）"); out.put("assets", "（无）"); out.put("capabilities", "[]"); out.put("dryRun", false); out.put("running", false);
        out.put("feedback", "（无）");
        return out;
    }

    /** 第 3 步零碎：原来在代码里拼的几段话（对话的方法 / 阶段说明、拉片复刻的关注点、分批读图、复刻汇总）。 */
    private static void registerStepThreeRest() {
        Map<String, Object> skill = new LinkedHashMap<>();
        skill.put("bound", true); skill.put("name", "出视频"); skill.put("version", 3); skill.put("body", "# 出视频\n……");
        skill.put("skills", List.of(Map.of("key", "image-generation", "name", "出图", "direct", true, "summary", "按描述出图")));
        StudioPromptStages.register(stage(DIALOGUE_SKILL, StudioPromptEntry.MESSAGE, "对话里的方法说明",
                vars("bound", "已经选定方法", "name", "选定方法的名称", "version", "选定方法的版本", "body", "选定方法的正文",
                        "skills", "其它可换的方法：[{key, name, direct（没有分析阶段）, summary}]"), Set.of(), Map.of(), skill));
        Map<String, Object> phase = new LinkedHashMap<>();
        phase.put("started", true); phase.put("production", true); phase.put("direct", true); phase.put("operations", "image、video"); phase.put("execution", "");
        StudioPromptStages.register(stage(DIALOGUE_PHASE, StudioPromptEntry.MESSAGE, "对话里的阶段说明",
                vars("started", "已经选定方法、进入了某个阶段", "production", "是制作阶段", "direct", "方法没有分析阶段", "operations", "本阶段可用的收费操作（已用顿号连好）",
                        "execution", "后台制作的一句话进度（服务端记录），没有为空"), Set.of(), Map.of(), phase));
        StudioPromptStages.register(stage(ANALYSIS_FOCUS, StudioPromptEntry.MESSAGE, "拉片 / 复刻的用户关注点", vars("focus", "用户写的分析重点"),
                Set.of("focus"), Map.of(), Map.of("focus", "开头怎么抓人")));
        StudioPromptStages.register(stage(VISION_BATCH, StudioPromptEntry.LLM, "读图降级：分批读取", vars("merge", "汇总时（否则是每批读图）"), Set.of(),
                formats("output", StudioPromptFormats.VISION_BATCH_OUTPUT), Map.of("merge", false)).withoutBase());
        StudioPromptStages.register(stage(RECREATION_MERGE, StudioPromptEntry.MESSAGE, "复刻汇总时的事实整合与尾帧复核",
                vars("frameTimes", "全部采样帧的时间（JSON）", "observations", "逐页读到的事实（JSON）", "lastFrame", "最后一帧的全局编号"),
                Set.of("observations"), Map.of(), Map.of("frameTimes", "[0.0, 1.2]", "observations", "[]", "lastFrame", 2)));
    }

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

    static final String SCENE_IMAGE = "stage-scene-image", SCENE_HANDOFF = "stage-scene-handoff", SCENE_SCRIPT = "stage-scene-script",
            SCENE_VARIABLES = "stage-scene-variables";

    private static StudioPromptStages.Stage sceneImage() {
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("free", "自由出图（没有场景描述，只有用户写的那句）");
        vars.put("extra", "用户写的补充要求");
        vars.put("custom", "用户改过的完整描述，没改为空");
        vars.put("options", "选中的选项：[{label, prompt}]");
        vars.put("materials", "每个放了图的素材位：[{photos, role}]，比如 photos=图2、图3，role=要穿上的上身或全身服装");
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
        vars.put("revising", "这是改稿（有修改意见、设置变了，或是「视频裂变」的改写版）");
        vars.put("hasVariant", "这是「视频裂变」里 AI 改写的一版");
        vars.put("variantIndex", "第几版（从 1 起）");
        vars.put("variantTotal", "共几版");
        vars.put("hasChanges", "这一版有指定要换的变量");
        vars.put("changes", "这一版要换的变量：[{name, from, to}]");
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
        formats.put("output", v -> SCENE_SCRIPT_OUTPUT);
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

    /** 「视频裂变」找变量：只读当前脚本，正文每行一个变量，页面解析（scene-video-takes.ts parseTakeVariables）。 */
    private static StudioPromptStages.Stage sceneVariables() {
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("sceneTitle", "场景名称");
        vars.put("duration", "时长（秒）");
        vars.put("orientation", "竖屏 / 横屏");
        vars.put("current", "当前脚本（JSON 字符串）");
        Map<String, Function<Map<String, ?>, String>> formats = new LinkedHashMap<>();
        formats.put("output", v -> VARIABLES_OUTPUT);
        Map<String, Object> sample = new LinkedHashMap<>();
        sample.put("sceneTitle", "口播带货"); sample.put("duration", 15); sample.put("orientation", "竖屏");
        sample.put("current", "\"一、剧情概述：宝妈小林在厨房里用卸妆膏三秒卸掉防水睫毛膏……\"");
        return new StudioPromptStages.Stage(SCENE_VARIABLES, StudioPromptEntry.LLM, "AI 视频 · 视频裂变找变量", vars,
                Set.of("current"), formats, sample);
    }

    /** 每行「名称｜原文｜替换1｜替换2｜替换3」：页面按这个拆，原文不在脚本里的那行丢掉。 */
    static final String VARIABLES_OUTPUT = "只输出一个 JSON 对象 {\"summary\":\"一句话说找到了几处、主要换什么\",\"content\":\"变量清单\"}，不要代码围栏。"
            + "content 每行一个变量，格式：名称｜原文｜替换1｜替换2｜替换3，用全角竖线分隔，不编号、不加表头；一个都找不到就只写「无」。";

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

    static final String SCENE_SCRIPT_OUTPUT = "只输出一个 JSON 对象 {\"summary\":\"一句话说明这一版的思路\",\"content\":\"完整脚本正文\","
            + "\"suggestions\":[{\"label\":\"简短按钮文案\",\"instruction\":\"用户可直接发送的完整修改意见\"}]}，不要代码围栏；"
            + "suggestions 最多 3 条，label 为 2 到 8 个字，instruction 不超过 80 个字，两者均为单行文字；"
            + "只建议基于这版脚本、用户要求和已有素材的具体可选改法，方向互不重复，不重复刚完成的修改，不新增未经提供的事实；"
            + "建议用用户的口吻表达，不提问、不承诺已修改，不把建议写进 content 或 summary。没有合适建议时返回空数组。"
            + "不输出 steps、shots 或工具指令；不要声称已经保存或生成视频。";

    static final String OUTPUT = "只输出一个 JSON 对象 {\"summary\":\"一句话说明这一版的思路\",\"content\":\"完整脚本正文\"}，不要代码围栏；"
            + "不输出 steps、shots 或工具指令；不要声称已经保存或生成视频。";

    static final String ATTACHMENTS = "本次另附带精确节点 ID 标记的真实图片与视频采样帧。视频只有四个时间点的静态画面，不包含音轨，不代表全部连续动作；"
            + "音频节点只提供文字设定。只根据收到的画面及文字作答，不臆测未提供的声音或片段，保持 JSON 输出契约。";

    /**
     * 镜头写法（docs/studio-prompt-architecture.md §9.4）：H3 改写认「第N镜（起 秒」和「名字说：「」」；给一个照抄就对的例子
     * （2026-10-31 本地 Agnes 照「起–止」模板把这几个字抄进了括号），例子里的秒数按时长算、不超过总时长。
     * 2026-11-04 从一行字段改成一块：线上手表脚本里模型照「画面：……；景别：……；音效：……」填短语，一镜只有几十个字；
     * 说话人不带编号（「博主（图2）说：「」认不出，「图2的博主」和「博主」会算成两个人）。
     * 2026-11-09：例子改成一镜 4 秒（客户反馈和 Seedance 社区经验），表演先写神情和语气（客户说成片像念稿子）。
     */
    static String shots(Map<String, ?> vars) {
        int d = vars.get("duration") instanceof Number n ? Math.max(1, n.intValue()) : 15;
        int a = Math.min(4, d), b = Math.min(8, d);
        StringBuilder out = new StringBuilder("每个镜头按下面这样写一块，「第N镜」顶格开头：\n");
        out.append("第1镜（0–").append(a).append(" 秒）这一镜的作用：痛点截停\n");
        out.append("摄影：景别、机位、运镜、构图和焦点。\n");
        out.append("表演：博主……的神情和语气，一两个动作，物件随之怎么变。\n");
        out.append("博主说：「……」\n");
        out.append("声音：听得到的具体声音，配乐怎么衬这句话；不要配乐就写无配乐。\n");
        out.append("转场：怎么接下一镜。\n");
        if (b > a) out.append("第2镜（").append(a).append("–").append(b).append(" 秒）这一镜的作用：……\n（同上）\n");
        out.append("括号里只写起止秒数，第1镜从 0 秒开始，每一镜接着上一镜；所有镜头加起来正好 ").append(d).append(" 秒，最后一个镜头补到 ").append(d).append(" 秒整。\n");
        out.append("全片台词最多 ").append(d * 4).append(" 个字，每镜最多「这一镜秒数 × 4」个字，先定台词再定秒数；放不下就删句子，不要压缩时长。\n");
        out.append("台词单独一行，只写名字，全片同一个人用同一个名字：有人说话写「名字说：「台词」」，画面外的人说写「名字在画外说：「……」」，旁白写「旁白说：「……」」；没有台词就不写这一行。台词只用「」这种引号，一句一个「」，里面不再套引号。");
        return out.toString();
    }
}
