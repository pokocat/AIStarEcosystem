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
    private long maxAssetBytes = 104_857_600L;
    private long ffmpegTimeoutMs = 120_000L;
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

    public long getMaxAssetBytes() { return maxAssetBytes; }
    public void setMaxAssetBytes(long maxAssetBytes) { this.maxAssetBytes = maxAssetBytes; }

    public long getFfmpegTimeoutMs() { return ffmpegTimeoutMs; }
    public void setFfmpegTimeoutMs(long ffmpegTimeoutMs) { this.ffmpegTimeoutMs = ffmpegTimeoutMs; }

    public String getAssetDir() { return assetDir; }
    public void setAssetDir(String assetDir) { this.assetDir = assetDir; }

    public String getAssetPublicUrlBase() { return assetPublicUrlBase; }
    public void setAssetPublicUrlBase(String assetPublicUrlBase) { this.assetPublicUrlBase = assetPublicUrlBase; }
}
