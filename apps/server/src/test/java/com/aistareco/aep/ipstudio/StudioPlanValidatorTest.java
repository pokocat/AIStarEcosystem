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
    @Test void textDraftAndPriorStepDependenciesAreValidatedAndModelCannotBindCanvasOutputs() throws Exception {
        var plan=mapper.readTree("""
          {"summary":"已生成初稿","steps":[
            {"id":"description","operation":"text","title":"角色","prompt":"生成描述","content":"废土信使","referenceNodeIds":[],"resultNodeId":"forged"},
            {"id":"sheet","operation":"image","title":"设定图","prompt":"三视图","referenceNodeIds":[],"dependsOn":["description"]}],"questions":[]}
          """);
        StudioPlanValidator.isolateUnsupportedSteps(plan);
        assertFalse(plan.path("steps").get(0).has("resultNodeId"));
        assertDoesNotThrow(()->StudioPlanValidator.validate(plan,mapper.readTree("[]")));
        var image=(com.fasterxml.jackson.databind.node.ObjectNode)plan.path("steps").get(1);
        image.putArray("dependsOn").add("sheet");
        assertThrows(BusinessException.class,()->StudioPlanValidator.validate(plan,mapper.readTree("[]")));
        image.putArray("dependsOn").add("unknown");
        assertThrows(BusinessException.class,()->StudioPlanValidator.validate(plan,mapper.readTree("[]")));
        image.putArray("dependsOn").add("description");
        ((com.fasterxml.jackson.databind.node.ObjectNode)plan.path("steps").get(0)).remove("content");
        assertThrows(BusinessException.class,()->StudioPlanValidator.validate(plan,mapper.readTree("[]")));
    }

    @Test void duplicatedPriorDependencyDoesNotRequirePickingAnotherAsset() throws Exception {
        var plan=mapper.readTree("""
          {"summary":"流程","steps":[
            {"id":"image","operation":"image","title":"图","prompt":"画图","referenceNodeIds":[]},
            {"id":"video","operation":"video","title":"视频","prompt":"动作","referenceNodeIds":["image","missing"],"dependsOn":["image"]}],"questions":[]}
          """);
        var context=mapper.readTree("[]");StudioPlanValidator.isolateUnresolvedReferences(plan,context);
        assertEquals("missing",plan.path("steps").get(1).path("unresolvedReferences").get(0).asText());
        assertEquals(1,plan.path("steps").get(1).path("unresolvedReferences").size());
        assertDoesNotThrow(()->StudioPlanValidator.validate(plan,context));
    }
    @Test void editProposalsRequireASelectedTargetAndSupportedField() throws Exception {
        var plan=mapper.readTree("""
          {"summary":"优化提示词","steps":[{"id":"edit","operation":"text","title":"新提示词","prompt":"优化","content":"保持主体，侧光","referenceNodeIds":["selected"],"editTarget":{"nodeId":"selected","field":"prompt"}}],"questions":[]}
          """);
        var ids=mapper.readTree("[\"selected\"]");
        assertDoesNotThrow(()->StudioPlanValidator.validate(plan,ids));
        var edit=(com.fasterxml.jackson.databind.node.ObjectNode)plan.at("/steps/0/editTarget");
        edit.put("nodeId","not-selected");assertThrows(BusinessException.class,()->StudioPlanValidator.validate(plan,ids));
        edit.put("nodeId","selected").put("field","storageKey");assertThrows(BusinessException.class,()->StudioPlanValidator.validate(plan,ids));
        edit.put("field","script");assertDoesNotThrow(()->StudioPlanValidator.validate(plan,ids));
    }
    @Test void readyTextEditWithMissingIntentUsesItsTitleWithoutChangingTheResult() throws Exception {
        var plan=mapper.readTree("""
          {"summary":"提示词待采用","steps":[{"id":"edit","operation":"text","title":"优化小巡全身形象图提示词","content":"白色圆润机器人，左前方柔光，浅米白背景","referenceNodeIds":["selected"],"editTarget":{"nodeId":"selected","field":"prompt"}}],"questions":[]}
          """);
        StudioPlanValidator.isolateUnsupportedSteps(plan);
        assertEquals("优化小巡全身形象图提示词",plan.at("/steps/0/prompt").asText());
        assertEquals("白色圆润机器人，左前方柔光，浅米白背景",plan.at("/steps/0/content").asText());
        assertDoesNotThrow(()->StudioPlanValidator.validate(plan,mapper.readTree("[\"selected\"]")));
    }
    @Test void textIntentNormalizationCannotInventContentOrMediaGenerationInstructions() throws Exception {
        for(var operation:new String[]{"text","image"}) {
            var plan=mapper.readTree("""
              {"summary":"建议","steps":[{"id":"a","operation":"text","title":"创作","referenceNodeIds":[]}],"questions":[]}
              """);
            var step=(com.fasterxml.jackson.databind.node.ObjectNode)plan.at("/steps/0");step.put("operation",operation);
            if("image".equals(operation))step.put("content","这不是生成指令");
            StudioPlanValidator.isolateUnsupportedSteps(plan);
            assertThrows(BusinessException.class,()->StudioPlanValidator.validate(plan,mapper.readTree("[]")));
        }
    }

}
