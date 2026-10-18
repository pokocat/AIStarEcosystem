package com.aistareco.aep.service.ai;

import com.aistareco.aep.service.AiModelUsageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;

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
    @org.springframework.beans.factory.annotation.Autowired private com.aistareco.aep.service.AiGenerationQueueService queue;

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
        String path=req.uri().getPath();
        if(queue!=null && "POST".equals(req.method()) &&
                (path.endsWith("/chat/completions")||path.endsWith("/images/generations")))
            return queue.synchronous(ctx.endpointId(),req.timeout().orElse(java.time.Duration.ofMinutes(5)),()->sendAdmitted(req,ctx));
        return sendAdmitted(req,ctx);
    }
    private HttpResponse<String> sendAdmitted(HttpRequest req,ModelCallCtx ctx) {
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

    // ── 流式调用（v0.20x 对话真流式；docs/ip-studio-conversational-video-recreation-plan.md §真实流式正文与工作记录） ──

    /** 逐行处理 SSE 流；返回 false 表示调用方已拿到所需内容、提前结束读取。 */
    public interface StreamLineHandler { boolean onLine(String line) throws Exception; }

    /** 流式调用结果：非 2xx 时 {@code errorBody} 为上游原始响应体（已 WARN + 落失败用量）；{@code cancelled} 表示调用方主动终止。 */
    public record StreamResult(int status, String errorBody, boolean cancelled, long latencyMs) {}

    private static final ScheduledExecutorService STREAM_WATCHDOG = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "upstream-stream-watchdog");
        t.setDaemon(true);
        return t;
    });
    private static final int STREAM_ERROR_BODY_LIMIT = 64 * 1024;

    /**
     * 发送一次流式调用（OpenAI 兼容 {@code stream:true}）：与 {@link #sendJson} 同一套准入、原始请求日志、非 2xx WARN 与失败用量。
     *
     * <ul>
     *   <li>非 2xx：读取（截断）响应体，WARN 带 status + body，落失败用量，返回结果由调用方抛自己的错误码 —— 不抛异常。</li>
     *   <li>2xx：逐行交给 {@code handler}，每一行都是供应商真实下发的数据；本原语不拆分、不延时、不合成内容。</li>
     *   <li>{@code cancelled} 返回 true（用户停止）→ 关闭连接，结果标 cancelled；空闲超过 {@code idleTimeout} 或总时长超过
     *       {@code totalTimeout} → 视为断流，落失败用量并抛 {@link UpstreamCallException}(timeout=true)。</li>
     *   <li>流中途网络失败 → {@link UpstreamCallException}；已下发的半截内容由调用方决定如何处理，不按字符计费。</li>
     * </ul>
     * 流式调用不做网络重试：已经下发给用户的增量无法撤回，重放会重复正文。
     */
    public StreamResult sendStream(HttpRequest req, ModelCallCtx ctx, StreamLineHandler handler, BooleanSupplier cancelled,
                                   Duration idleTimeout, Duration totalTimeout) {
        String path = req.uri().getPath();
        if (queue != null && "POST".equals(req.method()) && path.endsWith("/chat/completions"))
            return queue.synchronous(ctx.endpointId(), totalTimeout, () -> streamAdmitted(req, ctx, handler, cancelled, idleTimeout, totalTimeout));
        return streamAdmitted(req, ctx, handler, cancelled, idleTimeout, totalTimeout);
    }

    private StreamResult streamAdmitted(HttpRequest req, ModelCallCtx ctx, StreamLineHandler handler, BooleanSupplier cancelled,
                                        Duration idleTimeout, Duration totalTimeout) {
        long start = System.nanoTime();
        logRequest(req, ctx);
        HttpResponse<InputStream> resp;
        try {
            resp = ctx.client().send(req, HttpResponse.BodyHandlers.ofInputStream());
        } catch (IOException e) {
            long latency = elapsedMs(start);
            log.warn("[upstream-http] stream io-exception purpose={} endpoint={} model={} requestId={} err={}",
                    ctx.purposeWire(), ctx.endpointName(), ctx.model(), ctx.requestId(), e.toString());
            if (ctx.recordFailureUsage()) recordFailure(ctx, e.getClass().getSimpleName(), e.getMessage(), null, latency);
            throw new UpstreamCallException(e instanceof HttpTimeoutException, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            if (ctx.recordFailureUsage()) recordFailure(ctx, e.getClass().getSimpleName(), e.getMessage(), null, elapsedMs(start));
            throw new UpstreamCallException(false, e);
        }
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            String body = readBounded(resp.body());
            long latency = elapsedMs(start);
            if (ioLog.isInfoEnabled())
                ioLog.info("[upstream-io] RESPONSE requestId={} purpose={} endpoint={} model={} status={} durationMs={} body={}",
                        ctx.requestId(), ctx.purposeWire(), ctx.endpointName(), ctx.model(), resp.statusCode(), latency, snippet(body, IO_BODY_LIMIT));
            log.warn("[upstream-http] http-error purpose={} endpoint={} model={} status={} durationMs={} requestId={} stream=true body={}",
                    ctx.purposeWire(), ctx.endpointName(), ctx.model(), resp.statusCode(), latency, ctx.requestId(), snippet(body, WARN_BODY_LIMIT));
            if (ctx.recordFailureUsage()) recordFailure(ctx, "HTTP_" + resp.statusCode(), snippet(body, WARN_BODY_LIMIT), body, latency);
            return new StreamResult(resp.statusCode(), body, false, latency);
        }
        long idleNanos = idleTimeout.toNanos(), totalNanos = totalTimeout.toNanos();
        AtomicLong lastActivity = new AtomicLong(System.nanoTime());
        AtomicReference<String> abort = new AtomicReference<>();
        InputStream in = resp.body();
        var watchdog = STREAM_WATCHDOG.scheduleAtFixedRate(() -> {
            String reason = null;
            try { if (cancelled != null && cancelled.getAsBoolean()) reason = "cancelled"; }
            catch (RuntimeException ignored) { /* a failing stop probe never aborts a healthy stream */ }
            long now = System.nanoTime();
            if (reason == null && now - lastActivity.get() > idleNanos) reason = "idle";
            if (reason == null && now - start > totalNanos) reason = "total";
            if (reason != null && abort.compareAndSet(null, reason)) {
                try { in.close(); } catch (IOException ignored) { /* closing only unblocks the reader */ }
            }
        }, 500, 500, TimeUnit.MILLISECONDS);
        try (var reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lastActivity.set(System.nanoTime());
                if (abort.get() != null) break;
                if (!handler.onLine(line)) break;
            }
        } catch (IOException e) {
            if (abort.get() == null) {
                long latency = elapsedMs(start);
                log.warn("[upstream-http] stream broken purpose={} endpoint={} model={} requestId={} durationMs={} err={}",
                        ctx.purposeWire(), ctx.endpointName(), ctx.model(), ctx.requestId(), latency, e.toString());
                if (ctx.recordFailureUsage()) recordFailure(ctx, "STREAM_BROKEN", e.getMessage(), null, latency);
                throw new UpstreamCallException(false, e);
            }
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException(e);
        } finally {
            watchdog.cancel(false);
        }
        long latency = elapsedMs(start);
        String reason = abort.get();
        if ("idle".equals(reason) || "total".equals(reason)) {
            log.warn("[upstream-http] stream timeout purpose={} endpoint={} model={} requestId={} reason={} durationMs={}",
                    ctx.purposeWire(), ctx.endpointName(), ctx.model(), ctx.requestId(), reason, latency);
            if (ctx.recordFailureUsage()) recordFailure(ctx, "STREAM_TIMEOUT", "stream " + reason + " timeout", null, latency);
            throw new UpstreamCallException(true, new HttpTimeoutException("stream " + reason + " timeout"));
        }
        if (ioLog.isInfoEnabled())
            ioLog.info("[upstream-io] RESPONSE requestId={} purpose={} endpoint={} model={} status={} durationMs={} stream=true cancelled={}",
                    ctx.requestId(), ctx.purposeWire(), ctx.endpointName(), ctx.model(), resp.statusCode(), latency, "cancelled".equals(reason));
        return new StreamResult(resp.statusCode(), null, "cancelled".equals(reason), latency);
    }

    private static String readBounded(InputStream in) {
        try (in) {
            byte[] bytes = in.readNBytes(STREAM_ERROR_BODY_LIMIT);
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "";
        }
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
