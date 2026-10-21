package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.execution.StudioSkillRules;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * §6.1 (docs/ip-studio-new-canvas-and-threads.md): a step's result goes into the canvas object prepared for it. Production
 * 2026-10-21 IPP-655ea55a: the assistant made the video draft dlg-924c749ca1f7 (prompt, 9:16 / 5 s, first-frame edge), the
 * executor still made PEX-…-p-s1 beside it with no prompt and no edge.
 */
class StudioPlanTargetBindingTest {
    final ObjectMapper om=new ObjectMapper();

    StudioSkillRules.Rules videoRules() throws Exception {
        try(var in=getClass().getResourceAsStream("/studio/skills/video-generation.md")) {
            return StudioSkillRules.rules(StudioSkillCatalog.parse(new String(in.readAllBytes(),StandardCharsets.UTF_8)));
        }
    }
    ObjectNode doc(String... nodes) throws Exception {
        var doc=om.createObjectNode();var array=doc.putArray("nodes");
        for(String n:nodes)array.add(om.readTree(n));
        doc.putArray("connections");
        return doc;
    }
    static String emptyVideo(String id){return "{\"id\":\""+id+"\",\"type\":\"video\",\"title\":\"视频\",\"metadata\":{\"prompt\":\"让她转身\",\"studio\":{\"kind\":\"shot\",\"spec\":{\"aspectRatio\":\"9:16\",\"source\":\"assistant\"}}}}";}
    static String emptyImage(String id){return "{\"id\":\""+id+"\",\"type\":\"image\",\"title\":\"图片\",\"metadata\":{\"prompt\":\"海报\"}}";}
    static String filledVideo(String id){return "{\"id\":\""+id+"\",\"type\":\"video\",\"title\":\"旧视频\",\"metadata\":{\"storageKey\":\"material-videos/j/video.mp4\",\"status\":\"success\"}}";}
    ObjectNode step(String id,String operation,String target) {
        var step=om.createObjectNode().put("id",id).put("stage","production").put("operation",operation).put("status","pending");
        step.putArray("runIds");
        var definition=step.putObject("definition").put("id",id).put("operation",operation);
        definition.putObject("settings").put("operation",operation);
        if(target!=null)definition.put("targetNodeId",target);
        return step;
    }

    @Test void theOnlyPreparedObjectOfTheOnlyStepOfItsTypeIsBoundWithoutBeingNamed() throws Exception {
        var binding=StudioPlanValidator.bindTargets(List.of(step("s1","video",null)),doc(emptyVideo("dlg-1"),filledVideo("old")),Set.of("dlg-1"),Set.of());
        assertEquals(Map.of("s1","dlg-1"),binding.bound());
        assertTrue(binding.dropped().isEmpty());
    }

    @Test void twoDraftsOrTwoStepsOfATypeAreNeverGuessed() throws Exception {
        assertTrue(StudioPlanValidator.bindTargets(List.of(step("s1","video",null)),doc(emptyVideo("dlg-1"),emptyVideo("dlg-2")),
                Set.of("dlg-1","dlg-2"),Set.of()).bound().isEmpty(),"two prepared videos: which one is meant is unknown");
        assertTrue(StudioPlanValidator.bindTargets(List.of(step("s1","video",null),step("s2","video",null)),doc(emptyVideo("dlg-1")),
                Set.of("dlg-1"),Set.of()).bound().isEmpty(),"two video steps for one draft: no guess");
    }

    @Test void anExplicitTargetOfTheWrongTypeIsDroppedAndTheStepStaysUnbound() throws Exception {
        var binding=StudioPlanValidator.bindTargets(List.of(step("s1","video","img-1")),doc(emptyImage("img-1")),Set.of(),Set.of());
        assertTrue(binding.bound().isEmpty());
        assertEquals(1,binding.dropped().size());
        assertTrue(binding.dropped().get(0).contains("类型"),binding.dropped().get(0));
    }

    @Test void anExplicitTargetThatAlreadyHasAResultIsDropped() throws Exception {
        var binding=StudioPlanValidator.bindTargets(List.of(step("s1","video","old")),doc(filledVideo("old")),Set.of(),Set.of());
        assertTrue(binding.bound().isEmpty());
        assertTrue(binding.dropped().get(0).contains("已经有内容"),binding.dropped().get(0));
        // A draft that is still generating, or already another execution's output, is not empty either.
        var generating=(ObjectNode)om.readTree(emptyVideo("busy"));((ObjectNode)generating.path("metadata")).put("status","loading");
        assertTrue(StudioPlanValidator.bindTargets(List.of(step("s1","video","busy")),doc(generating.toString()),Set.of(),Set.of()).bound().isEmpty());
    }

    @Test void anExplicitTargetBindsToAnObjectTheUserPlacedAndCannotBeTakenTwice() throws Exception {
        // The user's own empty image (not made by the assistant): named explicitly, it binds.
        var binding=StudioPlanValidator.bindTargets(List.of(step("a","image","img-1"),step("b","image","img-1")),doc(emptyImage("img-1")),Set.of(),Set.of());
        assertEquals(Map.of("a","img-1"),binding.bound());
        assertTrue(binding.dropped().get(0).contains("占用"),binding.dropped().get(0));
        // Another step of the execution already fills it.
        assertTrue(StudioPlanValidator.bindTargets(List.of(step("c","image","img-1")),doc(emptyImage("img-1")),Set.of(),Set.of("img-1")).bound().isEmpty());
        // Not on the canvas.
        assertTrue(StudioPlanValidator.bindTargets(List.of(step("d","image","gone")),doc(emptyImage("img-1")),Set.of(),Set.of()).dropped().get(0).contains("不在画布"));
    }

    @Test void onlyTheAssistantsObjectsOfThisConversationAreBoundWithoutBeingNamed() throws Exception {
        // A user's empty video, or one the assistant made in another conversation, is not taken without being named.
        assertTrue(StudioPlanValidator.bindTargets(List.of(step("s1","video",null)),doc(emptyVideo("dlg-other")),Set.of("dlg-here"),Set.of()).bound().isEmpty());
        // Without the conversation's record, the assistant's spec marker stands in.
        assertEquals(Map.of("s1","dlg-1"),StudioPlanValidator.bindTargets(List.of(step("s1","video",null)),doc(emptyVideo("dlg-1"),
                "{\"id\":\"mine\",\"type\":\"video\",\"title\":\"我的\",\"metadata\":{}}"),null,Set.of()).bound());
    }

    @Test void checksAssemblesAndEditsNeverBind() throws Exception {
        assertNull(StudioPlanValidator.resultType("check",om.createObjectNode()));
        assertNull(StudioPlanValidator.resultType("assemble",om.createObjectNode()));
        assertNull(StudioPlanValidator.resultType("text",om.createObjectNode().put("purpose","plan-compile")));
        assertNull(StudioPlanValidator.resultType("text",(ObjectNode)om.readTree("{\"purpose\":\"script\",\"editTarget\":{\"nodeId\":\"t\"}}")));
        assertEquals("text",StudioPlanValidator.resultType("text",om.createObjectNode().put("purpose","script")));
        var text=step("w","text",null);((ObjectNode)text.path("definition").path("settings")).put("purpose","script");
        assertEquals(Map.of("w","t-1"),StudioPlanValidator.bindTargets(List.of(text),
                doc("{\"id\":\"t-1\",\"type\":\"text\",\"title\":\"口播稿\",\"metadata\":{\"content\":\"\"}}"),Set.of("t-1"),Set.of()).bound());
    }

    @Test void thePlannersTargetIsKeptWhenItCanBeOneAndDroppedOtherwise() throws Exception {
        var raw=(ObjectNode)om.readTree("""
            {"summary":"一段 9:16 的 5 秒视频","steps":[
              {"id":"s1","operation":"video","title":"转身","prompt":"人物缓慢转身","targetNodeId":"dlg-1",
               "settings":{"video":{"mode":"i2v","resolutionTier":"768p"},"durationSec":5,"aspectRatio":"9:16","count":1,
                 "referenceBindings":[{"nodeId":"frame-1","role":"frame","order":0}]}},
              {"id":"s2","operation":"video","title":"挥手","prompt":"挥手","targetNodeId":"dlg-1",
               "settings":{"video":{"mode":"t2v","resolutionTier":"768p"},"durationSec":5,"aspectRatio":"9:16","count":1}},
              {"id":"s3","operation":"video","title":"走开","prompt":"走开","targetNodeId":"invented",
               "settings":{"video":{"mode":"t2v","resolutionTier":"768p"},"durationSec":5,"aspectRatio":"9:16","count":1}},
              {"id":"c1","operation":"check","title":"检查","targetNodeId":"dlg-2","settings":{"targetStepId":"s1","checkIds":["scene-and-action"]}}],
             "questions":[]}""");
        JsonNode plan=StudioPlanValidator.validateSkillPlan(raw,videoRules(),"production",List.of("dlg-1","dlg-2","frame-1"));
        assertEquals("dlg-1",plan.path("steps").get(0).path("targetNodeId").asText());
        assertFalse(plan.path("steps").get(1).has("targetNodeId"),"one object, one step");
        assertFalse(plan.path("steps").get(2).has("targetNodeId"),"not on the asset list");
        assertFalse(plan.path("steps").get(3).has("targetNodeId"),"a check never fills an object");
    }
}
