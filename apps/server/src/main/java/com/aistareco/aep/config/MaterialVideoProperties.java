package com.aistareco.aep.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 带货视频生成（素材运营派生视频）配置 —— aep.material.video.*。
 *
 * 视频大模型的 token / baseUrl / model 在后台「AI 模型」页按 provider 配置
 * （用途勾选「视频生成」），**不在这里配 token**。这里只配「怎么提交 / 怎么轮询」的
 * 协议细节 + 轮询节奏，方便适配不同厂商而无需改代码。
 *
 * 默认值对齐「提交返回 task_id、轮询拿状态 + 成片 URL」的异步任务约定
 * （如 智谱 CogVideoX：POST {baseUrl}/videos/generations → GET {baseUrl}/async-result/{id}）。
 * 换厂商时多数只需改 baseUrl（在 AI 模型 provider 里）+ 这里的 submit/poll 子路径；
 * 响应解析对常见字段做了多形态兜底（见 MaterialVideoModelClient）。
 */
@Configuration
@ConfigurationProperties(prefix = "aep.material.video")
public class MaterialVideoProperties {

    /** 提交生成任务的子路径（拼在 provider.baseUrl 之后）。 */
    private String submitPath = "/videos/generations";

    /** 轮询任务状态的子路径模板，{id} 会被替换为 submit 返回的 task_id。 */
    private String pollPathTemplate = "/async-result/{id}";

    /** 服务端轮询间隔（秒）。 */
    private int pollIntervalSeconds = 8;

    /** 单个任务最长等待（秒）；超时判失败并退款。视频生成慢，默认 10 分钟。 */
    private int maxWaitSeconds = 600;

    /** 并发生成数（worker 线程池大小）。视频生成期间 worker 线程会长时间轮询占用。 */
    private int maxConcurrent = 3;

    /** 提交时若 provider 未配 defaultModel 的兜底 model 名。 */
    private String defaultModel = "cogvideox-flash";

    /** 默认时长（秒）/ 比例 —— 请求体里带给厂商（厂商不认时一般忽略）。 */
    private int defaultDurationSec = 5;
    private String defaultAspectRatio = "9:16";

    /** 单次 HTTP 超时（秒）。 */
    private int httpTimeoutSeconds = 30;

    public String getSubmitPath() { return submitPath; }
    public void setSubmitPath(String submitPath) { this.submitPath = submitPath; }

    public String getPollPathTemplate() { return pollPathTemplate; }
    public void setPollPathTemplate(String pollPathTemplate) { this.pollPathTemplate = pollPathTemplate; }

    public int getPollIntervalSeconds() { return pollIntervalSeconds; }
    public void setPollIntervalSeconds(int pollIntervalSeconds) { this.pollIntervalSeconds = pollIntervalSeconds; }

    public int getMaxWaitSeconds() { return maxWaitSeconds; }
    public void setMaxWaitSeconds(int maxWaitSeconds) { this.maxWaitSeconds = maxWaitSeconds; }

    public int getMaxConcurrent() { return maxConcurrent; }
    public void setMaxConcurrent(int maxConcurrent) { this.maxConcurrent = maxConcurrent; }

    public String getDefaultModel() { return defaultModel; }
    public void setDefaultModel(String defaultModel) { this.defaultModel = defaultModel; }

    public int getDefaultDurationSec() { return defaultDurationSec; }
    public void setDefaultDurationSec(int defaultDurationSec) { this.defaultDurationSec = defaultDurationSec; }

    public String getDefaultAspectRatio() { return defaultAspectRatio; }
    public void setDefaultAspectRatio(String defaultAspectRatio) { this.defaultAspectRatio = defaultAspectRatio; }

    public int getHttpTimeoutSeconds() { return httpTimeoutSeconds; }
    public void setHttpTimeoutSeconds(int httpTimeoutSeconds) { this.httpTimeoutSeconds = httpTimeoutSeconds; }
}
