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
                        .requestMatchers("/api/config/**", "/internal/config/**").permitAll()
                        .requestMatchers("/api/appearance-forge/coze/**").authenticated()
                        .requestMatchers("/api/appearance-forge/chat/**").authenticated() // v0.43 形象锻造对话（大模型）
                        .requestMatchers("/api/me/**").authenticated()
                        .requestMatchers("/api/mixcut/**").authenticated()
                        // 数字人广场 · 运营内嵌后台（web-aiavatar）：/api/v1/admin/** 需运营 / 超管。
                        // 顺序敏感：必须排在通用 /api/v1/** 之前，否则被宽松规则吃掉。
                        .requestMatchers("/api/v1/admin/**").hasAnyRole("SUPER_ADMIN", "OPERATOR")
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
                        .requestMatchers("/api/admin/**").hasAnyRole(
                                "SUPER_ADMIN",
                                "OPERATOR"
                        )
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
