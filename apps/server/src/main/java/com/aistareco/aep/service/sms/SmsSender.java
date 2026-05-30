package com.aistareco.aep.service.sms;

/**
 * v0.31+ SMS 发送抽象。
 *
 * 当前两个实现：
 *   - {@link LogSmsSender}    驱动 = "log"（默认） — 把验证码打到 server log，dev / 联调 / 占位
 *   - {@link DisabledSmsSender} 驱动 = "disabled"  — 显式关闭发送，未配真实 SMS 时避免假成功
 *   - {@link AliyunSmsSender} 驱动 = "aliyun"      — 调阿里云 SMS 官方 SDK
 *
 * 切换：application.yml 的 aep.sms.driver。
 */
public interface SmsSender {
    /**
     * 发送一条验证码短信。失败时抛 {@link SmsSendException}。
     *
     * @param phone E.164 不带 +；国内号即 11 位数字。校验由调用方先做。
     * @param code  纯数字字符串，长度由 SmsCodeService 决定。
     * @param purpose 验证码用途；真实短信供应商据此选择模板。
     */
    void sendVerificationCode(String phone, String code, SmsCodePurpose purpose) throws SmsSendException;

    /** SMS 发送失败的统一异常。message 会被 controller 透传到用户。 */
    class SmsSendException extends RuntimeException {
        public SmsSendException(String message) { super(message); }
        public SmsSendException(String message, Throwable cause) { super(message, cause); }
    }
}
