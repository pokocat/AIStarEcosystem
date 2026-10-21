package com.aistareco.aep.ipstudio.service;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Path;

/**
 * A first (or last) frame whose shape differs from the clip's 画幅 is cropped around its centre to that 画幅 before it goes
 * to the provider, never stretched (docs/ip-studio-new-canvas-and-threads.md §6.2). Production 2026-10-21, IPP-655ea55a: a
 * 1024×1024 first frame was sent for a 9:16 clip and came back stretched to 768×1344, everything 1.78 times taller.
 *
 * <p>Pure byte work: decide, crop, encode. Storage, ownership and the record of what was changed live in
 * {@link StudioVideoService}.
 */
public final class StudioFrameCrop {
    /** Shapes within this relative difference count as the same 画幅 (the client hint uses the same rule). */
    public static final double TOLERANCE = 0.02;
    private StudioFrameCrop() {}

    /** The requested 画幅 as width / height, or NaN when it is not {@code W:H}. */
    public static double ratio(String aspectRatio) {
        if (aspectRatio == null || !aspectRatio.strip().matches("[1-9][0-9]*:[1-9][0-9]*")) return Double.NaN;
        String[] p = aspectRatio.strip().split(":");
        return Double.parseDouble(p[0]) / Double.parseDouble(p[1]);
    }

    /** True when a {@code width × height} picture is more than {@value #TOLERANCE} away from the requested 画幅. */
    public static boolean needsCrop(int width, int height, String aspectRatio) {
        double target = ratio(aspectRatio);
        if (!Double.isFinite(target) || width <= 0 || height <= 0) return false;
        return Math.abs((double) width / height - target) / target > TOLERANCE;
    }

    /** The centred window of the requested 画幅 inside {@code width × height}: {x, y, w, h}. Keeps the full height or width. */
    public static int[] window(int width, int height, String aspectRatio) {
        double target = ratio(aspectRatio);
        if ((double) width / height > target) {
            int w = Math.max(1, (int) Math.round(height * target));
            return new int[]{(width - w) / 2, 0, w, height};
        }
        int h = Math.max(1, (int) Math.round(width / target));
        return new int[]{0, (height - h) / 2, width, h};
    }

    /** Pixel size from the file header only (no full decode, same reason as the upload check); null when unreadable. */
    public static int[] dimensions(Path file) {
        try (var in = ImageIO.createImageInputStream(file.toFile())) {
            if (in == null) return null;
            var readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) return null;
            var reader = readers.next();
            try {
                reader.setInput(in, true, true);
                int w = reader.getWidth(0), h = reader.getHeight(0);
                return w > 0 && h > 0 ? new int[]{w, h} : null;
            } finally { reader.dispose(); }
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    /** A cropped picture: its bytes, extension and type, and both sizes for the record. */
    public record Cropped(byte[] bytes, String ext, String contentType, int sourceWidth, int sourceHeight, int width, int height) {}

    /**
     * Crop {@code source} (PNG / JPEG / GIF / BMP) to the requested 画幅 around its centre. A picture with transparency stays
     * PNG, everything else is written as JPEG at quality 0.95. Throws {@link IOException} when the bytes cannot be decoded.
     */
    public static Cropped crop(byte[] source, String aspectRatio) throws IOException {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(source));
        if (image == null) throw new IOException("unsupported image");
        int[] win = window(image.getWidth(), image.getHeight(), aspectRatio);
        BufferedImage part = image.getSubimage(win[0], win[1], win[2], win[3]);
        boolean alpha = image.getColorModel().hasAlpha();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (alpha) {
            BufferedImage copy = new BufferedImage(win[2], win[3], BufferedImage.TYPE_INT_ARGB);
            copy.getGraphics().drawImage(part, 0, 0, null);
            if (!ImageIO.write(copy, "png", out)) throw new IOException("png writer unavailable");
            return new Cropped(out.toByteArray(), "png", "image/png", image.getWidth(), image.getHeight(), win[2], win[3]);
        }
        BufferedImage rgb = new BufferedImage(win[2], win[3], BufferedImage.TYPE_INT_RGB);
        rgb.getGraphics().drawImage(part, 0, 0, null);
        var writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (var ios = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(ios);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(0.95f);
            writer.write(null, new IIOImage(rgb, null, null), param);
        } finally { writer.dispose(); }
        return new Cropped(out.toByteArray(), "jpg", "image/jpeg", image.getWidth(), image.getHeight(), win[2], win[3]);
    }
}
