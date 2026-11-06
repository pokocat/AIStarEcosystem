package com.aistareco.aep.service.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class StreamUsageEstimatorTest {
    @Test void englishIsAboutFourCharactersAndChineseAboutOneAndAHalfPerToken() {
        var counter = new StreamUsageEstimator.Counter();
        counter.add("abcdefgh");
        assertEquals(2L, counter.tokens());
        counter.add("剧本开头写好");
        assertEquals(6L, counter.tokens());
    }

    @Test void fragmentsCountTheSameAsTheWholeText() {
        var whole = new StreamUsageEstimator.Counter();
        whole.add("abcdefgh剧本");
        var split = new StreamUsageEstimator.Counter();
        split.add("abc"); split.add("defgh剧"); split.add("本");
        assertEquals(whole.tokens(), split.tokens());
    }

    @Test void promptCountsTextPartsImagesAndEachMessage() {
        var messages = List.of(
                Map.<String, Object>of("role", "system", "content", "abcdefgh"),
                Map.<String, Object>of("role", "user", "content", List.of(
                        Map.of("type", "text", "text", "abcd"),
                        Map.of("type", "image_url", "image_url", Map.of("url", "data:image/jpeg;base64,xxxx")))));
        // 12 个字符 = 3；两条消息各 4；一张图 1024。图片地址本身不算文字。
        assertEquals(3L + 8L + 1024L, StreamUsageEstimator.promptTokens(messages));
    }

    @Test void nothingSentCountsAsNothing() {
        assertEquals(0L, StreamUsageEstimator.promptTokens(null));
        assertEquals(0L, new StreamUsageEstimator.Counter().tokens());
    }
}
