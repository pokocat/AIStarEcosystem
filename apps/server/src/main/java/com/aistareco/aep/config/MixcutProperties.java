package com.aistareco.aep.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * aep.mixcut.* 配置 —— 混剪渲染 worker。
 */
@Configuration
@ConfigurationProperties(prefix = "aep.mixcut")
public class MixcutProperties {

    private String outputDir = "./mixcut-output";
    private String workDir = "./mixcut-work";
    private String ffmpegBin = "ffmpeg";
    private String ffprobeBin = "ffprobe";
    private String publicUrlBase = "/static/mixcut";
    private int maxConcurrent = 2;
    private int maxOutputDurationSec = 15;
    // 输出分辨率上限：模板 canvas 大于此值时按比例缩到 fit。
    // 720x1280 在 macOS CPU 编码下能跑 ~1x realtime；1080x1920 是 2.25x 像素量，
    // libx264 ultrafast 也通常跑不到 1x realtime，多变体累积会超时。
    // 想要 1080p 的项目应该走 GPU encode（设 video-codec=h264_videotoolbox）。
    private int maxOutputWidth = 720;
    private int maxOutputHeight = 1280;
    // 视频编码器；默认软编 libx264。macOS 可改 h264_videotoolbox 走 GPU（VideoToolbox 框架，
    // 速度提升 5-10x，画质 ≈ x264 medium）。Linux 容器无 GPU 保持 libx264。
    private String videoCodec = "libx264";
    private long maxAssetBytes = 104_857_600L;
    // 120s 在 1080p 多变体 / 多 overlay / GIF 扰动场景下不够；提到 5min 给 ultrafast 编码留余量。
    // 真实需要更长的可通过 aep.mixcut.ffmpeg-timeout-ms 覆盖。
    private long ffmpegTimeoutMs = 300_000L;
    private String assetDir = "./mixcut-assets";
    private String assetPublicUrlBase = "/static/mixcut-assets";

    public String getOutputDir() { return outputDir; }
    public void setOutputDir(String outputDir) { this.outputDir = outputDir; }

    public String getWorkDir() { return workDir; }
    public void setWorkDir(String workDir) { this.workDir = workDir; }

    public String getFfmpegBin() { return ffmpegBin; }
    public void setFfmpegBin(String ffmpegBin) { this.ffmpegBin = ffmpegBin; }

    public String getFfprobeBin() { return ffprobeBin; }
    public void setFfprobeBin(String ffprobeBin) { this.ffprobeBin = ffprobeBin; }

    public String getPublicUrlBase() { return publicUrlBase; }
    public void setPublicUrlBase(String publicUrlBase) { this.publicUrlBase = publicUrlBase; }

    public int getMaxConcurrent() { return maxConcurrent; }
    public void setMaxConcurrent(int maxConcurrent) { this.maxConcurrent = maxConcurrent; }

    public int getMaxOutputDurationSec() { return maxOutputDurationSec; }
    public void setMaxOutputDurationSec(int maxOutputDurationSec) { this.maxOutputDurationSec = maxOutputDurationSec; }

    public int getMaxOutputWidth() { return maxOutputWidth; }
    public void setMaxOutputWidth(int maxOutputWidth) { this.maxOutputWidth = maxOutputWidth; }

    public int getMaxOutputHeight() { return maxOutputHeight; }
    public void setMaxOutputHeight(int maxOutputHeight) { this.maxOutputHeight = maxOutputHeight; }

    public String getVideoCodec() { return videoCodec; }
    public void setVideoCodec(String videoCodec) { this.videoCodec = videoCodec; }

    public long getMaxAssetBytes() { return maxAssetBytes; }
    public void setMaxAssetBytes(long maxAssetBytes) { this.maxAssetBytes = maxAssetBytes; }

    public long getFfmpegTimeoutMs() { return ffmpegTimeoutMs; }
    public void setFfmpegTimeoutMs(long ffmpegTimeoutMs) { this.ffmpegTimeoutMs = ffmpegTimeoutMs; }

    public String getAssetDir() { return assetDir; }
    public void setAssetDir(String assetDir) { this.assetDir = assetDir; }

    public String getAssetPublicUrlBase() { return assetPublicUrlBase; }
    public void setAssetPublicUrlBase(String assetPublicUrlBase) { this.assetPublicUrlBase = assetPublicUrlBase; }
}
