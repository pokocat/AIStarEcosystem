package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.Mockito.mock;

/** 真跑一次 Java2D 画卡片 + ffmpeg 编码（本机没有 ffmpeg 就跳过）：线上测试 mock 出片靠的就是这一步。 */
class VideoStudioTestMockRenderTest {

    @Test
    @DisplayName("演示视频真能做出来：MP4 有内容、封面是 PNG、尺寸按比例")
    void rendersARealMp4() throws Exception {
        FfmpegRunner ffmpeg = new FfmpegRunner(new MixcutProperties());
        boolean available;
        try {
            ffmpeg.runFfmpeg(List.of("-hide_banner", "-version"));
            available = true;
        } catch (RuntimeException e) {
            available = false;
        }
        assumeTrue(available, "本机没有 ffmpeg");

        VideoStudioTestMock mock = new VideoStudioTestMock(mock(PlatformConfigService.class), ffmpeg);
        VideoStudioTestMock.DemoMedia media = mock.render("mvj_render", 2, "16:9", "清晨的海岸，镜头缓慢推进");
        try {
            assertTrue(Files.size(media.video()) > 1000, "MP4 太小");
            byte[] png = Files.readAllBytes(media.thumbnail());
            assertTrue(png.length > 8 && png[1] == 'P' && png[2] == 'N' && png[3] == 'G', "封面不是 PNG");
            String probe = new FfmpegRunner(new MixcutProperties()).runFfprobe(List.of("-v", "error",
                    "-select_streams", "v:0", "-show_entries", "stream=width,height,codec_name", "-of", "csv=p=0",
                    media.video().toString()));
            assertTrue(probe.contains("h264,1280,720"), probe);
        } finally {
            VideoStudioTestMock.cleanup(media);
        }
    }
}
