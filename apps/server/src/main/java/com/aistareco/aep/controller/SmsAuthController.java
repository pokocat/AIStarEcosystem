package com.aistareco.aep.controller;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.dto.MeDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.aep.service.LicenseActivationService;
import com.aistareco.aep.service.sms.SmsCodeService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * v0.31+ 手机号 + SMS 验证码 登录 / 注册端点。所有路径在 AepSecurityConfig 下走
 * /api/auth/** permitAll。
 *
 * 端点：
 *   POST /api/auth/sms/request-code  { phone }
 *       发送验证码（log driver 落 server log；aliyun driver 真发）。
 *       含速率限制（60s/次）+ 锁定（连错 5 次锁 30 分钟）。
 *
 *   POST /api/auth/sms/verify        { phone, code }
 *       校验 SMS code → 查 user by phone → 若存在签 JWT 返回；
 *       若不存在返回 404 USER_NOT_FOUND，前端引导走 /sms/register。
 *       验证码即使在 USER_NOT_FOUND 情况下也已被消费（防爆破）。
 *
 *   POST /api/auth/sms/register      { phone, code, licenseKey, studioName, displayName? }
 *       校验 SMS code + 校验 license key → 创建 AepUser(kind=STUDIO, phoneVerified=true) +
 *       Studio + Membership + Wallet → 签 JWT 返回。
 *       要求双因素：sms 验证 + license 激活码同时通过。
 */
@RestController
@RequestMapping("/api/auth/sms")
public class SmsAuthController {

    private final SmsCodeService smsCodeService;
    private final AepUserRepository userRepo;
    private final StudioRepository studioRepo;
    private final LicenseActivationService licenseService;
    private final JwtUtil jwtUtil;

    public SmsAuthController(SmsCodeService smsCodeService,
                              AepUserRepository userRepo,
                              StudioRepository studioRepo,
                              LicenseActivationService licenseService,
                              JwtUtil jwtUtil) {
        this.smsCodeService = smsCodeService;
        this.userRepo = userRepo;
        this.studioRepo = studioRepo;
        this.licenseService = licenseService;
        this.jwtUtil = jwtUtil;
    }

    /** 请求一个新验证码。失败抛 4xx；成功返回 { sent: true }。 */
    @PostMapping("/request-code")
    public ApiResponse<Map<String, Object>> requestCode(@RequestBody Map<String, String> body) {
        String phone = body == null ? null : body.get("phone");
        smsCodeService.requestCode(phone == null ? null : phone.trim());
        return ApiResponse.of(Map.of("sent", true));
    }

    /**
     * 验证码登录：校验 code → 找已注册的 user by phone → 发 JWT。
     * 找不到 user 返回 404 USER_NOT_FOUND（验证码已被消费，前端引导用户去 /sms/register）。
     */
    @PostMapping("/verify")
    public ApiResponse<Map<String, Object>> verify(@RequestBody Map<String, String> body) {
        String phone = body == null ? null : body.get("phone");
        String code = body == null ? null : body.get("code");
        String trimmedPhone = phone == null ? null : phone.trim();
        smsCodeService.verifyCode(trimmedPhone, code);

        AepUser user = userRepo.findByPhone(trimmedPhone)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND",
                        "该手机号尚未注册，请先用「激活码 + 手机号」完成注册"));

        user.setLastLoginAt(Instant.now());
        if (!user.isPhoneVerified()) {
            user.setPhoneVerified(true);   // 顺手回填一次（兼容老激活路径写入但未回填的场景）
        }
        userRepo.save(user);

        String role = user.getOperatorRole() != null
                ? user.getOperatorRole().name()
                : (user.getKind() == AepUser.AccountKind.STUDIO ? "STUDIO" : "USER");
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), role);
        Studio studio = studioRepo.findByOwnerUserId(user.getId()).orElse(null);
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
    public ApiResponse<Map<String, Object>> register(@RequestBody Map<String, String> body) {
        if (body == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "REGISTER_BODY_REQUIRED", "缺少注册参数");
        }
        String phone = body.get("phone");
        String code = body.get("code");
        String licenseKey = body.get("licenseKey");
        String studioName = body.get("studioName");
        String displayName = body.get("displayName");
        String platform = body.get("platform"); // v0.43+: 注册来源子产品（music/drama/celebrity）

        String trimmedPhone = phone == null ? null : phone.trim();
        if (licenseKey == null || licenseKey.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "LICENSE_KEY_REQUIRED", "请填写激活码");
        }
        if (studioName == null || studioName.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "STUDIO_NAME_REQUIRED", "请填写工作室名称");
        }
        smsCodeService.verifyCode(trimmedPhone, code);

        if (userRepo.existsByPhone(trimmedPhone)) {
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

        Map<String, Object> activated = licenseService.activate(activateBody);

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
            return ApiResponse.of(patched);
        }
        return ApiResponse.of(activated);
    }
}
