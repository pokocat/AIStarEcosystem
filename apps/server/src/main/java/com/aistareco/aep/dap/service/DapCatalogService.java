package com.aistareco.aep.dap.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 平台目录（只读配置数据）：内置 AI 音色 / 场景库 / 美化模板 / 下游应用 / 公开数字人。
 * 与前端 mock（apps/web-aiavatar/src/proto/data.ts）保持同形同值，作为 live 模式的 wire 真源。
 */
@Service
public class DapCatalogService {

    /** 内置 AI 合成音色（规格 §6.2，女 4 + 男 3）。 */
    public List<Map<String, Object>> builtinVoices() {
        return List.of(
                voice("warm_f", "亲和邻家女声", "female", "中频柔和 · 尾音轻扬 · 语速舒缓",
                        List.of("电商导购", "美妆", "母婴科普", "短视频口播"),
                        "请以 25–30 岁年轻女性声线合成：中频柔和温暖，尾音轻微上扬，语速舒缓亲切，如邻家姐姐般自然不做作，带轻微微笑感、适度口语化。"),
                voice("news_f", "新闻播报女声", "female", "声线厚重 · 吐字规整 · 语调平稳",
                        List.of("财经播报", "政务科普", "知识资讯", "企业解说"),
                        "请以成熟女性播音声线合成：声线厚重沉稳，吐字规整清晰，语调平稳有权威感，节奏匀速，专业客观。"),
                voice("elegant_f", "御姐优雅女声", "female", "低频饱满 · 语速偏慢 · 发音圆润",
                        List.of("奢侈品", "文旅", "品牌宣传片", "高端课程"),
                        "请以 30+ 成熟女性声线合成：低频饱满，语速偏慢，发音圆润，气质优雅从容，尾音略带磁性。"),
                voice("sweet_f", "少女甜嗓", "female", "高频清亮 · 气息轻快",
                        List.of("游戏虚拟形象", "早教", "零食带货"),
                        "请以 18–22 岁少女声线合成：高频清亮，气息轻快灵动，语调上扬俏皮，充满活力与亲和力。"),
                voice("deep_m", "沉稳大叔低音", "male", "胸腔共鸣强 · 轻微颗粒感",
                        List.of("金融理财", "房产", "法律科普", "企业旁白"),
                        "请以 40+ 成熟男性声线合成：胸腔共鸣强，低音浑厚，带轻微颗粒质感，语速从容，沉稳可信。"),
                voice("fresh_m", "青年清爽男声", "male", "中音通透 · 自然口语",
                        List.of("数码测评", "职场课程", "日常探店"),
                        "请以 25 岁年轻男性声线合成：中音通透干净，自然口语化，语速适中，亲切阳光，不做作。"),
                voice("anchor_m", "播音正经男声", "male", "字正腔圆 · 节奏规整",
                        List.of("新闻", "公考教学", "官方公告播报"),
                        "请以专业男性播音声线合成：字正腔圆，节奏规整，语调端正有公信力，吐字铿锵，权威庄重。"));
    }

    private static Map<String, Object> voice(String id, String name, String gender, String traits,
                                             List<String> scenes, String prompt) {
        return Map.of("id", id, "name", name, "gender", gender, "traits", traits,
                "scenes", scenes, "prompt", prompt);
    }

    /** 平台预置场景库（设计新造型 → 场景替换）。promptEn 供生成引擎使用。 */
    public List<Map<String, Object>> scenes() {
        return List.of(
                scene("s1", "办公玻璃幕墙", "key", "calm",
                        "modern office with floor-to-ceiling glass walls, city skyline behind, soft daylight, professional atmosphere"),
                scene("s2", "书架暖光", "threeq", "smile",
                        "cozy study room with warm bookshelf background, soft tungsten lighting, shallow depth of field"),
                scene("s3", "米色针织", "side", "calm",
                        "wearing a beige knit sweater, minimal light-gray studio background, soft diffused lighting"),
                scene("s4", "彩色背景墙", "look", "smile",
                        "vivid colorful gradient background wall, trendy fashion editorial lighting"),
                scene("s5", "直播间", "key", "serious",
                        "e-commerce livestream studio with ring light, product shelves behind, bright even lighting"),
                scene("s6", "咖啡馆", "threeq", "calm",
                        "warm cafe interior, blurred espresso bar in background, window daylight, lifestyle photography"));
    }

    private static Map<String, Object> scene(String id, String name, String variant, String expr, String promptEn) {
        return Map.of("id", id, "name", name, "variant", variant, "expr", expr, "promptEn", promptEn);
    }

    /** 美化模板（出图定稿用）。promptEn 叠加进出图 prompt。 */
    public List<Map<String, Object>> templates() {
        return List.of(
                tpl("t1", "影棚柔光", "商务证件 · 均匀布光", "beauty", List.of("磨皮", "提亮", "商务"), 246,
                        "professional studio portrait, soft even key lighting, clean skin retouch, business style"),
                tpl("t2", "电影质感", "叙事氛围 · 暖调", "style", List.of("电影感", "暖光", "颗粒"), 18,
                        "cinematic color grade, warm tones, subtle film grain, anamorphic look"),
                tpl("t3", "日系赛璐璐", "ACG 立绘 · 通透", "style", List.of("日系", "通透", "大眼"), 330,
                        "japanese cel-shaded anime illustration style, clean lines, luminous"),
                tpl("t4", "清透妆容", "自然底妆 · 裸感", "makeup", List.of("裸妆", "气色", "清透"), 12,
                        "natural no-makeup makeup look, dewy skin, healthy glow"),
                tpl("t5", "新中式", "东方美学 · 水墨", "style", List.of("国风", "水墨", "雅致"), 158,
                        "new-chinese aesthetic, ink-wash inspired backdrop, elegant oriental styling"),
                tpl("t6", "高清修复", "细节增强 · 4K", "beauty", List.of("超分", "锐化", "4K"), 200,
                        "ultra high definition, enhanced fine detail, crisp 4k quality"));
    }

    private static Map<String, Object> tpl(String id, String name, String sub, String kind,
                                           List<String> tags, int hue, String promptEn) {
        return Map.of("id", id, "name", name, "sub", sub, "kind", kind, "tags", tags,
                "engine", "Agnes Image 2.1", "hue", hue, "promptEn", promptEn);
    }

    public String templatePromptEn(String templateId) {
        if (templateId == null) return null;
        return templates().stream()
                .filter(t -> templateId.equals(t.get("id")))
                .map(t -> (String) t.get("promptEn"))
                .findFirst().orElse(null);
    }

    public String scenePromptEn(String sceneId) {
        if (sceneId == null) return null;
        return scenes().stream()
                .filter(s -> sceneId.equals(s.get("id")))
                .map(s -> (String) s.get("promptEn"))
                .findFirst().orElse(null);
    }

    public String sceneName(String sceneId) {
        if (sceneId == null) return null;
        return scenes().stream()
                .filter(s -> sceneId.equals(s.get("id")))
                .map(s -> (String) s.get("name"))
                .findFirst().orElse(null);
    }

    /** 下游子应用（复用已定稿 Avatar）。 */
    public List<Map<String, Object>> applications() {
        return List.of(
                app("music", "音乐工作室", "APP-MUS", "music", "数字人 MV、音乐短片与虚拟歌手演出",
                        "#7C5CE6", "#2E2270", "#C9B8FF", List.of(
                                tool("MV 生成器", "一首歌一键生成数字人 MV", "clapper"),
                                tool("虚拟歌手演出", "数字人演唱与舞台呈现", "music"),
                                tool("音乐短片", "氛围配乐 + 角色叙事短片", "play"))),
                app("drama", "短剧工坊", "APP-DRA", "clapper", "数字人出演剧情短剧，多角色演绎成片",
                        "#3E63C8", "#16224C", "#9DB8FF", List.of(
                                tool("剧情短剧", "剧本到成片的短剧制作", "clapper"),
                                tool("多角色对戏", "多个数字人同场演绎", "users"),
                                tool("分镜成片", "自动分镜与剪辑合成", "layers"))),
                app("live", "短视频带货", "APP-LIV", "cart", "数字人口播带货，短视频与直播间开播",
                        "#E8884A", "#6E3214", "#FFD0A6", List.of(
                                tool("口播带货", "商品脚本一键口播视频", "mic"),
                                tool("直播间开播", "数字人 7×24 无人直播", "bolt"),
                                tool("商品讲解", "卖点拆解与讲解视频", "doc"))));
    }

    private static Map<String, Object> app(String key, String name, String code, String icon, String blurb,
                                           String g1, String g2, String accent, List<Map<String, Object>> tools) {
        return Map.of("key", key, "name", name, "code", code, "icon", icon, "blurb", blurb,
                "g1", g1, "g2", g2, "accent", accent, "tools", tools);
    }

    private static Map<String, Object> tool(String name, String desc, String icon) {
        return Map.of("name", name, "desc", desc, "icon", icon);
    }

    /** 公开数字人（只读复用网格）。 */
    public List<Map<String, Object>> publicAvatars() {
        return List.of(
                pub("PA-01", "Annie", "商务职业", 28, "pro"),
                pub("PA-02", "Christina", "居家生活", 168, "life"),
                pub("PA-03", "Terry", "播客主播", 248, "ugc"),
                pub("PA-04", "Pamela", "社媒口播", 8, "community"),
                pub("PA-05", "Marcus", "专业讲解", 200, "pro"),
                pub("PA-06", "Yuki", "生活方式", 320, "life"));
    }

    private static Map<String, Object> pub(String id, String name, String archetype, int hue, String cat) {
        return Map.ofEntries(
                Map.entry("id", id),
                Map.entry("name", name),
                Map.entry("archetype", archetype),
                Map.entry("hue", hue),
                Map.entry("cat", cat),
                Map.entry("fav", false),
                Map.entry("path", "ai"),
                Map.entry("status", "archived"),
                Map.entry("counts", Map.of()),
                Map.entry("deriv", Map.of()),
                Map.entry("def", Map.of()));
    }

    /** 内置音色名集合（绑定校验 + 推荐）。 */
    public boolean isBuiltinVoice(String name) {
        return builtinVoices().stream().anyMatch(v -> v.get("name").equals(name));
    }

    public String recommendVoice(String gender) {
        return "male".equalsIgnoreCase(gender) || "男".equals(gender) ? "青年清爽男声" : "亲和邻家女声";
    }
}
