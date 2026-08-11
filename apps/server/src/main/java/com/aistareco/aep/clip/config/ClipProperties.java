package com.aistareco.aep.clip.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "aep.clip")
public class ClipProperties {
    private String serviceToken = "";
    private boolean allowMock = false;
    private String shiliuBaseUrl = "";
    private String shiliuToken = "";
    private String pricingAvatarSecond = "";
    private String pricingTtsPerKchar = "";
    private String pricingAssemble = "";
    private long staleMs = 600_000L;
    private long maxAssetBytes = 104_857_600L;
    private int maxAvatarSegmentSec = 30;
    private int trashRetentionDays = 30;

    public String getServiceToken() { return serviceToken; }
    public void setServiceToken(String serviceToken) { this.serviceToken = serviceToken; }
    public boolean isAllowMock() { return allowMock; }
    public void setAllowMock(boolean allowMock) { this.allowMock = allowMock; }
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
    public long getStaleMs() { return staleMs; }
    public void setStaleMs(long staleMs) { this.staleMs = staleMs; }
    public long getMaxAssetBytes() { return maxAssetBytes; }
    public void setMaxAssetBytes(long maxAssetBytes) { this.maxAssetBytes = maxAssetBytes; }
    public int getMaxAvatarSegmentSec() { return maxAvatarSegmentSec; }
    public void setMaxAvatarSegmentSec(int maxAvatarSegmentSec) { this.maxAvatarSegmentSec = maxAvatarSegmentSec; }
    public int getTrashRetentionDays() { return trashRetentionDays; }
    public void setTrashRetentionDays(int trashRetentionDays) { this.trashRetentionDays = trashRetentionDays; }

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
