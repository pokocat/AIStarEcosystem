package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dto.StudioPlanDtos.PlanExecution;
import com.aistareco.aep.ipstudio.dto.StudioSegmentedDtos.SegmentedVideoRequest;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.segmented.SegmentedVideoService;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** A scene task is a read model over native executions/runs, never another billing or progress ledger. */
@Service
public class StudioVideoTaskService {
    public record Create(String clientRequestId,String kind,String sceneId,String title,SegmentedVideoRequest configuration,
                         RunRequest video,Long budgetCap,String sourceNodeId,JsonNode input,BillingSelection billing) {}
    public record Quote(long estimated,long cap,List<Integer> segments,int boards) {}
    public record Task(String id,String projectId,String sceneId,String title,String kind,String createdAt,
                       PlanExecution execution,IpRunDto run,JsonNode input,Create request,String retryAt,String retryStepId) {}
    public record Tasks(List<Task> items,int page,boolean hasMore) {}

    private final IpPlanExecutionRepository repository;
    private final IpRunRepository runs;
    private final StudioPlanExecutionService executions;
    private final SegmentedVideoService segmented;
    private final StudioWorkflowService workflow;
    private final StudioPlanQuoter quoter;
    private final StudioSkillRules skills;
    private final IpProjectService projects;
    private final StudioVideoService videos;
    private final ObjectMapper mapper;
    @org.springframework.beans.factory.annotation.Autowired private StudioCloneVideoPlan clones;
    @org.springframework.beans.factory.annotation.Autowired(required=false) private StudioDepthQueue depthQueue;

    public StudioVideoTaskService(IpPlanExecutionRepository repository,IpRunRepository runs,StudioPlanExecutionService executions,
            SegmentedVideoService segmented,StudioWorkflowService workflow,StudioPlanQuoter quoter,StudioSkillRules skills,
            IpProjectService projects,StudioVideoService videos,ObjectMapper mapper) {
        this.repository=repository;this.runs=runs;this.executions=executions;this.segmented=segmented;this.workflow=workflow;
        this.quoter=quoter;this.skills=skills;this.projects=projects;this.videos=videos;this.mapper=mapper;
    }

    public Quote price(String user,String kind,String model,String mode,String tier,int duration,String ratio,int images,boolean character,boolean voice,boolean optimize) {
        if(StudioCloneVideoPlan.method(kind)&&(images<0||images>StudioRecreationTaskPlan.MAX_IMAGES-(character?1:0)))
            throw invalid("最多添加 "+StudioRecreationTaskPlan.MAX_IMAGES+" 张替换图片");
        // 深度复刻 / 元素替换：每段带原片片段作参考视频，另加拉片和写提示词两次文字任务（同分镜复刻）
        if(StudioCloneVideoPlan.nativeClone(kind)) {
            var p=clones.price(user,kind,model,tier,duration,ratio,images,character,voice,optimize);
            long base=Math.addExact(p.estimated(),Math.multiplyExact(textCost(user),2));
            return new Quote(base,Math.multiplyExact(base,3),p.segments(),0);
        }
        if(!Set.of("direct","segmented","recreation").contains(kind))throw invalid("请选择制作方式");
        if(!"direct".equals(kind)) {
            var p="recreation".equals(kind)
                    ?segmented.recreationPrice(user,model,tier,duration,ratio,images,character,voice,optimize)
                    :segmented.price(user,model,tier,duration,ratio,images,character,voice,optimize);
            long base=p.estimated();
            if("recreation".equals(kind))base=Math.addExact(base,Math.multiplyExact(textCost(user),2));
            return new Quote(base,Math.multiplyExact(base,3),p.segments(),p.boards());
        }
        var selected=videos.models().stream().filter(m->model==null?m.isDefault():model.equals(m.endpointId())).findFirst()
                .orElseThrow(()->invalid("请选择可用的视频模型"));
        var spec=selected.contract().modes().stream().filter(m->mode==null||mode.equals(m.mode())).findFirst().orElseThrow(()->invalid("请选择视频模式"));
        ObjectNode req=mapper.createObjectNode().put("nodeId","quote").put("operation","video").put("prompt","视频制作")
                .put("model",selected.endpointId()).put("durationSec",duration).put("aspectRatio",ratio).put("count",1);
        ObjectNode video=req.putObject("video").put("mode",spec.mode()).put("resolutionTier",tier).put("optimizePrompt",optimize);
        if(spec.needsFirstFrame())video.put("firstFrameKey","quote/first");
        if(spec.needsLastFrame())video.put("lastFrameKey","quote/last");
        if(optimize&&selected.supportsPromptOptimization())video.put("rewrite","h3-en-v1");
        if(spec.references()!=null) {
            ArrayNode refs=video.putArray("references");
            for(int n=0;n<Math.min(12,images+(character?1:0));n++)refs.addObject().put("mediaType","image").put("key","quote/image-"+n);
            if(voice)refs.addObject().put("mediaType","audio").put("key","quote/audio");
        }
        long cost=workflow.quote(user,mapper.convertValue(req,RunRequest.class));
        return new Quote(cost,Math.multiplyExact(cost,3),List.of(duration),0);
    }

    @Transactional
    public Task start(String user,String projectId,Create req) {
        if(req==null||req.clientRequestId()==null||!req.clientRequestId().matches("[A-Za-z0-9_-]{1,64}"))throw invalid("请求已失效，请刷新页面后重试");
        if(req.sceneId()==null||req.title()==null||req.title().length()>160||req.input()!=null&&req.input().toString().length()>100000)throw invalid("制作信息不完整");
        if(!"direct".equals(req.kind()) && (req.configuration()==null || !req.clientRequestId().equals(req.configuration().clientRequestId())
                || !req.sceneId().equals(req.configuration().sceneId()) || req.configuration().duration()==null || req.configuration().duration()<1
                || req.configuration().duration()>60 || req.configuration().materials()==null
                || !Objects.equals(req.budgetCap(),req.configuration().budgetCap())
                || !Objects.equals(req.billing(),req.configuration().billing())))throw invalid("制作配置不完整，请重新选择素材和时长");
        if ("depth".equals(req.kind()) && depthQueue != null) depthQueue.lockAdmission();
        projects.requiredForUpdate(user,projectId);
        // Replay before repricing: confirmation of an accepted task must survive later price/config changes.
        var prior=repository.findByOwnerUserIdAndClientRequestId(user,req.clientRequestId()).orElse(null);
        if(prior!=null) {
            JsonNode saved=PlanState.parse(mapper,prior.getStepsJson()).path("videoTask").path("request");
            // Stored JSON is parsed back with compact integral nodes; typed Long fields must compare the same way.
            ObjectNode identity=PlanState.parse(mapper,mapper.valueToTree(req).toString());identity.remove("budgetCap");
            ObjectNode before=saved.isObject()?(ObjectNode)saved.deepCopy():mapper.createObjectNode();before.remove("budgetCap");
            if(!projectId.equals(prior.getProjectId())||!before.equals(identity))throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_REQUEST_CHANGED","请求已失效，请刷新页面后重试");
            return task(prior);
        }
        ObjectNode metadata=mapper.createObjectNode().put("kind",req.kind()).put("sceneId",req.sceneId()).put("title",req.title());
        metadata.set("request",mapper.valueToTree(req));
        metadata.set("input",req.input()==null?mapper.createObjectNode():req.input());
        if("segmented".equals(req.kind())) {
            if(req.configuration()==null||!req.clientRequestId().equals(req.configuration().clientRequestId()))throw invalid("制作配置不完整");
            var result=segmented.start(user,projectId,req.configuration());
            var row=repository.findById(result.id()).orElseThrow();
            ObjectNode state=PlanState.parse(mapper,row.getStepsJson());state.set("videoTask",metadata);
            row.setStepsJson(state.toString());repository.saveAndFlush(row);
            return task(row);
        }
        ObjectNode plan=mapper.createObjectNode().put("stage","production").put("summary",req.title());
        ArrayNode steps=plan.putArray("steps");
        List<String> context=new ArrayList<>();
        StudioSkillRules.Rules rules;
        long estimate;
        if("direct".equals(req.kind())) {
            if(req.video()==null||!"video".equals(req.video().operation())||req.video().executionId()!=null)throw invalid("视频配置不完整");
            // 优化提示词只能用普通积分，视频可能全由模型赠款付：两笔分开核对，付不起优化就不建任务（不留「需处理」的记录）
            if(req.video().video()!=null&&req.video().video().rewrite()!=null)workflow.requireVideoRewriteAffordable(user,req.billing());
            ObjectNode nativeRequest=mapper.valueToTree(req.video());nativeRequest.put("nodeId","quote");
            estimate=workflow.quote(user,mapper.convertValue(nativeRequest,RunRequest.class));
            metadata.set("direct",mapper.valueToTree(req.video()));
            steps.addObject().put("id","video").put("operation","video").put("title","生成视频").put("execution","auto")
                    .put("quotedCost",estimate).put("prompt",req.video().prompt()).putObject("settings").put("operation","video");
            rules=skills.requireActive("video-generation");
        } else if(StudioCloneVideoPlan.method(req.kind())) {
            // 爆款复刻的三种方式都先拉片、再由代码按拉片结果拼方案（StudioRecreationTaskPlan）；不同的是每段交给视频模型什么
            if(req.configuration()==null||req.sourceNodeId()==null)throw invalid("请添加参考视频");
            var cfg=req.configuration();
            int pictures=0,voices=0;
            for(var material:cfg.materials()) {
                if(material==null||!Set.of("image","character","voice").contains(Objects.toString(material.slot(),"")))throw invalid("素材类型不正确");
                if("voice".equals(material.slot()))voices++;
                else pictures++;
            }
            if(pictures>StudioRecreationTaskPlan.MAX_IMAGES)throw invalid("最多添加 "+StudioRecreationTaskPlan.MAX_IMAGES+" 张替换图片");
            if(voices>StudioRecreationTaskPlan.MAX_VOICES)throw invalid("参考声音最多一段");
            boolean clip=StudioCloneVideoPlan.nativeClone(req.kind());
            // 深度复刻 / 元素替换：所选模型要能带参考视频（深度复刻还要有动作提取服务），分段不超过参考视频的时长上限
            var bounds=clip?StudioCloneVideoPlan.clip(clones.require(req.kind(),req.configuration().model())):null;
            if("depth".equals(req.kind()))admitDepth(user);
            var doc=projects.readDoc(projects.required(user,projectId));
            JsonNode source=IpDocs.node(doc,req.sourceNodeId());
            if(source==null||!"video".equals(source.path("type").asText())||IpDocs.primaryStorageKey(source)==null)throw invalid("参考视频不在草稿中，请重新添加");
            projects.requireOwnedAssetKey(user,IpDocs.primaryStorageKey(source));
            context.add(req.sourceNodeId());
            for(var material:cfg.materials()) {
                JsonNode node=IpDocs.node(doc,material.nodeId());
                if(node==null||IpDocs.primaryStorageKey(node)==null)throw invalid("素材已变化，请重新选择");
                String expectedType="voice".equals(material.slot())?"audio":"image";
                if(!expectedType.equals(node.path("type").asText()))throw invalid("素材类型不正确，请重新选择");
                projects.requireOwnedAssetKey(user,IpDocs.primaryStorageKey(node));context.add(material.nodeId());
            }
            // 原片片段要交给视频模型的两种方式：受理时冻结原片和素材的文件，之后画布上改了也不影响这次制作
            if(clip) {
                var snapshot=metadata.putObject("cloneKeys");
                for(String id:context)snapshot.put(id,IpDocs.primaryStorageKey(IpDocs.node(doc,id)));
            }
            rules=skills.requireActive("reference-video-recreation");
            plan.put("stage","analysis");
            var study=steps.addObject().put("id","study").put("operation","recreation").put("title","分析参考视频").put("execution","auto")
                    .put("prompt","分析参考视频的创意、镜头、动作与节奏，结合本次要求："+Objects.toString(req.configuration().text(),""));
            study.putArray("dependsOn");
            study.putObject("settings").put("operation","recreation").put("sourceNodeId",req.sourceNodeId()).put("mode","segments")
                    .put("maxSegmentSec",clip?String.valueOf(bounds.maxSec()):"model").put("videoModel",req.configuration().model());
            var compile=steps.addObject().put("id","compile").put("operation","text").put("title","写分镜脚本").put("execution","auto")
                    .put("prompt","根据本次参考片分析与新素材，动态编排可以直接制作到成片的方案。用户要求："+Objects.toString(req.configuration().text(),"")
                            +"。视频总时长 "+req.configuration().duration()+" 秒；画面 "+req.configuration().ratio()+(req.configuration().model()==null?"":"；视频模型必须使用 "+req.configuration().model())
                            +"；清晰度 "+req.configuration().tier()+"。使用提供的替换素材；不复用原片的旧人物、旧商品作为新主体。只输出可执行方案，不向用户提问。保留原片值得借鉴的节奏与创意，具体分段和参考方式按实际模型能力安排。");
            compile.putArray("dependsOn").add("study");compile.putObject("settings").put("operation","text").put("purpose","plan-compile");
            quoter.quote(user,plan);
            estimate=price(user,req.kind(),cfg.model(),null,cfg.tier(),cfg.duration(),cfg.ratio(),(int)cfg.materials().stream().filter(m->"image".equals(m.slot())).count(),
                    cfg.materials().stream().anyMatch(m->"character".equals(m.slot())),cfg.materials().stream().anyMatch(m->"voice".equals(m.slot())),!Boolean.FALSE.equals(cfg.optimize())).estimated();
        } else throw invalid("请选择制作方式");
        long cap=Math.multiplyExact(estimate,3);
        if(req.budgetCap()==null||req.budgetCap()<cap)throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_PRICE_CHANGED","费用已变化，请核对后再开始",Map.of("cap",cap));
        plan.put("skillKey",rules.key()).put("skillVersion",rules.version());
        plan.putObject("budget").put("estimated",estimate).put("autoFixCap",cap-estimate);
        plan.put("fingerprint",StudioPlanValidator.fingerprint(plan));
        var accepted=executions.startVideoTask(user,projectId,req.clientRequestId(),plan,null,metadata,context,rules,cap,cap-estimate,req.billing(),mapper.valueToTree(req));
        return task(repository.findById(accepted.id()).orElseThrow());
    }

    /** 每人同时一条深度复刻；全站同时最多 3 条、动作提取最多排 12 段（一段约 4.5 分钟，12 段约等 1 小时）。 */
    static final int DEPTH_TASKS_PER_USER=1,DEPTH_TASKS_SITE=3,DEPTH_SEGMENTS_QUEUED=12;
    /**
     * 深度复刻的动作提取一次只做一段（StudioDepthVideoService 的信号量），任务多了只会越排越久。所以在受理时就拦下，
     * 不冻结积分、不建任务；同一请求的重试在前面已按原任务返回，不受这里影响。只按制作中（running）的算，暂停等用户的不占名额。
     */
    void admitDepth(String user) {
        List<IpPlanExecution> active=repository.findByStatusIn(List.of(IpPlanExecution.RUNNING));
        long mine=0,site=0;
        for(var e:active) {
            if(!"depth".equals(PlanState.parse(mapper,e.getStepsJson()).path("videoTask").path("kind").asText()))continue;
            site++;if(user.equals(e.getOwnerUserId()))mine++;
        }
        if(mine>=DEPTH_TASKS_PER_USER)throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_DEPTH_USER_BUSY","你已有一条深度复刻正在制作，完成后再开始新的。");
        if(site>=DEPTH_TASKS_SITE||runs.countByKindAndStatus("studio-video-control",IpRun.STATUS_RUNNING)>=DEPTH_SEGMENTS_QUEUED)
            throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_DEPTH_SITE_BUSY","深度复刻排队的任务较多，请稍后再试，或改用分镜复刻。");
    }

    private long textCost(String user) {
        return workflow.quote(user,mapper.convertValue(mapper.createObjectNode().put("nodeId","quote").put("operation","text"),RunRequest.class));
    }

    @Transactional(readOnly=true)
    public Tasks list(String user,int page) {
        var found=repository.findByOwnerUserIdOrderByCreatedAtDesc(user,PageRequest.of(Math.max(0,page),50));
        List<Task> items=new ArrayList<>();
        for(var row:found) {
            var state=PlanState.parse(mapper,row.getStepsJson());
            if(state.has("videoTask")||state.has("segmented"))try {projects.required(user,row.getProjectId());items.add(task(row));}catch(BusinessException deleted) {/* deleted canvas */}
        }
        // Old ordinary videos have no parent execution. Exclude all execution child runs, so pieces never appear as tasks.
        var nativeRuns=runs.findByOwnerUserIdAndKindOrderByCreatedAtDesc(user,"studio-video",PageRequest.of(Math.max(0,page),50));
        for(var run:nativeRuns) {
            var input=PlanState.parse(mapper,run.getInputJson());
            // A user repair is submitted independently, but still belongs to its original execution output node.
            if(input.hasNonNull("executionId")||input.path("_exec").hasNonNull("execution")
                    ||run.getNodeId()!=null&&run.getNodeId().startsWith("PEX-"))continue;
            try {var project=projects.required(user,run.getProjectId());if(project.getSceneId()!=null)items.add(legacy(user,run.getId(),project.getId()));}catch(BusinessException deleted) {/* deleted canvas */}
        }
        items.sort(Comparator.comparing(Task::createdAt).reversed());
        return new Tasks(items,page,found.hasNext()||nativeRuns.hasNext());
    }

    @Transactional(readOnly=true)
    public Task get(String user,String id) {
        if(id.startsWith("IPR-")) {
            var run=runs.findByIdAndOwnerUserId(id,user).orElseThrow(StudioVideoTaskService::missing);
            if(!"studio-video".equals(run.getKind()))throw missing();
            return legacy(user,id,run.getProjectId());
        }
        var row=repository.findById(id).filter(r->user.equals(r.getOwnerUserId())).orElseThrow(StudioVideoTaskService::missing);
        projects.required(user,row.getProjectId());
        var state=PlanState.parse(mapper,row.getStepsJson());if(!state.has("videoTask")&&!state.has("segmented"))throw missing();
        return task(row);
    }

    private Task legacy(String user,String id,String projectId) {
        var p=projects.required(user,projectId);
        var run=projects.toRunDto(runs.findByIdAndOwnerUserId(id,user).orElseThrow(StudioVideoTaskService::missing));
        return new Task(id,projectId,p.getSceneId(),p.getName(),"direct",run.createdAt(),null,run,null,null,null,null);
    }

    Task task(IpPlanExecution row) {
        ObjectNode state=PlanState.parse(mapper,row.getStepsJson());JsonNode info=state.path("videoTask");
        var p=projects.required(row.getOwnerUserId(),row.getProjectId());
        String retryAt=null,retryId=null;
        for(JsonNode step:state.path("steps"))if("pending".equals(step.path("status").asText())&&step.path("attempt").asInt(1)>1&&step.hasNonNull("notBefore")) {
            retryAt=step.path("notBefore").asText();retryId=step.path("id").asText();break;
        }
        return new Task(row.getId(),row.getProjectId(),info.path("sceneId").asText(p.getSceneId()),info.path("title").asText(p.getName()),info.path("kind").asText("segmented"),
                row.getCreatedAt().toString(),executions.toDto(row),null,info.path("input"),info.path("request").isObject()?mapper.convertValue(info.path("request"),Create.class):null,retryAt,retryId);
    }

    private static BusinessException invalid(String text) {return BusinessException.badRequest("STUDIO_INPUT_INVALID",text);}
    private static BusinessException missing() {return new BusinessException(HttpStatus.NOT_FOUND,"STUDIO_VIDEO_TASK_NOT_FOUND","这条制作任务不存在或已移除");}
}
