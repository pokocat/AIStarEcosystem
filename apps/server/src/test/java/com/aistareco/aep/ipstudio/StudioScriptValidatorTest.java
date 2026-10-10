package com.aistareco.aep.ipstudio;
import com.aistareco.aep.ipstudio.service.StudioScriptValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class StudioScriptValidatorTest {
    private final ObjectMapper mapper=new ObjectMapper();
    private ObjectNode valid() throws Exception {
        return (ObjectNode)mapper.readTree(Files.readString(Path.of("../../scripts/studio/fixtures/script.json")));
    }
    @Test void completeResponseIsSafeForTheStructuredEditor() throws Exception {assertDoesNotThrow(()->StudioScriptValidator.validate(valid()));}
    @Test void missingOrNullEditorFieldsAreRejectedBeforeSettlement() throws Exception {
        for(String field:new String[]{"title","outline","characters","scenes","props","episodes","shots"}) {
            ObjectNode script=valid();script.putNull(field);assertThrows(com.aistareco.common.BusinessException.class,()->StudioScriptValidator.validate(script),field);
        }
    }
    @Test void duplicateShotIdsAndInvalidDurationsAreRejected() throws Exception {
        ObjectNode duplicate=valid();((ObjectNode)duplicate.path("shots").get(1)).put("id",duplicate.path("shots").get(0).path("id").asText());
        assertThrows(com.aistareco.common.BusinessException.class,()->StudioScriptValidator.validate(duplicate));
        ObjectNode malformed=valid();((ObjectNode)malformed.path("shots").get(0)).put("durationSec",-1);
        assertThrows(com.aistareco.common.BusinessException.class,()->StudioScriptValidator.validate(malformed));
    }
    @Test void multiepisodeResultsRequireEveryShotToBelongToARealCoveredEpisode() throws Exception {
        ObjectNode script=valid();var episodes=(com.fasterxml.jackson.databind.node.ArrayNode)script.path("episodes");
        episodes.addObject().put("no",2).put("title","第二集").put("content","继续故事");
        assertThrows(com.aistareco.common.BusinessException.class,()->StudioScriptValidator.validate(script,2,0));
        for(var shot:script.path("shots"))((ObjectNode)shot).put("episodeNo",1);
        assertThrows(com.aistareco.common.BusinessException.class,()->StudioScriptValidator.validate(script,2,0));
        ((ObjectNode)script.path("shots").get(1)).put("episodeNo",2);
        assertDoesNotThrow(()->StudioScriptValidator.validate(script,2,0));
        ((ObjectNode)script.path("shots").get(0)).put("episodeNo",3);
        assertThrows(com.aistareco.common.BusinessException.class,()->StudioScriptValidator.validate(script,2,0));
    }
    @Test void requestedSingleEpisodeCannotReturnTheFirstEpisodeOrOtherEpisodes() throws Exception {
        ObjectNode script=valid();assertThrows(com.aistareco.common.BusinessException.class,()->StudioScriptValidator.validate(script,2,2));
        ((ObjectNode)script.path("episodes").get(0)).put("no",2);for(var shot:script.path("shots"))((ObjectNode)shot).put("episodeNo",2);
        assertDoesNotThrow(()->StudioScriptValidator.validate(script,2,2));
    }
}
