package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.service.storage.MediaBytes;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.zip.CRC32;

/**
 * 给交给聚算的素材换一份「内容不同、画面 / 声音不变」的字节。
 *
 * <p>聚算 {@code /assets/input} 按内容认素材（响应里的 {@code reused}）：一份字节传过、那份素材过期或被删之后，
 * 再传同样的字节一律 409 {@code input_asset_binding_conflict}「reupload does not restore expired or deleted assets」，
 * 永远传不上去。这里只在容器规范允许的位置加一段标记：PNG 的 tEXt 块、JPEG 的注释段、
 * MP4 / MOV / M4A 末尾的 free 盒子、WAV 末尾的自定义块。其它格式返回 null，由调用方照常报错，不猜。
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
            default -> null;
        };
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
