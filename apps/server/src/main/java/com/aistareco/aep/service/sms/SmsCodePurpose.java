package com.aistareco.aep.service.sms;

import java.util.Locale;

public enum SmsCodePurpose {
    LOGIN("login", "登录"),
    REGISTER("register", "注册");

    private final String wire;
    private final String label;

    SmsCodePurpose(String wire, String label) {
        this.wire = wire;
        this.label = label;
    }

    public String wire() {
        return wire;
    }

    public String label() {
        return label;
    }

    public static SmsCodePurpose fromWireOrDefault(String value) {
        if (value == null || value.isBlank()) {
            return LOGIN;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        for (SmsCodePurpose purpose : values()) {
            if (purpose.wire.equals(normalized)) {
                return purpose;
            }
        }
        throw new IllegalArgumentException("unsupported sms code purpose: " + value);
    }
}
