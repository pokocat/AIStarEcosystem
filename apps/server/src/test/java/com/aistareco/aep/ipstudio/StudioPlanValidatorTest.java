package com.aistareco.aep.ipstudio;
import com.aistareco.aep.ipstudio.service.StudioPlanValidator;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class StudioPlanValidatorTest {
    private final ObjectMapper mapper=new ObjectMapper();
    @Test void suggestionsMustUseKnownOperationsAndExplicitlySelectedCanvasIds() throws Exception {
        var plan=mapper.readTree("{\"summary\":\"建议先写剧本\",\"steps\":[{\"id\":\"a\",\"operation\":\"script\",\"title\":\"写剧本\",\"prompt\":\"保持角色\",\"referenceNodeIds\":[\"selected\"]}],\"questions\":[]}");
        assertDoesNotThrow(()->StudioPlanValidator.validate(plan,mapper.readTree("[\"selected\"]")));
        assertThrows(BusinessException.class,()->StudioPlanValidator.validate(plan,mapper.readTree("[]")));
        ((com.fasterxml.jackson.databind.node.ObjectNode)plan.path("steps").get(0)).put("operation","shell");
        assertThrows(BusinessException.class,()->StudioPlanValidator.validate(plan,mapper.readTree("[\"selected\"]")));
    }
    @Test void unsupportedActionRemainsReadOnlyAdvice() throws Exception {
        var plan=mapper.readTree("{\"summary\":\"运镜建议\",\"steps\":[{\"id\":\"a\",\"operation\":\"director\",\"title\":\"运镜\",\"prompt\":\"缓慢推进\",\"referenceNodeIds\":[]}],\"questions\":[]}");
        StudioPlanValidator.isolateUnsupportedSteps(plan);
        assertEquals(0,plan.path("steps").size());assertEquals("运镜：缓慢推进",plan.path("notes").get(0).asText());
        assertDoesNotThrow(()->StudioPlanValidator.validate(plan,mapper.readTree("[]")));
    }
    @Test void discussionCanReturnNoGenerationSteps() throws Exception {
        assertDoesNotThrow(()->StudioPlanValidator.validate(mapper.readTree("{\"summary\":\"建议先确定题材\",\"steps\":[],\"questions\":[\"偏喜剧还是悬疑？\"]}"),mapper.readTree("[]")));
    }
    @Test void unknownReferenceNamesRemainVisibleInsteadOfBeingUsedAsCanvasIds() throws Exception {
        var plan=mapper.readTree("{\"summary\":\"先选素材\",\"steps\":[{\"id\":\"a\",\"operation\":\"image\",\"title\":\"人物\",\"prompt\":\"保留人物\",\"referenceNodeIds\":[\"selected\",\"角色名称\"]}],\"questions\":[]}");
        var selected=mapper.readTree("[\"selected\"]");StudioPlanValidator.isolateUnresolvedReferences(plan,selected);
        assertEquals("角色名称",plan.path("steps").get(0).path("unresolvedReferences").get(0).asText());
        assertEquals(1,plan.path("steps").get(0).path("referenceNodeIds").size());assertDoesNotThrow(()->StudioPlanValidator.validate(plan,selected));
    }
}
