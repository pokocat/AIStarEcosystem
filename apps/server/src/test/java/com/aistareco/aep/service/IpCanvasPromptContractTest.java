package com.aistareco.aep.service;
import com.aistareco.aep.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class IpCanvasPromptContractTest {
    @Test void canvasRecipeCanRequestASheetWithoutAnUnconditionalSingleFrameBan() {
        var repo=mock(PromptTemplateRepository.class);when(repo.findByPromptKey(PromptService.KEY_DAP_IP_CANVAS_IMAGE)).thenReturn(Optional.empty());
        var prompts=new PromptService(repo,mock(PromptTemplateVersionRepository.class),mock(AiModelEndpointRepository.class),mock(AiModelInvocationService.class),new ObjectMapper());
        var resolved=prompts.resolve(PromptService.KEY_DAP_IP_CANVAS_IMAGE);
        String requested="Create one character sheet with three views, five expressions and short labels.";
        String effective=PromptService.fill(resolved.userTemplate(),Map.of("refLead","","refOrder","","refNotes","","prompt",requested));
        assertEquals("resource",resolved.origin());assertTrue(effective.endsWith(requested));
        assertFalse(effective.contains("No multi-view grid"));assertTrue(effective.contains("When a character sheet"));
        assertTrue(effective.contains("Otherwise produce one single scene"));
    }
}
