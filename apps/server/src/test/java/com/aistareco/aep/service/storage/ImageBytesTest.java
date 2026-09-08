package com.aistareco.aep.service.storage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** 图片格式必须按字节判 —— 文件名会骗人（v0.184：JPEG 顶着 .png 被上游拒收）。 */
class ImageBytesTest {

    private static byte[] pad(byte[] head) {
        byte[] out = new byte[Math.max(32, head.length)];
        System.arraycopy(head, 0, out, 0, head.length);
        return out;
    }

    @Test
    @DisplayName("按 magic number 认出常见静态图")
    void sniffsByMagicNumber() {
        assertThat(ImageBytes.sniff(pad(new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A})))
                .isEqualTo(ImageBytes.PNG);
        assertThat(ImageBytes.sniff(pad(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0})))
                .isEqualTo(ImageBytes.JPEG);
        assertThat(ImageBytes.sniff(pad("GIF89a".getBytes()))).isEqualTo(ImageBytes.GIF);
        assertThat(ImageBytes.sniff(pad("BM......".getBytes()))).isEqualTo(ImageBytes.BMP);
        assertThat(ImageBytes.sniff(pad("RIFF____WEBPVP8 ".getBytes()))).isEqualTo(ImageBytes.WEBP);
    }

    @Test
    @DisplayName("认不出就返回 null，不猜")
    void returnsNullForUnknown() {
        assertThat(ImageBytes.sniff(null)).isNull();
        assertThat(ImageBytes.sniff(new byte[]{1, 2, 3})).isNull();
        assertThat(ImageBytes.sniff(pad("ID3 mp3 header".getBytes()))).isNull();
        assertThat(ImageBytes.sniff(pad("RIFF____WAVEfmt ".getBytes()))).isNull();
    }

    @Test
    @DisplayName("mimeOr：认得出用真的，认不出沿用声明值")
    void mimeOrFallsBackToDeclared() {
        byte[] jpeg = pad(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF});
        assertThat(ImageBytes.mimeOr(jpeg, "image/png")).isEqualTo("image/jpeg");
        assertThat(ImageBytes.mimeOr(pad("ID3 mp3 header".getBytes()), "audio/mpeg")).isEqualTo("audio/mpeg");
    }
}
