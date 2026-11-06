package com.aistareco.aep.ipstudio.scene;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler;
import com.aistareco.aep.ipstudio.prompt.StudioPromptEntry;
import com.aistareco.aep.ipstudio.prompt.StudioPromptLibrary;
import org.springframework.beans.factory.ObjectProvider;
import java.util.regex.Pattern;

/**
 * Studio 场景目录（AI 图片 / AI 视频）的唯一真源。
 *
 * <p>运营在后台改过就读平台配置 {@code studio.scene-catalog}，没改过就用随包的 {@code ipstudio/scenes.json}。
 * 场景写好的描述、拍法、每个场景用哪种方法，都只在这一份里；前端经 {@code GET /api/v1/ip-studio/scenes} 读，
 * 出图描述、编导写脚本的要求和交给助手的话由 {@link #compose} 在服务端拼，前端不再各写一份（docs/studio-scene-creation.md §7）。
 * 写错的目录（编号重复、描述里点了不存在的参考图、留了【…】空位）随包的那份启动即失败，后台那份保存时就拒绝。
 */
@Component
public class StudioSceneCatalog {
    private static final Logger log = LoggerFactory.getLogger(StudioSceneCatalog.class);
    /** 后台改过的目录存在这里；删掉就回到随包那份。 */
    public static final String CONFIG_KEY = "studio.scene-catalog";
    /** 后台上传的封面和示例都存在这个分类下，目录里只认这里的 key（不能指向用户自己的文件）。 */
    public static final String MEDIA_CATEGORY = "ipstudio/scene", MEDIA_OWNER = "catalog";
    public static final String MEDIA_PREFIX = com.aistareco.aep.service.storage.FileStorageService.ownedKeyPrefix(MEDIA_CATEGORY, MEDIA_OWNER);

    public record Group(String id, String title) {}
    /**
     * 一个素材位（照参考站的 skill 配置，2026-11-05）：一个位可以放好几张，描述里的「图N」按实际交给模型的顺序编号。
     *
     * @param hint 这个位能放多张时给用户的一句话：放什么、有什么用
     * @param max  最多放几张，没写是 1
     * @param role 告诉模型这几张是做什么的（「图1是{role}」），没写用名称
     * @param many 放了不止一张时换成这句（「同一个人的不同照片……」），没写用 role
     */
    public record SceneRef(String label, boolean required, String hint, Integer max, String role, String many) {
        public SceneRef(String label, boolean required, String hint) { this(label, required, hint, null, null, null); }
        public int limit() { return max == null ? 1 : max; }
        String usedAs(int count) { return count > 1 && !blank(many) ? many.trim() : blank(role) ? label : role.trim(); }
    }
    /** 出 wire 时由 key 签出的地址；目录里只存 key。 */
    public record Media(String url, String mediaType) {}
    /** 选项组里的一项：value 是接口用的编号，label 给用户看，prompt 是选中后拼进描述 / 要求里的那句话。 */
    public record OptionChoice(String value, String label, String prompt) {}
    /** 照参考站的「选项组」：一个场景几组可选项（如拍法、语气），各有默认值；用户点选，不用写字。 */
    public record OptionGroup(String key, String label, List<OptionChoice> choices, String defaultValue) {}
    /** 首页「你想做什么？」的一张卡：点进去落到 sceneId，两张封面取 covers 里两个场景的封面。 */
    public record HomeGoal(String id, String title, String description, String sceneId, List<String> covers) {}
    /** @param anyOf 这几个选填的素材位（从 0 起）至少放一个，比如服装上身的上装和下装 */
    public record ImageScene(String id, String group, String title, String description, List<SceneRef> refs, String prompt, String hint, String ratio,
                             List<OptionGroup> options, Boolean enabled, String coverKey, List<String> exampleKeys, String coverUrl, List<Media> examples, List<Integer> anyOf, String example) {
        public ImageScene(String id, String group, String title, String description, List<SceneRef> refs, String prompt, String hint, String ratio) {
            this(id, group, title, description, refs, prompt, hint, ratio, null, null, null, null, null, null, null, null);
        }
        public ImageScene(String id, String group, String title, String description, List<SceneRef> refs, String prompt, String hint, String ratio,
                          List<OptionGroup> options, Boolean enabled, String coverKey, List<String> exampleKeys, String coverUrl, List<Media> examples, List<Integer> anyOf) {
            this(id, group, title, description, refs, prompt, hint, ratio, options, enabled, coverKey, exampleKeys, coverUrl, examples, anyOf, null);
        }
        public ImageScene(String id, String group, String title, String description, List<SceneRef> refs, String prompt, String hint, String ratio,
                          List<OptionGroup> options, Boolean enabled, String coverKey, List<String> exampleKeys, String coverUrl, List<Media> examples) {
            this(id, group, title, description, refs, prompt, hint, ratio, options, enabled, coverKey, exampleKeys, coverUrl, examples, null, null);
        }
        public boolean on() { return enabled == null || enabled; }
        public List<OptionGroup> optionGroups() { return options == null ? List.of() : options; }
        /** 同一个场景，换掉上下架 / 封面 / 示例这几项（出 wire 签名、保存时剥地址都用它）。 */
        public ImageScene withMedia(Boolean on, String cover, List<String> exampleKeys, String coverUrl, List<Media> examples) {
            return new ImageScene(id, group, title, description, refs, prompt, hint, ratio, options, on, cover, exampleKeys, coverUrl, examples, anyOf, example);
        }
        /** 出图描述换成提示词库里的（{@link #overlay}）。 */
        public ImageScene withPrompt(String text) {
            return new ImageScene(id, group, title, description, refs, text, hint, ratio, options, enabled, coverKey, exampleKeys, coverUrl, examples, anyOf, example);
        }
    }
    public record Slot(String label, boolean required, Integer max) {}

    /**
     * 这类视频要做到什么（2026-10-30 审查：只有名称和一句拍法，同城团购拍成了泛泛的探店）。
     *
     * @param goal    这条视频要让看的人做什么，一句话（「让附近的人买下套餐、到店来用」）
     * @param facts   要用户给的信息；必填的是这条要讲的重点；没给时编导直接写好，价格、金额、地址不写具体数字（2026-11-04 起不再留【待补】）
     * @param ending  结尾要观众做什么（有就写）
     * @param fiction 能编到哪一步：none = 只用用户给的，人物也不能写成真实顾客；story = 可以编人物和情节，不能编品牌事实（缺省）
     */
    public record Brief(String goal, List<Fact> facts, String ending, String fiction) {
        public List<Fact> factList() { return facts == null ? List.of() : facts; }
        public boolean noFiction() { return "none".equals(fiction); }
    }
    /**
     * @param use       这条信息怎么用（「有原价才做对比」）；没有就不写
     * @param inferable 痛点、卖点、使用场景这类能从素材合理推断的：没给也不算还缺（docs/studio-prompt-architecture.md §9.6）
     */
    public record Fact(String label, boolean required, String use, Boolean inferable) {
        public Fact(String label, boolean required, String use) { this(label, required, use, null); }
        public boolean canInfer() { return Boolean.TRUE.equals(inferable); }
    }

    public record VideoScene(String id, String group, String title, String description, Slot images, Slot video, boolean character, boolean voice,
                             String placeholder, boolean textRequired, List<Integer> durations, int duration, String ratio, String structure,
                             List<String> ideas, String skill, List<OptionGroup> options, Boolean enabled, String coverKey, List<String> exampleKeys, String coverUrl, List<Media> examples,
                             Brief brief) {
        public VideoScene(String id, String group, String title, String description, Slot images, Slot video, boolean character, boolean voice,
                          String placeholder, boolean textRequired, List<Integer> durations, int duration, String ratio, String structure,
                          List<String> ideas, String skill, List<OptionGroup> options, Boolean enabled, String coverKey, List<String> exampleKeys, String coverUrl, List<Media> examples) {
            this(id, group, title, description, images, video, character, voice, placeholder, textRequired, durations, duration, ratio, structure, ideas, skill, options,
                    enabled, coverKey, exampleKeys, coverUrl, examples, null);
        }
        public boolean on() { return enabled == null || enabled; }
        public List<OptionGroup> optionGroups() { return options == null ? List.of() : options; }
        public VideoScene withMedia(Boolean on, String cover, List<String> exampleKeys, String coverUrl, List<Media> examples) {
            return new VideoScene(id, group, title, description, images, video, character, voice, placeholder, textRequired, durations, duration, ratio,
                    structure, ideas, skill, options, on, cover, exampleKeys, coverUrl, examples, brief);
        }
        /** 拍法和要用到的信息换成提示词库里的（{@link #overlay}）。 */
        public VideoScene withCreative(String text, Brief newBrief) {
            return new VideoScene(id, group, title, description, images, video, character, voice, placeholder, textRequired, durations, duration, ratio,
                    text, ideas, skill, options, enabled, coverKey, exampleKeys, coverUrl, examples, newBrief);
        }
    }
    public record Catalog(int version, List<Group> imageGroups, List<Group> videoGroups, List<ImageScene> image, List<VideoScene> video, List<HomeGoal> homeGoals) {
        public Catalog(int version, List<Group> imageGroups, List<Group> videoGroups, List<ImageScene> image, List<VideoScene> video) {
            this(version, imageGroups, videoGroups, image, video, null);
        }
        public List<HomeGoal> goals() { return homeGoals == null ? List.of() : homeGoals; }
        public Catalog with(List<ImageScene> image, List<VideoScene> video, List<HomeGoal> goals) {
            return new Catalog(version, imageGroups, videoGroups, image, video, goals);
        }
    }

    /** 自由出图：没有固定描述，只有用户自己写的那句。 */
    public static final String FREE = "free";
    /** 视频场景能指定的方法：一次出片和复刻都在这里，别处没有的方法不让后台随手填。 */
    public static final Set<String> VIDEO_SKILLS = Set.of("video-generation", "reference-video-recreation");
    private static final Pattern REF = Pattern.compile("图(\\d)");
    private static final ObjectMapper JSON = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private final Catalog builtIn;
    private PlatformConfigService config;
    private volatile Cached cached;
    /**
     * 缓存按存下来的内容认，不按版本号：同一个版本号可能对应过两份目录（2026-10-30 复核：
     * 旧的「恢复内置」删行后再保存又从第 1 版开始，读到的是删行前那份）。
     */
    private record Cached(JsonNode raw, Catalog catalog) {}

    /**
     * 「恢复内置」写进配置行的值：只有这一个字段。行一直留着，版本号接着往上加，
     * 恢复之前打开的后台页面再保存会被版本号拦下，而不是覆盖别人恢复后新存的那份。
     */
    public static final String BUILT_IN_FIELD = "builtIn";
    public static JsonNode builtInMarker() { return JSON.createObjectNode().put(BUILT_IN_FIELD, true); }
    static boolean marksBuiltIn(JsonNode value) { return value != null && value.isObject() && value.size() == 1 && value.path(BUILT_IN_FIELD).asBoolean(false); }

    public StudioSceneCatalog() { this(load("ipstudio/scenes.json")); }

    StudioSceneCatalog(Catalog catalog) { this.builtIn = validate(catalog); }

    /** 测试用：指定提示词库（比如按旧场景内容建的库，核对拼话逐字不变）。 */
    StudioSceneCatalog(Catalog catalog, StudioPromptLibrary library) { this(catalog); this.libraryOverride = library; }

    @Autowired(required = false)
    void setConfig(PlatformConfigService config) { this.config = config; }

    private ObjectProvider<StudioPromptLibrary> libraryProvider;
    private ObjectProvider<StudioPromptAssembler> assemblerProvider;
    private StudioPromptLibrary libraryOverride;
    private volatile StudioPromptAssembler classpathAssembler;

    @Autowired(required = false)
    void setPrompts(ObjectProvider<StudioPromptLibrary> library, ObjectProvider<StudioPromptAssembler> assembler) {
        this.libraryProvider = library; this.assemblerProvider = assembler;
    }

    /** 应用里是数据库里的提示词库；没有 Spring 的构造（单测、工具）读仓库文件。 */
    StudioPromptLibrary library() {
        if (libraryOverride != null) return libraryOverride;
        StudioPromptLibrary lib = libraryProvider == null ? null : libraryProvider.getIfAvailable();
        return lib != null ? lib : classpath().library();
    }

    private StudioPromptAssembler assembler() {
        if (libraryOverride != null) return new StudioPromptAssembler(libraryOverride);
        StudioPromptAssembler a = assemblerProvider == null ? null : assemblerProvider.getIfAvailable();
        return a != null ? a : classpath();
    }

    private StudioPromptAssembler classpath() {
        StudioPromptAssembler a = classpathAssembler;
        if (a == null) synchronized (this) { if ((a = classpathAssembler) == null) classpathAssembler = a = new StudioPromptAssembler(new StudioPromptLibrary()); }
        return a;
    }

    /**
     * 场景的创作文字以提示词库为准（docs/studio-prompt-architecture.md §5）：视频场景的拍法和要用到的信息、图片场景的出图描述，
     * 库里有这个场景的条目就用条目的。场景存储里那份只在库里没有条目时用（后台刚新建的场景）。
     */
    Catalog overlay(Catalog c) {
        StudioPromptLibrary lib = library();
        if (lib == null) return c;
        var image = c.image().stream().map(s -> lib.find(sceneKey(s.id())).filter(e -> !e.withdrawn()).map(e -> s.withPrompt(e.body())).orElse(s)).toList();
        var video = c.video().stream().map(s -> lib.find(sceneKey(s.id())).filter(e -> !e.withdrawn())
                .map(e -> s.withCreative(e.body(), briefOf(e, s.brief()))).orElse(s)).toList();
        return c.with(image, video, c.homeGoals());
    }

    /** 场景条目文件头里的 {@code scene}（facts / goal / ending / fiction）→ Brief；没写就沿用场景存储里的。 */
    static Brief briefOf(StudioPromptEntry entry, Brief fallback) {
        var scene = entry.scene();
        if (scene.isEmpty() || !(scene.get("facts") instanceof List<?>)) return fallback;
        try { return JSON.convertValue(scene, Brief.class); }
        catch (IllegalArgumentException e) { log.warn("[studio-scene] {} 的要用到的信息读不出来，沿用场景存储里的：{}", entry.key(), e.getMessage()); return fallback; }
    }

    /**
     * 当前生效的整份目录（含下架的场景）：后台改过用后台的，否则随包那份；场景的创作文字（视频的拍法和要用到的信息、
     * 图片的出图描述）以提示词库的场景条目为准（docs/studio-prompt-architecture.md §5）。
     */
    public Catalog catalog() { return overlay(fromStorage()); }

    /** 场景存储里的目录（不叠提示词库）：后台保存时拿它比对、恢复默认时看随包那份。 */
    public Catalog storedCatalog() { return fromStorage(); }

    private Catalog fromStorage() {
        var saved = stored();
        if (saved.isEmpty() || marksBuiltIn(saved.get().value())) return builtIn;
        JsonNode raw = saved.get().value();
        var current = cached;
        if (current != null && current.raw().equals(raw)) return current.catalog();
        try {
            Catalog parsed = validate(JSON.treeToValue(raw, Catalog.class));
            cached = new Cached(raw, parsed);
            return parsed;
        } catch (Exception e) {
            // 保存时已经校验过，走到这里说明有人绕过后台直接改了库。整页不能因此打不开：用随包那份，并大声报出来。
            log.error("[studio-scene] saved catalog version={} is invalid, serving the built-in one: {}", saved.get().version(), e.getMessage());
            return builtIn;
        }
    }
    /** 随包那份（后台「恢复默认」看的就是它）。 */
    public Catalog builtIn() { return builtIn; }
    /** 配置行的版本号（恢复内置也算一版）；从没存过是 0。保存时拿它判断有没有人先改过。 */
    public int savedVersion() { return stored().map(PlatformConfigDto::version).orElse(0); }
    /** 现在用的是不是随包那份：从没存过，或者最近一次是「恢复内置」。 */
    public boolean usingBuiltIn() { return stored().map(d -> marksBuiltIn(d.value())).orElse(true); }
    private Optional<PlatformConfigDto> stored() { return config == null ? Optional.empty() : config.findByKey(CONFIG_KEY); }

    /**
     * 用户能看到的：只留上架的场景，key 换成签过名的地址（key 和上下架标记不出 wire）；
     * 首页卡片只留落点场景还上架的。
     */
    public Catalog published(Function<String, String> sign) {
        Catalog c = catalog();
        var image = c.image().stream().filter(ImageScene::on).map(s -> s.withMedia(null, null, null, url(s.coverKey(), sign), examples(s.exampleKeys(), sign))).toList();
        var video = c.video().stream().filter(VideoScene::on).map(s -> s.withMedia(null, null, null, url(s.coverKey(), sign), examples(s.exampleKeys(), sign))).toList();
        Set<String> live = new HashSet<>();
        image.forEach(s -> live.add(s.id())); video.forEach(s -> live.add(s.id()));
        return c.with(image, video, c.goals().stream().filter(g -> live.contains(g.sceneId())).toList());
    }
    public record HomeCover(String sceneId, String coverUrl) {}
    /** 首页卡片对外的样子：没登录的访客也看得到，所以只有显示用的字段，不带场景描述和拍法。 */
    public record HomeCard(String id, String title, String description, String sceneId, String kind, List<HomeCover> covers) {}

    /** 首页「你想做什么？」：落点场景上架的卡片，封面取所选场景运营传的图（没传为空，前端用随包封面）。 */
    public List<HomeCard> homeCards(Function<String, String> sign) {
        Catalog c = published(sign);
        java.util.Map<String, String> covers = new java.util.HashMap<>();
        java.util.Map<String, String> kinds = new java.util.HashMap<>();
        c.image().forEach(s -> { kinds.put(s.id(), "image"); if (s.coverUrl() != null) covers.put(s.id(), s.coverUrl()); });
        c.video().forEach(s -> { kinds.put(s.id(), "video"); if (s.coverUrl() != null) covers.put(s.id(), s.coverUrl()); });
        // 封面场景下架了就不再签它的图，但编号照给（前端按编号找随包封面）。
        return c.goals().stream().map(g -> new HomeCard(g.id(), g.title(), g.description(), g.sceneId(), kinds.get(g.sceneId()),
                (g.covers() == null ? List.<String>of() : g.covers()).stream().map(id -> new HomeCover(id, covers.get(id))).toList())).toList();
    }

    /** 给每个场景补上封面和示例的地址（后台预览也用）。 */
    public static Catalog withMedia(Catalog c, Function<String, String> sign) {
        return c.with(c.image().stream().map(s -> s.withMedia(s.enabled(), s.coverKey(), s.exampleKeys(), url(s.coverKey(), sign), examples(s.exampleKeys(), sign))).toList(),
                c.video().stream().map(s -> s.withMedia(s.enabled(), s.coverKey(), s.exampleKeys(), url(s.coverKey(), sign), examples(s.exampleKeys(), sign))).toList(),
                c.homeGoals());
    }
    private static String url(String key, Function<String, String> sign) { return blank(key) ? null : sign.apply(key); }
    private static List<Media> examples(List<String> keys, Function<String, String> sign) {
        return keys == null ? List.of() : keys.stream().filter(k -> !blank(k)).map(k -> new Media(sign.apply(k), mediaType(k))).toList();
    }
    public static String mediaType(String key) { return key.toLowerCase().matches(".*\\.(mp4|mov|webm)$") ? "video" : "image"; }

    public Optional<ImageScene> image(String id) { return catalog().image().stream().filter(s -> s.id().equals(id)).findFirst(); }
    public Optional<VideoScene> video(String id) { return catalog().video().stream().filter(s -> s.id().equals(id)).findFirst(); }

    // ── 拼话 ───────────────────────────────────────────────────────────────

    /**
     * @param kind     image = 出图描述；video = 交给画布创作助手的话；video-script = 交给编导写脚本的要求
     * @param filled   图片场景：哪几个素材位放了图（从 0 起），每个位算一张（还没发版的旧页面）
     * @param refCounts 图片场景：每个素材位放了几张；有它就不看 filled
     * @param text     图片：补充要求；视频：用户写的那句
     * @param custom   图片：用户改过的完整描述（没改为 null）
     * @param revision 编导：对上一版脚本的修改意见（第一次写为 null）
     * @param options  场景选项组：选项组 key → 选中项 value；没给的组用默认值
     * @param seenTitles 编导：放了、但所选视频模型用不上的场景图（商品图、门店照片…），脚本里要用文字写清楚，不能写成图几
     * @param characterSeen 编导：出镜人物这张视频模型也用不上（同上，只给编导看）
     * @param visual   编导：写脚本的模型这次能不能看到图（false = 看不到，只能按名称写）；null 按能看到算（老前端）
     * @param settingsChanged 编导：改稿时设置变了什么（时长、画面、参考图），由环节模板说成一句话；页面不再自己拼话
     */
    public record ComposeRequest(String kind, String sceneId, String text, String custom, List<Integer> filled,
                                 List<String> imageTitles, String characterTitle, String voiceTitle, String videoTitle,
                                 Integer duration, String ratio, String language, String revision, java.util.Map<String, String> options,
                                 List<String> seenTitles, Boolean characterSeen, Boolean visual, String settingsChanged, List<Integer> refCounts) {
        public ComposeRequest(String kind, String sceneId, String text, String custom, List<Integer> filled,
                              List<String> imageTitles, String characterTitle, String voiceTitle, String videoTitle,
                              Integer duration, String ratio, String language, String revision, java.util.Map<String, String> options,
                              List<String> seenTitles, Boolean characterSeen, Boolean visual, String settingsChanged) {
            this(kind, sceneId, text, custom, filled, imageTitles, characterTitle, voiceTitle, videoTitle, duration, ratio, language, revision, options,
                    seenTitles, characterSeen, visual, settingsChanged, null);
        }
        public ComposeRequest(String kind, String sceneId, String text, String custom, List<Integer> filled,
                              List<String> imageTitles, String characterTitle, String voiceTitle, String videoTitle,
                              Integer duration, String ratio, String language, String revision, java.util.Map<String, String> options,
                              List<String> seenTitles, Boolean characterSeen, Boolean visual) {
            this(kind, sceneId, text, custom, filled, imageTitles, characterTitle, voiceTitle, videoTitle, duration, ratio, language, revision, options,
                    seenTitles, characterSeen, visual, null);
        }
        public ComposeRequest(String kind, String sceneId, String text, String custom, List<Integer> filled,
                              List<String> imageTitles, String characterTitle, String voiceTitle, String videoTitle, Integer duration, String ratio) {
            this(kind, sceneId, text, custom, filled, imageTitles, characterTitle, voiceTitle, videoTitle, duration, ratio, null, null, null, null, null, null);
        }
        public ComposeRequest(String kind, String sceneId, String text, String custom, List<Integer> filled,
                              List<String> imageTitles, String characterTitle, String voiceTitle, String videoTitle, Integer duration, String ratio,
                              String language, String revision) {
            this(kind, sceneId, text, custom, filled, imageTitles, characterTitle, voiceTitle, videoTitle, duration, ratio, language, revision, null, null, null, null);
        }
        public ComposeRequest(String kind, String sceneId, String text, String custom, List<Integer> filled,
                              List<String> imageTitles, String characterTitle, String voiceTitle, String videoTitle, Integer duration, String ratio,
                              String language, String revision, java.util.Map<String, String> options) {
            this(kind, sceneId, text, custom, filled, imageTitles, characterTitle, voiceTitle, videoTitle, duration, ratio, language, revision, options, null, null, null);
        }
    }

    public record Composed(String text, String skillKey) {}

    public Composed compose(ComposeRequest request) {
        if (request == null || request.kind() == null) throw bad("请选择场景");
        return switch (request.kind()) {
            case "image" -> new Composed(limit(imagePrompt(request)), null);
            case "video" -> videoBrief(request);
            // 老页面还在用：它把这段话当普通文字任务提交。新页面直接带场景输入提交，由服务端拼（§5.1）。
            case "video-script" -> new Composed(limit(sceneScript(request, null, false, null).user()), null);
            default -> throw bad("请选择场景");
        };
    }

    // ── 按提示词库的环节拼（docs/studio-prompt-architecture.md §8 #12–#14；句子都在 resources/studio/prompts 里） ──────

    static final String STAGE_IMAGE = "stage-scene-image", STAGE_HANDOFF = "stage-scene-handoff", STAGE_SCRIPT = "stage-scene-script";
    public static String sceneKey(String sceneId) { return "scene-" + sceneId; }

    private String imagePrompt(ComposeRequest r) {
        ImageScene scene = image(r.sceneId()).orElseThrow(() -> bad("该场景已下架，请刷新后重新选择"));
        int[] counts = refCounts(scene, r);
        String extra = trim(r.text());
        boolean free = FREE.equals(scene.id());
        if (free && extra.isEmpty()) throw bad("请描述想要的画面");
        java.util.Map<String, Object> vars = new java.util.LinkedHashMap<>();
        vars.put("free", free);
        vars.put("extra", extra);
        vars.put("custom", r.custom() != null && !r.custom().isBlank() ? r.custom().trim() : "");
        vars.put("options", optionItems(scene.optionGroups(), r.options()));
        vars.put("materials", materials(scene, counts));
        return assembler().assemble(new StudioPromptAssembler.Call(STAGE_IMAGE, null, free ? null : sceneKey(scene.id()), vars, null,
                free ? null : trim(scene.prompt()))).user();
    }

    /** 每个素材位放了几张，并按场景的配置检查：必填的放了、没超过上限、「至少放一个」的放了。 */
    private static int[] refCounts(ImageScene scene, ComposeRequest r) {
        List<SceneRef> refs = scene.refs();
        int[] counts = new int[refs.size()];
        if (r.refCounts() != null) {
            if (r.refCounts().size() > refs.size()) throw bad("该场景的素材要求已变化，请刷新后重新选择");
            for (int i = 0; i < r.refCounts().size(); i++) counts[i] = r.refCounts().get(i) == null ? 0 : Math.max(0, r.refCounts().get(i));
        } else if (r.filled() != null) {
            for (int i : r.filled()) if (i >= 0 && i < refs.size()) counts[i] = 1;
        }
        for (int i = 0; i < refs.size(); i++) {
            if (refs.get(i).required() && counts[i] == 0) throw bad("请添加" + refs.get(i).label());
            if (counts[i] > refs.get(i).limit()) throw bad(refs.get(i).label() + "最多 " + refs.get(i).limit() + " 张");
        }
        List<Integer> any = scene.anyOf() == null ? List.of() : scene.anyOf();
        if (!any.isEmpty() && any.stream().allMatch(i -> counts[i] == 0))
            throw bad("请添加" + String.join("或", any.stream().map(i -> refs.get(i).label()).toList()));
        return counts;
    }

    /**
     * 告诉模型每张图是做什么的（{photos, role}），按实际交给模型的顺序编号：图片按素材位排，空着的位不占号。
     * 场景描述只写「模特」「商品」这些名字，不写图1、图2，所以放几张、哪个选填位空着，描述都不用变。
     */
    private static List<java.util.Map<String, Object>> materials(ImageScene scene, int[] counts) {
        List<java.util.Map<String, Object>> out = new ArrayList<>();
        int position = 0;
        for (int i = 0; i < counts.length; i++) {
            if (counts[i] == 0) continue;
            List<String> names = new ArrayList<>();
            for (int n = 0; n < counts[i]; n++) names.add("图" + ++position);
            out.add(java.util.Map.of("photos", String.join("、", names), "role", scene.refs().get(i).usedAs(counts[i])));
        }
        return out;
    }

    /** 选中的选项（{label, prompt}），没给的组用默认值；后台下架的选项 400，让页面刷新后重选。 */
    static List<java.util.Map<String, Object>> optionItems(List<OptionGroup> groups, java.util.Map<String, String> picked) {
        java.util.Map<String, String> chosen = picked == null ? java.util.Map.of() : picked;
        for (String key : chosen.keySet()) if (groups.stream().noneMatch(g -> g.key().equals(key))) throw bad("该选项已下架，请刷新后重新选择");
        List<java.util.Map<String, Object>> out = new ArrayList<>();
        for (OptionGroup g : groups) {
            String value = chosen.getOrDefault(g.key(), g.defaultValue());
            OptionChoice choice = g.choices().stream().filter(c -> c.value().equals(value)).findFirst().orElseThrow(() -> bad("该选项已下架，请刷新后重新选择"));
            out.add(java.util.Map.of("label", g.label(), "prompt", choice.prompt()));
        }
        return out;
    }

    /** 两个视频环节共用的变量：时长、画面、场景名、用户的话、选项、要用到的信息。 */
    private java.util.Map<String, Object> videoVars(VideoInput in, ComposeRequest r) {
        VideoScene scene = in.scene();
        java.util.Map<String, Object> vars = new java.util.LinkedHashMap<>();
        vars.put("duration", in.duration());
        vars.put("orientation", orientation(in.ratio()));
        vars.put("sceneTitle", scene.title());
        vars.put("ask", in.text());
        vars.put("options", optionItems(scene.optionGroups(), r.options()));
        Brief b = scene.brief();
        List<Fact> facts = b == null ? List.of() : b.factList().stream().filter(f -> f != null && !blank(f.label())).toList();
        vars.put("hasBrief", b != null);
        vars.put("goal", b == null || blank(b.goal()) ? "" : b.goal().trim());
        vars.put("ending", b == null || blank(b.ending()) ? "" : b.ending().trim());
        vars.put("hasFacts", !facts.isEmpty());
        vars.put("facts", facts.stream().map(f -> java.util.Map.<String, Object>of("label", f.label().trim(), "use", blank(f.use()) ? "" : f.use().trim())).toList());
        List<String> required = facts.stream().filter(f -> f.required() && !f.canInfer()).map(f -> f.label().trim()).toList();
        List<String> inferable = facts.stream().filter(Fact::canInfer).map(f -> f.label().trim()).toList();
        vars.put("hasRequired", !required.isEmpty());
        vars.put("required", required);
        vars.put("hasInferable", !inferable.isEmpty());
        vars.put("inferable", inferable);
        vars.put("noFiction", b != null && b.noFiction());
        return vars;
    }

    private Composed videoBrief(ComposeRequest r) {
        VideoInput in = videoInput(r, true);
        VideoScene scene = in.scene();
        java.util.Map<String, Object> vars = videoVars(in, r);
        List<java.util.Map<String, Object>> materials = new ArrayList<>();
        if (!blank(r.videoTitle())) materials.add(material("isVideo", r.videoTitle().trim(), List.of(), ""));
        if (!in.images().isEmpty()) materials.add(material("isImages", "", in.images().stream().map(String::trim).toList(), scene.images().label()));
        if (!blank(r.characterTitle())) materials.add(material("isCharacter", r.characterTitle().trim(), List.of(), ""));
        if (!blank(r.voiceTitle())) materials.add(material("isVoice", r.voiceTitle().trim(), List.of(), ""));
        vars.put("hasMaterials", !materials.isEmpty());
        vars.put("materials", materials);
        vars.put("noAsk", in.text().isEmpty() && !materials.isEmpty());
        String text = assembler().assemble(new StudioPromptAssembler.Call(STAGE_HANDOFF, null, sceneKey(scene.id()), vars, null, scene.structure())).user();
        return new Composed(limit(text), scene.skill());
    }

    private static java.util.Map<String, Object> material(String kind, String title, List<String> titles, String label) {
        java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
        for (String k : List.of("isVideo", "isImages", "isCharacter", "isVoice")) m.put(k, k.equals(kind));
        m.put("title", title); m.put("titles", titles); m.put("label", label);
        return m;
    }

    /**
     * 编导写脚本（AI 视频页，照参考站「超级编导」）：看素材、按场景拍法写一版能直接交给视频模型一次生成的五段式方案
     * （docs/studio-prompt-architecture.md §9.3）。参考图按这里的顺序交给视频模型，脚本里用「图1」「图2」指代；
     * 只给会交给视频模型的图编号（2026-10-30 审查 F07），剩下的图（{@code seenTitles}）只给编导看、要用文字写进画面。
     * 写脚本的模型看不到图时（{@code visual=false}）不说「已附图片」「先看图」，否则它会编图里的内容。
     *
     * @param current     当前脚本（改稿时），第一次写为 null
     * @param readVisuals 这次真的附了图（附图说明由代码给）
     * @param frozen      受理时冻结的版本；为 null 时用当前版本
     */
    public StudioPromptAssembler.Assembled sceneScript(ComposeRequest r, String current, boolean readVisuals, java.util.Map<String, Integer> frozen) {
        VideoInput in = videoInput(r, false);
        VideoScene scene = in.scene();
        java.util.Map<String, Object> vars = scriptVars(in, r, current, readVisuals);
        String method = groupMethod(scene.group());
        return assembler().assemble(new StudioPromptAssembler.Call(STAGE_SCRIPT, method, sceneKey(scene.id()), vars, frozen, scene.structure()));
    }

    /**
     * 长视频的分段脚本（docs/studio-segmented-video.md）：素材、场景拍法和编导一样，只是段数和每段秒数定好了，输出是结构化镜头。
     * {@code segments} 是 {@code SegmentedPlan.Segment} 的 no / seconds / shotsLo / shotsHi。
     */
    public StudioPromptAssembler.Assembled segmentedScript(ComposeRequest r, List<java.util.Map<String, Object>> segments, boolean hasScript, boolean singleShot,
                                                           boolean readVisuals, java.util.Map<String, Integer> frozen) {
        VideoInput in = videoInput(r, false);
        java.util.Map<String, Object> vars = scriptVars(in, r, null, readVisuals);
        vars.put("segments", segments);
        vars.put("hasScript", hasScript);
        vars.put("singleShot", singleShot);
        return assembler().assemble(new StudioPromptAssembler.Call(com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints.SEGMENTED_SCRIPT, groupMethod(in.scene().group()), sceneKey(in.scene().id()), vars, frozen, in.scene().structure()));
    }

    /** 开拍前审一轮：只看脚本和要求，不拼场景拍法，避免按拍法又重写一遍。 */
    public StudioPromptAssembler.Assembled segmentedReview(ComposeRequest r, List<java.util.Map<String, Object>> segments, List<String> issues, String current, java.util.Map<String, Integer> frozen) {
        java.util.Map<String, Object> vars = new java.util.LinkedHashMap<>();
        vars.put("duration", r.duration());
        vars.put("orientation", orientation(r.ratio()));
        vars.put("ask", trim(r.text()));
        vars.put("segments", segments);
        vars.put("hasIssues", !issues.isEmpty());
        vars.put("issues", issues);
        vars.put("current", current);
        return assembler().assemble(new StudioPromptAssembler.Call(com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints.SEGMENTED_REVIEW, null, null, vars, frozen, null));
    }

    /** 受理时冻结分段脚本用到的版本（审稿不拼场景，多冻结也不影响）。 */
    public java.util.Map<String, Integer> freezeSegmented(String sceneId) {
        VideoScene scene = video(sceneId).orElseThrow(() -> bad("该场景已下架，请刷新后重新选择"));
        List<String> keys = new ArrayList<>(List.of(com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints.SEGMENTED_SCRIPT, com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints.SEGMENTED_REVIEW, sceneKey(scene.id())));
        String method = groupMethod(scene.group());
        if (method != null) keys.add(method);
        return assembler().freeze(keys);
    }

    /** 编导和分段脚本共用的变量：素材编号、看不看得到图。 */
    private java.util.Map<String, Object> scriptVars(VideoInput in, ComposeRequest r, String current, boolean readVisuals) {
        VideoScene scene = in.scene();
        java.util.Map<String, Object> vars = videoVars(in, r);
        vars.put("language", blank(r.language()) ? "中文" : r.language().trim());
        String revision = trim(r.revision()), changed = trim(r.settingsChanged());
        vars.put("revision", revision);
        vars.put("settingsChanged", changed);
        vars.put("revising", !revision.isEmpty() || !changed.isEmpty());
        boolean visual = !Boolean.FALSE.equals(r.visual());
        vars.put("visual", visual);
        List<java.util.Map<String, Object>> refs = new ArrayList<>();
        int n = 0;
        for (String title : in.images()) refs.add(java.util.Map.of("n", ++n, "title", title.trim(), "label", scene.images().label(), "person", false));
        boolean characterSeen = Boolean.TRUE.equals(r.characterSeen());
        if (!blank(r.characterTitle()) && !characterSeen) refs.add(java.util.Map.of("n", ++n, "title", r.characterTitle().trim(), "label", "出镜人物", "person", true));
        List<String> seen = new ArrayList<>(r.seenTitles() == null ? List.of() : r.seenTitles().stream().filter(t -> !blank(t)).map(String::trim).toList());
        if (!blank(r.characterTitle()) && characterSeen) seen.add(r.characterTitle().trim());
        String voice = blank(r.voiceTitle()) ? "" : r.voiceTitle().trim();
        vars.put("hasRefs", !refs.isEmpty());
        vars.put("refs", refs);
        vars.put("voice", voice);
        vars.put("voiceOnly", refs.isEmpty() && !voice.isEmpty());
        vars.put("hasSeen", !seen.isEmpty());
        vars.put("seen", seen);
        vars.put("blind", !visual && (!refs.isEmpty() || !seen.isEmpty()));
        vars.put("noAsk", in.text().isEmpty() && (!refs.isEmpty() || !seen.isEmpty()));
        vars.put("current", current == null || current.isBlank() ? "" : JSON.valueToTree(current).toString());
        vars.put("readVisuals", readVisuals);
        return vars;
    }

    /** 编导受理时冻结的条目：环节、底座、场景、所属分组的内容方法（有的话）。 */
    public java.util.Map<String, Integer> freezeSceneScript(String sceneId) {
        VideoScene scene = video(sceneId).orElseThrow(() -> bad("该场景已下架，请刷新后重新选择"));
        List<String> keys = new ArrayList<>(List.of(STAGE_SCRIPT, sceneKey(scene.id())));
        String method = groupMethod(scene.group());
        if (method != null) keys.add(method);
        return assembler().freeze(keys);
    }

    /** 场景分组对应的内容方法（{@code method-<分组>}，§9.8：第一版为空，库里有了就用）。 */
    private String groupMethod(String group) {
        if (blank(group)) return null;
        String key = "method-" + group;
        var lib = library();
        return lib != null && lib.find(key).filter(e -> !e.withdrawn()).isPresent() ? key : null;
    }

    /** 视频两种用法共用的输入检查：素材够不够、时长和画面对不对。 */
    private record VideoInput(VideoScene scene, List<String> images, String text, int duration, String ratio) {}
    /** 交给创作助手的视频最长多少秒（AI 视频页的时长滑块上限）。 */
    static final int MAX_HANDOFF_SECONDS = 60;

    private VideoInput videoInput(ComposeRequest r, boolean sceneDurations) {
        VideoScene scene = video(r.sceneId()).orElseThrow(() -> bad("该场景已下架，请刷新后重新选择"));
        List<String> images = r.imageTitles() == null ? List.of() : r.imageTitles().stream().filter(t -> t != null && !t.isBlank()).toList();
        String text = trim(r.text());
        if (scene.video() != null && scene.video().required() && blank(r.videoTitle())) throw bad("请添加" + scene.video().label());
        // 放了几张图看页面上放的全部：所选视频模型用不上的那几张（seenTitles）用户也放了，只是不编号。
        long placed = images.size() + (r.seenTitles() == null ? 0 : r.seenTitles().stream().filter(t -> !blank(t)).count());
        if (scene.images().required() && placed == 0) throw bad("请添加" + scene.images().label());
        if (scene.images().max() != null && placed > scene.images().max()) throw bad(scene.images().label() + "最多 " + scene.images().max() + " 张");
        if (scene.textRequired() && text.isEmpty() && blank(r.revision())) throw bad("请填写要求");
        int duration = r.duration() == null ? scene.duration() : r.duration();
        // 交给助手时最长 60 秒（页面上拖动选，超过模型单段上限由助手分段做再拼起来，2026-10-31 改版）；
        // 编导一次出片时长由所选视频模型决定，这里只挡明显不对的数。
        if (duration < 1 || duration > (sceneDurations ? MAX_HANDOFF_SECONDS : 120)) throw bad("请选择可用的时长");
        String ratio = r.ratio() == null ? scene.ratio() : r.ratio();
        if (!List.of("9:16", "16:9").contains(ratio)) throw bad("请选择竖屏或横屏");
        return new VideoInput(scene, images, text, duration, ratio);
    }

    private static String orientation(String ratio) { return "16:9".equals(ratio) ? "横屏" : "竖屏"; }

    // ── 加载与校验 ─────────────────────────────────────────────────────────

    public static Catalog load(String path) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return JSON.readValue(in, Catalog.class);
        } catch (IOException e) {
            throw new IllegalStateException("场景目录读不出来：" + path, e);
        }
    }

    /** 后台或别处直接改平台配置时的同一道闸（{@link PlatformConfigService#upsert} 也调它）。 */
    public static void validateJson(JsonNode value) {
        if (marksBuiltIn(value)) return;
        try { validate(JSON.treeToValue(value, Catalog.class)); }
        catch (IllegalStateException e) { throw BusinessException.badRequest("STUDIO_SCENE_CATALOG_INVALID", e.getMessage()); }
        catch (Exception e) { throw BusinessException.badRequest("STUDIO_SCENE_CATALOG_INVALID", "场景目录格式不对：" + e.getMessage()); }
    }

    public static Catalog validate(Catalog c) {
        if (c == null || c.image() == null || c.video() == null || c.imageGroups() == null || c.videoGroups() == null) throw new IllegalStateException("场景目录为空");
        Set<String> ids = new HashSet<>();
        Set<String> imageGroups = groups(c.imageGroups(), "图片");
        Set<String> videoGroups = groups(c.videoGroups(), "视频");
        for (ImageScene s : c.image()) {
            String name = blank(s.title()) ? s.id() : s.title();
            if (blank(s.id()) || !s.id().matches("[a-z0-9][a-z0-9-]{0,47}")) throw new IllegalStateException("场景编号只能用小写字母、数字和横线：" + s.id());
            if (!ids.add(s.id())) throw new IllegalStateException("场景编号重复：" + s.id());
            if (!imageGroups.contains(s.group())) throw new IllegalStateException("场景分组不存在：" + name);
            if (blank(s.title()) || blank(s.description())) throw new IllegalStateException("场景要有名称和一句说明：" + s.id());
            if (s.refs() == null || s.refs().size() > 6) throw new IllegalStateException("参考图位最多 6 个：" + name);
            if (s.refs().stream().anyMatch(r -> r == null || blank(r.label()))) throw new IllegalStateException("参考图位要有名称：" + name);
            refLimits(s, name);
            if (!FREE.equals(s.id())) {
                if (blank(s.prompt())) throw new IllegalStateException("场景要写好出图描述：" + name);
                if (s.prompt().contains("【") || s.prompt().contains("】")) throw new IllegalStateException("场景描述不能留【…】空位：" + name);
                if (REF.matcher(s.prompt()).find()) throw new IllegalStateException("场景描述按素材的名字写，不要写图1、图2（编号随放了几张变）：" + name);
                if (s.refs().isEmpty() || !s.refs().get(0).required()) throw new IllegalStateException("图1 必须是必填参考图：" + name);
            }
            if (!List.of("1:1", "3:4", "4:3", "9:16", "16:9").contains(s.ratio())) throw new IllegalStateException("默认比例不对：" + name);
            media(s.coverKey(), s.exampleKeys(), name);
            options(s.optionGroups(), name);
        }
        for (VideoScene s : c.video()) {
            String name = blank(s.title()) ? s.id() : s.title();
            if (blank(s.id()) || !s.id().matches("[a-z0-9][a-z0-9-]{0,47}")) throw new IllegalStateException("场景编号只能用小写字母、数字和横线：" + s.id());
            if (!ids.add(s.id())) throw new IllegalStateException("场景编号重复：" + s.id());
            if (!videoGroups.contains(s.group())) throw new IllegalStateException("场景分组不存在：" + name);
            if (blank(s.title()) || blank(s.description())) throw new IllegalStateException("场景要有名称和一句说明：" + s.id());
            if (s.images() == null || blank(s.images().label())) throw new IllegalStateException("要写清楚图片素材叫什么：" + name);
            if (s.images().max() != null && (s.images().max() < 1 || s.images().max() > 9)) throw new IllegalStateException("图片素材最多 1 到 9 张：" + name);
            if (s.video() != null && blank(s.video().label())) throw new IllegalStateException("要写清楚参考视频叫什么：" + name);
            if (blank(s.structure())) throw new IllegalStateException("要写好拍法：" + name);
            if (blank(s.skill()) || !VIDEO_SKILLS.contains(s.skill())) throw new IllegalStateException("视频场景没写用哪种方法：" + name);
            if (s.durations() == null || s.durations().isEmpty() || !s.durations().contains(s.duration())) throw new IllegalStateException("默认时长不在可选时长里：" + name);
            if (!List.of("9:16", "16:9").contains(s.ratio())) throw new IllegalStateException("默认画面只能是竖屏或横屏：" + name);
            if (s.ideas() == null || s.ideas().size() > 8) throw new IllegalStateException("常用开头最多 8 个：" + name);
            brief(s.brief(), name);
            media(s.coverKey(), s.exampleKeys(), name);
            options(s.optionGroups(), name);
        }
        Set<String> goals = new HashSet<>();
        if (c.goals().size() > 12) throw new IllegalStateException("首页卡片最多 12 张");
        for (HomeGoal g : c.goals()) {
            if (g == null || blank(g.id()) || !g.id().matches("[a-z0-9][a-z0-9-]{0,47}") || !goals.add(g.id())) throw new IllegalStateException("首页卡片编号只能用小写字母、数字和横线，且不能重复");
            if (blank(g.title()) || blank(g.description())) throw new IllegalStateException("首页卡片要有标题和一句说明：" + g.id());
            if (!ids.contains(g.sceneId())) throw new IllegalStateException("首页卡片「" + g.title() + "」指向的场景不存在");
            if (g.covers() != null && (g.covers().size() > 2 || !ids.containsAll(g.covers()))) throw new IllegalStateException("首页卡片「" + g.title() + "」的封面要选已有的场景，最多两个");
        }
        return c;
    }
    private static void brief(Brief b, String name) {
        if (b == null) return;
        if (b.goal() != null && b.goal().length() > 60) throw new IllegalStateException("「要做到」一句话，最多 60 字：" + name);
        if (b.ending() != null && b.ending().length() > 40) throw new IllegalStateException("结尾一句话，最多 40 字：" + name);
        if (b.fiction() != null && !List.of("none", "story").contains(b.fiction())) throw new IllegalStateException("能不能编只能选「只用给的」或「可以编故事」：" + name);
        if (b.factList().size() > 6) throw new IllegalStateException("要用户给的信息最多 6 条：" + name);
        if (b.factList().stream().filter(Fact::required).count() > 4) throw new IllegalStateException("必须给的信息最多 4 条：" + name);
        for (Fact f : b.factList()) if (f == null || blank(f.label()) || f.label().length() > 16 || f.use() != null && f.use().length() > 24)
            throw new IllegalStateException("信息要有名称（最多 16 字），用法最多 24 字：" + name);
    }

    private static void options(List<OptionGroup> groups, String name) {
        if (groups.size() > 4) throw new IllegalStateException("选项组最多 4 组：" + name);
        Set<String> keys = new HashSet<>();
        for (OptionGroup g : groups) {
            if (g == null || blank(g.key()) || !g.key().matches("[a-z0-9][a-z0-9-]{0,31}") || !keys.add(g.key())) throw new IllegalStateException("选项组编号只能用小写字母、数字和横线，且不能重复：" + name);
            if (blank(g.label()) || g.choices() == null || g.choices().size() < 2 || g.choices().size() > 8) throw new IllegalStateException("选项组要有名称和 2 到 8 个选项：" + name);
            Set<String> values = new HashSet<>();
            for (OptionChoice o : g.choices()) {
                if (o == null || blank(o.value()) || !values.add(o.value()) || blank(o.label()) || blank(o.prompt())) throw new IllegalStateException("「" + g.label() + "」的选项要有编号、名称和拼进描述的话，编号不能重复：" + name);
                if (o.prompt().contains("【") || o.prompt().contains("】")) throw new IllegalStateException("选项的话不能留【…】空位：" + name);
            }
            if (!values.contains(g.defaultValue())) throw new IllegalStateException("「" + g.label() + "」的默认选项不在选项里：" + name);
        }
    }
    private static Set<String> groups(List<Group> list, String kind) {
        Set<String> out = new HashSet<>();
        for (Group g : list) if (g == null || blank(g.id()) || blank(g.title()) || !out.add(g.id())) throw new IllegalStateException(kind + "分组要有编号和名称，编号不能重复");
        return out;
    }
    private static void media(String cover, List<String> examples, String name) {
        List<String> keys = new ArrayList<>();
        if (!blank(cover)) keys.add(cover);
        if (examples != null) keys.addAll(examples);
        if (examples != null && examples.size() > 6) throw new IllegalStateException("参考示例最多 6 个：" + name);
        for (String k : keys) if (blank(k) || !k.startsWith(MEDIA_PREFIX)) throw new IllegalStateException("封面和示例只能用后台上传的文件：" + name);
    }

    private static BusinessException bad(String message) { return BusinessException.badRequest("STUDIO_SCENE_INPUT_INVALID", message); }
    private static boolean blank(String v) { return v == null || v.isBlank(); }
    private static String trim(String v) { return v == null ? "" : v.trim(); }
    private static void refLimits(ImageScene s, String name) {
        for (SceneRef r : s.refs()) if (r.max() != null && (r.max() < 1 || r.max() > 9)) throw new IllegalStateException("「" + r.label() + "」最多放 1 到 9 张：" + name);
        if (s.anyOf() == null) return;
        for (int i : s.anyOf()) if (i < 0 || i >= s.refs().size() || s.refs().get(i).required()) throw new IllegalStateException("「至少放一个」只能选已有的选填素材位：" + name);
    }

    private static String limit(String v) {
        if (v.length() > 16000) throw bad("描述最多 16000 字");
        return v;
    }
}
