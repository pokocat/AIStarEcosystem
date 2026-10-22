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
}
