package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Set;

/** Reject malformed provider responses before they reach the editor or settle a hold. */
public final class StudioScriptValidator {
    private StudioScriptValidator() {}
    public static void validate(JsonNode script) {
        validate(script,0,0);
    }
    public static void validate(JsonNode script,int expectedEpisodes,int onlyEpisode) {
        if(script==null || !script.isObject()) fail();
        text(script,"title",true);text(script,"outline",false);
        for(String field:new String[]{"characters","scenes","props"}) {
            array(script,field,false);
            for(JsonNode item:script.path(field)) {text(item,"name",true);text(item,"description",false);}
        }
        array(script,"episodes",true);array(script,"shots",true);
        Set<Integer> episodes=new HashSet<>();
        for(JsonNode episode:script.path("episodes")) {
            if(!episode.path("no").isIntegralNumber() || episode.path("no").asInt()<1 || !episodes.add(episode.path("no").asInt())) fail();
            text(episode,"title",false);text(episode,"content",true);
        }
        if(expectedEpisodes>0 && onlyEpisode==0 && episodes.size()!=expectedEpisodes) fail();
        if(onlyEpisode>0 && (episodes.size()!=1 || !episodes.contains(onlyEpisode))) fail();
        Set<String> ids=new HashSet<>();
        Set<Integer> covered=new HashSet<>();
        for(JsonNode shot:script.path("shots")) {
            text(shot,"id",true);text(shot,"title",false);text(shot,"description",true);text(shot,"dialogue",false);
            if(!ids.add(shot.path("id").asText()) || !shot.path("durationSec").isNumber() || !Double.isFinite(shot.path("durationSec").asDouble()) || shot.path("durationSec").asDouble()<=0 || shot.path("durationSec").asDouble()>120) fail();
            array(shot,"characters",false);
            for(JsonNode name:shot.path("characters")) if(!name.isTextual()) fail();
            if(shot.has("episodeNo") && (!shot.path("episodeNo").isIntegralNumber() || !episodes.contains(shot.path("episodeNo").asInt()))) fail();
            if((episodes.size()>1 || onlyEpisode>0) && !shot.has("episodeNo")) fail();
            covered.add(shot.path("episodeNo").asInt(episodes.iterator().next()));
        }
        if(!covered.containsAll(episodes)) fail();
    }
    private static void text(JsonNode node,String field,boolean required) {
        if(!node.path(field).isTextual() || required && node.path(field).asText().isBlank()) fail();
    }
    private static void array(JsonNode node,String field,boolean required) {
        if(!node.path(field).isArray() || required && node.path(field).isEmpty()) fail();
    }
    private static void fail() {throw BusinessException.badRequest("AI_BAD_OUTPUT","剧本结果不完整，请重新生成");}
}
