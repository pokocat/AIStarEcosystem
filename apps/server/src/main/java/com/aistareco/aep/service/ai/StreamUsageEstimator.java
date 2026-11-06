package com.aistareco.aep.service.ai;

import java.util.List;
import java.util.Map;

/**
 * 流被用户中途停止时，厂商的用量回执（最后一个分片）收不到，这里按请求和已收到的内容在本地估算。
 * 只用于这一种结算，结果必须标明是估算。没有引入分词器：英文约 4 字符一个 Token，中文约 1.5 字一个 Token。
 */
public final class StreamUsageEstimator {
    /** 图片的 Token 数厂商按尺寸算，这里拿不到尺寸，取一张普通图的量级。 */
    private static final long IMAGE_TOKENS = 1024L;
    private static final long MESSAGE_OVERHEAD_TOKENS = 4L;

    private StreamUsageEstimator() {}

    public static long promptTokens(List<? extends Map<String, ?>> messages) {
        if (messages == null) return 0L;
        Counter text = new Counter();
        long extra = 0L;
        for (Map<String, ?> message : messages) {
            if (message == null) continue;
            extra += MESSAGE_OVERHEAD_TOKENS;
            Object content = message.get("content");
            if (content instanceof List<?> parts) {
                for (Object part : parts) {
                    if (part instanceof Map<?, ?> map) {
                        if ("text".equals(map.get("type")) || map.get("text") != null) text.add(String.valueOf(map.get("text")));
                        else extra += IMAGE_TOKENS;
                    } else if (part != null) text.add(part.toString());
                }
            } else if (content != null) text.add(content.toString());
        }
        return text.tokens() + extra;
    }

    /** 累计收到的文字。分片可能切在任意位置，所以数字符，最后才换算。 */
    public static final class Counter {
        private long ascii;
        private long other;

        public void add(String text) {
            if (text == null) return;
            text.codePoints().forEach(c -> { if (c < 128) ascii++; else other++; });
        }

        public long tokens() {
            return (ascii + 3L) / 4L + (other * 2L + 2L) / 3L;
        }
    }
}
