package com.aistareco.aep.service.sms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Explicit production placeholder: fail SMS requests until a real provider is configured.
 */
@Component
@ConditionalOnProperty(prefix = "aep.sms", name = "driver", havingValue = "disabled")
public class DisabledSmsSender implements SmsSender {

    private static final Logger log = LoggerFactory.getLogger(DisabledSmsSender.class);

    @Override
    public SmsSendResult sendVerificationCode(String phone, String code, SmsCodePurpose purpose) {
        SmsCodePurpose resolvedPurpose = purpose == null ? SmsCodePurpose.LOGIN : purpose;
        log.warn("[sms-disabled] blocked verification code request purpose={} phone={} (SMS provider not configured)",
                resolvedPurpose.wire(), phone);
        throw new SmsSendException("短信服务未配置，请先配置真实短信供应商");
    }
}
