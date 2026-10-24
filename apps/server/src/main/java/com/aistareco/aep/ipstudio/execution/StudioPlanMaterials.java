package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.service.IpDocs;
import com.aistareco.aep.ipstudio.service.StudioPlanValidator;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.*;

/**
 * The canvas materials a confirmed dialogue plan may use: the one rule behind {@code stepsJson.canvasContextIds}
 * (docs/ip-studio-dialogue-intents.md 「方案素材范围跨轮」).
 *
 * <p>Production, 2026-10-23: the user picked 「原视频」 and 「三视图」 in the first message, the plan came two messages later,
 * and the confirmed analysis kept only the plan turn's (empty) picks plus the source video. Plan-compile then rejected the
 * production plan three times for naming 「三视图」. In priority order: the plan turn's picks, the plan's
 * {@code materialNodeIds}, the canvas objects its steps name, then what earlier user messages of the conversation picked or
 * attached (newest first). Only objects still on the canvas count, never the whole canvas, at most
 * {@value StudioPlanValidator#MAX_MATERIALS} (the cap of a request's canvas context).
 */
final class StudioPlanMaterials {
    private static final Logger log=LoggerFactory.getLogger(StudioPlanMaterials.class);
    private StudioPlanMaterials() {}

    static List<String> scope(JsonNode doc,List<String> turnContext,JsonNode plan,List<String> conversationPicks) {
        LinkedHashSet<String> ordered=new LinkedHashSet<>();
        if(turnContext!=null)ordered.addAll(turnContext);
        for(JsonNode id:plan.path("materialNodeIds"))if(id.isTextual())ordered.add(id.asText());
        for(JsonNode step:plan.path("steps"))PlanState.canvasRefs(step,ordered);
        if(conversationPicks!=null)ordered.addAll(conversationPicks);
        Set<String> onCanvas=new HashSet<>();
        for(JsonNode node:IpDocs.nodes(doc))if(node.path("id").isTextual())onCanvas.add(node.path("id").asText());
        List<String> out=new ArrayList<>();
        for(String id:ordered)if(id!=null&&!id.isBlank()&&onCanvas.contains(id))out.add(id);
        if(out.size()>StudioPlanValidator.MAX_MATERIALS) {
            log.info("[plan-exec] material scope capped kept={} dropped={}",StudioPlanValidator.MAX_MATERIALS,out.subList(StudioPlanValidator.MAX_MATERIALS,out.size()));
            return List.copyOf(out.subList(0,StudioPlanValidator.MAX_MATERIALS));
        }
        return List.copyOf(out);
    }

    /**
     * The objects a rejected plan named outside its scope, as the user sees them: {@code [{nodeId,title,onCanvas}]}.
     * Ids are kept (the client focuses and adds by id) but never shown as text.
     */
    static ArrayNode describe(JsonNode doc,JsonNode nodeIds) {
        Map<String,JsonNode> nodes=new HashMap<>();
        for(JsonNode node:IpDocs.nodes(doc))if(node.path("id").isTextual())nodes.put(node.path("id").asText(),node);
        ArrayNode out=JsonNodeFactory.instance.arrayNode();
        Set<String> seen=new HashSet<>();
        for(JsonNode id:nodeIds) {
            if(!id.isTextual()||id.asText().isBlank()||!seen.add(id.asText())||seen.size()>StudioPlanValidator.MAX_MATERIALS)continue;
            JsonNode node=nodes.get(id.asText());
            String title=node==null?"":node.path("title").asText("").strip();
            out.addObject().put("nodeId",id.asText()).put("title",title).put("onCanvas",node!=null);
        }
        return out;
    }

    /** One sentence naming them: what the user can act on. */
    static String reason(JsonNode materials) {
        List<String> named=new ArrayList<>();int unnamed=0,gone=0;
        for(JsonNode m:materials) {
            if(!m.path("onCanvas").asBoolean())gone++;
            else if(m.path("title").asText("").isBlank())unnamed++;
            else named.add("「"+m.path("title").asText()+"」");
        }
        List<String> parts=new ArrayList<>(named);
        if(unnamed>0)parts.add(unnamed==1?"一个未命名的对象":unnamed+" 个未命名的对象");
        String present=parts.isEmpty()?"":"方案要用画布上的"+String.join("、",parts)+"，但这次制作没有带上"+(named.size()+unnamed>1?"它们":"它");
        String missing=gone==0?"":"方案用到的"+(gone>1?gone+" 个素材":"一个素材")+"已经不在画布上了";
        return present.isEmpty()?missing:missing.isEmpty()?present:present+"；"+missing;
    }
    static boolean anyOnCanvas(JsonNode materials) {
        for(JsonNode m:materials)if(m.path("onCanvas").asBoolean())return true;
        return false;
    }
}
