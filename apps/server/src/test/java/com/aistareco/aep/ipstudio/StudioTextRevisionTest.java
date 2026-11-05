package com.aistareco.aep.ipstudio;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.service.StudioTextRevision;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class StudioTextRevisionTest {
    final ObjectMapper mapper=new ObjectMapper();
    @Test void emptySourceIsAllowedButTextSnapshotIsRequiredAndOtherOperationsCannotUseIt() throws Exception {
        var body=mapper.createObjectNode().put("operation","text");body.putObject("textEdit").put("content","");
        assertDoesNotThrow(()->StudioTextRevision.validateInput(mapper.treeToValue(body,RunRequest.class)));
        body.put("readVisuals",true);assertDoesNotThrow(()->StudioTextRevision.validateInput(mapper.treeToValue(body,RunRequest.class)));body.remove("readVisuals");
        body.put("operation","image");assertThrows(BusinessException.class,()->StudioTextRevision.validateInput(mapper.treeToValue(body,RunRequest.class)));
        body.put("operation","text");body.remove("textEdit");assertThrows(BusinessException.class,()->StudioTextRevision.validateInput(mapper.treeToValue(body,RunRequest.class)));
        body.putObject("textEdit").put("content","x".repeat(48001));assertDoesNotThrow(()->StudioTextRevision.validateInput(mapper.treeToValue(body,RunRequest.class)));
    }
    @Test void plainTextResultNeedsNoScriptFrameworkAndMalformedOrEmptyResultsFailClosed() {
        assertDoesNotThrow(()->StudioTextRevision.validateOutput(mapper.createObjectNode().put("summary","添加了标题").put("content","雨夜来客\n\n原有正文")));
        for(String invalid:new String[]{"{}","{\"summary\":\"完成\",\"content\":\"\"}","{\"summary\":\"完成\",\"steps\":[]}","{\"summary\":\"完成\",\"content\":123}"})
            assertEquals("AI_BAD_OUTPUT",assertThrows(BusinessException.class,()->StudioTextRevision.validateOutput(mapper.readTree(invalid))).getCode());
    }
    @Test void longTextAndMissingSummaryAreAcceptedVerbatim() {
        String text="长篇正文".repeat(20000);
        var result=mapper.createObjectNode().put("content",text);
        assertDoesNotThrow(()->StudioTextRevision.validateOutput(result));
        assertEquals(text,result.path("content").asText());assertFalse(result.path("summary").asText().isBlank());
        result.put("summary","说明".repeat(4000));assertDoesNotThrow(()->StudioTextRevision.validateOutput(result));
    }

}
