package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.ipstudio.dto.IpLibraryDtos.*;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpCreateProjectRequest;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.ipstudio.repository.*;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@Service
public class IpLibraryService {
    private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(IpLibraryService.class);
    private final IpLibraryRecordRepository records;private final IpSavedAssetService saved;private final IpProjectService projects;
    private final IpRunRepository runs;private final StudioWorkflowService workflow;private final FileStorageService storage;
    private final ObjectMapper om;private final AepUserRepository users;
    @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entityManager;
    public IpLibraryService(IpLibraryRecordRepository records,IpSavedAssetService saved,IpProjectService projects,IpRunRepository runs,
            StudioWorkflowService workflow,FileStorageService storage,ObjectMapper om,AepUserRepository users) {
        this.records=records;this.saved=saved;this.projects=projects;this.runs=runs;this.workflow=workflow;this.storage=storage;this.om=om;this.users=users;
    }
    public List<LibraryFolder> folders(String user){return rows(user,"folder").stream().map(r->new LibraryFolder(r.getId(),json(r).path("name").asText())).toList();}
    @Transactional public LibraryFolder folder(String user,String id,String name) {
        lock(user);String title=text(name,100,"文件夹名称");
        var row=id==null?newRecord(user,"folder",null):required(user,id,"folder");
        var data=om.createObjectNode().put("name",title);persist(row,data);return new LibraryFolder(row.getId(),title);
    }
    @Transactional public void deleteFolder(String user,String id) {
        lock(user);var f=required(user,id,"folder");
        for(var row:rows(user,"object")){var data=json(row);if(id.equals(data.path("folderId").asText())){data.remove("folderId");persist(row,data);}}
        saved.clearFolder(user,id);f.setDeletedAt(Instant.now());records.save(f);
    }
    /** kind=all|character|scene|prop|product：资产页「人物」只列角色（2026-10-31）；导演台商品库只列商品（2026-11-06）。 */
    public LibraryPage<LibraryObject> objects(String user,String folder,String query,String status,String kind,int page,String project,String node) {
        if(kind!=null&&!kind.equals("all")&&!kind.equals("character")&&!kind.equals("scene")&&!kind.equals("prop")&&!kind.equals("product"))throw BusinessException.badRequest("IP_LIBRARY_INVALID","资产类型不正确");
        var names=new HashMap<String,String>();for(var f:folders(user))names.put(f.id(),f.name());
        var list=new ArrayList<IpLibraryRecord>();String needle=query==null?"":query.toLowerCase(Locale.ROOT);
        for(var row:rows(user,"object")){var d=json(row);String f=d.path("folderId").asText();
            if(folder!=null&&!folder.isBlank()&&!folder.equals("all")&&!(folder.equals("unfiled")?f.isBlank():folder.equals(f)))continue;
            if(status!=null&&!status.equals("all")&&(status.equals("pending")?d.hasNonNull("mainVersionId"):!d.hasNonNull("mainVersionId")))continue;
            if(kind!=null&&!kind.equals("all")&&!kind.equals(d.path("kind").asText()))continue;
            boolean sourceMatch=project==null;var originTitles=new StringBuilder();for(var origin:d.path("sources")){originTitles.append(origin.path("title").asText()).append(' ');if(project!=null&&project.equals(origin.path("projectId").asText())&&(node==null||node.equals(origin.path("nodeId").asText())))sourceMatch=true;}
            if(!sourceMatch)continue;
            String searchable=d.path("name").asText()+" "+d.path("description").asText()+" "+originTitles+" "+names.getOrDefault(f,"未分类");
            if(!searchable.toLowerCase(Locale.ROOT).contains(needle))continue;list.add(row);
        }
        var p=page(list,page);return new LibraryPage<>(p.items().stream().map(this::wire).toList(),p.page(),p.total(),p.hasMore());
    }
    public LibraryObject object(String user,String id){return wire(required(user,id,"object"));}
    @Transactional public LibraryObject create(String user,LibraryCandidate item,String folder) {
        lock(user);checkFolder(user,folder);validateCandidate(item);
        var row=newRecord(user,"object",null);var data=baseObject(item,folder);persist(row,data);return wire(row);
    }
    @Transactional public LibraryObject edit(String user,String id,JsonNode body) {
        lock(user);var row=required(user,id,"object");var data=json(row);
        if(body.hasNonNull("updatedAt")&&!row.getUpdatedAt().toString().equals(body.path("updatedAt").asText()))throw conflict("资产已在其他页面修改，请刷新后再保存");
        for(String field:List.of("name","description","prompt"))if(body.has(field))data.put(field,field.equals("name")?text(body.path(field).asText(),128,"资产名称"):bounded(body.path(field).asText(),field.equals("prompt")?4000:2000));
        if(body.has("folderId")){String folder=body.path("folderId").asText(null);checkFolder(user,folder);if(folder==null||folder.isBlank())data.remove("folderId");else data.put("folderId",folder);}
        if(body.has("referenceKey")){String key=body.path("referenceKey").asText(null);if(key==null||key.isBlank())data.remove("referenceKey");else{projects.requireOwnedAssetKey(user,key);requireImage(key);data.put("referenceKey",key);}}
        if(body.has("mainVersionId")){String version=body.path("mainVersionId").asText();if(!hasVersion(data,version))throw invalid("请选择该资产已有的图片版本");data.put("mainVersionId",version).put("mainAssigned",true);}
        if(body.hasNonNull("removeVersionId"))removeVersion(data,body.path("removeVersionId").asText());
        persist(row,data);return wire(row);
    }
    @Transactional public void remove(String user,String id){lock(user);var row=required(user,id,"object");row.setDeletedAt(Instant.now());records.save(row);}
    @Transactional public LibraryObject upload(String user,String id,UploadVersionRequest request) {
        lock(user);var row=required(user,id,"object");projects.requireOwnedAssetKey(user,request.storageKey());requireImage(request.storageKey());
        var data=json(row);addVersion(data,request.storageKey(),"",null,false,request.main());if(request.main())data.put("mainAssigned",true);persist(row,data);
        saved.saveAutomatic(user,media("image",data.path("name").asText(),request.storageKey(),null,"用户上传",data.path("folderId").asText(null),id));return wire(row);
    }
    @Transactional public LibraryExtraction extract(String user,String project,ExtractRequest request) {
        var p=projects.required(user,project);var node=IpDocs.node(projects.readDoc(p),request.nodeId());
        if(node==null||!"text".equals(node.path("type").asText()))throw invalid("请选择剧本或文本节点");
        String source=sourceText(node),title=node.path("title").asText("剧本");
        var items=StudioAssetExtraction.structured(source);
        if(!request.analyze())return new LibraryExtraction(hash(source),title,items,null);
        String scoped=source;
        if(request.episodeNo()!=null){var episodes=node.path("metadata").path("studio").path("script").path("episodes");JsonNode chosen=null;for(var ep:episodes)if(ep.path("no").asInt()==request.episodeNo())chosen=ep;if(chosen==null)throw invalid("该分集不存在，请先保存剧本");scoped=chosen.path("content").asText();}
        var input=om.createObjectNode().put("clientRequestId",text(request.clientRequestId(),64,"请求编号")).put("nodeId",request.nodeId()).put("operation","asset-extract")
            .put("prompt","从当前已保存剧本提取人物、场景和道具，只依据原文。").put("maxCost",request.maxCost()==null?-1:request.maxCost());
        if(request.model()!=null)input.put("model",request.model());input.putObject("scriptEdit").put("markdown",bounded(scoped,48000));
        if(request.billing()!=null)input.set("billing",om.valueToTree(request.billing()));
        var run=workflow.submit(user,project,convert(input,RunRequest.class));
        return new LibraryExtraction(hash(source),title,List.of(),run);
    }
    @Transactional public List<LibraryObject> saveExtraction(String user,String project,SaveExtractRequest request) {
        projects.required(user,project);lock(user);checkFolder(user,request.folderId());
        var node=IpDocs.node(projects.readDoc(projects.required(user,project)),request.nodeId());
        if(node==null)throw invalid("来源剧本已移除，请重新提取");String source=sourceText(node);
        if(!hash(source).equals(request.sourceHash()))throw conflict("剧本已改变，请基于最新正文重新核对提取结果");
        if(request.items()==null||request.items().size()>100)throw invalid("一次最多保存 100 个资产");
        var result=new ArrayList<LibraryObject>();var seen=new HashSet<String>();
        for(var item:request.items()) {
            validateCandidate(item);if(!seen.add(item.key()))throw invalid("提取条目标识重复");
            if(!item.evidence().isBlank()&&!source.contains(item.evidence()))throw invalid("原文依据已改变，请重新核对");
            String bindingId="ILB-"+hash(user+"\0"+project+"\0"+request.nodeId()+"\0"+item.key()).substring(0,24);
            var binding=records.findByIdAndOwnerUserIdAndDeletedAtIsNull(bindingId,user).orElse(null);
            String linked=binding==null?item.reuseId():json(binding).path("objectId").asText();
            IpLibraryRecord row;
            if(linked!=null&&!linked.isBlank())row=required(user,linked,"object");else{row=newRecord(user,"object",null);persist(row,baseObject(item,request.folderId()));}
            var data=json(row);if(!data.path("kind").asText().equals(item.kind()))throw invalid("只能复用相同类别的资产");
            ArrayNode origins=(ArrayNode)data.path("sources");boolean exists=false;
            for(var origin:origins)if(bindingId.equals(origin.path("id").asText()))exists=true;
            if(!exists)origins.addObject().put("id",bindingId).put("projectId",project).put("nodeId",request.nodeId()).put("title",node.path("title").asText())
                .put("evidence",item.evidence()).put("description",item.description());
            persist(row,data);
            if(binding==null){binding=newRecord(user,"binding",bindingId);persist(binding,om.createObjectNode().put("objectId",row.getId()));}
            result.add(wire(row));
        }
        var pref=newRecord(user,"preference","ILP-"+hash(user+"\0"+project).substring(0,24));persist(pref,om.createObjectNode().put("projectId",project).put("folderId",request.folderId()));
        return result;
    }
    public String canvasFolder(String user,String project){projects.required(user,project);String id=records.findByIdAndOwnerUserIdAndDeletedAtIsNull("ILP-"+hash(user+"\0"+project).substring(0,24),user).map(r->json(r).path("folderId").asText(null)).orElse(null);return id!=null&&records.findByIdAndOwnerUserIdAndDeletedAtIsNull(id,user).isPresent()?id:null;}
    @Transactional public void setCanvasFolder(String user,String project,String folder){projects.required(user,project);lock(user);checkFolder(user,folder);var pref=newRecord(user,"preference","ILP-"+hash(user+"\0"+project).substring(0,24));persist(pref,om.createObjectNode().put("projectId",project).put("folderId",folder));}
    @Transactional(readOnly=true)
    public com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.ReplaySelection billingSelection(String user,String id,String clientRequestId) {
        var row=required(user,id,"object");var data=json(row);
        String pending=data.path("pendingRunId").asText();
        var run=pending.isBlank()?null:runs.findByIdAndOwnerUserId(pending,user).filter(r->id.equals(r.getNodeId())&&clientRequestId.equals(r.getClientRequestId())).orElse(null);
        if(run==null) {
            String project=data.path("generationProjectId").asText(null);
            if(project!=null)run=runs.findByProjectIdAndClientRequestId(project,clientRequestId).filter(r->user.equals(r.getOwnerUserId())&&id.equals(r.getNodeId())).orElse(null);
        }
        if(run==null)return new com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.ReplaySelection(false,null);
        return new com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.ReplaySelection(true,StudioRunBilling.selection(run,om));
    }

    @Transactional public IpRunDto generate(String user,String id,LibraryGenerateRequest request) {
        var row=required(user,id,"object");var data=json(row);
        String project=data.path("generationProjectId").asText(null);
        if(project==null)project=data.path("sources").path(0).path("projectId").asText(null);
        if(project!=null)try{projects.required(user,project);}catch(BusinessException missing){project=null;}
        if(project==null)project=projects.create(user,new IpCreateProjectRequest("资产完善 · "+data.path("name").asText(),null)).id();
        // Same order as the existing workflow: project -> owner. Refresh after waiting for either lock.
        projects.requiredForUpdate(user,project);lock(user);entityManager.refresh(row);data=json(row);
        if(row.getDeletedAt()!=null)throw invalid("资产已删除");
        String prompt=text(data.path("prompt").asText(),4000,"生成提示词");String requestId=text(request.clientRequestId(),64,"请求编号");
        String previous=data.path("pendingRunId").asText();
        if(!previous.isBlank()) {
            var prior=runs.findByIdAndOwnerUserId(previous,user).orElse(null);
            if(prior!=null){var dto=projects.toRunDto(prior);if(requestId.equals(prior.getClientRequestId()))StudioRunBilling.requireSamePayer(prior,request.billing());else if("running".equals(dto.status()))throw conflict("这个资产正在生成，请确认原任务");}
        }
        var input=om.createObjectNode().put("clientRequestId",requestId).put("nodeId",id).put("operation","image").put("prompt",prompt)
                .put("count",1).put("aspectRatio",request.aspectRatio()).put("maxCost",request.maxCost()==null?-1:request.maxCost());
        if(request.model()!=null)input.put("model",request.model());
        String ref=data.path("referenceKey").asText();if(!ref.isBlank())input.putArray("references").addObject().put("storageKey",ref).put("role","frame");
        if(request.billing()!=null)input.set("billing",om.valueToTree(request.billing()));
        var run=workflow.submit(user,project,convert(input,RunRequest.class));
        data.put("pendingRunId",run.id()).put("generationProjectId",project);persist(row,data);return run;
    }
    /** Called independently of browser polling; the durable run is the retry receipt. */
    @Transactional public void collect(IpRun run) {
        lock(run.getOwnerUserId());String receipt="ILC-"+run.getId();if(records.existsById(receipt))return;
        // Structural control clips belong to the execution graph, not the user's finished-video library.
        if("studio-video-control".equals(run.getKind())) {
            if("done".equals(run.getStatus())||"failed".equals(run.getStatus()))persist(newRecord(run.getOwnerUserId(),"receipt",receipt),om.createObjectNode());
            return;
        }
        var dto=projects.toRunDto(run);var output=dto.output();String user=run.getOwnerUserId();
        var target=records.findByIdAndOwnerUserIdAndDeletedAtIsNull(run.getNodeId(),user).filter(r->"object".equals(r.getRecordType())).orElse(null);
        ObjectNode data=target==null?null:json(target);
        var p=om.createObjectNode();String title=run.getKind().contains("video")?"生成视频":run.getKind().contains("audio")?"生成配音":"生成素材";String folder=null;
        try {var project=projects.required(user,run.getProjectId());var doc=projects.readDoc(project);title=project.getName();folder=canvasFolder(user,run.getProjectId());if(folder==null)folder=doc.path("libraryFolderId").asText(null);var node=IpDocs.node(doc,run.getNodeId());if(node!=null)title=node.path("title").asText(title);}catch(BusinessException ignored){}
        if(data!=null){title=data.path("name").asText();folder=data.path("folderId").asText(null);}
        if(folder!=null&&!folder.isBlank()&&records.findByIdAndOwnerUserIdAndDeletedAtIsNull(folder,user).isEmpty())folder=null;
        int n=0;
        for(var candidate:output.path("candidates"))if(candidate.hasNonNull("key")) {
            String key=candidate.path("key").asText();var media=media("image",title+" · "+(++n),key,run,"AI 生成",folder,target==null?null:target.getId());
            saved.saveAutomatic(user,media);if(data!=null)addVersion(data,key,runPrompt(run),run.getId(),output.path("mock").asBoolean(),false);
        }
        Set<String> videoKeys=new HashSet<>();for(var candidate:output.path("videoCandidates"))if(candidate.hasNonNull("storageKey"))videoKeys.add(candidate.path("storageKey").asText());
        if(!videoKeys.isEmpty())for(String key:videoKeys)saved.saveAutomatic(user,media("video",title,key,run,"AI 生成",folder,null));
        else if(output.hasNonNull("storageKey")){String kind=run.getKind().contains("audio")?"audio":"video";saved.saveAutomatic(user,media(kind,title,output.path("storageKey").asText(),run,"AI 生成",folder,null));}
        String content=output.path("scriptRevision").path("markdown").asText(output.path("text").asText());
        if(output.hasNonNull("script")){var script=output.path("script");var b=new StringBuilder("# "+script.path("title").asText(title)+"\n\n## 故事大纲\n\n"+script.path("outline").asText()+"\n");
            String[] fields={"characters","scenes","props"},headings={"人物小传","场景设计","道具设计"};for(int i=0;i<fields.length;i++){b.append("\n## ").append(headings[i]).append("\n");for(var item:script.path(fields[i]))b.append("\n### ").append(item.path("name").asText()).append("\n\n").append(item.path("description").asText()).append("\n");}
            b.append("\n## 分集剧本\n");for(var episode:script.path("episodes"))b.append("\n### 第 ").append(episode.path("no").asInt()).append(" 集 · ").append(episode.path("title").asText()).append("\n\n").append(episode.path("content").asText()).append("\n");content=b.toString();}
        // 「视频裂变」找变量的结果是给页面用的清单，不是作品，不收进资产库。
        if(!content.isBlank()&&!"studio-asset-extract".equals(run.getKind())&&!sceneVariables(run)){var text=media("text",title,null,run,"AI 生成",folder,null);text.with("data").put("content",content);saved.saveAutomatic(user,text);}
        if(target!=null)persist(target,data);
        if(!"running".equals(dto.status()))persist(newRecord(user,"receipt",receipt),p);
    }
    public boolean collected(String runId){return records.existsById("ILC-"+runId);}
    private boolean sceneVariables(IpRun run) {
        try { return run.getInputJson()!=null&&om.readTree(run.getInputJson()).path("_exec").path("sceneVariables").asBoolean(false); }
        catch(Exception e) { return false; }
    }
    /** 导演台作品的哪些资产已经在资产库：assetId → 资产库对象 id。用户删掉的不算。 */
    public Map<String,String> directorLinks(String user,String workId) {
        var marker=records.findByIdAndOwnerUserIdAndDeletedAtIsNull(IpLibraryDirectorSync.MARKER+workId,user).orElse(null);
        if(marker==null)return Map.of();
        var links=new HashMap<String,String>();var assets=json(marker).path("assets");
        for(var it=assets.fields();it.hasNext();){var e=it.next();String object=e.getValue().path("objectId").asText();if(!object.isBlank())links.put(e.getKey(),object);}
        if(links.isEmpty())return Map.of();
        var live=new HashSet<>(records.liveIds(links.values(),user));links.values().removeIf(id->!live.contains(id));return links;
    }
    /** 一张已有的图存成角色、场景、道具，或加到已有的一项。文件不复制；同一个 clientRequestId 重复提交返回同一项。 */
    @Transactional public LibraryObject saveMedia(String user,SaveMediaRequest request) {
        lock(user);String requestId=text(request.clientRequestId(),64,"请求编号");
        String key=projects.requireOwnedAssetKey(user,request.storageKey());if(key==null)throw invalid("请选择一张图片");
        String bindingId="ILB-"+hash(user+"\0media\0"+requestId).substring(0,24);
        var binding=records.findByIdAndOwnerUserIdAndDeletedAtIsNull(bindingId,user).orElse(null);
        if(binding!=null)return wire(required(user,json(binding).path("objectId").asText(),"object"));
        requireImage(key);
        IpLibraryRecord row;ObjectNode data;
        if(request.objectId()!=null&&!request.objectId().isBlank()){row=required(user,request.objectId(),"object");data=json(row);}
        else{var item=new LibraryCandidate(requestId,request.kind(),request.name(),request.description()==null?"":request.description(),"",null);checkFolder(user,request.folderId());validateCandidate(item);
            // 没指定资产库时跟画布绑定的那个库走。
            String folder=request.folderId();if((folder==null||folder.isBlank())&&request.projectId()!=null&&!request.projectId().isBlank())folder=canvasFolder(user,request.projectId());
            row=newRecord(user,"object",null);data=baseObject(item,folder);}
        String prompt=saved.promptOf(user,"image",key);
        addVersion(data,key,prompt.length()>1000?prompt.substring(0,1000):prompt,null,false,false);
        var media=media("image",data.path("name").asText(),key,null,"Canvas",data.path("folderId").asText(null),row.getId());
        if(request.projectId()!=null&&!request.projectId().isBlank()){
            var project=projects.required(user,request.projectId());
            ((ArrayNode)data.path("sources")).addObject().put("id",bindingId).put("projectId",project.getId()).put("nodeId",request.nodeId()==null?"":request.nodeId()).put("title",project.getName()).put("evidence","").put("description","").put("origin","canvas");
            media.with("metadata").put("projectId",project.getId());if(request.nodeId()!=null)media.with("metadata").put("nodeId",request.nodeId());
        }
        persist(row,data);persist(newRecord(user,"binding",bindingId),om.createObjectNode().put("objectId",row.getId()));
        saved.saveAutomatic(user,media);return wire(row);
    }
    public String folderName(String user,String id){if(id==null||id.isBlank())return "未分类";return records.findByIdAndOwnerUserIdAndDeletedAtIsNull(id,user).map(r->json(r).path("name").asText()).orElse("未分类");}
    public void checkFolder(String user,String id){if(id!=null&&!id.isBlank())required(user,id,"folder");}
    private ObjectNode media(String kind,String title,String key,IpRun run,String source,String folder,String objectId) {
        var out=om.createObjectNode().put("kind",kind).put("title",title).put("source",source);var d=out.putObject("data");if(key!=null)d.put("storageKey",key);
        var m=out.putObject("metadata");if(folder!=null)m.put("folderId",folder);if(objectId!=null)m.put("objectId",objectId);
        if(run!=null)m.put("runId",run.getId()).put("projectId",run.getProjectId()).put("nodeId",run.getNodeId()).put("prompt",runPrompt(run));return out;
    }
    /**
     * 画布上做出来的新图（裁剪、拆图、抽帧）：上传和登记是同一个请求，断网或关页面不会出现「图在画布上、资产库里没有」。
     * 普通 {@code /uploads} 不登记，局部重绘的蒙版这类中间图也走它。登记失败只记日志，图照常返回，画布上的结果不受影响。
     */
    public com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpUploadResultDto uploadCanvasImage(String user,String project,org.springframework.web.multipart.MultipartFile file,String nodeId,String title,String prompt) {
        projects.required(user,project);
        var result=projects.upload(user,file);
        try {
            var asset=media("image",title==null||title.isBlank()?"画布图片":title,result.key(),null,"Canvas",canvasFolder(user,project),null);
            asset.with("metadata").put("projectId",project);
            if(nodeId!=null&&!nodeId.isBlank())asset.with("metadata").put("nodeId",nodeId);
            if(prompt!=null&&!prompt.isBlank())asset.with("metadata").put("prompt",prompt.length()>4000?prompt.substring(0,4000):prompt);
            if(result.width()!=null)asset.with("data").put("width",result.width());
            if(result.height()!=null)asset.with("data").put("height",result.height());
            saved.saveAutomatic(user,asset);
        } catch(RuntimeException e) {log.warn("[asset-library] canvas image not registered project={} key={} reason={}",project,result.key(),e.toString());}
        return result;
    }
    public void saveUpload(String user,StudioMediaImportService.MediaImportResult result,String folder){checkFolder(user,folder);saved.saveAutomatic(user,media(result.mediaType(),result.fileName(),result.key(),null,"用户上传",folder,null));}
    public String runPrompt(IpRun run){var input=projects.parseOrEmptyObject(run.getInputJson());return input.path("studioRequest").path("prompt").asText(input.path("userPrompt").asText(input.path("prompt").asText()));}
    static ObjectNode addVersion(ObjectNode data,String key,String prompt,String run,boolean mock,boolean main) {
        ArrayNode versions=(ArrayNode)data.path("versions");for(var v:versions)if(key.equals(v.path("storageKey").asText())){if(main)data.put("mainVersionId",v.path("id").asText());return (ObjectNode)v;}
        String id="ILV-"+hash(key).substring(0,20);var v=versions.addObject().put("id",id).put("storageKey",key).put("prompt",prompt).put("createdAt",Instant.now().toString()).put("mock",mock);if(run!=null)v.put("runId",run);
        if(main||!data.hasNonNull("mainVersionId"))data.put("mainVersionId",id);
        return v;
    }
    /** 删一张图（商品库的商品）。只从这一项里去掉，文件和已经加进导演台作品的快照不动；删的是主图时第一张顶上。 */
    private void removeVersion(ObjectNode data,String id){
        if(!"product".equals(data.path("kind").asText()))throw invalid("仅商品可删除图片");
        if(!hasVersion(data,id))throw invalid("这张图片已不存在，请刷新后重试");
        ArrayNode versions=(ArrayNode)data.path("versions");if(versions.size()<=1)throw invalid("至少保留一张商品图");
        for(int i=0;i<versions.size();i++)if(id.equals(versions.get(i).path("id").asText())){versions.remove(i);break;}
        if(id.equals(data.path("mainVersionId").asText()))data.put("mainVersionId",versions.get(0).path("id").asText());
    }
    private boolean hasVersion(ObjectNode data,String id){for(var v:data.path("versions"))if(id.equals(v.path("id").asText()))return true;return false;}
    private ObjectNode baseObject(LibraryCandidate item,String folder){var data=om.createObjectNode().put("kind",item.kind()).put("name",item.name()).put("description",item.description()).put("prompt",item.description());if(folder!=null&&!folder.isBlank())data.put("folderId",folder);data.putArray("versions");data.putArray("sources");return data;}
    private LibraryObject wire(IpLibraryRecord row) {
        var d=json(row);var versions=new ArrayList<LibraryVersion>();for(var v:d.path("versions"))versions.add(new LibraryVersion(v.path("id").asText(),v.path("storageKey").asText(),storage.signedUrl(v.path("storageKey").asText()),v.path("prompt").asText(),v.path("createdAt").asText(),v.path("runId").asText(null),v.path("mock").asBoolean(),v.path("label").asText(null)));
        var sources=new ArrayList<LibrarySource>();for(var s:d.path("sources"))sources.add(convert(s,LibrarySource.class));
        IpRunDto pending=null;String run=d.path("pendingRunId").asText();if(!run.isBlank())pending=runs.findByIdAndOwnerUserId(run,row.getOwnerUserId()).map(projects::toRunDto).orElse(null);
        String reference=d.path("referenceKey").asText(null);
        return new LibraryObject(row.getId(),d.path("kind").asText(),d.path("name").asText(),d.path("description").asText(),d.path("prompt").asText(),d.path("folderId").asText(null),reference,reference==null?null:storage.signedUrl(reference),d.path("mainVersionId").asText(null),versions,sources,pending,row.getCreatedAt().toString(),row.getUpdatedAt().toString());
    }
    private static String sourceText(JsonNode node){var md=node.path("metadata");String text=md.path("studio").path("scriptEditor").path("draft").asText(md.path("studio").path("scriptMarkdown").asText(md.path("content").asText()));if(text.isBlank())throw invalid("请先保存有内容的剧本");return bounded(text,48000);}
    private List<IpLibraryRecord> rows(String user,String type){return records.findByOwnerUserIdAndRecordTypeAndDeletedAtIsNullOrderByCreatedAtDesc(user,type);}
    private IpLibraryRecord required(String user,String id,String type){return records.findByIdAndOwnerUserIdAndDeletedAtIsNull(id,user).filter(r->type.equals(r.getRecordType())).orElseThrow(()->BusinessException.notFound("IP_LIBRARY_NOT_FOUND","资产或文件夹不存在"));}
    private IpLibraryRecord newRecord(String user,String type,String id){var now=Instant.now();return IpLibraryRecord.builder().id(id==null?"ILO-"+UUID.randomUUID().toString().replace("-","").substring(0,24):id).ownerUserId(user).recordType(type).createdAt(now).updatedAt(now).build();}
    private void persist(IpLibraryRecord row,ObjectNode data){row.setPayloadJson(data.toString());row.setUpdatedAt(Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS));records.save(row);}
    private ObjectNode json(IpLibraryRecord row){try{return (ObjectNode)om.readTree(row.getPayloadJson());}catch(Exception e){throw new IllegalStateException(e);}}
    private <T>T convert(JsonNode data,Class<T> type){try{return om.treeToValue(data,type);}catch(Exception e){throw new IllegalStateException(e);}}
    private void lock(String user){users.findByIdForUpdate(user).orElseThrow(()->BusinessException.notFound("USER_NOT_FOUND","账号不存在"));}
    private void requireImage(String key){try(var in=java.nio.file.Files.newInputStream(storage.openForRead(key))){if(com.aistareco.aep.service.storage.MediaBytes.sniff("image",in.readNBytes(64))==null)throw invalid("请使用可读取的图片素材");}catch(BusinessException e){throw e;}catch(Exception e){throw invalid("图片已不可用，请重新上传");}}
    private void validateCandidate(LibraryCandidate item){if(item==null||!Set.of("character","scene","prop","product").contains(item.kind()))throw invalid("请选择角色、场景、道具或商品");text(item.key(),180,"条目标识");text(item.name(),128,"资产名称");bounded(item.description(),2000);bounded(item.evidence(),2000);}
    private static String text(String value,int max,String label){if(value==null||value.isBlank()||value.length()>max)throw invalid(label+"不能为空，最多 "+max+" 字");return value.strip();}
    private static String bounded(String value,int max){if(value==null||value.length()>max)throw invalid("内容超过长度限制");return value;}
    static String hash(String text){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private static <T>LibraryPage<T> page(List<T> list,int page){if(page<0||page>100000)throw invalid("页码无效");int start=Math.min(list.size(),page*24),end=Math.min(list.size(),start+24);return new LibraryPage<>(list.subList(start,end),page,list.size(),end<list.size());}
    private static BusinessException invalid(String message){return BusinessException.badRequest("IP_LIBRARY_INVALID",message);}
    private static BusinessException conflict(String message){return new BusinessException(org.springframework.http.HttpStatus.CONFLICT,"IP_LIBRARY_CHANGED",message);}
}
