package com.aistareco.aep.service.storage;

/**
 * 从**字节本身**认出音视频容器格式（magic number），不看文件名 —— {@link ImageBytes} 的音视频版。
 *
 * <p>同一条教训（§8.0.1 ⑤）：对外声明的类型必须按字节判。文件名会骗人，而把素材转交给厂商时，
 * 对方是按我们声明的 Content-Type 去解码的。视频生成区的上传接口与模型客户端把素材传给聚算时
 * 都用这里，一处判定。
 *
 * <p>只认厂商合同里写了的几种（docs/video-studio-plan.md §2）：
 * <ul>
 *   <li>视频：MP4（ISO BMFF {@code ftyp}，且品牌不是 QuickTime 的 {@code "qt  "}）</li>
 *   <li>音频：WAV / MP3 / FLAC / OGG / AAC（ADTS）/ M4A / MOV（带声音的 QuickTime）</li>
 * </ul>
 * 认不出返回 null，由调用方拒绝 —— 这里不猜。字节只能说明「容器像」，有没有画面 / 声音、
 * 时长多少，要交给 ffprobe 去判。
 */
public final class MediaBytes {

    private MediaBytes() {}

    /** 识别出来的格式。{@code ext} 不带点。 */
    public record Format(String ext, String mime) {}

    public static final Format MP4 = new Format("mp4", "video/mp4");
    public static final Format MOV = new Format("mov", "video/quicktime");
    public static final Format M4A = new Format("m4a", "audio/mp4");
    public static final Format WAV = new Format("wav", "audio/wav");
    public static final Format MP3 = new Format("mp3", "audio/mpeg");
    public static final Format FLAC = new Format("flac", "audio/flac");
    public static final Format OGG = new Format("ogg", "audio/ogg");
    public static final Format AAC = new Format("aac", "audio/aac");

    /** 判断格式至少需要这么多字节。 */
    public static final int SNIFF_BYTES = 12;

    /**
     * 按素材类型判：{@code image} → PNG / JPEG / WEBP（{@link ImageBytes}，GIF / BMP 不收），
     * {@code video} → {@link #sniffVideo}，{@code audio} → {@link #sniffAudio}；其它类型或认不出 → null。
     * 视频生成区的上传接口与模型客户端把素材交给厂商时都走这一个入口，规则只写这一遍。
     */
    public static Format sniff(String mediaType, byte[] b) {
        if ("video".equals(mediaType)) return sniffVideo(b);
        if ("audio".equals(mediaType)) return sniffAudio(b);
        if ("image".equals(mediaType)) {
            ImageBytes.Format f = ImageBytes.sniff(b);
            if (f == ImageBytes.PNG || f == ImageBytes.JPEG || f == ImageBytes.WEBP) return new Format(f.ext(), f.mime());
        }
        return null;
    }

    /** 视频：只认 MP4。MOV（QuickTime）不收 —— 厂商合同里视频只写了 MP4。 */
    public static Format sniffVideo(byte[] b) {
        if (!enough(b)) return null;
        if (isFtyp(b) && !isQuickTimeBrand(b)) return MP4;
        return null;
    }

    /** 音频：WAV / MP3 / FLAC / OGG / AAC(ADTS) / M4A / MOV。 */
    public static Format sniffAudio(byte[] b) {
        if (!enough(b)) return null;
        if (starts(b, 'R', 'I', 'F', 'F') && at(b, 8, 'W', 'A', 'V', 'E')) return WAV;
        if (starts(b, 'f', 'L', 'a', 'C')) return FLAC;
        if (starts(b, 'O', 'g', 'g', 'S')) return OGG;
        if (starts(b, 'I', 'D', '3')) return MP3;
        if (isFtyp(b)) return isQuickTimeBrand(b) ? MOV : M4A;
        if (isClassicQuickTime(b)) return MOV;
        int b0 = b[0] & 0xFF;
        int b1 = b[1] & 0xFF;
        if (b0 == 0xFF) {
            // ADTS：12 位同步字 0xFFF，layer 恒为 00
            if ((b1 & 0xF6) == 0xF0) return AAC;
            // MPEG 音频帧：11 位同步字 0x7FF，版本 ≠ 保留值、layer ≠ 00，码率 / 采样率索引不是非法值
            if ((b1 & 0xE0) == 0xE0 && ((b1 >> 3) & 0x03) != 0x01 && ((b1 >> 1) & 0x03) != 0x00) {
                int b2 = b[2] & 0xFF;
                if ((b2 >> 4) != 0x0F && ((b2 >> 2) & 0x03) != 0x03) return MP3;
            }
        }
        return null;
    }

    /** ISO BMFF：第 4..7 字节是 {@code ftyp}。 */
    private static boolean isFtyp(byte[] b) {
        return at(b, 4, 'f', 't', 'y', 'p');
    }

    /** ftyp 的主品牌（第 8..11 字节）是 QuickTime 的 {@code "qt  "}。 */
    private static boolean isQuickTimeBrand(byte[] b) {
        return at(b, 8, 'q', 't', ' ', ' ');
    }

    /** 老式 QuickTime 文件不以 ftyp 开头，第一个 atom 直接是 moov / mdat / wide / free / skip / pnot。 */
    private static boolean isClassicQuickTime(byte[] b) {
        return at(b, 4, 'm', 'o', 'o', 'v') || at(b, 4, 'm', 'd', 'a', 't') || at(b, 4, 'w', 'i', 'd', 'e')
                || at(b, 4, 'f', 'r', 'e', 'e') || at(b, 4, 's', 'k', 'i', 'p') || at(b, 4, 'p', 'n', 'o', 't');
    }

    private static boolean enough(byte[] b) {
        return b != null && b.length >= SNIFF_BYTES;
    }

    private static boolean starts(byte[] b, int... prefix) {
        return at(b, 0, prefix);
    }

    private static boolean at(byte[] b, int offset, int... expected) {
        if (b.length < offset + expected.length) return false;
        for (int i = 0; i < expected.length; i++) {
            if ((b[offset + i] & 0xFF) != (expected[i] & 0xFF)) return false;
        }
        return true;
    }
}
