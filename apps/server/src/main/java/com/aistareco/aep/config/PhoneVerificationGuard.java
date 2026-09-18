package com.aistareco.aep.config;

import com.aistareco.aep.enrollment.config.EnrollmentGuard;
import com.aistareco.aep.identity.IdentityProperties;
import com.aistareco.common.TraceContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 未绑手机号的账号只读（微信游客）。
 *
 * <p>账号中心允许「只有微信、没有手机号」的账号登录进来（令牌里
 * {@code phone_verified=false}），但手机号才是全生态的身份识别。所以这类账号
 * <b>能看不能改</b>：读随便读，任何写操作一律 403，让用户先去账号中心绑手机号。
 *
 * <h2>为什么拦在这里，而不是各个 controller 里</h2>
 * 「每个写接口自己记得判一下」是守不住的 —— 本仓有上百个写端点，漏一个就是一个缺口。
 * 这里和 {@link com.aistareco.aep.enrollment.config.EnrollmentGuard} 一样是<b>统一闸门</b>：
 * 一处拦住全部，新增 controller 不需要记得任何事。
 *
 * <h2>判定</h2>
 * <ul>
 *   <li><b>只拦写方法</b>：{@code GET / HEAD / OPTIONS} 放行 —— 这正是「只读」的定义。</li>
 *   <li><b>只拦已登录请求</b>：没有认证主体时不归本闸门管（由安全链与
 *       {@code EnrollmentGuard} 处理），否则会把未登录的 401 变成一个词不达意的 403。</li>
 *   <li><b>只拦明确为 false 的</b>：{@link JwtAuthenticationFilter} 在两条认证链路上都会
 *       显式写入这个标记（账号中心令牌按 claim，legacy HS256 一律 {@code true} ——
 *       游客只由账号中心的微信登录建出来，而它从不签 HS256）。内部服务令牌不带这个标记，
 *       按不拦处理：它们不是人，没有手机号这回事。</li>
 * </ul>
 *
 * <p>排在 {@code EnrollmentGuard} <b>之前</b>：一个既没绑手机、又没开通产品的游客发起写操作时，
 * 「请先绑定手机号」比「请先开通该产品」更靠前、也更可操作。
 */
@Component
public class PhoneVerificationGuard extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(PhoneVerificationGuard.class);

    public static final String ERROR_CODE = "PHONE_VERIFICATION_REQUIRED";

    /** 只读放行的方法。其余（POST / PUT / PATCH / DELETE …）都算写。 */
    private static final Set<String> READ_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    /**
     * 不归本闸门管的前缀。
     *
     * <ul>
     *   <li>{@code /api/auth/**} —— 登录本身，此时还谈不上「已绑手机号」。</li>
     *   <li>{@code /api/internal/**} —— 服务间调用，主体不是人。</li>
     * </ul>
     *
     * <p>后台路由（{@code /api/admin/**}）不用列：后台令牌走 legacy 链路，标记恒为
     * {@code true}，本来就进不了拒绝分支。
     */
    private static final List<String> EXEMPT_PREFIXES = List.of("/api/auth", "/api/internal");

    private final ObjectMapper mapper;
    private final IdentityProperties identityProps;

    public PhoneVerificationGuard(ObjectMapper mapper, IdentityProperties identityProps) {
        this.mapper = mapper;
        this.identityProps = identityProps;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (READ_METHODS.contains(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }
        String path = EnrollmentGuard.pathOf(request);
        if (isExempt(path)) {
            chain.doFilter(request, response);
            return;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!isPhoneUnverified(auth)) {
            chain.doFilter(request, response);
            return;
        }

        log.debug("[phone-guard] 未绑手机号的账号发起写操作被拒 userId={} method={} path={}",
                auth.getName(), request.getMethod(), path);
        writeError(response);
    }

    /** 只有「明确标了未验证」才拦；标记缺失（内部令牌等）一律放行。 */
    private static boolean isPhoneUnverified(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) return false;
        if (!(auth.getDetails() instanceof Map<?, ?> details)) return false;
        return Boolean.FALSE.equals(details.get(JwtAuthenticationFilter.PHONE_VERIFIED_DETAIL));
    }

    private static boolean isExempt(String path) {
        for (String prefix : EXEMPT_PREFIXES) {
            if (path.equals(prefix) || path.startsWith(prefix + "/")) return true;
        }
        return false;
    }

    /** 与 {@code EnrollmentGuard} 同一套错误壳，前端一份处理逻辑就够。 */
    private void writeError(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", ERROR_CODE);
        error.put("message", "请先绑定手机号后再操作");
        String traceId = MDC.get(TraceContext.MDC_KEY);
        if (traceId != null && !traceId.isBlank()) error.put("traceId", traceId);

        Map<String, Object> details = new LinkedHashMap<>();
        // 绑定入口在账号中心，不在本仓。地址由 issuer 派生，不硬编码域名。
        String issuer = identityProps.baseUrl();
        if (issuer != null && !issuer.isBlank()) {
            details.put("bindUrl", issuer + "/account/manage/phone");
        }
        if (!details.isEmpty()) error.put("details", details);

        response.getWriter().write(mapper.writeValueAsString(Map.of("error", error)));
    }
}
