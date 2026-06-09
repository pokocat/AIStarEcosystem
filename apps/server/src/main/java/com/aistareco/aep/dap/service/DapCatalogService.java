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

    /** 下游子应用（复用已定稿 Avatar）—— 与平台三个子产品一一对应：
     *  AI 歌手（web-music）/ AI 短视频带货（web-celebrity）/ AI 短剧（web-drama）。 */
    public List<Map<String, Object>> applications() {
        return List.of(
                app("music", "AI 歌手", "APP-MUS", "music", "数字人化身虚拟歌手：发单曲、出 MV、开虚拟演出",
                        "#7C5CE6", "#2E2270", "#C9B8FF", List.of(
                                tool("单曲 MV", "一首歌一键生成数字人 MV", "clapper"),
                                tool("虚拟歌手演出", "数字人演唱与舞台呈现", "music"),
                                tool("音乐短片", "氛围配乐 + 角色叙事短片", "play"))),
                app("live", "AI 短视频带货", "APP-LIV", "cart", "数字人口播带货：短视频混剪、商品挂载、矩阵分发",
                        "#E8884A", "#6E3214", "#FFD0A6", List.of(
                                tool("口播带货视频", "商品脚本一键口播成片", "mic"),
                                tool("商品讲解", "卖点拆解与讲解视频", "doc"),
                                tool("矩阵分发", "多账号定时分发到抖音等平台", "bolt"))),
                app("drama", "AI 短剧", "APP-DRA", "clapper", "数字人出演剧情短剧，从剧本到成片多角色演绎",
                        "#3E63C8", "#16224C", "#9DB8FF", List.of(
                                tool("剧情短剧", "剧本到成片的短剧制作", "clapper"),
                                tool("多角色对戏", "多个数字人同场演绎", "users"),
                                tool("分镜成片", "自动分镜与剪辑合成", "layers"))));
    }

    private static Map<String, Object> app(String key, String name, String code, String icon, String blurb,
                                           String g1, String g2, String accent, List<Map<String, Object>> tools) {
        return Map.of("key", key, "name", name, "code", code, "icon", icon, "blurb", blurb,
                "g1", g1, "g2", g2, "accent", accent, "tools", tools);
    }

    private static Map<String, Object> tool(String name, String desc, String icon) {
        return Map.of("name", name, "desc", desc, "icon", icon);
    }

    /**
     * 数字人广场（公开只读数字人）。10 个不同风格 / 元素 / 特征的样板形象，全部平台 AI 原创。
     * 与前端 mock（apps/web-aiavatar/src/proto/data.ts 的 PUBLIC_AVATARS）同形同值。
     *
     * 图片为 web-aiavatar 自带的静态资源（/plaza/PA-XX-{1,2,3}.jpg，根相对路径，浏览器按
     * 前端 origin 直出，server 不托管），故此处直接给 imageUrl / shotImages，不走 CdnUrlSigner。
     */
    public List<Map<String, Object>> publicAvatars() {
        return List.of(
                pub("PA-01", "Annie 安妮", "annie-pro", "商务精英主持", "商务发布会与产品讲解的全能数字主持", 222, "pro", false, "SDXL", "新闻播报女声",
                        palette("#4F6BFF", "#1B2A66", "#F2D6BE", "#2A2320", "#1E2B5A", "#9DB0FF"),
                        def("约 30 岁", "专业 · 干练 · 亲和", "发布会主持 / 产品讲解 / 企业培训", List.of("专业", "可信", "沉稳"), "海军蓝西装 · 商务", "镜头前永远准时、得体、有说服力的商务搭档。")),
                pub("PA-02", "Christina 林晚", "christina-home", "居家生活博主", "治愈系居家生活与好物种草博主", 28, "life", true, "SDXL", "亲和邻家女声",
                        palette("#F0C9A0", "#8A5A38", "#F5DBC4", "#6B4A30", "#F3E6D2", "#E8B07A"),
                        def("约 28 岁", "温暖 · 治愈 · 松弛", "居家好物 / 生活 vlog / 母婴种草", List.of("温柔", "细腻", "真诚"), "奶油色针织衫 · 居家", "把日子过成诗，陪你慢慢生活的邻家女孩。")),
                pub("PA-03", "Terry 陈泽", "terry-podcast", "播客主播", "有梗有料的播客主播与访谈口播", 52, "ugc", false, "SDXL", "青年清爽男声",
                        palette("#B7A35A", "#4A3A1E", "#EBCBA8", "#1C1712", "#5C5A2E", "#E0C26A"),
                        def("约 32 岁", "松弛 · 健谈 · 有梗", "播客 / 访谈口播 / 知识脱口秀", List.of("幽默", "真实", "健谈"), "橄榄绿连帽卫衣 · 休闲", "戴上耳机就有聊不完的话题，懂内容也懂节奏。")),
                pub("PA-04", "Pamela 苏菲", "pamela-social", "社媒种草达人", "高感染力的社媒种草与口播达人", 326, "community", false, "FLUX", "少女甜嗓",
                        palette("#FF7EB6", "#2BB6C4", "#F6D6C0", "#2A2230", "#FFB3D1", "#36D6E0"),
                        def("约 24 岁", "活力 · 时髦 · 有感染力", "社媒口播 / 美妆种草 / 短视频带货", List.of("热情", "自信", "爱分享"), "粉色短外套 · 潮流", "自带打光板的种草女孩，三秒抓住你的注意力。")),
                pub("PA-05", "Marcus 马库斯", "marcus-mentor", "专业知识讲师", "权威耐心的知识讲师与财经解读", 214, "pro", false, "SDXL", "沉稳大叔低音",
                        palette("#7C8AA6", "#2A3142", "#ECCDB0", "#4A4A52", "#2E3340", "#C9B07A"),
                        def("约 45 岁", "权威 · 沉稳 · 睿智", "知识科普 / 课程讲师 / 财经解读", List.of("严谨", "博学", "耐心"), "炭灰西装 · 学者", "把复杂的事讲明白，是值得托付信任的行业前辈。")),
                pub("PA-06", "Yuki 由纪", "yuki-muse", "日系生活方式", "高级感日系生活方式与美妆形象", 36, "life", true, "SDXL", "御姐优雅女声",
                        palette("#E7DCCB", "#9A8C76", "#F4DEC9", "#201A18", "#E3D6C2", "#C7B49A"),
                        def("约 25 岁", "清新 · 安静 · 高级", "美妆 / 生活方式 / 品牌短片", List.of("恬静", "审美在线", "自律"), "米色高领针织 · 极简", "安静却有存在感，把简单穿成高级的日系女孩。")),
                pub("PA-07", "Selena 星澜", "selena-stellar", "二次元星界少女", "星界主题虚拟主播与二次元 IP", 258, "community", false, "SDXL", "少女甜嗓",
                        palette("#9A7BFF", "#2C1E66", "#F3DEC8", "#CBB7FF", "#6E4DD6", "#FFD36B"),
                        def("设定 17 岁", "空灵 · 神秘 · 治愈", "虚拟主播 / IP 立绘 / 周边", List.of("温柔", "疏离", "坚定"), "星河长裙 · 流光", "银河彼端的观星少女，能听见每一颗星辰的低语。")),
                pub("PA-08", "Vex 维克斯", "vex-runner", "赛博机甲猎人", "赛博朋克赏金猎人与游戏概念角色", 332, "ugc", false, "SDXL", "沉稳大叔低音",
                        palette("#FF3D77", "#1A1030", "#E2BFA6", "#15121C", "#201A2E", "#38E0FF"),
                        def("外观 26 岁", "凌厉 · 冷峻 · 孤傲", "游戏角色 / 剧情 / 概念设计", List.of("寡言", "果决", "重义"), "战术夹克 · 义体回路", "左臂是义体，右眼是瞄具，在霓虹雨夜只认筹码与道义。")),
                pub("PA-09", "Cha 阿茶", "cha-mascot", "萌系吉祥物", "萌系奶茶吉祥物与品牌 IP 形象", 32, "community", true, "FLUX", "少女甜嗓",
                        palette("#F4D8B0", "#B07B4E", "#F6E2C8", "#C99B6A", "#EBD2B0", "#8FD0E8"),
                        def("设定 ∞", "呆萌 · 治愈 · 暖心", "品牌 IP / 吉祥物 / 表情包", List.of("好奇", "贴心", "话痨"), "奶茶色连帽卫衣 · 萌系", "一杯奶茶里跳出来的快乐使者，负责把可爱传染给每个人。")),
                pub("PA-10", "Mubai 慕白", "mubai-ink", "新中式国风雅士", "新中式国风雅士与文旅时尚形象", 158, "life", false, "SDXL", "播音正经男声",
                        palette("#3E6B5A", "#14201C", "#ECCFB2", "#14110F", "#1C2622", "#6FB59A"),
                        def("约 27 岁", "清雅 · 内敛 · 风骨", "国风 / 文旅 / 时尚大片", List.of("儒雅", "沉静", "讲究"), "新中式墨竹长衫 · 雅致", "一身墨色入画来，把东方的留白与风骨穿在身上。")));
    }

    private static Map<String, Object> pub(String id, String name, String codename, String archetype, String tagline,
                                           int hue, String cat, boolean fav, String engine, String voiceName,
                                           Map<String, Object> palette, Map<String, Object> def) {
        String base = "/plaza/" + id;
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", id);
        m.put("name", name);
        m.put("codename", codename);
        m.put("path", "ai");
        m.put("archetype", archetype);
        m.put("tagline", tagline);
        m.put("status", "archived");
        m.put("updated", "已就绪");
        m.put("hue", hue);
        m.put("cat", cat);
        m.put("fav", fav);
        m.put("versions", 1);
        m.put("engine", engine);
        m.put("voiceName", voiceName);
        m.put("palette", palette);
        m.put("def", def);
        m.put("counts", Map.of());
        m.put("deriv", Map.of());
        m.put("imageUrl", base + "-1.jpg");
        m.put("shotImages", Map.of("right", base + "-2.jpg", "left", base + "-3.jpg"));
        return m;
    }

    private static Map<String, Object> palette(String bg1, String bg2, String skin, String hair, String cloth, String accent) {
        return Map.of("bg1", bg1, "bg2", bg2, "skin", skin, "hair", hair, "cloth", cloth, "accent", accent);
    }

    private static Map<String, Object> def(String age, String temper, String use, List<String> traits, String outfit, String tagline) {
        Map<String, Object> d = new java.util.LinkedHashMap<>();
        d.put("年龄", age);
        d.put("气质", temper);
        d.put("用途", use);
        d.put("性格", traits);
        d.put("服饰", outfit);
        d.put("形象来源", "AI 原创虚构");
        d.put("设定语", tagline);
        return d;
    }

    /** 按 id 查一个公开数字人（数字人广场「另存为」用）。 */
    public Map<String, Object> publicAvatar(String id) {
        return publicAvatars().stream()
                .filter(a -> id != null && id.equals(a.get("id")))
                .findFirst().orElse(null);
    }

    /** 内置音色名集合（绑定校验 + 推荐）。 */
    public boolean isBuiltinVoice(String name) {
        return builtinVoices().stream().anyMatch(v -> v.get("name").equals(name));
    }

    public String recommendVoice(String gender) {
        return "male".equalsIgnoreCase(gender) || "男".equals(gender) ? "青年清爽男声" : "亲和邻家女声";
    }
}
