package com.aistareco.aep.service.sms;

import com.aliyun.auth.credentials.Credential;
import com.aliyun.auth.credentials.provider.DefaultCredentialProvider;
import com.aliyun.auth.credentials.provider.ICredentialProvider;
import com.aliyun.auth.credentials.provider.StaticCredentialProvider;
import com.aliyun.sdk.service.dysmsapi20170525.AsyncClient;
import com.aliyun.sdk.service.dysmsapi20170525.models.QuerySendDetailsRequest;
import com.aliyun.sdk.service.dysmsapi20170525.models.QuerySendDetailsResponse;
import com.aliyun.sdk.service.dysmsapi20170525.models.QuerySendDetailsResponseBody;
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
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
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
 *   aep.sms.aliyun.login-template-code=SMS_507065062
 *   aep.sms.aliyun.register-template-code=SMS_xxxxx
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
    private final String loginTemplateCode;
    private final String registerTemplateCode;
    private final String region;
    private final long callTimeoutSeconds;
    private final boolean deliveryQueryEnabled;
    private final int deliveryQueryAttempts;
    private final long deliveryQueryInitialDelayMs;
    private final long deliveryQueryIntervalMs;
    private final ObjectMapper mapper;
    private final ICredentialProvider credentialProvider;
    private final AsyncClient client;

    public AliyunSmsSender(
            @Value("${aep.sms.aliyun.access-key-id:}") String accessKeyId,
            @Value("${aep.sms.aliyun.access-key-secret:}") String accessKeySecret,
            @Value("${aep.sms.aliyun.sign-name:}") String signName,
            @Value("${aep.sms.aliyun.template-code:}") String legacyTemplateCode,
            @Value("${aep.sms.aliyun.login-template-code:}") String loginTemplateCode,
            @Value("${aep.sms.aliyun.register-template-code:}") String registerTemplateCode,
            @Value("${aep.sms.aliyun.region:cn-hangzhou}") String region,
            @Value("${aep.sms.aliyun.endpoint:dysmsapi.aliyuncs.com}") String endpoint,
            @Value("${aep.sms.aliyun.connect-timeout-seconds:10}") long connectTimeoutSeconds,
            @Value("${aep.sms.aliyun.response-timeout-seconds:20}") long responseTimeoutSeconds,
            @Value("${aep.sms.aliyun.call-timeout-seconds:30}") long callTimeoutSeconds,
            @Value("${aep.sms.aliyun.delivery-query-enabled:true}") boolean deliveryQueryEnabled,
            @Value("${aep.sms.aliyun.delivery-query-attempts:10}") int deliveryQueryAttempts,
            @Value("${aep.sms.aliyun.delivery-query-initial-delay-ms:1500}") long deliveryQueryInitialDelayMs,
            @Value("${aep.sms.aliyun.delivery-query-interval-ms:5000}") long deliveryQueryIntervalMs,
            ObjectMapper mapper
    ) {
        String trimmedAccessKeyId = trim(accessKeyId);
        String trimmedAccessKeySecret = trim(accessKeySecret);
        if (trimmedAccessKeyId.isBlank() != trimmedAccessKeySecret.isBlank()) {
            throw new IllegalStateException(
                    "aep.sms.driver=aliyun 时 access-key-id / access-key-secret 必须同时配置，"
                            + "或同时留空改用 Alibaba Cloud 默认凭据链");
        }
        String resolvedLoginTemplateCode = firstNonBlank(loginTemplateCode, legacyTemplateCode);
        String resolvedRegisterTemplateCode = firstNonBlank(registerTemplateCode, legacyTemplateCode);
        if (trim(signName).isBlank()
                || resolvedLoginTemplateCode.isBlank()
                || resolvedRegisterTemplateCode.isBlank()) {
            throw new IllegalStateException(
                    "aep.sms.driver=aliyun 但未配齐 sign-name / login-template-code / register-template-code；"
                            + "请检查 ALIYUN_SMS_SIGN_NAME / application.yml 登录模板 / "
                            + "ALIYUN_SMS_REGISTER_TEMPLATE_CODE 或回退到 driver=log");
        }
        this.signName = trim(signName);
        this.loginTemplateCode = resolvedLoginTemplateCode;
        this.registerTemplateCode = resolvedRegisterTemplateCode;
        this.region = defaultIfBlank(region, "cn-hangzhou");
        this.callTimeoutSeconds = Math.max(1, callTimeoutSeconds);
        this.deliveryQueryEnabled = deliveryQueryEnabled;
        this.deliveryQueryAttempts = Math.max(0, deliveryQueryAttempts);
        this.deliveryQueryInitialDelayMs = Math.max(0, deliveryQueryInitialDelayMs);
        this.deliveryQueryIntervalMs = Math.max(0, deliveryQueryIntervalMs);
        this.mapper = mapper;
        this.credentialProvider = buildCredentialProvider(trimmedAccessKeyId, trimmedAccessKeySecret);
        this.client = AsyncClient.builder()
                .region(this.region)
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
    public SmsSendResult sendVerificationCode(String phone, String code, SmsCodePurpose purpose) {
        SmsCodePurpose resolvedPurpose = purpose == null ? SmsCodePurpose.LOGIN : purpose;
        String templateCode = templateCodeFor(resolvedPurpose);
        try {
            SendSmsRequest request = SendSmsRequest.builder()
                    .phoneNumbers(phone)
                    .signName(signName)
                    .templateCode(templateCode)
                    .templateParam(mapper.writeValueAsString(Map.of("code", code)))
                    .build();

            SendSmsResponse response = client.sendSms(request).get(callTimeoutSeconds, TimeUnit.SECONDS);
            Integer statusCode = response == null ? null : response.getStatusCode();
            SendSmsResponseBody body = response == null ? null : response.getBody();
            if (body == null) {
                logAliyunFailure("empty-body", resolvedPurpose, templateCode, phone, statusCode, null);
                throw new SmsSendException("阿里云短信发送失败：响应体为空" + httpStatusSuffix(statusCode),
                        aliyunResult(false, resolvedPurpose, templateCode, statusCode, null, SmsSendResult.DeliveryStatus.UNKNOWN));
            }
            if (statusCode != null && statusCode >= 400) {
                logAliyunFailure("http-error", resolvedPurpose, templateCode, phone, statusCode, body);
                throw new SmsSendException(failureMessage("阿里云短信发送失败", statusCode, body),
                        aliyunResult(false, resolvedPurpose, templateCode, statusCode, body, SmsSendResult.DeliveryStatus.UNKNOWN));
            }
            if (!"OK".equals(body.getCode())) {
                logAliyunFailure("provider-error", resolvedPurpose, templateCode, phone, statusCode, body);
                throw new SmsSendException(failureMessage("阿里云短信发送失败", statusCode, body),
                        aliyunResult(false, resolvedPurpose, templateCode, statusCode, body, SmsSendResult.DeliveryStatus.FAILED));
            }
            log.info("[sms-aliyun] sent purpose={} templateCode={} phone={} httpStatus={} code={} message={} requestId={} bizId={}",
                    resolvedPurpose.wire(), templateCode, phone, statusCode, body.getCode(), body.getMessage(),
                    body.getRequestId(), body.getBizId());
            SmsSendResult accepted = aliyunResult(true, resolvedPurpose, templateCode, statusCode, body, SmsSendResult.DeliveryStatus.ACCEPTED);
            SmsSendResult checked = queryDeliveryIfConfigured(phone, accepted);
            if (checked.deliveryStatus() == SmsSendResult.DeliveryStatus.FAILED) {
                log.warn("[sms-aliyun] delivery failed purpose={} templateCode={} phone={} bizId={} sendStatus={} errCode={} sendDate={} receiveDate={}",
                        resolvedPurpose.wire(), templateCode, phone, checked.bizId(), checked.sendStatus(),
                        checked.errCode(), checked.sendDate(), checked.receiveDate());
                throw new SmsSendException(deliveryFailureMessage(checked), checked);
            }
            return checked;
        } catch (SmsSendException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("[sms-aliyun] interrupted purpose={} templateCode={} phone={} err={}",
                    resolvedPurpose.wire(), templateCode, phone, e.getMessage(), e);
            throw new SmsSendException("阿里云 SMS 调用被中断", e);
        } catch (ExecutionException e) {
            log.warn("[sms-aliyun] call failed purpose={} templateCode={} phone={} err={}",
                    resolvedPurpose.wire(), templateCode, phone, rootMessage(e), e);
            throw new SmsSendException("阿里云 SMS 调用异常: " + rootMessage(e), e);
        } catch (TimeoutException e) {
            log.warn("[sms-aliyun] timeout purpose={} templateCode={} phone={} timeoutSeconds={}",
                    resolvedPurpose.wire(), templateCode, phone, callTimeoutSeconds, e);
            throw new SmsSendException("阿里云 SMS 调用超时（" + callTimeoutSeconds + "s）", e);
        } catch (Exception e) {
            log.warn("[sms-aliyun] call failed purpose={} templateCode={} phone={} err={}",
                    resolvedPurpose.wire(), templateCode, phone, e.getMessage(), e);
            throw new SmsSendException("阿里云 SMS 调用异常: " + e.getMessage(), e);
        }
    }

    private SmsSendResult queryDeliveryIfConfigured(String phone, SmsSendResult accepted) throws InterruptedException {
        if (!deliveryQueryEnabled || deliveryQueryAttempts <= 0 || isBlank(accepted.bizId())) {
            return accepted;
        }
        SmsSendResult last = accepted;
        for (int attempt = 0; attempt < deliveryQueryAttempts; attempt++) {
            long delay = attempt == 0 ? deliveryQueryInitialDelayMs : deliveryQueryIntervalMs;
            if (delay > 0) {
                Thread.sleep(delay);
            }
            try {
                QuerySendDetailsRequest request = QuerySendDetailsRequest.builder()
                        .phoneNumber(phone)
                        .bizId(accepted.bizId())
                        .sendDate(LocalDate.now(ZoneId.of("Asia/Shanghai")).format(DateTimeFormatter.BASIC_ISO_DATE))
                        .pageSize(10L)
                        .currentPage(1L)
                        .build();
                QuerySendDetailsResponse response = client.querySendDetails(request).get(callTimeoutSeconds, TimeUnit.SECONDS);
                QuerySendDetailsResponseBody body = response == null ? null : response.getBody();
                if (body == null) {
                    log.warn("[sms-aliyun] delivery-query empty-body bizId={} requestId={}", accepted.bizId(), accepted.requestId());
                    last = withDelivery(accepted, SmsSendResult.DeliveryStatus.UNKNOWN, null, "QUERY_EMPTY_BODY", null, null);
                    continue;
                }
                if (!"OK".equals(body.getCode())) {
                    log.warn("[sms-aliyun] delivery-query provider-error bizId={} code={} message={} requestId={}",
                            accepted.bizId(), body.getCode(), body.getMessage(), body.getRequestId());
                    last = withDelivery(accepted, SmsSendResult.DeliveryStatus.UNKNOWN, null, body.getCode(), null, null);
                    continue;
                }
                QuerySendDetailsResponseBody.SmsSendDetailDTO detail = firstDetail(body);
                if (detail == null) {
                    last = withDelivery(accepted, SmsSendResult.DeliveryStatus.PENDING, 1L, null, null, null);
                    continue;
                }
                SmsSendResult.DeliveryStatus status = deliveryStatusOf(detail.getSendStatus());
                last = withDelivery(accepted, status, detail.getSendStatus(), detail.getErrCode(),
                        detail.getSendDate(), detail.getReceiveDate());
                if (status == SmsSendResult.DeliveryStatus.PENDING) {
                    continue;
                }
                return last;
            } catch (InterruptedException e) {
                throw e;
            } catch (Exception e) {
                log.warn("[sms-aliyun] delivery-query failed bizId={} err={}", accepted.bizId(), rootMessage(e));
                last = withDelivery(accepted, SmsSendResult.DeliveryStatus.UNKNOWN, null, "QUERY_FAILED", null, null);
            }
        }
        if (last.deliveryStatus() == SmsSendResult.DeliveryStatus.ACCEPTED) {
            return withDelivery(accepted, SmsSendResult.DeliveryStatus.PENDING, 1L, null, null, null);
        }
        return last;
    }

    private static QuerySendDetailsResponseBody.SmsSendDetailDTO firstDetail(QuerySendDetailsResponseBody body) {
        if (body == null || body.getSmsSendDetailDTOs() == null) {
            return null;
        }
        List<QuerySendDetailsResponseBody.SmsSendDetailDTO> list = body.getSmsSendDetailDTOs().getSmsSendDetailDTO();
        return list == null || list.isEmpty() ? null : list.get(0);
    }

    private static SmsSendResult.DeliveryStatus deliveryStatusOf(Long sendStatus) {
        if (sendStatus == null) return SmsSendResult.DeliveryStatus.UNKNOWN;
        if (sendStatus == 1L) return SmsSendResult.DeliveryStatus.PENDING;
        if (sendStatus == 2L) return SmsSendResult.DeliveryStatus.FAILED;
        if (sendStatus == 3L) return SmsSendResult.DeliveryStatus.DELIVERED;
        return SmsSendResult.DeliveryStatus.UNKNOWN;
    }

    private static SmsSendResult aliyunResult(
            boolean accepted,
            SmsCodePurpose purpose,
            String templateCode,
            Integer statusCode,
            SendSmsResponseBody body,
            SmsSendResult.DeliveryStatus deliveryStatus
    ) {
        return new SmsSendResult(
                accepted && deliveryStatus != SmsSendResult.DeliveryStatus.FAILED,
                accepted,
                "aliyun",
                purpose.wire(),
                templateCode,
                statusCode,
                bodyCode(body),
                bodyMessage(body),
                bodyRequestId(body),
                bodyBizId(body),
                deliveryStatus,
                null,
                null,
                null,
                null
        );
    }

    private static SmsSendResult withDelivery(
            SmsSendResult base,
            SmsSendResult.DeliveryStatus deliveryStatus,
            Long sendStatus,
            String errCode,
            String sendDate,
            String receiveDate
    ) {
        return new SmsSendResult(
                base.accepted() && deliveryStatus != SmsSendResult.DeliveryStatus.FAILED,
                base.accepted(),
                base.provider(),
                base.purpose(),
                base.templateCode(),
                base.httpStatus(),
                base.providerCode(),
                base.providerMessage(),
                base.requestId(),
                base.bizId(),
                deliveryStatus,
                sendStatus,
                errCode,
                sendDate,
                receiveDate
        );
    }

    private static String deliveryFailureMessage(SmsSendResult result) {
        StringBuilder sb = new StringBuilder("阿里云短信发送失败：运营商回执失败");
        if (!isBlank(result.errCode())) {
            sb.append(" ErrCode=").append(result.errCode());
        }
        if (!isBlank(result.bizId())) {
            sb.append(" BizId=").append(result.bizId());
        }
        return sb.toString();
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

    private static String firstNonBlank(String first, String second) {
        String trimmedFirst = trim(first);
        if (!trimmedFirst.isBlank()) {
            return trimmedFirst;
        }
        return trim(second);
    }

    private String templateCodeFor(SmsCodePurpose purpose) {
        return switch (purpose) {
            case LOGIN -> loginTemplateCode;
            case REGISTER -> registerTemplateCode;
        };
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static void logAliyunFailure(
            String event,
            SmsCodePurpose purpose,
            String templateCode,
            String phone,
            Integer httpStatus,
            SendSmsResponseBody body
    ) {
        log.warn("[sms-aliyun] {} purpose={} templateCode={} phone={} httpStatus={} code={} message={} requestId={} bizId={}",
                event,
                purpose.wire(),
                templateCode,
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
