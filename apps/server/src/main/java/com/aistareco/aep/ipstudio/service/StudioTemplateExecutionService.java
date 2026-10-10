package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.*;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.*;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Finite media recipe execution. Only pointers/acceptance live here; native jobs remain the ledger truth. */
@Service
public class StudioTemplateExecutionService {
    private final StudioTemplateService templates;
    private final IpProjectService projects;
    private final StudioWorkflowService workflow;
    private final IpRunService images;
    private final FileStorageService storage;
    private final ObjectMapper mapper;
    private final StudioTemplateVideoService videos;
    public StudioTemplateExecutionService(StudioTemplateService templates,IpProjectService projects,StudioWorkflowService workflow,IpRunService images,FileStorageService storage,ObjectMapper mapper,StudioTemplateVideoService videos) {
        this.templates=templates;this.projects=projects;this.workflow=workflow;this.images=images;this.storage=storage;this.mapper=mapper;this.videos=videos;
    }

    @Transactional(readOnly=true)
    public Execution read(String owner,String projectId) {return state(owner,projects.required(owner,projectId));}

    @Transactional
    public IpRunDto execute(String owner,String projectId,String stepId,ExecuteRequest req) {
        var project=projects.requiredForUpdate(owner,projectId);
        if(req==null || req.clientRequestId()==null || !req.clientRequestId().matches("[a-zA-Z0-9_-]{1,64}"))throw bad("STUDIO_TEMPLATE_REQUEST_INVALID","请求编号无效");
        if(req.maxCost()==null || req.maxCost()<0)throw bad("STUDIO_TEMPLATE_COST_REQUIRED","请先确认本步骤的费用上限");
        var instance=templates.instance(owner,projectId);var step=step(instance,stepId);var snapshot=snapshot(project);
        var history=(ObjectNode)snapshot.withObject("/templateRequests");
        var prior=history.get(req.clientRequestId());
        if(prior!=null) {
            if(!stepId.equals(prior.path("stepId").asText()))throw bad("STUDIO_REQUEST_CHANGED","请求已用于另一个步骤");
            // JSON parsing narrows a small Long to IntNode; compare serialized values, not Jackson numeric node classes.
            if(!canonical(mapper.valueToTree(req)).toString().equals(canonical(prior.path("request")).toString()))throw conflict("STUDIO_REQUEST_CHANGED","同一请求内容已改变，请查询原任务");
            return run(owner,projectId,prior.path("runId").asText());
        }
        var execution=(ObjectNode)snapshot.withObject("/execution");var current=execution.path(stepId);
        if(current.hasNonNull("runId")) {
            var old=run(owner,projectId,current.path("runId").asText());
            if("running".equals(old.status()))throw conflict("STUDIO_TEMPLATE_RUNNING","此步骤已受理，请查询原任务");
            if(!old.id().equals(req.replaceRunId()))throw conflict("STUDIO_TEMPLATE_REPLACE_REQUIRED","请明确确认只重做这个步骤");
        } else if(req.replaceRunId()!=null)throw conflict("STUDIO_TEMPLATE_REPLACE_CHANGED","任务已变化，请刷新");
        List<Reference> refs=references(owner,projectId,instance,step,snapshot,true);
        Map<String,Value> values=values(snapshot);
        String prompt=req.prompt()==null?StudioTemplateService.render(step.prompt(),values):req.prompt().trim();
        if(prompt.isBlank() || prompt.length()>16000)throw bad("STUDIO_TEMPLATE_PROMPT_INVALID","创作指令应为 1 到 16000 字");
        String model=instance.plan().model();VideoSettings video=null;
        if("video".equals(step.operation())) {
            var quote=videos.quote(owner,step,instance.plan().videoModel(),prompt);model=quote.model();IpRunService.requireApprovedCost(req.maxCost(),quote.cost());
            if(quote.nativeMode())video=videos.settings(step,refs.stream().map(Reference::storageKey).toList());
        } else {
            var compiled=images.compileExplicit(owner,new IpRunService.IpGenerateRequest(null,prompt,refs.stream().map(Reference::storageKey).toList(),1,step.size(),model));
            images.preflight(compiled);IpRunService.requireApprovedCost(req.maxCost(),compiled.unitCost());
        }
        // Existing native service supplies the exact owner lock, idempotency, hold and afterCommit worker.
        var request=new RunRequest(req.clientRequestId(),instance.plan().steps().stream().filter(s->s.id().equals(stepId)).findFirst().orElseThrow().nodeId(),step.operation(),prompt,video==null?refs:List.of(),model,step.size(),step.durationSec(),step.aspectRatio(),1,null,null,null,null,null,req.maxCost(),null,video);
        var accepted=workflow.submit(owner,projectId,request);
        var pointer=mapper.createObjectNode().put("runId",accepted.id()).put("accepted",false).put("prompt",prompt);
        pointer.set("references",mapper.valueToTree(refs));execution.set(stepId,pointer);
        history.putObject(req.clientRequestId()).put("stepId",stepId).put("runId",accepted.id()).set("request",canonical(mapper.valueToTree(req)));
        save(project,snapshot);
        return accepted;
    }

    @Transactional
    public Execution accept(String owner,String projectId,String stepId,AcceptRequest req) {
        var project=projects.requiredForUpdate(owner,projectId);var instance=templates.instance(owner,projectId);step(instance,stepId);
        var snapshot=snapshot(project);var pointer=snapshot.path("execution").path(stepId);
        if(req==null || !Objects.equals(pointer.path("runId").asText(),req.runId()))throw conflict("STUDIO_TEMPLATE_REPLACE_CHANGED","请采用当前步骤的结果");
        var result=run(owner,projectId,req.runId());
        if(!"done".equals(result.status()) || !candidateKeys(result).contains(req.storageKey()))throw bad("STUDIO_TEMPLATE_OUTPUT_INVALID","请选择本步骤成功生成的结果");
        // Reject acceptance of an old dependency result; preserve it as historical media.
        references(owner,projectId,instance,step(instance,stepId),snapshot,true);
        if(stale(owner,projectId,instance,step(instance,stepId),snapshot))throw conflict("STUDIO_TEMPLATE_STALE","来源已改变，请只重做受影响步骤");
        ((ObjectNode)pointer).put("selectedKey",req.storageKey()).put("accepted",req.accepted());
        save(project,snapshot);return state(owner,project);
    }

    /** Explicitly archive a successful main image/derived look; no automatic identity or training claim. */
    @Transactional
    public Execution archive(String owner,String projectId,String stepId,AdoptRequest req) {
        var project=projects.requiredForUpdate(owner,projectId);var instance=templates.instance(owner,projectId);var definition=step(instance,stepId);
        if(!"image".equals(definition.operation()))throw bad("STUDIO_TEMPLATE_ARCHIVE_INTENT","视频请在画布中加入成片或保存素材，不能作为人物形象归档");
        var snapshot=snapshot(project);var pointer=snapshot.path("execution").path(stepId);
        var result=pointer.hasNonNull("runId")?run(owner,projectId,pointer.path("runId").asText()):null;
        String nodeId=instance.plan().steps().stream().filter(s->s.id().equals(stepId)).findFirst().orElseThrow().nodeId();
        if(req==null || result==null || !"done".equals(result.status()) || !candidateKeys(result).contains(req.storageKey()) || !nodeId.equals(req.nodeId()) || stale(owner,projectId,instance,definition,snapshot))throw bad("STUDIO_TEMPLATE_OUTPUT_INVALID","只能归档当前步骤已完成的图片");
        if(!"main".equals(definition.outputRole()) && !"look".equals(req.intent()))throw bad("STUDIO_TEMPLATE_ARCHIVE_INTENT","视角/表情/细节请归档为指定人物的造型，不能替换主形象");
        var adopted=workflow.adopt(owner,projectId,req);
        ((ObjectNode)pointer).put("selectedKey",req.storageKey()).put("accepted",true).set("adoption",mapper.valueToTree(adopted));
        save(project,snapshot);return state(owner,project);
    }

    private Execution state(String owner,IpProject project) {
        var instance=templates.instance(owner,project.getId());var snapshot=snapshot(project);List<ExecutionStep> result=new ArrayList<>();
        for(var step:instance.source().recipe().steps()) {
            var pointer=snapshot.path("execution").path(step.id());IpRunDto job=pointer.hasNonNull("runId")?run(owner,project.getId(),pointer.path("runId").asText()):null;
            String status="ready";Long cost=null;List<Reference> refs=null;
            try {refs=references(owner,project.getId(),instance,step,snapshot,true);}catch(BusinessException e) {status="STUDIO_TEMPLATE_ADOPTION_REQUIRED".equals(e.getCode())?"waiting_adoption":"waiting_dependency";}
            boolean stale=job!=null && stale(owner,project.getId(),instance,step,snapshot);
            if(job!=null)status=stale?"stale":job.status();
            if(refs!=null)try {
                String prompt=StudioTemplateService.render(step.prompt(),values(snapshot));
                if("video".equals(step.operation()))cost=videos.quote(owner,step,instance.plan().videoModel(),prompt).cost();
                else {var c=images.compileExplicit(owner,new IpRunService.IpGenerateRequest(null,prompt,refs.stream().map(Reference::storageKey).toList(),1,step.size(),instance.plan().model()));images.preflight(c);cost=c.unitCost();}
            }catch(BusinessException ignored){/* Existing jobs remain recoverable when a model is unavailable. Submit will fail before hold. */}
            String key=job==null?null:selected(job,pointer);
            boolean accepted=key!=null && pointer.path("accepted").asBoolean() && !stale;
            if(job!=null && "done".equals(status) && step.requiresAdoption() && !accepted)status="waiting_adoption";
            String nodeId=instance.plan().steps().stream().filter(s->s.id().equals(step.id())).findFirst().orElseThrow().nodeId();
            AdoptResult adoption=pointer.hasNonNull("adoption")?mapper.convertValue(pointer.path("adoption"),AdoptResult.class):null;
            result.add(new ExecutionStep(step.id(),step.title(),nodeId,step.outputRole(),status,step.requiresAdoption(),cost,job,key,key==null?null:storage.signedUrl(key),accepted,adoption,step.operation()));
        }
        return new Execution(instance.source().id(),instance.source().version(),result,result.stream().allMatch(s->"done".equals(s.status())));
    }

    private List<Reference> references(String owner,String projectId,Instance instance,Step step,ObjectNode snapshot,boolean requireAccepted) {
        Map<String,Value> values=values(snapshot);List<Reference> refs=new ArrayList<>();
        for(String id:step.references()) {
            var value=values.get(id);
            if(value!=null) {if(value.reference()!=null)refs.add(value.reference());continue;}
            var parent=step(instance,id);var pointer=snapshot.path("execution").path(id);
            if(!pointer.hasNonNull("runId"))throw conflict("STUDIO_TEMPLATE_DEPENDENCY_REQUIRED","请先完成「"+parent.title()+"」");
            var result=run(owner,projectId,pointer.path("runId").asText());
            if(!"done".equals(result.status()) || stale(owner,projectId,instance,parent,snapshot))throw conflict("STUDIO_TEMPLATE_DEPENDENCY_REQUIRED","前序图片未完成或来源已改变");
            String key=selected(result,pointer);
            if(key==null)throw conflict("STUDIO_TEMPLATE_DEPENDENCY_REQUIRED","前序步骤没有可用图片");
            if(requireAccepted && parent.requiresAdoption() && !pointer.path("accepted").asBoolean())throw conflict("STUDIO_TEMPLATE_ADOPTION_REQUIRED","请先采用「"+parent.title()+"」");
            refs.add(new Reference(null,null,null,key,"frame",null));
        }
        for(var ref:refs)projects.requireOwnedAssetKey(owner,ref.storageKey());
        return refs;
    }
    private boolean stale(String owner,String projectId,Instance instance,Step step,ObjectNode snapshot) {
        var pointer=snapshot.path("execution").path(step.id());if(!pointer.hasNonNull("runId"))return false;
        try {return !mapper.valueToTree(references(owner,projectId,instance,step,snapshot,true)).equals(pointer.path("references"));}
        catch(BusinessException e){return true;}
    }
    private String selected(IpRunDto run,JsonNode pointer) {
        var keys=candidateKeys(run);String chosen=pointer.path("selectedKey").asText(null);return chosen!=null&&keys.contains(chosen)?chosen:keys.stream().findFirst().orElse(null);
    }
    private List<String> candidateKeys(IpRunDto run) {
        List<String> keys=new ArrayList<>();for(var image:run.output().path("candidates"))if(image.hasNonNull("key"))keys.add(image.path("key").asText());
        for(var video:run.output().path("videoCandidates"))if("done".equals(video.path("status").asText())&&video.hasNonNull("storageKey"))keys.add(video.path("storageKey").asText());
        if(keys.isEmpty()&&run.output().hasNonNull("storageKey"))keys.add(run.output().path("storageKey").asText());return keys;
    }
    private IpRunDto run(String owner,String projectId,String id) {return projects.toRunDto(projects.ownedRun(owner,projectId,id).orElseThrow(()->BusinessException.notFound("IP_RUN_NOT_FOUND","原任务不存在")));}
    private Step step(Instance instance,String id) {return instance.source().recipe().steps().stream().filter(s->s.id().equals(id)).findFirst().orElseThrow(()->bad("STUDIO_TEMPLATE_STEP_INVALID","模板没有这个步骤"));}
    private ObjectNode snapshot(IpProject project) {if(project.getTemplateInstanceJson()==null)throw bad("STUDIO_TEMPLATE_INSTANCE_NOT_FOUND","请先套用模板");return (ObjectNode)projects.parseOrEmptyObject(project.getTemplateInstanceJson());}
    private Map<String,Value> values(ObjectNode snapshot) {return mapper.convertValue(snapshot.path("inputs"),new TypeReference<Map<String,Value>>(){});}
    private void save(IpProject project,ObjectNode snapshot) {project.setTemplateInstanceJson(snapshot.toString());projects.save(project);}
    private ObjectNode canonical(JsonNode request) {var out=mapper.createObjectNode();for(String name:List.of("clientRequestId","maxCost","replaceRunId","prompt"))if(request.hasNonNull(name))out.set(name,request.path(name));return out;}
    private static BusinessException bad(String code,String message){return BusinessException.badRequest(code,message);}
    private static BusinessException conflict(String code,String message){return new BusinessException(HttpStatus.CONFLICT,code,message);}
}
