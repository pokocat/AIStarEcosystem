package com.aistareco;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * v0.15+: 启用 @EnableScheduling 以让 PublishJobScheduler 的 @Scheduled 方法生效
 * （定时发布任务到点自动触发 startJob）。
 */
@SpringBootApplication
@EnableScheduling
public class AiStarEcoApplication {
    public static void main(String[] args) {
        SpringApplication.run(AiStarEcoApplication.class, args);
    }
}
