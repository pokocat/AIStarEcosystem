package com.aistareco.aep.service.storage;

/**
 * 从**字节本身**认出图片格式（magic number），不看文件名。
 *
 * <p>为什么需要：调用方常常把上游返回的图一律当 PNG 存（{@code store(bytes, …, "png", "image/png")}），
 * 而厂商实际给的可能是 JPEG。存的时候没人发现 —— 浏览器会自己嗅探，图照样显示；
 * 直到我们**把这张图转交给另一个厂商**、并按文件名声明 {@code Content-Type: image/png} 时才炸：
 * 对方按我们说的类型去解码，解不出来，回一句 {@code input image cannot be decoded}（v0.184 实测）。
 *
 * <p>只认「能进 multipart / OSS Content-Type 的静态图」这几种；认不出返回 null，
 * 由调用方决定是拒绝还是沿用声明值 —— 这里不猜。
 */
public final class ImageBytes {

    private ImageBytes() {}

    /** 识别出来的图片格式。{@code ext} 不带点。 */
    public record Format(String ext, String mime) {}

    public static final Format PNG = new Format("png", "image/png");
    public static final Format JPEG = new Format("jpg", "image/jpeg");
    public static final Format WEBP = new Format("webp", "image/webp");
    public static final Format GIF = new Format("gif", "image/gif");
    public static final Format BMP = new Format("bmp", "image/bmp");

    /** 认不出来返回 null（不是图片、或不是这几种）。 */
    public static Format sniff(byte[] b) {
        if (b == null || b.length < 12) return null;
        if (starts(b, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return PNG;
        if (starts(b, 0xFF, 0xD8, 0xFF)) return JPEG;
        if (starts(b, 'G', 'I', 'F', '8')) return GIF;
        if (starts(b, 'B', 'M')) return BMP;
        // WebP = RIFF 容器，第 8..11 字节是 "WEBP"
        if (starts(b, 'R', 'I', 'F', 'F')
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return WEBP;
        return null;
    }

    /** 字节认得出就用真的；认不出沿用声明值（可能是音视频等非图片内容，这里不干预）。 */
    public static String mimeOr(byte[] b, String declared) {
        Format f = sniff(b);
        return f == null ? declared : f.mime();
    }

    private static boolean starts(byte[] b, int... prefix) {
        if (b.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if ((b[i] & 0xFF) != (prefix[i] & 0xFF)) return false;
        }
        return true;
    }
}
