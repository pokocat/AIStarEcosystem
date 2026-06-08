package com.aistareco.aep.service;

import com.aistareco.aep.service.sms.SmsCodeService;
import com.aistareco.aep.service.sms.SmsCodePurpose;
import com.aistareco.aep.service.sms.SmsSendResult;
import com.aistareco.aep.service.sms.SmsSender;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SmsCodeServiceTest {

    @Test
    void requestCode_sendsThroughConfiguredSender() {
        CapturingSender sender = new CapturingSender();
        SmsCodeService service = service(sender, 60, 5);

        service.requestCode("13800138000");

        assertEquals("13800138000", sender.lastPhone);
        assertEquals("123456", sender.lastCode);
        assertEquals(SmsCodePurpose.LOGIN, sender.lastPurpose);
    }

    @Test
    void requestCode_sendsRegisterPurposeThroughConfiguredSender() {
        CapturingSender sender = new CapturingSender();
        SmsCodeService service = service(sender, 60, 5);

        service.requestCode("13800138000", SmsCodePurpose.REGISTER);

        assertEquals("13800138000", sender.lastPhone);
        assertEquals("123456", sender.lastCode);
        assertEquals(SmsCodePurpose.REGISTER, sender.lastPurpose);
    }

    @Test
    void verifyCode_requiresMatchingPurpose() {
        SmsCodeService service = service(new CapturingSender(), 60, 5);

        service.requestCode("13800138000", SmsCodePurpose.REGISTER);

        BusinessException mismatch = assertThrows(
                BusinessException.class,
                () -> service.verifyCode("13800138000", "123456", SmsCodePurpose.LOGIN)
        );
        assertEquals(HttpStatus.BAD_REQUEST, mismatch.getStatus());
        assertEquals("SMS_CODE_NOT_REQUESTED", mismatch.getCode());

        service.verifyCode("13800138000", "123456", SmsCodePurpose.REGISTER);
    }

    @Test
    void verifyCode_successConsumesCode() {
        SmsCodeService service = service(new CapturingSender(), 60, 5);

        service.requestCode("13800138000");
        service.verifyCode("13800138000", "123456");

        BusinessException replay = assertThrows(
                BusinessException.class,
                () -> service.verifyCode("13800138000", "123456")
        );
        assertEquals(HttpStatus.BAD_REQUEST, replay.getStatus());
        assertEquals("SMS_CODE_NOT_REQUESTED", replay.getCode());
    }

    @Test
    void verifyCode_wrongCodeLocksAfterMaxFailures() {
        SmsCodeService service = service(new CapturingSender(), 60, 2);

        service.requestCode("13800138000");

        BusinessException first = assertThrows(
                BusinessException.class,
                () -> service.verifyCode("13800138000", "000000")
        );
        assertEquals(HttpStatus.BAD_REQUEST, first.getStatus());
        assertEquals("SMS_CODE_INVALID", first.getCode());

        BusinessException locked = assertThrows(
                BusinessException.class,
                () -> service.verifyCode("13800138000", "111111")
        );
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, locked.getStatus());
        assertEquals("SMS_CODE_LOCKED", locked.getCode());

        BusinessException resendWhileLocked = assertThrows(
                BusinessException.class,
                () -> service.requestCode("13800138000")
        );
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, resendWhileLocked.getStatus());
        assertEquals("SMS_CODE_LOCKED", resendWhileLocked.getCode());
    }

    @Test
    void requestCode_rateLimitsSamePhone() {
        SmsCodeService service = service(new CapturingSender(), 60, 5);

        service.requestCode("13800138000");

        BusinessException limited = assertThrows(
                BusinessException.class,
                () -> service.requestCode("13800138000")
        );
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, limited.getStatus());
        assertEquals("SMS_CODE_RATE_LIMITED", limited.getCode());
    }

    @Test
    void requestCode_sendFailureDoesNotStoreCode() {
        SmsCodeService service = service(new FailingSender(), 60, 5);

        BusinessException sendFailed = assertThrows(
                BusinessException.class,
                () -> service.requestCode("13800138000")
        );
        assertEquals(HttpStatus.BAD_GATEWAY, sendFailed.getStatus());
        assertEquals("SMS_SEND_FAILED", sendFailed.getCode());

        BusinessException noCodeStored = assertThrows(
                BusinessException.class,
                () -> service.verifyCode("13800138000", "123456")
        );
        assertEquals(HttpStatus.BAD_REQUEST, noCodeStored.getStatus());
        assertEquals("SMS_CODE_NOT_REQUESTED", noCodeStored.getCode());
    }

    @Test
    void requestCode_rejectsInvalidPhone() {
        SmsCodeService service = service(new CapturingSender(), 60, 5);

        BusinessException invalid = assertThrows(
                BusinessException.class,
                () -> service.requestCode("12345")
        );
        assertEquals(HttpStatus.BAD_REQUEST, invalid.getStatus());
        assertEquals("PHONE_INVALID", invalid.getCode());
    }

    private static SmsCodeService service(SmsSender sender, long rateLimitSeconds, int maxFailures) {
        return new SmsCodeService(
                sender,
                6,
                300,
                rateLimitSeconds,
                maxFailures,
                1800,
                "log",
                "123456"
        );
    }

    private static class CapturingSender implements SmsSender {
        String lastPhone;
        String lastCode;
        SmsCodePurpose lastPurpose;

        @Override
        public SmsSendResult sendVerificationCode(String phone, String code, SmsCodePurpose purpose) {
            this.lastPhone = phone;
            this.lastCode = code;
            this.lastPurpose = purpose;
            return SmsSendResult.log(purpose);
        }
    }

    private static class FailingSender implements SmsSender {
        @Override
        public SmsSendResult sendVerificationCode(String phone, String code, SmsCodePurpose purpose) throws SmsSendException {
            throw new SmsSendException("upstream unavailable");
        }
    }
}
