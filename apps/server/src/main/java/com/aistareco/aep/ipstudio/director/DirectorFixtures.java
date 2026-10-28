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
                int count = Math.max(1, meta.path("paragraphCount").asInt(1));
                ArrayNode episodes = out.putArray("episodes");
                if (count < 4) episodes.addObject().put("title", "红信封").put("summary", "林夏在旧书店发现写给自己的信。")
                        .put("startParagraph", 0).put("endParagraph", count - 1);
                else {
                    int half = count / 2;
                    episodes.addObject().put("title", "红信封").put("summary", "林夏在旧书店发现写给自己的信。")
                            .put("startParagraph", 0).put("endParagraph", half - 1);
                    episodes.addObject().put("title", "门外的人").put("summary", "敲门声响起，林夏回头。")
                            .put("startParagraph", half).put("endParagraph", count - 1);
                }
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
                ObjectNode clip = clips.addObject().put("title", "发现信封").put("summary", "林夏拿起桌上的红信封，听到敲门声后回头。")
                        .put("sourceQuote", "林夏推开旧书店的木门走进来");
                ArrayNode clipIds = clip.putArray("assetIds");
                ids.forEach(clipIds::add);
                ArrayNode shots = clip.putArray("shots");
                for (String[] s : first) {
                    ObjectNode shot = shots.addObject().put("durationSec", 3).put("size", s[0]).put("camera", s[1]).put("action", s[2]).put("still", s[3]);
                    ArrayNode d = shot.putArray("dialogue");
                    if (!s[4].isEmpty()) d.addObject().put("speakerId", speaker).put("text", s[4]);
                }
            }
            case "assistant" -> assistant(om, meta, out);
            case "brief" -> {
                // 第一轮问两个问题，之后（或到上限）整理成要求；只为本地走通流程。
                if (meta.path("round").asInt(1) <= 1 && !meta.path("mustConclude").asBoolean(false)) {
                    out.put("reply", "（测试响应）这个开头有意思。先定两件事，其他我来补。").put("ready", false);
                    ArrayNode qs = out.putArray("questions");
                    qs.addObject().put("q", "想让观众看完是什么感觉？").putArray("options").add("细思极恐").add("温情治愈").add("反转爽感");
                    qs.addObject().put("q", "篇幅大概多长？").putArray("options").add("1 集 60 秒").add("3 集，每集 60–90 秒").add("5 集以上");
                } else {
                    out.put("reply", "（测试响应）够了，我把要求整理好了，可以开始写剧本。").put("ready", true).putArray("questions");
                    out.put("summary", "按用户的想法写；调性和篇幅按用户的回答，其余按最适合这个故事的方式补齐（默认）。").put("tone", "细思极恐").put("title", "");
                }
            }
            default -> { }
        }
        return out;
    }

    /** 助手的固定回复：问句只给方向，要求修改时按本轮允许的类型给一条能真正采用的建议（原文取自发送时记下的样本）。 */
    private static void assistant(ObjectMapper om, JsonNode meta, ObjectNode out) {
        String message = meta.path("message").asText("");
        List<String> allowed = new ArrayList<>();
        meta.path("allowed").forEach(x -> allowed.add(x.asText()));
        ArrayNode proposals = out.putArray("proposals");
        // 问句（怎么 / 哪里 / 为什么 / 吗 / 问号结尾）当讨论，其余当修改要求；真实模型自己判断，这里只为走通流程。
        boolean edit = !message.matches("(?s).*([？?]\\s*$|怎么样|哪里|为什么|吗[？?。]?\\s*$).*");
        if (!edit || allowed.isEmpty()) {
            out.put("reply", "（测试响应）可以从三个方向考虑：一是把异常提前，让观众第一眼就看到；二是让配角的反应更克制，留出悬念；三是结尾留一个没解释的细节。想改哪一处，直接告诉我。");
            return;
        }
        out.put("reply", "（测试响应）保留原有设定，只调整你说的这一处：");
        String sample = meta.path("fixtureSample").asText("");
        String target = meta.path("scriptTargets").path(0).asText(null);
        if (allowed.contains("script.draft")) {
            proposals.addObject().put("type", "script.draft").put("title", "旧书店的红信封").put("logline", "林夏在旧书店找到一封写给自己的信。")
                    .put("content", "## 第1场 旧书店 · 夜\n林夏推开木门，桌上放着一个暗红色信封。\n林夏：这么晚了，怎么还有人留东西？\n她翻到背面，封口写着自己的名字。")
                    .put("note", "按讨论写出第一版剧本");
        } else if (allowed.contains("script.append") && message.contains("续写") && target != null) {
            proposals.addObject().put("type", "script.append").put("target", target).put("text", "门外安静了很久。林夏把信封贴在胸口，慢慢走过去拉开门。").put("note", "接着结尾续写一段");
        } else if (allowed.contains("script.replace") && target != null && !sample.isBlank()) {
            proposals.addObject().put("type", "script.replace").put("target", target).put("original", sample)
                    .put("replacement", sample + "\n他停了一下，没再往下说。").put("note", "在这段后面加一个停顿，语气更含蓄");
        } else if (allowed.contains("clip.shots") && meta.path("clipIds").size() > 0) {
            String clipId = meta.path("clipIds").path(0).asText();
            ArrayNode shots = meta.path("before").path("clips").path(clipId).path("shots").deepCopy();
            if (shots.size() > 0) {
                ObjectNode first = (ObjectNode) shots.get(0);
                first.put("size", "特写").put("still", "手部特写：" + first.path("still").asText());
                first.remove("startSec"); first.remove("endSec");
                for (int i = 1; i < shots.size(); i++) { ((ObjectNode) shots.get(i)).remove("startSec"); ((ObjectNode) shots.get(i)).remove("endSec"); }
                ObjectNode p = proposals.addObject().put("type", "clip.shots").put("clipId", clipId).put("note", "第 1 镜改成手部特写，其他镜头不变");
                p.set("shots", shots);
            }
        } else if (allowed.contains("clip.prompt") && meta.path("clipIds").size() > 0) {
            String clipId = meta.path("clipIds").path(0).asText();
            String which = meta.path("which").path(0).asText("video");
            JsonNode before = meta.path("before").path("clips").path(clipId);
            proposals.addObject().put("type", "clip.prompt").put("clipId", clipId).put("which", which)
                    .put("text", before.path(which).asText() + "\n第 3 格改为近景，其他人物和场景保持一致。")
                    .put("regenerate", "board".equals(which)).put("note", "第 3 格改近景");
        } else if (allowed.contains("asset.update") && meta.path("assetIds").size() > 0) {
            String assetId = meta.path("assetIds").path(0).asText();
            JsonNode before = meta.path("before").path("assets").path(assetId);
            boolean image = "image".equals(meta.path("scopeKind").asText());
            ObjectNode p = proposals.addObject().put("type", "asset.update").put("assetId", assetId).put("note", "神情更疲惫，但不显老");
            String extra = "神情疲惫，眼下有淡淡的青色，但皮肤状态不显老。";
            if (image) p.put("prompt", before.path("prompt").asText() + extra).put("regenerate", true);
            else p.put("description", before.path("description").asText() + extra);
        }
    }
}
