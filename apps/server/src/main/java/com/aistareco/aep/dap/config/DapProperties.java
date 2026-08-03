package com.aistareco.aep.dap.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 数字人资产平台（apps/web-aiavatar，dap 领域）配置。见 application.yml `aep.dap.*`。
 *
 * 大模型接入点（chat / image / video）不在此配置 —— 统一由后台「AI 模型与 Key + AI 应用绑定」
 * 管理（purpose=DAP_PERSONA / DAP_IMAGE / DAP_VIDEO），运行时经 {@link
 * com.aistareco.aep.dap.service.DapMultimodalClient} 从 admin 端点解析，无 env 兜底。
 * 这里只保留 HTTP / 视频轮询的通用参数 + dev 专用的「自动绑定本地引擎」种子配置。
 */
@Component
@ConfigurationProperties(prefix = "aep.dap")
public class DapProperties {

    private final Http http = new Http();
    private final Video video = new Video();
    private final DevSeed devSeed = new DevSeed();
    private final Pricing pricing = new Pricing();
    private final Modelink modelink = new Modelink();
    private int maxConcurrent = 3;
    private long monthlyGrant = 1500;
    /** 回收站保留天数（软删超期后由 DapTrashCleanupScheduler 物理清理）。 */
    private int trashRetentionDays = 30;
    /** 未配置生成引擎时是否允许占位产物降级（生产应为 false → 提交直接 503，不扣费）。 */
    private boolean allowPlaceholder = false;
    /** 单账户存储配额（MB）。展示用，account() 出 wire 的 storageQuotaMb。 */
    private int storageQuotaMb = 5000;

    public Http getHttp() { return http; }
    public Video getVideo() { return video; }
    public DevSeed getDevSeed() { return devSeed; }
    public Pricing getPricing() { return pricing; }
    public Modelink getModelink() { return modelink; }
    public int getMaxConcurrent() { return maxConcurrent; }
    public void setMaxConcurrent(int maxConcurrent) { this.maxConcurrent = maxConcurrent; }
    public long getMonthlyGrant() { return monthlyGrant; }
    public void setMonthlyGrant(long monthlyGrant) { this.monthlyGrant = monthlyGrant; }
    public int getTrashRetentionDays() { return trashRetentionDays; }
    public void setTrashRetentionDays(int trashRetentionDays) { this.trashRetentionDays = trashRetentionDays; }
    public boolean isAllowPlaceholder() { return allowPlaceholder; }
    public void setAllowPlaceholder(boolean allowPlaceholder) { this.allowPlaceholder = allowPlaceholder; }
    public int getStorageQuotaMb() { return storageQuotaMb; }
    public void setStorageQuotaMb(int storageQuotaMb) { this.storageQuotaMb = storageQuotaMb; }

    /** 多模态 HTTP 调用参数（chat / image / video / 下载产物共用）。 */
    public static class Http {
        private int timeoutSeconds = 120;

        public int getTimeoutSeconds() { return timeoutSeconds; }
        public void setTimeoutSeconds(int v) { this.timeoutSeconds = v; }
    }

    /** 异步视频任务轮询参数。 */
    public static class Video {
        private int pollIntervalSeconds = 8;
        private int maxWaitSeconds = 900;

        public int getPollIntervalSeconds() { return pollIntervalSeconds; }
        public void setPollIntervalSeconds(int v) { this.pollIntervalSeconds = v; }
        public int getMaxWaitSeconds() { return maxWaitSeconds; }
        public void setMaxWaitSeconds(int v) { this.maxWaitSeconds = v; }
    }

    /**
     * Dev 专用：开机自动把 DAP 三个用途（人设/图片/视频）绑定到一个本地/真实引擎，
     * 让 dap-dev.sh / dap-verify.sh 无需手动进 admin 配置。
     * 生产默认 enabled=false（CommandLineRunner 不跑）；运行时仍只读 admin 端点，
     * 本配置只在启动时把端点+绑定「种」进 admin 表（幂等、不覆盖已配）。
     */
    public static class DevSeed {
        private boolean enabled = false;
        private String baseUrl = "http://localhost:18181";
        private String apiKey = "dev-fake-key";
        private String chatModel = "fake-chat";
        private String imageModel = "fake-image";
        private String videoModel = "fake-video";

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
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
    }

    /**
     * 七牛云 modelink 素材合规接入（v0.105 真人授权刷脸 + 素材送审）。
     *
     * <p>接入点（baseUrl / apiKey / model）不在这里配 —— 与其它大模型能力一致，
     * 由后台「AI 应用绑定」把用途 {@code DAP_REAL_AVATAR} 绑定到七牛端点。
     * 这里只放回调地址、降级开关与 HTTP / 轮询参数。
     */
    public static class Modelink {
        /** 刷脸完成后浏览器回跳的站点根（生产须 https，且与 server 对外域名一致）。 */
        private String callbackBaseUrl = "http://localhost:8080";
        /** 未配置端点时是否允许走内存 mock（dev 联调用；生产必须 false，§8.0）。 */
        private boolean allowMock = false;
        /** 非终态分组 / 素材的收敛轮询间隔（秒）。 */
        private int pollIntervalSeconds = 10;
        private int httpTimeoutSeconds = 30;

        public String getCallbackBaseUrl() { return callbackBaseUrl; }
        public void setCallbackBaseUrl(String v) { this.callbackBaseUrl = v; }
        public boolean isAllowMock() { return allowMock; }
        public void setAllowMock(boolean v) { this.allowMock = v; }
        public int getPollIntervalSeconds() { return pollIntervalSeconds; }
        public void setPollIntervalSeconds(int v) { this.pollIntervalSeconds = v; }
        public int getHttpTimeoutSeconds() { return httpTimeoutSeconds; }
        public void setHttpTimeoutSeconds(int v) { this.httpTimeoutSeconds = v; }
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
        // ── 数字资产平台（六类资产 + 跨资产合成）────────────────
        /** AI 生成一张场景图（SC-）。实拍上传免费。 */
        private long sceneGenerate = 6;
        /** 场景光线变体，按张计（提交时 × 变体数）。 */
        private long sceneVariant = 4;
        /** AI 生成一张产品主图（PD-）。实拍上传免费。 */
        private long productGenerate = 6;
        /** 产品补充角度，按张计（提交时 × 角度数）。 */
        private long productAngle = 4;
        /** 跨资产合成，按出图张数计（提交时 × count）。 */
        private long compose = 3;

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
        public long getSceneGenerate() { return sceneGenerate; }
        public void setSceneGenerate(long v) { this.sceneGenerate = v; }
        public long getSceneVariant() { return sceneVariant; }
        public void setSceneVariant(long v) { this.sceneVariant = v; }
        public long getProductGenerate() { return productGenerate; }
        public void setProductGenerate(long v) { this.productGenerate = v; }
        public long getProductAngle() { return productAngle; }
        public void setProductAngle(long v) { this.productAngle = v; }
        public long getCompose() { return compose; }
        public void setCompose(long v) { this.compose = v; }
    }
}
