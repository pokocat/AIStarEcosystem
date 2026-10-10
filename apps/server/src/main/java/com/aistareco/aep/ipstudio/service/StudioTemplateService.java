package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.*;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Reference;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpCreateProjectRequest;
import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.ipstudio.repository.*;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/** Versioned authoring and free instantiation. Native IpRun owns execution and billing. */
@Service
public class StudioTemplateService {
    private static final Set<String> TYPES=Set.of("character","image","text","option");
    private static final Set<String> ROLES=Set.of("main","sheet","front","side","back","expression","detail","custom");
    private static final Set<String> SIZES=Set.of("768x1024","1024x1024","768x1365","1365x768");
    private static final Pattern VARIABLE=Pattern.compile("\\{\\{([a-zA-Z][a-zA-Z0-9_-]{0,31})}}");
    private final IpDemoTemplateRepository templates;
    private final IpTemplateVersionRepository versions;
    private final IpProjectService projects;
    private final IpRunService images;
    private final StudioTemplateVideoService videos;
    private final AiModelInvocationService models;
    private final DapAvatarRepository avatars;
    private final StudioIpAssetService assets;
    private final FileStorageService storage;
    private final EntityManager em;
    private final ObjectMapper mapper;
    public StudioTemplateService(IpDemoTemplateRepository templates,IpTemplateVersionRepository versions,
            IpProjectService projects,IpRunService images,AiModelInvocationService models,DapAvatarRepository avatars,
            StudioIpAssetService assets,FileStorageService storage,EntityManager em,ObjectMapper mapper,StudioTemplateVideoService videos) {
        this.templates=templates;this.versions=versions;this.projects=projects;this.images=images;this.models=models;
        this.avatars=avatars;this.assets=assets;this.storage=storage;this.em=em;this.mapper=mapper;this.videos=videos;
    }

    @Transactional
    public Version publish(String owner,String projectId,PublishRequest req) {
        if(req==null)invalid("请配置模板");
        text(req.name(),128,"模板名称");
        if(req.summary()!=null && req.summary().length()>1024)invalid("说明最多 1024 字");
        if(!Set.of("personal","official").contains(req.visibility()==null?"":req.visibility()))invalid("请选择模板可见范围");
        var project=projects.requiredForUpdate(owner,projectId);
        JsonNode source=projects.readDoc(project);
        Recipe recipe=validateRecipe(req.recipe(),source);
        IpDemoTemplate row;
        if(req.templateId()!=null && !req.templateId().isBlank()) {
            row=templates.findById(req.templateId()).orElseThrow(StudioTemplateService::notFound);
            em.lock(row,LockModeType.PESSIMISTIC_WRITE);
            if(!owner.equals(row.getCreatedBy()) || !IpDemoTemplate.KIND_TEMPLATE.equals(row.getKind()))throw notFound();
            // Visibility is a template identity. Publishing a public variant uses a separate template.
            if(!Objects.equals(row.getVisibility(),req.visibility()))invalid("可见范围不可改，请另存为新模板");
        } else row=IpDemoTemplate.builder().id(id("IPD-")).createdBy(owner).createdAt(Instant.now()).kind("template").visibility(req.visibility()).build();
        int number=versions.findByTemplateIdOrderByVersionDesc(row.getId()).stream().mapToInt(IpTemplateVersion::getVersion).max().orElse(0)+1;
        ObjectNode clean=cleanDoc(source,recipe);
        var release=IpTemplateVersion.builder().id(id("IPV-")).templateId(row.getId()).version(number)
                .name(req.name().trim()).summary(req.summary()==null?"":req.summary().trim()).recipeJson(write(recipe))
                .docJson(write(clean)).createdAt(Instant.now()).build();
        versions.save(release);
        row.setName(release.getName());row.setSummary(release.getSummary());row.setDocJson(release.getDocJson());
        row.setCoverKey(null);row.setCurrentVersionId(release.getId());row.setSourceProjectId(projectId);
        row.setUpdatedAt(Instant.now());templates.save(row);
        return view(row,release);
    }

    @Transactional(readOnly=true)
    public Version read(String owner,String versionId) {
        var release=version(versionId);var template=accessible(owner,release.getTemplateId(),true);
        return view(template,release);
    }

    @Transactional
    public void availability(String owner,String templateId,boolean enabled,boolean superAdmin) {
        var row=templates.findById(templateId).orElseThrow(StudioTemplateService::notFound);
        em.lock(row,LockModeType.PESSIMISTIC_WRITE);
        boolean official="official".equals(row.getVisibility());
        if(official?!superAdmin:!owner.equals(row.getCreatedBy()))throw notFound();
        if(row.getCurrentVersionId()==null)invalid("旧模板请在官方内容管理中维护");
        row.setEnabled(enabled);row.setUpdatedAt(Instant.now());templates.save(row);
    }

    @Transactional(readOnly=true)
    public Plan preview(String owner,UseRequest request) {
        var release=requireUse(owner,request);
        var recipe=recipe(release);
        var values=inputs(owner,recipe,request.inputs());
        return plan(owner,release,recipe,values,request.model(),request.videoModel(),Map.of());
    }

    @Transactional
    public Instance instantiate(String owner,UseRequest request) {
        var release=requireUse(owner,request);var row=accessible(owner,release.getTemplateId(),true);
        var recipe=recipe(release);var values=inputs(owner,recipe,request.inputs());
        // Model/prompt/price preflight precedes all project writes. No hold or provider request here.
        Plan approved=plan(owner,release,recipe,values,request.model(),request.videoModel(),Map.of());
        var blank=projects.create(owner,new IpCreateProjectRequest(request.name()==null?release.getName():request.name(),null));
        var project=projects.requiredForUpdate(owner,blank.id());
        ObjectNode doc=(ObjectNode)parse(release.getDocJson());
        Map<String,String> nodeIds=new LinkedHashMap<>();
        for(var node:doc.path("nodes"))nodeIds.put(node.path("id").asText(),id("N-"));
        for(var node:doc.path("nodes"))((ObjectNode)node).put("id",nodeIds.get(node.path("id").asText()));
        for(var edge:doc.path("connections")) {
            var e=(ObjectNode)edge;e.put("id",id("E-"));e.put("fromNodeId",nodeIds.get(e.path("fromNodeId").asText()));e.put("toNodeId",nodeIds.get(e.path("toNodeId").asText()));
        }
        for(Input input:recipe.inputs()) {
            ObjectNode node=(ObjectNode)IpDocs.node(doc,nodeIds.get(input.nodeId()));var md=(ObjectNode)node.path("metadata");
            Value value=values.get(input.id());md.put("templateInputId",input.id());
            if(value.reference()!=null) {
                var ref=value.reference();md.put("storageKey",ref.storageKey());md.put("status","success");
                var studio=md.putObject("studio").put("kind","character");studio.set("references",mapper.valueToTree(List.of(ref)));
            } else md.put("content",value.text());
        }
        for(Step step:recipe.steps()) {
            var node=IpDocs.node(doc,nodeIds.get(step.nodeId()));var md=(ObjectNode)node.path("metadata");
            md.put("prompt",render(step.prompt(),values));md.put("templateStepId",step.id());
            if("video".equals(step.operation())) {md.put("seconds",step.durationSec());md.put("aspectRatio",step.aspectRatio());md.put("model",approved.videoModel());}
            md.putObject("studio").put("kind","main".equals(step.outputRole())?"character":"shot").put("assetRole",step.outputRole());
        }
        Plan instancePlan=plan(owner,release,recipe,values,approved.model(),approved.videoModel(),nodeIds);
        ObjectNode snapshot=mapper.createObjectNode();snapshot.set("inputs",mapper.valueToTree(values));snapshot.set("nodeIds",mapper.valueToTree(nodeIds));snapshot.set("plan",mapper.valueToTree(instancePlan));
        project.setTemplateId(row.getId());project.setTemplateVersionId(release.getId());project.setTemplateInstanceJson(write(snapshot));
        project.setDocJson(write(doc));projects.save(project);
        return new Instance(projects.detail(owner,project.getId()),view(row,release),instancePlan);
    }

    /** Existing projects can still read their immutable source after downlisting. No fresh preflight on recovery. */
    @Transactional(readOnly=true)
    public Instance instance(String owner,String projectId) {
        var project=projects.required(owner,projectId);
        if(project.getTemplateVersionId()==null || project.getTemplateInstanceJson()==null)
            throw BusinessException.notFound("STUDIO_TEMPLATE_INSTANCE_NOT_FOUND","这张画布没有锁定模板版本");
        var release=version(project.getTemplateVersionId());
        var row=templates.findById(release.getTemplateId()).orElseThrow(StudioTemplateService::notFound);
        try {return new Instance(projects.detail(owner,projectId),view(row,release),mapper.treeToValue(parse(project.getTemplateInstanceJson()).path("plan"),Plan.class));}
        catch(Exception e){throw new IllegalStateException("Invalid persisted template plan",e);}
    }

    private Plan plan(String owner,IpTemplateVersion release,Recipe recipe,Map<String,Value> values,String requestedModel,String requestedVideoModel,Map<String,String> nodeIds) {
        String model=null,videoModel=requestedVideoModel;
        if(recipe.steps().stream().anyMatch(s->"image".equals(s.operation())))model=models.resolveEndpoint(AiModelPurpose.DAP_IMAGE,requestedModel).orElseThrow(()->
                new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"ENDPOINT_NOT_ALLOWED","请选择可用的图片模型")).endpoint().getId();
        var stepsById=new HashMap<String,Step>();recipe.steps().forEach(s->stepsById.put(s.id(),s));
        List<PlanStep> result=new ArrayList<>();long total=0;int imageCount=0,videoCount=0;
        for(Step step:recipe.steps()) {
            String prompt=render(step.prompt(),values);long cost;
            if("video".equals(step.operation())) {var quote=videos.quote(owner,step,videoModel,prompt);videoModel=quote.model();cost=quote.cost();videoCount++;}
            else {
                var refs=step.references().stream().map(values::get).filter(Objects::nonNull).filter(v->v.reference()!=null).map(v->v.reference().storageKey()).toList();
                var compiled=images.compileExplicit(owner,new IpRunService.IpGenerateRequest(null,prompt,refs,1,step.size(),model));
                images.preflight(compiled);cost=compiled.unitCost();imageCount++;
            }
            total=Math.addExact(total,cost);
            List<String> dependencies=step.references().stream().filter(stepsById::containsKey).toList();
            String state=dependencies.isEmpty()?"ready":dependencies.stream().anyMatch(d->stepsById.get(d).requiresAdoption())?"waiting_adoption":"waiting_dependency";
            result.add(new PlanStep(step.id(),step.title(),nodeIds.getOrDefault(step.nodeId(),step.nodeId()),step.outputRole(),cost,state,dependencies,step.requiresAdoption(),step.operation()));
        }
        return new Plan(release.getId(),release.getVersion(),model,total,imageCount,result,videoCount==0?null:videoModel,videoCount);
    }

    private Map<String,Value> inputs(String owner,Recipe recipe,Map<String,Value> supplied) {
        if(supplied==null)inputInvalid("请填写模板输入");
        Set<String> declared=new HashSet<>();recipe.inputs().forEach(i->declared.add(i.id()));
        for(String id:supplied.keySet())if(!declared.contains(id))inputInvalid("模板不包含输入："+id);
        Map<String,Value> result=new LinkedHashMap<>();
        for(Input input:recipe.inputs()) {
            Value value=supplied.get(input.id());boolean media=Set.of("character","image").contains(input.type());
            if(media) {
                if(value==null || value.reference()==null) {
                    if(input.required())inputInvalid("请选择或上传"+input.label());
                    result.put(input.id(),new Value("",null));continue;
                }
                if(value.text()!=null && !value.text().isBlank())inputInvalid("图片输入不能同时包含文字");
                Reference ref=value.reference();String key=projects.requireOwnedAssetKey(owner,ref.storageKey());
                if(key==null)inputInvalid("缺少图片素材");
                Integer ver=ref.version();String ip=ref.ipId();
                if(ref.avatarId()!=null) {
                    var avatar=avatars.findByIdAndOwnerUserId(ref.avatarId(),owner).filter(a->a.getDeletedAt()==null).orElseThrow(()->BusinessException.badRequest("STUDIO_TEMPLATE_INPUT_INVALID","人物不存在或不属于你"));
                    if(ip!=null && !ip.equals(avatar.getIpId()))inputInvalid("人物与 IP 不一致");
                    if(!(ref.lookId()!=null?assets.matchesLook(avatar,ref.lookId(),key):assets.matchesVersion(avatar,key,ver)))inputInvalid("图片与人物版本不一致");
                    if(ver==null)ver=avatar.getVersions();ip=avatar.getIpId();
                } else if(ip!=null || ver!=null || ref.lookId()!=null)inputInvalid("人物版本缺少人物编号");
                requireImage(key);
                result.put(input.id(),new Value(null,new Reference(ip,ref.avatarId(),ver,key,"character".equals(input.type())?"character":"frame",ref.lookId())));
            } else {
                if(value!=null && value.reference()!=null)inputInvalid("文字输入不能包含素材");
                String content=value==null || value.text()==null?input.defaultValue():value.text().trim();
                if(content==null)content="";
                if(input.required() && content.isBlank())inputInvalid("请填写"+input.label());
                if(content.length()>2000)inputInvalid("输入最多 2000 字");
                if("option".equals(input.type()) && !content.isBlank() && !input.options().contains(content))inputInvalid("请选择"+input.label()+"中的选项");
                result.put(input.id(),new Value(content,null));
            }
        }
        return result;
    }

    private void requireImage(String key) {
        try(var stream=javax.imageio.ImageIO.createImageInputStream(storage.openForRead(key).toFile())) {
            if(stream==null)inputInvalid("图片无法读取");
            var readers=javax.imageio.ImageIO.getImageReaders(stream);if(!readers.hasNext())inputInvalid("输入必须是真实图片");
            var reader=readers.next();try {reader.setInput(stream);if(reader.getWidth(0)<1 || reader.getHeight(0)<1)inputInvalid("图片尺寸无效");}finally{reader.dispose();}
        } catch(BusinessException e){throw e;}catch(Exception e){inputInvalid("图片已不可用，请重新上传或选择");}
    }

    static Recipe validateRecipe(Recipe recipe,JsonNode source) {
        if(recipe==null || recipe.inputs()==null || recipe.steps()==null || recipe.inputs().size()>12 || recipe.steps().isEmpty() || recipe.steps().size()>20)invalid("模板需要 1 到 20 个图片/视频步骤，最多 12 个输入");
        Set<String> ids=new HashSet<>(),nodes=new HashSet<>(),textInputs=new HashSet<>();
        List<Input> normalized=new ArrayList<>();
        for(Input input:recipe.inputs()) {
            if(input==null)invalid("输入不完整");identifier(input.id());text(input.nodeId(),64,"输入节点");text(input.label(),64,"输入名称");
            if(!ids.add(input.id()) || !nodes.add(input.nodeId()) || !TYPES.contains(input.type()==null?"":input.type()))invalid("输入名称/节点重复或类型不支持");
            var node=IpDocs.node(source,input.nodeId());boolean media=Set.of("image","character").contains(input.type());
            if(node==null || !(media?"image":"text").equals(node.path("type").asText()))invalid("输入节点与类型不一致");
            List<String> choices="option".equals(input.type())?input.options():null;
            if("option".equals(input.type())) {
                if(choices==null || choices.isEmpty() || choices.size()>20 || new HashSet<>(choices).size()!=choices.size())invalid("选项必须有 1 到 20 个不同值");
                for(String choice:choices)text(choice,100,"选项");
            }
            String defaultText=media?null:input.defaultValue();
            if(defaultText!=null && defaultText.length()>2000)invalid("默认值过长");
            if(choices!=null && defaultText!=null && !choices.contains(defaultText))invalid("默认值不在选项中");
            if(!media)textInputs.add(input.id());
            normalized.add(new Input(input.id(),input.nodeId(),input.label().trim(),input.type(),input.required(),choices,defaultText));
        }
        for(Step step:recipe.steps()) {
            if(step==null)invalid("步骤不完整");identifier(step.id());text(step.nodeId(),64,"步骤节点");text(step.title(),128,"步骤名称");text(step.prompt(),12000,"图片指令");
            boolean video="video".equals(step.operation());
            if(!ids.add(step.id()) || !nodes.add(step.nodeId()) || !Set.of("image","video").contains(step.operation()==null?"":step.operation()) || (video?!"video".equals(step.outputRole()):!SIZES.contains(step.size()==null?"":step.size()) || !ROLES.contains(step.outputRole()==null?"":step.outputRole())))invalid("步骤重复或能力/输出规格不支持");
            var node=IpDocs.node(source,step.nodeId());if(node==null || !step.operation().equals(node.path("type").asText()))invalid("步骤必须来自对应的图片或视频节点");
            if(step.references()==null || step.references().stream().anyMatch(Objects::isNull) || step.references().size()>(video?9:4) || new HashSet<>(step.references()).size()!=step.references().size())invalid("图片最多引用 4 个来源，视频最多引用 9 张图片");
            if(video) {
                if(step.durationSec()==null || step.durationSec()<1 || step.durationSec()>30 || !Set.of("9:16","16:9","1:1","3:4","4:3","21:9").contains(step.aspectRatio()==null?"":step.aspectRatio()))invalid("请配置视频时长及画幅");
                var v=step.video();String mode=v==null?(step.references().isEmpty()?"t2v":"i2v"):v.mode();int count=step.references().size();
                if(!Set.of("t2v","i2v","first_last_frame_video","universal_reference_video").contains(mode==null?"":mode) || ("t2v".equals(mode)&&count!=0) || ("i2v".equals(mode)&&count!=1) || ("first_last_frame_video".equals(mode)&&count!=2) || ("universal_reference_video".equals(mode)&&count<1))invalid("视频模式与引用数量不一致：首尾帧按引用顺序使用");
                if(v!=null && (!Set.of("768p","544p").contains(v.resolutionTier()==null?"":v.resolutionTier()) || v.seed()!=null&&(v.seed()<0||v.seed()>2147483647L)))invalid("视频清晰度或随机种子无效");
            } else if(step.video()!=null || step.durationSec()!=null)invalid("图片步骤不能包含视频参数");
            var matcher=VARIABLE.matcher(step.prompt());while(matcher.find())if(!textInputs.contains(matcher.group(1)))invalid("指令变量必须对应文字或选项输入："+matcher.group(1));
        }
        Set<String> previous=new HashSet<>();normalized.forEach(i->previous.add(i.id()));
        Set<String> mediaIds=new HashSet<>();normalized.stream().filter(i->Set.of("character","image").contains(i.type())).forEach(i->mediaIds.add(i.id()));
        for(Step step:recipe.steps()) {for(String ref:step.references())if(!previous.contains(ref) || !mediaIds.contains(ref))invalid("引用需要对应图片输入或前面的图片步骤："+ref);previous.add(step.id());if("image".equals(step.operation()))mediaIds.add(step.id());}
        // Author must explicitly declare each incoming image dependency; dropping an edge silently changes the recipe.
        Map<String,String> sourceIds=new HashMap<>();normalized.forEach(i->sourceIds.put(i.nodeId(),i.id()));recipe.steps().forEach(s->sourceIds.put(s.nodeId(),s.id()));
        for(Step step:recipe.steps())for(var edge:source.path("connections"))if(step.nodeId().equals(edge.path("toNodeId").asText())) {
            String parentId=edge.path("fromNodeId").asText();var parent=IpDocs.node(source,parentId);
            if(parent!=null && "image".equals(parent.path("type").asText()) && (sourceIds.get(parentId)==null || !step.references().contains(sourceIds.get(parentId))))invalid("步骤「"+step.title()+"」有未绑定图片依赖，请补充输入或步骤引用");
        }
        return new Recipe(List.copyOf(normalized),List.copyOf(recipe.steps()));
    }

    static ObjectNode cleanDoc(JsonNode source,Recipe recipe) {
        var mapper=new ObjectMapper();var clean=IpDocs.emptyDoc(mapper);var nodes=(ArrayNode)clean.path("nodes");
        Map<String,String> ids=new HashMap<>();recipe.inputs().forEach(i->ids.put(i.id(),i.nodeId()));recipe.steps().forEach(s->ids.put(s.id(),s.nodeId()));
        Set<String> selected=new HashSet<>(ids.values());
        for(var original:source.path("nodes"))if(selected.contains(original.path("id").asText())) {
            var node=nodes.addObject();node.put("id",original.path("id").asText());node.put("type",original.path("type").asText());node.put("title",original.path("title").asText().substring(0,Math.min(128,original.path("title").asText().length())));
            node.putObject("position").put("x",clamp(original.path("position").path("x").asDouble(),-100000,100000)).put("y",clamp(original.path("position").path("y").asDouble(),-100000,100000));
            node.put("width",clamp(original.path("width").asDouble(320),64,2000));node.put("height",clamp(original.path("height").asDouble(400),64,2000));node.putObject("metadata").put("status","idle");
        }
        for(Input input:recipe.inputs()) {var node=(ObjectNode)IpDocs.node(clean,input.nodeId());node.put("title",input.label());}
        var edges=(ArrayNode)clean.path("connections");
        for(Step step:recipe.steps()) {
            var node=(ObjectNode)IpDocs.node(clean,step.nodeId());node.put("title",step.title());((ObjectNode)node.path("metadata")).put("prompt",step.prompt());
            for(String ref:step.references())edges.addObject().put("id",id("E-")).put("fromNodeId",ids.get(ref)).put("toNodeId",step.nodeId());
        }
        return clean;
    }
    static String render(String prompt,Map<String,Value> values) {
        var matcher=VARIABLE.matcher(prompt);var result=new StringBuffer();
        while(matcher.find())matcher.appendReplacement(result,java.util.regex.Matcher.quoteReplacement(values.get(matcher.group(1)).text()));
        matcher.appendTail(result);if(result.length()>16000)inputInvalid("填入后的创作指令超过长度限制");return result.toString();
    }
    private IpTemplateVersion requireUse(String owner,UseRequest request) {
        if(request==null || request.versionId()==null)inputInvalid("请选择模板版本");
        if(request.name()!=null && (request.name().isBlank() || request.name().length()>128))inputInvalid("画布名称应为 1 到 128 字");
        var release=version(request.versionId());var row=accessible(owner,release.getTemplateId(),true);
        if(!Objects.equals(row.getCurrentVersionId(),release.getId()))throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_TEMPLATE_VERSION_CHANGED","模板已有新版本，请重新打开并预览制作计划");
        return release;
    }
    private IpDemoTemplate accessible(String owner,String id,boolean enabled) {
        return templates.findById(id).filter(t->!enabled || t.isEnabled()).filter(t->!"personal".equals(t.getVisibility()) || owner.equals(t.getCreatedBy())).orElseThrow(StudioTemplateService::notFound);
    }
    private IpTemplateVersion version(String id) {return versions.findById(id).orElseThrow(StudioTemplateService::notFound);}
    private Recipe recipe(IpTemplateVersion release) {try{return mapper.readValue(release.getRecipeJson(),Recipe.class);}catch(Exception e){throw new IllegalStateException("Invalid published recipe",e);}}
    private Version view(IpDemoTemplate row,IpTemplateVersion release) {return new Version(release.getId(),release.getTemplateId(),release.getVersion(),release.getName(),release.getSummary(),row.getVisibility(),recipe(release),parse(release.getDocJson()),release.getCreatedAt().toString());}
    private String write(Object value) {try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
    private JsonNode parse(String value) {try{return mapper.readTree(value);}catch(Exception e){throw new IllegalStateException(e);}}
    private static double clamp(double value,double min,double max){return Double.isFinite(value)?Math.max(min,Math.min(max,value)):min;}
    private static String id(String prefix){return prefix+UUID.randomUUID().toString().replace("-","").substring(0,20);}
    private static void identifier(String id){if(id==null || !id.matches("[a-zA-Z][a-zA-Z0-9_-]{0,31}"))invalid("输入与步骤编号应以字母开头，最多 32 位");}
    private static void text(String value,int max,String label){if(value==null || value.isBlank() || value.length()>max)invalid(label+"应为 1 到 "+max+" 字");}
    private static void invalid(String message){throw BusinessException.badRequest("STUDIO_TEMPLATE_INVALID",message);}
    private static void inputInvalid(String message){throw BusinessException.badRequest("STUDIO_TEMPLATE_INPUT_INVALID",message);}
    private static BusinessException notFound(){return BusinessException.notFound("STUDIO_TEMPLATE_NOT_FOUND","模板不存在、不属于你或已经下架");}
}
