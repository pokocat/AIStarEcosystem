package com.aistareco.aep.controller;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.dto.MeDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.aep.service.AuditService;
import com.aistareco.aep.service.LicenseActivationService;
import com.aistareco.aep.service.sms.SmsCodeService;
import com.aistareco.aep.service.sms.SmsCodePurpose;
import com.aistareco.aep.service.sms.SmsSendResult;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * v0.31+ 手机号 + SMS 验证码 登录 / 注册端点。所有路径在 AepSecurityConfig 下走
 * /api/auth/** permitAll。
 *
 * 端点：
 *   POST /api/auth/sms/request-code  { phone, purpose?: "login" | "register" }
 *       发送验证码（log driver 落 server log；aliyun driver 按 purpose 选模板真发）。
 *       含速率限制（60s/次）+ 锁定（连错 5 次锁 30 分钟）。
 *
 *   POST /api/auth/sms/verify        { phone, code }
 *       校验 SMS code → 查 user by phone → 若存在签 JWT 返回；
 *       若不存在返回 404 USER_NOT_FOUND，error.details 带 { registerTicket, phone }，
 *       前端引导走 /sms/register 并凭 registerTicket 免重输验证码。
 *       验证码即使在 USER_NOT_FOUND 情况下也已被消费（防爆破）—— 所以用凭证而非透传旧码。
 *
 *   POST /api/auth/sms/register      { phone, licenseKey, studioName, displayName?, code? | registerTicket? }
 *       证明手机号所有权二选一：带有效 registerTicket（验证码登录刚验过）跳过短信码，
 *       否则校验 register 用途 SMS code → 再校验 license key → 创建
 *       AepUser(kind=STUDIO, phoneVerified=true) + Studio + Membership + Wallet → 签 JWT 返回。
 *       要求双因素：手机号验证（凭证或验证码）+ license 激活码同时通过。
 *       凭证无效/过期且未退回手输验证码 → 401 REGISTER_TICKET_EXPIRED。
 */
@RestController
@RequestMapping("/api/auth/sms")
public class SmsAuthController {

    private static final Logger log = LoggerFactory.getLogger(SmsAuthController.class);

    private final SmsCodeService smsCodeService;
    private final AepUserRepository userRepo;
    private final StudioRepository studioRepo;
    private final LicenseActivationService licenseService;
    private final JwtUtil jwtUtil;
    private final AuditService auditService;

    public SmsAuthController(SmsCodeService smsCodeService,
                              AepUserRepository userRepo,
                              StudioRepository studioRepo,
                              LicenseActivationService licenseService,
                              JwtUtil jwtUtil,
                              AuditService auditService) {
        this.smsCodeService = smsCodeService;
        this.userRepo = userRepo;
        this.studioRepo = studioRepo;
        this.licenseService = licenseService;
        this.jwtUtil = jwtUtil;
        this.auditService = auditService;
    }

    /** 请求一个新验证码。失败抛 4xx/5xx；成功返回短信供应商的结构化状态。 */
    @PostMapping("/request-code")
    public ApiResponse<SmsSendResult> requestCode(@RequestBody(required = false) SmsRequestCodeRequest body,
                                                   HttpServletRequest request) {
        String phone = body == null ? null : body.phone();
        String trimmedPhone = phone == null ? null : phone.trim();
        SmsCodePurpose purpose;
        try {
            purpose = parsePurpose(body == null ? null : body.purpose());
        } catch (BusinessException ex) {
            auditService.recordAuthFailure(AuditService.Actions.SMS_REQUEST_CODE, trimmedPhone,
                    ex.getCode(), "请求验证码：用途参数无效", request);
            throw ex;
        }
        SmsSendResult result;
        try {
            result = smsCodeService.requestCode(trimmedPhone, purpose);
        } catch (RuntimeException ex) {
            auditService.recordAuthFailure(AuditService.Actions.SMS_REQUEST_CODE, trimmedPhone,
                    errorCodeOf(ex, "SMS_REQUEST_FAILED"),
                    "请求验证码失败 purpose=" + purpose.wire() + " · " + ex.getMessage(), request);
            throw ex;
        }
        log.info("[auth-sms] request-code ok purpose={} phone={} provider={} deliveryStatus={} bizId={}",
                purpose.wire(), trimmedPhone,
                result == null ? null : result.provider(),
                result == null ? null : result.deliveryStatus(),
                result == null ? null : result.bizId());
        auditService.recordAuthSuccess(AuditService.Actions.SMS_REQUEST_CODE, null, trimmedPhone,
                "发送 SMS 验证码 purpose=" + purpose.wire(), request);
        return ApiResponse.of(result);
    }

    /**
     * 验证码登录：校验 code → 找已注册的 user by phone → 发 JWT。
     * 找不到 user 返回 404 USER_NOT_FOUND（验证码已被消费，前端引导用户去 /sms/register）。
     */
    @PostMapping("/verify")
    public ApiResponse<Map<String, Object>> verify(@RequestBody(required = false) SmsVerifyRequest body,
                                                    HttpServletRequest request) {
        String phone = body == null ? null : body.phone();
        String code = body == null ? null : body.code();
        String trimmedPhone = phone == null ? null : phone.trim();
        try {
            smsCodeService.verifyCode(trimmedPhone, code, SmsCodePurpose.LOGIN);
        } catch (RuntimeException ex) {
            auditService.recordAuthFailure(AuditService.Actions.SMS_LOGIN, trimmedPhone,
                    errorCodeOf(ex, "SMS_CODE_INVALID"),
                    "短信登录：验证码校验失败 · " + ex.getMessage(), request);
            throw ex;
        }

        AepUser user = userRepo.findByPhone(trimmedPhone).orElse(null);
        if (user == null) {
            log.info("[auth-sms] login user-not-found phone={}", trimmedPhone);
            auditService.recordAuthFailure(AuditService.Actions.SMS_LOGIN, trimmedPhone,
                    "USER_NOT_FOUND", "短信登录：手机号未注册（引导走注册）", request);
            // 手机号刚通过短信验证 → 签发短时效注册凭证带回前端，注册时凭它免重输验证码。
            String registerTicket = jwtUtil.generateRegisterTicket(trimmedPhone);
            throw new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND",
                    "该手机号尚未注册，请先用「激活码 + 手机号」完成注册",
                    Map.of("registerTicket", registerTicket, "phone", trimmedPhone));
        }
        // v0.59：与密码登录对齐 —— 停用 / 注销账号拒绝登录（此前短信登录漏了这道闸）
        if (user.getStatus() != AepUser.UserStatus.ACTIVE) {
            log.warn("[auth-sms] inactive userId={} status={}", user.getId(), user.getStatus());
            auditService.recordAuth(AuditService.Actions.SMS_LOGIN, AuditLog.AuditResult.FAILURE,
                    user.getId(), user.getUsername(),
                    "ACCOUNT_DISABLED", "短信登录：账号被停用 status=" + user.getStatus(), request);
            throw new BusinessException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED", "该账户已被停用");
        }

        user.setLastLoginAt(Instant.now());
        if (!user.isPhoneVerified()) {
            user.setPhoneVerified(true);   // 顺手回填一次（兼容老激活路径写入但未回填的场景）
        }
        userRepo.save(user);

        // §12.1：消费者令牌只带账号类型（personal / studio），不再带 operatorRole。
        // 运营身份要进后台，走 /api/admin/auth/operator-login 换一张 typ=admin 令牌。
        String token = jwtUtil.consumerToken(user);
        String role = user.getKind() == null ? "PERSONAL" : user.getKind().name();
        Studio studio = studioRepo.findByOwnerUserId(user.getId()).orElse(null);
        log.info("[auth-sms] login success phone={} userId={} role={} studioId={}",
                trimmedPhone, user.getId(), role, studio == null ? null : studio.getId());
        auditService.recordAuthSuccess(AuditService.Actions.SMS_LOGIN, user.getId(),
                user.getUsername(),
                "短信登录成功 phone=" + trimmedPhone + " role=" + role, request);
        return ApiResponse.of(Map.of(
                "token", token,
                "user", MeDto.from(user, studio)
        ));
    }

    /**
     * 手机号 + 激活码 双因素注册。
     * 校验 SMS code + 校验 license key（复用 LicenseActivationService.activate）→
     * 创建 AepUser/Studio/Wallet → 发 JWT。
     *
     * username 自动生成（phone_<手机号>）；displayName 选填；studioName 必填。
     */
    @PostMapping("/register")
    public ApiResponse<Map<String, Object>> register(@RequestBody(required = false) SmsRegisterRequest body,
                                                      HttpServletRequest request) {
        if (body == null) {
            auditService.recordAuthFailure(AuditService.Actions.SMS_REGISTER, null,
                    "REGISTER_BODY_REQUIRED", "短信注册：请求体缺失", request);
            throw new BusinessException(HttpStatus.BAD_REQUEST, "REGISTER_BODY_REQUIRED", "缺少注册参数");
        }
        String phone = body.phone();
        String code = body.code();
        String licenseKey = body.licenseKey();
        String studioName = body.studioName();
        String displayName = body.displayName();
        String platform = body.platform(); // v0.43+: 注册来源子产品（music/drama/celebrity）
        String registerTicket = body.registerTicket(); // v0.84+: 验证码登录未注册时签发的注册凭证

        String trimmedPhone = phone == null ? null : phone.trim();
        if (licenseKey == null || licenseKey.isBlank()) {
            auditService.recordAuthFailure(AuditService.Actions.SMS_REGISTER, trimmedPhone,
                    "LICENSE_KEY_REQUIRED", "短信注册：激活码字段缺失 platform=" + platform, request);
            throw new BusinessException(HttpStatus.BAD_REQUEST, "LICENSE_KEY_REQUIRED", "请填写激活码");
        }
        if (studioName == null || studioName.isBlank()) {
            auditService.recordAuthFailure(AuditService.Actions.SMS_REGISTER, trimmedPhone,
                    "STUDIO_NAME_REQUIRED", "短信注册：工作室名称字段缺失 platform=" + platform, request);
            throw new BusinessException(HttpStatus.BAD_REQUEST, "STUDIO_NAME_REQUIRED", "请填写工作室名称");
        }
        // 双通道证明手机号所有权：
        //   ① 注册凭证（registerTicket）：用户刚在验证码登录处通过验证、被引导来注册 →
        //      凭证有效且绑定的手机号一致 → 跳过短信码校验（免重输验证码，体验更顺）。
        //   ② 否则走原「注册用途验证码」路径（直接打开注册页的用户照常发码 + 输码）。
        boolean ticketVerified = false;
        if (registerTicket != null && !registerTicket.isBlank()) {
            String ticketPhone = jwtUtil.verifyRegisterTicket(registerTicket);
            if (ticketPhone != null && ticketPhone.equals(trimmedPhone)) {
                ticketVerified = true;
            } else if ((code == null || code.isBlank())) {
                // 凭证带了但无效（过期 / 手机号被改），且没退回手输验证码 → 明确告知前端重新获取。
                log.info("[auth-sms] register ticket invalid/expired phone={} platform={}", trimmedPhone, platform);
                auditService.recordAuthFailure(AuditService.Actions.SMS_REGISTER, trimmedPhone,
                        "REGISTER_TICKET_EXPIRED", "短信注册：注册凭证无效或已过期 platform=" + platform, request);
                throw new BusinessException(HttpStatus.UNAUTHORIZED, "REGISTER_TICKET_EXPIRED",
                        "手机验证已过期，请重新获取验证码");
            }
        }
        if (!ticketVerified) {
            try {
                smsCodeService.verifyCode(trimmedPhone, code, SmsCodePurpose.REGISTER);
            } catch (RuntimeException ex) {
                auditService.recordAuthFailure(AuditService.Actions.SMS_REGISTER, trimmedPhone,
                        errorCodeOf(ex, "SMS_CODE_INVALID"),
                        "短信注册：验证码校验失败 platform=" + platform + " · " + ex.getMessage(), request);
                throw ex;
            }
        }

        if (userRepo.existsByPhone(trimmedPhone)) {
            log.info("[auth-sms] register blocked already-registered phone={}", trimmedPhone);
            auditService.recordAuthFailure(AuditService.Actions.SMS_REGISTER, trimmedPhone,
                    "PHONE_ALREADY_REGISTERED", "短信注册：手机号已注册 platform=" + platform, request);
            throw new BusinessException(HttpStatus.CONFLICT, "PHONE_ALREADY_REGISTERED",
                    "该手机号已注册，请直接使用验证码登录");
        }

        // 复用 LicenseActivationService.activate：构造 body Map 透传。
        // username 不传 → 服务端 fallback "user_<timestamp>"；这里显式给 phone_<phone> 更易识别。
        Map<String, String> activateBody = new HashMap<>();
        activateBody.put("code", licenseKey);
        activateBody.put("phone", trimmedPhone);
        activateBody.put("username", "phone_" + trimmedPhone);
        activateBody.put("displayName", (displayName == null || displayName.isBlank()) ? studioName : displayName);
        activateBody.put("studioName", studioName);
        if (platform != null && !platform.isBlank()) {
            activateBody.put("platform", platform.trim());
        }

        Map<String, Object> activated;
        try {
            activated = licenseService.activate(activateBody);
        } catch (RuntimeException ex) {
            auditService.recordAuthFailure(AuditService.Actions.SMS_REGISTER, trimmedPhone,
                    errorCodeOf(ex, "LICENSE_ACTIVATE_FAILED"),
                    "短信注册：激活码校验/落库失败 platform=" + platform + " · " + ex.getMessage(), request);
            throw ex;
        }

        // activate 之后立刻回查 + 标 phoneVerified=true（activate 默认置 false）
        AepUser user = userRepo.findByPhone(trimmedPhone).orElse(null);
        if (user != null && !user.isPhoneVerified()) {
            user.setPhoneVerified(true);
            user.setUpdatedAt(Instant.now());
            userRepo.save(user);
        }
        // 响应里的 user 是 activate 序列化时的快照（phoneVerified=false）。重新序列化覆盖。
        if (user != null) {
            java.util.Map<String, Object> patched = new java.util.HashMap<>(activated);
            patched.put("user", AepUserDto.from(user));
            Studio studio = studioRepo.findByOwnerUserId(user.getId()).orElse(null);
            log.info("[auth-sms] register success phone={} userId={} platform={} studioId={}",
                    trimmedPhone, user.getId(), platform, studio == null ? null : studio.getId());
            auditService.recordAuthSuccess(AuditService.Actions.SMS_REGISTER, user.getId(),
                    user.getUsername(),
                    "短信 + 激活码注册成功 phone=" + trimmedPhone + " platform=" + platform
                            + " studio=" + studioName, request);
            return ApiResponse.of(patched);
        }
        log.warn("[auth-sms] register completed but user lookup missed phone={} platform={}", trimmedPhone, platform);
        auditService.recordAuth(AuditService.Actions.SMS_REGISTER, AuditLog.AuditResult.SUCCESS,
                null, trimmedPhone, null,
                "短信注册：激活成功但 user lookup miss platform=" + platform, request);
        return ApiResponse.of(activated);
    }

    private static String errorCodeOf(Throwable ex, String fallback) {
        if (ex instanceof BusinessException bex) return bex.getCode();
        if (ex instanceof ResponseStatusException rsx) {
            return rsx.getStatusCode().value() + "";
        }
        return fallback;
    }

    private static SmsCodePurpose parsePurpose(String purpose) {
        try {
            return SmsCodePurpose.fromWireOrDefault(purpose);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "SMS_PURPOSE_INVALID",
                    "验证码用途仅支持 login / register");
        }
    }

    public record SmsRequestCodeRequest(String phone, String purpose) {}

    public record SmsVerifyRequest(String phone, String code) {}

    public record SmsRegisterRequest(
            String phone,
            String code,
            String licenseKey,
            String studioName,
            String displayName,
            String platform,
            /** v0.84+: 验证码登录未注册时由 /sms/verify 签发的注册凭证；带它可免重输验证码。 */
            String registerTicket
    ) {}
}
