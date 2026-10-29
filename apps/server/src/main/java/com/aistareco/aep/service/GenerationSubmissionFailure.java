package com.aistareco.aep.service;

/** Product policy: no usable submission receipt means failed; keep diagnostics, refund unused credits, retry only on user action. */
public final class GenerationSubmissionFailure {
    private GenerationSubmissionFailure() {}
    public static final String MESSAGE = "生成服务没有返回有效的任务信息，本次生成失败。未完成部分的冻结积分已退回，你可以重新生成。";
    public static String message(Throwable cause) {
        String reason = cause instanceof com.aistareco.common.BusinessException ? cause.getMessage()
                : cause == null ? null : cause.getClass().getSimpleName();
        return MESSAGE + (reason == null || reason.isBlank() ? "" : " 错误原因：" + reason);
    }

    /**
     * ErrorLog / alert cause for a receipt this policy has just closed. It states the settled outcome: the
     * in-flight wording ("请勿重新生成") is stale once the task failed and refunded, and a missing message is omitted
     * rather than printed as "null" (2026-10-29 alerts).
     */
    public static IllegalStateException settled(String situation, String earlierState, Throwable cause) {
        String text = situation + "，已按失败处理并退回未完成部分的冻结积分";
        String earlier = earlierState == null ? "" : earlierState.replaceAll("[；;，,]?\\s*请勿重新生成", "").trim();
        if (!earlier.isEmpty()) text += "。运行中记录的状态：" + earlier;
        return new IllegalStateException(text, cause);
    }
}
