package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.EncryptedDocumentException;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.sl.extractor.SlideShowExtractor;
import org.apache.poi.sl.usermodel.SlideShowFactory;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.StringWriter;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import javax.swing.text.rtf.RTFEditorKit;
import java.util.zip.ZipInputStream;

/** Free, stateless text extraction. The caller previews and saves the resulting editable text. */
@Service
public class StudioStoryImportService {
    public static final int MAX_BYTES = 8 * 1024 * 1024;
    public static final int MAX_TEXT = 24000;
    public static final int MAX_SCRIPT_TEXT = 60000;
    private static final Set<String> PLAIN_TEXT = Set.of("txt", "md", "markdown", "csv", "tsv", "json", "xml", "yaml", "yml", "log", "srt", "vtt");
    private static final Set<String> SCRIPT_DOCUMENTS = Set.of("pdf", "doc", "docx", "ppt", "pptx", "rtf");
    public record StoryImportResult(String text, String format) {}

    public StoryImportResult extract(MultipartFile file) {
        return extract(file, MAX_TEXT, false);
    }

    /** Director import has its own 60k limit; the canvas story endpoint keeps its existing contract. */
    public StoryImportResult extractScript(MultipartFile file) {
        return extract(file, MAX_SCRIPT_TEXT, true);
    }

    private StoryImportResult extract(MultipartFile file, int maxText, boolean script) {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String format = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        if (!(script ? SCRIPT_DOCUMENTS.contains(format) || PLAIN_TEXT.contains(format) : Set.of("pdf", "doc", "docx").contains(format)))
            throw invalid(script ? "请选择 TXT、Markdown、Word、PPT、PDF、RTF 或常见文本文件" : "请选择 PDF 或 Word（DOC / DOCX）故事文件");
        if (file.isEmpty()) throw invalid("文件没有可用的文字内容");
        if (file.getSize() > MAX_BYTES) throw invalid("文件最多 8 MB，请按章节拆分");
        try {
            byte[] data;
            try (var input = file.getInputStream()) { data = input.readNBytes(MAX_BYTES + 1); }
            if (data.length > MAX_BYTES) throw invalid("文件最多 8 MB，请按章节拆分");
            String text;
            if (format.equals("pdf")) {
                try (var document = Loader.loadPDF(data)) {
                    if (!document.getCurrentAccessPermission().canExtractContent())
                        throw invalid("这个 PDF 限制文字提取，请使用允许复制文字的版本");
                    if (document.getNumberOfPages() > 100)
                        throw invalid("单份 PDF 最多 100 页，请按章节拆分");
                    var writer = new StringWriter() {
                        @Override public void write(String value) {
                            if (getBuffer().length() + value.length() > maxText + 1024) throw tooLong(maxText);
                            super.write(value);
                        }
                    };
                    new PDFTextStripper().writeText(document, writer);
                    text = writer.toString();
                }
            } else if (format.equals("docx")) {
                // Bound the expanded package before constructing the Word document.
                checkOfficePackage(data);
                try (var document = new XWPFDocument(new ByteArrayInputStream(data));
                     var extractor = new XWPFWordExtractor(document)) { text = extractor.getText(); }
            } else if (format.equals("doc")) {
                try (var extractor = new WordExtractor(new ByteArrayInputStream(data))) { text = extractor.getText(); }
            } else if (format.equals("ppt") || format.equals("pptx")) {
                // Inspect the package even if an OOXML presentation was named .ppt.
                checkOfficePackage(data);
                try (var slideshow = SlideShowFactory.create(new ByteArrayInputStream(data));
                     var extractor = new SlideShowExtractor<>(slideshow)) {
                    if (slideshow.getSlides().size() > 100) throw invalid("单份 PPT 最多 100 页，请按章节拆分");
                    extractor.setNotesByDefault(true);
                    text = extractor.getText();
                }
            } else if (format.equals("rtf")) {
                if (!new String(data, 0, Math.min(data.length, 5), StandardCharsets.US_ASCII).equals("{\\rtf"))
                    throw invalid("无法读取这个 RTF，请检查文件格式");
                var kit = new RTFEditorKit();
                var document = kit.createDefaultDocument();
                kit.read(new ByteArrayInputStream(data), document, 0);
                text = document.getText(0, document.getLength());
            } else {
                text = decodeText(data);
            }
            text = text.replace("\r\n", "\n").replace('\r', '\n').replace('\f', '\n')
                    .replaceAll("[\\x00-\\x08\\x0B\\x0E-\\x1F]", "").strip();
            if (text.isEmpty()) throw invalid(format.equals("pdf")
                    ? "这个 PDF 没有可读取的文字，扫描件请先识别文字，或粘贴故事正文"
                    : "文件没有可用的文字内容，请检查正文或粘贴故事内容");
            if (text.length() > maxText) throw tooLong(maxText);
            return new StoryImportResult(text, format);
        } catch (BusinessException e) { throw e;
        } catch (InvalidPasswordException | EncryptedDocumentException e) {
            throw invalid("文件受密码保护，请导出无密码版本后再添加");
        } catch (IOException | javax.swing.text.BadLocationException | RuntimeException e) {
            throw invalid("无法读取这个文件，请检查文件是否损坏，或导出为 TXT 后再添加");
        }
    }

    private void checkOfficePackage(byte[] data) throws IOException {
        long expanded = 0;
        int entries = 0;
        byte[] buffer = new byte[8192];
        try (var zip = new ZipInputStream(new ByteArrayInputStream(data))) {
            while (zip.getNextEntry() != null) {
                if (++entries > 512) throw invalid("这个文档内容过多，请按章节拆分");
                int read;
                while ((read = zip.read(buffer)) != -1) {
                    expanded += read;
                    if (expanded > 32L * 1024 * 1024) throw invalid("这个文档内容过多，请按章节拆分");
                }
            }
        }
    }
    private static BusinessException tooLong(int maxText) {
        return invalid("单份" + (maxText == MAX_TEXT ? "故事" : "剧本") + "最多 " + maxText + " 字，请按章节拆分；未截断正文");
    }

    private static String decodeText(byte[] data) throws CharacterCodingException {
        String text;
        if (data.length >= 4 && data[0] == (byte) 0xff && data[1] == (byte) 0xfe && data[2] == 0 && data[3] == 0)
            text = decode(data, 4, Charset.forName("UTF-32LE"));
        else if (data.length >= 4 && data[0] == 0 && data[1] == 0 && data[2] == (byte) 0xfe && data[3] == (byte) 0xff)
            text = decode(data, 4, Charset.forName("UTF-32BE"));
        else if (data.length >= 2 && data[0] == (byte) 0xff && data[1] == (byte) 0xfe)
            text = decode(data, 2, StandardCharsets.UTF_16LE);
        else if (data.length >= 2 && data[0] == (byte) 0xfe && data[1] == (byte) 0xff)
            text = decode(data, 2, StandardCharsets.UTF_16BE);
        else {
            int offset = data.length >= 3 && data[0] == (byte) 0xef && data[1] == (byte) 0xbb && data[2] == (byte) 0xbf ? 3 : 0;
            try { text = decode(data, offset, StandardCharsets.UTF_8); }
            catch (CharacterCodingException e) { text = decode(data, offset, Charset.forName("GB18030")); }
        }
        // Do not turn disguised binary files into apparently successful but incomplete script text.
        if (text.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t' && c != '\f'))
            throw invalid("文件包含无法读取的字符，请导出为 UTF-8 TXT 后再上传");
        return text;
    }

    private static String decode(byte[] data, int offset, Charset charset) throws CharacterCodingException {
        return charset.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(data, offset, data.length - offset)).toString();
    }
    private static BusinessException invalid(String message) { return BusinessException.badRequest("STUDIO_STORY_INVALID", message); }
}
