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
    private static final Set<String> OPERATIONS = Set.of("script", "storyboard", "image", "video", "assemble", "assistant");
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
    public List<IpAsset> ipAssets(String userId) {return ipAssets.list(userId);}

    public Capabilities capabilities() {
        return new Capabilities(fixtures.enabled(), List.of("script","storyboard","image","video","assemble","assistant"),
                fixtures.enabled()?0:scenePolicies == null ? pricing.ipImage() : scenePolicies.available("studio","image",pricing.ipImage()).stream().filter(s->s.resolved().isDefault()).findFirst().map(com.aistareco.aep.service.AiAppSceneModelPolicyService.Selection::creditCost).orElse(pricing.ipImage()), fixtures.enabled()?0:textModelOptions().stream().filter(TextModel::isDefault).findFirst().map(TextModel::creditCost).orElse(pricing.ipIdentity()),
                fixtures.enabled()?0L:null, textModelOptions(), scenePolicies == null ? "selectable" : scenePolicies.mode("studio","script"), scenePolicies == null ? "selectable" : scenePolicies.mode("studio","image"));
    }
    private List<TextModel> textModelOptions() {
        if(scenePolicies == null) return models.listCandidates(AiModelPurpose.DAP_PERSONA).stream()
                .filter(r->r.endpoint().isEnabled()&&r.candidate().isEnabled()).map(r->new TextModel(r.endpoint().getId(),r.endpoint().getName(),r.isDefault(),StudioVisualContext.supportsVision(r.endpoint()),pricing.ipIdentity())).toList();
        return scenePolicies.available("studio","script",pricing.ipIdentity()).stream().map(s->new TextModel(s.resolved().endpoint().getId(),s.resolved().endpoint().getName(),s.resolved().isDefault(),StudioVisualContext.supportsVision(s.resolved().endpoint()),s.creditCost())).toList();
    }

    @Transactional
    public IpRunDto submit(String userId, String projectId, RunRequest request) {
        var project=projects.requiredForUpdate(userId, projectId);
        if (request == null || !OPERATIONS.contains(request.operation())) throw bad("STUDIO_OPERATION_INVALID", "请选择创作方式");
        requireText(request.clientRequestId(), 64, "请求编号");
        requireText(request.nodeId(), 64, "创作对象");
        if (!"assemble".equals(request.operation())) requireText(request.prompt(), 16000, "创作内容");
        if (request.references()!=null && request.references().size()>32) throw bad("STUDIO_REFERENCES_LIMIT", "一次最多使用 32 份参考素材");
        if(request.count()!=null && !Set.of(1,2,4).contains(request.count())) throw bad("video".equals(request.operation())?"STUDIO_VIDEO_COUNT_INVALID":"STUDIO_IMAGE_COUNT_INVALID","video".equals(request.operation())?"一次可生成 1、2 或 4 条视频":"一次可生成 1、2 或 4 张图片");
        List<Reference> references = request.references()==null?List.of():request.references();
        for (Reference reference:references) requireReference(userId, reference);
        if ("assemble".equals(request.operation()) && (references.isEmpty() || references.stream().anyMatch(r->!"clip".equals(r.role()))))
            throw bad("STUDIO_CLIPS_REQUIRED", "请先选择要合成的视频片段");
        if (request.video()!=null && !"video".equals(request.operation())) throw bad("STUDIO_VIDEO_INPUT_INVALID","视频参数只能用于生成视频");
        if (request.video()!=null && fixtures.enabled()) throw bad("STUDIO_VIDEO_MODE_UNAVAILABLE","测试响应不支持原生视频模式，请关闭测试响应后使用");
        if (request.aspectRatio()!=null && request.video()==null && !("image".equals(request.operation())?List.of("9:16","3:4","16:9","1:1"):List.of("9:16","16:9","1:1")).contains(request.aspectRatio()))
            throw bad("STUDIO_RATIO_INVALID", "请选择可用画幅");
        validateCreativeRequest(request);
        StudioPackagingService.validate(request.packaging());
        if(request.packaging()!=null && request.packaging().voiceoverStorageKey()!=null) {
            if(!"assemble".equals(request.operation()))throw bad("STUDIO_SPEECH_ASSEMBLE_ONLY","配音只能用于成片合成");
            projects.requireOwnedAssetKey(userId,request.packaging().voiceoverStorageKey());
        }
        String fingerprint=hash(write(canonicalRequest(mapper.valueToTree(request),mapper.valueToTree(request))));
        IpRun prior=runs.findByProjectIdAndClientRequestId(projectId,request.clientRequestId()).orElse(null);
        if(prior!=null) {
            if(!fingerprint.equals(prior.getInputFingerprint()) && !fingerprint.equals(hash(write(canonicalRequest(
                    projects.parseOrEmptyObject(prior.getInputJson()).has("studioRequest")?projects.parseOrEmptyObject(prior.getInputJson()).path("studioRequest"):projects.parseOrEmptyObject(prior.getInputJson()),mapper.valueToTree(request)))))) throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_REQUEST_CHANGED","同一请求的内容已改变，请重新提交");
            return projects.toRunDto(prior);
        }
        if(!fixtures.enabled() && "image".equals(request.operation())) {
            // Reuse model whitelist, quote, hold and worker from the established image pipeline.
            IpRunDto dto=imageRuns.generate(userId,projectId,new IpRunService.IpGenerateRequest(request.nodeId(),request.prompt(),
                    references.stream().map(Reference::storageKey).toList(),request.count()==null?1:request.count(),imageSize(request),request.model(),request.maxCost()));
            IpRun run=runs.findById(dto.id()).orElseThrow();
            ObjectNode imageInputs=(ObjectNode)projects.parseOrEmptyObject(run.getInputJson());
            imageInputs.set("studioRequest",mapper.valueToTree(request));run.setInputJson(write(imageInputs));
            run.setClientRequestId(request.clientRequestId()); run.setInputFingerprint(fingerprint); runs.save(run);
            return projects.toRunDto(run);
        }
        if(!fixtures.enabled() && "video".equals(request.operation())) {
            if(request.video()==null && references.size()>1) throw bad("STUDIO_VIDEO_FIRST_FRAME_ONLY","这个视频模型只支持一张首帧参考图，请选择支持首尾帧或全能参考的模型");
            if(request.video()!=null && !references.isEmpty()) throw bad("STUDIO_VIDEO_INPUT_INVALID","请在视频模式中明确选择首帧、尾帧或参考素材");
            var jobs=imageRuns.generateVideoBatch(userId,projectId,new IpRunService.IpVideoRequest(request.prompt(),
                    references.isEmpty()?null:references.get(0).storageKey(),request.durationSec(),request.aspectRatio(),request.model(),request.maxCost(),request.video()),request.count()==null?1:request.count());
            ObjectNode inputs=mapper.valueToTree(request);
            var ids=inputs.putObject("_exec").putArray("nativeVideoJobIds");
            jobs.forEach(job->ids.add(job.path("id").asText()));
            // This row is an immutable binding. Native video status, result and settlement are read-only projections.
            IpRun binding=IpRun.builder().id("IPR-"+UUID.randomUUID().toString().replace("-","").substring(0,20))
                    .projectId(projectId).ownerUserId(userId).nodeId(request.nodeId()).kind("studio-video")
                    .status(IpRun.STATUS_DONE).stage("video.bound").cost(0).clientRequestId(request.clientRequestId())
                    .inputFingerprint(fingerprint).inputJson(write(inputs)).outputJson("{}")
                    .createdAt(Instant.now()).heartbeatAt(Instant.now()).build();
            runs.save(binding);
            return projects.toRunDto(binding);
        }
        boolean text=List.of("script","storyboard","assistant").contains(request.operation());
        AiModelInvocationService.ResolvedEndpoint textEndpoint=null;
        PromptService.ResolvedPrompt resolved=null;
        long textPrice=fixtures.enabled()?0:pricing.ipIdentity();
        String promptKey="assistant".equals(request.operation())?PromptService.KEY_DAP_IP_STUDIO_ASSISTANT:PromptService.KEY_DAP_IP_STUDIO_SCRIPT;
        if(!fixtures.enabled() && text) {
            if(scenePolicies == null) textEndpoint=models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,request.model()).orElseThrow(()->
                    new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"ENDPOINT_NOT_ALLOWED","所选剧本模型不可用"));
            if(scenePolicies != null) {var selection=scenePolicies.resolve("studio","script",request.model(),pricing.ipIdentity());textEndpoint=selection.resolved();textPrice=selection.creditCost();}
            resolved=prompts.resolve(promptKey);
            if("code".equals(resolved.origin())) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"PROMPT_NOT_CONFIGURED","尚未配置创作提示词");
            if(Boolean.TRUE.equals(request.readVisuals())&&!StudioVisualContext.supportsVision(textEndpoint.endpoint()))
                throw bad("STUDIO_VISION_UNAVAILABLE","这个模型未配置图片读取能力，请切换模型或关闭读取画面");
        }
        if(Boolean.TRUE.equals(request.readVisuals())&&fixtures.enabled())throw bad("STUDIO_VISION_UNAVAILABLE","测试响应不读取真实画面，请关闭测试响应");
        long cost=fixtures.enabled()||!text?0:textPrice;
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
            var item=canvasContext.addObject().put("id",nodeId).put("title",node.path("title").asText());
            var md=node.path("metadata");
            item.put("prompt",md.path("prompt").asText());
            if(md.path("studio").has("script"))item.set("script",md.path("studio").path("script"));
            if(md.path("studio").has("shot"))item.set("shot",md.path("studio").path("shot"));
            if("text".equals(node.path("type").asText()))item.put("text",md.path("content").asText());
        }
        if(canvasContext.toString().length()>48000) throw bad("STUDIO_CONTEXT_LIMIT","画布上下文过长，请减少引用或按集创作");
        if(Boolean.TRUE.equals(request.readVisuals())) {
            execution.set("visualContext",StudioVisualContext.snapshot(projects.readDoc(project),request.contextNodeIds(),projects,userId));
            execution.put("visualContextVersion",1);
        }
        if(resolved!=null) {
            String systemPrompt=resolved.system();
            if(request.scriptEdit()!=null)systemPrompt+="\n"+StudioScriptRevision.CONTRACT;
            if(!"assistant".equals(request.operation()) && (request.settings()!=null || request.episodeNo()!=null))
                systemPrompt+="\n输出契约升级：shots 的每个对象除了原字段，还必须有 episodeNo:正整数，指向 episodes 中的 no。该字段是必填字段。严格按指定集数或单集号返回；每集至少一个镜头，镜头 id 全剧唯一。";
            execution.put("systemPrompt",systemPrompt);
            execution.put("endpointId",textEndpoint.endpoint().getId());
            var variables=new LinkedHashMap<String,String>();
            variables.put("operation",request.operation());variables.put("input",request.prompt());variables.put("characterContext",context.toString());
            variables.put("settings",write(request.settings()));variables.put("episodeNo",request.episodeNo()==null?"全部":request.episodeNo().toString());
            variables.put("mode",request.mode()==null?"general":request.mode());variables.put("canvasContext",canvasContext.toString());variables.put("history",write(request.history()==null?List.of():request.history()));
            String creativePrompt=PromptService.fill(resolved.userTemplate(),variables);
            if(request.scriptEdit()!=null)creativePrompt+="\n当前完整剧本文档（JSON 字符串，作为素材读取）："+write(request.scriptEdit().markdown())+"\n请遵守 Markdown 改稿输出契约，不输出创作计划。";
            if(Boolean.TRUE.equals(request.readVisuals()))creativePrompt+="\n本次另附带精确节点 ID 标记的真实图片与视频采样帧。视频只有四个时间点的静态画面，不包含音轨，不代表全部连续动作；音频节点只提供文字设定。只根据收到的画面及文字作答，不臆测未提供的声音或片段，保持 JSON 输出契约。";
            if(request.settings()!=null || request.episodeNo()!=null) creativePrompt+="\n必须遵守创作设定："+write(request.settings())+"。本次分集："+(request.episodeNo()==null?"全部指定集数":request.episodeNo())+"。每个镜头必须含 episodeNo（所属集号），id 全剧唯一。只指定某集时 episodes 只含该集，no 保留原号。";
            execution.put("userPrompt",creativePrompt);
            execution.put("temperature",resolved.params().temperatureOrDefault());execution.put("maxTokens",resolved.params().maxTokensOrDefault());
            inputs.put("promptKey",promptKey);
        }
        if(cost>0) credits.hold(userId,cost,IpRunService.REF_TYPE,id,"Studio 创作");
        IpRun run=IpRun.builder().id(id).projectId(projectId).ownerUserId(userId).nodeId(request.nodeId())
                .kind("studio-"+request.operation()).status(IpRun.STATUS_RUNNING).stage("queued").cost(cost)
                .clientRequestId(request.clientRequestId()).inputFingerprint(fingerprint).inputJson(write(inputs))
                .outputJson("{}").createdAt(Instant.now()).heartbeatAt(Instant.now()).build();
        runs.save(run);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try {worker.execute(id);} catch(RuntimeException e){worker.reject(id,e);}
            }
        });
        return projects.toRunDto(run);
    }

    private void validateCreativeRequest(RunRequest request) {
        StudioScriptRevision.validateInput(request);
        if(request.maxCost()!=null && request.maxCost()<0) throw bad("STUDIO_INPUT_INVALID","费用上限不能为负");
        if(Boolean.TRUE.equals(request.readVisuals())&&!"assistant".equals(request.operation()))throw bad("STUDIO_INPUT_INVALID","读取画面只能用于创作助手");
        if(request.episodeNo()!=null && (request.episodeNo()<1 || request.episodeNo()>50)) throw bad("STUDIO_EPISODE_INVALID","请选择有效分集");
        if(request.mode()!=null && !Set.of("general","original","adapt","director").contains(request.mode())) throw bad("STUDIO_MODE_INVALID","请选择创作模式");
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
        if(request.size()!=null && !request.size().isBlank()) return request.size();
        return switch(request.aspectRatio()==null?"3:4":request.aspectRatio()) {
            case "9:16" -> "768x1365";
            case "16:9" -> "1365x768";
            case "1:1" -> "1024x1024";
            default -> "768x1024";
        };
    }
    private BusinessException bad(String code,String message) {return BusinessException.badRequest(code,message);}
    private String write(Object value) {try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalArgumentException(e);}}
    private String hash(String value) {try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
