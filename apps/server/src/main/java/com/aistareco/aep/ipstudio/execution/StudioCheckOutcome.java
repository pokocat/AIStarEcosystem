package com.aistareco.aep.ipstudio.execution;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import java.util.*;

/**
 * Normalizes a model's check answer into {@code output.check} (StudioCheckResult). Engineering owns the evidence source:
 * frame times must be among the real sampled times, unknown items stay unknown, and the overall verdict is recomputed
 * here. A model "pass" without valid evidence is downgraded to unknown, never accepted.
 */
public final class StudioCheckOutcome {
    private static final ObjectMapper OM=new ObjectMapper();
    private static final Set<String> VERDICTS=Set.of("pass","fail","unknown");
    private StudioCheckOutcome() {}

    /**
     * @param sampledTimesSec real sample times of a video target; empty for an image target (one real image, no clock)
     * @param mediaFacts true when the prompt carried server-measured media facts (duration, size, audio presence)
     */
    public static ObjectNode normalize(JsonNode answer,List<String> checkIds,List<Double> sampledTimesSec,boolean image,
                                       boolean mediaFacts,String targetRunId,String targetStorageKey) {
        if(answer==null||!answer.isObject()||!answer.path("items").isArray()||answer.toString().length()>48000)
            throw new BusinessException(HttpStatus.BAD_GATEWAY,"AI_BAD_OUTPUT","检查结果不完整，本次未扣积分，请重试");
        Map<String,JsonNode> byId=new LinkedHashMap<>();
        for(JsonNode item:answer.path("items"))if(item.isObject()&&item.path("id").isTextual())byId.putIfAbsent(item.path("id").asText(),item);
        ObjectNode result=OM.createObjectNode();
        ArrayNode items=OM.createArrayNode();
        boolean anyFail=false,allPass=!checkIds.isEmpty();
        for(String id:checkIds) {
            JsonNode raw=byId.get(id);
            ObjectNode item=items.addObject().put("id",id);
            if(raw==null) {
                item.put("status","unknown");item.putArray("evidence");item.put("reason","模型没有给出这一项的判断");
                allPass=false;continue;
            }
            String status=raw.path("status").asText("unknown");
            if(!VERDICTS.contains(status))status="unknown";
            ArrayNode evidence=item.putArray("evidence");
            boolean grounded=false,dropped=false;
            if(raw.path("evidence").isArray())for(JsonNode e:raw.path("evidence")) {
                if(evidence.size()>=8)break;
                String kind=e.path("kind").asText("");
                String observation=e.path("observation").asText("").strip();
                if(observation.isEmpty()||observation.length()>1000||!Set.of("frame","media","text").contains(kind)){dropped=true;continue;}
                ObjectNode out=OM.createObjectNode().put("kind",kind).put("observation",observation);
                if("frame".equals(kind)) {
                    if(image) {
                        // One real image: a frame observation needs no clock, and a clock would be invented.
                        if(e.hasNonNull("timeSec")){dropped=true;continue;}
                        grounded=true;
                    } else {
                        Double at=matching(e.path("timeSec"),sampledTimesSec);
                        if(at==null){dropped=true;continue;}
                        out.put("timeSec",at);grounded=true;
                    }
                } else if("media".equals(kind)) {
                    if(e.hasNonNull("timeSec")){Double at=matching(e.path("timeSec"),sampledTimesSec);if(at==null){dropped=true;continue;}out.put("timeSec",at);}
                    grounded|=mediaFacts;
                }
                // "text" evidence is kept as context but never alone justifies a verdict.
                evidence.add(out);
            }
            String reason=raw.path("reason").asText("").strip();
            if(reason.length()>2000)reason=reason.substring(0,2000);
            if(!"unknown".equals(status)&&!grounded) {
                status="unknown";
                reason=(reason.isEmpty()?"":reason+"；")+"没有可核对的真实画面依据，按无法判断处理";
            } else if(dropped&&reason.isEmpty())reason="部分依据无法对应真实采样画面，已隐藏";
            if(reason.isEmpty())reason="unknown".equals(status)?"现有采样画面不足以判断":"见依据";
            item.put("status",status).put("reason",reason);
            String suggestion=raw.path("suggestion").asText("").strip();
            if(!suggestion.isEmpty())item.put("suggestion",suggestion.length()>2000?suggestion.substring(0,2000):suggestion);
            anyFail|="fail".equals(status);allPass&="pass".equals(status);
        }
        result.put("status",anyFail?"fail":allPass?"pass":"unknown").put("targetRunId",targetRunId);
        if(targetStorageKey!=null)result.put("targetStorageKey",targetStorageKey);
        var times=result.putArray("sampledTimesSec");sampledTimesSec.forEach(times::add);
        result.set("items",items);
        return result;
    }

    private static Double matching(JsonNode value,List<Double> sampled) {
        if(!value.isNumber())return null;
        double at=value.asDouble();
        for(double t:sampled)if(Math.abs(t-at)<=0.051)return t;
        return null;
    }

    /** 按镜头抽帧时最多交给模型几帧。 */
    public static final int MAX_SHOT_FRAMES=24;

    /**
     * 按镜头抽帧：每个镜头取开头和结尾各一帧（离切点 0.3 秒，短镜头按比例收），不到 0.8 秒的镜头取中间一帧，超过 4 秒的再加中间一帧。
     * 均匀抽 4 帧时，一段 14 秒 9 个镜头的成片多数镜头一帧都看不到，「第 3 镜端的是不是炒饭」无从判断（2026-11-10 评审）。
     * 没有测到切镜（一镜到底，或没测成）时改成大约每 2 秒一帧。超过 {@link #MAX_SHOT_FRAMES} 帧时均匀抽稀。
     *
     * @param cuts 成片里真实的切镜时间（秒，升序）
     */
    public static List<Double> shotTimes(double durationSec,List<Double> cuts) {
        if(cuts==null||cuts.isEmpty())return sampleTimes(durationSec,(int)Math.max(4,Math.min(12,Math.ceil(durationSec/2))));
        List<Double> bounds=new ArrayList<>();bounds.add(0d);
        for(double c:cuts)if(c>bounds.get(bounds.size()-1)+.05&&c<durationSec-.05)bounds.add(c);
        bounds.add(durationSec);
        List<Double> picked=new ArrayList<>();
        for(int i=0;i+1<bounds.size();i++) {
            double a=bounds.get(i),b=bounds.get(i+1),length=b-a;
            if(length<.8){picked.add(a+length/2);continue;}
            double edge=Math.min(.3,length*.25);
            picked.add(a+edge);
            if(length>4)picked.add(a+length/2);
            picked.add(b-edge);
        }
        if(picked.size()>MAX_SHOT_FRAMES) {
            List<Double> thinned=new ArrayList<>();
            for(int i=0;i<MAX_SHOT_FRAMES;i++)thinned.add(picked.get((int)((long)i*picked.size()/MAX_SHOT_FRAMES)));
            picked=thinned;
        }
        List<Double> out=new ArrayList<>();
        for(double t:picked) {
            double at=Math.round(Math.max(0,Math.min(durationSec-.05,t))*100)/100.0;
            if(out.isEmpty()||at-out.get(out.size()-1)>.051)out.add(at);
        }
        return List.copyOf(out);
    }

    /** Sample times used for both the prompt and evidence verification; identical to the four-frame visual context. */
    public static List<Double> sampleTimes(double durationSec,int frames) {
        List<Double> out=new ArrayList<>();
        for(int i=0;i<frames;i++)out.add(Math.round(durationSec*(i+0.5)/frames*100)/100.0);
        return List.copyOf(out);
    }
}
