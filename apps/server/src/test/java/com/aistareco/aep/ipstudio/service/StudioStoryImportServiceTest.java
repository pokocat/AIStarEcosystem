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
}
