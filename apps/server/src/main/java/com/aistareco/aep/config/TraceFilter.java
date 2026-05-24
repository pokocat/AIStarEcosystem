package com.aistareco.aep.config;

import com.aistareco.common.TraceContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 把每次入站请求的 trace ID 写入 MDC，让所有 log 行自动带 {@code [traceId]} 前缀。
 *
 * 三种入站场景：
 *   1. 上游已带 {@code X-Trace-Id} header（如 admin 后台、内部服务间调用、自动化脚本）→ 复用
 *      —— 上下游 grep 同一 ID 即可拼出整条链路。
 *   2. 上游没带或带的格式不合法 → 服务端生成新的 16 字符 ID。
 *   3. 静态资源 /static/** / /cdn/** 也走 filter（量大但成本低，filter 本身只是 MDC.put + remove）。
 *
 * filter 必须在 auth 链最前面：401/403 错误的兜底 log（GlobalExceptionHandler 的）也要带 traceId，
 * 否则鉴权失败的请求会成为日志里唯一没 trace 的"裸行"，运维查 trace 链路时就断了。
 *
 * 经过本 filter 的 response 头会带 {@code X-Trace-Id}；前端可以在错误 toast 里展示让用户截图反馈。
 */
@Component
public class TraceFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String inbound = request.getHeader(TraceContext.HEADER);
        String traceId = TraceContext.isAcceptable(inbound) ? inbound : TraceContext.generate();
        MDC.put(TraceContext.MDC_KEY, traceId);
        // 响应头让客户端 / 浏览器 devtools / 自动化 e2e 都能在不查后端日志的情况下拿到 traceId
        response.setHeader(TraceContext.HEADER, traceId);
        try {
            chain.doFilter(request, response);
        } finally {
            // OncePerRequestFilter 的同名行只走一次 doFilter，clear MDC 确保线程归还线程池时
            // 不会残留前一次请求的 traceId 污染下一次。
            MDC.remove(TraceContext.MDC_KEY);
        }
    }

    /**
     * 关掉 Spring Boot 默认的 servlet-level 自动注册（TraceFilter 通过 Spring Security
     * 链以 {@code addFilterBefore(traceFilter, ...)} 显式接入；自动注册会重复跑一次，
     * 不仅浪费还会让 MDC 在嵌套 doFilter 退出时被外层 finally 抹掉，引起空 trace 行）。
     *
     * 同 JwtAuthenticationFilter / InternalAuthFilter 一致的做法。
     */
    @Configuration
    static class FilterRegistration {
        @Bean
        FilterRegistrationBean<TraceFilter> disableAutoRegistrationOfTraceFilter(TraceFilter filter) {
            FilterRegistrationBean<TraceFilter> reg = new FilterRegistrationBean<>(filter);
            reg.setEnabled(false);
            reg.setOrder(Ordered.HIGHEST_PRECEDENCE);
            return reg;
        }
    }
}
