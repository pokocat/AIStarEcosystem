package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.MediaBytes;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import java.util.zip.CRC32;

/**
 * 给交给聚算的素材换一份「内容不同、画面 / 声音不变」的字节。
 *
 * <p>聚算 {@code /assets/input} 按内容认素材（响应里的 {@code reused}）：一份字节传过、那份素材过期或被删之后，
 * 再传同样的字节一律 409 {@code input_asset_binding_conflict}「reupload does not restore expired or deleted assets」，
 * 永远传不上去。这里只在容器规范允许的位置加一段标记：PNG 的 tEXt 块、JPEG 的注释段、
 * MP4 / MOV / M4A 末尾的 free 盒子、WAV 末尾的自定义块、GIF 的注释扩展、BMP 像素后的尾巴。
 * 这些都做不到的（WebP、MP3、FLAC、OGG、AAC、WebM），{@link #viaFfmpeg} 兜底：
 * 音视频原样重封装（{@code -c copy}）并写一条注释元数据（AAC 装进 M4A）；图片解码后转成 PNG 再打标记。
 * 两条路都走不通才返回 null，由调用方照常报错。
 */
final class InputAssetCopy {

    private InputAssetCopy() {}

    static final String CONFLICT_CODE = "input_asset_binding_conflict";

    static boolean isBindingConflict(int status, String body) {
        return status == 409 && body != null && body.contains(CONFLICT_CODE);
    }

    static byte[] distinct(MediaBytes.Format fmt, byte[] original) {
        if (fmt == null || original == null) return null;
        byte[] mark = ("aistareco:" + UUID.randomUUID()).getBytes(StandardCharsets.US_ASCII);
        return switch (fmt.ext()) {
            case "png" -> png(original, mark);
            case "jpg", "jpeg" -> jpeg(original, mark);
            case "mp4", "mov", "m4a" -> isoBmff(original, mark);
            case "wav" -> wav(original, mark);
            case "gif" -> gif(original, mark);
            case "bmp" -> bmp(original, mark);
            default -> null;
        };
    }

    /** 换出来的新内容；格式可能变了（WebP → PNG），文件名后缀与 Content-Type 要跟着它走。 */
    record Fresh(byte[] bytes, MediaBytes.Format fmt) {}

    private static final MediaBytes.Format PNG = new MediaBytes.Format("png", "image/png");
    private static final long FFMPEG_TIMEOUT_MS = 120_000L;

    /**
     * 字节级打不了标记的格式用 ffmpeg 换一份：音视频不重新编码只重封装，图片转 PNG（像素不变）。
     * 结果必须仍被认成允许的格式、且与原文件不同，否则返回 null。
     */
    static Fresh viaFfmpeg(FfmpegRunner ffmpeg, String mediaType, MediaBytes.Format fmt, Path src,
                           List<String> allowedFormats) throws IOException {
        if (ffmpeg == null || fmt == null) return null;
        // 图片解码后转 PNG；ADTS 的 AAC 没有放元数据的地方（加 ID3 头又会被认成 MP3），不改编码装进 M4A。
        MediaBytes.Format target = "image".equals(mediaType) ? PNG : "aac".equals(fmt.ext()) ? MediaBytes.M4A : fmt;
        if (target != fmt && !MediaBytes.allowed(target, allowedFormats)) return null;
        Path dir = Files.createTempDirectory("aistareco-asset-copy-");
        try {
            Path out = dir.resolve("copy." + target.ext());
            List<String> args = new ArrayList<>(List.of("-v", "error", "-y", "-i", src.toString()));
            if (target == PNG) {
                args.addAll(List.of("-frames:v", "1"));
            } else {
                args.addAll(List.of("-map", "0", "-c", "copy", "-map_metadata", "0",
                        "-metadata", "comment=aistareco:" + UUID.randomUUID()));
                if (target != fmt) args.addAll(List.of("-bsf:a", "aac_adtstoasc"));
            }
            args.add(out.toString());
            ffmpeg.runFfmpeg(args, FFMPEG_TIMEOUT_MS);
            byte[] bytes = Files.readAllBytes(out);
            if (target != fmt) {
                bytes = distinct(target, bytes);
                return bytes == null ? null : new Fresh(bytes, target);
            }
            MediaBytes.Format again = MediaBytes.sniffConfigured(mediaType, Arrays.copyOf(bytes, Math.min(bytes.length, 4096)));
            if (again == null || !again.equals(fmt) || Arrays.equals(bytes, Files.readAllBytes(src))) return null;
            return new Fresh(bytes, fmt);
        } finally {
            try (Stream<Path> walk = Files.walk(dir)) {
                walk.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
            }
        }
    }

    /** 注释扩展（0x21 0xFE）插在结尾符 0x3B 前面。 */
    private static byte[] gif(byte[] b, byte[] mark) {
        if (b.length < 14 || (b[b.length - 1] & 0xFF) != 0x3B || mark.length > 255) return null;
        ByteArrayOutputStream out = new ByteArrayOutputStream(b.length + mark.length + 4);
        out.write(b, 0, b.length - 1);
        out.write(0x21);
        out.write(0xFE);
        out.write(mark.length);
        out.writeBytes(mark);
        out.write(0x00);
        out.write(0x3B);
        return out.toByteArray();
    }

    /** 像素按头里的偏移读，尾巴不影响；文件总长（第 2..5 字节，小端）跟着改。 */
    private static byte[] bmp(byte[] b, byte[] mark) {
        if (b.length < 26 || b[0] != 'B' || b[1] != 'M') return null;
        byte[] r = Arrays.copyOf(b, b.length + mark.length);
        System.arraycopy(mark, 0, r, b.length, mark.length);
        int size = r.length;
        r[2] = (byte) size; r[3] = (byte) (size >>> 8); r[4] = (byte) (size >>> 16); r[5] = (byte) (size >>> 24);
        return r;
    }

    /** tEXt 块插在 IEND 前面。 */
    private static byte[] png(byte[] b, byte[] mark) {
        int iend = b.length - 12;
        if (iend < 8 || b[iend + 4] != 'I' || b[iend + 5] != 'E' || b[iend + 6] != 'N' || b[iend + 7] != 'D') return null;
        byte[] data = new byte[8 + mark.length]; // "Comment\0" + 文本
        System.arraycopy("Comment".getBytes(StandardCharsets.US_ASCII), 0, data, 0, 7);
        System.arraycopy(mark, 0, data, 8, mark.length);
        byte[] type = "tEXt".getBytes(StandardCharsets.US_ASCII);
        CRC32 crc = new CRC32();
        crc.update(type);
        crc.update(data);
        ByteArrayOutputStream out = new ByteArrayOutputStream(b.length + data.length + 12);
        out.write(b, 0, iend);
        writeInt(out, data.length);
        out.writeBytes(type);
        out.writeBytes(data);
        writeInt(out, (int) crc.getValue());
        out.write(b, iend, 12);
        return out.toByteArray();
    }

    /** COM 段紧跟 SOI。 */
    private static byte[] jpeg(byte[] b, byte[] mark) {
        if (b.length < 4 || (b[0] & 0xFF) != 0xFF || (b[1] & 0xFF) != 0xD8) return null;
        ByteArrayOutputStream out = new ByteArrayOutputStream(b.length + mark.length + 4);
        out.write(b, 0, 2);
        out.write(0xFF);
        out.write(0xFE);
        int len = mark.length + 2;
        out.write(len >>> 8);
        out.write(len & 0xFF);
        out.writeBytes(mark);
        out.write(b, 2, b.length - 2);
        return out.toByteArray();
    }

    /** 文件末尾追加一个 free 盒子（播放器按规范跳过）。 */
    private static byte[] isoBmff(byte[] b, byte[] mark) {
        ByteArrayOutputStream out = new ByteArrayOutputStream(b.length + mark.length + 8);
        out.writeBytes(b);
        writeInt(out, mark.length + 8);
        out.writeBytes("free".getBytes(StandardCharsets.US_ASCII));
        out.writeBytes(mark);
        return out.toByteArray();
    }

    /** 末尾追加一个自定义块，并改 RIFF 总长。 */
    private static byte[] wav(byte[] b, byte[] mark) {
        if (b.length < 12 || b[0] != 'R' || b[1] != 'I' || b[2] != 'F' || b[3] != 'F') return null;
        int pad = (b.length & 1) == 1 ? 1 : 0;
        int markPad = mark.length & 1;
        ByteArrayOutputStream out = new ByteArrayOutputStream(b.length + mark.length + 10);
        out.writeBytes(b);
        if (pad == 1) out.write(0);
        out.writeBytes("aist".getBytes(StandardCharsets.US_ASCII));
        writeIntLe(out, mark.length);
        out.writeBytes(mark);
        if (markPad == 1) out.write(0);
        byte[] r = out.toByteArray();
        int riff = r.length - 8;
        r[4] = (byte) riff; r[5] = (byte) (riff >>> 8); r[6] = (byte) (riff >>> 16); r[7] = (byte) (riff >>> 24);
        return r;
    }

    private static void writeInt(ByteArrayOutputStream out, int v) {
        out.write(v >>> 24); out.write(v >>> 16); out.write(v >>> 8); out.write(v);
    }

    private static void writeIntLe(ByteArrayOutputStream out, int v) {
        out.write(v); out.write(v >>> 8); out.write(v >>> 16); out.write(v >>> 24);
    }
}
