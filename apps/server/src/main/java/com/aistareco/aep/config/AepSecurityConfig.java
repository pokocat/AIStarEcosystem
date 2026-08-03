package com.aistareco.aep.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class AepSecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final InternalAuthFilter internalFilter;
    private final TraceFilter traceFilter;
    private final ApiOperationLogFilter apiOperationLogFilter;
    private final SecurityJsonEntryPoint jsonEntryPoint;
    private final SecurityJsonAccessDeniedHandler jsonAccessDeniedHandler;

    /** dev profile 专用。非 dev 环境不会注入。 */
    @Autowired(required = false)
    private DevAutoAuthFilter devAutoAuthFilter;

    public AepSecurityConfig(JwtAuthenticationFilter jwtFilter,
                              InternalAuthFilter internalFilter,
                              TraceFilter traceFilter,
                              ApiOperationLogFilter apiOperationLogFilter,
                              SecurityJsonEntryPoint jsonEntryPoint,
                              SecurityJsonAccessDeniedHandler jsonAccessDeniedHandler) {
        this.jwtFilter = jwtFilter;
        this.internalFilter = internalFilter;
        this.traceFilter = traceFilter;
        this.apiOperationLogFilter = apiOperationLogFilter;
        this.jsonEntryPoint = jsonEntryPoint;
        this.jsonAccessDeniedHandler = jsonAccessDeniedHandler;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(jsonEntryPoint)
                        .accessDeniedHandler(jsonAccessDeniedHandler)
                )
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints
                        .requestMatchers("/api/admin/auth/login").permitAll()
                        .requestMatchers("/api/admin/auth/operator-login").permitAll() // v0.37 平台运营登录
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/h2-console/**").permitAll()
                        // v2 §6.4 触点④：各渠道（支付宝 / 微信）异步回调靠验签不靠 JWT。
                        // 金额/状态只信此服务端通道；建议再加限流 + 只放行渠道出口 IP（运维侧）。
                        .requestMatchers("/api/pay/notify/**").permitAll()
                        .requestMatchers("/api/config/**", "/internal/config/**").permitAll()
                        .requestMatchers("/api/appearance-forge/coze/**").authenticated()
                        .requestMatchers("/api/appearance-forge/chat/**").authenticated() // v0.43 形象锻造对话（大模型）
                        .requestMatchers("/api/me/**").authenticated()
                        .requestMatchers("/api/mixcut/**").authenticated()
                        // 充值/积分包只读展示 + 购买记录回显（写入动作已下线，购买统一走
                        // RechargeService 订单流）。此前无显式规则时落 anyRequest().permitAll()
                        // 兜底（例行 QA 2026-07-05 审计 F-01），显式收紧为 authenticated 防御纵深。
                        .requestMatchers("/api/settings/**").authenticated()
                        // 商店购买（POST /api/store/items/{type}/{id}/redeem 真实扣积分）。
                        // 同 F-01 一样此前无显式规则、落 anyRequest().permitAll() 兜底 ——
                        // StoreController#redeem 直接 principal.getName()，未登录访问会 NPE 500
                        // 而非干净的 401。显式收紧防御纵深（只收窄 items/** 写路径；/api/store/catalog
                        // 保持 permitAll，因 StoreController#catalog 显式支持匿名浏览
                        // `principal != null ? principal.getName() : null` —— 收紧它会破坏这个
                        // 既有设计）。（例行 QA 2026-07-07 审计新发现）
                        .requestMatchers("/api/store/items/**").authenticated()
                        // v0.60: 明星商务工作台（web-star）—— 登录后由 controller 解析明星档案绑定
                        .requestMatchers("/api/star/**").authenticated()
                        // FinanceController 全部按 principal.getName() 查询本人流水/收入，此前无显式
                        // 规则会落 anyRequest().permitAll() 兜底——今天只是匿名请求命中 anonymousUser
                        // 查到空结果而非跨户泄露，但与仓库里其它所有 principal-scoped 端点的收紧惯例
                        // 不一致，属于防御纵深缺口（例行 QA 2026-07-23 审计新发现）。
                        .requestMatchers("/api/finance/**").authenticated()
                        // 数字人广场 · 运营内嵌后台（web-aiavatar）：/api/v1/admin/** 需运营 / 超管。
                        // 顺序敏感：必须排在通用 /api/v1/** 之前，否则被宽松规则吃掉。
                        .requestMatchers("/api/v1/admin/**").hasAnyRole("SUPER_ADMIN", "OPERATOR")
                        // v0.105 真人授权刷脸回跳：七牛 modelink 刷脸完成后由**浏览器直接跳转**回来，
                        // 不携带我们的 JWT，故只能 permitAll —— 防伪靠 query 里不可枚举的 state
                        // （= DapMaterialGroup.callbackToken，随机 UUID hex，一次会话一枚）+ 服务端
                        // validateCalledAt 幂等闸；且回调**不直接判定授权生效**，生效与否一律以
                        // 服务端轮询上游 GET 分组的状态为准（官方要求）。顺序敏感：必须在
                        // 通用 /api/v1/** authenticated 之前。
                        .requestMatchers("/api/v1/real-auth/callback").permitAll()
                        // 数字人资产平台（web-aiavatar，v0.51 dap 领域）：/api/v1/** 全部需登录。
                        .requestMatchers("/api/v1/**").authenticated()
                        // 素材运营（脚本 / 视频 / 爆款雷达）—— 任意登录用户可读写共享库
                        .requestMatchers("/api/material/**").authenticated()
                        // v0.31+：商品库公共池 —— 任意登录用户可读；卖点抽取只返回文本、不写库。
                        //  真正写动作（POST/PATCH/DELETE/from-link/refresh-images/持久化卖点）
                        //  已迁至 /api/admin/products/**，受下方 hasAnyRole 门禁。
                        .requestMatchers("/api/products/**").authenticated()
                        // Internal service-to-service endpoints — InternalAuthFilter 已校验 X-Internal-Secret
                        .requestMatchers("/api/internal/**").hasRole("INTERNAL")
                        // 错误日志含 stacktrace + 用户身份等敏感信息，只给 SUPER_ADMIN。
                        // 顺序敏感：必须在通用 /api/admin/** 之前注册，否则被宽松规则吃掉。
                        .requestMatchers("/api/admin/error-logs/**").hasRole("SUPER_ADMIN")
                        // 管理员账号 CRUD 仅 SUPER_ADMIN —— 不允许运营创建/提权他人。
                        // 同样需要排在通用 /api/admin/** 之前。
                        .requestMatchers("/api/admin/staff/**").hasRole("SUPER_ADMIN")
                        // Admin endpoints require platform admin staff roles
                        // v2 §9：FINANCE_ADMIN（财务）纳入；细粒度（复核仅 FINANCE_ADMIN/SUPER_ADMIN）由 controller @PreAuthorize 收口
                        .requestMatchers("/api/admin/**").hasAnyRole(
                                "SUPER_ADMIN",
                                "OPERATOR",
                                "FINANCE_ADMIN"
                        )
                        // v2 影子链路 dev 工具（仅 shadow 启用时存在 bean）：会写账本，必须登录；
                        // controller 内再做订单归属校验。生产真实渠道时 bean 不注册，路径 404。
                        .requestMatchers("/api/dev/**").authenticated()
                        // Everything else is open (singer ecosystem APIs, etc.)
                        .anyRequest().permitAll()
                )
                .headers(headers -> headers.frameOptions(fo -> fo.sameOrigin()))
                // traceFilter 最先跑：所有后续 filter / controller / exception handler 共享同一个 traceId
                .addFilterBefore(traceFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(internalFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(apiOperationLogFilter, JwtAuthenticationFilter.class);

        // dev 环境：在 JWT filter 之后兜底自动登录
        if (devAutoAuthFilter != null) {
            http.addFilterAfter(devAutoAuthFilter, JwtAuthenticationFilter.class);
        }
        return http.build();
    }

    @Bean
    public FilterRegistrationBean<InternalAuthFilter> internalFilterRegistration(InternalAuthFilter filter) {
        FilterRegistrationBean<InternalAuthFilter> reg = new FilterRegistrationBean<>(filter);
        reg.setEnabled(false);
        return reg;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * JwtAuthenticationFilter 是 @Component，Spring Boot 默认会把它注册成 servlet filter；
     * 这会让它跑在 Spring Security chain 之外，而 chain 里的 SecurityContextHolderFilter
     * 会重置 context，导致这里设置的 Authentication 被清掉。
     * 禁用 servlet-level 注册，filter 只通过 {@code addFilterBefore(...)} 挂在安全链内部。
     */
    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(JwtAuthenticationFilter filter) {
        FilterRegistrationBean<JwtAuthenticationFilter> reg = new FilterRegistrationBean<>(filter);
        reg.setEnabled(false);
        return reg;
    }

}
