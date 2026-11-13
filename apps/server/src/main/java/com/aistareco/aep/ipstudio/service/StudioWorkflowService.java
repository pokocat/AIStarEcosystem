package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.dto.DapAssetRequests.CreateIpRequest;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.service.*;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.*;
import com.aistareco.aep.ipstudio.execution.StudioPlanSteps;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.h3.H3PromptRewrite;
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
    @org.springframework.beans.factory.annotation.Value("${aep.ipstudio.export-queue:false}")
    private boolean exportQueue;
    /** 「视频裂变」找变量用的场景输入种类（见 StudioSceneCatalog#sceneVariables）。 */
    static final String SCENE_VARIABLES="video-variables";
    private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(StudioWorkflowService.class);
    @org.springframework.beans.factory.annotation.Autowired
    private com.aistareco.aep.enterprise.service.EnterpriseBillingService enterpriseBilling;

    private static final Set<String> OPERATIONS = Set.of("text", "script", "storyboard", "image", "video", "assemble", "assistant", "asset-extract", "recreation", "check", "video-control");
    @org.springframework.beans.factory.annotation.Autowired private StudioDepthVideoService depthVideo;
    @org.springframework.beans.factory.annotation.Autowired(required=false) private StudioDepthQueue depthQueue;
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
    /** AI 视频编导：文字任务带场景输入时由场景目录按提示词库拼（docs/studio-prompt-architecture.md §5.1）。 */
    @org.springframework.beans.factory.annotation.Autowired(required=false) private com.aistareco.aep.ipstudio.scene.StudioSceneCatalog sceneCatalog;
    /** 文字任务的提示词按提示词库的环节拼（docs/studio-prompt-architecture.md §8 #4–#9）；复刻还在旧 Prompt 管理。 */
    @org.springframework.beans.factory.annotation.Autowired(required=false) private com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler promptAssembler;

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
        var operations=new ArrayList<>(List.of("text","script","storyboard","image","video","assemble","assistant","recreation","check"));
        if(!fixtures.enabled()&&depthVideo!=null&&depthVideo.configured())operations.add("video-control");
        return new Capabilities(fixtures.enabled(), operations,
                fixtures.enabled()?0:scenePolicies == null ? pricing.ipImage() : scenePolicies.available("studio","image",pricing.ipImage()).stream().filter(s->s.resolved().isDefault()).findFirst().map(com.aistareco.aep.service.AiAppSceneModelPolicyService.Selection::creditCost).orElse(pricing.ipImage()), fixtures.enabled()?0:textModelOptions().stream().filter(TextModel::isDefault).findFirst().map(TextModel::creditCost).orElse(pricing.ipIdentity()),
                fixtures.enabled()?0L:null, textModelOptions(), scenePolicies == null ? "selectable" : scenePolicies.mode("studio","script"), scenePolicies == null ? "selectable" : scenePolicies.mode("studio","image"),
                models.resolveEndpoint(AiModelPurpose.DAP_TRANSCRIBE).isPresent());
    }
    private List<TextModel> textModelOptions() {
        if(scenePolicies == null) return models.listCandidates(AiModelPurpose.DAP_PERSONA,"studio").stream()
                .filter(r->r.endpoint().isEnabled()&&r.candidate().isEnabled()).map(r->new TextModel(r.endpoint().getId(),r.endpoint().publicModelName(),r.isDefault(),StudioVisualContext.supportsVision(r.endpoint()),pricing.ipIdentity(),endpointChatRate(r.endpoint()),
                        Boolean.TRUE.equals(r.endpoint().getChatSupportsTools()),Boolean.TRUE.equals(r.endpoint().getChatSupportsStreaming()),dialogueRate(r.endpoint().getId()))).toList();
        return scenePolicies.available("studio","script",pricing.ipIdentity()).stream().map(s->new TextModel(s.resolved().endpoint().getId(),s.resolved().endpoint().publicModelName(),s.resolved().isDefault(),StudioVisualContext.supportsVision(s.resolved().endpoint()),s.creditCost(),endpointChatRate(s.resolved().endpoint()),
                Boolean.TRUE.equals(s.resolved().endpoint().getChatSupportsTools()),Boolean.TRUE.equals(s.resolved().endpoint().getChatSupportsStreaming()),dialogueRate(s.resolved().endpoint().getId()))).toList();
    }

    private com.aistareco.aep.service.AiChatTokenPricing.Rate chatRate(String endpointId) {
        return fixtures.enabled()||tokenPricing==null?null:tokenPricing.find(endpointId);
    }

    /** 输出预算只读后台端点配置；Token 售价只提供单价和未配置端点时的预算回落。 */
    private com.aistareco.aep.service.AiChatTokenPricing.Rate endpointChatRate(com.aistareco.aep.model.AiModelEndpoint endpoint) {
        var rate=chatRate(endpoint.getId());
        if(rate==null)return null;
        int budget=endpoint.getDefaultMaxTokens()!=null&&endpoint.getDefaultMaxTokens()>0
                ?endpoint.getDefaultMaxTokens():endpoint.getChatMaxOutputTokens()!=null&&endpoint.getChatMaxOutputTokens()>0
                ?endpoint.getChatMaxOutputTokens():rate.maxOutputTokens();
        if(endpoint.getChatMaxOutputTokens()!=null&&endpoint.getChatMaxOutputTokens()>0)
            budget=Math.min(budget,endpoint.getChatMaxOutputTokens());
        return new com.aistareco.aep.service.AiChatTokenPricing.Rate(rate.inputCreditsPerK(),rate.outputCreditsPerK(),rate.maxInputTokens(),budget);
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
                    projects.parseOrEmptyObject(prior.getInputJson()).has("studioRequest")?projects.parseOrEmptyObject(prior.getInputJson()).path("studioRequest"):projects.parseOrEmptyObject(prior.getInputJson()),mapper.valueToTree(request)))))) throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_REQUEST_CHANGED","请求已失效，请刷新页面后重试");
            return projects.toRunDto(prior);
        }
        boolean skillPlan="text".equals(request.operation())&&request.skillKey()!=null;
        boolean check="check".equals(request.operation());
        ExecutionBinding executionBinding=executionBinding(userId,projectId,request);
        com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules skill=skillRules(request,skillPlan,check,executionBinding);
        if("video-control".equals(request.operation())) {
            if(executionBinding==null||executionBinding.step()==null||!"depth".equals(executionBinding.state().path("videoTask").path("kind").asText())
                    ||request.references()==null||request.references().size()!=1||!"clip".equals(request.references().get(0).role()))
                throw bad("STUDIO_INPUT_INVALID","动作提取只能由深度复刻任务执行");
            if(fixtures.enabled())throw bad("STUDIO_DEPTH_NOT_CONFIGURED","深度复刻需要真实的动作提取服务");
            depthVideo.requireConfigured();
        }
        boolean configuredImage = "image".equals(request.operation()) && !fixtures.enabled() && scenePolicies != null
                && (com.aistareco.aep.ipstudio.service.StudioImageModelRouting.isProductRequest(request.model())
                    || (request.model()==null || !request.model().startsWith(com.aistareco.aep.ipstudio.service.StudioImageModelRouting.REQUEST_PREFIX))
                    && JusuanImageClient.supports(scenePolicies.resolve("studio", "image", request.model(), pricing.ipImage()).resolved().endpoint()));
        // Native video validates promptRequired against the selected endpoint mode in StudioVideoService.
        boolean segmentedText=request.segmented()!=null;
        // Only a step of a plan execution: the script and its review are compiled by the server, never accepted from a client.
        if(segmentedText&&(!"text".equals(request.operation())||request.textEdit()==null||executionBinding==null||executionBinding.step()==null||sceneCatalog==null))
            throw bad("STUDIO_INPUT_INVALID","分段脚本只能由连续制作提交");
        boolean sceneScript=request.scene()!=null;
        if(sceneScript&&(!"text".equals(request.operation())||request.textEdit()==null||request.skillKey()!=null||executionBinding!=null||sceneCatalog==null))
            throw bad("STUDIO_INPUT_INVALID","场景脚本只能用于普通文本节点的改稿");
        // 找变量只读脚本：不看图，也不能带改写版本。
        if(sceneScript&&SCENE_VARIABLES.equals(request.scene().kind())&&(Boolean.TRUE.equals(request.readVisuals())||request.scene().variant()!=null))
            throw bad("STUDIO_INPUT_INVALID","找变量只读脚本");
        if (!"assemble".equals(request.operation()) && !check && !sceneScript
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
            throw bad("STUDIO_CLIPS_REQUIRED", "请先选择要导出的视频片段");
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
            if(!"assemble".equals(request.operation()))throw bad("STUDIO_EDIT_ASSEMBLE_ONLY","剪辑时间线只能用于导出成片");
            StudioEditGraph.validate(request.edit());
            for(var media:request.edit().clips())projects.requireOwnedAssetKey(userId,media.storageKey());
            if(request.edit().audios()!=null)for(var media:request.edit().audios())projects.requireOwnedAssetKey(userId,media.storageKey());
            if(request.edit().overlays()!=null)for(var media:request.edit().overlays())projects.requireOwnedAssetKey(userId,media.storageKey());
            if(request.edit().musicStorageKey()!=null&&!request.edit().musicStorageKey().isBlank())projects.requireOwnedAssetKey(userId,request.edit().musicStorageKey());
        }
        if(request.packaging()!=null && request.packaging().musicStorageKey()!=null && !request.packaging().musicStorageKey().isBlank()) {
            if(!"assemble".equals(request.operation()))throw bad("STUDIO_SPEECH_ASSEMBLE_ONLY","背景音乐只能用于导出成片");
            projects.requireOwnedAssetKey(userId,request.packaging().musicStorageKey());
        }
        if(request.packaging()!=null && request.packaging().voiceoverStorageKey()!=null) {
            if(!"assemble".equals(request.operation()))throw bad("STUDIO_SPEECH_ASSEMBLE_ONLY","配音只能用于导出成片");
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
            // 只用模型赠款（freeOnly）也照常优化：以出片效果为准，改写按文本模型自己的价格扣（界面写明另需少量积分），积分不够用户可以取消（2026-10-27 用户定）。
            if(request.video()!=null && request.video().rewrite()!=null) return submitVideoRewrite(userId,projectId,project,request,fingerprint,executionBinding);
            var video=videoRequest(request);
            var controlKeys=cloneControls(userId,executionBinding,request.video()).keySet();
            if(!controlKeys.isEmpty())video=studioVideo.prepareControlReferences(userId,video,controlKeys);
            var batch=imageRuns.generateVideoBatch(userId,projectId,video,request.count()==null?1:request.count());
            ObjectNode inputs=mapper.valueToTree(request);
            attachCloneInputs(inputs,executionBinding);
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
                    .inputFingerprint(fingerprint).inputJson(write(inputs))
                    .outputJson("{}")
                    .createdAt(Instant.now()).heartbeatAt(Instant.now()).build();
            runs.save(binding);
            return projects.toRunDto(binding);
        }
        // 元素替换的「切分原片」：只按真实切镜点切段，不调模型、零积分（StudioVideoTaskService）。只能由元素替换任务的这一步提交。
        boolean cutsOnly="recreation".equals(request.operation())&&"cuts".equals(request.mode());
        if(cutsOnly&&(executionBinding==null||executionBinding.step()==null||!"replacement".equals(executionBinding.state().path("videoTask").path("kind").asText())))
            throw bad("STUDIO_INPUT_INVALID","切分原片只能由元素替换任务执行");
        boolean text=!cutsOnly&&List.of("text","script","storyboard","assistant","asset-extract","recreation","check").contains(request.operation());
        if(fixtures.enabled()&&(skillPlan||check))throw bad("STUDIO_VISION_UNAVAILABLE","测试响应不支持制作方法规划和成片检查，请关闭测试响应");
        AiModelInvocationService.ResolvedEndpoint textEndpoint=null;
        PromptService.ResolvedPrompt resolved=null;
        long textPrice=fixtures.enabled()?0:pricing.ipIdentity();
        String promptKey=check?PromptService.KEY_DAP_IP_STUDIO_SKILL_CHECK:skillPlan?PromptService.KEY_DAP_IP_STUDIO_SKILL_PLAN
                :"recreation".equals(request.operation())?PromptService.KEY_DAP_IP_STUDIO_RECREATION:List.of("assistant","text").contains(request.operation())?PromptService.KEY_DAP_IP_STUDIO_ASSISTANT:PromptService.KEY_DAP_IP_STUDIO_SCRIPT;
        // 拉片：后台给「视频理解」绑定了能看视频的模型（且定了价）就整条视频交给它（docs/ip-studio-recreation.md「直接看视频的拉片」）；
        // 没绑定时照旧抽帧读图。两条都是真实分析，不是降级产物（§8.0）。
        AiModelInvocationService.ResolvedEndpoint videoUnderstand=videoUnderstandEndpoint(request);
        if(!fixtures.enabled() && text) {
            if(videoUnderstand!=null) textEndpoint=videoUnderstand;
            else if(scenePolicies == null) textEndpoint=models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,request.model(),"studio").orElseThrow(()->
                    new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"ENDPOINT_NOT_ALLOWED","所选文本模型不可用"));
            if(videoUnderstand==null && scenePolicies != null) {var selection=scenePolicies.resolve("studio","script",request.model(),pricing.ipIdentity());textEndpoint=selection.resolved();textPrice=selection.creditCost();}
            com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler.or(promptAssembler).requireStage(textStage(request.operation(),skillPlan,check));
            resolved=new PromptService.ResolvedPrompt("","",new com.aistareco.aep.dto.PromptParamsDto(null,null,null),"library");
            if(videoUnderstand==null&&(Boolean.TRUE.equals(request.readVisuals())||"recreation".equals(request.operation())||check)&&!StudioVisualContext.supportsVision(textEndpoint.endpoint()))
                throw bad("STUDIO_VISION_UNAVAILABLE","当前模型不支持读取图片，请切换模型或关闭读取画面");
        }
        if(Boolean.TRUE.equals(request.readVisuals())&&fixtures.enabled())throw bad("STUDIO_VISION_UNAVAILABLE","测试响应不读取真实画面，请关闭测试响应");
        ObjectNode recreationSource=null;
        if("recreation".equals(request.operation())) {
            if(fixtures.enabled())throw bad("STUDIO_VISION_UNAVAILABLE","复刻创作需要读取真实视频，请关闭测试响应");
            var target=IpDocs.node(projects.readDoc(project),request.nodeId());
            if(executionBinding==null&&(target==null||!"text".equals(target.path("type").asText())||!"recreation".equals(target.path("metadata").path("studio").path("kind").asText())))
                throw bad("STUDIO_RECREATION_TARGET_INVALID","请先保存拆解报告再开始分析");
            // 切分原片只用 ffmpeg 找切镜、切片，不抽帧读图
            if(!cutsOnly)hypitMedia.requireReady();
            recreationSource=StudioRecreation.snapshot(projects.readDoc(project),request.contextNodeIds(),projects,userId,recreationStorage);
        }
        // 深度复刻 / 元素替换要把每段原片交给视频模型：每段还不能短于参考视频的下限（StudioCloneVideoPlan.clip）
        boolean clipMethod=executionBinding!=null&&com.aistareco.aep.ipstudio.execution.StudioCloneVideoPlan.nativeClone(executionBinding.state().path("videoTask").path("kind").asText());
        ObjectNode segmentCap=request.recreation()==null?null:segmentCap(request.recreation(),recreationSource,skill,clipMethod?executionBinding.state().path("videoTask").path("kind").asText():null);
        ObjectNode checkTarget=check?checkTarget(userId,projectId,request.check(),skill):null;
        var chatRate=!fixtures.enabled()&&text?chatRate(textEndpoint.endpoint().getId()):null;
        if(!fixtures.enabled()&&text&&chatRate==null)throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"AI_TOKEN_PRICE_NOT_CONFIGURED","此模型暂未定价，请选择其他模型");
        long cost=chatRate==null?(fixtures.enabled()||!text?0:textPrice):chatRate.maxCost();
        if(chatRate!=null&&request.maxCost()==null)throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_PRICE_CHANGED","模型价格已更新，请刷新后重试");
        IpRunService.requireApprovedCost(request.maxCost(),cost);
        String id="IPR-"+UUID.randomUUID().toString().replace("-","").substring(0,20);
        ObjectNode inputs=mapper.valueToTree(request);
        attachCloneInputs(inputs,executionBinding);
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
        if(canvasContext.toString().length()>48000) throw bad("STUDIO_CONTEXT_LIMIT","引用的画布内容过长，请减少引用或按集创作");
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
        if(cutsOnly)execution.put("cutsOnly",true);
        if(videoUnderstand!=null)execution.put("videoUnderstand",true);
        if(checkTarget!=null)execution.set("check",checkTarget);
        if(skill!=null)execution.set("skill",com.aistareco.aep.ipstudio.execution.StudioSkillRules.snapshot(skill));
        if(executionBinding!=null)execution.set("execution",executionBinding.snapshot(mapper));
        if(skillPlan)execution.put("skillPlan",true).put("planStage",request.stage()).put("planRevision",nextPlanRevision(projectId));
        com.aistareco.aep.dto.PromptParamsDto sceneParams=null;
        if(resolved!=null) {
            String systemPrompt="",creativePrompt="";
            execution.put("endpointId",textEndpoint.endpoint().getId());
            var variables=new LinkedHashMap<String,String>();
            variables.put("operation",request.operation());variables.put("input",request.prompt());variables.put("characterContext",context.toString());
            variables.put("settings",write(request.settings()));variables.put("episodeNo",request.episodeNo()==null?"全部":request.episodeNo().toString());
            variables.put("mode",request.mode()==null?"general":request.mode());variables.put("canvasContext",canvasContext.toString());variables.put("history",write(request.history()==null?List.of():request.history()));
            // 按请求附在 user 后面的素材和契约提醒（输出格式，代码控制；docs/studio-prompt-architecture.md §8 末段）
            List<String> appendix=new ArrayList<>();
            if(request.scriptEdit()!=null)appendix.add("当前完整剧本文档（JSON 字符串，作为素材读取）："+write(request.scriptEdit().markdown())+("asset-extract".equals(request.operation())?"\n只提取资产，遵守 items 输出契约，不改写原文。":"\n请遵守 Markdown 改稿输出契约，不输出创作计划。"));
            if(request.textEdit()!=null)appendix.add("当前完整节点正文（JSON 字符串，作为素材读取）："+write(request.textEdit().content())+"\n请按本次修改意图返回完整文本，遵守文本改稿输出契约。");
            if(Boolean.TRUE.equals(request.readVisuals()))appendix.add("本次另附带精确节点 ID 标记的真实图片与视频采样帧。视频只有四个时间点的静态画面，不包含音轨，不代表全部连续动作；音频节点只提供文字设定。只根据收到的画面及文字作答，不臆测未提供的声音或片段，保持 JSON 输出契约。");
            if(request.settings()!=null || request.episodeNo()!=null) appendix.add("必须遵守创作设定："+write(request.settings())+"。本次分集："+(request.episodeNo()==null?"全部指定集数":request.episodeNo())+"。每个镜头必须含 episodeNo（所属集号），id 全剧唯一。只指定某集时 episodes 只含该集，no 保留原号。");
            if(segmentedText) {
                var input=request.segmented();
                var frozen=sceneCatalog.freezeSegmented(input.scene().sceneId());
                var specs=new ArrayList<Map<String,Object>>();
                for(var s:input.segments())specs.add(Map.of("no",s.no(),"seconds",s.seconds(),"shotsLo",s.shotsLo(),"shotsHi",s.shotsHi()));
                boolean review="review".equals(input.kind());
                var assembled=review?sceneCatalog.segmentedReview(input.scene(),specs,input.issues()==null?List.of():input.issues(),request.textEdit().content(),frozen)
                        :sceneCatalog.segmentedScript(input.scene(),specs,input.hasScript(),input.singleShot(),Boolean.TRUE.equals(request.readVisuals()),frozen);
                systemPrompt=assembled.system();creativePrompt=assembled.user();
                execution.put("systemPrompt",systemPrompt);
                ObjectNode promptRecord=execution.putObject("prompt");
                promptRecord.put("key",assembled.stage());
                promptRecord.set("versions",com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler.frozenNode(mapper,frozen));
                com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler.appendCall(promptRecord,assembled.call(mapper,1,null));
                sceneParams=assembled.params();
                var plan=execution.putObject("segmented").put("kind",input.kind()).put("refCount",input.refCount());
                plan.set("segments",mapper.valueToTree(input.segments()));
            } else if(!sceneScript) {
                // 原文和变量都按提示词库的环节拼；格式句、改稿契约、附带素材的说明由代码按这次请求给
                String stageKey=textStage(request.operation(),skillPlan,check);
                // AI 视频页的爆款复刻：拉片 v2 之后由代码拼方案，模型只写每段提示词（StudioRecreationTaskPlan）
                Map<String,Object> recreationCompile=skillPlan?recreationCompile(request,executionBinding,execution):null;
                if(recreationCompile!=null)stageKey=com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints.recreationCompile(execution.path("recreationTask").path("method").asText());
                Map<String,?> stageVars=recreationCompile!=null?recreationCompile:skillPlan?skillPlanVariables(userId,project,request,skill,executionBinding,canvasContext,execution)
                        :check?checkVariables(request,skill,checkTarget):variables;
                var assembled=com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler.or(promptAssembler).assembleAndRecord(mapper,execution,
                        com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler.Call.of(stageKey,stageVars,null,
                                Map.of("contracts",String.join("\n",textContracts(request)),"appendix",String.join("\n",appendix))),
                        "stage-recreation".equals(stageKey)?com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints.RECREATION_STAGES:List.of(stageKey));
                systemPrompt=assembled.system();creativePrompt=assembled.user();
                execution.put("systemPrompt",systemPrompt);
                sceneParams=assembled.params();
            }
            if(sceneScript) {
                // 编导：system / user 都按提示词库的环节拼，原来的通用助手模板和改稿句不用；受理时冻结版本（§3.4）。
                // 「视频裂变」的找变量也走这里，只是换成自己的环节；结果是给页面用的变量清单，不收进资产库（sceneVariables）。
                boolean findVariables=SCENE_VARIABLES.equals(request.scene().kind());
                var frozen=findVariables?sceneCatalog.freezeSceneVariables(request.scene().sceneId()):sceneCatalog.freezeSceneScript(request.scene().sceneId());
                var assembled=findVariables?sceneCatalog.sceneVariables(request.scene(),request.textEdit().content(),frozen)
                        :sceneCatalog.sceneScript(request.scene(),request.textEdit().content(),Boolean.TRUE.equals(request.readVisuals()),frozen);
                systemPrompt=assembled.system();creativePrompt=assembled.user();
                execution.put("systemPrompt",systemPrompt);
                if(findVariables)execution.put("sceneVariables",true);
                ObjectNode promptRecord=execution.putObject("prompt");
                promptRecord.put("key",findVariables?"stage-scene-variables":"stage-scene-script");
                promptRecord.set("versions",com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler.frozenNode(mapper,frozen));
                com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler.appendCall(promptRecord,assembled.call(mapper,1,null));
                sceneParams=assembled.params();
            }
            execution.put("userPrompt",creativePrompt);
            // 调用参数：环节的 params 优先（导入时从线上 params_json 带过来），和输出格式绑定的下限照旧（§4.7）
            var params=resolved.params();
            if(sceneParams!=null)params=new com.aistareco.aep.dto.PromptParamsDto(sceneParams.temperature()!=null?sceneParams.temperature():params.temperature(),
                    sceneParams.maxTokens()!=null?sceneParams.maxTokens():params.maxTokens(),sceneParams.jsonMode()!=null?sceneParams.jsonMode():params.jsonMode());
            execution.put("temperature",check?0.1:params.temperatureOrDefault());execution.put("maxTokens","asset-extract".equals(request.operation())?Math.max(16384,params.maxTokensOrDefault()):"recreation".equals(request.operation())||skillPlan?Math.max(8192,params.maxTokensOrDefault()):params.maxTokensOrDefault());
            // 一条 60 秒、三十多个镜头的片子，拆解约 5 千输出 Token；给足余量，实际按用量结算
            if(videoUnderstand!=null)execution.put("maxTokens",16000);
            inputs.put("promptKey",promptKey);
        }
        // 一条长视频的脚本要写很多镜头，模型的思考也算输出：预算跟后台给这个模型配的走，不用通用文字任务的默认值。
        if(segmentedText&&chatRate!=null) {
            execution.put("maxTokens",chatRate.maxOutputTokens());
            execution.put("temperature","review".equals(request.segmented().kind())?0.3:0.7);
        }
        if(chatRate!=null) {
            execution.set("tokenPricing",mapper.valueToTree(chatRate));
            execution.put("billingUnit","per_token");
            int budget=Math.min(execution.path("maxTokens").asInt(8192),chatRate.maxOutputTokens());
            if(textEndpoint.endpoint().getChatMaxOutputTokens()!=null)budget=Math.min(budget,textEndpoint.endpoint().getChatMaxOutputTokens());
            if("recreation".equals(request.operation())&&budget<4096)throw bad("STUDIO_RECREATION_TOKEN_BUDGET","当前模型不支持全片拆解，请联系平台处理");
            execution.put("maxTokens",budget);
        }
        var modelCharge=StudioTokenBilling.plan(textEndpoint==null?null:textEndpoint.endpoint(),chatRate);
        StudioTokenBilling.store(execution,modelCharge,textEndpoint==null?null:textEndpoint.endpoint());
        var billing = enterpriseBilling == null ? null : enterpriseBilling.reserve(userId,request.billing(),IpRunService.REF_TYPE,id,
                execution.path("endpointId").asText(null),cost,"Studio 创作", modelCharge);
        if(enterpriseBilling == null && cost>0) credits.hold(userId,cost,IpRunService.REF_TYPE,id,"Studio 创作", modelCharge);
        boolean queuedExport=exportQueue&&"assemble".equals(request.operation());
        IpRun run=IpRun.builder().id(id).projectId(projectId).ownerUserId(userId).nodeId(request.nodeId())
                .kind("studio-"+request.operation()).status(IpRun.STATUS_RUNNING).stage(queuedExport?StudioExportQueue.WAITING:"queued").cost(cost)
                .clientRequestId(request.clientRequestId()).inputFingerprint(fingerprint).inputJson(write(inputs))
                .outputJson("{}").createdAt(Instant.now()).heartbeatAt(Instant.now()).build();
        StudioRunBilling.apply(run,billing);
        runs.save(run);
        if (!queuedExport && (depthQueue == null || !"video-control".equals(request.operation()))) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() {
                    try {worker.execute(id);} catch(RuntimeException e){worker.reject(id,e);}
                }
            });
        }
        return projects.toRunDto(run);
    }

    /**
     * H3 出视频前先把提示词改写成官方写法（{@code video.rewrite}，2026-10-27）：这一行先是一条文字任务（冻结改写的上限、按实际用量结算），
     * worker 改写完在同一行上提交视频（写进 {@code _exec.nativeVideoJobIds}，之后按视频任务投影）。review 模式有提示时不出片，
     * 停在「用优化稿 / 用原文」上。视频的价格、付款方照常在提交视频时核对；这里先按同样的规则预检一遍，免得改写完才发现出不了片。
     */
    private IpRunDto submitVideoRewrite(String userId,String projectId,com.aistareco.aep.ipstudio.model.IpProject project,RunRequest request,String fingerprint,ExecutionBinding binding) {
        var video=request.video();
        if(!Set.of("auto","review").contains(video.rewrite()))throw bad("STUDIO_VIDEO_INPUT_INVALID","不支持的提示词优化方式");
        if(studioVideo==null)throw bad("STUDIO_VIDEO_MODE_UNAVAILABLE","视频模型暂不可用");
        int count=request.count()==null?1:request.count();
        var check=videoRequest(request);
        if(!studioVideo.rewritable(request.model()))throw bad("STUDIO_VIDEO_OPTION_UNSUPPORTED","所选视频模型不支持提示词优化");
        // 素材在这里就按模型规则核对（quoteChecked），不等优化做完、交给视频时才发现参考视频超长。
        var source=new IpRunService.IpVideoRequest(check.prompt(),null,check.durationSec(),check.aspectRatio(),check.model(),null,video.submitted());
        var autoQuote="auto".equals(video.rewrite())?studioVideo.quoteAutoRewrite(userId,source,true):null;
        long videoCost=Math.multiplyExact(autoQuote==null?studioVideo.quoteChecked(userId,source):autoQuote.credits(),(long)count);
        var endpoint=videoRewriteEndpoint().endpoint();
        var rate=videoRewriteRate(endpoint);
        // 画布：用户确认的是视频价格，改写另扣少量（界面写明）。制作计划：批准的上限按「视频 + 改写上限」报的，合计不能超（交接时视频只能用剩下的）。
        boolean planBudget=request.executionId()!=null;
        if(request.modelBilling()==null)IpRunService.requireApprovedCost(request.maxCost(),planBudget?Math.addExact(videoCost,rate.maxCost()):videoCost);
        int seconds=request.durationSec()==null?5:request.durationSec();
        var built=com.aistareco.aep.ipstudio.h3.H3StudioPrompt.build(request.prompt(),seconds,video,projects.readDoc(project),cloneControls(userId,binding,video));
        var h3=built.request();
        String id="IPR-"+UUID.randomUUID().toString().replace("-","").substring(0,20);
        long cost=rate.maxCost();
        ObjectNode inputs=mapper.valueToTree(request);
        attachCloneInputs(inputs,binding);
        inputs.put("mock",false);
        var execution=inputs.putObject("_exec").put("holdTotal",cost).put("unitCost",cost).put("billingUnit","per_token")
                .put("rewrite",video.rewrite()).put("videoCost",videoCost).put("planBudget",planBudget);
        if(autoQuote!=null)execution.put("videoPromptMaxChars",autoQuote.videoPromptMaxChars());
        var h3Meta=com.aistareco.aep.ipstudio.h3.H3PromptRewrite.meta(mapper,h3,built.pictures(),built.videos(),built.audios());
        if(!built.controlVideos().isEmpty())built.controlVideos().forEach(h3Meta.putArray("controlVideos")::add);
        execution.set("h3",h3Meta);
        execution.put("systemPrompt",com.aistareco.aep.ipstudio.h3.H3PromptRewrite.system(h3.mode(),h3.codeLines(),h3.shots()!=null));
        execution.put("userPrompt",com.aistareco.aep.ipstudio.h3.H3PromptRewrite.user(h3));
        execution.put("purpose",H3PromptRewrite.PURPOSE.wire()).put("endpointId",endpoint.getId()).put("temperature",0.6);
        int budget=rate.maxOutputTokens();
        execution.put("maxTokens",budget);
        execution.set("tokenPricing",mapper.valueToTree(rate));
        var modelCharge=StudioTokenBilling.plan(endpoint,rate);
        StudioTokenBilling.store(execution,modelCharge,endpoint);
        com.aistareco.aep.enterprise.service.EnterpriseBillingService.BillingAccount billing;
        try {
            billing=enterpriseBilling==null?null:enterpriseBilling.reserve(userId,request.billing(),IpRunService.REF_TYPE,id,endpoint.getId(),cost,"Studio 视频提示词优化",modelCharge);
            if(enterpriseBilling==null&&cost>0)credits.hold(userId,cost,IpRunService.REF_TYPE,id,"Studio 视频提示词优化",modelCharge);
        } catch(BusinessException e) {
            // 原话「普通积分不足，请充值或减少生成数量」看不出是哪一笔：视频可能由赠款付、差的是这一笔。
            if("MODEL_CREDITS_INSUFFICIENT".equals(e.getCode()))throw videoRewriteShortage(null);
            throw e;
        }
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

    /**
     * 深度复刻：这一步的参考视频里，哪段是本次执行里「提取动作」那一步的产物、是深度图还是骨骼图。
     * 只认同一执行里已完成的 video-control 运行、且产物 key 正好是这一步引用的那段，不按客户端说法。
     */
    private java.util.Map<String,String> cloneControls(String userId,ExecutionBinding binding,com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings video) {
        if(binding==null||binding.step()==null||video==null||video.references()==null)return java.util.Map.of();
        if(!"depth".equals(binding.state().path("videoTask").path("kind").asText()))return java.util.Map.of();
        Set<String> referenced=new HashSet<>();
        for(var r:video.references())if(r!=null&&"video".equals(r.mediaType()))referenced.add(r.key());
        if(referenced.isEmpty())return java.util.Map.of();
        java.util.Map<String,String> out=new java.util.HashMap<>();
        for(JsonNode step:binding.state().path("steps")) {
            if(!"video-control".equals(step.path("operation").asText()))continue;
            for(JsonNode runId:step.path("runIds"))runs.findByIdAndOwnerUserId(runId.asText(),userId).ifPresent(run->{
                if(!"studio-video-control".equals(run.getKind())||!IpRun.STATUS_DONE.equals(run.getStatus())
                        ||!binding.execution().getProjectId().equals(run.getProjectId())||run.getOutputJson()==null)return;
                JsonNode output=projects.parseOrEmptyObject(run.getOutputJson());
                String key=output.path("storageKey").asText(null);
                if(key!=null&&referenced.contains(key))out.put(key,"pose".equals(output.path("controlType").asText())?"pose":"depth");
            });
        }
        return out;
    }

    private void attachCloneInputs(ObjectNode inputs,ExecutionBinding binding) {
        if(binding==null||binding.step()==null||!binding.state().path("videoTask").path("cloneKeys").isObject())return;
        var ids=inputs.putArray("canvasInputNodeIds");
        for(JsonNode ref:binding.step().path("definition").path("settings").path("referenceBindings"))
            if(ref.hasNonNull("nodeId"))ids.add(ref.path("nodeId").asText());
    }

    private AiModelInvocationService.ResolvedEndpoint videoRewriteEndpoint() {
        // 优化是独立能力，不受 script 场景的默认值、固定模式或用户选择影响；仍检查 Studio 端点授权。
        return models.resolveEndpoint(H3PromptRewrite.PURPOSE,null,"studio")
                .orElseThrow(()->new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"ENDPOINT_NOT_ALLOWED",
                        "提示词优化暂不可用，可关闭「智能优化」按原文生成"));
    }

    private com.aistareco.aep.service.AiChatTokenPricing.Rate videoRewriteRate(com.aistareco.aep.model.AiModelEndpoint endpoint) {
        var rate=endpointChatRate(endpoint);
        if(rate==null)throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"AI_TOKEN_PRICE_NOT_CONFIGURED",
                "提示词优化暂不可用，可关闭「智能优化」按原文生成");
        return rate;
    }

    /**
     * 「智能优化」这一笔的报价：改写用的是独立的文字模型，只能用普通积分（H3 的模型赠款付不了它），按这次的付款账户算。
     * 只读，不冻结。2026-11-11 线上：视频 930 全由赠款付，优化要冻结 110 普通积分而账户只有 109，页面只核对了视频价就放行，
     * 任务一建就停在「需处理」。AI 视频页点生成前用它再核对一次（GET /studio/video-optimize-price）。
     */
    @org.springframework.transaction.annotation.Transactional(readOnly=true)
    public com.aistareco.aep.billing.service.ModelChargeService.Quote quoteVideoRewrite(String user,com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing) {
        if(fixtures.enabled()||enterpriseBilling==null)throw bad("MODEL_QUOTE_NOT_SUPPORTED","测试响应无需扣费报价");
        var endpoint=videoRewriteEndpoint().endpoint();
        return enterpriseBilling.quote(user,billing,StudioTokenBilling.plan(endpoint,videoRewriteRate(endpoint)));
    }
    /** 建视频任务前核对优化提示词要冻结的普通积分；付不起就不建任务、不扣积分，由页面提示改用「按原文生成」或充值。 */
    public void requireVideoRewriteAffordable(String user,com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing) {
        if(fixtures.enabled()||enterpriseBilling==null)return;
        var quote=quoteVideoRewrite(user,billing);
        if(!quote.canAfford()&&"MODEL_CREDITS_INSUFFICIENT".equals(quote.unavailableCode()))throw videoRewriteShortage(quote.walletCredits());
    }
    /** 优化提示词付不起时的报错：说清是哪一笔、只能用普通积分、怎么继续。need 为空时不写数（冻结额不一定等于要付的）。 */
    static BusinessException videoRewriteShortage(Long need) {
        return new BusinessException(HttpStatus.PAYMENT_REQUIRED,"MODEL_CREDITS_INSUFFICIENT",
                (need==null?"优化提示词":"优化提示词需要 "+need+" 积分，")+"只能用普通积分支付，当前普通积分不足。可改用「按原文生成」，或充值后重试");
    }

    /** 三处改写共用独立绑定模型的冻结上限，估价、付款授权和提交用同一份模型及输出预算。 */
    public long videoRewriteHold() {
        if(fixtures.enabled())return 0;
        return videoRewriteRate(videoRewriteEndpoint().endpoint()).maxCost();
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
    public IpRunDto submitDirectorText(String userId, String hostId, String nodeId, String systemPrompt, String userPrompt, String clientRequestId, ObjectNode meta, String model,
                                       com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billingSelection, Long maxCost) {
        return submitDirectorText(userId,hostId,nodeId,systemPrompt,userPrompt,clientRequestId,meta,model,billingSelection,maxCost,null);
    }

    /** 同上，另带要交给模型看的图（导演台助手「围绕这张图修改」）；只有后台声明能看图的模型才接受。 */
    @Transactional(propagation=org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public IpRunDto submitDirectorText(String userId, String hostId, String nodeId, String systemPrompt, String userPrompt, String clientRequestId, ObjectNode meta, String model,
                                       com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billingSelection, Long maxCost,
                                       com.fasterxml.jackson.databind.node.ArrayNode visual) {
        requireText(clientRequestId, 64, "请求编号");
        boolean videoRewrite="videoPrompt".equals(meta.path("task").asText());
        if(videoRewrite)model=null; // 优化只读独立用途绑定，忽略作品的文字模型选择。
        ObjectNode canonical=mapper.createObjectNode().put("nodeId",nodeId).put("system",systemPrompt).put("user",userPrompt);
        if(model!=null)canonical.put("model",model);
        String fingerprint=hash(write(canonical));
        IpRun prior=runs.findByProjectIdAndClientRequestId(hostId,clientRequestId).orElse(null);
        if(prior!=null) {
            StudioRunBilling.requireSamePayer(prior,billingSelection);
            if(!fingerprint.equals(prior.getInputFingerprint()))throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_REQUEST_CHANGED","请求已失效，请刷新页面后重试");
            return projects.toRunDto(prior);
        }
        AiModelInvocationService.ResolvedEndpoint textEndpoint=null;
        long cost=0;
        var chatRate=(com.aistareco.aep.service.AiChatTokenPricing.Rate)null;
        if(!fixtures.enabled()) {
            if(videoRewrite) textEndpoint=videoRewriteEndpoint();
            else if(scenePolicies == null) textEndpoint=models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,model,"studio").orElseThrow(()->
                    new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"ENDPOINT_NOT_ALLOWED","文本模型不可用，请联系平台处理"));
            else textEndpoint=scenePolicies.resolve("studio","script",model,pricing.ipIdentity()).resolved();
            chatRate=endpointChatRate(textEndpoint.endpoint());
            if(chatRate==null)throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"AI_TOKEN_PRICE_NOT_CONFIGURED","此模型暂未定价，请选择其他模型");
            cost=chatRate.maxCost();
            if(maxCost==null)throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_PRICE_CHANGED","模型价格已更新，请刷新后重试");
        }
        IpRunService.requireApprovedCost(maxCost,cost);
        String id="IPR-"+UUID.randomUUID().toString().replace("-","").substring(0,20);
        ObjectNode inputs=mapper.createObjectNode();
        inputs.put("operation","director").put("mock",fixtures.enabled());
        if(billingSelection!=null)inputs.set("billing",mapper.valueToTree(billingSelection));
        // 调用点拼提示词时记下的版本（meta.prompt，docs/studio-prompt-architecture.md §3.4）挪进 _exec.prompt，和画布任务同一个位置
        ObjectNode director=meta.deepCopy();
        com.fasterxml.jackson.databind.JsonNode promptRecord=director.remove("prompt");
        inputs.set("_director",director);
        var execution=inputs.putObject("_exec").put("holdTotal",cost).put("unitCost",cost).put("billingUnit","per_call");
        execution.put("systemPrompt",systemPrompt).put("userPrompt",userPrompt).put("temperature",0.6);
        if(promptRecord!=null&&promptRecord.isObject())execution.set("prompt",promptRecord);
        if(textEndpoint!=null)execution.put("endpointId",textEndpoint.endpoint().getId());
        if(videoRewrite)execution.put("purpose",H3PromptRewrite.PURPOSE.wire());
        // 导演台助手围绕一张图讨论时把这张图交给模型；只有后台声明能看图的模型才会走到这里（DirectorService.visionModel）。
        if(visual!=null&&!visual.isEmpty()) {
            if(textEndpoint!=null&&!StudioVisualContext.supportsVision(textEndpoint.endpoint()))
                throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"STUDIO_VISION_UNAVAILABLE","当前文本模型不能读取图片");
            execution.set("visualContext",visual);
        }
        int budget=0;
        if(chatRate!=null) {
            execution.set("tokenPricing",mapper.valueToTree(chatRate));
            execution.put("billingUnit","per_token");
            budget=chatRate.maxOutputTokens();
        }
        execution.put("maxTokens",budget);
        var modelCharge=StudioTokenBilling.plan(textEndpoint==null?null:textEndpoint.endpoint(),chatRate);
        StudioTokenBilling.store(execution,modelCharge,textEndpoint==null?null:textEndpoint.endpoint());
        var billing = enterpriseBilling == null ? null : enterpriseBilling.reserve(userId,billingSelection,IpRunService.REF_TYPE,id,
                execution.path("endpointId").asText(null),cost,"短剧导演台", modelCharge);
        if(enterpriseBilling == null && cost>0) credits.hold(userId,cost,IpRunService.REF_TYPE,id,"短剧导演台", modelCharge);
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

    /** 导演台估价与受理共用所选端点的后台输出配置，不按任务类型截断预算。 */
    public long directorTextPrice(String model) {
        var caps=capabilities();
        return directorTextModel(caps,model)
                .map(m->m.tokenPricing()==null?caps.textCost():m.tokenPricing().maxCost())
                .orElse(caps.textCost());
    }

    /** 导演台所选文本模型一次调用最多读多少输入 Token（后台按量计价里配的上限）；没配按量价（测试响应）返回 0，由调用方用默认值。 */
    public int directorMaxInputTokens(String model) {
        var caps=capabilities();
        return directorTextModel(caps,model).map(m->m.tokenPricing()==null?0:m.tokenPricing().maxInputTokens()).orElse(0);
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
        if("recreation".equals(request.operation()) && (request.scriptEdit()!=null||request.textEdit()!=null||Boolean.TRUE.equals(request.readVisuals())||request.settings()!=null||request.episodeNo()!=null||request.history()!=null||request.references()!=null&&!request.references().isEmpty()||request.mode()!=null&&!Set.of("segments","cuts").contains(request.mode())||request.packaging()!=null))
            throw bad("STUDIO_INPUT_INVALID","复刻创作只接受所选参考视频和分析要求");
        if(Set.of("segments","cuts").contains(Objects.toString(request.mode(),""))&&!"recreation".equals(request.operation()))throw bad("STUDIO_INPUT_INVALID","分段模式只能用于视频拉片");
        if("asset-extract".equals(request.operation())) {
            if(request.scriptEdit()==null||request.scriptEdit().markdown()==null||request.scriptEdit().markdown().isBlank()||request.scriptEdit().markdown().length()>48000)
                throw bad("STUDIO_INPUT_INVALID","请提供已保存的剧本文字，最多 48000 字");
        } else StudioScriptRevision.validateInput(request);
        // A skill planning text run carries a brief, not a node body to revise.
        if(!("text".equals(request.operation())&&request.skillKey()!=null))StudioTextRevision.validateInput(request);
        if(request.maxCost()!=null && request.maxCost()<0) throw bad("STUDIO_INPUT_INVALID","费用上限不能为负");
        // 看引用的图写字：创作助手，以及普通文字创作（如 AI 视频页的编导看商品图写脚本）。模型能不能看图在下面按端点能力判。
        if(Boolean.TRUE.equals(request.readVisuals())&&!Set.of("assistant","text").contains(request.operation()))throw bad("STUDIO_INPUT_INVALID","读取画面只能用于创作助手和文字创作");
        if(request.episodeNo()!=null && (request.episodeNo()<1 || request.episodeNo()>50)) throw bad("STUDIO_EPISODE_INVALID","请选择有效分集");
        if(request.mode()!=null && !Set.of("general","original","adapt","director","segments","cuts").contains(request.mode())) throw bad("STUDIO_MODE_INVALID","请选择创作模式");
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
        if(request.recreation()!=null&&!("recreation".equals(operation)&&Set.of("segments","cuts").contains(Objects.toString(request.mode(),""))))throw bad("STUDIO_INPUT_INVALID","段长上限只能用于视频拉片");
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
    private ObjectNode segmentCap(RecreationSettings settings,JsonNode source,com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules skill,String clipMethod) {
        if(settings.videoModel()==null||settings.videoModel().isBlank())throw bad("STUDIO_INPUT_INVALID","请选择用来生成分段视频的模型");
        var model=(studioVideo==null?List.<com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel>of():studioVideo.models()).stream()
                .filter(m->settings.videoModel().equals(m.endpointId())).findFirst()
                .orElseThrow(()->bad("STUDIO_VIDEO_MODEL_UNAVAILABLE","所选视频模型不可用，请更换模型"));
        var contract=model.contract();
        if(contract==null||contract.maxSeconds()<=0)throw bad("STUDIO_VIDEO_MODEL_UNAVAILABLE","所选视频模型暂不可用，请更换模型");
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
        double referenceMin=contract.modes().stream().filter(m->m.references()!=null&&m.references().video()!=null&&m.references().video().maxCount()>0)
                .mapToDouble(m->m.references().video().minDurationSec()==null?0:m.references().video().minDurationSec()).min().orElse(0);
        var limit=new StudioFilmStudy.SegmentCap(cap,maxSegments,referenceMin);
        if(duration>cap*maxSegments+1e-6)throw StudioFilmStudy.tooLong(limit,duration,List.of());
        ObjectNode out=mapper.createObjectNode().put("maxSegmentSec",cap).put("requested",requested).put("maxSegments",maxSegments)
                .put("videoModel",model.endpointId()).put("minSegmentSec",referenceMin);
        out.putObject("contract").put("minSeconds",contract.minSeconds()).put("maxSeconds",contract.maxSeconds());
        if(clipMethod!=null)out.put("clipMinSec",com.aistareco.aep.ipstudio.execution.StudioCloneVideoPlan.clip(model,clipMethod).minSec());
        return out;
    }

    /**
     * Server-built check input: the target must be the caller's successful run in this project and the key one of its real
     * outputs; frames are sampled from that media at fixed, recorded times. The client never supplies visual context.
     */
    /** 按文件头判断是不是图片（png / jpg / gif / bmp / webp）；读不出来按不是图片处理。 */
    private boolean isImage(String key) {
        if(recreationStorage==null)return false;
        try(var in=java.nio.file.Files.newInputStream(recreationStorage.openForRead(key))) {
            return com.aistareco.aep.service.storage.ImageBytes.sniff(in.readNBytes(16))!=null;
        } catch(Exception e) {
            return false;
        }
    }

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
        if(check.sampling()!=null&&!"shots".equals(check.sampling()))throw bad("STUDIO_INPUT_INVALID","检查的抽帧方式不支持");
        ObjectNode out=mapper.createObjectNode().put("targetRunId",run.getId()).put("targetStorageKey",key).put("mediaType",video?"video":"image");
        var checkIds=out.putArray("checkIds");ids.forEach(checkIds::add);
        // 一起交给检查模型的参考图：只认本人的图片文件，编号照调用方给的（和被检查那一步提示词里的「图N」一致）。
        // 是不是图片按文件内容判（§8.0.1 ⑤），不按后缀；不是图片或读不出来的那张不带，其余照常检查（编号各自带着，不会错位）。
        if(check.references()!=null&&!check.references().isEmpty()) {
            if(check.references().size()>com.aistareco.aep.ipstudio.execution.StudioPlanSteps.CHECK_REFERENCES)throw bad("STUDIO_VISUAL_LIMIT","检查最多带 "+com.aistareco.aep.ipstudio.execution.StudioPlanSteps.CHECK_REFERENCES+" 张参考图");
            var shown=out.putArray("references");
            for(var ref:check.references()) {
                if(ref==null||ref.storageKey()==null||ref.storageKey().isBlank()||ref.label()==null||!ref.label().matches("图[1-9][0-9]?"))throw bad("STUDIO_INPUT_INVALID","检查的参考图不完整");
                String owned=projects.requireOwnedAssetKey(userId,ref.storageKey());
                if(!isImage(owned)) {
                    log.warn("[studio-check] reference skipped, not a readable image run={} label={} key={}",run.getId(),ref.label(),owned);
                    continue;
                }
                shown.addObject().put("label",ref.label()).put("storageKey",owned);
            }
            if(shown.isEmpty())out.remove("references");
        }
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
                if(check.sampling()==null)times=com.aistareco.aep.ipstudio.execution.StudioCheckOutcome.sampleTimes(duration,4);
                else {
                    // 按镜头抽帧。切镜没测成时按一镜到底处理（大约每 2 秒一帧）：两种都是真实画面，只是疏密不同。
                    List<Double> cuts=List.of();
                    try {cuts=StudioVideoBreakdown.detectCuts(file,duration);}
                    catch(Exception e){log.warn("[studio-check] cut detection failed run={} key={} reason={}",run.getId(),key,e.toString());}
                    times=com.aistareco.aep.ipstudio.execution.StudioCheckOutcome.shotTimes(duration,cuts);
                    out.put("sampling","shots").put("shots",cuts.size()+1);
                }
            }
        } catch(BusinessException e){throw e;}
        catch(Exception e){throw bad("STUDIO_CHECK_TARGET_INVALID","要检查的成片无法读取，请确认它仍然存在");}
        var sampled=out.putArray("sampledTimesSec");times.forEach(sampled::add);
        return out;
    }

    /** 文字任务用哪个环节（docs/studio-prompt-architecture.md §8 #4–#9）。 */
    static String textStage(String operation,boolean skillPlan,boolean check) {
        if(check)return "stage-skill-check";
        if(skillPlan)return "stage-skill-plan";
        return switch(operation) {
            case "recreation" -> "stage-recreation";
            case "asset-extract" -> "stage-asset-extract";
            case "text","assistant" -> "stage-canvas-text";
            default -> "stage-canvas-script";
        };
    }

    /** 按请求接在 system 后面的输出契约（代码控制），顺序和搬家前一样。 */
    static List<String> textContracts(RunRequest request) {
        List<String> out=new ArrayList<>();
        if("asset-extract".equals(request.operation()))out.add(StudioAssetExtraction.CONTRACT);
        else if(request.scriptEdit()!=null)out.add(StudioScriptRevision.CONTRACT);
        else if("assistant".equals(request.operation()))out.add(StudioPlanValidator.CONTRACT);
        if(request.textEdit()!=null)out.add(StudioTextRevision.CONTRACT);
        if(!"assistant".equals(request.operation()) && (request.settings()!=null || request.episodeNo()!=null))out.add(EPISODE_CONTRACT);
        return out;
    }

    static final String EPISODE_CONTRACT="输出契约升级：shots 的每个对象除了原字段，还必须有 episodeNo:正整数，指向 episodes 中的 no。该字段是必填字段。严格按指定集数或单集号返回；每集至少一个镜头，镜头 id 全剧唯一。";

    private Map<String,String> checkVariables(RunRequest request,com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules skill,ObjectNode target) {
        var variables=new LinkedHashMap<String,String>();
        StringBuilder checklist=new StringBuilder();
        for(JsonNode id:target.path("checkIds"))checklist.append("- ").append(id.asText()).append('\n');
        String guide=skill.checkGuide();
        if(!guide.isBlank())checklist.append("\n判法说明（来自制作方法）：\n").append(guide);
        variables.put("checklist",checklist.toString());
        String description=request.prompt()==null||request.prompt().isBlank()?"未提供额外说明，只按检查清单判断。":request.prompt();
        variables.put("target",description+"\n成片实测信息（服务端测得，可作为 media 依据）："+target.path("mediaFacts"));
        String frames="video".equals(target.path("mediaType").asText())
                ?"随后附上 "+target.path("sampledTimesSec").size()+" 张真实采样画面，时间依次为 "+target.path("sampledTimesSec")+" 秒。frame 依据的 timeSec 只能从这些时间中选。"
                :"随后附上 1 张要检查的图片。frame 依据不填 timeSec。";
        if("shots".equals(target.path("sampling").asText()))frames+="这些画面是按成片里真实的切镜抽的（共 "+target.path("shots").asInt()+" 个镜头，每个镜头取开头和结尾），可以逐个镜头对照。";
        if(target.path("references").size()>0) {
            List<String> labels=new ArrayList<>();target.path("references").forEach(r->labels.add(r.path("label").asText()));
            frames+="最后附上 "+labels.size()+" 张参考图（"+String.join("、",labels)+"），编号和目标说明里的「图N」一致：它们是交给生成模型的素材，用来对照成片里的人和物换对了没有，不是要检查的对象，也不能作为 frame 依据。";
        }
        variables.put("frames",frames);
        return variables;
    }

    /**
     * AI 视频页爆款复刻的「写分镜脚本」：这次制作是视频页的复刻任务、拉片走的是 v2（有逐镜拆解）时，冻结分段 / 素材 / 模型
     * 这些事实（{@code _exec.recreationTask}）并返回提示词变量；否则返回 null，照旧让模型写整份方案。
     */
    private Map<String,Object> recreationCompile(RunRequest request,ExecutionBinding binding,ObjectNode execution) {
        if(binding==null||planOutputs==null||studioVideo==null)return null;
        JsonNode task=binding.state().path("videoTask");
        String method=task.path("kind").asText();
        if(!com.aistareco.aep.ipstudio.execution.StudioCloneVideoPlan.method(method))return null;
        var film=planOutputs.filmStudy(binding.execution(),binding.state().path("steps")).orElse(null);
        if(film==null)return null;
        JsonNode config=task.path("request").path("configuration");
        String model=config.path("model").asText(null);
        var chosen=studioVideo.models().stream().filter(m->model==null?m.isDefault():model.equals(m.endpointId())).findFirst()
                .orElseThrow(()->bad("STUDIO_VIDEO_MODE_UNAVAILABLE","所选视频模型已下架，请重新选择后再开始"));
        List<com.aistareco.aep.ipstudio.execution.StudioRecreationTaskPlan.Material> materials=new ArrayList<>();
        for(JsonNode m:config.path("materials"))if(!"video".equals(m.path("slot").asText())&&!m.path("nodeId").asText().equals(task.path("request").path("sourceNodeId").asText()))
            materials.add(new com.aistareco.aep.ipstudio.execution.StudioRecreationTaskPlan.Material(m.path("nodeId").asText(),m.path("title").asText(),m.path("slot").asText()));
        // 开场画面最多几张：技能的步数上限减去每段的视频、检查和最后的合成
        int maxSteps=binding.state().path("skill").isObject()?com.aistareco.aep.ipstudio.execution.StudioSkillRules.fromSnapshot(binding.state().path("skill")).maxSteps():12;
        int segments=film.film().path("segments").size();
        String studyNode=com.aistareco.aep.ipstudio.execution.StudioPlanExecutionIds.nodeId(binding.execution().getId(),film.stage(),film.stepId());
        Boolean optimize=config.path("optimize").isBoolean()?config.path("optimize").asBoolean():null;
        if("depth".equals(method))optimize=true;
        var prepared=com.aistareco.aep.ipstudio.execution.StudioRecreationTaskPlan.prepare(film.film(),materials,chosen.endpointId(),chosen.contract(),
                config.path("tier").asText(null),config.path("ratio").asText("9:16"),optimize,
                studyNode+"-f",Math.max(0,maxSteps-segments*2-1),config.path("text").asText(""),method,studyNode+"-s");
        prepared.put("maxSteps",maxSteps);
        // 页面上的「自动检查」开关（不写算开）：关掉时方案里不放检查步骤，也就不会自动重出
        if(config.path("autoCheck").isBoolean()&&!config.path("autoCheck").asBoolean())prepared.put("autoCheck",false);
        execution.set("recreationTask",prepared);
        // 方案只能引用这次的素材
        Set<String> allowed=new LinkedHashSet<>(request.contextNodeIds()==null?List.of():request.contextNodeIds());
        for(JsonNode m:prepared.path("materials"))allowed.add(m.path("nodeId").asText());
        for(JsonNode u:prepared.path("units")) {
            for(JsonNode r:u.path("refs"))if(r.hasNonNull("nodeId"))allowed.add(r.path("nodeId").asText());
            for(JsonNode k:u.path("keyframes"))allowed.add(k.path("frameNodeId").asText());
            if(u.hasNonNull("clipNodeId"))allowed.add(u.path("clipNodeId").asText());
        }
        var ids=execution.putArray("allowedNodeIds");allowed.forEach(ids::add);
        return com.aistareco.aep.ipstudio.execution.StudioRecreationTaskPlan.variables(prepared,film.film().path("breakdown"),config.path("text").asText(""));
    }

    /** Next plan revision of this project; submit holds the project row lock, so revisions are monotonic per canvas. */
    private int nextPlanRevision(String projectId) {
        Long count=em.createQuery("select count(r) from IpRun r where r.projectId=:p and r.kind='studio-text' and r.inputJson like :marker",Long.class)
                .setParameter("p",projectId).setParameter("marker","%\"skillPlan\":true%").getSingleResult();
        return (int)Math.min(Integer.MAX_VALUE,(count==null?0:count)+1);
    }

    private Map<String,Object> skillPlanVariables(String userId,com.aistareco.aep.ipstudio.model.IpProject project,RunRequest request,
            com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules skill,ExecutionBinding binding,JsonNode canvasContext,ObjectNode execution) {
        var variables=new LinkedHashMap<String,Object>();
        String body=skill.body();
        variables.put("skill",body.length()>16000?body.substring(0,16000):body);
        variables.put("analysisStage","analysis".equals(request.stage()));
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
        // 预算那句的说法在提示词库 stage-skill-plan；这里只给本阶段批准的额度（没有就不给）
        if(binding!=null&&binding.step()!=null) {
            JsonNode stageBudget=projects.parseOrEmptyObject(binding.execution().getBudgetJson()).path(binding.step().path("stage").asText());
            if(stageBudget.isObject())variables.put("approvedCap",stageBudget.path("approvedCap").asLong());
        }
        variables.put("feedback",request.history()==null||request.history().isEmpty()?"无。":write(request.history()));
        return variables;
    }

    /** Stage whitelist, limits, checks and the typed settings contract given to the planner (also used by the admin dry-run). */
    public static ObjectNode skillPlanConstraints(ObjectMapper mapper,com.aistareco.aep.ipstudio.execution.StudioSkillRules.Rules skill,String stage) {
        ObjectNode constraints=mapper.createObjectNode();
        var operations=constraints.putArray("operations");com.aistareco.aep.ipstudio.execution.StudioSkillRules.plannerOperations(skill.stageOperations(stage)).forEach(operations::add);
        constraints.put("maxSteps",skill.maxSteps()).put("maxSegments",skill.maxSegments()).put("maxSourceSec",skill.maxSourceSec()).put("maxSegmentSec",skill.maxSegmentSec());
        var checks=constraints.putArray("checks");skill.checks().forEach(checks::add);
        constraints.put("settings","每步 settings 按操作填写：recreation{sourceNodeId,mode:\"segments\",maxSegmentSec:\"model\"|秒数,videoModel}；image{count:1|2|4,aspectRatio?:\"9:16\"|\"16:9\"|\"1:1\"|\"3:4\"（画幅，按技能默认填）,size?:\"宽x高\"（只在用户给了像素尺寸时填）,referenceBindings[],model?}；video{model,video:{mode,resolutionTier,seed?},durationSec,aspectRatio,count:1|2|4,referenceBindings[]}；check{targetStepId,checkIds[],candidateIndex?}；assemble{clipOrder:[{stepId,candidateIndex?}],audioStrategy:\"generated\"|\"source-audio\"}；text{purpose:\"script\"|\"prompt-revision\"|\"plan-compile\"|\"note\",editTarget?}。referenceBindings 每项 {stepId 或 nodeId 二选一,role,order}。plan-compile 只在分析阶段用于编排制作计划。");
        var allowed=new java.util.HashSet<>(com.aistareco.aep.ipstudio.execution.StudioSkillRules.plannerOperations(skill.stageOperations(stage)));
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
        constraints.put("models","recreation.videoModel 与视频步骤 settings.model 必须原样复制「可用模型与合同」里 videoModels[].endpointId 的值，不能写模型名、别名或自己缩写。settings.model 与 settings.video 同级；settings.video 只放模式、清晰度、随机种子。视频模式、resolutionTier、画幅和时长必须来自所选模型同一份合同，不能混用其他模型的规格；未指定模型时按 isDefault 的合同填写。");
        constraints.put("targets","targetNodeId 只填素材清单里为这一步准备、还没有画面或正文的对象 id，类型与这一步的结果一致（image 填图片对象、video 填视频对象、写稿的 text 填文字对象）；check、assemble、recreation、plan-compile 和改稿的步骤不填。");
        constraints.put("references","referenceNodeIds 只能填素材清单里的画布对象 id，不能填步骤编号；要用更早步骤的产物，写进 dependsOn，图片和视频步骤再用 settings.referenceBindings 的 stepId 指定。素材清单里的对象（包括分析阶段产出的分段片段）在 referenceBindings 里一律写 nodeId，stepId 只填本计划里更早的步骤编号。");
        constraints.put("videoReferences","每个视频步骤的参考素材必须服从所选模型、所选模式的 references 合同：各类型 maxCount、maxTotal、maxImagesWithVideo、minVisual 及素材时长限制。拉片得到的每个片段都算一段参考视频，不能把多段当作一段；不能为满足数量上限删掉用户要保留的内容。若多段超过上限，按原片顺序拆成各自合规的视频步骤，再用允许的 assemble 操作合成；不能满足目标时明确说明限制，不输出不可执行的步骤。");
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
                        if(mode.references()!=null)m.set("references",mapper.valueToTree(mode.references()));
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
    /**
     * 拉片（recreation / segments）用的视频理解端点：后台给 DAP_VIDEO_UNDERSTAND 绑了模型、models_json 声明了 supportsVideo、
     * 也定了 Token 价，才用它；否则返回 null，拉片照旧抽帧。报价和受理共用这一处，两边选的一定是同一个端点。
     */
    private AiModelInvocationService.ResolvedEndpoint videoUnderstandEndpoint(RunRequest request) {
        if(fixtures.enabled()||request==null||!"recreation".equals(request.operation())||!"segments".equals(request.mode()))return null;
        return models.resolveEndpoint(AiModelPurpose.DAP_VIDEO_UNDERSTAND,null,"studio")
                .filter(e->StudioVisualContext.supportsVideo(e.endpoint())&&chatRate(e.endpoint().getId())!=null).orElse(null);
    }

    public long quote(String userId,RunRequest request) {
        if(request==null||!OPERATIONS.contains(request.operation()))throw bad("STUDIO_OPERATION_INVALID","请选择创作方式");
        if(fixtures.enabled())return 0;
        return switch(request.operation()) {
            case "assemble" -> 0L;
            case "video-control" -> {depthVideo.requireConfigured();yield 0L;}
            case "recreation" -> {
                if("cuts".equals(request.mode()))yield 0L;
                yield textQuote(request);
            }
            case "image" -> {
                var compiled=imageRuns.compileExplicit(userId,new IpRunService.IpGenerateRequest(request.nodeId(),request.prompt()==null||request.prompt().isBlank()?"图片":request.prompt(),
                        List.of(),request.count()==null?1:request.count(),request.size()==null?imageSize(request):request.size(),request.model()));
                yield Math.multiplyExact(compiled.unitCost(),(long)compiled.count());
            }
            case "video" -> {
                if(request.video()==null||studioVideo==null)throw bad("STUDIO_VIDEO_INPUT_INVALID","制作计划里的视频步骤需要明确视频模式");
                // nodeId=quote：StudioPlanQuoter 按计划报价，素材还是占位 key，只看张数。步骤真正受理时的报价（有真实 key）照旧查文件。
                long unit;
                if(StudioPlanSteps.QUOTE_NODE.equals(request.nodeId())) {
                    unit=studioVideo.planPrice(request.model(),request.video(),request.aspectRatio(),request.durationSec());
                } else {
                    var source=new IpRunService.IpVideoRequest(request.prompt(),null,request.durationSec(),request.aspectRatio(),request.model(),null,request.video().submitted());
                    unit="auto".equals(request.video().rewrite())
                            ?studioVideo.quoteAutoRewrite(userId,source,false).credits():studioVideo.quote(userId,source);
                }
                // 先改写提示词的步骤把改写的冻结上限也算进去：制作计划的预算按它核对。
                yield Math.addExact(Math.multiplyExact(unit,(long)(request.count()==null?1:request.count())),request.video().rewrite()==null?0:videoRewriteHold());
            }
            default -> textQuote(request);
        };
    }

    private long textQuote(RunRequest request) {
        AiModelInvocationService.ResolvedEndpoint endpoint=videoUnderstandEndpoint(request);
        if(endpoint==null)endpoint=scenePolicies!=null?scenePolicies.resolve("studio","script",request.model(),pricing.ipIdentity()).resolved()
                :models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,request.model(),"studio").orElseThrow(()->new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"ENDPOINT_NOT_ALLOWED","所选文本模型不可用"));
        var rate=chatRate(endpoint.endpoint().getId());
        if(rate==null)throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"AI_TOKEN_PRICE_NOT_CONFIGURED","此模型暂未定价，请选择其他模型");
        return rate.maxCost();
    }

    /** 一般用量（千 Token）。提示词改写实测约 3 积分；写稿带思考过程，输出多得多（线上编导 9 积分，见 AGENTS 默认文字模型一节）。 */
    private static final long REWRITE_IN=8000,REWRITE_OUT=2000,TEXT_IN=8000,TEXT_OUT=4000,SCRIPT_IN=10000,SCRIPT_OUT=12000;
    /**
     * 这一步大概会花多少，见 {@link com.aistareco.aep.ipstudio.execution.StudioPlanQuoter#estimate}。按个人账户的折扣算（付款账户要到确认时才选）。
     * 算不出来就按 {@code quoted}：这只是显示，不能挡住方案。
     */
    public long expectedCost(String userId,RunRequest request,long quoted) {
        if(quoted<=0||fixtures.enabled())return quoted;
        try {
            long expected=switch(request.operation()) {
                case "image" -> imageRuns.quoteImagePrice(userId,new IpRunService.IpGenerateRequest(request.nodeId(),request.prompt()==null||request.prompt().isBlank()?"图片":request.prompt(),
                        List.of(),request.count()==null?1:request.count(),request.size()==null?imageSize(request):request.size(),request.model())).payableCredits();
                case "video" -> {
                    if(request.video()==null||studioVideo==null)yield quoted;
                    int images=0,clips=0,audios=0;
                    if(request.video().references()!=null)for(var ref:request.video().references())
                        switch(ref.mediaType()==null?"image":ref.mediaType()){case "video" -> clips++;case "audio" -> audios++;default -> images++;}
                    long unit=imageRuns.quoteVideoPrice(userId,request.model(),request.video().mode(),request.video().resolutionTier(),request.aspectRatio(),request.durationSec(),images,clips,audios,
                            new com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection("personal",null)).payableCredits();
                    long rewrite=request.video().rewrite()==null?0:videoRewriteRate(videoRewriteEndpoint().endpoint()).cost(REWRITE_IN,REWRITE_OUT);
                    yield Math.addExact(Math.multiplyExact(unit,(long)(request.count()==null?1:request.count())),rewrite);
                }
                case "text","assistant","asset-extract" -> textRate(request).cost(TEXT_IN,TEXT_OUT);
                case "script","storyboard" -> textRate(request).cost(SCRIPT_IN,SCRIPT_OUT);
                default -> quoted;
            };
            return Math.max(0,Math.min(expected,quoted));
        } catch(RuntimeException e) {
            log.info("[studio-plan] no estimate op={} code={} reason={}",request.operation(),e instanceof BusinessException b?b.getCode():e.getClass().getSimpleName(),e.getMessage());
            return quoted;
        }
    }
    private com.aistareco.aep.service.AiChatTokenPricing.Rate textRate(RunRequest request) {
        AiModelInvocationService.ResolvedEndpoint endpoint=scenePolicies!=null?scenePolicies.resolve("studio","script",request.model(),pricing.ipIdentity()).resolved()
                :models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,request.model(),"studio").orElseThrow(()->new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"ENDPOINT_NOT_ALLOWED","所选文本模型不可用"));
        var rate=chatRate(endpoint.endpoint().getId());
        if(rate==null)throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"AI_TOKEN_PRICE_NOT_CONFIGURED","此模型暂未定价，请选择其他模型");
        return rate;
    }

    private IpRunService.IpVideoRequest videoRequest(RunRequest request) {
        return new IpRunService.IpVideoRequest(request.prompt(),request.references()==null||request.references().isEmpty()?null:request.references().get(0).storageKey(),
                request.durationSec(),request.aspectRatio(),request.model(),request.maxCost(),request.video()==null?null:request.video().submitted(),request.billing(),request.clientRequestId(),request.modelBilling());
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

    public com.aistareco.aep.billing.service.ModelChargeService.Quote quoteVideoPrice(String user,String model,String mode,String tier,String aspectRatio,
            Integer durationSec,int imageRefs,int videoRefs,int audioRefs,com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing) {
        if(fixtures.enabled())throw bad("MODEL_QUOTE_NOT_SUPPORTED","测试响应无需扣费报价");
        return imageRuns.quoteVideoPrice(user,model,mode,tier,aspectRatio,durationSec,imageRefs,videoRefs,audioRefs,billing);
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
                if(spec==null)throw bad("STUDIO_IMAGE_SPEC_NOT_CONFIGURED","当前图片模型暂不可用，请选择其他模型");
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
