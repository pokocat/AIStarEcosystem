package com.aistareco.aep.service.sms;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * v0.31+ 默认 SMS sender —— 不真发短信，只把验证码打到 server log。
 *
 * 用途：
 *   1. dev / 联调环境（开发者直接从 log 取码登录）
 *   2. 阿里云模板未备案 / accessKey 未配 时的安全占位
 *   3. CI / 单测（不依赖外网）
 *
 * 默认启用（aep.sms.driver 未配 或 显式设为 log）。生产环境切到 aliyun 驱动前
 * 必须配齐 ALIYUN_SMS_SIGN_NAME / ALIYUN_SMS_REGISTER_TEMPLATE_CODE；
 * 登录模板固定从 application.yml 的 aep.sms.aliyun.login-template-code 读取。
 * 凭据可显式配置 AK 或走 Alibaba Cloud 默认凭据链。
 *
 * 反静默降级（AGENTS.md §8）：mysql / prod profile 下启动即打 ERROR 横幅 ——
 * driver=log 时用户收不到任何真实短信（登录/注册不可用），线上巡检应视作部署事故。
 */
@Component
@ConditionalOnProperty(prefix = "aep.sms", name = "driver", havingValue = "log", matchIfMissing = true)
public class LogSmsSender implements SmsSender {

    private static final Logger log = LoggerFactory.getLogger(LogSmsSender.class);

    private final Environment env;

    public LogSmsSender(Environment env) {
        this.env = env;
    }

    @PostConstruct
    void warnIfProductionLike() {
        boolean prodLike = Arrays.stream(env.getActiveProfiles())
                .anyMatch(p -> p.equalsIgnoreCase("mysql") || p.equalsIgnoreCase("prod") || p.equalsIgnoreCase("production"));
        if (prodLike) {
            log.error("==========================================================================");
            log.error("⚠️  SMS DRIVER = log（生产 profile 下验证码不会真实发送，登录/注册不可用）");
            log.error("⚠️  生产部署必须设置 AEP_SMS_DRIVER=aliyun 并配齐签名/模板/凭据");
            log.error("⚠️  本地 mysql 联调可忽略本横幅");
            log.error("==========================================================================");
        } else {
            log.info("[sms-log] driver=log（验证码仅打日志，不真实发送）");
        }
    }

    @Override
    public SmsSendResult sendVerificationCode(String phone, String code, SmsCodePurpose purpose) {
        SmsCodePurpose resolvedPurpose = purpose == null ? SmsCodePurpose.LOGIN : purpose;
        log.info("[sms-log] verification code purpose={} phone={} code={} (NOT sent — driver=log)",
                resolvedPurpose.wire(), phone, code);
        return SmsSendResult.log(resolvedPurpose);
    }
}
