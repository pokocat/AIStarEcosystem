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
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.jsoup.select.NodeTraversor;
import org.jsoup.select.NodeVisitor;
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
    /** 导演台剧本文件（含 HTML 导出的整页、带图的 Word）按 50 MB 收；画布故事导入仍是 8 MB。 */
    public static final int MAX_SCRIPT_BYTES = 50 * 1024 * 1024;
    public static final int MAX_TEXT = 24000;
    /** 导演台剧本不限正文长度（2026-10-29 取消 6 万字）：只受 50 MB 文件上限约束，提取多少交回多少，不截断。 */
    public static final int UNLIMITED = 0;
    private static final Set<String> PLAIN_TEXT = Set.of("txt", "md", "markdown", "csv", "tsv", "json", "xml", "yaml", "yml", "log", "srt", "vtt");
    private static final Set<String> SCRIPT_DOCUMENTS = Set.of("pdf", "doc", "docx", "ppt", "pptx", "rtf", "html", "htm");
    /** 这些元素里的内容不是给人读的正文：脚本、样式、嵌入对象、表单控件和模板。 */
    private static final String HTML_NOT_TEXT = "script, style, noscript, template, iframe, frame, frameset, object, embed, applet, "
            + "svg, math, canvas, video, audio, picture, img, map, button, select, input, textarea, datalist, dialog, head";
    private static final Set<String> HTML_HEADINGS = Set.of("h1", "h2", "h3", "h4", "h5", "h6");
    private static final Set<String> HTML_BLOCKS = Set.of("p", "div", "section", "article", "main", "header", "footer", "aside", "nav",
            "blockquote", "pre", "ul", "ol", "li", "dl", "dt", "dd", "table", "thead", "tbody", "tfoot", "tr", "caption",
            "figure", "figcaption", "address", "hr", "center", "details", "summary", "body", "html");
    public record StoryImportResult(String text, String format) {}

    public StoryImportResult extract(MultipartFile file) {
        return extract(file, MAX_TEXT, false);
    }

    /** Director import has no text limit (only the 50 MB file cap); the canvas story endpoint keeps its 24k contract. */
    public StoryImportResult extractScript(MultipartFile file) {
        return extract(file, UNLIMITED, true);
    }

    private StoryImportResult extract(MultipartFile file, int maxText, boolean script) {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String format = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        if (!(script ? SCRIPT_DOCUMENTS.contains(format) || PLAIN_TEXT.contains(format) : Set.of("pdf", "doc", "docx").contains(format)))
            throw invalid(script ? "请选择 TXT、Markdown、Word、PPT、PDF、RTF、HTML 或常见文本文件" : "请选择 PDF 或 Word（DOC / DOCX）故事文件");
        if (file.isEmpty()) throw invalid("文件没有可用的文字内容");
        int maxBytes = script ? MAX_SCRIPT_BYTES : MAX_BYTES;
        String sizeError = "文件最多 " + (maxBytes / 1024 / 1024) + " MB，请按章节拆分";
        if (file.getSize() > maxBytes) throw invalid(sizeError);
        try {
            byte[] data;
            try (var input = file.getInputStream()) { data = input.readNBytes(maxBytes + 1); }
            if (data.length > maxBytes) throw invalid(sizeError);
            // 带图的 Word / PPT 解包后会比文件本身大；剧本文件放宽到 256 MB，仍挡住压缩炸弹。
            long expandedMax = script ? 256L * 1024 * 1024 : 32L * 1024 * 1024;
            String text;
            if (format.equals("pdf")) {
                try (var document = Loader.loadPDF(data)) {
                    if (!document.getCurrentAccessPermission().canExtractContent())
                        throw invalid("这个 PDF 限制文字提取，请使用允许复制文字的版本");
                    if (document.getNumberOfPages() > 100)
                        throw invalid("单份 PDF 最多 100 页，请按章节拆分");
                    var writer = new StringWriter() {
                        @Override public void write(String value) {
                            if (maxText != UNLIMITED && getBuffer().length() + value.length() > maxText + 1024) throw tooLong(maxText);
                            super.write(value);
                        }
                    };
                    new PDFTextStripper().writeText(document, writer);
                    text = writer.toString();
                }
            } else if (format.equals("docx")) {
                // Bound the expanded package before constructing the Word document.
                checkOfficePackage(data, expandedMax);
                try (var document = new XWPFDocument(new ByteArrayInputStream(data));
                     var extractor = new XWPFWordExtractor(document)) { text = extractor.getText(); }
            } else if (format.equals("doc")) {
                try (var extractor = new WordExtractor(new ByteArrayInputStream(data))) { text = extractor.getText(); }
            } else if (format.equals("ppt") || format.equals("pptx")) {
                // Inspect the package even if an OOXML presentation was named .ppt.
                checkOfficePackage(data, expandedMax);
                try (var slideshow = SlideShowFactory.create(new ByteArrayInputStream(data));
                     var extractor = new SlideShowExtractor<>(slideshow)) {
                    if (slideshow.getSlides().size() > 100) throw invalid("单份 PPT 最多 100 页，请按章节拆分");
                    extractor.setNotesByDefault(true);
                    text = extractor.getText();
                }
            } else if (format.equals("html") || format.equals("htm")) {
                text = htmlText(data, maxText);
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
            if (maxText != UNLIMITED && text.length() > maxText) throw tooLong(maxText);
            return new StoryImportResult(text, format);
        } catch (BusinessException e) { throw e;
        } catch (InvalidPasswordException | EncryptedDocumentException e) {
            throw invalid("文件受密码保护，请导出无密码版本后再添加");
        } catch (IOException | javax.swing.text.BadLocationException | RuntimeException e) {
            throw invalid("无法读取这个文件，请检查文件是否损坏，或导出为 TXT 后再添加");
        }
    }

    /**
     * HTML 只取给人读的正文：脚本、样式、隐藏元素和标签本身都不进正文，也不执行任何东西（jsoup 只解析）。
     * 标题、段落、列表项、表格行各占一行，标题前后空一行；{@code <pre>} 保留原有换行。有字数上限（画布故事）时超过立刻报错，不截断。
     */
    static String htmlText(byte[] data, int maxText) throws IOException {
        Document doc = Jsoup.parse(new ByteArrayInputStream(data), null, "");
        // 没有 BOM、没写 charset 且不是合法 UTF-8 的，多半是 GBK 存的网页：按 GB18030 重读，不出乱码。
        if (!declaresCharset(doc, data) && !validUtf8(data))
            doc = Jsoup.parse(new String(data, Charset.forName("GB18030")));
        String title = doc.title().strip();
        doc.select(HTML_NOT_TEXT).remove();
        doc.select("[hidden], [aria-hidden=true]").remove();
        doc.select("[style~=(?i)(display\\s*:\\s*none|visibility\\s*:\\s*hidden)]").remove();
        var out = new StringBuilder();
        long limit = maxText == UNLIMITED ? Long.MAX_VALUE : maxText + 1024L;
        NodeTraversor.traverse(new NodeVisitor() {
            int preDepth;
            @Override public void head(Node node, int depth) {
                if (node instanceof TextNode t) {
                    boolean pre = preDepth > 0;
                    String value = pre ? t.getWholeText() : t.getWholeText().replaceAll("[\\s\\u00a0]+", " ");
                    if (!pre && (out.isEmpty() || out.charAt(out.length() - 1) == '\n')) value = value.stripLeading();
                    out.append(value);
                } else if (node instanceof Element e) {
                    String tag = e.normalName();
                    if (tag.equals("pre")) preDepth++;
                    if (tag.equals("br")) out.append('\n');
                    else if (HTML_HEADINGS.contains(tag)) blankLine(out);
                    else if (HTML_BLOCKS.contains(tag)) newLine(out);
                    else if ((tag.equals("td") || tag.equals("th")) && e.elementSiblingIndex() > 0) out.append('\t');
                }
                if (out.length() > limit) throw tooLong(maxText);
            }
            @Override public void tail(Node node, int depth) {
                if (node instanceof Element e) {
                    if (e.normalName().equals("pre")) preDepth--;
                    if (HTML_HEADINGS.contains(e.normalName())) blankLine(out);
                    else if (HTML_BLOCKS.contains(e.normalName())) newLine(out);
                }
            }
        }, doc);
        String body = out.toString().lines().map(l -> l.replaceAll("[ \\t]+$", "")).collect(java.util.stream.Collectors.joining("\n"))
                .replaceAll("\n{3,}", "\n\n").strip();
        // <title> 往往就是剧名；正文开头没有它才补在最前面，避免重复。
        if (!title.isEmpty() && !body.substring(0, Math.min(body.length(), 200)).contains(title)) body = body.isEmpty() ? title : title + "\n\n" + body;
        return body;
    }

    private static void newLine(StringBuilder out) {
        if (!out.isEmpty() && out.charAt(out.length() - 1) != '\n') out.append('\n');
    }

    private static void blankLine(StringBuilder out) {
        newLine(out);
        if (out.length() >= 2 && out.charAt(out.length() - 2) != '\n') out.append('\n');
    }

    private static boolean declaresCharset(Document doc, byte[] data) {
        if (data.length >= 2 && ((data[0] == (byte) 0xff && data[1] == (byte) 0xfe) || (data[0] == (byte) 0xfe && data[1] == (byte) 0xff))) return true;
        if (data.length >= 3 && data[0] == (byte) 0xef && data[1] == (byte) 0xbb && data[2] == (byte) 0xbf) return true;
        return !doc.select("meta[charset], meta[http-equiv~=(?i)content-type][content~=(?i)charset]").isEmpty();
    }

    private static boolean validUtf8(byte[] data) {
        try { decode(data, 0, StandardCharsets.UTF_8); return true; } catch (CharacterCodingException e) { return false; }
    }

    private void checkOfficePackage(byte[] data, long expandedMax) throws IOException {
        long expanded = 0;
        int entries = 0;
        byte[] buffer = new byte[8192];
        try (var zip = new ZipInputStream(new ByteArrayInputStream(data))) {
            while (zip.getNextEntry() != null) {
                if (++entries > 512) throw invalid("这个文档内容过多，请按章节拆分");
                int read;
                while ((read = zip.read(buffer)) != -1) {
                    expanded += read;
                    if (expanded > expandedMax) throw invalid("这个文档内容过多，请按章节拆分");
                }
            }
        }
    }
    private static BusinessException tooLong(int maxText) {
        return invalid("单份故事最多 " + maxText + " 字，请按章节拆分；未截断正文");
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
