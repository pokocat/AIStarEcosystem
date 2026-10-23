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
            case "script" -> out.put("title", "旧书店的红信封").put("logline", "林夏在旧书店找到一封写给自己的信。")
                    .put("content", """
                            ## 第1场 旧书店 · 夜
                            林夏推开旧书店的木门走进来，店里只亮着桌上一盏灯。中央木桌上放着一个暗红色信封。
                            林夏：这么晚了，怎么还有人留东西？
                            她拿起信封，翻到背面，看见封口写着自己的名字。

                            ## 第2场 旧书店 · 夜
                            身后的门被轻轻敲了一下。林夏握紧信封，回头看向门口。
                            林夏：谁在外面？
                            门外没有回答，只有风声。
                            """);
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
            default -> { }
        }
        return out;
    }
}
