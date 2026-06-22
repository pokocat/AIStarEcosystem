package com.aistareco.aep.controller;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.aep.service.AuditService;
import com.aistareco.aep.service.LicenseActivationService;
import com.aistareco.aep.service.sms.SmsCodePurpose;
import com.aistareco.aep.service.sms.SmsCodeService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.env.MockEnvironment;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * SmsAuthController 登录 / 注册流程场景测试（v0.84）。
 *
 * <p>SMS 发码与验码（{@link SmsCodeService}）全程 mock —— 不发真实短信、不做真实验码；
 * 只有「注册凭证」用真实 {@link JwtUtil}（纯本地 HMAC 签名，无外部依赖），
 * 这样才能端到端验证「带有效凭证跳过验码、凭证无效回退验码」的核心行为。
 *
 * <p>覆盖矩阵：
 * <ul>
 *   <li>登录-未注册 → 404 USER_NOT_FOUND，details 带可验证的 registerTicket + phone</li>
 *   <li>登录-已注册 → 200 token + user，且不签发凭证</li>
 *   <li>注册-带有效凭证 → 跳过 SMS 验码（verifyCode 从不调用）</li>
 *   <li>注册-无凭证带验证码 → 走 REGISTER 用途验码</li>
 *   <li>注册-凭证无效但带验证码 → 回退验码路径</li>
 *   <li>注册-凭证手机号不符且没退回验证码 → 401 REGISTER_TICKET_EXPIRED，从不调验码</li>
 *   <li>注册-缺激活码 → 400 LICENSE_KEY_REQUIRED</li>
 *   <li>注册-带有效凭证但手机号已注册 → 409 PHONE_ALREADY_REGISTERED</li>
 * </ul>
 */
class SmsAuthControllerTest {

    private static final String PHONE = "13800138000";
    private static final String OTHER_PHONE = "13900139000";
    private static final String LICENSE = "LIC-AAAA-BBBB-CCCC";
    private static final String STUDIO = "星光工作室";

    private SmsCodeService smsCodeService;
    private AepUserRepository userRepo;
    private StudioRepository studioRepo;
    private LicenseActivationService licenseService;
    private AuditService auditService;
    private JwtUtil jwtUtil;
    private SmsAuthController controller;

    private SmsAuthController newController() {
        smsCodeService = mock(SmsCodeService.class);
        userRepo = mock(AepUserRepository.class);
        studioRepo = mock(StudioRepository.class);
        licenseService = mock(LicenseActivationService.class);
        auditService = mock(AuditService.class);
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("dev");
        jwtUtil = new JwtUtil("unit-test-secret-key-please-change-32chars+", 3_600_000L, env);
        return new SmsAuthController(smsCodeService, userRepo, studioRepo, licenseService, jwtUtil, auditService);
    }

    private AepUser activeStudioUser() {
        return AepUser.builder()
                .id("u-1")
                .username("phone_" + PHONE)
                .displayName("星光")
                .phone(PHONE)
                .kind(AepUser.AccountKind.STUDIO)
                .status(AepUser.UserStatus.ACTIVE)
                .phoneVerified(true)
                .build();
    }

    private SmsAuthController.SmsRegisterRequest registerBody(String code, String registerTicket) {
        return new SmsAuthController.SmsRegisterRequest(
                PHONE, code, LICENSE, STUDIO, null, "celebrity", registerTicket);
    }

    // ── 登录（verify） ─────────────────────────────────────────────

    @Test
    void verify_unregisteredPhone_throws404WithVerifiableRegisterTicket() {
        controller = newController();
        doNothing().when(smsCodeService).verifyCode(eq(PHONE), eq("123456"), eq(SmsCodePurpose.LOGIN));
        when(userRepo.findByPhone(PHONE)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                controller.verify(new SmsAuthController.SmsVerifyRequest(PHONE, "123456"), null))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(ex.getCode()).isEqualTo("USER_NOT_FOUND");
                    @SuppressWarnings("unchecked")
                    Map<String, Object> details = (Map<String, Object>) ex.getDetails();
                    assertThat(details).containsEntry("phone", PHONE);
                    String ticket = (String) details.get("registerTicket");
                    // 凭证必须真实可验，且解出来就是这个手机号
                    assertThat(jwtUtil.verifyRegisterTicket(ticket)).isEqualTo(PHONE);
                });
    }

    @Test
    void verify_registeredActiveUser_returnsTokenAndUser() {
        controller = newController();
        doNothing().when(smsCodeService).verifyCode(eq(PHONE), eq("123456"), eq(SmsCodePurpose.LOGIN));
        when(userRepo.findByPhone(PHONE)).thenReturn(Optional.of(activeStudioUser()));
        when(studioRepo.findByOwnerUserId("u-1")).thenReturn(Optional.empty());

        ApiResponse<Map<String, Object>> res =
                controller.verify(new SmsAuthController.SmsVerifyRequest(PHONE, "123456"), null);

        assertThat(res.data()).containsKey("user");
        assertThat((String) res.data().get("token")).isNotBlank();
    }

    /**
     * 端到端 happy path：未注册手机号 → 短信验证码登录拿到 404 + 注册凭证 →
     * 把「verify 实际签发的那张凭证」喂给 register → 注册并登录成功，全程不重输验证码。
     * 这是用户真实走的链路，证明 verify 产出的凭证确实能被 register 接受（同密钥/同手机号/类型匹配）。
     */
    @Test
    void e2e_unregisteredSmsLogin_thenActivateRegister_success() {
        controller = newController();
        doNothing().when(smsCodeService).verifyCode(eq(PHONE), eq("123456"), eq(SmsCodePurpose.LOGIN));
        // 注册前查无此人（verify 触发 404）；激活后再查到新建用户（register 回填）。
        when(userRepo.findByPhone(PHONE)).thenReturn(Optional.empty(), Optional.of(activeStudioUser()));
        when(userRepo.existsByPhone(PHONE)).thenReturn(false);
        when(licenseService.activate(any())).thenReturn(new HashMap<>(Map.of("token", "final-tok")));
        when(studioRepo.findByOwnerUserId("u-1")).thenReturn(Optional.empty());

        // ① 短信验证码登录 → 未注册 → 拿到凭证
        String registerTicket = null;
        try {
            controller.verify(new SmsAuthController.SmsVerifyRequest(PHONE, "123456"), null);
        } catch (BusinessException ex) {
            assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(ex.getCode()).isEqualTo("USER_NOT_FOUND");
            @SuppressWarnings("unchecked")
            Map<String, Object> details = (Map<String, Object>) ex.getDetails();
            registerTicket = (String) details.get("registerTicket");
        }
        assertThat(registerTicket).as("verify 必须签发注册凭证").isNotBlank();

        // ② 用户填激活码 + 工作室名，带上刚拿到的凭证去注册（不再输验证码）
        ApiResponse<Map<String, Object>> res =
                controller.register(registerBody(null, registerTicket), null);

        // ③ 注册并登录成功，且整条链路从未调用短信验码
        verify(smsCodeService, never()).verifyCode(any(), any(), eq(SmsCodePurpose.REGISTER));
        verify(licenseService, times(1)).activate(any());
        assertThat(res.data()).containsEntry("token", "final-tok");
        assertThat(res.data()).containsKey("user");
    }

    // ── 注册（register） ───────────────────────────────────────────

    @Test
    void register_withValidTicket_skipsSmsCodeVerification() {
        controller = newController();
        String ticket = jwtUtil.generateRegisterTicket(PHONE);
        when(userRepo.existsByPhone(PHONE)).thenReturn(false);
        when(licenseService.activate(any())).thenReturn(new HashMap<>(Map.of("token", "activate-tok")));
        when(userRepo.findByPhone(PHONE)).thenReturn(Optional.of(activeStudioUser()));
        when(studioRepo.findByOwnerUserId("u-1")).thenReturn(Optional.empty());

        ApiResponse<Map<String, Object>> res = controller.register(registerBody(null, ticket), null);

        // 关键：带有效凭证 → 短信验码从不被调用
        verify(smsCodeService, never()).verifyCode(any(), any(), any());
        verify(licenseService, times(1)).activate(any());
        assertThat(res.data()).containsEntry("token", "activate-tok");
        assertThat(res.data()).containsKey("user");
    }

    @Test
    void register_withoutTicket_verifiesRegisterPurposeCode() {
        controller = newController();
        doNothing().when(smsCodeService).verifyCode(eq(PHONE), eq("654321"), eq(SmsCodePurpose.REGISTER));
        when(userRepo.existsByPhone(PHONE)).thenReturn(false);
        when(licenseService.activate(any())).thenReturn(new HashMap<>(Map.of("token", "activate-tok")));
        when(userRepo.findByPhone(PHONE)).thenReturn(Optional.of(activeStudioUser()));
        when(studioRepo.findByOwnerUserId("u-1")).thenReturn(Optional.empty());

        ApiResponse<Map<String, Object>> res = controller.register(registerBody("654321", null), null);

        verify(smsCodeService, times(1)).verifyCode(PHONE, "654321", SmsCodePurpose.REGISTER);
        assertThat(res.data()).containsEntry("token", "activate-tok");
    }

    @Test
    void register_invalidTicketButCodeProvided_fallsBackToCodePath() {
        controller = newController();
        doNothing().when(smsCodeService).verifyCode(eq(PHONE), eq("654321"), eq(SmsCodePurpose.REGISTER));
        when(userRepo.existsByPhone(PHONE)).thenReturn(false);
        when(licenseService.activate(any())).thenReturn(new HashMap<>(Map.of("token", "activate-tok")));
        when(userRepo.findByPhone(PHONE)).thenReturn(Optional.of(activeStudioUser()));
        when(studioRepo.findByOwnerUserId("u-1")).thenReturn(Optional.empty());

        // 凭证是垃圾串，但用户退回手输了验证码 → 走验码路径成功
        ApiResponse<Map<String, Object>> res =
                controller.register(registerBody("654321", "garbage-not-a-jwt"), null);

        verify(smsCodeService, times(1)).verifyCode(PHONE, "654321", SmsCodePurpose.REGISTER);
        assertThat(res.data()).containsEntry("token", "activate-tok");
    }

    @Test
    void register_ticketForOtherPhoneAndNoCode_throwsTicketExpired() {
        controller = newController();
        // 凭证签给别的手机号 → 与本次注册手机号不符，且没退回验证码
        String ticketForOther = jwtUtil.generateRegisterTicket(OTHER_PHONE);

        assertThatThrownBy(() -> controller.register(registerBody(null, ticketForOther), null))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(ex.getCode()).isEqualTo("REGISTER_TICKET_EXPIRED");
                });

        verify(smsCodeService, never()).verifyCode(any(), any(), any());
        verify(licenseService, never()).activate(any());
    }

    @Test
    void register_missingLicenseKey_throwsBadRequest() {
        controller = newController();
        SmsAuthController.SmsRegisterRequest body = new SmsAuthController.SmsRegisterRequest(
                PHONE, "654321", "  ", STUDIO, null, "celebrity", null);

        assertThatThrownBy(() -> controller.register(body, null))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(ex.getCode()).isEqualTo("LICENSE_KEY_REQUIRED");
                });
        verify(smsCodeService, never()).verifyCode(any(), any(), any());
    }

    @Test
    void register_validTicketButPhoneAlreadyRegistered_throwsConflict() {
        controller = newController();
        String ticket = jwtUtil.generateRegisterTicket(PHONE);
        when(userRepo.existsByPhone(PHONE)).thenReturn(true);

        assertThatThrownBy(() -> controller.register(registerBody(null, ticket), null))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(ex.getCode()).isEqualTo("PHONE_ALREADY_REGISTERED");
                });
        verify(licenseService, never()).activate(any());
    }

    @Test
    void register_invalidCode_propagatesVerifyFailureAndDoesNotActivate() {
        controller = newController();
        doThrow(new BusinessException(HttpStatus.BAD_REQUEST, "SMS_CODE_INVALID", "验证码错误"))
                .when(smsCodeService).verifyCode(eq(PHONE), eq("000000"), eq(SmsCodePurpose.REGISTER));

        assertThatThrownBy(() -> controller.register(registerBody("000000", null), null))
                .isInstanceOfSatisfying(BusinessException.class, ex ->
                        assertThat(ex.getCode()).isEqualTo("SMS_CODE_INVALID"));
        verify(licenseService, never()).activate(any());
    }
}
