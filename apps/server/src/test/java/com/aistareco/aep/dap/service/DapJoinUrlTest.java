package com.aistareco.aep.dap.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * base_url 怎么跟资源路径拼起来。
 *
 * <p>起因是「火山的生图老调不通」：运营把火山方舟配上去，换了三种 base_url 全是 404 ——
 * 其中一种还是**照文档填对的那种**。根因是本仓有两套 base_url 约定：
 * 通用调用层拼 {@code {base}/chat/completions}（base 含版本段），
 * dap 层拼 {@code {base}/v1/images/generations}（base 是主机根）。
 * 而火山方舟的图片接口是 {@code /api/v3/images/generations}，路径里没有 {@code /v1}。
 */
class DapJoinUrlTest {

    private static final String IMAGES = "/v1/images/generations";

    @Test
    @DisplayName("base 是主机根（agnes 这类）—— 行为不变")
    void hostRootKeepsVersionedPath() {
        assertEquals("https://api.agnes-ai.cn/v1/images/generations",
                DapMultimodalClient.joinUrl("https://api.agnes-ai.cn", IMAGES));
        assertEquals("https://api.agnes-ai.cn/v1/images/generations",
                DapMultimodalClient.joinUrl("https://api.agnes-ai.cn/", IMAGES));
    }

    @Test
    @DisplayName("base 自带版本段（火山方舟 /api/v3）—— 不再补 /v1")
    void versionedBaseDoesNotGetAnotherV1() {
        assertEquals("https://ark.cn-beijing.volces.com/api/v3/images/generations",
                DapMultimodalClient.joinUrl("https://ark.cn-beijing.volces.com/api/v3", IMAGES));
    }

    @Test
    @DisplayName("base 末尾是 /v1 —— 老行为保留")
    void baseEndingWithV1() {
        assertEquals("https://x.test/v1/images/generations",
                DapMultimodalClient.joinUrl("https://x.test/v1", IMAGES));
    }

    @Test
    @DisplayName("运营把文档上的完整接口地址整条粘进来 —— 不重复追加")
    void fullEndpointPastedIntoBase() {
        assertEquals("https://ark.cn-beijing.volces.com/api/v3/images/generations",
                DapMultimodalClient.joinUrl("https://ark.cn-beijing.volces.com/api/v3/images/generations", IMAGES));
    }

    @Test
    @DisplayName("视频与 chat 路径同样适用")
    void otherPathsFollowTheSameRule() {
        assertEquals("https://ark.cn-beijing.volces.com/api/v3/chat/completions",
                DapMultimodalClient.joinUrl("https://ark.cn-beijing.volces.com/api/v3", "/v1/chat/completions"));
        assertEquals("https://api.agnes-ai.cn/v1/videos",
                DapMultimodalClient.joinUrl("https://api.agnes-ai.cn", "/v1/videos"));
    }

    @Test
    @DisplayName("不要把版本号认错：/api/version、/v 这类不算版本段")
    void doesNotMistakeOtherSegmentsForVersions() {
        assertEquals("https://x.test/api/version/v1/images/generations",
                DapMultimodalClient.joinUrl("https://x.test/api/version", IMAGES));
        assertEquals("https://x.test/v/v1/images/generations",
                DapMultimodalClient.joinUrl("https://x.test/v", IMAGES));
    }
}
