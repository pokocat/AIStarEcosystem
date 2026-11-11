package com.aistareco.aep.ipstudio.director;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 视频提示词第 4 版和首帧出片提示词搬进提示词库（stage-director-video / stage-director-video-frame）之前的代码，原样保留，
 * 只给 {@link DirectorVideoPromptStageParityTest} 核对「库里第 1 版和搬家前逐字一致」用（不一致会让已采用的视频被标成需更新）。
 */
final class CodedDirectorVideoPrompts {
    private CodedDirectorVideoPrompts() {}

    private static final String[] CELL_ORDER = {"左上格", "右上格", "左下格", "右下格"};

    static String videoPrompt(JsonNode settings, JsonNode clip, List<DirectorPrompts.Ref> refs, java.util.Map<String, String> speakerNames,
                                     List<DirectorPrompts.VoiceRef> voices, List<String> unvoiced, java.util.Map<String, String> voiceDescs,
                                     java.util.Map<String, List<String>> aliases, int maxShots) {
        String style = settings.path("style").asText("真人写实");
        JsonNode shots = clip.path("shots");
        int n = Math.min(shots.size(), maxShots);
        boolean grid = DirectorPrompts.boardLayout(shots.size())[0] == 2;
        List<String> characters = new ArrayList<>();
        StringBuilder people = new StringBuilder();
        for (DirectorPrompts.Ref r : refs) {
            switch (r.kind()) {
                case "scene" -> people.append("场景「").append(r.name()).append("」：空间布局和光源位置照参考").append(r.label()).append("。\n");
                case "prop" -> people.append("道具「").append(r.name()).append("」：外观照参考").append(r.label()).append("。\n");
                case "product" -> people.append("商品「").append(r.name()).append("」：外观、包装和标签照参考").append(r.label()).append("。\n");
                default -> {
                    characters.add(r.name());
                    people.append(r.name()).append("：长相、发型和衣服照参考").append(r.label()).append("。\n");
                }
            }
        }
        if (!characters.isEmpty())
            people.append(String.join("和", characters)).append(characters.size() > 1 ? "在画面里各只出现一个" : "在画面里只出现一个")
                    .append("，长相和衣服从头到尾保持一致。\n");
        StringBuilder b = new StringBuilder();
        if (!people.isEmpty()) b.append("【人物】\n").append(people).append('\n');
        b.append("【分镜参考】\n");
        if (grid) {
            b.append("参考图1 是 2×2 分镜：");
            for (int i = 0; i < Math.min(n, DirectorPrompts.MAX_SHOTS); i++) b.append(i > 0 ? "，" : "").append(CELL_ORDER[i]).append("对应第").append(i + 1).append("镜");
            if (n < 4) b.append("，其余格子是空的");
            if (n > DirectorPrompts.MAX_SHOTS) {
                b.append("。参考图2 是 2×2 分镜：");
                for (int i = DirectorPrompts.MAX_SHOTS; i < n; i++) b.append(i > DirectorPrompts.MAX_SHOTS ? "，" : "").append(CELL_ORDER[i - DirectorPrompts.MAX_SHOTS]).append("对应第").append(i + 1).append("镜");
                if (n < DirectorPrompts.MAX_SHOTS * 2) b.append("，其余格子是空的");
            }
            b.append("。每格参考构图、机位和人物位置，人物的受光、肤色和画面整体色调也照对应的格子，每一镜都是一个完整的全屏画面。\n\n");
        } else {
            b.append("参考图1 是这一段的分镜画面，参考它的构图、机位和人物位置，人物的受光、肤色和画面整体色调也照它，视频是一个完整的全屏画面。\n\n");
        }
        b.append("【画面】\n").append(style).append("风格，画面里没有字幕。\n");
        boolean anyLine = false;
        double t = 0;
        for (int i = 0; i < n; i++) {
            JsonNode s = shots.get(i);
            double end = t + s.path("durationSec").asDouble();
            b.append("第").append(i + 1).append("镜（").append(i == 0 ? "0–" + fmt(end) + " 秒" : fmt(t) + " 秒切").append("）：");
            b.append(sentence(s.path("size").asText() + (s.path("camera").asText().isBlank() ? "" : "，" + s.path("camera").asText())));
            b.append(sentence(s.path("still").asText())).append(sentence(s.path("action").asText()));
            DirectorPrompts.Cast cast = DirectorPrompts.castOfShot(s, DirectorPrompts.castPool(characters, s, speakerNames), aliases);
            if (cast.on().size() == 1 && cast.unsure().isEmpty()) b.append("画面里只有").append(cast.on().get(0)).append("。");
            Set<String> speaking = new HashSet<>();
            for (JsonNode line : s.path("dialogue")) {
                anyLine = true;
                String who = line.path("speakerId").isTextual() ? speakerNames.get(line.path("speakerId").asText()) : null;
                // 画外只在「画面里认出了别人、说话人一个称呼都没出现」时写；分不清的不写画内画外，也不要求谁闭嘴。
                boolean offscreen = who == null || !cast.on().contains(who) && !cast.unsure().contains(who) && !cast.on().isEmpty();
                if (who != null && cast.on().contains(who)) speaking.add(who);
                b.append(who == null ? "旁白" : who).append(offscreen ? "在画外说：「" : "说：「").append(line.path("text").asText()).append("」");
                b.append(offscreen && !cast.on().isEmpty() ? "画面里的人嘴闭着。" : "");
            }
            List<String> listeners = cast.on().stream().filter(who -> !speaking.contains(who)).toList();
            if (!speaking.isEmpty() && !listeners.isEmpty()) b.append(String.join("、", listeners)).append("听着，嘴闭着。");
            if (i == n - 1) b.append("最后保持这个画面到结束。");
            b.append('\n');
            t = end;
        }
        StringBuilder sound = new StringBuilder();
        if (!anyLine) sound.append(DirectorPrompts.NO_DIALOGUE).append('\n');
        for (DirectorPrompts.VoiceRef v : voices) sound.append("声音参考：").append(v.name()).append("的音色、口音照").append(v.label()).append("。\n");
        voiceDescs.forEach((name, desc) -> sound.append(name).append("的音色：").append(desc).append("\n"));
        // 没内容就不写这一段：空标题也是一句可能被 H3 念出来的中文（cl45 第 4 版试跑时发现）。
        if (!sound.isEmpty()) b.append("\n【声音】\n").append(sound);
        b.append("\n【配乐】\n无");
        return b.toString();
    }

    static String framePrompt(JsonNode settings, JsonNode clip, java.util.Map<String, String> speakerNames, java.util.Map<String, String> voiceDescs) {
        String style = settings.path("style").asText("真人写实");
        String aspect = settings.path("aspectRatio").asText("9:16");
        StringBuilder b = new StringBuilder();
        b.append("以首帧画面为起点，生成 ").append(clip.path("durationSec").asInt()).append(" 秒、").append(aspect).append("、").append(style)
                .append("风格的剧情片段。保持首帧里的人物、服装、场景和道具不变，不切换到别的画面。\n");
        for (JsonNode s : clip.path("shots")) {
            b.append(s.path("size").asText()).append("，").append(s.path("camera").asText()).append("。").append(s.path("action").asText()).append("\n");
            for (JsonNode line : s.path("dialogue")) {
                String speaker = speakerNames.getOrDefault(line.path("speakerId").asText(), "旁白");
                b.append("  ").append(speaker).append("说：“").append(line.path("text").asText()).append("”\n");
            }
        }
        voiceDescs.forEach((name, desc) -> b.append(name).append(" 的音色：").append(desc).append("\n"));
        b.append("只说上面列出的台词，不增加人物或剧情，不生成字幕。");
        return b.toString();
    }

    private static String sentence(String s) {
        String t = s == null ? "" : s.strip();
        if (t.isEmpty()) return "";
        return "。！？!?；…".indexOf(t.charAt(t.length() - 1)) >= 0 ? t : t + "。";
    }

    private static String fmt(double v) {
        return v == Math.floor(v) ? String.valueOf((int) v) : String.valueOf(v);
    }
}
