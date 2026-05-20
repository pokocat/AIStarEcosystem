package com.aistareco.aep.service.mixcut;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.List;
import java.util.UUID;

/**
 * 视频视觉指纹 —— aHash (average hash) 64bit。
 *
 * 算法：
 *   1) ffmpeg 抽视频中段一帧 → 缩到 8×8 灰度 PNG（盘上临时文件）
 *   2) 读 PNG,计算 64 个灰度值的均值
 *   3) 每个像素 ≥ 均值 → 1,否则 → 0;按 row-major 顺序拼成 64 bit
 *   4) 输出 16 hex 字符（big-endian）
 *
 * 汉明距离 = popcount(a XOR b),范围 0..64。值越大画面差异越大。
 * aHash 对全局亮度 / 镜像 / 速度 / 局部抖动都敏感,刚好对应混剪扰动的 6 类算子。
 */
final class PhashUtil {

    private PhashUtil() {}

    /** 抽视频中段一帧做 aHash。临时文件用 outDir 下随机名,完成后清理。 */
    static String ahashOfVideo(File video, FfmpegRunner ffmpeg, File workDir) throws Exception {
        double dur = ffmpeg.probeDurationSec(video);
        // 抽中段一帧最能代表整片;dur 失败 → 抽 0s
        double offset = dur > 0.2 ? dur / 2.0 : 0.0;

        File frame = new File(workDir, ".phash-" + UUID.randomUUID().toString().substring(0, 8) + ".png");
        try {
            ffmpeg.runFfmpeg(List.of(
                    "-y",
                    "-hide_banner",
                    "-loglevel", "error",
                    "-ss", String.format(java.util.Locale.ROOT, "%.2f", offset),
                    "-i", video.getAbsolutePath(),
                    "-frames:v", "1",
                    "-update", "1",
                    "-vf", "scale=8:8,format=gray",
                    frame.getAbsolutePath()
            ));
            return ahashOfPng(frame);
        } finally {
            //noinspection ResultOfMethodCallIgnored
            frame.delete();
        }
    }

    /** 读 8×8 灰度 PNG → aHash 64bit hex。 */
    static String ahashOfPng(File png) throws Exception {
        BufferedImage img = ImageIO.read(png);
        if (img == null) throw new IllegalStateException("cannot read phash frame: " + png);
        int w = img.getWidth();
        int h = img.getHeight();
        // 通常已经是 8×8,但允许 ffmpeg 输出尺寸不精确的情况 —— 重新均匀采样
        int[] gray = new int[64];
        long sum = 0;
        for (int i = 0; i < 64; i++) {
            int gx = (i % 8) * w / 8;
            int gy = (i / 8) * h / 8;
            int rgb = img.getRGB(gx, gy);
            int r = (rgb >> 16) & 0xff;
            int g = (rgb >> 8) & 0xff;
            int b = rgb & 0xff;
            // ITU-R BT.601 luma
            int y = (r * 299 + g * 587 + b * 114) / 1000;
            gray[i] = y;
            sum += y;
        }
        int avg = (int) (sum / 64);
        long bits = 0L;
        for (int i = 0; i < 64; i++) {
            if (gray[i] >= avg) bits |= (1L << (63 - i));
        }
        return String.format("%016x", bits);
    }

    /** 64bit hex 之间的汉明距离。长度不一律返回 64（最大差异）。 */
    static int hammingHex(String a, String b) {
        if (a == null || b == null || a.length() != 16 || b.length() != 16) return 64;
        long la = Long.parseUnsignedLong(a, 16);
        long lb = Long.parseUnsignedLong(b, 16);
        return Long.bitCount(la ^ lb);
    }
}
