package com.aistareco.aep.ipstudio.execution;

import java.util.regex.Pattern;

/** Only known wallet numbers may leave the submission exception; never expose arbitrary upstream reasons. */
public final class StudioPaymentMessage {
    public static final String CODE = "STUDIO_PAYMENT_REQUIRED";
    private static final Pattern BALANCE = Pattern.compile("积分余额不足，本次操作需 ([0-9]+)，当前可用 ([0-9]+)");
    private StudioPaymentMessage() {}

    public static String message(String reason) {
        var match = BALANCE.matcher(reason == null ? "" : reason);
        String balance = match.matches()
                ? "积分余额不足，本次操作需 " + match.group(1) + "，当前可用 " + match.group(2)
                : "当前付款账户的积分不足";
        return balance + "。请补足积分后点击“继续”。本步尚未提交，未扣积分。";
    }
}
