package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Set;

/** Model output is an editable suggestion, never executable code or permission to spend. */
public final class StudioPlanValidator {
    private StudioPlanValidator() {}
    /** Unknown names remain visible for human resolution, never resolved by guessing another node. */
    public static void isolateUnsupportedSteps(JsonNode plan) {
        if(!plan.isObject()||!plan.path("steps").isArray())return;
        var object=(com.fasterxml.jackson.databind.node.ObjectNode)plan;
        var supported=object.arrayNode();var notes=object.arrayNode();
        if(plan.path("notes").isArray())plan.path("notes").forEach(notes::add);
        for(var step:plan.path("steps")) {
            if(Set.of("script","storyboard","image","video").contains(step.path("operation").asText()))supported.add(step);
            else if(step.path("title").isTextual()&&step.path("prompt").isTextual()&&step.path("prompt").asText().length()<=16000)
                notes.add(step.path("title").asText()+"："+step.path("prompt").asText());
            else fail();
        }
        object.set("steps",supported);if(!notes.isEmpty())object.set("notes",notes);
    }
    public static void isolateUnresolvedReferences(JsonNode plan,JsonNode contextIds) {
        Set<String> allowed=new HashSet<>();if(contextIds!=null)contextIds.forEach(id->allowed.add(id.asText()));
        for(var step:plan.path("steps"))if(step.isObject() && step.path("referenceNodeIds").isArray()) {
            var object=(com.fasterxml.jackson.databind.node.ObjectNode)step;
            var known=object.arrayNode();var missing=object.arrayNode();
            for(var ref:step.path("referenceNodeIds")) {if(ref.isTextual()&&allowed.contains(ref.asText()))known.add(ref);else missing.add(ref);}
            object.set("referenceNodeIds",known);if(!missing.isEmpty())object.set("unresolvedReferences",missing);
        }
    }
    public static void validate(JsonNode plan,JsonNode contextIds) {
        if(!plan.isObject() || !plan.path("summary").isTextual() || plan.path("summary").asText().isBlank()
                || !plan.path("steps").isArray() || plan.path("steps").size()>12 || !plan.path("questions").isArray()) fail();
        Set<String> allowed=new HashSet<>(),ids=new HashSet<>();
        if(contextIds!=null) contextIds.forEach(id->allowed.add(id.asText()));
        for(var step:plan.path("steps")) {
            if(!step.path("id").isTextual() || step.path("id").asText().isBlank() || !ids.add(step.path("id").asText())
                    || !Set.of("script","storyboard","image","video").contains(step.path("operation").asText())
                    || !step.path("title").isTextual() || !step.path("prompt").isTextual() || step.path("prompt").asText().isBlank()
                    || step.path("prompt").asText().length()>16000 || !step.path("referenceNodeIds").isArray()) fail();
            for(var id:step.path("referenceNodeIds")) if(!id.isTextual() || !allowed.contains(id.asText())) fail();
            if(step.has("unresolvedReferences")) {
                if(!step.path("unresolvedReferences").isArray() || step.path("unresolvedReferences").size()>16)fail();
                for(var value:step.path("unresolvedReferences"))if(!value.isTextual()||value.asText().length()>128)fail();
            }
        }
        if(plan.has("notes")) {
            if(!plan.path("notes").isArray()||plan.path("notes").size()>12)fail();
            for(var note:plan.path("notes"))if(!note.isTextual()||note.asText().length()>16500)fail();
        }
        for(var question:plan.path("questions")) if(!question.isTextual()) fail();
    }
    private static void fail() {throw BusinessException.badRequest("AI_BAD_OUTPUT","创作方案不完整，请重试");}
}
