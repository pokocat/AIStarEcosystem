package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.font.*;
import org.apache.pdfbox.pdmodel.encryption.*;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import java.io.*;
import static org.junit.jupiter.api.Assertions.*;

class StudioStoryImportServiceTest {
    final StudioStoryImportService service = new StudioStoryImportService();
    MockMultipartFile file(String name, byte[] bytes) { return new MockMultipartFile("file", name, "application/octet-stream", bytes); }
    byte[] pdf(String text, boolean encrypted, int pages) throws Exception {
        try (var doc = new PDDocument(); var bytes = new ByteArrayOutputStream()) {
            for (int i=0;i<pages;i++) doc.addPage(new PDPage());
            if (!text.isEmpty()) try(var stream=new PDPageContentStream(doc,doc.getPage(0))) {
                stream.beginText();stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA),12);stream.newLineAtOffset(40,700);stream.showText(text);stream.endText();
            }
            if (encrypted) doc.protect(new StandardProtectionPolicy("owner", "secret", new AccessPermission()));
            doc.save(bytes);return bytes.toByteArray();
        }
    }
    byte[] docx(String text) throws Exception {
        try(var doc=new XWPFDocument();var bytes=new ByteArrayOutputStream()) {
            doc.createParagraph().createRun().setText(text);
            var table=doc.createTable(1,2);table.getRow(0).getCell(0).setText("角色");table.getRow(0).getCell(1).setText("小鹿");
            doc.write(bytes);return bytes.toByteArray();
        }
    }
    @Test void pdfTextAndWordParagraphsTablesRemainEditable() throws Exception {
        var pdf=service.extract(file("故事.PDF",pdf("A deer enters the forest.",false,1)));
        assertEquals("pdf",pdf.format());assertEquals("A deer enters the forest.",pdf.text());
        var word=service.extract(file("故事.docx",docx("第一场：小鹿走进森林。")));
        assertEquals("docx",word.format());assertTrue(word.text().contains("第一场：小鹿走进森林。"));assertTrue(word.text().contains("角色"));assertTrue(word.text().contains("小鹿"));
    }
    @Test void legacyWordUsesRealOleDocument() throws Exception {
        try(var source=getClass().getResourceAsStream("/studio/simple.doc")) {
            var result=service.extract(file("旧版原作.doc",source.readAllBytes()));assertEquals("doc",result.format());assertTrue(result.text().contains("This is a simple file"));
        }
    }
    @Test void scannedPasswordProtectedAndTooManyPagesAreExplicitFailures() throws Exception {
        assertTrue(assertThrows(BusinessException.class,()->service.extract(file("扫描.pdf",pdf("",false,1)))).getMessage().contains("扫描件"));
        assertTrue(assertThrows(BusinessException.class,()->service.extract(file("加密.pdf",pdf("story",true,1)))).getMessage().contains("密码"));
        assertTrue(assertThrows(BusinessException.class,()->service.extract(file("长篇.pdf",pdf("story",false,101)))).getMessage().contains("100 页"));
    }
    @Test void damagedAndDisguisedFormatsDoNotReturnPlaceholders() {
        for(String name:new String[]{"坏.pdf","坏.doc","坏.docx","故事.exe"}) {
            var error=assertThrows(BusinessException.class,()->service.extract(file(name,"not a document".getBytes())));
            assertEquals("STUDIO_STORY_INVALID",error.getCode());
        }
    }
    @Test void oversizeAndOverlongDocumentsRejectWithoutTruncating() throws Exception {
        assertTrue(assertThrows(BusinessException.class,()->service.extract(file("大.pdf",new byte[StudioStoryImportService.MAX_BYTES+1]))).getMessage().contains("8 MB"));
        assertTrue(assertThrows(BusinessException.class,()->service.extract(file("长篇.docx",docx("字".repeat(24001))))).getMessage().contains("24000"));
    }
    @Test void restrictedPdfCannotBypassExtractionPermission() throws Exception {
        try(var doc=new PDDocument();var bytes=new ByteArrayOutputStream()) {
            doc.addPage(new PDPage());var permission=new AccessPermission();permission.setCanExtractContent(false);
            doc.protect(new StandardProtectionPolicy("owner","",permission));doc.save(bytes);
            assertTrue(assertThrows(BusinessException.class,()->service.extract(file("受限.pdf",bytes.toByteArray()))).getMessage().contains("限制文字提取"));
        }
    }

    @Test void directorTextImportsPreserveChineseAndLineBreaksAcrossCommonEncodings() throws Exception {
        String text = "第一场：夜市\r\n小鹿：今晚回家。\t（停顿）";
        for (String encoding : new String[]{"UTF-8", "UTF-16", "GB18030"}) {
            var result = service.extractScript(file("剧本.TXT", text.getBytes(java.nio.charset.Charset.forName(encoding))));
            assertEquals(text.replace("\r\n", "\n"), result.text(), encoding);
        }
        var bom = new ByteArrayOutputStream(); bom.write(new byte[]{(byte)0xef,(byte)0xbb,(byte)0xbf}); bom.write("正文".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertEquals("正文", service.extractScript(file("正文.md", bom.toByteArray())).text());
        for (String extension : new String[]{"markdown","csv","tsv","json","xml","yaml","yml","log","srt","vtt"}) {
            assertEquals("第一行\n第二行", service.extractScript(file("正文." + extension, "第一行\n第二行".getBytes(java.nio.charset.StandardCharsets.UTF_8))).text());
        }
    }

    @Test void directorHasItsOwnSixtyThousandCharacterLimitWithoutChangingCanvasLimit() throws Exception {
        var word = file("正文.docx", docx("字".repeat(25000)));
        assertTrue(service.extractScript(word).text().length() > 24000);
        assertThrows(BusinessException.class, () -> service.extract(word));
        assertEquals(60000, service.extractScript(file("边界.txt", "字".repeat(60000).getBytes(java.nio.charset.StandardCharsets.UTF_8))).text().length());
        assertTrue(assertThrows(BusinessException.class, () -> service.extractScript(file("超长.txt", "字".repeat(60001).getBytes(java.nio.charset.StandardCharsets.UTF_8)))).getMessage().contains("60000"));
    }

    @Test void modernAndLegacyPowerPointExtractInSlideOrder() throws Exception {
        try (var show = new org.apache.poi.xslf.usermodel.XMLSlideShow(); var bytes = new ByteArrayOutputStream()) {
            show.createSlide().createTextBox().setText("第一场：夜市");
            show.createSlide().createTextBox().setText("第二场：森林");
            show.write(bytes);
            var result = service.extractScript(file("剧本.PPTX", bytes.toByteArray()));
            assertEquals("pptx", result.format());
            assertTrue(result.text().contains("第一场：夜市"));
            assertTrue(result.text().indexOf("第一场") < result.text().indexOf("第二场"));
            assertThrows(BusinessException.class, () -> service.extract(file("旧入口.pptx", bytes.toByteArray())));
        }
        try (var show = new org.apache.poi.hslf.usermodel.HSLFSlideShow(); var bytes = new ByteArrayOutputStream()) {
            var first = new org.apache.poi.hslf.usermodel.HSLFTextBox(); first.setText("第一幕：回家"); show.createSlide().addShape(first);
            var second = new org.apache.poi.hslf.usermodel.HSLFTextBox(); second.setText("第二幕：重逢"); show.createSlide().addShape(second);
            show.write(bytes);
            var result = service.extractScript(file("旧剧本.ppt", bytes.toByteArray()));
            assertEquals("ppt", result.format());
            assertTrue(result.text().indexOf("第一幕") >= 0 && result.text().indexOf("第二幕") > result.text().indexOf("第一幕"));
        }
    }

    @Test void rtfProducesReadableTextAndRejectsWrongFormat() {
        var result = service.extractScript(file("剧本.rtf", "{\\rtf1\\ansi Scene one\\par Scene two}".getBytes(java.nio.charset.StandardCharsets.US_ASCII)));
        assertEquals("Scene one\nScene two", result.text());
        assertThrows(BusinessException.class, () -> service.extractScript(file("伪装.rtf", "plain text".getBytes())));
    }

    @Test void failedImportsNeverReturnTruncatedOrBinaryPlaceholders() throws Exception {
        for (var bad : new MockMultipartFile[]{file("空.txt", new byte[0]), file("空白.txt", " \n\t ".getBytes()), file("伪装.txt", new byte[]{1,2,0,4}), file("文件.exe", new byte[]{1}), file("大.txt", new byte[StudioStoryImportService.MAX_BYTES+1]), file("损坏.pptx", "broken".getBytes())})
            assertEquals("STUDIO_STORY_INVALID", assertThrows(BusinessException.class, () -> service.extractScript(bad)).getCode());
        assertTrue(assertThrows(BusinessException.class, () -> service.extractScript(file("扫描.pdf", pdf("", false, 1)))).getMessage().contains("扫描件"));
        assertTrue(assertThrows(BusinessException.class, () -> service.extractScript(file("加密.pdf", pdf("secret", true, 1)))).getMessage().contains("密码"));
        try (var show = new org.apache.poi.xslf.usermodel.XMLSlideShow(); var bytes = new ByteArrayOutputStream()) {
            for (int i=0; i<101; i++) show.createSlide();
            show.write(bytes);
            assertTrue(assertThrows(BusinessException.class, () -> service.extractScript(file("长.pptx", bytes.toByteArray()))).getMessage().contains("100 页"));
        }
    }
}
