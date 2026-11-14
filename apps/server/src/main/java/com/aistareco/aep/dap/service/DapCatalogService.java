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
     * 数字人广场（公开只读数字人）。四类内置形象，全部为平台 AI 原创。
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
                pub("PA-10", "Mubai 慕白", "mubai-ink", "新中式国风雅士", "新中式国风雅士与文旅时尚形象", 158, "life", false, "SDXL", "播音正经男声",
                        palette("#3E6B5A", "#14201C", "#ECCFB2", "#14110F", "#1C2622", "#6FB59A"),
                        def("约 27 岁", "清雅 · 内敛 · 风骨", "国风 / 文旅 / 时尚大片", List.of("儒雅", "沉静", "讲究"), "新中式墨竹长衫 · 雅致", "一身墨色入画来，把东方的留白与风骨穿在身上。")),
                portrait("PA-11", "Maya 乔宁", "pro", "城市规划师", 38, 82, "御姐优雅女声",
                        "克制、干练", "橄榄绿无领西装与银色耳钉", "利落的齐下巴短发，淡雾面妆", "为城市更新、街区设计和建筑提案做解说"),
                portrait("PA-12", "Daniel 周启", "pro", "财务顾问", 52, 345, "沉稳大叔低音",
                        "严谨、内敛", "深莓色羊毛西装与浅灰衬衣", "后梳花白短发，修整整齐的短须", "适合财务知识讲解和企业经营分析"),
                portrait("PA-13", "Nora 顾川", "pro", "工业设计师", 27, 210, "新闻播报女声",
                        "理性、专注", "浅灰工装短外套与黑色高领内搭", "深棕寸短发，浅棕眉妆", "适合产品拆解、设计评审和工艺讲解"),
                portrait("PA-14", "Owen 唐砚", "pro", "纪录片制片人", 43, 223, "沉稳大叔低音",
                        "沉稳、温和", "靛蓝粗花呢西装与米白衬衫", "偏分卷发，短络腮胡", "适合纪实访谈、幕后制作和专题旁白"),
                portrait("PA-15", "Grace 叶岚", "pro", "博物馆策展人", 61, 5, "御姐优雅女声",
                        "从容、知性", "黑色丝绒外套与朱红丝巾", "银灰低盘发，红棕唇色", "适合展品导览、艺术史和文化访谈"),
                portrait("PA-16", "Ethan 陆衡", "pro", "材料工程师", 35, 200, "青年清爽男声",
                        "务实、清爽", "蓝灰实验室工作夹克与白色衬衫", "黑色圆寸，无须", "适合材料科普、工艺说明和产品演示"),
                portrait("PA-17", "Iris 江瑜", "pro", "品牌策略师", 31, 34, "新闻播报女声",
                        "利落、敏锐", "琥珀色双排扣西装与细金耳圈", "高马尾，自然眉与暖桃色唇妆", "适合品牌发布、案例分享和行业访谈"),
                portrait("PA-18", "Victor 魏哲", "pro", "烹饪讲师", 57, 148, "沉稳大叔低音",
                        "亲切、严谨", "墨绿厨师服与咖啡色围裙", "平头，灰白八字胡", "适合烹饪课程、厨具演示和餐饮培训"),
                portrait("PA-19", "Mei 许梅", "life", "社区花艺师", 46, 108, "御姐优雅女声",
                        "明朗、自在", "鼠尾草绿围裙与浅杏色衬衣", "松散低盘发，橘调淡妆", "适合花艺教学、家居布置和社区日常"),
                portrait("PA-20", "Leo 程野", "life", "城市骑行向导", 25, 68, "青年清爽男声",
                        "开朗、轻盈", "黄绿色防风骑行夹克", "黑色自然碎发，晒痕和雀斑", "适合城市骑行、路线介绍和户外装备分享"),
                portrait("PA-21", "Yun 何云", "life", "茶艺师", 63, 315, "御姐优雅女声",
                        "平和、雅致", "烟紫亚麻对襟上衣与木质耳饰", "灰白短卷发，淡妆", "适合茶席演示、茶器介绍和慢生活短片"),
                portrait("PA-22", "Sami 阿麦", "life", "手冲咖啡师", 28, 43, "青年清爽男声",
                        "随和、俏皮", "赭黄背带围裙与奶白条纹衫", "浓密短卷发，细短胡茬", "适合咖啡冲煮、门店探访和器具测评"),
                portrait("PA-23", "Juno 夏果", "life", "手作烘焙师", 22, 45, "亲和邻家女声",
                        "灵动、甜美", "蓝白细格衬衫与淡黄色围裙", "双低辫，雀斑与珊瑚色腮红", "适合烘焙教程、食谱演示和居家好物分享"),
                portrait("PA-24", "Kai 林航", "life", "徒步领队", 48, 15, "沉稳大叔低音",
                        "坚韧、爽朗", "铁锈红冲锋衣与深绿内搭", "风吹短发，粗胡茬", "适合徒步攻略、户外装备讲解和风景纪录"),
                portrait("PA-25", "June 罗晴", "life", "旧物修复师", 35, 222, "亲和邻家女声",
                        "沉静、细致", "靛蓝牛仔工作衫与棕色皮围裙", "黑色齐耳卷发，裸色妆", "适合旧物修复、家居改造和手作纪录"),
                portrait("PA-26", "Milo 林朔", "ugc", "数码评测博主", 23, 222, "青年清爽男声",
                        "机灵、直接", "深蓝机能马甲与白 T 恤", "银蓝挑染短发，透明框眼镜", "适合科技新品评测、开箱和使用教程"),
                portrait("PA-27", "Ada 吴玥", "ugc", "独立美妆博主", 30, 248, "亲和邻家女声",
                        "鲜明、利落", "白色结构感夹克与不对称耳饰", "铂金短寸，深红唇与钴蓝眼线", "适合彩妆教程、妆容演示和创意妆测评"),
                portrait("PA-28", "Leon 章桥", "ugc", "旅行摄影师", 41, 90, "沉稳大叔低音",
                        "随性、开阔", "卡其摄影背心与深绿衬衫", "肩上卷发，浓短须", "适合旅行纪实、摄影教学和相机测评"),
                portrait("PA-29", "Tina 赵小满", "ugc", "街头美食解说", 56, 15, "御姐优雅女声",
                        "爽快、幽默", "砖红棒球外套与米色 T 恤", "暗棕短烫发，柔橘色口红", "适合街头探店、市集见闻和地方美食口播"),
                portrait("PA-30", "Noah 温河", "ugc", "科学实验创作者", 32, 205, "青年清爽男声",
                        "好奇、耐心", "米色灯芯绒衬衫叠穿蓝灰卫衣", "侧夹卷发，黑色圆框眼镜", "适合实验演示、生活科普和知识短片"),
                portrait("PA-31", "Emi 白梨", "ugc", "独立游戏主播", 26, 272, "亲和邻家女声",
                        "俏皮、冷感", "紫色水洗卫衣叠穿烟灰网纱", "墨黑水母头，银色内眼角妆", "适合游戏实况、攻略讲解和直播片段"),
                portrait("PA-32", "Bo 任博", "ugc", "木工教学博主", 64, 212, "沉稳大叔低音",
                        "敦实、耐心", "靛青粗布围裙与赭红格纹法兰绒", "稀疏灰白短发，白色山羊胡", "适合工具讲解、手工木作和修缮教学"),
                portrait("PA-33", "Renee 乔苇", "ugc", "运动训练创作者", 36, 230, "亲和邻家女声",
                        "有力量、开朗", "钴蓝拉链运动上衣", "贴头辫束成低髻，自然妆", "适合居家训练、力量课程和运动装备展示"),
                portrait("PA-34", "Sean 段寻", "ugc", "桌游解说", 20, 28, "青年清爽男声",
                        "活泼、亲切", "橙棕针织开衫与浅蓝格纹衬衫", "栗棕蘑菇头，无须", "适合桌游规则教学、开箱和聚会玩法"),
                portrait("PA-35", "Luna 陆灵", "community", "舞台歌手", 29, 295, "亲和邻家女声",
                        "明艳、张扬", "亮银流苏夹克", "乌黑高髻，莓红唇与银色眼妆", "适合舞台短片、音乐宣传和演出预告"),
                portrait("PA-36", "Ray 金弋", "community", "复古唱片 DJ", 38, 350, "青年清爽男声",
                        "松弛、复古", "酒红丝绒衬衣与金属细项链", "黑色复古飞机头，细八字胡", "适合黑胶文化、派对预告和复古主题短片"),
                portrait("PA-37", "Qin 沈琴", "community", "戏曲演员", 46, 147, "御姐优雅女声",
                        "典雅、有台风", "墨绿织金戏服", "规整包头，戏曲红粉眼妆", "适合戏曲展示、表演教学和文化推广"),
                portrait("PA-38", "Fox 梁枫", "community", "街舞编舞师", 21, 24, "青年清爽男声",
                        "锐利、活泼", "橘色拼布飞行夹克与深灰 T 恤", "短脏辫与剃短鬓角，无须", "适合街舞教学、潮流穿搭和演出宣传"),
                portrait("PA-39", "Pearl 江珍", "community", "爵士乐主唱", 62, 215, "御姐优雅女声",
                        "华丽、洒脱", "宝蓝缎面西装与珍珠耳夹", "银白手推波纹，酒红唇妆", "适合爵士演出、音乐访谈和复古舞台"),
                portrait("PA-40", "Will 纪望", "community", "奇幻剧演员", 34, 3, "青年清爽男声",
                        "神秘、冷峻", "墨黑丝绸长袍与暗红刺绣", "乌黑半束长发，淡墨色眼妆", "适合武侠剧情、古装短片和角色演绎"),
                portrait("PA-41", "Celia 宋霁", "community", "古典舞演员", 25, 151, "亲和邻家女声",
                        "轻盈、清雅", "淡青色小立领纱质表演服", "侧分低髻，桃花色淡妆", "适合古典舞展示、国风短片和文旅宣传"),
                portrait("PA-42", "Felix 余风", "community", "独立乐队贝斯手", 50, 230, "沉稳大叔低音",
                        "叛逆、沉着", "黑色钉扣牛仔夹克与炭灰内搭", "盐灰短狼尾，短胡尖", "适合乐队纪实、摇滚主题和演出预告"),
                portrait("PA-43", "Vera 冉青", "community", "先锋时装造型师", 32, 282, "亲和邻家女声",
                        "前卫、凌厉", "灰紫不对称高领服装", "几何短刘海，烟紫色眼妆", "适合时装大片、造型解读和创意短片"));
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
        // 正面半身（front-half）= 定妆主图（-1）；右侧脸 / 左侧脸为另两个机位。
        m.put("shotImages", Map.of("front-half", base + "-1.jpg", "right", base + "-2.jpg",
                "left", base + "-3.jpg", "three-view", base + "-three-view.jpg"));
        // 内置形象免费。入库后以 dap_public_avatar 为准。
        m.put("access", "free");
        return m;
    }

    private static Map<String, Object> portrait(String id, String name, String category, String profession,
                                                 int age, int hue, String voiceName, String temperament, String clothing,
                                                 String styling, String usage) {
        Map<String, Object> profile = new java.util.LinkedHashMap<>();
        profile.put("年龄", age + " 岁");
        profile.put("职业", profession);
        profile.put("气质", temperament);
        profile.put("服饰", clothing);
        profile.put("妆发", styling);
        profile.put("用途", usage);
        profile.put("形象来源", "AI 原创虚构");
        var avatar = pub(id, name, "plaza-" + id.substring(3), profession, usage, hue, category,
                false, "OpenAI ImageGen", voiceName, Map.of(), profile);
        avatar.put("shotImages", Map.of("front-half", avatar.get("imageUrl"), "three-view", "/plaza/" + id + "-three-view.jpg"));
        return avatar;
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
