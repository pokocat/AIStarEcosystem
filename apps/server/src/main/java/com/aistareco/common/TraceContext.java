package com.aistareco.common;

import org.slf4j.MDC;

import java.security.SecureRandom;

/**
 * 请求级 trace 上下文，用于把同一次 HTTP 请求触达的所有日志行（server 自己 + sau-service +
 * @Async 渲染 worker + 内部回调）串成一条链路。
 *
 * 概念关系（v0.30+）：
 *   - **traceId**（本类）：每次请求随机生成 16 字符；存 MDC + response header X-Trace-Id；
 *     用于 grep 串联跨进程日志。短期可重复（uniform random），不做全局唯一性保证。
 *   - **logId**（{@link com.aistareco.aep.model.ErrorLog#logId}）：12 字符易读追查号，
 *     用户报错时复述给运维。指向某一条 ErrorLog 行，每次异常落库时生成一个。
 *
 * 一条 ErrorLog 同时持有 logId（找这一行）+ traceId（找这整条链路所有日志）。
 *
 * 调用方一般不直接用本类：
 *   - 入站：{@link com.aistareco.aep.config.TraceFilter} 已经在所有 servlet filter 之前
 *     注入 MDC + 写 response header。
 *   - 取值：业务代码用 {@code MDC.get(TraceContext.MDC_KEY)} 或调 {@link #current()}。
 *   - 透传到下游进程（如 sau-service）：发 HTTP 时把 {@link #current()} 拼到
 *     X-Trace-Id 出站 header（见 SauServiceClient.baseBuilder）。
 *   - @Async 边界：默认 MDC 不跨线程，{@link com.aistareco.aep.config.MdcTaskDecorator}
 *     在投任务时 copy 父线程 MDC 到 worker，确保渲染 worker 日志也带 trace。
 */
public final class TraceContext {

    /** SLF4J MDC 字段名；logback layout pattern 用 %X{traceId:-} 引用。 */
    public static final String MDC_KEY = "traceId";

    /** 入/出站 HTTP header 名，标准 case-insensitive。 */
    public static final String HEADER = "X-Trace-Id";

    /** 取宽松字符集（去 0/O/1/I/l），便于人工口述/复制。 */
    private static final char[] ALPHABET =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz".toCharArray();

    private static final int LEN = 16;

    /** 入站 header 可信判断：4-64 字符的 ASCII 字母数字 + 短横线。防注入 / 防超长。 */
    private static final java.util.regex.Pattern SAFE_TRACE_ID =
            java.util.regex.Pattern.compile("^[A-Za-z0-9_-]{4,64}$");

    private static final SecureRandom RANDOM = new SecureRandom();

    private TraceContext() {}

    /** 当前线程的 traceId；未设过返回 null。 */
    public static String current() {
        return MDC.get(MDC_KEY);
    }

    /** 生成一个新的随机 traceId（不写 MDC）。 */
    public static String generate() {
        char[] buf = new char[LEN];
        for (int i = 0; i < LEN; i++) buf[i] = ALPHABET[RANDOM.nextInt(ALPHABET.length)];
        return new String(buf);
    }

    /** 校验入站 header 值是否可作为 traceId（防注入 / 防超长 / 防空）。 */
    public static boolean isAcceptable(String candidate) {
        return candidate != null && SAFE_TRACE_ID.matcher(candidate).matches();
    }
}
