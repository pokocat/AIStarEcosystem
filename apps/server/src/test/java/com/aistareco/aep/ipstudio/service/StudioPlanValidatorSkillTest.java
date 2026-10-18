package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.execution.StudioSkillRules;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** Skill plans: stage whitelist, typed settings, step cap from the real skill file, server-owned fields stripped. */
class StudioPlanValidatorSkillTest {
    final ObjectMapper om=new ObjectMapper();
    final List<String> context=List.of("source-video","product-img","person-img");

    StudioSkillRules.Rules rules() throws Exception {
        try(var in=getClass().getResourceAsStream("/studio/skills/reference-video-recreation.md")) {
            return StudioSkillRules.rules(StudioSkillCatalog.parse(new String(in.readAllBytes(),StandardCharsets.UTF_8)));
        }
    }
    ObjectNode analysis() throws Exception {
        return (ObjectNode)om.readTree("""
            {"summary":"先拉片再编排","quotedCost":99,"confirmedApproachId":"x","budget":{"approvedCap":9999},"revision":7,
             "steps":[
              {"id":"cut","operation":"recreation","title":"拉片","prompt":"看懂原片结构","quotedCost":1,"resultNodeId":"n","status":"done",
               "settings":{"sourceNodeId":"source-video","mode":"segments","maxSegmentSec":"model","videoModel":"ep-h3"}},
              {"id":"compile","operation":"text","title":"编排制作计划","prompt":"按分析结果编排","settings":{"purpose":"plan-compile"}}],
             "questions":["是否保留原声？默认保留"]}""");
    }
    ObjectNode production() throws Exception {
        return (ObjectNode)om.readTree("""
            {"summary":"重写剧情再出片","recommendedApproachId":"rewrite",
             "approaches":[{"id":"rewrite","title":"改写剧情","summary":"保留骨架","rationale":"换了商品","preserve":["骨架"],"change":["对白"],"tradeoffs":["动作不同"],"requiredCapabilities":["video"]}],
             "steps":[
              {"id":"img","operation":"image","title":"商品图","prompt":"新商品正面","settings":{"count":1,"referenceBindings":[{"nodeId":"product-img","role":"product","order":0}]}},
              {"id":"v1","operation":"video","title":"第一段","prompt":"开播","strategy":{"approachId":"rewrite","method":"my-own-new-method","reason":"新做法"},
               "settings":{"video":{"mode":"omni","resolutionTier":"768p","firstFrameKey":"someone-elses-key"},"durationSec":12,"aspectRatio":"9:16","count":2,
                 "referenceBindings":[{"stepId":"img","role":"product","order":0},{"nodeId":"person-img","role":"character","order":1}]}},
              {"id":"chk","operation":"check","title":"检查第一段","prompt":"","settings":{"targetStepId":"v1","targetRunId":"IPR-forged","checkIds":["subject-replaced","old-subject-residue"]}},
              {"id":"final","operation":"assemble","title":"合成","settings":{"clipOrder":[{"stepId":"v1","runId":"IPR-forged","candidateIndex":1}],"audioStrategy":"generated"}}],
             "questions":[]}""");
    }

    @Test void analysisPlanIsWhitelistedAndServerOwnedFieldsAreDropped() throws Exception {
        var plan=StudioPlanValidator.validateSkillPlan(analysis(),rules(),"analysis",context);
        for(String field:List.of("quotedCost","confirmedApproachId","budget","revision"))assertFalse(plan.has(field),field);
        JsonNode cut=plan.path("steps").get(0);
        assertFalse(cut.has("quotedCost"));assertFalse(cut.has("resultNodeId"));assertFalse(cut.has("status"));
        assertEquals("model",cut.path("settings").path("maxSegmentSec").asText());
        assertEquals("[\"cut\"]",plan.path("steps").get(1).path("dependsOn").toString(),"plan compile needs every earlier analysis result");
        assertTrue(StudioPlanValidator.isSkillPlan(om.createObjectNode().put("skillKey","k")));
    }

    @Test void productionPlanBindsReferencesToEarlierStepsAndStripsTaskIdentities() throws Exception {
        var plan=StudioPlanValidator.validateSkillPlan(production(),rules(),"production",context);
        JsonNode video=plan.path("steps").get(1);
        assertFalse(video.path("settings").path("video").has("firstFrameKey"),"keys only come through bindings");
        assertEquals("[\"img\"]",video.path("dependsOn").toString());
        assertEquals("my-own-new-method",video.path("strategy").path("method").asText(),"a method name outside the examples is not a reason to reject");
        JsonNode check=plan.path("steps").get(2);
        assertFalse(check.path("settings").has("targetRunId"));assertEquals("[\"v1\"]",check.path("dependsOn").toString());
        assertFalse(plan.path("steps").get(3).path("settings").path("clipOrder").get(0).has("runId"));
    }

    @Test void operationsOutsideTheStageWhitelistAreRefused() throws Exception {
        var raw=analysis();((ObjectNode)raw.path("steps").get(1)).put("operation","video");
        assertEquals("STUDIO_SKILL_OPERATION_NOT_ALLOWED",assertThrows(BusinessException.class,()->StudioPlanValidator.validateSkillPlan(raw,rules(),"analysis",context)).getCode());
        var legacy=production();((ObjectNode)legacy.path("steps").get(0)).put("operation","script");
        assertEquals("STUDIO_SKILL_OPERATION_NOT_ALLOWED",assertThrows(BusinessException.class,()->StudioPlanValidator.validateSkillPlan(legacy,rules(),"production",context)).getCode());
        var compile=production();((ObjectNode)compile.path("steps").get(0)).put("operation","text").set("settings",om.readTree("{\"purpose\":\"plan-compile\"}"));
        assertEquals("AI_BAD_OUTPUT",assertThrows(BusinessException.class,()->StudioPlanValidator.validateSkillPlan(compile,rules(),"production",context)).getCode());
    }

    @Test void stepCapComesFromTheSkillLimits() throws Exception {
        var skill=rules();assertEquals(28,skill.maxSteps(),"8 segments × 3 + 4");
        for(int count:new int[]{28,29}) {
            ObjectNode raw=om.createObjectNode().put("summary","长计划");raw.putArray("questions");ArrayNode steps=raw.putArray("steps");
            for(int i=0;i<count;i++)steps.addObject().put("id","t"+i).put("operation","text").put("title","第"+i+"步").put("prompt","写").putObject("settings").put("purpose","note");
            if(count==28)assertEquals(28,StudioPlanValidator.validateSkillPlan(raw,skill,"analysis",context).path("steps").size());
            else assertThrows(BusinessException.class,()->StudioPlanValidator.validateSkillPlan(raw,skill,"analysis",context));
        }
    }

    @Test void checksDependenciesAndReferencesMustPointBackwardsAndToRealInputs() throws Exception {
        var later=production();((ObjectNode)later.path("steps").get(2).path("settings")).put("targetStepId","final");
        assertThrows(BusinessException.class,()->StudioPlanValidator.validateSkillPlan(later,rules(),"production",context));
        var image=production();((ObjectNode)image.path("steps").get(2).path("settings")).put("targetStepId","img");
        assertThrows(BusinessException.class,()->StudioPlanValidator.validateSkillPlan(image,rules(),"production",context),"check targets a video step");
        var unknownCheck=production();((ArrayNode)unknownCheck.path("steps").get(2).path("settings").path("checkIds")).add("made-up-check");
        assertThrows(BusinessException.class,()->StudioPlanValidator.validateSkillPlan(unknownCheck,rules(),"production",context));
        var forward=production();((ObjectNode)forward.path("steps").get(0)).putArray("dependsOn").add("v1");
        assertThrows(BusinessException.class,()->StudioPlanValidator.validateSkillPlan(forward,rules(),"production",context));
        var ghost=production();((ObjectNode)ghost.path("steps").get(0).path("settings").path("referenceBindings").get(0)).put("nodeId","not-on-canvas");
        assertThrows(BusinessException.class,()->StudioPlanValidator.validateSkillPlan(ghost,rules(),"production",context));
        var silent=production();((ObjectNode)silent.path("steps").get(3).path("settings")).put("audioStrategy","none");
        assertThrows(BusinessException.class,()->StudioPlanValidator.validateSkillPlan(silent,rules(),"production",context),"no silent assemble path exists");
        var untyped=production();((ObjectNode)untyped.path("steps").get(1)).remove("settings");
        assertThrows(BusinessException.class,()->StudioPlanValidator.validateSkillPlan(untyped,rules(),"production",context));
    }

    @Test void fingerprintCoversContentAndQuotesButNotServerBindings() throws Exception {
        var plan=StudioPlanValidator.validateSkillPlan(production(),rules(),"production",context);
        plan.put("skillKey","reference-video-recreation").put("skillVersion",1).put("stage","production");
        ((ObjectNode)plan.path("steps").get(0)).put("quotedCost",8);plan.putObject("budget").put("estimated",8).put("autoFixCap",0);
        String base=StudioPlanValidator.fingerprint(plan);
        var bound=plan.deepCopy();bound.put("revision",3).put("confirmedApproachId","rewrite").put("fingerprint","x");((ObjectNode)bound.path("budget")).put("approvedCap",100);
        assertEquals(base,StudioPlanValidator.fingerprint(bound));
        var reordered=(ObjectNode)om.readTree(om.writeValueAsString(plan));var budget=reordered.remove("budget");reordered.set("budget",budget);
        assertEquals(base,StudioPlanValidator.fingerprint(reordered),"key order is irrelevant");
        var repriced=plan.deepCopy();((ObjectNode)repriced.path("steps").get(0)).put("quotedCost",9);
        assertNotEquals(base,StudioPlanValidator.fingerprint(repriced));
    }
}
