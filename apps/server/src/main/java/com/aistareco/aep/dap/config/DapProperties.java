package com.aistareco.aep.dap.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 数字人资产平台（apps/web-aiavatar，dap 领域）配置。见 application.yml `aep.dap.*`。
 */
@Component
@ConfigurationProperties(prefix = "aep.dap")
public class DapProperties {

    private final Agnes agnes = new Agnes();
    private final Pricing pricing = new Pricing();
    private int maxConcurrent = 3;
    private long monthlyGrant = 1500;

    public Agnes getAgnes() { return agnes; }
    public Pricing getPricing() { return pricing; }
    public int getMaxConcurrent() { return maxConcurrent; }
    public void setMaxConcurrent(int maxConcurrent) { this.maxConcurrent = maxConcurrent; }
    public long getMonthlyGrant() { return monthlyGrant; }
    public void setMonthlyGrant(long monthlyGrant) { this.monthlyGrant = monthlyGrant; }

    public static class Agnes {
        private String baseUrl = "https://apihub.agnes-ai.com";
        private String apiKey = "";
        private String chatModel = "agnes-2.0-flash";
        private String imageModel = "agnes-image-2.1-flash";
        private String videoModel = "agnes-video-v2.0";
        private int httpTimeoutSeconds = 120;
        private int videoPollIntervalSeconds = 8;
        private int videoMaxWaitSeconds = 900;

        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
        public String getChatModel() { return chatModel; }
        public void setChatModel(String chatModel) { this.chatModel = chatModel; }
        public String getImageModel() { return imageModel; }
        public void setImageModel(String imageModel) { this.imageModel = imageModel; }
        public String getVideoModel() { return videoModel; }
        public void setVideoModel(String videoModel) { this.videoModel = videoModel; }
        public int getHttpTimeoutSeconds() { return httpTimeoutSeconds; }
        public void setHttpTimeoutSeconds(int v) { this.httpTimeoutSeconds = v; }
        public int getVideoPollIntervalSeconds() { return videoPollIntervalSeconds; }
        public void setVideoPollIntervalSeconds(int v) { this.videoPollIntervalSeconds = v; }
        public int getVideoMaxWaitSeconds() { return videoMaxWaitSeconds; }
        public void setVideoMaxWaitSeconds(int v) { this.videoMaxWaitSeconds = v; }
    }

    /** 各动作扣费（点）。0 = 免费。 */
    public static class Pricing {
        private long generate = 20;
        private long generateUpload = 15;
        private long iterate = 5;
        private long warp = 3;
        private long look = 8;
        private long deriveAtlas = 12;
        private long deriveExpr = 10;
        private long deriveScene = 8;
        private long deriveWard = 8;
        private long deriveD3 = 10;
        private long deriveVideo = 30;
        private long voiceClone = 10;

        public long getGenerate() { return generate; }
        public void setGenerate(long v) { this.generate = v; }
        public long getGenerateUpload() { return generateUpload; }
        public void setGenerateUpload(long v) { this.generateUpload = v; }
        public long getIterate() { return iterate; }
        public void setIterate(long v) { this.iterate = v; }
        public long getWarp() { return warp; }
        public void setWarp(long v) { this.warp = v; }
        public long getLook() { return look; }
        public void setLook(long v) { this.look = v; }
        public long getDeriveAtlas() { return deriveAtlas; }
        public void setDeriveAtlas(long v) { this.deriveAtlas = v; }
        public long getDeriveExpr() { return deriveExpr; }
        public void setDeriveExpr(long v) { this.deriveExpr = v; }
        public long getDeriveScene() { return deriveScene; }
        public void setDeriveScene(long v) { this.deriveScene = v; }
        public long getDeriveWard() { return deriveWard; }
        public void setDeriveWard(long v) { this.deriveWard = v; }
        public long getDeriveD3() { return deriveD3; }
        public void setDeriveD3(long v) { this.deriveD3 = v; }
        public long getDeriveVideo() { return deriveVideo; }
        public void setDeriveVideo(long v) { this.deriveVideo = v; }
        public long getVoiceClone() { return voiceClone; }
        public void setVoiceClone(long v) { this.voiceClone = v; }
    }
}
