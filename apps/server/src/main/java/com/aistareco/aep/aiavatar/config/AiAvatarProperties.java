package com.aistareco.aep.aiavatar.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * AiAvatar 领域配置（{@code aep.aiavatar.*}）。
 *
 * - appMode：全局 mock/live/prod（任务书 §6.1）。mock/dev/offline → 显式离线 mock；live/prod → 默认真实方案。
 * - providers：按能力覆盖实现（mock|backend|selfhost），任务书 §6.2。
 *   例：{@code aep.aiavatar.providers.faceClone=selfhost}。
 * - selfhostBaseUrls：各能力自部署微服务地址（mode=selfhost 时用）。
 * - 文件存储目录 / 公开 URL 前缀；异步并发；监控线程阈值。
 */
@Component
@ConfigurationProperties(prefix = "aep.aiavatar")
public class AiAvatarProperties {

    /** mock | live | prod。历史 dev/offline 值按 mock 处理。 */
    private String appMode = "live";

    /** 按能力覆盖：capability wire → mock|backend|selfhost。 */
    private Map<String, String> providers = new HashMap<>();

    /** 按能力配置自部署微服务 base URL（mode=selfhost 时 POST {base}/run）。 */
    private Map<String, String> selfhostBaseUrls = new HashMap<>();

    /** 资产落盘目录。 */
    private String assetDir = "./aiavatar-assets";

    /** 资产公开 URL 前缀（静态映射）。 */
    private String assetPublicUrlBase = "/static/aiavatar-assets";

    /** 异步 worker 并发。 */
    private int maxConcurrent = 3;

    /** 监控线程扫描间隔（毫秒）。任务书要求每小时；dev 可调小用于验证。 */
    private long watchdogIntervalMs = 3_600_000L;

    /** running 任务心跳超过该毫秒数无更新 → 视为异常中断，由监控线程接管。 */
    private long jobStaleMs = 600_000L;

    /** 单次生成扣费（credits）；0 = 不计费。 */
    private long creditPerGeneration = 0L;

    public String getAppMode() { return appMode; }
    public void setAppMode(String appMode) { this.appMode = appMode; }

    public Map<String, String> getProviders() { return providers; }
    public void setProviders(Map<String, String> providers) { this.providers = providers; }

    public Map<String, String> getSelfhostBaseUrls() { return selfhostBaseUrls; }
    public void setSelfhostBaseUrls(Map<String, String> selfhostBaseUrls) { this.selfhostBaseUrls = selfhostBaseUrls; }

    public String getAssetDir() { return assetDir; }
    public void setAssetDir(String assetDir) { this.assetDir = assetDir; }

    public String getAssetPublicUrlBase() { return assetPublicUrlBase; }
    public void setAssetPublicUrlBase(String assetPublicUrlBase) { this.assetPublicUrlBase = assetPublicUrlBase; }

    public int getMaxConcurrent() { return maxConcurrent; }
    public void setMaxConcurrent(int maxConcurrent) { this.maxConcurrent = maxConcurrent; }

    public long getWatchdogIntervalMs() { return watchdogIntervalMs; }
    public void setWatchdogIntervalMs(long watchdogIntervalMs) { this.watchdogIntervalMs = watchdogIntervalMs; }

    public long getJobStaleMs() { return jobStaleMs; }
    public void setJobStaleMs(long jobStaleMs) { this.jobStaleMs = jobStaleMs; }

    public long getCreditPerGeneration() { return creditPerGeneration; }
    public void setCreditPerGeneration(long creditPerGeneration) { this.creditPerGeneration = creditPerGeneration; }

    public boolean isProd() {
        return "prod".equalsIgnoreCase(appMode)
                || "production".equalsIgnoreCase(appMode)
                || "live".equalsIgnoreCase(appMode)
                || "backend".equalsIgnoreCase(appMode)
                || "real".equalsIgnoreCase(appMode);
    }

    public boolean isMockMode() {
        return "mock".equalsIgnoreCase(appMode)
                || "dev".equalsIgnoreCase(appMode)
                || "offline".equalsIgnoreCase(appMode);
    }
}
