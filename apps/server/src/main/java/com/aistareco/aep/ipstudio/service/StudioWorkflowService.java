package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.dto.DapAssetRequests.CreateIpRequest;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.service.*;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.*;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/** Studio is an orchestration surface; IpRun and existing assets remain authoritative. */
@Service
public class StudioWorkflowService {
    @org.springframework.beans.factory.annotation.Autowired
    private com.aistareco.aep.enterprise.service.EnterpriseBillingService enterpriseBilling;

    private static final Set<String> OPERATIONS = Set.of("text", "script", "storyboard", "image", "video", "assemble", "assistant", "asset-extract", "recreation", "check");
    private final IpProjectService projects;
    private final IpRunRepository runs;
    private final StudioFixtureProvider fixtures;
    private final StudioWorkflowWorker worker;
    private final DapPricingService pricing;
    private final AiModelInvocationService models;
    private final IpRunService imageRuns;
    private final CreditService credits;
    private final DapAssetService assets;
    private final DapAvatarService avatars;
    private final DapSupport support;
    private final EntityManager em;
    private final ObjectMapper mapper;
    private final StudioIpAssetService ipAssets;
    private final PromptService prompts;
    @org.springframework.beans.factory.annotation.Autowired
    private com.aistareco.aep.service.AiAppSceneModelPolicyService scenePolicies;
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private com.aistareco.aep.service.AiChatTokenPricing tokenPricing;

    @org.springframework.beans.factory.annotation.Autowired
    private com.aistareco.aep.service.storage.FileStorageService recreationStorage;
    @org.springframework.beans.factory.annotation.Autowired private StudioHypitMedia hypitMedia;
    // Skill plans, native check and plan execution binding (docs/ip-studio-conversational-video-recreation-plan.md).
    @org.springframework.beans.factory.annotation.Autowired(required=false) private com.aistareco.aep.ipstudio.execution.StudioSkillRules skillRules;
    @org.springframework.beans.factory.annotation.Autowired(required=false) private com.aistareco.aep.ipstudio.execution.IpPlanExecutionRepository planExecutions;
    @org.springframework.beans.factory.annotation.Autowired(required=false) private com.aistareco.aep.ipstudio.execution.StudioPlanOutputs planOutputs;
    @org.springframework.beans.factory.annotation.Autowired(required=false) private StudioVideoService studioVideo;

    public StudioWorkflowService(IpProjectService projects, IpRunRepository runs, StudioFixtureProvider fixtures,
            StudioWorkflowWorker worker, DapPricingService pricing, AiModelInvocationService models,
            IpRunService imageRuns, CreditService credits, DapAssetService assets, DapAvatarService avatars,
            DapSupport support, EntityManager em, ObjectMapper mapper, StudioIpAssetService ipAssets, PromptService prompts) {
        this.projects=projects; this.runs=runs; this.fixtures=fixtures; this.worker=worker; this.pricing=pricing;
        this.models=models; this.imageRuns=imageRuns; this.credits=credits; this.assets=assets; this.avatars=avatars;
        this.support=support; this.em=em; this.mapper=mapper;
        this.ipAssets=ipAssets;
        this.prompts=prompts;
    }
    @Transactional(readOnly=true)
    public com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.ReplaySelection billingSelection(String user,String projectId,String clientRequestId) {
        projects.required(user,projectId);
        var run=runs.findByProjectIdAndClientRequestId(projectId,clientRequestId).orElse(null);
        if(run==null)return new com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.ReplaySelection(false,null);
        var selection=StudioRunBilling.selection(run,mapper);
        return new com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.ReplaySelection(true,selection,StudioRunBilling.approval(run,mapper));
    }

    public List<IpAsset> ipAssets(String userId) {return ipAssets.list(userId);}

    public Capabilities capabilities() {
        return new Capabilities(fixtures.enabled(), List.of("text","script","storyboard","image","video","assemble","assistant","recreation","check"),
                fixtures.enabled()?0:scenePolicies == null ? pricing.ipImage() : scenePolicies.available("studio","image",pricing.ipImage()).stream().filter(s->s.resolved().isDefault()).findFirst().map(com.aistareco.aep.service.AiAppSceneModelPolicyService.Selection::creditCost).orElse(pricing.ipImage()), fixtures.enabled()?0:textModelOptions().stream().filter(TextModel::isDefault).findFirst().map(TextModel::creditCost).orElse(pricing.ipIdentity()),
                fixtures.enabled()?0L:null, textModelOptions(), scenePolicies == null ? "selectable" : scenePolicies.mode("studio","script"), scenePolicies == null ? "selectable" : scenePolicies.mode("studio","image"));
    }
    private List<TextModel> textModelOptions() {
        if(scenePolicies == null) return models.listCandidates(AiModelPurpose.DAP_PERSONA,"studio").stream()
                .filter(r->r.endpoint().isEnabled()&&r.candidate().isEnabled()).map(r->new TextModel(r.endpoint().getId(),r.endpoint().publicModelName(),r.isDefault(),StudioVisualContext.supportsVision(r.endpoint()),pricing.ipIdentity(),chatRate(r.endpoint().getId()),
                        Boolean.TRUE.equals(r.endpoint().getChatSupportsTools()),Boolean.TRUE.equals(r.endpoint().getChatSupportsStreaming()),dialogueRate(r.endpoint().getId()))).toList();
        return scenePolicies.available("studio","script",pricing.ipIdentity()).stream().map(s->new TextModel(s.resolved().endpoint().getId(),s.resolved().endpoint().publicModelName(),s.resolved().isDefault(),StudioVisualContext.supportsVision(s.resolved().endpoint()),s.creditCost(),chatRate(s.resolved().endpoint().getId()),
                Boolean.TRUE.equals(s.resolved().endpoint().getChatSupportsTools()),Boolean.TRUE.equals(s.resolved().endpoint().getChatSupportsStreaming()),dialogueRate(s.resolved().endpoint().getId()))).toList();
    }

    private com.aistareco.aep.service.AiChatTokenPricing.Rate chatRate(String endpointId) {
        return fixtures.enabled()||tokenPricing==null?null:tokenPricing.find(endpointId);
    }

    private com.aistareco.aep.service.AiChatTokenPricing.Rate dialogueRate(String endpointId) {
        return fixtures.enabled()||tokenPricing==null?null:tokenPricing.findDialogue(endpointId);
    }

    @Transactional
    public IpRunDto submit(String userId, String projectId, RunRequest request) {
        var project=projects.requiredForUpdate(userId, projectId);
        if (request == null || !OPERATIONS.contains(request.operation())) throw bad("STUDIO_OPERATION_INVALID", "请选择创作方式");
        if(request.modelBilling()!=null&&!("image".equals(request.operation())||"video".equals(request.operation())))throw bad("MODEL_QUOTE_NOT_SUPPORTED","当前操作尚不支持模型报价确认");
        requireText(request.clientRequestId(), 64, "请求编号");
        requireText(request.nodeId(), 64, "创作对象");
        String fingerprint=hash(write(canonicalRequest(mapper.valueToTree(request),mapper.valueToTree(request))));
        IpRun prior=runs.findByProjectIdAndClientRequestId(projectId,request.clientRequestId()).orElse(null);
        if(prior!=null) {
            StudioRunBilling.requireSamePayer(prior,request.billing());
            if(!fingerprint.equals(prior.getInputFingerprint()) && !fingerprint.equals(hash(write(canonicalRequest(
                    projects.parseOrEmptyObject(prior.getInputJson()).has("studioRequest")?projects.parseOrEmptyObject(prior.getInputJson()).path("studioRequest"):projects.parseOrEmptyObject(prior.getInputJson()),mapper.valueToTree(request)))))) throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_REQUEST_CHANGED","同一请求的内容已改变，请重新提交");
            return projects.toRunDto(prior);
        }
        boolean skillPlan="text".equals(request.operation())&&request.skillKey()!=null;
        boolean check="check".equals(request.operation());
        ExecutionBinding executionBinding=executionBinding(userId,projectId,request);
        com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules skill=skillRules(request,skillPlan,check,executionBinding);
        boolean configuredImage = "image".equals(request.operation()) && !fixtures.enabled() && scenePolicies != null
                && (com.aistareco.aep.ipstudio.service.StudioImageModelRouting.isProductRequest(request.model())
                    || (request.model()==null || !request.model().startsWith(com.aistareco.aep.ipstudio.service.StudioImageModelRouting.REQUEST_PREFIX))
                    && JusuanImageClient.supports(scenePolicies.resolve("studio", "image", request.model(), pricing.ipImage()).resolved().endpoint()));
        // Native video validates promptRequired against the selected endpoint mode in StudioVideoService.
        if (!"assemble".equals(request.operation()) && !check
                && !("video".equals(request.operation()) && request.video() != null) && !configuredImage)
            requireText(request.prompt(), 16000, "创作内容");
        if (check && request.prompt()!=null && request.prompt().length()>16000) throw bad("STUDIO_INPUT_INVALID","检查说明最多 16000 字");
        if (configuredImage && (request.prompt()==null || request.prompt().isBlank()))
            throw bad("STUDIO_INPUT_INVALID", "请填写创作内容");
        if (!configuredImage && request.references()!=null && request.references().size()>32) throw bad("STUDIO_REFERENCES_LIMIT", "一次最多使用 32 份参考素材");
        if(request.count()!=null && !Set.of(1,2,4).contains(request.count())) throw bad("video".equals(request.operation())?"STUDIO_VIDEO_COUNT_INVALID":"STUDIO_IMAGE_COUNT_INVALID","video".equals(request.operation())?"一次可生成 1、2 或 4 条视频":"一次可生成 1、2 或 4 张图片");
        List<Reference> references = request.references()==null?List.of():request.references();
        for (Reference reference:references) requireReference(userId, reference);
        if ("assemble".equals(request.operation()) && (references.isEmpty() || references.stream().anyMatch(r->!"clip".equals(r.role()))))
            throw bad("STUDIO_CLIPS_REQUIRED", "请先选择要合成的视频片段");
        if (request.video()!=null && !"video".equals(request.operation())) throw bad("STUDIO_VIDEO_INPUT_INVALID","视频参数只能用于生成视频");
        if (request.video()!=null && fixtures.enabled()) throw bad("STUDIO_VIDEO_MODE_UNAVAILABLE","测试响应不支持原生视频模式，请关闭测试响应后使用");
        if (request.aspectRatio()!=null && request.video()==null && !("image".equals(request.operation())
                ? request.aspectRatio().matches(configuredImage?"[1-9][0-9]*:[1-9][0-9]*":"[1-9][0-9]?:[1-9][0-9]?")
                : List.of("9:16","16:9","1:1").contains(request.aspectRatio())))
            throw bad("STUDIO_RATIO_INVALID", "请选择可用画幅");
        validateCreativeRequest(request);
        validateSkillRequest(request,skillPlan,check);
        StudioPackagingService.validate(request.packaging());
        if(request.edit()!=null) {
            if(!"assemble".equals(request.operation()))throw bad("STUDIO_EDIT_ASSEMBLE_ONLY","剪辑时间线只能用于成片合成");
            StudioEditGraph.validate(request.edit());
            for(var media:request.edit().clips())projects.requireOwnedAssetKey(userId,media.storageKey());
            if(request.edit().audios()!=null)for(var media:request.edit().audios())projects.requireOwnedAssetKey(userId,media.storageKey());
        }
        if(request.packaging()!=null && request.packaging().voiceoverStorageKey()!=null) {
            if(!"assemble".equals(request.operation()))throw bad("STUDIO_SPEECH_ASSEMBLE_ONLY","配音只能用于成片合成");
            projects.requireOwnedAssetKey(userId,request.packaging().voiceoverStorageKey());
        }
        // Execution-bound steps write to their own output node (projected by the client), never into the canvas document.
        if ("text".equals(request.operation()) && !skillPlan && executionBinding==null) {
            var node=IpDocs.node(projects.readDoc(project),request.nodeId());
            if (node==null || !"text".equals(node.path("type").asText()) || node.path("metadata").path("studio").hasNonNull("script")
                    || "script".equals(node.path("metadata").path("studio").path("kind").asText()))
                throw bad("STUDIO_INPUT_INVALID","请选择普通文本节点，剧本请使用剧本编辑器");
        }
        if(!fixtures.enabled() && "image".equals(request.operation())) {
            // Reuse model whitelist, quote, hold and worker from the established image pipeline.
            IpRunDto dto=imageRuns.generate(userId,projectId,imageRequest(request));
            IpRun run=runs.findById(dto.id()).orElseThrow();
            ObjectNode imageInputs=(ObjectNode)projects.parseOrEmptyObject(run.getInputJson());
            imageInputs.set("studioRequest",mapper.valueToTree(request));run.setInputJson(write(imageInputs));
            run.setClientRequestId(request.clientRequestId()); run.setInputFingerprint(fingerprint); runs.save(run);
            return projects.toRunDto(run);
        }
        if(!fixtures.enabled() && "video".equals(request.operation())) {
            if(request.video()==null && references.size()>1) throw bad("STUDIO_VIDEO_FIRST_FRAME_ONLY","这个视频模型只支持一张首帧参考图，请选择支持首尾帧或全能参考的模型");
            if(request.video()!=null && !references.isEmpty()) throw bad("STUDIO_VIDEO_INPUT_INVALID","请在视频模式中明确选择首帧、尾帧或参考素材");
            if(request.video()!=null && request.video().rewrite()!=null) return submitVideoRewrite(userId,projectId,project,request,fingerprint);
            var batch=imageRuns.generateVideoBatch(userId,projectId,videoRequest(request),request.count()==null?1:request.count());
            ObjectNode inputs=mapper.valueToTree(request);
            ObjectNode exec=inputs.putObject("_exec");
            var ids=exec.putArray("nativeVideoJobIds");
            batch.jobs().forEach(job->ids.add(job.path("id").asText()));
            // The request keeps the frame the user chose; what was actually sent after a crop (§6.2) is recorded here.
            if(batch.frameAdjustments()!=null)exec.setAll(batch.frameAdjustments());
            // This row is an immutable binding. Native video status, result and settlement are read-only projections.
            IpRun binding=IpRun.builder().id("IPR-"+UUID.randomUUID().toString().replace("-","").substring(0,20))
                    .projectId(projectId).ownerUserId(userId).nodeId(request.nodeId()).kind("studio-video")
                    .enterpriseId(request.billing()!=null&&"enterprise".equals(request.billing().mode())?request.billing().enterpriseId():null)
                    .status(IpRun.STATUS_DONE).stage("video.bound").cost(0).clientRequestId(request.clientRequestId())
                    .inputFingerprint(fingerprint).inputJson(write(inputs)).outputJson("{}")
                    .createdAt(Instant.now()).heartbeatAt(Instant.now()).build();
            runs.save(binding);
            return projects.toRunDto(binding);
        }
        boolean text=List.of("text","script","storyboard","assistant","asset-extract","recreation","check").contains(request.operation());
        if(fixtures.enabled()&&(skillPlan||check))throw bad("STUDIO_VISION_UNAVAILABLE","测试响应不支持制作方法规划和成片检查，请关闭测试响应");
        AiModelInvocationService.ResolvedEndpoint textEndpoint=null;
        PromptService.ResolvedPrompt resolved=null;
        long textPrice=fixtures.enabled()?0:pricing.ipIdentity();
        String promptKey=check?PromptService.KEY_DAP_IP_STUDIO_SKILL_CHECK:skillPlan?PromptService.KEY_DAP_IP_STUDIO_SKILL_PLAN
                :"recreation".equals(request.operation())?PromptService.KEY_DAP_IP_STUDIO_RECREATION:List.of("assistant","text").contains(request.operation())?PromptService.KEY_DAP_IP_STUDIO_ASSISTANT:PromptService.KEY_DAP_IP_STUDIO_SCRIPT;
        if(!fixtures.enabled() && text) {
            if(scenePolicies == null) textEndpoint=models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,request.model(),"studio").orElseThrow(()->
                    new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"ENDPOINT_NOT_ALLOWED","所选文本模型不可用"));
            if(scenePolicies != null) {var selection=scenePolicies.resolve("studio","script",request.model(),pricing.ipIdentity());textEndpoint=selection.resolved();textPrice=selection.creditCost();}
            resolved=prompts.resolve(promptKey);
            if("code".equals(resolved.origin())) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"PROMPT_NOT_CONFIGURED","尚未配置创作提示词");
            if((Boolean.TRUE.equals(request.readVisuals())||"recreation".equals(request.operation())||check)&&!StudioVisualContext.supportsVision(textEndpoint.endpoint()))
                throw bad("STUDIO_VISION_UNAVAILABLE","这个模型未配置图片读取能力，请切换模型或关闭读取画面");
        }
        if(Boolean.TRUE.equals(request.readVisuals())&&fixtures.enabled())throw bad("STUDIO_VISION_UNAVAILABLE","测试响应不读取真实画面，请关闭测试响应");
        ObjectNode recreationSource=null;
        if("recreation".equals(request.operation())) {
            if(fixtures.enabled())throw bad("STUDIO_VISION_UNAVAILABLE","复刻创作需要读取真实视频，请关闭测试响应");
            var target=IpDocs.node(projects.readDoc(project),request.nodeId());
            if(executionBinding==null&&(target==null||!"text".equals(target.path("type").asText())||!"recreation".equals(target.path("metadata").path("studio").path("kind").asText())))
                throw bad("STUDIO_RECREATION_TARGET_INVALID","请先保存拆解报告再开始分析");
            hypitMedia.requireReady();
            recreationSource=StudioRecreation.snapshot(projects.readDoc(project),request.contextNodeIds(),projects,userId,recreationStorage);
        }
        ObjectNode segmentCap=request.recreation()==null?null:segmentCap(request.recreation(),recreationSource,skill);
        ObjectNode checkTarget=check?checkTarget(userId,projectId,request.check(),skill):null;
        var chatRate=!fixtures.enabled()&&text?chatRate(textEndpoint.endpoint().getId()):null;
        if(!fixtures.enabled()&&text&&chatRate==null)throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"AI_TOKEN_PRICE_NOT_CONFIGURED","此模型尚未配置按量积分售价");
        long cost=chatRate==null?(fixtures.enabled()||!text?0:textPrice):chatRate.maxCost();
        if(chatRate!=null&&request.maxCost()==null)throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_PRICE_CHANGED","模型计费配置已更新，请刷新后重试");
        IpRunService.requireApprovedCost(request.maxCost(),cost);
        String id="IPR-"+UUID.randomUUID().toString().replace("-","").substring(0,20);
        ObjectNode inputs=mapper.valueToTree(request);
        inputs.put("mock",fixtures.enabled());
        var context=inputs.putArray("appliedCharacterContext");
        for(Reference ref:references) if(ref.avatarId()!=null) {
            var avatar=avatars.required(userId,ref.avatarId());
            context.addObject().put("name",avatar.getName()).put("description",avatar.getDescPrompt()).put("version",ref.version()==null?avatar.getVersions():ref.version());
        }
        var execution=inputs.putObject("_exec").put("holdTotal",cost).put("unitCost",cost).put("billingUnit","per_call");
        var canvasContext=inputs.putArray("appliedCanvasContext");
        if(request.contextNodeIds()!=null) for(String nodeId:request.contextNodeIds()) {
            var node=IpDocs.node(projects.readDoc(project),nodeId);
            if(node==null) throw bad("STUDIO_CONTEXT_NOT_FOUND","引用的画布内容不存在，请重新选择");
            var item=canvasContext.addObject().put("id",nodeId).put("title",node.path("title").asText()).put("type",node.path("type").asText());
            var md=node.path("metadata");
            item.put("prompt",md.path("studio").path("composerDraft").has("prompt")?md.path("studio").path("composerDraft").path("prompt").asText():md.path("prompt").asText());
            if(md.path("studio").has("scriptMarkdown"))item.set("scriptMarkdown",md.path("studio").path("scriptMarkdown"));
            if(md.path("studio").has("script"))item.set("script",md.path("studio").path("script"));
            if(md.path("studio").has("shot"))item.set("shot",md.path("studio").path("shot"));
            if("text".equals(node.path("type").asText()))item.put("text",md.path("content").asText());
        }
        if(canvasContext.toString().length()>48000) throw bad("STUDIO_CONTEXT_LIMIT","画布上下文过长，请减少引用或按集创作");
        if(Boolean.TRUE.equals(request.readVisuals())) {
            execution.set("visualContext",StudioVisualContext.snapshot(projects.readDoc(project),request.contextNodeIds(),projects,userId));
            execution.put("visualContextVersion",1);
        }
        if(recreationSource!=null) {
            execution.set("recreationSource",recreationSource);
            if("segments".equals(request.mode())) {
                JsonNode doc=projects.readDoc(project), target=IpDocs.node(doc,request.nodeId());
                for(JsonNode node:doc.path("nodes")) {
                    var info=node.path("metadata").path("studio").path("recreation");
                    if(info.has("report")&&recreationSource.path("storageKey").asText().equals(info.path("sourceStorageKey").asText())) {
                        execution.put("fullFilmContext",node.path("metadata").path("content").asText().substring(0,Math.min(16000,node.path("metadata").path("content").asText().length())));break;
                    }
                }
                String resume=target==null?"":target.path("metadata").path("studio").path("recreation").path("resumeRunId").asText();
                if(!resume.isBlank())projects.ownedRun(userId,projectId,resume).ifPresent(previous->{
                    JsonNode old=projects.parseOrEmptyObject(previous.getOutputJson()).path("filmStudy");
                    JsonNode previousOutput=projects.parseOrEmptyObject(previous.getOutputJson());
                    if(previous.getNodeId().equals(request.nodeId())) {
                        if(old.path("source").path("storageKey").asText().equals(execution.path("recreationSource").path("storageKey").asText()))execution.set("resumeFilmStudy",old.deepCopy());
                        if(previousOutput.path("sourceAudio").path("sourceStorageKey").asText().equals(execution.path("recreationSource").path("storageKey").asText()))execution.set("resumeSourceAudio",previousOutput.path("sourceAudio").deepCopy());
                    }
                });
            }
        }
        if(segmentCap!=null)execution.set("segmentCap",segmentCap);
        if(checkTarget!=null)execution.set("check",checkTarget);
        if(skill!=null)execution.set("skill",com.aistareco.aep.ipstudio.execution.StudioSkillRules.snapshot(skill));
        if(executionBinding!=null)execution.set("execution",executionBinding.snapshot(mapper));
        if(skillPlan)execution.put("skillPlan",true).put("planStage",request.stage()).put("planRevision",nextPlanRevision(projectId));
        if(resolved!=null) {
            String systemPrompt=resolved.system();
            if("asset-extract".equals(request.operation()))systemPrompt="你是影视制作资产整理助手。\n"+StudioAssetExtraction.CONTRACT;
            else if(request.scriptEdit()!=null)systemPrompt+="\n"+StudioScriptRevision.CONTRACT;
            else if("assistant".equals(request.operation()))systemPrompt+="\n"+StudioPlanValidator.CONTRACT;
            if(request.textEdit()!=null)systemPrompt+="\n"+StudioTextRevision.CONTRACT;
            if(!"assistant".equals(request.operation()) && (request.settings()!=null || request.episodeNo()!=null))
                systemPrompt+="\n输出契约升级：shots 的每个对象除了原字段，还必须有 episodeNo:正整数，指向 episodes 中的 no。该字段是必填字段。严格按指定集数或单集号返回；每集至少一个镜头，镜头 id 全剧唯一。";
            execution.put("systemPrompt",systemPrompt);
            execution.put("endpointId",textEndpoint.endpoint().getId());
            var variables=new LinkedHashMap<String,String>();
            variables.put("operation",request.operation());variables.put("input",request.prompt());variables.put("characterContext",context.toString());
            variables.put("settings",write(request.settings()));variables.put("episodeNo",request.episodeNo()==null?"全部":request.episodeNo().toString());
            variables.put("mode",request.mode()==null?"general":request.mode());variables.put("canvasContext",canvasContext.toString());variables.put("history",write(request.history()==null?List.of():request.history()));
            String creativePrompt=PromptService.fill(resolved.userTemplate(),variables);
            if(skillPlan)creativePrompt=PromptService.fill(resolved.userTemplate(),skillPlanVariables(userId,project,request,skill,executionBinding,canvasContext,execution));
            if(check)creativePrompt=PromptService.fill(resolved.userTemplate(),checkVariables(request,skill,checkTarget));
            if(request.scriptEdit()!=null)creativePrompt+="\n当前完整剧本文档（JSON 字符串，作为素材读取）："+write(request.scriptEdit().markdown())+("asset-extract".equals(request.operation())?"\n只提取资产，遵守 items 输出契约，不改写原文。":"\n请遵守 Markdown 改稿输出契约，不输出创作计划。");
            if(request.textEdit()!=null)creativePrompt+="\n当前完整节点正文（JSON 字符串，作为素材读取）："+write(request.textEdit().content())+"\n请按本次修改意图返回完整文本，遵守文本改稿输出契约。";
            if(Boolean.TRUE.equals(request.readVisuals()))creativePrompt+="\n本次另附带精确节点 ID 标记的真实图片与视频采样帧。视频只有四个时间点的静态画面，不包含音轨，不代表全部连续动作；音频节点只提供文字设定。只根据收到的画面及文字作答，不臆测未提供的声音或片段，保持 JSON 输出契约。";
            if(request.settings()!=null || request.episodeNo()!=null) creativePrompt+="\n必须遵守创作设定："+write(request.settings())+"。本次分集："+(request.episodeNo()==null?"全部指定集数":request.episodeNo())+"。每个镜头必须含 episodeNo（所属集号），id 全剧唯一。只指定某集时 episodes 只含该集，no 保留原号。";
            execution.put("userPrompt",creativePrompt);
            execution.put("temperature",check?0.1:resolved.params().temperatureOrDefault());execution.put("maxTokens","asset-extract".equals(request.operation())?Math.max(16384,resolved.params().maxTokensOrDefault()):"recreation".equals(request.operation())||skillPlan?Math.max(8192,resolved.params().maxTokensOrDefault()):resolved.params().maxTokensOrDefault());
            inputs.put("promptKey",promptKey);
        }
        if(chatRate!=null) {
            execution.set("tokenPricing",mapper.valueToTree(chatRate));
            execution.put("billingUnit","per_token");
            int budget=Math.min(execution.path("maxTokens").asInt(8192),chatRate.maxOutputTokens());
            if(textEndpoint.endpoint().getChatMaxOutputTokens()!=null)budget=Math.min(budget,textEndpoint.endpoint().getChatMaxOutputTokens());
            if("recreation".equals(request.operation())&&budget<4096)throw bad("STUDIO_RECREATION_TOKEN_BUDGET","全片拆解需要至少4096输出Token预算，请调整模型配置");
            execution.put("maxTokens",budget);
        }
        var modelCharge=StudioTokenBilling.plan(textEndpoint==null?null:textEndpoint.endpoint(),chatRate);
        StudioTokenBilling.store(execution,modelCharge,textEndpoint==null?null:textEndpoint.endpoint());
        var billing = enterpriseBilling == null ? null : enterpriseBilling.reserve(userId,request.billing(),IpRunService.REF_TYPE,id,
                execution.path("endpointId").asText(null),cost,"Studio 创作", modelCharge);
        if(enterpriseBilling == null && cost>0) credits.hold(userId,cost,IpRunService.REF_TYPE,id,"Studio 创作", modelCharge);
        IpRun run=IpRun.builder().id(id).projectId(projectId).ownerUserId(userId).nodeId(request.nodeId())
                .kind("studio-"+request.operation()).status(IpRun.STATUS_RUNNING).stage("queued").cost(cost)
                .clientRequestId(request.clientRequestId()).inputFingerprint(fingerprint).inputJson(write(inputs))
                .outputJson("{}").createdAt(Instant.now()).heartbeatAt(Instant.now()).build();
        StudioRunBilling.apply(run,billing);
        runs.save(run);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try {worker.execute(id);} catch(RuntimeException e){worker.reject(id,e);}
            }
        });
        return projects.toRunDto(run);
    }

    /**
     * H3 出视频前先把提示词改写成官方写法（{@code video.rewrite}，2026-10-27）：这一行先是一条文字任务（冻结改写的上限、按实际用量结算），
     * worker 改写完在同一行上提交视频（写进 {@code _exec.nativeVideoJobIds}，之后按视频任务投影）。review 模式有提示时不出片，
     * 停在「用优化稿 / 用原文」上。视频的价格、付款方照常在提交视频时核对；这里先按同样的规则预检一遍，免得改写完才发现出不了片。
     */
    private IpRunDto submitVideoRewrite(String userId,String projectId,com.aistareco.aep.ipstudio.model.IpProject project,RunRequest request,String fingerprint) {
        var video=request.video();
        if(!Set.of("auto","review").contains(video.rewrite()))throw bad("STUDIO_VIDEO_INPUT_INVALID","不支持的提示词优化方式");
        if(studioVideo==null)throw bad("STUDIO_VIDEO_MODE_UNAVAILABLE","视频模型暂不可用");
        int count=request.count()==null?1:request.count();
        var check=videoRequest(request);
        if(!studioVideo.rewritable(request.model()))throw bad("STUDIO_VIDEO_OPTION_UNSUPPORTED","所选视频模型不支持提示词优化");
        long videoCost=Math.multiplyExact(studioVideo.quote(userId,new IpRunService.IpVideoRequest(check.prompt(),null,check.durationSec(),check.aspectRatio(),check.model(),null,video.submitted())),(long)count);
        if(request.modelBilling()==null)IpRunService.requireApprovedCost(request.maxCost(),videoCost);
        var selection=scenePolicies.resolve("studio","script",null,pricing.ipIdentity());
        var endpoint=selection.resolved().endpoint();
        var rate=chatRate(endpoint.getId());
        if(rate==null)throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"AI_TOKEN_PRICE_NOT_CONFIGURED","提示词优化暂不可用（文本模型未配置按量售价），可以关闭智能优化按原文生成");
        int seconds=request.durationSec()==null?5:request.durationSec();
        var built=com.aistareco.aep.ipstudio.h3.H3StudioPrompt.build(request.prompt(),seconds,video,projects.readDoc(project));
        var h3=built.request();
        String id="IPR-"+UUID.randomUUID().toString().replace("-","").substring(0,20);
        long cost=rate.maxCost();
        ObjectNode inputs=mapper.valueToTree(request);
        inputs.put("mock",false);
        var execution=inputs.putObject("_exec").put("holdTotal",cost).put("unitCost",cost).put("billingUnit","per_token")
                .put("rewrite",video.rewrite()).put("videoCost",videoCost);
        execution.set("h3",com.aistareco.aep.ipstudio.h3.H3PromptRewrite.meta(mapper,h3,built.pictures(),built.videos(),built.audios()));
        execution.put("systemPrompt",com.aistareco.aep.ipstudio.h3.H3PromptRewrite.system(h3.mode(),h3.codeLines(),h3.shots()!=null));
        execution.put("userPrompt",com.aistareco.aep.ipstudio.h3.H3PromptRewrite.user(h3));
        execution.put("endpointId",endpoint.getId()).put("temperature",0.6);
        int budget=Math.min(com.aistareco.aep.ipstudio.h3.H3PromptRewrite.MAX_TOKENS,rate.maxOutputTokens());
        if(endpoint.getChatMaxOutputTokens()!=null)budget=Math.min(budget,endpoint.getChatMaxOutputTokens());
        execution.put("maxTokens",budget);
        execution.set("tokenPricing",mapper.valueToTree(rate));
        var modelCharge=StudioTokenBilling.plan(endpoint,rate);
        StudioTokenBilling.store(execution,modelCharge,endpoint);
        var billing=enterpriseBilling==null?null:enterpriseBilling.reserve(userId,request.billing(),IpRunService.REF_TYPE,id,endpoint.getId(),cost,"Studio 视频提示词优化",modelCharge);
        if(enterpriseBilling==null&&cost>0)credits.hold(userId,cost,IpRunService.REF_TYPE,id,"Studio 视频提示词优化",modelCharge);
        IpRun run=IpRun.builder().id(id).projectId(projectId).ownerUserId(userId).nodeId(request.nodeId())
                .kind("studio-video").status(IpRun.STATUS_RUNNING).stage("queued").cost(cost)
                .enterpriseId(request.billing()!=null&&"enterprise".equals(request.billing().mode())?request.billing().enterpriseId():null)
                .clientRequestId(request.clientRequestId()).inputFingerprint(fingerprint).inputJson(write(inputs))
                .outputJson("{}").createdAt(Instant.now()).heartbeatAt(Instant.now()).build();
        StudioRunBilling.apply(run,billing);
        runs.save(run);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try {worker.execute(id);} catch(RuntimeException e){worker.reject(id,e);}
            }
        });
        return projects.toRunDto(run);
    }

    /** 改写的冻结上限（文本模型按量售价的上限），一键制作 / 制作计划按它预留预算；文本模型没配售价时为 0。 */
    public long videoRewriteHold() {
        if(fixtures.enabled()||scenePolicies==null)return 0;
        var rate=chatRate(scenePolicies.resolve("studio","script",null,pricing.ipIdentity()).resolved().endpoint().getId());
        return rate==null?0:rate.maxCost();
    }

    /**
     * AI 导演台的文字任务（写剧本 / 拆集 / 提取资产 / 规划片段）。
     *
     * <p>和画布文字创作是同一条链：作品选择的文本模型、按量计价、先冻结最大额度、afterCommit 派发、
     * worker 按实际 Token 结算、失败全退。宿主是导演作品（{@code hostId}），归属与加锁由调用方做。
     * 测试响应模式下 worker 走 {@code DirectorFixtures}，零成本并标 mock。
     *
     * @param meta 写进 inputs._director：任务名、目标、提交时的内容指纹，结果回投时据此判断是否还能用
     */
    @Transactional(propagation=org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public IpRunDto submitDirectorText(String userId, String hostId, String nodeId, String systemPrompt, String userPrompt,
                                       int maxTokens, String clientRequestId, ObjectNode meta, String model,
                                       com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billingSelection, Long maxCost) {
        requireText(clientRequestId, 64, "请求编号");
        ObjectNode canonical=mapper.createObjectNode().put("nodeId",nodeId).put("system",systemPrompt).put("user",userPrompt);
        if(model!=null)canonical.put("model",model);
        String fingerprint=hash(write(canonical));
        IpRun prior=runs.findByProjectIdAndClientRequestId(hostId,clientRequestId).orElse(null);
        if(prior!=null) {
            StudioRunBilling.requireSamePayer(prior,billingSelection);
            if(!fingerprint.equals(prior.getInputFingerprint()))throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_REQUEST_CHANGED","同一请求的内容已改变，请重新提交");
            return projects.toRunDto(prior);
        }
        AiModelInvocationService.ResolvedEndpoint textEndpoint=null;
        long cost=0;
        var chatRate=(com.aistareco.aep.service.AiChatTokenPricing.Rate)null;
        if(!fixtures.enabled()) {
            if(scenePolicies == null) textEndpoint=models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,model,"studio").orElseThrow(()->
                    new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"ENDPOINT_NOT_ALLOWED","文本模型不可用，请联系管理员配置"));
            else textEndpoint=scenePolicies.resolve("studio","script",model,pricing.ipIdentity()).resolved();
            chatRate=chatRate(textEndpoint.endpoint().getId());
            if(chatRate==null)throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"AI_TOKEN_PRICE_NOT_CONFIGURED","此模型尚未配置按量积分售价");
            int outputBudget=Math.min(maxTokens,chatRate.maxOutputTokens());
            if(textEndpoint.endpoint().getChatMaxOutputTokens()!=null)outputBudget=Math.min(outputBudget,textEndpoint.endpoint().getChatMaxOutputTokens());
            chatRate=chatRate.limitOutputTokens(outputBudget);
            cost=chatRate.maxCost();
            if(maxCost==null)throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_PRICE_CHANGED","模型计费配置已更新，请刷新后重试");
        }
        IpRunService.requireApprovedCost(maxCost,cost);
        String id="IPR-"+UUID.randomUUID().toString().replace("-","").substring(0,20);
        ObjectNode inputs=mapper.createObjectNode();
        inputs.put("operation","director").put("mock",fixtures.enabled());
        if(billingSelection!=null)inputs.set("billing",mapper.valueToTree(billingSelection));
        inputs.set("_director",meta);
        var execution=inputs.putObject("_exec").put("holdTotal",cost).put("unitCost",cost).put("billingUnit","per_call");
        execution.put("systemPrompt",systemPrompt).put("userPrompt",userPrompt).put("temperature",0.6);
        if(textEndpoint!=null)execution.put("endpointId",textEndpoint.endpoint().getId());
        int budget=maxTokens;
        if(chatRate!=null) {
            execution.set("tokenPricing",mapper.valueToTree(chatRate));
            execution.put("billingUnit","per_token");
            budget=Math.min(budget,chatRate.maxOutputTokens());
        }
        execution.put("maxTokens",budget);
        var modelCharge=StudioTokenBilling.plan(textEndpoint==null?null:textEndpoint.endpoint(),chatRate);
        StudioTokenBilling.store(execution,modelCharge,textEndpoint==null?null:textEndpoint.endpoint());
        var billing = enterpriseBilling == null ? null : enterpriseBilling.reserve(userId,billingSelection,IpRunService.REF_TYPE,id,
                execution.path("endpointId").asText(null),cost,"AI 导演台", modelCharge);
        if(enterpriseBilling == null && cost>0) credits.hold(userId,cost,IpRunService.REF_TYPE,id,"AI 导演台", modelCharge);
        IpRun run=IpRun.builder().id(id).projectId(hostId).hostType(IpRun.HOST_DIRECTOR).ownerUserId(userId).nodeId(nodeId)
                .kind("studio-director").status(IpRun.STATUS_RUNNING).stage("queued").cost(cost)
                .clientRequestId(clientRequestId).inputFingerprint(fingerprint).inputJson(write(inputs))
                .outputJson("{}").createdAt(Instant.now()).heartbeatAt(Instant.now()).build();
        StudioRunBilling.apply(run,billing);
        runs.save(run);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try {worker.execute(id);} catch(RuntimeException e){worker.reject(id,e);}
            }
        });
        return projects.toRunDto(run);
    }

    /** 导演台估价用：作品所选文本模型一次调用最多冻结多少、默认出图模型每张多少。 */
    public long[] directorPrices(String model) {
        var caps=capabilities();
        long text=directorTextModel(caps,model)
                .map(m->m.tokenPricing()==null?caps.textCost():m.tokenPricing().maxCost()).orElse(caps.textCost());
        return new long[]{text,caps.imageCost()};
    }

    /** A Director text step reserves only for the output tokens that step is allowed to request, on the work's chosen model. */
    public long directorTextPrice(String model, int maxOutputTokens) {
        var caps=capabilities();
        return directorTextModel(caps,model)
                .map(m->m.tokenPricing()==null?caps.textCost():m.tokenPricing().limitOutputTokens(maxOutputTokens).maxCost())
                .orElse(caps.textCost());
    }

    /** 导演台文本模型的唯一解析：null = 默认；点名了却不在候选里、或固定模式下点名非默认，一律拒绝。 */
    private Optional<TextModel> directorTextModel(Capabilities caps, String model) {
        var selected=caps.textModels().stream().filter(m->model==null?m.isDefault():model.equals(m.endpointId())).findFirst();
        if(model!=null&&selected.isEmpty())throw new BusinessException(HttpStatus.BAD_REQUEST,"ENDPOINT_NOT_ALLOWED","所选文本模型不可用，请在作品设置中重新选择");
        if(model!=null&&"fixed".equals(caps.textModelMode())&&!selected.orElseThrow().isDefault())
            throw new BusinessException(HttpStatus.BAD_REQUEST,"ENDPOINT_NOT_ALLOWED","此场景使用固定文本模型");
        return selected;
    }

    private void validateCreativeRequest(RunRequest request) {
        if("recreation".equals(request.operation()) && (request.scriptEdit()!=null||request.textEdit()!=null||Boolean.TRUE.equals(request.readVisuals())||request.settings()!=null||request.episodeNo()!=null||request.history()!=null||request.references()!=null&&!request.references().isEmpty()||request.mode()!=null&&!"segments".equals(request.mode())||request.packaging()!=null))
            throw bad("STUDIO_INPUT_INVALID","复刻创作只接受所选参考视频和分析要求");
        if("segments".equals(request.mode())&&!"recreation".equals(request.operation()))throw bad("STUDIO_INPUT_INVALID","分段模式只能用于视频拉片");
        if("asset-extract".equals(request.operation())) {
            if(request.scriptEdit()==null||request.scriptEdit().markdown()==null||request.scriptEdit().markdown().isBlank()||request.scriptEdit().markdown().length()>48000)
                throw bad("STUDIO_INPUT_INVALID","请提供已保存的剧本文字，最多 48000 字");
        } else StudioScriptRevision.validateInput(request);
        // A skill planning text run carries a brief, not a node body to revise.
        if(!("text".equals(request.operation())&&request.skillKey()!=null))StudioTextRevision.validateInput(request);
        if(request.maxCost()!=null && request.maxCost()<0) throw bad("STUDIO_INPUT_INVALID","费用上限不能为负");
        if(Boolean.TRUE.equals(request.readVisuals())&&!"assistant".equals(request.operation()))throw bad("STUDIO_INPUT_INVALID","读取画面只能用于创作助手");
        if(request.episodeNo()!=null && (request.episodeNo()<1 || request.episodeNo()>50)) throw bad("STUDIO_EPISODE_INVALID","请选择有效分集");
        if(request.mode()!=null && !Set.of("general","original","adapt","director","segments").contains(request.mode())) throw bad("STUDIO_MODE_INVALID","请选择创作模式");
        if(request.contextNodeIds()!=null && (request.contextNodeIds().size()>16 || request.contextNodeIds().stream().anyMatch(Objects::isNull))) throw bad("STUDIO_CONTEXT_LIMIT","最多引用 16 个画布对象");
        if(request.history()!=null) {
            if(request.history().size()>16) throw bad("STUDIO_HISTORY_LIMIT","对话过长，请开始新对话");
            for(Turn turn:request.history()) {
                if(turn==null || !Set.of("user","assistant").contains(turn.role())) throw bad("STUDIO_HISTORY_INVALID","对话内容不完整");
                requireText(turn.content(),4000,"对话内容");
            }
        }
        ScriptSettings settings=request.settings();
        if(settings!=null) {
            if(settings.episodeCount()!=null && (settings.episodeCount()<1 || settings.episodeCount()>6)) throw bad("STUDIO_EPISODE_LIMIT","一次最多创作 6 集，长剧请分集创作");
            if(settings.episodeDurationSec()!=null && (settings.episodeDurationSec()<5 || settings.episodeDurationSec()>300)) throw bad("STUDIO_DURATION_INVALID","每集时长应为 5 到 300 秒");
            for(String value:Arrays.asList(settings.genre(),settings.audience(),settings.era(),settings.core(),settings.style(),settings.characterBrief(),settings.structure())) if(value!=null && value.length()>1000) throw bad("STUDIO_SETTINGS_LIMIT","单项创作设定最多 1000 字");
            if(settings.fusionGenres()!=null && (settings.fusionGenres().size()>3 || settings.fusionGenres().stream().anyMatch(v->v==null || v.isBlank() || v.length()>100))) throw bad("STUDIO_SETTINGS_LIMIT","最多融合 3 种题材，每种最多 100 字");
        }
    }

    /** Execution identity carried by an executor-submitted step: the step it fills and where its events go. */
    record ExecutionBinding(com.aistareco.aep.ipstudio.execution.IpPlanExecution execution,JsonNode state,JsonNode step) {
        ObjectNode snapshot(ObjectMapper mapper) {
            var out=mapper.createObjectNode().put("executionId",execution.getId());
            if(step!=null)out.put("stepId",step.path("id").asText()).put("stage",step.path("stage").asText());
            if(execution.getThreadId()!=null)out.put("threadId",execution.getThreadId());
            return out;
        }
    }

    /**
     * Only the plan executor fills execution steps: the request must target an existing step of a running execution of this
     * owner and project, with the step's current attempt identity and the execution's fixed payer.
     */
    private ExecutionBinding executionBinding(String userId,String projectId,RunRequest request) {
        if(request.executionId()==null)return null;
        if(planExecutions==null)throw new BusinessException(HttpStatus.NOT_FOUND,"STUDIO_PLAN_EXECUTION_NOT_FOUND","这次连续制作不存在或已结束");
        var execution=planExecutions.findById(request.executionId()).filter(e->userId.equals(e.getOwnerUserId())&&projectId.equals(e.getProjectId()))
                .orElseThrow(()->new BusinessException(HttpStatus.NOT_FOUND,"STUDIO_PLAN_EXECUTION_NOT_FOUND","这次连续制作不存在或已结束"));
        JsonNode state=projects.parseOrEmptyObject(execution.getStepsJson());
        boolean stepNode=false;
        for(JsonNode step:state.path("steps"))stepNode|=com.aistareco.aep.ipstudio.execution.StudioPlanExecutionIds
                .stepNodeId(execution.getId(),step).equals(request.nodeId());
        // A planning run may read an active execution's outputs as context (e.g. compiling the production plan after
        // analysis) without filling a step; it never spends the execution's budget.
        if(!stepNode&&"text".equals(request.operation())&&request.skillKey()!=null) {
            if(!com.aistareco.aep.ipstudio.execution.IpPlanExecution.active(execution.getStatus()))
                throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_PLAN_STALE","这次连续制作已结束，请重新开始");
            return new ExecutionBinding(execution,state,null);
        }
        if(!com.aistareco.aep.ipstudio.execution.IpPlanExecution.RUNNING.equals(execution.getStatus()))
            throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_PLAN_STALE","连续制作已暂停或结束，不能再提交新的步骤");
        if(!stepNode) {
            // A dialogue child run: it must have been authorized through the execution gate under this request identity.
            for(JsonNode child:state.path("children"))
                if(request.clientRequestId().equals(child.path("clientRequestId").asText())&&request.operation().equals(child.path("operation").asText())) {
                    requireExecutionPayer(execution,request);
                    return new ExecutionBinding(execution,state,null);
                }
            throw new BusinessException(HttpStatus.FORBIDDEN,"STUDIO_PRODUCTION_NOT_AUTHORIZED","这一步还没有经过制作授权，请先确认方案和预算");
        }
        for(JsonNode step:state.path("steps")) {
            String stage=step.path("stage").asText(),id=step.path("id").asText();
            if(!com.aistareco.aep.ipstudio.execution.StudioPlanExecutionIds.stepNodeId(execution.getId(),step).equals(request.nodeId()))continue;
            if(!step.path("operation").asText().equals(request.operation()))throw bad("STUDIO_INPUT_INVALID","请求与连续制作的步骤不一致");
            if(!com.aistareco.aep.ipstudio.execution.StudioPlanExecutionIds.requestId(execution.getId(),stage,id,step.path("attempt").asInt(1)).equals(request.clientRequestId()))
                throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_PLAN_STALE","这一步已经换了新的尝试，请刷新后再看");
            requireExecutionPayer(execution,request);
            return new ExecutionBinding(execution,state,step);
        }
        throw bad("STUDIO_INPUT_INVALID","请求与连续制作的步骤不一致");
    }
    /** Every run under an execution pays with the payer fixed at confirmation; never silently another account. */
    private void requireExecutionPayer(com.aistareco.aep.ipstudio.execution.IpPlanExecution execution,RunRequest request) {
        var fixed=projects.parseOrEmptyObject(execution.getBillingJson());
        var requested=com.aistareco.aep.enterprise.service.EnterpriseBillingService.normalize(request.billing());
        if(!fixed.path("mode").asText("personal").equals(requested.mode())||!Objects.equals(fixed.path("enterpriseId").asText(null),requested.enterpriseId()))
            throw new BusinessException(HttpStatus.CONFLICT,"BILLING_SELECTION_CONFLICT","付款账户与已确认的连续制作不一致");
    }

    /** Active skill for planning/check; a check inside an execution uses the rules snapshot confirmed with its plan. */
    private com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules skillRules(RunRequest request,boolean skillPlan,boolean check,ExecutionBinding binding) {
        if(!skillPlan&&!check)return null;
        if(binding!=null&&binding.state().path("skill").isObject()) {
            // Inside an execution the confirmed snapshot rules apply; a newly deployed file never rewrites them.
            var snapshot=com.aistareco.aep.ipstudio.execution.StudioSkillRules.fromSnapshot(binding.state().path("skill"));
            if(request.skillKey()!=null&&!request.skillKey().equals(snapshot.key()))throw bad("STUDIO_INPUT_INVALID","制作方法与这次连续制作不一致");
            if(skillRules!=null)skillRules.requireActive(snapshot.key());
            return snapshot;
        }
        if(request.skillKey()==null)throw bad("STUDIO_INPUT_INVALID","请说明按哪个制作方法检查");
        if(skillRules==null)throw com.aistareco.aep.ipstudio.execution.StudioSkillRules.notFound();
        var rules=skillRules.requireActive(request.skillKey());
        if(skillPlan&&request.skillVersion()!=null&&request.skillVersion()!=rules.version())
            throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_PLAN_STALE","制作方法已更新，请刷新后重新规划");
        return rules;
    }

    private void validateSkillRequest(RunRequest request,boolean skillPlan,boolean check) {
        String operation=request.operation();
        if(request.stage()!=null&&!com.aistareco.aep.ipstudio.execution.StudioSkillRules.STAGES.contains(request.stage()))throw bad("STUDIO_INPUT_INVALID","请选择分析或制作阶段");
        if(request.recreation()!=null&&!("recreation".equals(operation)&&"segments".equals(request.mode())))throw bad("STUDIO_INPUT_INVALID","段长上限只能用于视频拉片");
        if(request.check()!=null&&!check)throw bad("STUDIO_INPUT_INVALID","检查目标只能用于成片检查");
        if(request.dialogue()!=null) {
            requireText(request.dialogue().threadId(),64,"对话");
            requireText(request.dialogue().messageId(),64,"对话消息");
        }
        if(skillPlan) {
            if(request.stage()==null)throw bad("STUDIO_INPUT_INVALID","请选择要规划的阶段");
            if(request.textEdit()!=null||request.scriptEdit()!=null||request.settings()!=null||request.episodeNo()!=null||Boolean.TRUE.equals(request.readVisuals())
                    ||request.references()!=null&&!request.references().isEmpty()||request.packaging()!=null||request.video()!=null||request.mode()!=null)
                throw bad("STUDIO_INPUT_INVALID","制作规划只接受目标说明、画布素材和对话反馈");
        }
        if(check) {
            if(request.check()==null||request.check().targetRunId()==null||request.check().targetRunId().isBlank())throw bad("STUDIO_CHECK_TARGET_INVALID","请选择要检查的成片");
            if(request.check().checkIds()==null||request.check().checkIds().isEmpty()||request.check().checkIds().size()>16)throw bad("STUDIO_INPUT_INVALID","请选择 1 到 16 个检查项");
            if(request.textEdit()!=null||request.scriptEdit()!=null||request.settings()!=null||request.episodeNo()!=null||Boolean.TRUE.equals(request.readVisuals())
                    ||request.references()!=null&&!request.references().isEmpty()||request.packaging()!=null||request.video()!=null||request.mode()!=null
                    ||request.history()!=null||request.contextNodeIds()!=null&&!request.contextNodeIds().isEmpty())
                throw bad("STUDIO_INPUT_INVALID","成片检查只接受检查目标、检查项和说明");
        }
    }

    /**
     * Segment cap for film study: "model" reads the selected video model's contract maximum (H3 = 15 s); an explicit
     * number may not exceed it. A source that cannot fit within maxSegments × cap is refused here, before any hold.
     */
    private ObjectNode segmentCap(RecreationSettings settings,JsonNode source,com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules skill) {
        if(settings.videoModel()==null||settings.videoModel().isBlank())throw bad("STUDIO_INPUT_INVALID","请选择用来生成分段视频的模型");
        var model=(studioVideo==null?List.<com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel>of():studioVideo.models()).stream()
                .filter(m->settings.videoModel().equals(m.endpointId())).findFirst()
                .orElseThrow(()->bad("STUDIO_VIDEO_MODEL_UNAVAILABLE","所选视频模型不可用，请换一个模型"));
        var contract=model.contract();
        if(contract==null||contract.maxSeconds()<=0)throw bad("STUDIO_VIDEO_MODEL_UNAVAILABLE","所选视频模型还没有可用的时长规格，请换一个模型");
        String requested=settings.maxSegmentSec()==null?"model":settings.maxSegmentSec().strip();
        double cap;
        if("model".equals(requested))cap=contract.maxSeconds();
        else {
            try {cap=Double.parseDouble(requested);} catch(NumberFormatException e){throw bad("STUDIO_INPUT_INVALID","每段时长上限需为秒数或按模型上限");}
            if(!Double.isFinite(cap)||cap<1)throw bad("STUDIO_INPUT_INVALID","每段时长上限至少 1 秒");
            if(cap>contract.maxSeconds())throw bad("STUDIO_INPUT_INVALID","每段时长上限不能超过所选模型的 "+contract.maxSeconds()+" 秒");
        }
        int maxSegments=skill==null?8:skill.maxSegments();
        double duration=source==null?0:source.path("durationSec").asDouble();
        var limit=new StudioFilmStudy.SegmentCap(cap,maxSegments);
        if(duration>cap*maxSegments+1e-6)throw StudioFilmStudy.tooLong(limit,duration,List.of());
        ObjectNode out=mapper.createObjectNode().put("maxSegmentSec",cap).put("requested",requested).put("maxSegments",maxSegments)
                .put("videoModel",model.endpointId());
        out.putObject("contract").put("minSeconds",contract.minSeconds()).put("maxSeconds",contract.maxSeconds());
        return out;
    }

    /**
     * Server-built check input: the target must be the caller's successful run in this project and the key one of its real
     * outputs; frames are sampled from that media at fixed, recorded times. The client never supplies visual context.
     */
    private ObjectNode checkTarget(String userId,String projectId,CheckSettings check,com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules skill) {
        Set<String> ids=new LinkedHashSet<>();
        for(String id:check.checkIds()) {
            if(id==null||!skill.checks().contains(id))throw bad("STUDIO_INPUT_INVALID","检查项不在本制作方法的清单中");
            ids.add(id);
        }
        var run=projects.ownedRun(userId,projectId,check.targetRunId()).orElseThrow(()->bad("STUDIO_CHECK_TARGET_INVALID","要检查的成片不存在或不属于这张画布"));
        var dto=projects.toRunDto(run);
        if(!"done".equals(dto.status()))throw bad("STUDIO_CHECK_TARGET_INVALID","要检查的成片还没有生成成功");
        var keys=planOutputs==null?List.<String>of():planOutputs.outputKeys(dto);
        String key=check.targetStorageKey()==null||check.targetStorageKey().isBlank()?(keys.isEmpty()?null:keys.get(0)):check.targetStorageKey();
        if(key==null||!keys.contains(key))throw bad("STUDIO_CHECK_TARGET_INVALID","只能检查这次生成真实产出的成片");
        projects.requireOwnedAssetKey(userId,key);
        boolean video=!key.matches("(?i).*\\.(png|jpe?g|webp)$");
        ObjectNode out=mapper.createObjectNode().put("targetRunId",run.getId()).put("targetStorageKey",key).put("mediaType",video?"video":"image");
        var checkIds=out.putArray("checkIds");ids.forEach(checkIds::add);
        var facts=out.putObject("mediaFacts");
        List<Double> times=List.of();
        try {
            var file=recreationStorage.openForRead(key);
            if(video) {
                if(java.nio.file.Files.size(file)>128L*1024*1024)throw bad("STUDIO_VISUAL_LIMIT","成片最多 128 MB");
                JsonNode probe=StudioLipSyncMedia.probe(file);
                double duration=probe.path("format").path("duration").asDouble();
                if(!Double.isFinite(duration)||duration<=0||duration>600)throw bad("STUDIO_CHECK_TARGET_INVALID","成片时长无法读取，不能检查");
                facts.put("durationSec",Math.round(duration*100)/100.0);
                for(JsonNode stream:probe.path("streams")) {
                    if("video".equals(stream.path("codec_type").asText())&&!facts.has("width"))facts.put("width",stream.path("width").asInt()).put("height",stream.path("height").asInt());
                    if("audio".equals(stream.path("codec_type").asText()))facts.put("hasAudio",true);
                }
                if(!facts.has("hasAudio"))facts.put("hasAudio",false);
                times=com.aistareco.aep.ipstudio.execution.StudioCheckOutcome.sampleTimes(duration,4);
            }
        } catch(BusinessException e){throw e;}
        catch(Exception e){throw bad("STUDIO_CHECK_TARGET_INVALID","要检查的成片无法读取，请确认它仍然存在");}
        var sampled=out.putArray("sampledTimesSec");times.forEach(sampled::add);
        return out;
    }

    private Map<String,String> checkVariables(RunRequest request,com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules skill,ObjectNode target) {
        var variables=new LinkedHashMap<String,String>();
        StringBuilder checklist=new StringBuilder();
        for(JsonNode id:target.path("checkIds"))checklist.append("- ").append(id.asText()).append('\n');
        String guide=skill.checkGuide();
        if(!guide.isBlank())checklist.append("\n判法说明（来自制作方法）：\n").append(guide);
        variables.put("checklist",checklist.toString());
        String description=request.prompt()==null||request.prompt().isBlank()?"未提供额外说明，只按检查清单判断。":request.prompt();
        variables.put("target",description+"\n成片实测信息（服务端测得，可作为 media 依据）："+target.path("mediaFacts"));
        variables.put("frames","video".equals(target.path("mediaType").asText())
                ?"随后附上 "+target.path("sampledTimesSec").size()+" 张真实采样画面，时间依次为 "+target.path("sampledTimesSec")+" 秒。frame 依据的 timeSec 只能从这些时间中选。"
                :"随后附上 1 张要检查的图片。frame 依据不填 timeSec。");
        return variables;
    }

    /** Next plan revision of this project; submit holds the project row lock, so revisions are monotonic per canvas. */
    private int nextPlanRevision(String projectId) {
        Long count=em.createQuery("select count(r) from IpRun r where r.projectId=:p and r.kind='studio-text' and r.inputJson like :marker",Long.class)
                .setParameter("p",projectId).setParameter("marker","%\"skillPlan\":true%").getSingleResult();
        return (int)Math.min(Integer.MAX_VALUE,(count==null?0:count)+1);
    }

    private Map<String,String> skillPlanVariables(String userId,com.aistareco.aep.ipstudio.model.IpProject project,RunRequest request,
            com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules skill,ExecutionBinding binding,JsonNode canvasContext,ObjectNode execution) {
        var variables=new LinkedHashMap<String,String>();
        String body=skill.body();
        variables.put("skill",body.length()>16000?body.substring(0,16000):body);
        variables.put("stage",skillPlanStageText(request.stage()));
        variables.put("constraints",skillPlanConstraints(mapper,skill,request.stage()).toString());
        variables.put("brief",request.prompt());
        // Allowed binding targets: the canvas nodes the user gave, plus (inside an execution) its own output nodes.
        Set<String> allowed=new LinkedHashSet<>(request.contextNodeIds()==null?List.of():request.contextNodeIds());
        var assets=mapper.createArrayNode();
        for(JsonNode item:canvasContext)assets.addObject().put("id",item.path("id").asText()).put("type",item.path("type").asText()).put("title",item.path("title").asText());
        String analysis="尚未分析。";
        if(binding!=null&&planOutputs!=null) {
            for(JsonNode node:planOutputs.outputNodes(binding.execution(),binding.state().path("steps"))) {
                if(allowed.add(node.path("nodeId").asText())) {
                    var item=assets.addObject().put("id",node.path("nodeId").asText()).put("type",node.path("type").asText()).put("title",node.path("title").asText());
                    if(node.has("durationSec"))item.put("durationSec",node.path("durationSec").asDouble());
                    if(node.has("startSec"))item.put("sourceStartSec",node.path("startSec").asDouble()).put("sourceEndSec",node.path("endSec").asDouble());
                }
            }
            analysis=planOutputs.analysis(binding.execution(),binding.state().path("steps"));
            if(analysis.isBlank())analysis="分析步骤没有留下可用结果。";
        }
        var allowedIds=execution.putArray("allowedNodeIds");allowed.forEach(allowedIds::add);
        variables.put("assets",assets.toString());
        variables.put("analysis",analysis);
        variables.put("capabilities",planCapabilities());
        String budget="尚未批准，报价由服务端填写。";
        if(binding!=null&&binding.step()!=null) {
            JsonNode stageBudget=projects.parseOrEmptyObject(binding.execution().getBudgetJson()).path(binding.step().path("stage").asText());
            if(stageBudget.isObject())budget="本阶段已批准 "+stageBudget.path("approvedCap").asLong()+" 积分；制作阶段需用户另行确认。";
        }
        variables.put("budget",budget);
        variables.put("feedback",request.history()==null||request.history().isEmpty()?"无。":write(request.history()));
        return variables;
    }

    /** Stage line of the skill_plan prompt; shared with the admin dry-run so both see the same planner input. */
    public static String skillPlanStageText(String stage) {
        return "analysis".equals(stage)?"分析阶段（解析、拉片、制作方案推导与计划编译）":"制作阶段（生成、检查与合成）";
    }

    /** Stage whitelist, limits, checks and the typed settings contract given to the planner (also used by the admin dry-run). */
    public static ObjectNode skillPlanConstraints(ObjectMapper mapper,com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules skill,String stage) {
        ObjectNode constraints=mapper.createObjectNode();
        var operations=constraints.putArray("operations");skill.stageOperations(stage).forEach(operations::add);
        constraints.put("maxSteps",skill.maxSteps()).put("maxSegments",skill.maxSegments()).put("maxSourceSec",skill.maxSourceSec()).put("maxSegmentSec",skill.maxSegmentSec());
        var checks=constraints.putArray("checks");skill.checks().forEach(checks::add);
        constraints.put("settings","每步 settings 按操作填写：recreation{sourceNodeId,mode:\"segments\",maxSegmentSec:\"model\"|秒数,videoModel}；image{count:1|2|4,aspectRatio?:\"9:16\"|\"16:9\"|\"1:1\"|\"3:4\"（画幅，按技能默认填）,size?:\"宽x高\"（只在用户给了像素尺寸时填）,referenceBindings[]}；video{video:{mode,resolutionTier,seed?},durationSec,aspectRatio,count:1|2|4,referenceBindings[]}；check{targetStepId,checkIds[],candidateIndex?}；assemble{clipOrder:[{stepId,candidateIndex?}],audioStrategy:\"generated\"|\"source-audio\"}；text{purpose:\"script\"|\"prompt-revision\"|\"plan-compile\"|\"note\",editTarget?}。referenceBindings 每项 {stepId 或 nodeId 二选一,role,order}。plan-compile 只在分析阶段用于编排制作计划。");
        var allowed=new java.util.HashSet<>(skill.stageOperations(stage));
        String directGuide=(skill.direct()?"这个方法没有分析阶段：直接写制作步骤，不写 plan-compile，没有真实取舍时 approaches 只写一个推荐方案或省略。":"")
                +"制作阶段只写本阶段允许的操作："+String.join("、",skill.stageOperations(stage))+"。"
                +(allowed.contains("text")?"text 用于写稿或改词：purpose 填 script / prompt-revision / note，改已有文字时写 editTarget。":"")
                +(allowed.contains("image")?"image 一步一张或一组（count 1|2|4），需要多张不同的图就多步；":"")
                +(allowed.contains("video")?"视频步骤排在它引用的图片步骤之后"+(allowed.contains("check")?"，多段制作建议每段视频后面接一个 check":"")
                +(allowed.contains("assemble")?"，多段最后用 assemble 按顺序合成（单段不加）":"")+"；每段 durationSec 在所选视频模型的最短与最长秒数之间。":"");
        constraints.put("stageGuide","analysis".equals(stage)
                ?"分析阶段的步骤顺序固定：先 recreation（对参考视频分段拉片，一条参考视频一步，sourceNodeId 填素材清单里那条视频的 id；用户没给参考视频就不写这一步），"
                +"最后一步 text（settings 只写 purpose:\"plan-compile\"，不写 editTarget），它依赖前面所有拉片步骤，负责用分析结果编排制作计划。分析阶段不写 image、video、check、assemble。"
                :directGuide);
        constraints.put("bindingRoles","referenceBindings 的 role 只能取这些值：图片步骤 "+String.join(" / ",new java.util.TreeSet<>(StudioPlanValidator.IMAGE_BINDING_ROLES))
                +"；视频步骤 "+String.join(" / ",new java.util.TreeSet<>(StudioPlanValidator.BINDING_ROLES))+"（原片片段用 reference-video 或 clip）。order 从 0 开始，同一步里不重复。");
        constraints.put("models","recreation.videoModel 必须原样复制「可用模型与合同」里 videoModels[].endpointId 的值，不能写模型名、别名或自己缩写。");
        constraints.put("targets","targetNodeId 只填素材清单里为这一步准备、还没有画面或正文的对象 id，类型与这一步的结果一致（image 填图片对象、video 填视频对象、写稿的 text 填文字对象）；check、assemble、recreation、plan-compile 和改稿的步骤不填。");
        constraints.put("references","referenceNodeIds 只能填素材清单里的画布对象 id，不能填步骤编号；要用更早步骤的产物，写进 dependsOn，图片和视频步骤再用 settings.referenceBindings 的 stepId 指定。素材清单里的对象（包括分析阶段产出的分段片段）在 referenceBindings 里一律写 nodeId，stepId 只填本计划里更早的步骤编号。");
        return constraints;
    }

    /** Video model contracts and text/image price hints from server truth, for the planner to stay inside real limits. */
    public String planCapabilities() {
        var out=mapper.createObjectNode();
        var videos=out.putArray("videoModels");
        if(studioVideo!=null)try {
            for(var model:studioVideo.models()) {
                var item=videos.addObject().put("endpointId",model.endpointId()).put("name",model.name()).put("isDefault",model.isDefault());
                if(model.contract()!=null) {
                    item.put("minSeconds",model.contract().minSeconds()).put("maxSeconds",model.contract().maxSeconds());
                    var modes=item.putArray("modes");
                    for(var mode:model.contract().modes()) {
                        var m=modes.addObject().put("mode",mode.mode()).put("needsFirstFrame",mode.needsFirstFrame()).put("needsLastFrame",mode.needsLastFrame())
                                .put("acceptsReferences",mode.references()!=null);
                        if(mode.label()!=null)m.put("label",mode.label());
                    }
                    var tiers=item.putArray("resolutionTiers");
                    for(var tier:model.contract().tiers()) {
                        var t=tiers.addObject().put("tier",tier.tier());var ratios=t.putArray("aspectRatios");
                        tier.canvases().forEach(c->ratios.add(c.aspectRatio()));
                    }
                }
            }
        } catch(RuntimeException e) {out.put("videoModelsUnavailable",true);}
        return out.toString();
    }

    /**
     * Server quote of one step request (never freezes): token ceiling for text-class runs, the image pipeline's unit
     * price, or the native video contract price. Video/image references may be quote placeholders: only counts matter.
     */
    public long quote(String userId,RunRequest request) {
        if(request==null||!OPERATIONS.contains(request.operation()))throw bad("STUDIO_OPERATION_INVALID","请选择创作方式");
        if(fixtures.enabled())return 0;
        return switch(request.operation()) {
            case "assemble" -> 0L;
            case "image" -> {
                var compiled=imageRuns.compileExplicit(userId,new IpRunService.IpGenerateRequest(request.nodeId(),request.prompt()==null||request.prompt().isBlank()?"图片":request.prompt(),
                        List.of(),request.count()==null?1:request.count(),request.size()==null?imageSize(request):request.size(),request.model()));
                yield Math.multiplyExact(compiled.unitCost(),(long)compiled.count());
            }
            case "video" -> {
                if(request.video()==null||studioVideo==null)throw bad("STUDIO_VIDEO_INPUT_INVALID","制作计划里的视频步骤需要明确视频模式");
                long unit=studioVideo.quote(userId,new IpRunService.IpVideoRequest(request.prompt(),null,request.durationSec(),request.aspectRatio(),request.model(),null,request.video().submitted()));
                // 先改写提示词的步骤把改写的冻结上限也算进去：制作计划的预算按它核对。
                yield Math.addExact(Math.multiplyExact(unit,(long)(request.count()==null?1:request.count())),request.video().rewrite()==null?0:videoRewriteHold());
            }
            default -> {
                AiModelInvocationService.ResolvedEndpoint endpoint=scenePolicies!=null?scenePolicies.resolve("studio","script",request.model(),pricing.ipIdentity()).resolved()
                        :models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,request.model(),"studio").orElseThrow(()->new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"ENDPOINT_NOT_ALLOWED","所选文本模型不可用"));
                var rate=chatRate(endpoint.endpoint().getId());
                if(rate==null)throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"AI_TOKEN_PRICE_NOT_CONFIGURED","此模型尚未配置按量积分售价");
                yield rate.maxCost();
            }
        };
    }

    private IpRunService.IpVideoRequest videoRequest(RunRequest request) {
        return new IpRunService.IpVideoRequest(request.prompt(),request.references()==null||request.references().isEmpty()?null:request.references().get(0).storageKey(),
                request.durationSec(),request.aspectRatio(),request.model(),request.maxCost(),request.video(),request.billing(),request.clientRequestId(),request.modelBilling());
    }
    @org.springframework.transaction.annotation.Transactional(readOnly=true)
    public com.aistareco.aep.billing.service.ModelChargeService.Quote quoteVideo(String user,String projectId,RunRequest request,boolean freeOnly) {
        projects.required(user,projectId);
        if(request==null||!"video".equals(request.operation())||fixtures.enabled())throw bad("MODEL_QUOTE_NOT_SUPPORTED","请选择视频生成");
        var refs=request.references()==null?List.<Reference>of():request.references();
        if(request.video()==null&&refs.size()>1)throw bad("STUDIO_VIDEO_FIRST_FRAME_ONLY","这个视频模型只支持一张首帧参考图");
        if(request.video()!=null&&!refs.isEmpty())throw bad("STUDIO_VIDEO_INPUT_INVALID","请在视频模式中明确选择参考素材");
        for(var ref:refs)requireReference(user,ref);
        return imageRuns.quoteVideo(user,projectId,videoRequest(request),request.count()==null?1:request.count(),freeOnly);
    }

    private IpRunService.IpGenerateRequest imageRequest(RunRequest request) {
        return new IpRunService.IpGenerateRequest(request.nodeId(),request.prompt(),
                request.references()==null?List.of():request.references().stream().map(Reference::storageKey).toList(),
                request.count()==null?1:request.count(),imageSize(request),request.model(),request.maxCost(),request.billing(),request.clientRequestId(),request.modelBilling());
    }
    @org.springframework.transaction.annotation.Transactional(readOnly=true)
    public com.aistareco.aep.billing.service.ModelChargeService.Quote quoteImage(String user,String projectId,RunRequest request,boolean freeOnly) {
        projects.required(user,projectId);
        if(request==null||!"image".equals(request.operation()))throw bad("MODEL_QUOTE_NOT_SUPPORTED","请选择图片生成");
        if(fixtures.enabled())throw bad("MODEL_QUOTE_NOT_SUPPORTED","测试响应无需扣费报价");
        if(request.count()!=null&&!Set.of(1,2,4).contains(request.count()))throw bad("STUDIO_IMAGE_COUNT_INVALID","一次可生成 1、2 或 4 张图片");
        if(request.references()!=null)for(var reference:request.references())requireReference(user,reference);
        return imageRuns.quoteImage(user,projectId,imageRequest(request),freeOnly);
    }

    // New nullable fields must not make a saved, accepted request look different after an upgrade.
    private ObjectNode canonicalRequest(com.fasterxml.jackson.databind.JsonNode source,com.fasterxml.jackson.databind.JsonNode shape) {
        ObjectNode result=mapper.createObjectNode();
        shape.fieldNames().forEachRemaining(name->{if(source.hasNonNull(name)) result.set(name,withoutNullFields(source.get(name)));});
        return result;
    }

    // Adding nullable creative fields must preserve the identity of already accepted requests.
    private com.fasterxml.jackson.databind.JsonNode withoutNullFields(com.fasterxml.jackson.databind.JsonNode value) {
        if(value.isObject()) {ObjectNode out=mapper.createObjectNode();value.fields().forEachRemaining(e->{if(!e.getValue().isNull())out.set(e.getKey(),withoutNullFields(e.getValue()));});return out;}
        if(value.isArray()) {var out=mapper.createArrayNode();value.forEach(v->out.add(withoutNullFields(v)));return out;}
        return value;
    }

    private void requireReference(String userId, Reference ref) {
        if(ref==null || ref.storageKey()==null || ref.storageKey().isBlank()) throw bad("STUDIO_REFERENCE_MISSING","参考素材缺少文件");
        if(!Set.of("character","scene","product","frame","clip").contains(ref.role())) throw bad("STUDIO_REFERENCE_ROLE_INVALID","参考素材用途不正确");
        if(ref.ipId()!=null) assets.requiredIp(userId,ref.ipId());
        if(ref.avatarId()!=null) {
            DapAvatar a=avatars.required(userId,ref.avatarId());
            if(ref.ipId()!=null && !ref.ipId().equals(a.getIpId())) throw bad("STUDIO_IP_REFERENCE_MISMATCH","人物不属于所选 IP");
            if(!(ref.lookId()!=null?ipAssets.matchesLook(a,ref.lookId(),ref.storageKey()):ipAssets.matchesVersion(a,ref.storageKey(),ref.version()))) throw bad("STUDIO_IP_VERSION_MISMATCH","参考图片与所选人物版本不一致");
            return;
        }
        projects.requireOwnedAssetKey(userId,ref.storageKey());
    }

    @Transactional
    public AdoptResult adopt(String userId,String projectId,AdoptRequest request) {
        projects.requiredForUpdate(userId,projectId);
        if(request==null) throw bad("STUDIO_ADOPT_INVALID","请选择要采用的形象");
        requireText(request.nodeId(),64,"形象节点"); requireText(request.name(),128,"IP 名称");
        String key=projects.requireOwnedAssetKey(userId,request.storageKey());
        if(key==null) throw bad("STUDIO_ADOPT_IMAGE_REQUIRED","请选择已有的形象图片");
        if(!key.matches("(?i).*\\.(png|jpg|jpeg|webp)$")) throw bad("STUDIO_ADOPT_IMAGE_REQUIRED","请采用图片作为形象");
        // Keep fingerprints of already accepted pre-classification requests stable after this nullable field is added.
        ObjectNode adoptionInput=mapper.valueToTree(request);if(request.assetRole()==null)adoptionInput.remove("assetRole");
        String fingerprint=hash(write(adoptionInput)); String clientId="adopt-"+fingerprint.substring(0,50);
        IpRun prior=runs.findByProjectIdAndClientRequestId(projectId,clientId).orElse(null);
        if(prior!=null) return mapper.convertValue(projects.parseOrEmptyObject(prior.getOutputJson()).path("adoption"),AdoptResult.class);
        DapAvatar avatar=request.avatarId()==null?null:avatars.required(userId,request.avatarId());
        if(request.intent()!=null && !List.of("main","look").contains(request.intent())) throw bad("STUDIO_ADOPT_INTENT_INVALID","请选择主形象或造型");
        boolean look="look".equals(request.intent());
        if(look)StudioIpAssetService.requireLookRole(request.assetRole());
        else if(request.assetRole()!=null && !"main".equals(request.assetRole()))throw bad("STUDIO_ASSET_ROLE_INVALID","主形象请使用主形象类别，其他素材归档为人物造型");
        if(look && avatar==null) throw bad("STUDIO_LOOK_AVATAR_REQUIRED","请先选择造型所属人物");
        if(avatar!=null) em.lock(avatar,LockModeType.PESSIMISTIC_WRITE);
        String ipId=request.ipId()!=null?request.ipId():avatar==null?null:avatar.getIpId();
        if(ipId!=null) assets.requiredIp(userId,ipId);
        if(avatar!=null && avatar.getIpId()!=null && !Objects.equals(avatar.getIpId(),ipId))
            throw bad("STUDIO_AVATAR_ALREADY_LINKED","该人物属于另一个 IP，请保留原归属");
        if(ipId==null) ipId=assets.createIp(userId,new CreateIpRequest(request.name(),"Studio 创作 IP",request.description())).id();
        String lookId=null;
        if(look) {
            lookId=ipAssets.saveLook(avatar,request.name(),key,request.description(),request.assetRole());
        } else if(avatar==null) {
            Map<String,Object> deriv=new LinkedHashMap<>(),counts=new LinkedHashMap<>();
            DapAvatarService.DERIV_KEYS.forEach(k->{deriv.put(k,"empty");counts.put(k,0);});
            avatar=DapAvatar.builder().id(avatars.uniqueId("DH")).ownerUserId(userId).ipId(ipId).name(request.name())
                    .codename("ip-studio").path("ai").archetype("IP 工作台形象").status("finalized").hue(230)
                    .hairStyle("short").palette(support.paletteFor(230)).def(new LinkedHashMap<>()).deriv(deriv).counts(counts)
                    .versions(1).imageKey(key).variantKeys(new ArrayList<>(List.of(key))).descPrompt(request.description())
                    .createdAt(Instant.now()).updatedAt(Instant.now()).build();
            avatars.save(avatar); avatars.addVersionAt(avatar,1,"Studio 采用主形象","init",key);
        } else if(!key.equals(avatar.getImageKey())) {
            avatars.addVersion(avatar,"Studio 更新主形象","refine",key);
            avatar.setImageKey(key); avatar.setUpdatedAt(Instant.now()); avatar.setIpId(ipId); avatars.save(avatar);
        } else if(avatar.getIpId()==null) {avatar.setIpId(ipId); avatars.save(avatar);}
        AdoptResult result=new AdoptResult(ipId,avatar.getId(),avatar.getVersions(),key,lookId);
        ObjectNode output=mapper.createObjectNode(); output.set("adoption",mapper.valueToTree(result));
        runs.save(IpRun.builder().id("IPR-"+UUID.randomUUID().toString().substring(0,20)).projectId(projectId).ownerUserId(userId)
                .nodeId(request.nodeId()).kind("studio-adopt").status(IpRun.STATUS_DONE).stage("done").pct(100)
                .clientRequestId(clientId).inputFingerprint(fingerprint).inputJson(write(request)).outputJson(write(output))
                .createdAt(Instant.now()).finishedAt(Instant.now()).heartbeatAt(Instant.now()).build());
        return result;
    }

    private void requireText(String value,int max,String label) {
        if(value==null||value.isBlank()||value.length()>max) throw bad("STUDIO_INPUT_INVALID",label+"不能为空且不能超过 "+max+" 字");
    }
    private String imageSize(RunRequest request) {
        String ratio=request.aspectRatio()==null?"3:4":request.aspectRatio();
        if(com.aistareco.aep.ipstudio.service.StudioImageModelRouting.isProductRequest(request.model())) {
            if(request.size()==null||request.size().isBlank())return null;
            if(com.aistareco.aep.ipstudio.service.StudioImageModelRouting.tierForSize(request.size())==null)
                throw bad("STUDIO_IMAGE_RESOLUTION_INVALID","请选择 1K、2K 或 4K 图片分辨率");
            return request.size(); // IpRunService resolves the provider endpoint and validates its exact spec.
        }
        if(request.model()!=null&&request.model().startsWith(com.aistareco.aep.ipstudio.service.StudioImageModelRouting.REQUEST_PREFIX))
            throw bad("STUDIO_IMAGE_MODEL_INVALID","图片模型系列无效，请重新选择");
        if(scenePolicies!=null) {
            var endpoint=scenePolicies.resolve("studio","image",request.model(),pricing.ipImage()).resolved().endpoint();
            if(JusuanImageClient.supports(endpoint)) {
                var spec=com.aistareco.aep.model.AiImageRequestSpec.read(endpoint.getImageRequestSpecJson());
                if(spec==null)throw bad("STUDIO_IMAGE_SPEC_NOT_CONFIGURED","当前图片模型尚未配置可用规格");
                if(request.size()!=null && !request.size().isBlank()) {
                    var output=spec.output(request.size());
                    if(output!=null && (request.aspectRatio()==null || ratio.equals(output.aspectRatio())))return request.size();
                    throw bad("STUDIO_IMAGE_SIZE_UNSUPPORTED","当前图片模型不支持所选画幅，请更换画幅或图片模型");
                }
                return spec.outputs().stream().filter(output->ratio.equals(output.aspectRatio()))
                        .map(com.aistareco.aep.model.AiImageRequestSpec.Output::canvasSize).findFirst()
                        .orElseThrow(()->bad("STUDIO_IMAGE_SIZE_UNSUPPORTED","当前图片模型不支持所选画幅，请更换画幅或图片模型"));
            }
        }
        if(request.size()!=null && !request.size().isBlank()) return request.size();
        return switch(ratio) {
            case "9:16" -> "768x1365";
            case "16:9" -> "1365x768";
            case "1:1" -> "1024x1024";
            case "3:4" -> "768x1024";
            default -> throw bad("STUDIO_IMAGE_SIZE_UNSUPPORTED","当前图片模型不支持所选画幅，请更换画幅或图片模型");
        };
    }
    private BusinessException bad(String code,String message) {return BusinessException.badRequest(code,message);}
    private String write(Object value) {try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalArgumentException(e);}}
    private String hash(String value) {try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
