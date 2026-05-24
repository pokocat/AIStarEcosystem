package com.aistareco.aep.service.sms;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.time.Duration;
import java.util.*;

/**
 * v0.31+ 阿里云 SMS 发送实现 —— 手撸 POP RPC 签名 + REST 调用，**不依赖 dysmsapi SDK**。
 *
 * 选这条路而不是 SDK 的原因：当前 dev 环境的 maven mirror（maven.aliyun.com）拉不到
 * com.aliyun:dysmsapi20170525 jar；REST + JDK 内置 HttpClient + HMAC-SHA1 完全够用。
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
 *
 * 接口文档：https://help.aliyun.com/document_detail/101343.html
 */
@Component
@ConditionalOnProperty(prefix = "aep.sms", name = "driver", havingValue = "aliyun")
public class AliyunSmsSender implements SmsSender {

    private static final Logger log = LoggerFactory.getLogger(AliyunSmsSender.class);
    private static final String ENDPOINT = "https://dysmsapi.aliyuncs.com/";
    private static final String API_VERSION = "2017-05-25";
    private static final String SIGN_METHOD = "HMAC-SHA1";
    private static final String SIGN_VERSION = "1.0";
    private static final String FORMAT = "JSON";

    private final String accessKeyId;
    private final String accessKeySecret;
    private final String signName;
    private final String templateCode;
    private final HttpClient httpClient;
    private final ObjectMapper mapper;

    public AliyunSmsSender(
            @Value("${aep.sms.aliyun.access-key-id:}") String accessKeyId,
            @Value("${aep.sms.aliyun.access-key-secret:}") String accessKeySecret,
            @Value("${aep.sms.aliyun.sign-name:}") String signName,
            @Value("${aep.sms.aliyun.template-code:}") String templateCode,
            ObjectMapper mapper
    ) {
        if (accessKeyId.isBlank() || accessKeySecret.isBlank() || signName.isBlank() || templateCode.isBlank()) {
            throw new IllegalStateException(
                    "aep.sms.driver=aliyun 但未配齐 access-key-id / access-key-secret / sign-name / template-code；"
                            + "请检查环境变量 ALIYUN_SMS_* 或回退到 driver=log");
        }
        this.accessKeyId = accessKeyId;
        this.accessKeySecret = accessKeySecret;
        this.signName = signName;
        this.templateCode = templateCode;
        this.mapper = mapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public void sendVerificationCode(String phone, String code) {
        try {
            Map<String, String> params = new TreeMap<>();
            // RPC 公共参数
            params.put("AccessKeyId", accessKeyId);
            params.put("Action", "SendSms");
            params.put("Format", FORMAT);
            params.put("SignatureMethod", SIGN_METHOD);
            params.put("SignatureNonce", UUID.randomUUID().toString());
            params.put("SignatureVersion", SIGN_VERSION);
            params.put("Timestamp", isoTimestamp());
            params.put("Version", API_VERSION);
            // 业务参数
            params.put("PhoneNumbers", phone);
            params.put("SignName", signName);
            params.put("TemplateCode", templateCode);
            params.put("TemplateParam", mapper.writeValueAsString(Map.of("code", code)));

            String signature = sign("POST", params, accessKeySecret);
            params.put("Signature", signature);

            String body = formEncode(params);
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(ENDPOINT))
                    .header("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            String respBody = resp.body();
            if (resp.statusCode() != 200) {
                throw new SmsSendException("阿里云 SMS HTTP " + resp.statusCode() + ": " + respBody);
            }
            // 阿里云成功响应：{"Message":"OK","RequestId":"...","BizId":"...","Code":"OK"}
            Map<?, ?> json = mapper.readValue(respBody, Map.class);
            String aliCode = String.valueOf(json.get("Code"));
            if (!"OK".equals(aliCode)) {
                throw new SmsSendException("阿里云 SMS 失败 Code=" + aliCode + " Message=" + json.get("Message"));
            }
            log.info("[sms-aliyun] sent phone={} bizId={}", phone, json.get("BizId"));
        } catch (SmsSendException e) {
            throw e;
        } catch (Exception e) {
            throw new SmsSendException("阿里云 SMS 调用异常: " + e.getMessage(), e);
        }
    }

    // ── Aliyun POP RPC 签名（HMAC-SHA1 + Base64） ─────────────────────────

    private static String sign(String httpMethod, Map<String, String> params, String secret) throws Exception {
        StringBuilder canon = new StringBuilder();
        for (Map.Entry<String, String> e : params.entrySet()) {
            if (canon.length() > 0) canon.append('&');
            canon.append(percentEncode(e.getKey())).append('=').append(percentEncode(e.getValue()));
        }
        String stringToSign = httpMethod + "&" + percentEncode("/") + "&" + percentEncode(canon.toString());
        Mac mac = Mac.getInstance("HmacSHA1");
        mac.init(new SecretKeySpec((secret + "&").getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
        byte[] sig = mac.doFinal(stringToSign.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(sig);
    }

    /** 阿里云风格的 percent-encode：标准 URL encode + 把 +/* /%7E 三处修正。 */
    private static String percentEncode(String s) {
        String enc = URLEncoder.encode(s, StandardCharsets.UTF_8);
        return enc.replace("+", "%20").replace("*", "%2A").replace("%7E", "~");
    }

    private static String formEncode(Map<String, String> params) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> e : params.entrySet()) {
            if (sb.length() > 0) sb.append('&');
            sb.append(percentEncode(e.getKey())).append('=').append(percentEncode(e.getValue()));
        }
        return sb.toString();
    }

    private static String isoTimestamp() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        return fmt.format(new Date());
    }
}
