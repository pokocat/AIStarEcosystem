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

    /** dev profile 专用。非 dev 环境不会注入。 */
    @Autowired(required = false)
    private DevAutoAuthFilter devAutoAuthFilter;

    public AepSecurityConfig(JwtAuthenticationFilter jwtFilter,
                              InternalAuthFilter internalFilter) {
        this.jwtFilter = jwtFilter;
        this.internalFilter = internalFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints
                        .requestMatchers("/api/admin/auth/login").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/h2-console/**").permitAll()
                        .requestMatchers("/api/config/**", "/internal/config/**").permitAll()
                        .requestMatchers("/api/appearance-forge/coze/**").authenticated()
                        .requestMatchers("/api/me/**").authenticated()
                        // Internal service-to-service endpoints — InternalAuthFilter 已校验 X-Internal-Secret
                        .requestMatchers("/api/internal/**").hasRole("INTERNAL")
                        // Admin endpoints require platform admin staff roles
                        .requestMatchers("/api/admin/**").hasAnyRole(
                                "SUPER_ADMIN",
                                "OPERATOR"
                        )
                        // Everything else is open (singer ecosystem APIs, etc.)
                        .anyRequest().permitAll()
                )
                .headers(headers -> headers.frameOptions(fo -> fo.sameOrigin()))
                .addFilterBefore(internalFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

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
