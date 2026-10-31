package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.*;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;

/**
 * Compiles one normalized plan step into the native {@code studio-runs} request. The same compiler serves the plan quote
 * (placeholder keys, counts only) and the real submission (keys resolved from canvas nodes and earlier native outputs),
 * so a quote and the request it approves cannot drift apart.
 */
public final class StudioPlanSteps {
    private StudioPlanSteps() {}

    /** What a video mode consumes, read from the selected model's contract. */
    /** rewrite：所选视频模型出片前会改写描述（H3），视频步骤先按官方写法改写提示词再出片（2026-10-27）。 */
    public record ModeSpec(boolean firstFrame,boolean lastFrame,boolean references,boolean rewrite) {
        public ModeSpec(boolean firstFrame,boolean lastFrame,boolean references){this(firstFrame,lastFrame,references,false);}
    }
    /** Resolves a reference binding / clip / check target to a real storage key (or a quote placeholder). */
    public interface Keys {
        String binding(JsonNode binding);
        String clip(JsonNode clip);
        /** Source audio of the analysis film study, for assemble with audioStrategy=source-audio; null when absent. */
        String sourceAudio();
        /** Canvas ratio of the clips being assembled. */
        default String aspectRatio() {return "9:16";}
    }
    public interface Modes {ModeSpec spec(String mode);}
    /** Execution identity attached to a real submission; null for quotes. */
    public record Binding(String clientRequestId,String nodeId,Long maxCost,BillingSelection billing,String executionId,
                          String skillKey,Integer skillVersion,String stage,List<String> canvasContextIds,CheckSettings check) {}

    /**
     * What a check judges against. The planner's check prompt alone often said nothing about who is replaced by whom, and a
     * checker that saw 「三位成年男性」 in a segment meant to replace three old men with babies still reported no old subject
     * (production, 2026-10-19). The confirmed approach's 改变 / 保留 and the checked step's own instruction go first, then
     * the planner's words. Deterministic, so a resubmission after a restart sends the same request.
     */
    public static String checkTarget(JsonNode plan,String approachId,JsonNode targetDefinition,String checkPrompt) {
        StringBuilder out=new StringBuilder();
        String shown=targetDefinition==null?"":targetDefinition.path("prompt").asText("").strip();
        if(!shown.isEmpty())out.append("这一段应当呈现：").append(clip(shown,1500)).append('\n');
        JsonNode approach=null;
        if(plan!=null)for(JsonNode a:plan.path("approaches"))if(a.path("id").asText("").equals(approachId))approach=a;
        if(approach!=null) {
            String change=joined(approach.path("change")),keep=joined(approach.path("preserve"));
            if(!change.isEmpty())out.append("这次制作要改变的（旧的不应再出现）：").append(change).append('\n');
            if(!keep.isEmpty())out.append("要保留的：").append(keep).append('\n');
        }
        if(out.length()>0)out.append("画面里仍是要被替换掉的旧主体，或新主体与上面写的不符，subject-replaced 和 old-subject-residue 判 fail；看不清是不是同一批人或物判 unknown，不判 pass。\n");
        String own=checkPrompt==null?"":checkPrompt.strip();
        if(!own.isEmpty())out.append(out.length()>0?"检查要点：":"").append(own);
        return out.toString().strip();
    }
    private static String joined(JsonNode list) {
        List<String> out=new ArrayList<>();
        for(JsonNode v:list)if(v.isTextual()&&!v.asText().isBlank())out.add(v.asText().strip());
        return clip(String.join("；",out),1500);
    }
    private static String clip(String text,int max){return text.length()<=max?text:text.substring(0,max);}

    public static RunRequest request(JsonNode step,Keys keys,Modes modes,Binding binding) {
        String operation=step.path("operation").asText();
        JsonNode settings=step.path("settings");
        String prompt=step.path("prompt").asText("");
        String requestId=binding==null?"quote":binding.clientRequestId(),nodeId=binding==null?"quote":binding.nodeId();
        Long maxCost=binding==null?null:binding.maxCost();
        BillingSelection billing=binding==null?null:binding.billing();
        String executionId=binding==null?null:binding.executionId();
        String stage=binding==null?null:binding.stage();
        List<String> context=binding==null?List.of():binding.canvasContextIds();
        return switch(operation) {
            case "recreation" -> new RunRequest(requestId,nodeId,"recreation",prompt,null,null,null,null,null,null,null,null,"segments",
                    List.of(settings.path("sourceNodeId").asText()),null,maxCost,null,null,null,null,null,billing,
                    new RecreationSettings(settings.path("maxSegmentSec").asText("model"),settings.path("videoModel").asText()),null,null,null,stage,executionId,null);
            case "text" -> "plan-compile".equals(settings.path("purpose").asText())
                    ? new RunRequest(requestId,nodeId,"text",prompt,null,null,null,null,null,null,null,null,null,context.isEmpty()?null:context,null,maxCost,null,null,null,null,null,billing,
                        null,null,binding==null?null:binding.skillKey(),binding==null?null:binding.skillVersion(),"production",executionId,null)
                    : new RunRequest(requestId,nodeId,"text",prompt,null,null,null,null,null,null,null,null,null,context.isEmpty()?null:context,null,maxCost,null,null,null,null,
                        new TextEdit(settings.path("editTarget").path("snapshot").asText("")),billing,null,null,null,null,stage,executionId,null);
            case "image" -> {
                List<Reference> refs=new ArrayList<>();
                for(JsonNode b:ordered(settings.path("referenceBindings")))refs.add(new Reference(null,null,null,keys.binding(b),imageRole(b.path("role").asText()),null));
                yield new RunRequest(requestId,nodeId,"image",prompt,refs,null,settings.path("size").asText(null),null,settings.path("aspectRatio").asText(null),settings.path("count").asInt(1),
                        null,null,null,null,null,maxCost,null,null,null,null,null,billing,null,null,null,null,stage,executionId,null);
            }
            case "video" -> new RunRequest(requestId,nodeId,"video",prompt,List.of(),null,null,settings.path("durationSec").asInt(),settings.path("aspectRatio").asText(),
                    settings.path("count").asInt(1),null,null,null,null,null,maxCost,null,video(settings,keys,modes),null,null,null,billing,null,null,null,null,stage,executionId,null);
            case "check" -> new RunRequest(requestId,nodeId,"check",prompt,null,null,null,null,null,null,null,null,null,null,null,maxCost,null,null,null,null,null,billing,
                    null,binding==null?new CheckSettings("quote",null,strings(settings.path("checkIds"))):binding.check(),
                    binding==null?null:binding.skillKey(),binding==null?null:binding.skillVersion(),stage,executionId,null);
            case "assemble" -> {
                List<Reference> clips=new ArrayList<>();
                for(JsonNode clip:settings.path("clipOrder"))clips.add(new Reference(null,null,null,keys.clip(clip),"clip",null));
                Packaging packaging=null;
                if("source-audio".equals(settings.path("audioStrategy").asText())) {
                    String audio=keys.sourceAudio();
                    if(audio==null)throw BusinessException.badRequest("STUDIO_SOURCE_AUDIO_UNAVAILABLE","原片没有可用的音轨，不能按原声合成");
                    packaging=new Packaging(null,null,null,null,audio);
                }
                yield new RunRequest(requestId,nodeId,"assemble",prompt.isBlank()?"按计划顺序合成成片":prompt,clips,null,null,null,keys.aspectRatio(),null,null,null,null,null,null,maxCost,packaging,null,null,null,null,billing,
                        null,null,null,null,stage,executionId,null);
            }
            default -> throw BusinessException.wrapped(org.springframework.http.HttpStatus.BAD_REQUEST,"STUDIO_SKILL_OPERATION_NOT_ALLOWED","这一步现在还不能自动做",
                    "no automatic submission for operation "+step.path("operation").asText());
        };
    }

    private static VideoSettings video(JsonNode settings,Keys keys,Modes modes) {
        JsonNode video=settings.path("video");
        String mode=video.path("mode").asText();
        ModeSpec spec=modes.spec(mode);
        if(spec==null)throw BusinessException.badRequest("STUDIO_VIDEO_MODE_UNAVAILABLE","所选视频模型不支持这一步的视频模式");
        String first=null,last=null;List<VideoStudioReferenceInput> references=new ArrayList<>();
        List<JsonNode> frames=new ArrayList<>(),others=new ArrayList<>();
        for(JsonNode b:ordered(settings.path("referenceBindings")))("frame".equals(b.path("role").asText())?frames:others).add(b);
        if(spec.firstFrame()) {
            if(frames.isEmpty())throw BusinessException.badRequest("STUDIO_VIDEO_FIRST_FRAME_REQUIRED","这一步的视频模式需要一张首帧图");
            first=keys.binding(frames.remove(0));
        }
        if(spec.lastFrame()) {
            if(frames.isEmpty())throw BusinessException.badRequest("STUDIO_VIDEO_LAST_FRAME_REQUIRED","这一步的视频模式需要一张尾帧图");
            last=keys.binding(frames.remove(0));
        }
        others.addAll(0,frames);
        if(!others.isEmpty()&&!spec.references())throw BusinessException.badRequest("STUDIO_VIDEO_INPUT_INVALID","这一步的视频模式不接受其他参考素材");
        for(JsonNode b:others)references.add(new VideoStudioReferenceInput(mediaType(b.path("role").asText()),keys.binding(b)));
        Long seed=video.hasNonNull("seed")?video.path("seed").asLong():null;
        return new VideoSettings(mode,video.path("resolutionTier").asText(),seed,first,last,references.isEmpty()?null:references,null,spec.rewrite()?"auto":null);
    }
    static List<JsonNode> ordered(JsonNode bindings) {
        List<JsonNode> out=new ArrayList<>();if(bindings.isArray())bindings.forEach(out::add);
        out.sort(Comparator.comparingInt(b->b.path("order").asInt()));
        return out;
    }
    static String mediaType(String role) {
        return switch(role){case "reference-video","clip" -> "video";case "reference-audio" -> "audio";default -> "image";};
    }
    private static String imageRole(String role) {return "reference-image".equals(role)?"frame":role;}
    private static List<String> strings(JsonNode array){List<String> out=new ArrayList<>();array.forEach(v->out.add(v.asText()));return out;}
}
