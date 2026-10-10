package com.aistareco.aep.ipstudio.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpProjectDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.AdoptResult;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Reference;

/** Mirrors packages/types/src/ip-studio-template.ts. Recipes never contain provider or media credentials. */
public final class StudioTemplateDtos {
    private StudioTemplateDtos() {}
    public record Input(String id,String nodeId,String label,String type,boolean required,List<String> options,String defaultValue) {}
    public record Video(String mode,String resolutionTier,Long seed) {}
    public record Step(String id,String nodeId,String title,String operation,String prompt,List<String> references,String size,String outputRole,boolean requiresAdoption,Integer durationSec,String aspectRatio,Video video) {
        public Step(String id,String nodeId,String title,String operation,String prompt,List<String> references,String size,String outputRole,boolean requiresAdoption){this(id,nodeId,title,operation,prompt,references,size,outputRole,requiresAdoption,null,null,null);}
    }
    public record Recipe(List<Input> inputs,List<Step> steps) {}
    public record Version(String id,String templateId,int version,String name,String summary,String visibility,Recipe recipe,JsonNode doc,String createdAt) {}
    public record PublishRequest(String templateId,String name,String summary,String visibility,Recipe recipe) {}
    public record Value(String text,Reference reference) {}
    public record UseRequest(String name,String versionId,Map<String,Value> inputs,String model,String videoModel) {
        public UseRequest(String name,String versionId,Map<String,Value> inputs,String model){this(name,versionId,inputs,model,null);}
    }
    public record PlanStep(String id,String title,String nodeId,String outputRole,long cost,String status,List<String> dependsOn,boolean requiresAdoption,String operation) {
        public PlanStep(String id,String title,String nodeId,String outputRole,long cost,String status,List<String> dependsOn,boolean requiresAdoption){this(id,title,nodeId,outputRole,cost,status,dependsOn,requiresAdoption,"image");}
    }
    public record Plan(String versionId,int version,String model,long totalCost,int imageCount,List<PlanStep> steps,String videoModel,int videoCount) {
        public Plan(String versionId,int version,String model,long totalCost,int imageCount,List<PlanStep> steps){this(versionId,version,model,totalCost,imageCount,steps,null,0);}
    }
    public record Instance(IpProjectDto project,Version source,Plan plan) {}
    public record ExecutionStep(String id,String title,String nodeId,String outputRole,String status,boolean requiresAdoption,Long cost,IpRunDto run,String storageKey,String url,boolean accepted,AdoptResult adoption,String operation) {
        public ExecutionStep(String id,String title,String nodeId,String outputRole,String status,boolean requiresAdoption,Long cost,IpRunDto run,String storageKey,String url,boolean accepted,AdoptResult adoption){this(id,title,nodeId,outputRole,status,requiresAdoption,cost,run,storageKey,url,accepted,adoption,"image");}
    }
    public record Execution(String versionId,int version,List<ExecutionStep> steps,boolean complete) {}
    public record ExecuteRequest(String clientRequestId,Long maxCost,String replaceRunId,String prompt) {
        public ExecuteRequest(String clientRequestId,Long maxCost,String replaceRunId){this(clientRequestId,maxCost,replaceRunId,null);}
    }
    public record AcceptRequest(String runId,String storageKey,boolean accepted) {}
    public record PackageRequest(String title,String description,List<String> stepIds) {}
    public record AssetPackage(String id,String title,String versionId,String boardKey,String boardUrl,String bundleKey,String bundleUrl,int width,int height,int imageCount,int requiredCount,boolean complete,String createdAt) {}
    public record Metrics(String versionId,int version,String scope,int instances,int completedInstances,int generatedSteps,int acceptedSteps,int firstPassAcceptedSteps,int failedRuns,int runningRuns,long spentCredits,long pendingCredits,int packages,int archivedAssets) {}
}
