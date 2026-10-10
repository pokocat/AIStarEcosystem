package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.EncryptedDocumentException;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.StringWriter;
import java.util.Locale;
import java.util.zip.ZipInputStream;

/** Free, stateless text extraction. The canvas owns the resulting editable text. */
@Service
public class StudioStoryImportService {
    public static final int MAX_BYTES = 8 * 1024 * 1024;
    public static final int MAX_TEXT = 24000;
    public record StoryImportResult(String text, String format) {}

    public StoryImportResult extract(MultipartFile file) {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String format = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        if (!java.util.Set.of("pdf", "doc", "docx").contains(format))
            throw invalid("请选择 PDF 或 Word（DOC / DOCX）故事文件");
        if (file.isEmpty()) throw invalid("文件没有可用的文字内容");
        if (file.getSize() > MAX_BYTES) throw invalid("PDF / Word 文件最多 8 MB，请按章节拆分");
        try {
            byte[] data;
            try (var input = file.getInputStream()) { data = input.readNBytes(MAX_BYTES + 1); }
            if (data.length > MAX_BYTES) throw invalid("PDF / Word 文件最多 8 MB，请按章节拆分");
            String text;
            if (format.equals("pdf")) {
                try (var document = Loader.loadPDF(data)) {
                    if (!document.getCurrentAccessPermission().canExtractContent())
                        throw invalid("这个 PDF 限制文字提取，请使用允许复制文字的版本");
                    if (document.getNumberOfPages() > 100)
                        throw invalid("单份 PDF 最多 100 页，请按章节拆分");
                    var writer = new StringWriter() {
                        @Override public void write(String value) {
                            if (getBuffer().length() + value.length() > MAX_TEXT + 1024) throw tooLong();
                            super.write(value);
                        }
                    };
                    new PDFTextStripper().writeText(document, writer);
                    text = writer.toString();
                }
            } else if (format.equals("docx")) {
                // Bound the expanded package before constructing the Word document.
                checkWordPackage(data);
                try (var document = new XWPFDocument(new ByteArrayInputStream(data));
                     var extractor = new XWPFWordExtractor(document)) { text = extractor.getText(); }
            } else {
                try (var extractor = new WordExtractor(new ByteArrayInputStream(data))) { text = extractor.getText(); }
            }
            text = text.replace("\r\n", "\n").replace('\r', '\n').replace('\f', '\n')
                    .replaceAll("[\\x00-\\x08\\x0B\\x0E-\\x1F]", "").strip();
            if (text.isEmpty()) throw invalid(format.equals("pdf")
                    ? "这个 PDF 没有可读取的文字，扫描件请先识别文字，或粘贴故事正文"
                    : "文件没有可用的文字内容，请检查正文或粘贴故事内容");
            if (text.length() > MAX_TEXT) throw tooLong();
            return new StoryImportResult(text, format);
        } catch (BusinessException e) { throw e;
        } catch (InvalidPasswordException | EncryptedDocumentException e) {
            throw invalid("文件受密码保护，请导出无密码版本后再添加");
        } catch (IOException | RuntimeException e) {
            throw invalid("无法读取这个文件，请检查文件是否损坏，或导出为 TXT 后再添加");
        }
    }

    private void checkWordPackage(byte[] data) throws IOException {
        long expanded = 0;
        int entries = 0;
        byte[] buffer = new byte[8192];
        try (var zip = new ZipInputStream(new ByteArrayInputStream(data))) {
            while (zip.getNextEntry() != null) {
                if (++entries > 512) throw invalid("这个 Word 文件内容过多，请按章节拆分");
                int read;
                while ((read = zip.read(buffer)) != -1) {
                    expanded += read;
                    if (expanded > 32L * 1024 * 1024) throw invalid("这个 Word 文件内容过多，请按章节拆分");
                }
            }
        }
    }
    private static BusinessException tooLong() { return invalid("单份故事最多 24000 字，请按章节拆分"); }
    private static BusinessException invalid(String message) { return BusinessException.badRequest("STUDIO_STORY_INVALID", message); }
}
