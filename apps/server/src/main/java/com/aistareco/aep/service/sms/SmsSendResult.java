package com.aistareco.aep.service.sms;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Structured SMS provider response returned to upper layers.
 *
 * <p>For Aliyun, accepted=true means SendSms returned Code=OK. Final carrier
 * delivery is represented separately by deliveryStatus/sendStatus.
 */
public record SmsSendResult(
        boolean sent,
        boolean accepted,
        String provider,
        String purpose,
        String templateCode,
        Integer httpStatus,
        String providerCode,
        String providerMessage,
        String requestId,
        String bizId,
        DeliveryStatus deliveryStatus,
        Long sendStatus,
        String errCode,
        String sendDate,
        String receiveDate
) {
    public enum DeliveryStatus {
        NOT_APPLICABLE,
        ACCEPTED,
        PENDING,
        DELIVERED,
        FAILED,
        UNKNOWN
    }

    public static SmsSendResult log(SmsCodePurpose purpose) {
        SmsCodePurpose resolvedPurpose = purpose == null ? SmsCodePurpose.LOGIN : purpose;
        return new SmsSendResult(
                true,
                true,
                "log",
                resolvedPurpose.wire(),
                null,
                null,
                "LOG_ONLY",
                "验证码仅写入服务端日志，未调用真实短信供应商",
                null,
                null,
                DeliveryStatus.NOT_APPLICABLE,
                null,
                null,
                null,
                null
        );
    }

    public Map<String, Object> toDetailsMap() {
        Map<String, Object> details = new LinkedHashMap<>();
        put(details, "sent", sent);
        put(details, "accepted", accepted);
        put(details, "provider", provider);
        put(details, "purpose", purpose);
        put(details, "templateCode", templateCode);
        put(details, "httpStatus", httpStatus);
        put(details, "providerCode", providerCode);
        put(details, "providerMessage", providerMessage);
        put(details, "requestId", requestId);
        put(details, "bizId", bizId);
        put(details, "deliveryStatus", deliveryStatus == null ? null : deliveryStatus.name());
        put(details, "sendStatus", sendStatus);
        put(details, "errCode", errCode);
        put(details, "sendDate", sendDate);
        put(details, "receiveDate", receiveDate);
        return details;
    }

    private static void put(Map<String, Object> target, String key, Object value) {
        if (value != null) {
            target.put(key, value);
        }
    }
}
