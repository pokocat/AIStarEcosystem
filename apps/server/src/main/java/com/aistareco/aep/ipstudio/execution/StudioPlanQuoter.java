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
        var modes=modes();
        long total=0;
        for(JsonNode step:plan.path("steps")) {
            long cost=workflow.quote(userId,StudioPlanSteps.request(step,PLACEHOLDERS,modes,null));
            ((ObjectNode)step).put("quotedCost",cost);
            total=Math.addExact(total,cost);
        }
        // autoFixChecks is empty in this version: no auto-fix allowance is ever quoted or approved.
        plan.putObject("budget").put("estimated",total).put("autoFixCap",0);
    }

    /** Video modes of the default Studio video model (the model video steps run on). */
    public StudioPlanSteps.Modes modes() {
        StudioVideoService service=videos.getIfAvailable();
        Map<String,StudioPlanSteps.ModeSpec> specs=new HashMap<>();
        if(service!=null) {
            var models=service.models();
            var chosen=models.stream().filter(m->m.isDefault()).findFirst().orElse(models.isEmpty()?null:models.get(0));
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
