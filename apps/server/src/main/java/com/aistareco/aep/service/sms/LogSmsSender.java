package com.aistareco.aep.service.sms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * v0.31+ 默认 SMS sender —— 不真发短信，只把验证码打到 server log。
 *
 * 用途：
 *   1. dev / 联调环境（开发者直接从 log 取码登录）
 *   2. 阿里云模板未备案 / accessKey 未配 时的安全占位
 *   3. CI / 单测（不依赖外网）
 *
 * 默认启用（aep.sms.driver 未配 或 显式设为 log）。生产环境切到 aliyun 驱动前
 * 必须配齐 ALIYUN_SMS_SIGN_NAME / ALIYUN_SMS_TEMPLATE_CODE；凭据可显式配置 AK 或走
 * Alibaba Cloud 默认凭据链。
 */
@Component
@ConditionalOnProperty(prefix = "aep.sms", name = "driver", havingValue = "log", matchIfMissing = true)
public class LogSmsSender implements SmsSender {

    private static final Logger log = LoggerFactory.getLogger(LogSmsSender.class);

    @Override
    public void sendVerificationCode(String phone, String code) {
        log.info("[sms-log] verification code phone={} code={} (NOT sent — driver=log)", phone, code);
    }
}
