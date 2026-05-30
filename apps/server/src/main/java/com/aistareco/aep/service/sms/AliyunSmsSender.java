package com.aistareco.aep.service.sms;

import com.aliyun.auth.credentials.Credential;
import com.aliyun.auth.credentials.provider.DefaultCredentialProvider;
import com.aliyun.auth.credentials.provider.ICredentialProvider;
import com.aliyun.auth.credentials.provider.StaticCredentialProvider;
import com.aliyun.sdk.service.dysmsapi20170525.AsyncClient;
import com.aliyun.sdk.service.dysmsapi20170525.models.SendSmsRequest;
import com.aliyun.sdk.service.dysmsapi20170525.models.SendSmsResponse;
import com.aliyun.sdk.service.dysmsapi20170525.models.SendSmsResponseBody;
import com.fasterxml.jackson.databind.ObjectMapper;
import darabonba.core.client.ClientOverrideConfiguration;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * v0.31+ 阿里云 SMS 发送实现。
 *
 * 启用方式（application.yml 或 env）：
 *   aep.sms.driver=aliyun
 *   aep.sms.aliyun.access-key-id=LTAIxxxx
 *   aep.sms.aliyun.access-key-secret=xxxx
 *   aep.sms.aliyun.sign-name=星耀生态
 *   aep.sms.aliyun.template-code=SMS_xxxxx
 *
 * 阿里云控制台准备：
 *   1. 开通短信服务 + 添加签名（备案审核）
 *   2. 创建模板（带 ${code} 变量，eg "您的验证码：${code}，5 分钟内有效"）
 *   3. 在 RAM 创建访问凭据，授予 AliyunDysmsFullAccess 权限
 */
@Component
@ConditionalOnProperty(prefix = "aep.sms", name = "driver", havingValue = "aliyun")
public class AliyunSmsSender implements SmsSender {

    private static final Logger log = LoggerFactory.getLogger(AliyunSmsSender.class);

    private final String signName;
    private final String templateCode;
    private final String templateParamCodeKey;
    private final long callTimeoutSeconds;
    private final ObjectMapper mapper;
    private final ICredentialProvider credentialProvider;
    private final AsyncClient client;

    public AliyunSmsSender(
            @Value("${aep.sms.aliyun.access-key-id:}") String accessKeyId,
            @Value("${aep.sms.aliyun.access-key-secret:}") String accessKeySecret,
            @Value("${aep.sms.aliyun.sign-name:}") String signName,
            @Value("${aep.sms.aliyun.template-code:}") String templateCode,
            @Value("${aep.sms.aliyun.template-param-code-key:code}") String templateParamCodeKey,
            @Value("${aep.sms.aliyun.region:cn-hangzhou}") String region,
            @Value("${aep.sms.aliyun.endpoint:dysmsapi.aliyuncs.com}") String endpoint,
            @Value("${aep.sms.aliyun.connect-timeout-seconds:10}") long connectTimeoutSeconds,
            @Value("${aep.sms.aliyun.response-timeout-seconds:20}") long responseTimeoutSeconds,
            @Value("${aep.sms.aliyun.call-timeout-seconds:30}") long callTimeoutSeconds,
            ObjectMapper mapper
    ) {
        String trimmedAccessKeyId = trim(accessKeyId);
        String trimmedAccessKeySecret = trim(accessKeySecret);
        if (trimmedAccessKeyId.isBlank() != trimmedAccessKeySecret.isBlank()) {
            throw new IllegalStateException(
                    "aep.sms.driver=aliyun 时 access-key-id / access-key-secret 必须同时配置，"
                            + "或同时留空改用 Alibaba Cloud 默认凭据链");
        }
        if (trim(signName).isBlank() || trim(templateCode).isBlank()) {
            throw new IllegalStateException(
                    "aep.sms.driver=aliyun 但未配齐 sign-name / template-code；"
                            + "请检查 ALIYUN_SMS_SIGN_NAME / ALIYUN_SMS_TEMPLATE_CODE 或回退到 driver=log");
        }
        this.signName = trim(signName);
        this.templateCode = trim(templateCode);
        this.templateParamCodeKey = trim(templateParamCodeKey).isBlank() ? "code" : trim(templateParamCodeKey);
        this.callTimeoutSeconds = Math.max(1, callTimeoutSeconds);
        this.mapper = mapper;
        this.credentialProvider = buildCredentialProvider(trimmedAccessKeyId, trimmedAccessKeySecret);
        this.client = AsyncClient.builder()
                .region(defaultIfBlank(region, "cn-hangzhou"))
                .credentialsProvider(credentialProvider)
                .overrideConfiguration(
                        ClientOverrideConfiguration.create()
                                .setEndpointOverride(defaultIfBlank(endpoint, "dysmsapi.aliyuncs.com"))
                                .setConnectTimeout(Duration.ofSeconds(Math.max(1, connectTimeoutSeconds)))
                                .setResponseTimeout(Duration.ofSeconds(Math.max(1, responseTimeoutSeconds)))
                )
                .build();
    }

    @Override
    public void sendVerificationCode(String phone, String code) {
        try {
            SendSmsRequest request = SendSmsRequest.builder()
                    .phoneNumbers(phone)
                    .signName(signName)
                    .templateCode(templateCode)
                    .templateParam(mapper.writeValueAsString(Map.of(templateParamCodeKey, code)))
                    .build();

            SendSmsResponse response = client.sendSms(request).get(callTimeoutSeconds, TimeUnit.SECONDS);
            Integer statusCode = response == null ? null : response.getStatusCode();
            SendSmsResponseBody body = response == null ? null : response.getBody();
            if (body == null) {
                logAliyunFailure("empty-body", phone, statusCode, null);
                throw new SmsSendException("阿里云短信发送失败：响应体为空" + httpStatusSuffix(statusCode));
            }
            if (statusCode != null && statusCode >= 400) {
                logAliyunFailure("http-error", phone, statusCode, body);
                throw new SmsSendException(failureMessage("阿里云短信发送失败", statusCode, body));
            }
            if (!"OK".equals(body.getCode())) {
                logAliyunFailure("provider-error", phone, statusCode, body);
                throw new SmsSendException(failureMessage("阿里云短信发送失败", statusCode, body));
            }
            log.info("[sms-aliyun] sent phone={} httpStatus={} code={} message={} requestId={} bizId={}",
                    phone, statusCode, body.getCode(), body.getMessage(), body.getRequestId(), body.getBizId());
        } catch (SmsSendException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("[sms-aliyun] interrupted phone={} err={}", phone, e.getMessage(), e);
            throw new SmsSendException("阿里云 SMS 调用被中断", e);
        } catch (ExecutionException e) {
            log.warn("[sms-aliyun] call failed phone={} err={}", phone, rootMessage(e), e);
            throw new SmsSendException("阿里云 SMS 调用异常: " + rootMessage(e), e);
        } catch (TimeoutException e) {
            log.warn("[sms-aliyun] timeout phone={} timeoutSeconds={}", phone, callTimeoutSeconds, e);
            throw new SmsSendException("阿里云 SMS 调用超时（" + callTimeoutSeconds + "s）", e);
        } catch (Exception e) {
            log.warn("[sms-aliyun] call failed phone={} err={}", phone, e.getMessage(), e);
            throw new SmsSendException("阿里云 SMS 调用异常: " + e.getMessage(), e);
        }
    }

    @PreDestroy
    void close() {
        try {
            client.close();
        } catch (Exception e) {
            log.debug("[sms-aliyun] close client ignored: {}", e.getMessage());
        }
        try {
            credentialProvider.close();
        } catch (Exception e) {
            log.debug("[sms-aliyun] close credentials ignored: {}", e.getMessage());
        }
    }

    private static ICredentialProvider buildCredentialProvider(String accessKeyId, String accessKeySecret) {
        if (!accessKeyId.isBlank() && !accessKeySecret.isBlank()) {
            return StaticCredentialProvider.create(
                    Credential.builder()
                            .accessKeyId(accessKeyId)
                            .accessKeySecret(accessKeySecret)
                            .build()
            );
        }
        return DefaultCredentialProvider.builder().build();
    }

    private static String defaultIfBlank(String value, String fallback) {
        String trimmed = trim(value);
        return trimmed.isBlank() ? fallback : trimmed;
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private static void logAliyunFailure(String event, String phone, Integer httpStatus, SendSmsResponseBody body) {
        log.warn("[sms-aliyun] {} phone={} httpStatus={} code={} message={} requestId={} bizId={}",
                event,
                phone,
                httpStatus,
                bodyCode(body),
                bodyMessage(body),
                bodyRequestId(body),
                bodyBizId(body));
    }

    private static String failureMessage(String prefix, Integer httpStatus, SendSmsResponseBody body) {
        StringBuilder sb = new StringBuilder(prefix);
        if (httpStatus != null) {
            sb.append(" HTTP=").append(httpStatus);
        }
        sb.append(" Code=").append(valueOrDash(bodyCode(body)));
        sb.append(" Message=").append(valueOrDash(bodyMessage(body)));
        sb.append(" RequestId=").append(valueOrDash(bodyRequestId(body)));
        String bizId = bodyBizId(body);
        if (bizId != null && !bizId.isBlank()) {
            sb.append(" BizId=").append(bizId);
        }
        return sb.toString();
    }

    private static String httpStatusSuffix(Integer httpStatus) {
        return httpStatus == null ? "" : " HTTP=" + httpStatus;
    }

    private static String bodyCode(SendSmsResponseBody body) {
        return body == null ? null : body.getCode();
    }

    private static String bodyMessage(SendSmsResponseBody body) {
        return body == null ? null : body.getMessage();
    }

    private static String bodyRequestId(SendSmsResponseBody body) {
        return body == null ? null : body.getRequestId();
    }

    private static String bodyBizId(SendSmsResponseBody body) {
        return body == null ? null : body.getBizId();
    }

    private static String valueOrDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private static String rootMessage(Throwable t) {
        Throwable cur = t;
        while (cur.getCause() != null) cur = cur.getCause();
        return cur.getMessage() == null ? cur.getClass().getSimpleName() : cur.getMessage();
    }
}
