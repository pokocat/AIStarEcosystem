package com.aistareco.aep.service.ai;

import com.aistareco.aep.service.AiModelUsageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;

/**
 * 上游大模型「同步 JSON 调用」的共享原语（v0.85）。
 *
 * 把过去散落在四个模态客户端（文本 {@code AiModelInvocationService}、图像 {@code DramaRenderService}、
 * 视频 {@code MaterialVideoModelClient}、数字人 {@code DapMultimodalClient}）各写一遍的可观测性代码
 * —— HTTP 发送、原始请求/响应日志、非 2xx WARN、失败用量落库 —— 收敛到一处，使「调大模型必有
 * 原始响应可查」成为结构保证，而不是靠每个站点「记得加」。
 *
 * 职责边界（务必）：
 * <ul>
 *   <li>本原语只统一 <b>原始日志 + 失败/基础用量</b>。成功路径的 token / 计费单位只有调用方能解析，
 *       故成功用量仍由各调用方落库（chat 带 tokens、image/video/dap 带 metered units/seconds）。</li>
 *   <li>{@link #sendJson} 在非 2xx 时 <b>不抛异常</b>，而是 WARN + best-effort 落失败用量后 <b>返回 resp</b>，
 *       由调用方按自己的错误码抛出（保持对外行为不变）。网络层失败则抛 {@link UpstreamCallException}。</li>
 *   <li>「2xx 但解析失败」由调用方显式调 {@link #recordBadOutput} 落库（本原语无法判断业务解析成败）。</li>
 * </ul>
 *
 * 大字段防膨胀（AGENTS §4.7）：失败/坏输出才落 responseBodyJson（错误体一般很小），且
 * {@link AiModelUsageService} 会再截断到 16k；成功大响应（图像 b64 / 视频）不经此原语落库。
 * io 原始日志走独立 logger {@code aep.ai.upstream.io}，运维可单独调级别 / 落盘。
 */
@Component
public class UpstreamModelHttp {

    private static final Logger log = LoggerFactory.getLogger(UpstreamModelHttp.class);
    /** 上游原始请求/响应全文流水（排查用）。独立 logger，默认 INFO，可单独降级 / 落单独文件。 */
    private static final Logger ioLog = LoggerFactory.getLogger("aep.ai.upstream.io");
    private static final int IO_BODY_LIMIT = 4000;
    private static final int WARN_BODY_LIMIT = 500;

    private final AiModelUsageService usage;

    public UpstreamModelHttp(AiModelUsageService usage) {
        this.usage = usage;
    }

    /**
     * 发送一次同步 JSON 调用：io 记原始请求/响应 → 非 2xx WARN + best-effort 落失败用量 → 返回 resp 供调用方解析。
     * 网络层失败（IOException / 超时 / 中断）按 {@code ctx.maxAttempts()} 退避重试后抛 {@link UpstreamCallException}。
     */
    public HttpResponse<String> sendJson(HttpRequest req, ModelCallCtx ctx) {
        int maxAttempts = Math.max(1, ctx.maxAttempts());
        long start = System.nanoTime();
        logRequest(req, ctx);
        IOException lastIo = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                HttpResponse<String> resp = ctx.client().send(req, HttpResponse.BodyHandlers.ofString());
                long latency = elapsedMs(start);
                logResponse(resp, ctx, latency);
                if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                    log.warn("[upstream-http] http-error purpose={} endpoint={} model={} status={} durationMs={} requestId={} body={}",
                            ctx.purposeWire(), ctx.endpointName(), ctx.model(), resp.statusCode(),
                            latency, ctx.requestId(), snippet(resp.body(), WARN_BODY_LIMIT));
                    if (ctx.recordFailureUsage()) {
                        recordFailure(ctx, "HTTP_" + resp.statusCode(),
                                snippet(resp.body(), WARN_BODY_LIMIT), resp.body(), latency);
                    }
                }
                return resp;
            } catch (IOException e) {
                lastIo = e;
                boolean willRetry = attempt < maxAttempts;
                log.warn("[upstream-http] io-exception purpose={} endpoint={} model={} attempt={}/{} willRetry={} requestId={} err={}",
                        ctx.purposeWire(), ctx.endpointName(), ctx.model(), attempt, maxAttempts, willRetry,
                        ctx.requestId(), e.toString());
                if (willRetry) {
                    sleep(ctx.retryBackoffMs());
                    continue;
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                long latency = elapsedMs(start);
                log.warn("[upstream-http] interrupted purpose={} endpoint={} model={} requestId={}",
                        ctx.purposeWire(), ctx.endpointName(), ctx.model(), ctx.requestId());
                if (ctx.recordFailureUsage()) {
                    recordFailure(ctx, e.getClass().getSimpleName(), e.getMessage(), null, latency);
                }
                throw new UpstreamCallException(false, e);
            }
        }
        // IOException 重试耗尽
        long latency = elapsedMs(start);
        boolean timeout = lastIo instanceof HttpTimeoutException;
        if (ctx.recordFailureUsage()) {
            recordFailure(ctx, lastIo.getClass().getSimpleName(), lastIo.getMessage(), null, latency);
        }
        throw new UpstreamCallException(timeout, lastIo);
    }

    /**
     * 「2xx 但业务解析失败」时由调用方显式调用：WARN + best-effort 落一条失败用量（含原始响应体）。
     * latencyMs 可为 null（未计时）。
     */
    public void recordBadOutput(ModelCallCtx ctx, String rawBody, String code, Long latencyMs) {
        log.warn("[upstream-http] bad-output purpose={} endpoint={} model={} requestId={} code={} body={}",
                ctx.purposeWire(), ctx.endpointName(), ctx.model(), ctx.requestId(), code,
                snippet(rawBody, WARN_BODY_LIMIT));
        recordFailure(ctx, code, snippet(rawBody, WARN_BODY_LIMIT), rawBody, latencyMs);
    }

    public void recordBadOutput(ModelCallCtx ctx, String rawBody, String code) {
        recordBadOutput(ctx, rawBody, code, null);
    }

    // ── 内部 ───────────────────────────────────────────────────────────────

    /** 失败用量流水（success=false，token/计费单位为空 → 服务端按 purpose 推断计费模式）。best-effort。 */
    private void recordFailure(ModelCallCtx ctx, String errorCode, String errorMessage,
                              String responseBodyJson, Long latencyMs) {
        try {
            String purposeWire = ctx.purposeWire();
            if (ctx.ownerUserId() != null || ctx.appCode() != null) {
                usage.recordObservedWithAttribution(ctx.endpointId(), ctx.endpointName(), ctx.model(),
                        purposeWire, null, null, null, false,
                        ctx.ownerUserId(), null, ctx.appCode(),
                        ctx.requestId(), null, latencyMs, errorCode, errorMessage,
                        ctx.requestBodyJson(), responseBodyJson, ctx.replayOfRecordId());
            } else {
                usage.recordObserved(ctx.endpointId(), ctx.endpointName(), ctx.model(),
                        purposeWire, null, null, null, false,
                        ctx.requestId(), null, latencyMs, errorCode, errorMessage,
                        ctx.requestBodyJson(), responseBodyJson, ctx.replayOfRecordId());
            }
        } catch (Exception e) {
            // 用量是观测旁路，绝不阻断主链路。
            log.warn("[upstream-http] record failure usage failed endpoint={} model={}: {}",
                    ctx.endpointName(), ctx.model(), e.toString());
        }
    }

    private static void logRequest(HttpRequest req, ModelCallCtx ctx) {
        if (!ioLog.isInfoEnabled()) return;
        ioLog.info("[upstream-io] REQUEST requestId={} purpose={} endpoint={} model={} method={} uri={} body={}",
                ctx.requestId(), ctx.purposeWire(), ctx.endpointName(), ctx.model(),
                req.method(), req.uri(), snippet(ctx.requestBodyJson(), IO_BODY_LIMIT));
    }

    private static void logResponse(HttpResponse<String> resp, ModelCallCtx ctx, long latencyMs) {
        if (!ioLog.isInfoEnabled()) return;
        ioLog.info("[upstream-io] RESPONSE requestId={} purpose={} endpoint={} model={} status={} durationMs={} body={}",
                ctx.requestId(), ctx.purposeWire(), ctx.endpointName(), ctx.model(),
                resp.statusCode(), latencyMs, snippet(resp.body(), IO_BODY_LIMIT));
    }

    private static void sleep(long ms) {
        if (ms <= 0) return;
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    private static String snippet(String body, int limit) {
        if (body == null) return "";
        return body.length() > limit ? body.substring(0, limit) + "…" : body;
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }
}
