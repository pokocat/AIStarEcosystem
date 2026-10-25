package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.service.StudioStoryImportService;
import com.aistareco.aep.service.ErrorLogService;
import com.aistareco.common.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;

import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DirectorScriptImportControllerTest {
    private final org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new DirectorScriptImportController(new StudioStoryImportService()))
            .setControllerAdvice(new GlobalExceptionHandler(mock(ErrorLogService.class))).build();

    @Test void multipartWorksBeforeWorkCreationAndReturnsOriginalEditableText() throws Exception {
        mvc.perform(multipart("/api/v1/ip-studio/director/script-import")
                        .file(new MockMultipartFile("file", "剧本.txt", "application/octet-stream", "第一场\n对白：回家吧。".getBytes(StandardCharsets.UTF_8)))
                        .principal(() -> "owner"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.text").value("第一场\n对白：回家吧。"))
                .andExpect(jsonPath("$.data.format").value("txt"));
    }

    @Test void unauthenticatedAndUnreadableFilesAreExplicitErrors() throws Exception {
        var file = new MockMultipartFile("file", "剧本.txt", "text/plain", "正文".getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart("/api/v1/ip-studio/director/script-import").file(file))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
        mvc.perform(multipart("/api/v1/ip-studio/director/script-import").file(new MockMultipartFile("file", "空.pdf", "application/pdf", new byte[0])).principal(() -> "owner"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("STUDIO_STORY_INVALID"));
    }
}
