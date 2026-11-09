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

    @Test void suggestionsAreOptionalBoundedUnicodeAndIndependentOfVerbatimScript() throws Exception {
        String body="完整脚本".repeat(20000);
        var result=mapper.createObjectNode().put("content",body).put("summary","本轮思路");
        var hints=result.putArray("suggestions");
        hints.addNull(); hints.addObject().put("label","超出八个字的按钮文字").put("instruction","修改");
        hints.addObject().put("label","长指令").put("instruction","字".repeat(81));
        hints.addObject().put("label","多\n行").put("instruction","修改");
        hints.addObject().put("label","  细节开场  ").put("instruction","  先拍商品细节。  ");
        hints.addObject().put("label","细节开场").put("instruction","重复按钮");
        hints.addObject().put("label","重复指令").put("instruction","先拍商品细节。");
        hints.addObject().put("label","😀".repeat(8)).put("instruction","字".repeat(80));
        hints.addObject().put("label","改结尾").put("instruction","结尾回到商品。");
        hints.addObject().put("label","第四条").put("instruction","不展示");
        StudioTextRevision.validateOutput(result); StudioTextRevision.normalizeSceneSuggestions(result);
        assertEquals(body,result.path("content").asText()); assertEquals(3,result.path("suggestions").size());
        assertEquals("细节开场",result.path("suggestions").get(0).path("label").asText());
        assertEquals("先拍商品细节。",result.path("suggestions").get(0).path("instruction").asText());
        assertEquals("😀".repeat(8),result.path("suggestions").get(1).path("label").asText());
        for (String invalid : new String[]{"{}","{\"suggestions\":null}","{\"suggestions\":\"错误格式\"}"}) {
            var old=mapper.readTree(invalid); StudioTextRevision.normalizeSceneSuggestions(old);
            assertEquals(0,old.path("suggestions").size());
        }
    }

}
