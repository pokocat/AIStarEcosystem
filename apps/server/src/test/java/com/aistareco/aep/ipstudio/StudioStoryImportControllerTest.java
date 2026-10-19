package com.aistareco.aep.ipstudio;

import com.aistareco.aep.ipstudio.controller.StudioStoryImportController;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioStoryImportControllerTest {
    @Test void onlyAnOwnedProjectCanReachTheStatelessExtractor() {
        var projects=mock(IpProjectService.class);var stories=mock(StudioStoryImportService.class);
        var controller=new StudioStoryImportController(projects,stories);var file=new MockMultipartFile("file","x.pdf","application/pdf",new byte[]{1});
        assertThrows(BusinessException.class,()->controller.extract(null,"project",file));verifyNoInteractions(projects,stories);
        when(projects.required("stranger","project")).thenThrow(BusinessException.notFound("IP_PROJECT_NOT_FOUND","画布不存在"));
        assertThrows(BusinessException.class,()->controller.extract(()->"stranger","project",file));verifyNoInteractions(stories);
        when(stories.extract(file)).thenReturn(new StudioStoryImportService.StoryImportResult("正文","pdf"));
        assertNotNull(controller.extract(()->"owner","project",file));var order=inOrder(projects,stories);order.verify(projects).required("owner","project");order.verify(stories).extract(file);
    }
}
