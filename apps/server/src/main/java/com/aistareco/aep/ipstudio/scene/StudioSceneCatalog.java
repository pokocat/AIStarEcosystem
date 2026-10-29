package com.aistareco.aep.ipstudio.scene;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Studio 场景目录（AI 图片 / AI 视频）的唯一真源：{@code ipstudio/scenes.json}。
 *
 * <p>场景写好的描述、拍法、每个场景用哪种方法，都只在这一份里；前端经 {@code GET /api/v1/ip-studio/scenes} 读，
 * 出图描述和交给助手的话由 {@link #compose} 在服务端拼，前端不再各写一份（docs/studio-scene-creation.md §7）。
 * 文件写错（编号重复、描述里点了不存在的参考图、留了【…】空位）启动即失败，不带病上线。
 */
@Component
public class StudioSceneCatalog {
    public record Group(String id, String title) {}
    public record SceneRef(String label, boolean required, String hint) {}
    public record ImageScene(String id, String group, String title, String description, List<SceneRef> refs, String prompt, String hint, String ratio) {}
    public record Slot(String label, boolean required, Integer max) {}
    public record VideoScene(String id, String group, String title, String description, Slot images, Slot video, boolean character, boolean voice,
                             String placeholder, boolean textRequired, List<Integer> durations, int duration, String ratio, String structure,
                             List<String> ideas, String skill) {}
    public record Catalog(int version, List<Group> imageGroups, List<Group> videoGroups, List<ImageScene> image, List<VideoScene> video) {}

    /** 自由出图：没有固定描述，只有用户自己写的那句。 */
    public static final String FREE = "free";
    private static final Pattern REF = Pattern.compile("图(\\d)");

    private final Catalog catalog;

    public StudioSceneCatalog() { this(load("ipstudio/scenes.json")); }

    StudioSceneCatalog(Catalog catalog) { this.catalog = validate(catalog); }

    public Catalog catalog() { return catalog; }
    public Optional<ImageScene> image(String id) { return catalog.image().stream().filter(s -> s.id().equals(id)).findFirst(); }
    public Optional<VideoScene> video(String id) { return catalog.video().stream().filter(s -> s.id().equals(id)).findFirst(); }

    // ── 拼话 ───────────────────────────────────────────────────────────────

    /**
     * @param filled  图片场景：哪几个参考图位放了图（从 0 起）
     * @param text    图片：补充要求；视频：用户写的那句
     * @param custom  图片：用户改过的完整描述（没改为 null）
     */
    public record ComposeRequest(String kind, String sceneId, String text, String custom, List<Integer> filled,
                                 List<String> imageTitles, String characterTitle, String voiceTitle, String videoTitle,
                                 Integer duration, String ratio) {}
    public record Composed(String text, String skillKey) {}

    public Composed compose(ComposeRequest request) {
        if (request == null || request.kind() == null) throw bad("请选择场景");
        return switch (request.kind()) {
            case "image" -> new Composed(imagePrompt(request), null);
            case "video" -> videoBrief(request);
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

    private Composed videoBrief(ComposeRequest r) {
        VideoScene scene = video(r.sceneId()).orElseThrow(() -> bad("这个场景不存在，请刷新后重选"));
        List<String> images = r.imageTitles() == null ? List.of() : r.imageTitles().stream().filter(t -> t != null && !t.isBlank()).toList();
        String text = trim(r.text());
        if (scene.video() != null && scene.video().required() && blank(r.videoTitle())) throw bad("先放" + scene.video().label());
        if (scene.images().required() && images.isEmpty()) throw bad("先放" + scene.images().label());
        if (scene.images().max() != null && images.size() > scene.images().max()) throw bad(scene.images().label() + "最多放 " + scene.images().max() + " 张");
        if (scene.textRequired() && text.isEmpty()) throw bad("先写一句要求");
        int duration = r.duration() == null ? scene.duration() : r.duration();
        if (!scene.durations().contains(duration)) throw bad("请选择可用的时长");
        String ratio = r.ratio() == null ? scene.ratio() : r.ratio();
        if (!List.of("9:16", "16:9").contains(ratio)) throw bad("请选择竖屏或横屏");

        List<String> lines = new ArrayList<>();
        lines.add("帮我做一条 " + duration + " 秒的" + ("16:9".equals(ratio) ? "横屏" : "竖屏") + "短视频，类型是「" + scene.title() + "」。");
        if (!text.isEmpty()) lines.add("我的要求：" + text);
        List<String> materials = new ArrayList<>();
        if (!blank(r.videoTitle())) materials.add("「" + r.videoTitle().trim() + "」是要复刻的参考视频");
        if (!images.isEmpty()) materials.add(String.join("", images.stream().map(t -> "「" + t.trim() + "」").toList()) + "是上传的" + scene.images().label() + "，画面里出现时要和它一致");
        if (!blank(r.characterTitle())) materials.add("「" + r.characterTitle().trim() + "」是出镜人物，长相和穿着保持一致");
        if (!blank(r.voiceTitle())) materials.add("「" + r.voiceTitle().trim() + "」是配音要用的声音");
        if (!materials.isEmpty()) lines.add("画布上的素材：" + String.join("；", materials) + "。");
        if (text.isEmpty() && !materials.isEmpty()) lines.add("我没写具体要求，先看素材，再按下面的拍法出方案。");
        lines.add("拍法：" + scene.structure());
        // 老板没给的价格、优惠、地址，模型最容易顺手编一个，写进成片就是虚假宣传。
        lines.add("上面没写的信息（价格、优惠、地址、功效数据）不要自己编。");
        // 只说「先给我分镜方案」时，真模型（2026-10-29 本地聚算 Qwen）只排了一步写脚本，做完也不提出视频。
        lines.add("要的是做好的视频，不只是脚本：把文案、分镜和每段视频一起排进方案，报总共要花的积分，我确认后一次生成。");
        return new Composed(limit(String.join("\n", lines)), scene.skill());
    }

    // ── 加载与校验 ─────────────────────────────────────────────────────────

    static Catalog load(String path) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false).readValue(in, Catalog.class);
        } catch (IOException e) {
            throw new IllegalStateException("场景目录读不出来：" + path, e);
        }
    }

    static Catalog validate(Catalog c) {
        if (c == null || c.image() == null || c.video() == null) throw new IllegalStateException("场景目录为空");
        Set<String> ids = new HashSet<>();
        Set<String> imageGroups = new HashSet<>(c.imageGroups().stream().map(Group::id).toList());
        Set<String> videoGroups = new HashSet<>(c.videoGroups().stream().map(Group::id).toList());
        for (ImageScene s : c.image()) {
            if (!ids.add(s.id())) throw new IllegalStateException("场景编号重复：" + s.id());
            if (!imageGroups.contains(s.group())) throw new IllegalStateException("场景分组不存在：" + s.id());
            if (s.prompt().contains("【") || s.prompt().contains("】")) throw new IllegalStateException("场景描述不能留【…】空位：" + s.id());
            Matcher m = REF.matcher(s.prompt());
            while (m.find()) if (Integer.parseInt(m.group(1)) > s.refs().size()) throw new IllegalStateException("场景描述点了不存在的参考图：" + s.id());
            if (!FREE.equals(s.id()) && (s.refs().isEmpty() || !s.refs().get(0).required())) throw new IllegalStateException("图1 必须是必填参考图：" + s.id());
        }
        for (VideoScene s : c.video()) {
            if (!ids.add(s.id())) throw new IllegalStateException("场景编号重复：" + s.id());
            if (!videoGroups.contains(s.group())) throw new IllegalStateException("场景分组不存在：" + s.id());
            if (blank(s.skill())) throw new IllegalStateException("视频场景没写用哪种方法：" + s.id());
            if (!s.durations().contains(s.duration())) throw new IllegalStateException("默认时长不在可选时长里：" + s.id());
        }
        return c;
    }

    private static BusinessException bad(String message) { return BusinessException.badRequest("STUDIO_SCENE_INPUT_INVALID", message); }
    private static boolean blank(String v) { return v == null || v.isBlank(); }
    private static String trim(String v) { return v == null ? "" : v.trim(); }
    private static String limit(String v) {
        if (v.length() > 16000) throw bad("描述最多 16000 字");
        return v;
    }
}
