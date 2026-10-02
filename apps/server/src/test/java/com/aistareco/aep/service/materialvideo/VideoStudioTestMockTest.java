package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** 视频生成区测试 mock（临时）：名单从平台配置读、缺省 = 关；产物带显式标识。 */
class VideoStudioTestMockTest {

    private static final ObjectMapper OM = new ObjectMapper();

    private static VideoStudioTestMock mockWith(String json) throws Exception {
        PlatformConfigService configs = mock(PlatformConfigService.class);
        when(configs.findByKey(VideoStudioTestMock.CONFIG_KEY)).thenReturn(json == null ? Optional.empty()
                : Optional.of(new PlatformConfigDto(VideoStudioTestMock.CONFIG_KEY, OM.readTree(json), 1, null,
                        Instant.now(), "test")));
        return new VideoStudioTestMock(configs, mock(FfmpegRunner.class));
    }

    @Test
    @DisplayName("配置缺省 / 不是数组 / 空数组 → 谁都不 mock；名单里的账号才 mock")
    void allowlistFromPlatformConfig() throws Exception {
        assertFalse(mockWith(null).appliesTo("u1"));
        assertFalse(mockWith("\"u1\"").appliesTo("u1"));
        assertFalse(mockWith("[]").appliesTo("u1"));
        VideoStudioTestMock m = mockWith("[\"u1\", \" \", 3]");
        assertTrue(m.appliesTo("u1"));
        assertFalse(m.appliesTo("u2"));
        assertFalse(m.appliesTo(null));
    }

    @Test
    @DisplayName("读配置抛异常 → 按不 mock 处理（不影响真实链路）")
    void configFailureMeansOff() {
        PlatformConfigService configs = mock(PlatformConfigService.class);
        when(configs.findByKey(VideoStudioTestMock.CONFIG_KEY)).thenThrow(new IllegalStateException("db down"));
        assertFalse(new VideoStudioTestMock(configs, mock(FfmpegRunner.class)).appliesTo("u1"));
    }

    @Test
    @DisplayName("智能优化的测试结果开头带「测试演示，未调用厂商」")
    void optimizedPromptIsMarked() throws Exception {
        String out = mockWith(null).optimizedPrompt("  人物转身走向窗边 ");
        assertTrue(out.startsWith(VideoStudioTestMock.PROMPT_MARK + "人物转身走向窗边"), out);
    }

    @Test
    @DisplayName("演示视频尺寸：长边 1280，短边按比例取偶数；认不出的比例按 9:16")
    void sizes() {
        assertArrayEquals(new int[] { 1280, 720 }, VideoStudioTestMock.sizeFor("16:9"));
        assertArrayEquals(new int[] { 720, 1280 }, VideoStudioTestMock.sizeFor("9:16"));
        assertArrayEquals(new int[] { 1280, 1280 }, VideoStudioTestMock.sizeFor("1:1"));
        assertArrayEquals(new int[] { 960, 1280 }, VideoStudioTestMock.sizeFor("3:4"));
        assertArrayEquals(new int[] { 1280, 548 }, VideoStudioTestMock.sizeFor("21:9"));
        assertArrayEquals(new int[] { 720, 1280 }, VideoStudioTestMock.sizeFor("坏的"));
        assertArrayEquals(new int[] { 720, 1280 }, VideoStudioTestMock.sizeFor(null));
    }
}
