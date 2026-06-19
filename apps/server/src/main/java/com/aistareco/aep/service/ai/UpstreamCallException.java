package com.aistareco.aep.service.ai;

/**
 * {@link UpstreamModelHttp#sendJson} 在网络层（IOException / 超时 / 中断）失败、重试耗尽后抛出。
 *
 * 本原语不知道各模态的对外错误码（chat 的 AI_PROVIDER_*、video 的 VIDEO_SUBMIT_FAILED、
 * image 的 IMAGE_CALL_FAILED、dap 的 DAP_MODEL_CALL_FAILED 各不相同），故只统一「网络失败」语义，
 * 由调用方 catch 后映射成自己的 {@code BusinessException} / {@code DapModelException}，
 * 保持对外行为/错误码不变。{@link #isTimeout()} 区分超时（供 chat 映射 AI_PROVIDER_TIMEOUT）。
 *
 * 失败用量流水（若 ctx.recordFailureUsage()）在抛出前已由原语 best-effort 落库，调用方无需重复记。
 */
public class UpstreamCallException extends RuntimeException {

    private final boolean timeout;

    public UpstreamCallException(boolean timeout, Throwable cause) {
        super(cause == null ? null : cause.getMessage(), cause);
        this.timeout = timeout;
    }

    public boolean isTimeout() {
        return timeout;
    }
}
