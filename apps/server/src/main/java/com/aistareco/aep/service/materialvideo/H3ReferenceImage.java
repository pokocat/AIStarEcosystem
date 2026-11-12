package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.MediaBytes;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.imageio.ImageIO;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/** Prepares a temporary upload copy for H3's universal-reference image role. */
final class H3ReferenceImage {
    private static final Logger log = LoggerFactory.getLogger(H3ReferenceImage.class);
    static final int MAX_EDGE = 5760;
    static final String INVALID_SIZE = "VIDEO_REF_IMAGE_SIZE_INVALID";
    private static final long MAX_RESIZE_SOURCE_PIXELS = 64_000_000;
    private static final MediaBytes.Format PNG = new MediaBytes.Format("png", "image/png");
    private static final MediaBytes.Format JPEG = new MediaBytes.Format("jpg", "image/jpeg");

    private H3ReferenceImage() {}

    record Resized(Path path, long size, MediaBytes.Format format) implements AutoCloseable {
        @Override public void close() { delete(path); }
    }

    /** Return null for an image already within the limit, so it goes upstream byte for byte. */
    static Resized resizeIfNeeded(FfmpegRunner ffmpeg, Path source, MediaBytes.Format format,
                                  long maxBytes, List<String> formats, String label) {
        Path copy = null;
        try {
            var size = dimensions(ffmpeg, source, format);
            if (size.longEdge() <= MAX_EDGE) return null;
            var target = JPEG.equals(format) ? JPEG : PNG;
            if (size.pixels() > MAX_RESIZE_SOURCE_PIXELS || !MediaBytes.allowed(target, formats))
                throw sizeInvalid(label);

            copy = Files.createTempFile("h3-reference-image-", "." + target.ext());
            ffmpeg.runFfmpeg(List.of("-v", "error", "-nostdin", "-y", "-threads", "1", "-i", source.toString(),
                    "-filter_threads", "1", "-vf", "scale=" + MAX_EDGE + ":" + MAX_EDGE + ":force_original_aspect_ratio=decrease,setsar=1",
                    "-frames:v", "1", "-threads", "1", "-q:v", "2", "-update", "1", copy.toString()), 30_000L);
            long bytes = Files.size(copy);
            if (bytes == 0 || bytes > maxBytes || dimensions(ffmpeg, copy, target).longEdge() > MAX_EDGE)
                throw sizeInvalid(label);
            log.info("[material-video] H3 reference image resized label={} width={} height={}", label, size.width(), size.height());
            Resized resized = new Resized(copy, bytes, target);
            copy = null; // The caller owns the copy until the upload (including any binding-conflict retry) finishes.
            return resized;
        } catch (BusinessException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            log.warn("[material-video] H3 reference image could not be prepared label={} reason={}", label, e.getClass().getSimpleName());
            throw BusinessException.badRequest(INVALID_SIZE, label + "无法处理，请换一张可打开且长边不超过 " + MAX_EDGE + " 像素的图片");
        } finally {
            if (copy != null) delete(copy);
        }
    }

    private static BusinessException sizeInvalid(String label) {
        return BusinessException.badRequest(INVALID_SIZE, label + "长边超过 " + MAX_EDGE + " 像素，请缩小图片后再试");
    }

    private static Dimensions dimensions(FfmpegRunner ffmpeg, Path file, MediaBytes.Format format) throws IOException {
        // The JDK has no WebP reader; use the media probe already used by the video upload endpoint.
        if ("webp".equals(format.ext())) {
            var probe = ffmpeg.probeMedia(file.toFile());
            return new Dimensions(probe.width(), probe.height());
        }
        try (var input = ImageIO.createImageInputStream(file.toFile())) {
            if (input == null) throw new IOException("image input unavailable");
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new IOException("unsupported image");
            var reader = readers.next();
            try {
                reader.setInput(input, true, true);
                return new Dimensions(reader.getWidth(0), reader.getHeight(0));
            } finally {
                reader.dispose();
            }
        }
    }

    private record Dimensions(int width, int height) {
        Dimensions {
            if (width < 1 || height < 1) throw new IllegalArgumentException("missing image dimensions");
        }
        int longEdge() { return Math.max(width, height); }
        long pixels() { return (long) width * height; }
    }

    private static void delete(Path copy) {
        try { Files.deleteIfExists(copy); }
        catch (IOException e) { log.warn("[material-video] could not delete temporary H3 reference image"); }
    }
}
