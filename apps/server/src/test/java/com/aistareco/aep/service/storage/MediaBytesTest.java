package com.aistareco.aep.service.storage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/** 音视频格式必须按字节判（§8.0.1 ⑤）。字节头是手拼的，只覆盖判定用到的那几位。 */
class MediaBytesTest {

    private static byte[] pad(byte[] head) {
        byte[] out = new byte[Math.max(32, head.length)];
        System.arraycopy(head, 0, out, 0, head.length);
        return out;
    }

    private static byte[] ascii(String s) {
        return pad(s.getBytes(StandardCharsets.ISO_8859_1));
    }

    /** ISO BMFF 开头：4 字节 box 长度 + "ftyp" + 4 字节主品牌。 */
    private static byte[] ftyp(String brand) {
        byte[] b = pad(new byte[0]);
        b[3] = 0x20;
        System.arraycopy("ftyp".getBytes(StandardCharsets.ISO_8859_1), 0, b, 4, 4);
        System.arraycopy(brand.getBytes(StandardCharsets.ISO_8859_1), 0, b, 8, 4);
        return b;
    }

    private static byte[] bytes(int... v) {
        byte[] b = new byte[v.length];
        for (int i = 0; i < v.length; i++) b[i] = (byte) v[i];
        return pad(b);
    }

    @Test
    @DisplayName("视频只认 MP4：ISO BMFF 且品牌不是 QuickTime")
    void videoIsMp4Only() {
        assertThat(MediaBytes.sniffVideo(ftyp("isom"))).isEqualTo(MediaBytes.MP4);
        assertThat(MediaBytes.sniffVideo(ftyp("mp42"))).isEqualTo(MediaBytes.MP4);
        assertThat(MediaBytes.sniffVideo(ftyp("qt  "))).isNull();          // MOV 不收
        assertThat(MediaBytes.sniffVideo(ascii("RIFF____AVI LIST"))).isNull();
        assertThat(MediaBytes.sniffVideo(bytes(0x1A, 0x45, 0xDF, 0xA3))).isNull(); // WebM / MKV
    }

    @Test
    @DisplayName("音频：WAV / MP3（ID3 与裸帧）/ FLAC / OGG / AAC(ADTS) / M4A / MOV")
    void audioFormats() {
        assertThat(MediaBytes.sniffAudio(ascii("RIFF____WAVEfmt "))).isEqualTo(MediaBytes.WAV);
        assertThat(MediaBytes.sniffAudio(ascii("ID3\u0004\u0000"))).isEqualTo(MediaBytes.MP3);
        assertThat(MediaBytes.sniffAudio(bytes(0xFF, 0xFB, 0x90, 0x64))).isEqualTo(MediaBytes.MP3); // MPEG-1 Layer III
        assertThat(MediaBytes.sniffAudio(ascii("fLaC\u0000\u0000\u0000\""))).isEqualTo(MediaBytes.FLAC);
        assertThat(MediaBytes.sniffAudio(ascii("OggS\u0000\u0002"))).isEqualTo(MediaBytes.OGG);
        assertThat(MediaBytes.sniffAudio(bytes(0xFF, 0xF1, 0x50, 0x80))).isEqualTo(MediaBytes.AAC);   // ADTS MPEG-4
        assertThat(MediaBytes.sniffAudio(bytes(0xFF, 0xF9, 0x50, 0x80))).isEqualTo(MediaBytes.AAC);   // ADTS MPEG-2
        assertThat(MediaBytes.sniffAudio(ftyp("M4A "))).isEqualTo(MediaBytes.M4A);
        assertThat(MediaBytes.sniffAudio(ftyp("isom"))).isEqualTo(MediaBytes.M4A);
        assertThat(MediaBytes.sniffAudio(ftyp("qt  "))).isEqualTo(MediaBytes.MOV);
        byte[] classicMov = pad(new byte[0]);
        System.arraycopy("moov".getBytes(StandardCharsets.ISO_8859_1), 0, classicMov, 4, 4);
        assertThat(MediaBytes.sniffAudio(classicMov)).isEqualTo(MediaBytes.MOV);
    }

    @Test
    @DisplayName("认不出就返回 null：图片、非法帧头、太短、空")
    void unknownIsNull() {
        assertThat(MediaBytes.sniffAudio(bytes(0xFF, 0xD8, 0xFF, 0xE0))).isNull();  // JPEG 不是 MP3 帧
        assertThat(MediaBytes.sniffAudio(bytes(0xFF, 0xFB, 0xF0, 0x00))).isNull();  // 码率索引 1111 非法
        assertThat(MediaBytes.sniffAudio(bytes(0xFF, 0xEB, 0x90, 0x00))).isNull();  // MPEG 版本 = 保留值
        assertThat(MediaBytes.sniffAudio(ascii("RIFF____WEBPVP8 "))).isNull();       // WebP 不是 WAV
        assertThat(MediaBytes.sniffAudio(new byte[]{'O', 'g', 'g'})).isNull();
        assertThat(MediaBytes.sniffAudio(null)).isNull();
        assertThat(MediaBytes.sniffVideo(null)).isNull();
    }

    @Test
    @DisplayName("按素材类型判：图片只收 PNG / JPEG / WEBP，GIF 不收；类型不认识 → null")
    void sniffByMediaType() {
        byte[] png = bytes(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A);
        assertThat(MediaBytes.sniff("image", png)).isEqualTo(new MediaBytes.Format("png", "image/png"));
        assertThat(MediaBytes.sniff("image", bytes(0xFF, 0xD8, 0xFF, 0xE0))).isEqualTo(new MediaBytes.Format("jpg", "image/jpeg"));
        assertThat(MediaBytes.sniff("image", ascii("RIFF____WEBPVP8 "))).isEqualTo(new MediaBytes.Format("webp", "image/webp"));
        assertThat(MediaBytes.sniff("image", ascii("GIF89a"))).isNull();
        assertThat(MediaBytes.sniff("video", ftyp("isom"))).isEqualTo(MediaBytes.MP4);
        assertThat(MediaBytes.sniff("audio", ascii("fLaC\u0000"))).isEqualTo(MediaBytes.FLAC);
        assertThat(MediaBytes.sniff("audio", png)).isNull();
        assertThat(MediaBytes.sniff("document", png)).isNull();
    }
}
