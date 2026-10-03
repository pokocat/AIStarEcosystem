package com.aistareco.aep.service.materialvideo;

import java.util.List;
import java.util.Locale;

/**
 * 聚算 JusuanHub · MiniMax H3 的厂商合同：**所有**数字只写在这一个类里。
 *
 * <p>来源：docs.jusuanhub.com（MiniMax H3 / 素材上传两页）+ Portal 模型详情「API 接入」生成的调用示例，
 * 2026-09-30 读取，见 docs/video-studio-plan.md §2。前端从 {@code GET /me/celebrity/video-studio/models}
 * 拿这些数，不在前端写死；服务端校验、组包、计价也只读这里（§8.0.1 ④：同一条规则不写两遍）。
 *
 * <p>⚠️ 1:1 的 {@code orientation:"square"} 取自 Portal 生成的调用示例；公开文档的枚举只写了
 * landscape / portrait。按 Portal 走（它按服务实时合同生成），**未实测**。上游若拒收，
 * 厂商原话会直接显示给用户（MaterialVideoModelClient#submitFailureMessage）。
 */
public final class JusuanH3Contract {

    private JusuanH3Contract() {}

    // ── 生成模式（厂商 wire 值，generationMode）──────────────────────────────

    public static final String MODE_T2V = "t2v";
    public static final String MODE_I2V = "i2v";
    public static final String MODE_FIRST_LAST_FRAME = "first_last_frame_video";
    public static final String MODE_UNIVERSAL_REFERENCE = "universal_reference_video";
    public static final List<String> MODES =
            List.of(MODE_T2V, MODE_I2V, MODE_FIRST_LAST_FRAME, MODE_UNIVERSAL_REFERENCE);

    public static boolean isMode(String mode) {
        return mode != null && MODES.contains(mode);
    }

    // ── 清晰度与画布（每档六种固定画布，比例顺序即展示顺序）─────────────────────

    public static final String TIER_768P = "768p";
    public static final String TIER_544P = "544p";
    public static final List<String> TIERS = List.of(TIER_768P, TIER_544P);

    /** 一个受控画布：比例 + 厂商固定像素。 */
    public record Canvas(String aspectRatio, int width, int height) {}

    private static final List<Canvas> CANVASES_768P = List.of(
            new Canvas("21:9", 1536, 672),
            new Canvas("16:9", 1344, 768),
            new Canvas("4:3", 1024, 768),
            new Canvas("1:1", 768, 768),
            new Canvas("3:4", 768, 1024),
            new Canvas("9:16", 768, 1344));

    private static final List<Canvas> CANVASES_544P = List.of(
            new Canvas("21:9", 1280, 544),
            new Canvas("16:9", 960, 544),
            new Canvas("4:3", 736, 544),
            new Canvas("1:1", 544, 544),
            new Canvas("3:4", 544, 736),
            new Canvas("9:16", 544, 960));

    /** 某档清晰度的六种画布；不在合同里的清晰度返回空列表。 */
    public static List<Canvas> canvases(String tier) {
        if (TIER_768P.equals(tier)) return CANVASES_768P;
        if (TIER_544P.equals(tier)) return CANVASES_544P;
        return List.of();
    }

    /** 查画布；清晰度或比例不在合同里返回 null。 */
    public static Canvas canvas(String tier, String aspectRatio) {
        if (aspectRatio == null) return null;
        for (Canvas c : canvases(tier)) {
            if (c.aspectRatio().equals(aspectRatio)) return c;
        }
        return null;
    }

    /** 画布的朝向：宽 &gt; 高 = landscape，宽 = 高 = square，宽 &lt; 高 = portrait。 */
    public static String orientation(Canvas canvas) {
        if (canvas.width() > canvas.height()) return "landscape";
        if (canvas.width() == canvas.height()) return "square";
        return "portrait";
    }

    /** Portal 示例里的尺寸编码，形如 {@code h3-768-9x16} / {@code h3-544-21x9}。 */
    public static String outputSizeCode(String tier, String aspectRatio) {
        String t = tier.toLowerCase(Locale.ROOT).replace("p", "");
        return "h3-" + t + "-" + aspectRatio.replace(':', 'x');
    }

    // ── 时长 / 提示词 / 种子 ────────────────────────────────────────────────

    /** 整数秒，含两端。 */
    public static final int MIN_SECONDS = 5;
    public static final int MAX_SECONDS = 15;
    /** 去掉首尾空白后按 Unicode 字符（code point）计。 */
    public static final int PROMPT_MAX_CHARS = 7000;
    /** 随机种子上限（含）；下限为 0。 */
    public static final long SEED_MAX = 2_147_483_647L;

    // ── 素材 ────────────────────────────────────────────────────────────────

    public static final String MEDIA_IMAGE = "image";
    public static final String MEDIA_VIDEO = "video";
    public static final String MEDIA_AUDIO = "audio";
    public static final List<String> MEDIA_TYPES = List.of(MEDIA_IMAGE, MEDIA_VIDEO, MEDIA_AUDIO);

    public static boolean isMediaType(String mediaType) {
        return mediaType != null && MEDIA_TYPES.contains(mediaType);
    }

    private static final long MIB = 1024L * 1024L;

    /** 首帧 / 尾帧图（input_image_asset_id / end_image_asset_id）。 */
    public static final long FRAME_IMAGE_MAX_BYTES = 16 * MIB;
    /** 全能参考里的图片。 */
    public static final long REFERENCE_IMAGE_MAX_BYTES = 30 * MIB;
    public static final long REFERENCE_VIDEO_MAX_BYTES = 50 * MIB;
    public static final long REFERENCE_AUDIO_MAX_BYTES = 15 * MIB;

    public static final List<String> IMAGE_FORMATS = List.of("PNG", "JPEG", "WEBP");
    public static final List<String> VIDEO_FORMATS = List.of("MP4");
    public static final List<String> AUDIO_FORMATS = List.of("WAV", "MP3", "FLAC", "AAC", "OGG", "M4A", "MOV");

    /** 某类素材的展示用格式名（字节判定见 {@code MediaBytes.sniff}，两边一一对应）。 */
    public static List<String> formatsOf(String mediaType) {
        if (MEDIA_VIDEO.equals(mediaType)) return VIDEO_FORMATS;
        if (MEDIA_AUDIO.equals(mediaType)) return AUDIO_FORMATS;
        return IMAGE_FORMATS;
    }

    public static final int REFERENCE_IMAGE_MAX_COUNT = 9;
    /** 带了参考视频时，图片最多几张。 */
    public static final int REFERENCE_IMAGE_MAX_WITH_VIDEO = 8;
    public static final int REFERENCE_VIDEO_MAX_COUNT = 1;
    public static final int REFERENCE_AUDIO_MAX_COUNT = 3;
    public static final int REFERENCE_MAX_TOTAL = 12;
    /** 视觉素材（图 + 视频）至少几个。 */
    public static final int REFERENCE_MIN_VISUAL = 1;
    /** 单段音频时长（秒，含两端）。 */
    public static final int AUDIO_MIN_SECONDS = 2;
    public static final int AUDIO_MAX_SECONDS = 15;
    /** 所有音频加起来最长几秒。 */
    public static final int AUDIO_TOTAL_MAX_SECONDS = 15;

    /** referenceInputs[].role：reference_image / reference_video / reference_audio。 */
    public static String referenceRole(String mediaType) {
        return "reference_" + mediaType;
    }

    /** 全能参考里某类素材的单个文件上限。 */
    public static long referenceMaxBytes(String mediaType) {
        return switch (mediaType == null ? "" : mediaType) {
            case MEDIA_VIDEO -> REFERENCE_VIDEO_MAX_BYTES;
            case MEDIA_AUDIO -> REFERENCE_AUDIO_MAX_BYTES;
            default -> REFERENCE_IMAGE_MAX_BYTES;
        };
    }

    // ── 价格结构（Portal 标价：768p 40 / 544p 20 积分每秒，四种模式同价；全能参考第 7 张图起每张每秒 +10）──
    //
    // 后台候选的 creditCostOverride 是「768p 每秒价」，其余按厂商价格结构等比换算（plan §3）：
    //   544p          = ceil(rate / 2)
    //   第 7 张图起每张 = ceil(rate / 4)

    public static final long TIER_544P_PRICE_DIVISOR = 2;
    public static final long EXTRA_REFERENCE_IMAGE_PRICE_DIVISOR = 4;
    /** 全能参考里含在单价内的图片张数。 */
    public static final int INCLUDED_REFERENCE_IMAGES = 6;
}
