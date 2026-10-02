package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.GraphicsEnvironment;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 视频生成区的<b>测试 mock</b>（2026-10-01 线上端到端验证用，<b>临时</b>，测完把配置清掉）。
 *
 * <p>只对平台配置 {@value #CONFIG_KEY}（JSON 数组，元素是用户 id）里的账号生效，而且只管视频生成区
 * （分区 {@code video-studio}）：这些账号的智能优化与出片<b>不调用厂商</b> ——
 * 智能优化返回一段固定改写（开头标「【测试演示】」），出片用 ffmpeg 现做一段写着「测试演示 · 未调用厂商」的视频，
 * 之后走与真成片同一条存储、记账、扣费路径。其它账号、其它分区（带货脚本视频 / 短剧 / 画布）完全不受影响。
 *
 * <p>§8.0 的四个条件：配置缺省 = 关；开着时每次读到名单、每次命中都打 ERROR；产物上有显式「测试演示」标识；
 * 打开 / 关闭都是运营在后台显式改这个 key（{@code PUT/DELETE /api/admin/platform-configs/{key}}），不靠默认值。
 */
@Component
public class VideoStudioTestMock {

    private static final Logger log = LoggerFactory.getLogger(VideoStudioTestMock.class);

    public static final String CONFIG_KEY = "celebrity.video-studio.test-mock-user-ids";
    /** 写进任务的「模型」字段，生成记录上看得到这条不是真模型出的。 */
    static final String PROVIDER_LABEL = "测试演示";
    static final String MODEL_LABEL = "测试演示（未调用厂商）";
    static final String PROMPT_MARK = "【测试演示，未调用厂商】";
    private static final long CACHE_TTL_MS = 30_000L;

    private record Cache(Set<String> userIds, long fetchedAt) {}

    private final PlatformConfigService configs;
    private final FfmpegRunner ffmpeg;
    private final AtomicReference<Cache> cache = new AtomicReference<>();

    public VideoStudioTestMock(PlatformConfigService configs, FfmpegRunner ffmpeg) {
        this.configs = configs;
        this.ffmpeg = ffmpeg;
    }

    /** 这个账号在视频生成区是否走测试 mock。读不到配置 = 否（不影响真实链路）。 */
    public boolean appliesTo(String userId) {
        if (userId == null || userId.isBlank()) return false;
        boolean hit = userIds().contains(userId);
        if (hit) log.error("[video-studio] 测试 mock 命中 user={}：不调用厂商，产物是演示素材（配置 {}）", userId, CONFIG_KEY);
        return hit;
    }

    private Set<String> userIds() {
        long now = System.currentTimeMillis();
        Cache c = cache.get();
        if (c != null && now - c.fetchedAt() < CACHE_TTL_MS) return c.userIds();
        Set<String> ids = new LinkedHashSet<>();
        try {
            JsonNode value = configs.findByKey(CONFIG_KEY).map(d -> d.value()).orElse(null);
            if (value != null && value.isArray()) {
                value.forEach(n -> {
                    if (n.isTextual() && !n.asText().isBlank()) ids.add(n.asText().trim());
                });
            }
        } catch (RuntimeException e) {
            log.warn("[video-studio] 读测试 mock 名单失败，按「不 mock」处理: {}", e.toString());
        }
        if (!ids.isEmpty()) {
            log.error("[video-studio] ⚠ 测试 mock 已对 {} 个账号开启 {}：这些账号的智能优化与出片不调用厂商、产物是演示素材。"
                    + "测完在后台删除平台配置 {}", ids.size(), ids, CONFIG_KEY);
        }
        cache.set(new Cache(Set.copyOf(ids), now));
        return Set.copyOf(ids);
    }

    /** 智能优化的测试结果：原文 + 固定的镜头说明，开头带显式标识。 */
    public String optimizedPrompt(String original) {
        String base = original == null ? "" : original.strip();
        return PROMPT_MARK + base + "。镜头：中景缓慢推近到特写；光线：清晨侧逆光、暖色调；节奏：前两秒铺垫，后段突出主体。";
    }

    /** 演示视频与封面（临时文件，调用方用完删 {@link #dir}）。 */
    public record DemoMedia(Path dir, Path video, Path thumbnail) {}

    /**
     * 现做一段演示视频：一张写着「测试演示 · 未调用厂商」和提示词前几十个字的卡片，按所选比例与秒数编码成 H.264 MP4。
     */
    public DemoMedia render(String jobId, int seconds, String aspectRatio, String prompt) throws IOException {
        int[] size = sizeFor(aspectRatio);
        Path dir = Files.createTempDirectory("video-studio-mock-");
        Path card = dir.resolve("thumbnail.png");
        drawCard(card, size[0], size[1], jobId, prompt);
        Path video = dir.resolve("video.mp4");
        ffmpeg.runFfmpeg(List.of("-y", "-loop", "1", "-framerate", "24", "-i", card.toString(),
                "-t", String.valueOf(Math.max(1, seconds)),
                "-vf", "scale=" + size[0] + ":" + size[1] + ",format=yuv420p",
                "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-movflags", "+faststart",
                video.toString()));
        if (!Files.isRegularFile(video) || Files.size(video) == 0) {
            throw new IOException("演示视频没有生成出来");
        }
        return new DemoMedia(dir, video, card);
    }

    /** 画布尺寸：长边 1280，按比例算短边（取偶数，H.264 要求）。认不出的比例按 9:16。 */
    static int[] sizeFor(String aspectRatio) {
        int w = 9, h = 16;
        if (aspectRatio != null && aspectRatio.matches("\\d+:\\d+")) {
            String[] p = aspectRatio.split(":");
            int a = Integer.parseInt(p[0]), b = Integer.parseInt(p[1]);
            if (a > 0 && b > 0) { w = a; h = b; }
        }
        int longSide = 1280;
        int width = w >= h ? longSide : (int) Math.round(longSide * (double) w / h);
        int height = w >= h ? (int) Math.round(longSide * (double) h / w) : longSide;
        return new int[] { width - (width % 2), height - (height % 2) };
    }

    private static void drawCard(Path out, int width, int height, String jobId, String prompt) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setPaint(new GradientPaint(0, 0, new Color(24, 40, 72), width, height, new Color(96, 44, 30)));
            g.fillRect(0, 0, width, height);
            String family = fontFamily();
            int unit = Math.max(24, Math.min(width, height) / 12);
            g.setColor(new Color(214, 91, 44));
            g.fillRoundRect(unit, unit, unit * 7, (int) (unit * 1.6), unit / 2, unit / 2);
            g.setColor(Color.WHITE);
            g.setFont(new Font(family, Font.BOLD, unit));
            g.drawString("测试演示", (int) (unit * 1.5), (int) (unit * 2.15));
            g.setFont(new Font(family, Font.PLAIN, (int) (unit * 0.6)));
            g.drawString("未调用厂商，只用来验证流程", unit, unit * 4);
            String text = prompt == null ? "" : prompt.replaceAll("\\s+", " ").strip();
            if (text.length() > 40) text = text.substring(0, 40) + "…";
            g.setFont(new Font(family, Font.PLAIN, (int) (unit * 0.5)));
            g.setColor(new Color(255, 255, 255, 200));
            g.drawString(text, unit, unit * 5);
            g.drawString(jobId == null ? "" : jobId, unit, height - unit);
        } finally {
            g.dispose();
        }
        if (!ImageIO.write(image, "png", out.toFile())) throw new IOException("PNG writer unavailable");
    }

    private static String fontFamily() {
        List<String> available = List.of(GraphicsEnvironment.getLocalGraphicsEnvironment()
                .getAvailableFontFamilyNames(Locale.CHINA));
        for (String candidate : List.of("Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", "STHeiti", "Arial Unicode MS")) {
            if (available.stream().anyMatch(name -> name.equalsIgnoreCase(candidate))) return candidate;
        }
        return Font.SANS_SERIF;
    }

    /** 删掉 {@link #render} 留下的临时目录（best-effort）。 */
    public static void cleanup(DemoMedia media) {
        if (media == null) return;
        try (var files = Files.walk(media.dir())) {
            files.sorted(java.util.Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        } catch (IOException ignored) {
            // 临时目录删不掉不影响业务
        }
    }
}
