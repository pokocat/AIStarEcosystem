package com.aistareco.aep.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 短剧首帧后台任务配置。首帧图像生成可能阻塞 1-2 分钟，必须走可恢复队列。
 */
@Configuration
@ConfigurationProperties(prefix = "aep.drama.frame")
public class DramaFrameProperties {

    /** 首帧生成并发数。超出的任务由 ThreadPoolTaskExecutor 排队。 */
    private int maxConcurrent = 2;

    /** 单个首帧任务前端建议轮询超时（秒），后端 worker 仍以图像模型 HTTP timeout 为准。 */
    private int maxWaitSeconds = 180;

    public int getMaxConcurrent() {
        return maxConcurrent;
    }

    public void setMaxConcurrent(int maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
    }

    public int getMaxWaitSeconds() {
        return maxWaitSeconds;
    }

    public void setMaxWaitSeconds(int maxWaitSeconds) {
        this.maxWaitSeconds = maxWaitSeconds;
    }
}
