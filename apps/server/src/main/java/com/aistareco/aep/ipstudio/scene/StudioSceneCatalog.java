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
import java.util.regex.Matcher;
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
    public record SceneRef(String label, boolean required, String hint) {}
    /** 出 wire 时由 key 签出的地址；目录里只存 key。 */
    public record Media(String url, String mediaType) {}
    public record ImageScene(String id, String group, String title, String description, List<SceneRef> refs, String prompt, String hint, String ratio,
                             Boolean enabled, String coverKey, List<String> exampleKeys, String coverUrl, List<Media> examples) {
        public ImageScene(String id, String group, String title, String description, List<SceneRef> refs, String prompt, String hint, String ratio) {
            this(id, group, title, description, refs, prompt, hint, ratio, null, null, null, null, null);
        }
        public boolean on() { return enabled == null || enabled; }
        ImageScene media(String cover, List<Media> list) { return new ImageScene(id, group, title, description, refs, prompt, hint, ratio, enabled, coverKey, exampleKeys, cover, list); }
    }
    public record Slot(String label, boolean required, Integer max) {}
    public record VideoScene(String id, String group, String title, String description, Slot images, Slot video, boolean character, boolean voice,
                             String placeholder, boolean textRequired, List<Integer> durations, int duration, String ratio, String structure,
                             List<String> ideas, String skill, Boolean enabled, String coverKey, List<String> exampleKeys, String coverUrl, List<Media> examples) {
        public boolean on() { return enabled == null || enabled; }
        VideoScene media(String cover, List<Media> list) {
            return new VideoScene(id, group, title, description, images, video, character, voice, placeholder, textRequired, durations, duration, ratio,
                    structure, ideas, skill, enabled, coverKey, exampleKeys, cover, list);
        }
    }
    public record Catalog(int version, List<Group> imageGroups, List<Group> videoGroups, List<ImageScene> image, List<VideoScene> video) {}

    /** 自由出图：没有固定描述，只有用户自己写的那句。 */
    public static final String FREE = "free";
    /** 视频场景能指定的方法：一次出片和复刻都在这里，别处没有的方法不让后台随手填。 */
    public static final Set<String> VIDEO_SKILLS = Set.of("video-generation", "reference-video-recreation");
    private static final Pattern REF = Pattern.compile("图(\\d)");
    private static final ObjectMapper JSON = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private final Catalog builtIn;
    private PlatformConfigService config;
    private volatile Cached cached;
    private record Cached(int version, Catalog catalog) {}

    public StudioSceneCatalog() { this(load("ipstudio/scenes.json")); }

    StudioSceneCatalog(Catalog catalog) { this.builtIn = validate(catalog); }

    @Autowired(required = false)
    void setConfig(PlatformConfigService config) { this.config = config; }

    /** 当前生效的整份目录（含下架的场景）：后台改过用后台的，否则随包那份。 */
    public Catalog catalog() {
        var saved = stored();
        if (saved.isEmpty()) return builtIn;
        var current = cached;
        if (current != null && current.version() == saved.get().version()) return current.catalog();
        try {
            Catalog parsed = validate(JSON.treeToValue(saved.get().value(), Catalog.class));
            cached = new Cached(saved.get().version(), parsed);
            return parsed;
        } catch (Exception e) {
            // 保存时已经校验过，走到这里说明有人绕过后台直接改了库。整页不能因此打不开：用随包那份，并大声报出来。
            log.error("[studio-scene] saved catalog version={} is invalid, serving the built-in one: {}", saved.get().version(), e.getMessage());
            return builtIn;
        }
    }
    /** 随包那份（后台「恢复默认」看的就是它）。 */
    public Catalog builtIn() { return builtIn; }
    /** 后台存过的那份的版本号；没存过是 0。 */
    public int savedVersion() { return stored().map(PlatformConfigDto::version).orElse(0); }
    private Optional<PlatformConfigDto> stored() { return config == null ? Optional.empty() : config.findByKey(CONFIG_KEY); }

    /** 用户能看到的：只留上架的场景，key 换成签过名的地址（key 和上下架标记不出 wire）。 */
    public Catalog published(Function<String, String> sign) {
        Catalog c = catalog();
        return new Catalog(c.version(), c.imageGroups(), c.videoGroups(),
                c.image().stream().filter(ImageScene::on).map(s -> new ImageScene(s.id(), s.group(), s.title(), s.description(), s.refs(), s.prompt(), s.hint(), s.ratio(),
                        null, null, null, url(s.coverKey(), sign), examples(s.exampleKeys(), sign))).toList(),
                c.video().stream().filter(VideoScene::on).map(s -> new VideoScene(s.id(), s.group(), s.title(), s.description(), s.images(), s.video(), s.character(), s.voice(),
                        s.placeholder(), s.textRequired(), s.durations(), s.duration(), s.ratio(), s.structure(), s.ideas(), s.skill(),
                        null, null, null, url(s.coverKey(), sign), examples(s.exampleKeys(), sign))).toList());
    }
    /** 给每个场景补上封面和示例的地址（后台预览也用）。 */
    public static Catalog withMedia(Catalog c, Function<String, String> sign) {
        return new Catalog(c.version(), c.imageGroups(), c.videoGroups(),
                c.image().stream().map(s -> s.media(url(s.coverKey(), sign), examples(s.exampleKeys(), sign))).toList(),
                c.video().stream().map(s -> s.media(url(s.coverKey(), sign), examples(s.exampleKeys(), sign))).toList());
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
     * @param filled   图片场景：哪几个参考图位放了图（从 0 起）
     * @param text     图片：补充要求；视频：用户写的那句
     * @param custom   图片：用户改过的完整描述（没改为 null）
     * @param revision 编导：对上一版脚本的修改意见（第一次写为 null）
     */
    public record ComposeRequest(String kind, String sceneId, String text, String custom, List<Integer> filled,
                                 List<String> imageTitles, String characterTitle, String voiceTitle, String videoTitle,
                                 Integer duration, String ratio, String language, String revision) {
        public ComposeRequest(String kind, String sceneId, String text, String custom, List<Integer> filled,
                              List<String> imageTitles, String characterTitle, String voiceTitle, String videoTitle, Integer duration, String ratio) {
            this(kind, sceneId, text, custom, filled, imageTitles, characterTitle, voiceTitle, videoTitle, duration, ratio, null, null);
        }
    }
    public record Composed(String text, String skillKey) {}

    public Composed compose(ComposeRequest request) {
        if (request == null || request.kind() == null) throw bad("请选择场景");
        return switch (request.kind()) {
            case "image" -> new Composed(imagePrompt(request), null);
            case "video" -> videoBrief(request);
            case "video-script" -> new Composed(scriptBrief(request), null);
            default -> throw bad("请选择场景");
        };
    }

    private String imagePrompt(ComposeRequest r) {
        ImageScene scene = image(r.sceneId()).orElseThrow(() -> bad("这个场景不存在，请刷新后重选"));
        Set<Integer> filled = r.filled() == null ? Set.of() : new HashSet<>(r.filled());
        for (int i = 0; i < scene.refs().size(); i++)
            if (scene.refs().get(i).required() && !filled.contains(i)) throw bad("先放" + scene.refs().get(i).label());
        String extra = trim(r.text());
        if (FREE.equals(scene.id())) {
            if (extra.isEmpty()) throw bad("写一句想要的画面");
            return limit(extra);
        }
        String base = r.custom() != null && !r.custom().isBlank() ? r.custom().trim() : scene.prompt().trim();
        return limit(extra.isEmpty() ? base : base + "\n补充要求：" + extra);
    }

    /** 视频两种用法共用的输入检查：素材够不够、时长和画面对不对。 */
    private record VideoInput(VideoScene scene, List<String> images, String text, int duration, String ratio) {}
    private VideoInput videoInput(ComposeRequest r, boolean sceneDurations) {
        VideoScene scene = video(r.sceneId()).orElseThrow(() -> bad("这个场景不存在，请刷新后重选"));
        List<String> images = r.imageTitles() == null ? List.of() : r.imageTitles().stream().filter(t -> t != null && !t.isBlank()).toList();
        String text = trim(r.text());
        if (scene.video() != null && scene.video().required() && blank(r.videoTitle())) throw bad("先放" + scene.video().label());
        if (scene.images().required() && images.isEmpty()) throw bad("先放" + scene.images().label());
        if (scene.images().max() != null && images.size() > scene.images().max()) throw bad(scene.images().label() + "最多放 " + scene.images().max() + " 张");
        if (scene.textRequired() && text.isEmpty() && blank(r.revision())) throw bad("先写一句要求");
        int duration = r.duration() == null ? scene.duration() : r.duration();
        // 交给助手时按场景的可选时长；编导一次出片时长由所选视频模型决定，这里只挡明显不对的数。
        if (sceneDurations ? !scene.durations().contains(duration) : duration < 1 || duration > 120) throw bad("请选择可用的时长");
        String ratio = r.ratio() == null ? scene.ratio() : r.ratio();
        if (!List.of("9:16", "16:9").contains(ratio)) throw bad("请选择竖屏或横屏");
        return new VideoInput(scene, images, text, duration, ratio);
    }

    private Composed videoBrief(ComposeRequest r) {
        VideoInput in = videoInput(r, true);
        VideoScene scene = in.scene();
        List<String> lines = new ArrayList<>();
        lines.add("帮我做一条 " + in.duration() + " 秒的" + orientation(in.ratio()) + "短视频，类型是「" + scene.title() + "」。");
        if (!in.text().isEmpty()) lines.add("我的要求：" + in.text());
        List<String> materials = new ArrayList<>();
        if (!blank(r.videoTitle())) materials.add("「" + r.videoTitle().trim() + "」是要复刻的参考视频");
        if (!in.images().isEmpty()) materials.add(String.join("", in.images().stream().map(t -> "「" + t.trim() + "」").toList()) + "是上传的" + scene.images().label() + "，画面里出现时要和它一致");
        if (!blank(r.characterTitle())) materials.add("「" + r.characterTitle().trim() + "」是出镜人物，长相和穿着保持一致");
        if (!blank(r.voiceTitle())) materials.add("「" + r.voiceTitle().trim() + "」是配音要用的声音");
        if (!materials.isEmpty()) lines.add("画布上的素材：" + String.join("；", materials) + "。");
        if (in.text().isEmpty() && !materials.isEmpty()) lines.add("我没写具体要求，先看素材，再按下面的拍法出方案。");
        lines.add("拍法：" + scene.structure());
        // 老板没给的价格、优惠、地址，模型最容易顺手编一个，写进成片就是虚假宣传。
        lines.add("上面没写的信息（价格、优惠、地址、功效数据）不要自己编。");
        // 只说「先给我分镜方案」时，真模型（2026-10-29 本地聚算 Qwen）只排了一步写脚本，做完也不提出视频。
        lines.add("要的是做好的视频，不只是脚本：把文案、分镜和每段视频一起排进方案，报总共要花的积分，我确认后一次生成。");
        return new Composed(limit(String.join("\n", lines)), scene.skill());
    }

    /**
     * 编导写脚本（AI 视频页，照参考站「超级编导」）：看素材、按场景拍法写一版能直接交给视频模型一次生成的脚本。
     * 参考图按这里的顺序交给视频模型，脚本里用「图1」「图2」指代；出片前我们的改写会换成模型认的写法。
     */
    private String scriptBrief(ComposeRequest r) {
        VideoInput in = videoInput(r, false);
        VideoScene scene = in.scene();
        String language = blank(r.language()) ? "中文" : r.language().trim();
        List<String> lines = new ArrayList<>();
        if (!blank(r.revision())) lines.add("按这条修改意见改当前脚本，没提到的地方保持不变：" + r.revision().trim() + "\n\n这条视频原来的要求（仍然有效）：");
        lines.add("写一条 " + in.duration() + " 秒的" + orientation(in.ratio()) + "「" + scene.title() + "」短视频脚本，交给视频模型一次生成，台词用" + language + "。");
        if (!in.text().isEmpty()) lines.add("我的要求：" + in.text());
        List<String> refs = new ArrayList<>();
        int n = 0;
        for (String title : in.images()) refs.add("图" + (++n) + "「" + title.trim() + "」是" + scene.images().label());
        if (!blank(r.characterTitle())) refs.add("图" + (++n) + "「" + r.characterTitle().trim() + "」是出镜人物，长相和穿着要和图里一致");
        if (!blank(r.voiceTitle())) refs.add("「" + r.voiceTitle().trim() + "」是说话要用的声音");
        if (!refs.isEmpty()) lines.add("参考素材（已附图片，按这个编号写）：" + String.join("；", refs) + "。");
        if (in.text().isEmpty() && !refs.isEmpty()) lines.add("我没写具体要求：先看图，说清楚是什么、卖点在哪，再按下面的拍法写。");
        lines.add("拍法：" + scene.structure());
        lines.add("写法：按时间顺序分镜头，每个镜头单独一行，格式是「镜头N（起–止秒）：画面……；台词：……」，没有台词就不写台词。"
                + "单个镜头 2 到 5 秒，所有镜头加起来正好 " + in.duration() + " 秒。台词说人话，按每秒 4 个字左右算长度。"
                + "只写镜头里看得见、听得见的东西，不写拍摄建议、不写给人看的解释。");
        // 2026-10-29 本地真 Qwen：拍法写着「结尾讲优惠」，用户没给优惠，它就写了句「现在下单有优惠」。没给的就不提，只引导下单。
        lines.add("上面没写的信息（价格、优惠、地址、功效数据）不要自己编，也不要说「有优惠」「限时」这类没给过的话；拍法里要讲但我没给的，就只引导关注或下单。");
        lines.add("正文只放脚本本身；summary 用一句话说这一版的思路。");
        return limit(String.join("\n", lines));
    }

    private static String orientation(String ratio) { return "16:9".equals(ratio) ? "横屏" : "竖屏"; }

    // ── 加载与校验 ─────────────────────────────────────────────────────────

    static Catalog load(String path) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return JSON.readValue(in, Catalog.class);
        } catch (IOException e) {
            throw new IllegalStateException("场景目录读不出来：" + path, e);
        }
    }

    /** 后台或别处直接改平台配置时的同一道闸（{@link PlatformConfigService#upsert} 也调它）。 */
    public static void validateJson(JsonNode value) {
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
            if (!FREE.equals(s.id())) {
                if (blank(s.prompt())) throw new IllegalStateException("场景要写好出图描述：" + name);
                if (s.prompt().contains("【") || s.prompt().contains("】")) throw new IllegalStateException("场景描述不能留【…】空位：" + name);
                Matcher m = REF.matcher(s.prompt());
                while (m.find()) if (Integer.parseInt(m.group(1)) > s.refs().size()) throw new IllegalStateException("场景描述点了不存在的参考图：" + name);
                if (s.refs().isEmpty() || !s.refs().get(0).required()) throw new IllegalStateException("图1 必须是必填参考图：" + name);
            }
            if (!List.of("1:1", "3:4", "4:3", "9:16", "16:9").contains(s.ratio())) throw new IllegalStateException("默认比例不对：" + name);
            media(s.coverKey(), s.exampleKeys(), name);
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
            media(s.coverKey(), s.exampleKeys(), name);
        }
        return c;
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
    private static String limit(String v) {
        if (v.length() > 16000) throw bad("描述最多 16000 字");
        return v;
    }
}
