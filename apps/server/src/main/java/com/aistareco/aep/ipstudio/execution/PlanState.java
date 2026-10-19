package com.aistareco.aep.ipstudio.execution;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;

/**
 * Shape of {@code ip_plan_execution.steps_json}: {@code {skill, canvasContextIds[], steps[], children[], dialogueRuns[], steeringSeen[], summaryPosted?, needsUserReason?}}. Each step
 * keeps its confirmed definition (identical to the fingerprinted plan run), orchestration status, native run ids,
 * attempt, request identity, quote/ceiling and the user's adoption pointer. Never prices, holds or outputs.
 */
final class PlanState {
    private PlanState() {}

    static ObjectNode parse(ObjectMapper mapper,String json) {
        try {
            JsonNode node=json==null||json.isBlank()?mapper.createObjectNode():mapper.readTree(json);
            return node.isObject()?(ObjectNode)node:mapper.createObjectNode();
        } catch(Exception e){throw new IllegalStateException("Corrupt plan execution state",e);}
    }
    static List<JsonNode> stageSteps(JsonNode state,String stage) {
        List<JsonNode> out=new ArrayList<>();
        for(JsonNode step:state.path("steps"))if(stage.equals(step.path("stage").asText()))out.add(step);
        return out;
    }
    static ObjectNode step(JsonNode state,String stage,String id) {
        for(JsonNode step:state.path("steps"))
            if(stage.equals(step.path("stage").asText())&&id.equals(step.path("id").asText()))return (ObjectNode)step;
        return null;
    }
    /** Step lookup for user actions: the current stage first, then the other stage. */
    static ObjectNode stepForUser(JsonNode state,String currentStage,String id) {
        ObjectNode found=step(state,currentStage,id);
        if(found!=null)return found;
        for(JsonNode step:state.path("steps"))if(id.equals(step.path("id").asText()))return (ObjectNode)step;
        return null;
    }
    static boolean dependenciesDone(JsonNode state,JsonNode step) {
        String stage=step.path("stage").asText();
        for(JsonNode dependency:step.path("dependsOn")) {
            var target=step(state,stage,dependency.asText());
            if(target==null||!"done".equals(target.path("status").asText()))return false;
        }
        return true;
    }
    /** A finished check whose AI verdict is not pass, and which the user has not yet resolved (accept or continue). */
    static boolean unresolvedCheck(JsonNode state,JsonNode step) {
        if(!"check".equals(step.path("operation").asText())||!"done".equals(step.path("status").asText()))return false;
        if("pass".equals(step.path("checkStatus").asText())||step.path("acknowledged").asBoolean(false)||step.hasNonNull("acceptedRunId"))return false;
        var target=step(state,step.path("stage").asText(),step.path("definition").path("settings").path("targetStepId").asText());
        String checked=step.path("checkTargetRunId").asText("");
        return target==null||checked.isEmpty()||!checked.equals(target.path("acceptedRunId").asText());
    }
    /** A dialogue child run authorized on this execution (by request identity). */
    static ObjectNode child(JsonNode state,String clientRequestId) {
        for(JsonNode child:state.path("children"))if(clientRequestId.equals(child.path("clientRequestId").asText()))return (ObjectNode)child;
        return null;
    }
    /** A parent dialogue turn attributed to this execution's stage budget (D06), by run id. */
    static ObjectNode dialogueRun(JsonNode state,String runId) {
        for(JsonNode run:state.path("dialogueRuns"))if(runId.equals(run.path("runId").asText()))return (ObjectNode)run;
        return null;
    }
    /** Steering the executor (or a newer explicit user decision) already handled (D03); bounded to the latest 200. */
    static boolean steeringSeen(JsonNode state,String steeringId) {
        for(JsonNode id:state.path("steeringSeen"))if(steeringId.equals(id.asText()))return true;
        return false;
    }
    static void markSteeringSeen(ObjectNode state,String steeringId) {
        if(steeringSeen(state,steeringId))return;
        ArrayNode seen=state.withArray("steeringSeen");
        seen.add(steeringId);
        while(seen.size()>200)seen.remove(0);
    }
    static List<String> stageTitles(JsonNode state,String stage) {
        List<String> out=new ArrayList<>();
        for(JsonNode step:stageSteps(state,stage))out.add(step.path("title").asText());
        return out;
    }
}
