package com.aistareco.aep.service.alerts;

import lombok.Getter;
import lombok.Setter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Getter @Setter @Configuration
public class FeishuAlertConfig {
    @Value("${AEP_FEISHU_ALERTS_ENABLED:false}") private boolean enabled;
    @Value("${AEP_FEISHU_APP_ID:}") private String appId="";
    @Value("${AEP_FEISHU_APP_SECRET:}") private String appSecret="";
    @Value("${AEP_FEISHU_ALERT_CHAT_ID:}") private String chatId="";
    @Value("${AEP_FEISHU_ALERT_USER_ID:}") private String userId="";
    @Value("${AEP_FEISHU_ALERT_URGENT:false}") private boolean urgent=false;
    public boolean ready(){return enabled&&!appId.isBlank()&&!appSecret.isBlank()&&chatId.startsWith("oc_")&&userId.startsWith("ou_");}
    // Once a custom scheduler exists Boot backs off. Keep an explicit default so unqualified
    // existing @Scheduled jobs do not accidentally run on the notification executor.
    @Bean(name="taskScheduler") public ThreadPoolTaskScheduler coreScheduler() {
        var scheduler=new ThreadPoolTaskScheduler();scheduler.setPoolSize(1);scheduler.setThreadNamePrefix("scheduling-");return scheduler;
    }
    // Notification timeouts must not delay model queue dispatch or credit settlement schedulers.
    @Bean(name="modelAlertScheduler") public ThreadPoolTaskScheduler scheduler() {
        var scheduler=new ThreadPoolTaskScheduler();scheduler.setPoolSize(1);scheduler.setThreadNamePrefix("model-alert-");return scheduler;
    }
}
