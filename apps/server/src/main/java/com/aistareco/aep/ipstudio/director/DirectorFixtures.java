package com.aistareco.aep.ipstudio.director;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.List;

/**
 * 测试响应（{@code aep.ipstudio.fixture-enabled=true}）下导演台文字任务的确定性产物：零成本、run 标 mock，
 * 只用于本地走通流程，不冒充真实模型（§8.0）。产物仍走 {@link DirectorPrompts#validate}。
 */
public final class DirectorFixtures {
    private DirectorFixtures() {}

    public static JsonNode output(ObjectMapper om, JsonNode meta) {
        ObjectNode out = om.createObjectNode();
        switch (meta.path("task").asText()) {
            case "script" -> {
                out.put("title", "旧书店的红信封").put("logline", "林夏在旧书店找到一封写给自己的信。");
                ObjectNode o = out.putObject("outline").put("world", "老城区一家快关门的旧书店，夜里十点后店里的信会自己出现。")
                        .put("plot", "起：林夏收到写给自己的信。承：信里写着明天会发生的小事。转：信的笔迹是她自己的。合：她决定给过去的自己回信。")
                        .put("reversals", "第 2 集：敲门的人不在门外；伏笔是第 1 集桌上那盏一直亮着的灯。")
                        .put("theme", "没说出口的道歉，晚一点说也算数。");
                o.putArray("characters").addObject().put("name", "林夏").put("age", "28").put("identity", "书店夜班店员")
                        .put("secret", "三年前没能参加父亲的葬礼").put("flaw", "嘴笨，一紧张就抠手指").put("arc", "从逃避到主动回信");
                out.put("content", """
                            ## 第1场 旧书店 · 夜
                            林夏推开旧书店的木门走进来，店里只亮着桌上一盏灯。中央木桌上放着一个暗红色信封。
                            林夏：这么晚了，怎么还有人留东西？
                            她拿起信封，翻到背面，看见封口写着自己的名字。

                            ## 第2场 旧书店 · 夜
                            身后的门被轻轻敲了一下。林夏握紧信封，回头看向门口。
                            林夏：谁在外面？
                            门外没有回答，只有风声。
                            """);
            }
            case "split" -> {
                // 与真模型同一个契约：只给每集起点和正文起点，区间由程序构造。
                int count = Math.max(1, meta.path("paragraphCount").asInt(1));
                out.put("bodyStart", 0);
                ArrayNode episodes = out.putArray("episodes");
                episodes.addObject().put("title", "红信封").put("summary", "林夏在旧书店发现写给自己的信。").put("startParagraph", 0);
                if (count >= 4) episodes.addObject().put("title", "门外的人").put("summary", "敲门声响起，林夏回头。").put("startParagraph", count / 2);
            }
            case "extract" -> {
                ArrayNode assets = out.putArray("assets");
                List<Integer> nos = new ArrayList<>();
                meta.path("episodeNos").forEach(n -> nos.add(n.asInt()));
                Object[][] sample = {
                        {"character", "林夏", "约28岁的东亚女性，椭圆脸，黑色齐肩直发，右眉尾有一颗小痣；穿米色短外套、白色内搭。"},
                        {"scene", "旧书店", "长方形房间，北墙整面深木色书架，东墙一扇木门，西墙一扇窗，中央一张长方形木桌；夜晚桌上一盏暖灯。"},
                        {"prop", "红信封", "信纸大小的暗红色哑光纸信封，背面三角形封口，闭合，无文字或图案。"}};
                for (Object[] s : sample) {
                    ObjectNode a = assets.addObject().putNull("existingId").put("kind", (String) s[0]).put("name", (String) s[1])
                            .put("description", (String) s[2]);
                    a.putArray("aliases");
                    ArrayNode e = a.putArray("episodeNos");
                    nos.forEach(e::add);
                }
            }
            case "plan" -> {
                List<String> ids = new ArrayList<>();
                meta.path("assetIds").forEach(x -> ids.add(x.asText()));
                String speaker = meta.path("characterIds").path(0).asText(null);
                ArrayNode clips = out.putArray("clips");
                String[][] first = {
                        {"中景", "西南角平视，木桌和门都在画面里", "林夏从门口走向木桌，停在桌前", "林夏站在桌前，桌上一个红信封", ""},
                        {"近景", "桌子西侧拍手部", "右手伸向信封，抓住并拿起", "右手刚把信封拿离桌面", ""},
                        {"中近景", "西南侧", "她用右手翻转信封，低头看背面", "信封背面朝向她，她低头看", "这么晚了，怎么还有人留东西？"},
                        {"中景", "西南侧，门在画面右侧", "她停住，慢慢回头看门", "她回头看门，右手仍握着信封", "谁在外面？"}};
                ObjectNode clip = clips.addObject().put("title", "发现信封").put("summary", "林夏拿起桌上的红信封，听到敲门声后回头。");
                ArrayNode clipIds = clip.putArray("assetIds");
                ids.forEach(clipIds::add);
                ArrayNode shots = clip.putArray("shots");
                for (String[] s : first) {
                    ObjectNode shot = shots.addObject().put("durationSec", 3).put("size", s[0]).put("camera", s[1]).put("action", s[2]).put("still", s[3]);
                    ArrayNode d = shot.putArray("dialogue");
                    if (!s[4].isEmpty()) d.addObject().put("speakerId", speaker).put("text", s[4]);
                }
            }
            case "videoPrompt" -> {
                // 视频提示词改写：每镜一句画面，台词按占位原样放回，由 DirectorH3Rewrite 组装成 H3 格式。
                out.put("subject_definitions", "<Subject 1> is the character shown in <Picture 2>.")
                        .put("summary", "[reference generation] A short test clip that follows the storyboard in <Picture 1>.")
                        .put("retention_analysis", "<Subject 1> (appears in [Shot 1]): fully_preserved - appearance from <Picture 2>.")
                        .put("style", "Live-action, test footage.")
                        .put("overall_soundscape", "Quiet room tone.").put("non_diegetic_music", "N/A");
                int n = Math.max(1, meta.path("shots").asInt(1));
                List<String> lines = new ArrayList<>();
                meta.path("lines").forEach(l -> lines.add(l.path("id").asText()));
                for (int i = 0; i < n; i++) {
                    StringBuilder b = new StringBuilder(i == 0 ? "A medium shot of <Subject 1>." : "the camera cuts to <Subject 1>.");
                    for (int j = i; j < lines.size(); j += n) b.append(" <Subject 1> says: {{").append(lines.get(j)).append("}}");
                    out.put("shot_" + (i + 1), b.toString());
                }
            }
            default -> { }
        }
        return out;
    }
}
