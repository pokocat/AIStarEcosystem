package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.service.StudioVideoService;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import java.util.HashMap;
import java.util.Map;

/**
 * Server quotes for a normalized skill plan. Each step is compiled with the same {@link StudioPlanSteps} compiler the
 * executor submits with, using placeholder keys (prices depend on counts, never on the bytes), then priced by the native
 * pipelines. Never freezes anything.
 */
@Component
public class StudioPlanQuoter {
    private final StudioWorkflowService workflow;
    private final ObjectProvider<StudioVideoService> videos;
    public StudioPlanQuoter(StudioWorkflowService workflow,ObjectProvider<StudioVideoService> videos) {this.workflow=workflow;this.videos=videos;}

    public void quote(String userId,ObjectNode plan) {
        long total=0;
        for(JsonNode step:plan.path("steps")) {
            long cost=workflow.quote(userId,StudioPlanSteps.request(step,PLACEHOLDERS,modes(step.path("settings").path("model").asText(null)),null));
            ((ObjectNode)step).put("quotedCost",cost);
            total=Math.addExact(total,cost);
        }
        // autoFixChecks is empty in this version: no auto-fix allowance is ever quoted or approved.
        plan.putObject("budget").put("estimated",total).put("autoFixCap",0);
    }

    /**
     * 确认卡上给人看的预估（2026-11-06 用户要求：卡上写 482、实际扣 189，数字吓人）。上面的 estimated 是用户授权的上限，
     * 按标准价加文字任务的冻结额度算，这里按折后价和一般用量算。只影响显示，不进方案指纹，算不出来的步骤按上限计。
     * 不放进 {@link #quote}：长视频查价在只读事务里调它，这里的异常不该把那个事务标成回滚。
     */
    public void estimate(String userId,ObjectNode plan) {
        long expected=0;
        for(JsonNode step:plan.path("steps")) {
            long quoted=step.path("quotedCost").asLong();
            expected=Math.addExact(expected,workflow.expectedCost(userId,StudioPlanSteps.request(step,PLACEHOLDERS,modes(step.path("settings").path("model").asText(null)),null),quoted));
        }
        ((ObjectNode)plan.path("budget")).put("expected",Math.min(expected,plan.path("budget").path("estimated").asLong()));
    }

    /** 这一步视频本身的价，不含先改写提示词的冻结上限（那是按实际用量结算的文字任务）。 */
    public long videoOnly(String userId,JsonNode step) {
        ObjectNode copy=step.deepCopy();
        ((ObjectNode)copy.path("settings").path("video")).put("optimize",false);
        return workflow.quote(userId,StudioPlanSteps.request(copy,PLACEHOLDERS,modes(copy.path("settings").path("model").asText(null)),null));
    }

    /** Video modes of the default Studio video model (the model video steps run on). */
    public StudioPlanSteps.Modes modes() {return modes(null);}

    /** Video modes of the model a step names; without one, the default. */
    public StudioPlanSteps.Modes modes(String model) {
        StudioVideoService service=videos.getIfAvailable();
        Map<String,StudioPlanSteps.ModeSpec> specs=new HashMap<>();
        if(service!=null) {
            var models=service.models();
            var chosen=models.stream().filter(m->model==null?m.isDefault():model.equals(m.endpointId())).findFirst().orElse(model==null&&!models.isEmpty()?models.get(0):null);
            if(chosen!=null&&chosen.contract()!=null)for(var mode:chosen.contract().modes())
                specs.put(mode.mode(),new StudioPlanSteps.ModeSpec(mode.needsFirstFrame(),mode.needsLastFrame(),mode.references()!=null,chosen.supportsPromptOptimization()));
        }
        return specs::get;
    }

    private static final StudioPlanSteps.Keys PLACEHOLDERS=new StudioPlanSteps.Keys() {
        @Override public String binding(JsonNode binding){return "plan-quote/"+binding.path("order").asInt();}
        @Override public String clip(JsonNode clip){return "plan-quote/clip";}
        @Override public String sourceAudio(){return "plan-quote/audio";}
    };
}
