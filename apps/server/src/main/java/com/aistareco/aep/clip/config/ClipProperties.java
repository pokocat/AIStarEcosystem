package com.aistareco.aep.clip.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "aep.clip")
public class ClipProperties {
    private String serviceToken = "";
    private boolean allowMock = false;
    private boolean forceMock = false;
    private String shiliuBaseUrl = "";
    private String shiliuToken = "";
    private String pricingAvatarSecond = "";
    private String pricingTtsPerKchar = "";
    private String pricingAssemble = "";
    /**
     * 分段生成三档（ip studio 侧的 t2i / t2v / i2v 能力）。和上面三档同一口径：**没有默认值**。
     * 价没配就 503 报错，不能把「不知道多少钱」渲染成一个编出来的数摆在用户面前。
     */
    private String pricingT2iPerImage = "";
    private String pricingT2vSecond = "";
    private String pricingI2vSecond = "";
    private long staleMs = 600_000L;
    private long maxAssetBytes = 104_857_600L;
    /** 单个用户素材库的总容量上限。默认 2 GiB —— 单文件上限 100MB，够存约 20 条素材。 */
    /**
     * 每个用户的默认存储额度，**素材与作品共用这一份**（2026-08-14 产品口径，从 2GB 调到 200MB）。
     * 不够用时由用户拿钻石扩容 —— 扩容额度由军师侧计算后随请求传下来（见 quotaBytes）。
     */
    private long maxOwnerAssetBytes = 200L * 1024 * 1024;
    private int maxAvatarSegmentSec = 30;
    private int trashRetentionDays = 30;
    private double minAverageLuma = 18.0;
    private double maxAverageLuma = 245.0;
    private double minIntegratedLufs = -24.0;
    private double maxIntegratedLufs = -12.0;
    private double maxTruePeakDb = -1.0;

    public String getServiceToken() { return serviceToken; }
    public void setServiceToken(String serviceToken) { this.serviceToken = serviceToken; }
    public boolean isAllowMock() { return allowMock; }
    public void setAllowMock(boolean allowMock) { this.allowMock = allowMock; }
    public boolean isForceMock() { return forceMock; }
    public void setForceMock(boolean forceMock) { this.forceMock = forceMock; }
    public String getShiliuBaseUrl() { return shiliuBaseUrl; }
    public void setShiliuBaseUrl(String shiliuBaseUrl) { this.shiliuBaseUrl = shiliuBaseUrl; }
    public String getShiliuToken() { return shiliuToken; }
    public void setShiliuToken(String shiliuToken) { this.shiliuToken = shiliuToken; }
    public String getPricingAvatarSecond() { return pricingAvatarSecond; }
    public void setPricingAvatarSecond(String value) { this.pricingAvatarSecond = value; }
    public String getPricingTtsPerKchar() { return pricingTtsPerKchar; }
    public void setPricingTtsPerKchar(String value) { this.pricingTtsPerKchar = value; }
    public String getPricingAssemble() { return pricingAssemble; }
    public void setPricingAssemble(String value) { this.pricingAssemble = value; }
    public String getPricingT2iPerImage() { return pricingT2iPerImage; }
    public void setPricingT2iPerImage(String value) { this.pricingT2iPerImage = value; }
    public String getPricingT2vSecond() { return pricingT2vSecond; }
    public void setPricingT2vSecond(String value) { this.pricingT2vSecond = value; }
    public String getPricingI2vSecond() { return pricingI2vSecond; }
    public void setPricingI2vSecond(String value) { this.pricingI2vSecond = value; }
    public long getStaleMs() { return staleMs; }
    public void setStaleMs(long staleMs) { this.staleMs = staleMs; }
    public long getMaxAssetBytes() { return maxAssetBytes; }
    public void setMaxAssetBytes(long maxAssetBytes) { this.maxAssetBytes = maxAssetBytes; }
    public long getMaxOwnerAssetBytes() { return maxOwnerAssetBytes; }
    public void setMaxOwnerAssetBytes(long maxOwnerAssetBytes) { this.maxOwnerAssetBytes = maxOwnerAssetBytes; }
    public int getMaxAvatarSegmentSec() { return maxAvatarSegmentSec; }
    public void setMaxAvatarSegmentSec(int maxAvatarSegmentSec) { this.maxAvatarSegmentSec = maxAvatarSegmentSec; }
    public int getTrashRetentionDays() { return trashRetentionDays; }
    public void setTrashRetentionDays(int trashRetentionDays) { this.trashRetentionDays = trashRetentionDays; }
    public double getMinAverageLuma() { return minAverageLuma; }
    public void setMinAverageLuma(double minAverageLuma) { this.minAverageLuma = minAverageLuma; }
    public double getMaxAverageLuma() { return maxAverageLuma; }
    public void setMaxAverageLuma(double maxAverageLuma) { this.maxAverageLuma = maxAverageLuma; }
    public double getMinIntegratedLufs() { return minIntegratedLufs; }
    public void setMinIntegratedLufs(double minIntegratedLufs) { this.minIntegratedLufs = minIntegratedLufs; }
    public double getMaxIntegratedLufs() { return maxIntegratedLufs; }
    public void setMaxIntegratedLufs(double maxIntegratedLufs) { this.maxIntegratedLufs = maxIntegratedLufs; }
    public double getMaxTruePeakDb() { return maxTruePeakDb; }
    public void setMaxTruePeakDb(double maxTruePeakDb) { this.maxTruePeakDb = maxTruePeakDb; }

    public int requirePrice(String raw, String key) {
        try {
            if (raw == null || raw.isBlank()) throw new NumberFormatException();
            int value = Integer.parseInt(raw);
            if (value < 0) throw new NumberFormatException();
            return value;
        } catch (NumberFormatException e) {
            throw new com.aistareco.common.BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "CLIP_PRICING_NOT_CONFIGURED", "口播视频计费尚未配置（" + key + "）");
        }
    }
}
