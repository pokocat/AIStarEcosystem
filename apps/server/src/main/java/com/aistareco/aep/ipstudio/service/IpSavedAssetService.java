package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.ipstudio.model.IpSavedAsset;
import com.aistareco.aep.ipstudio.repository.IpSavedAssetRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
@Service
public class IpSavedAssetService {
    private final IpSavedAssetRepository repo;
    private final IpProjectService projects;
    private final ObjectMapper om;
    private final com.aistareco.aep.repository.AepUserRepository users;
    public IpSavedAssetService(IpSavedAssetRepository repo,IpProjectService projects,ObjectMapper om,com.aistareco.aep.repository.AepUserRepository users) {
        this.repo=repo;this.projects=projects;this.om=om;this.users=users;
    }
    public List<JsonNode> list(String user) {
        return repo.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user).stream().map(r -> wire(r,user)).toList();
    }
    @Transactional public JsonNode save(String user,JsonNode request) {return saveInternal(user,request,false);}
    @Transactional public JsonNode saveAutomatic(String user,JsonNode request) {return saveInternal(user,request,true);}
    private JsonNode saveInternal(String user,JsonNode request,boolean automatic) {
        if(request==null || !request.isObject()) throw invalid();
        String kind=request.path("kind").asText();
        if(!Set.of("image","video","audio","text").contains(kind)) throw invalid();
        JsonNode source=request.path("data");
        String value = "text".equals(kind) ? source.path("content").asText("").trim() : source.path("storageKey").asText("").trim();
        if(value.isBlank() || value.length()>100000 || (!"text".equals(kind) && value.length()>512)) throw invalid();
        if(!"text".equals(kind)) projects.requireOwnedAssetKey(user,value);
        // Rebuild the payload; no client URLs, ids, timestamps, or unbounded nested metadata enter storage.
        ObjectNode payload=om.createObjectNode();
        payload.put("kind",kind);payload.put("title",request.path("title").asText("画布素材").substring(0,Math.min(128,request.path("title").asText("画布素材").length())));
        payload.set("tags",om.createArrayNode());payload.put("source",automatic?request.path("source").asText("AI 生成"):"Canvas");payload.put("coverUrl","");
        ObjectNode data=payload.putObject("data");
        if("text".equals(kind)) data.put("content",value);
        else {
            data.put("storageKey",value);
            for(String field:List.of("width","height","bytes")) data.put(field,Math.max(0,source.path(field).asLong(0)));
            String mime=source.path("mimeType").asText("");
            if(mime.length()>100) throw invalid();
            data.put("mimeType",mime);
        }
        ObjectNode meta=payload.putObject("metadata");
        String prompt=request.path("metadata").path("prompt").asText("");
        if(prompt.length()>100000) throw invalid();
        meta.put("prompt",prompt);
        if(automatic)for(String field:List.of("folderId","objectId","runId","projectId","nodeId")) {
            String valueField=request.path("metadata").path(field).asText(null);
            if(valueField!=null&&valueField.length()<=128)meta.put(field,valueField);
        }
        String id;
        try {
            id="IPA-"+HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((user+"\0"+kind+"\0"+value).getBytes(StandardCharsets.UTF_8))).substring(0,28);
        } catch(Exception e) {throw new IllegalStateException(e);}
        lockOwner(user);
        var existing=repo.findById(id);
        var row=existing.orElseGet(() -> IpSavedAsset.builder().id(id).ownerUserId(user).createdAt(Instant.now()).build());
        // A deleted asset can be saved again. Existing identical content is idempotent.
        // Automatic backfill must respect an explicit deletion, including after process restart.
        if(existing.isPresent() && (row.getDeletedAt()==null || automatic)) {
            if(automatic&&row.getDeletedAt()==null){
                try{ObjectNode old=(ObjectNode)om.readTree(row.getPayloadJson());ObjectNode oldMeta=old.with("metadata");
                    // Enrich provenance once; repeated collectors never undo manual folder moves or edits.
                    for(String field:List.of("folderId","objectId","runId","projectId","nodeId","prompt"))if(!(field.equals("folderId")&&oldMeta.path("folderAssigned").asBoolean())&&(!oldMeta.hasNonNull(field)||oldMeta.path(field).asText().isBlank()))if(meta.hasNonNull(field)&&!meta.path(field).asText().isBlank())oldMeta.set(field,meta.get(field));
                    row.setPayloadJson(old.toString());repo.save(row);
                }catch(Exception e){throw new IllegalStateException(e);}
            }
            return safeWire(row,user);
        }
        row.setDeletedAt(null);row.setPayloadJson(payload.toString());repo.save(row);
        return wire(row,user);
    }
    /** 来源筛选：generated = AI 生成（各处出图出片自动收进来的），upload = 用户上传，canvas = 从画布手动存的。资产页「AI 生成」库 = generated + 未放进资产库（2026-10-31）。 */
    static final java.util.Map<String,String> SOURCES=java.util.Map.of("generated","AI 生成","upload","用户上传","canvas","Canvas");
    public com.aistareco.aep.ipstudio.dto.IpLibraryDtos.LibraryPage<JsonNode> page(String user,String folder,String query,String kind,String source,int page) {
        if(page<0||page>100000)throw invalid();
        if(source!=null&&!source.equals("all")&&!SOURCES.containsKey(source))throw BusinessException.badRequest("IP_ASSET_INVALID","素材来源不正确");
        String wanted=source==null||source.equals("all")?null:SOURCES.get(source);
        var rows=repo.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user).stream().filter(row->{
            try {var data=om.readTree(row.getPayloadJson());readableTitle((ObjectNode)data);String f=data.path("metadata").path("folderId").asText();
                return (folder==null||folder.isBlank()||folder.equals("all")||(folder.equals("unfiled")?f.isBlank():folder.equals(f)))
                    &&(kind==null||kind.equals("all")||kind.equals(data.path("kind").asText()))
                    &&(wanted==null||wanted.equals(data.path("source").asText()))
                    &&(query==null||(data.path("title").asText()+" "+data.path("source").asText()+" "+data.path("metadata").path("prompt").asText()).toLowerCase(java.util.Locale.ROOT).contains(query.toLowerCase(java.util.Locale.ROOT)));
            }catch(Exception e){return false;}
        }).toList();
        int start=Math.min(rows.size(),page*24),end=Math.min(rows.size(),start+24);
        return new com.aistareco.aep.ipstudio.dto.IpLibraryDtos.LibraryPage<>(rows.subList(start,end).stream().map(r->safeWire(r,user)).toList(),page,rows.size(),end<rows.size());
    }
    @Transactional public JsonNode edit(String user,String id,JsonNode body) {
        lockOwner(user);var row=repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id,user).orElseThrow(()->BusinessException.notFound("IP_ASSET_NOT_FOUND","素材不存在"));
        try {ObjectNode data=(ObjectNode)om.readTree(row.getPayloadJson());
            if(body.has("title")){String title=body.path("title").asText().strip();if(title.isBlank()||title.length()>128)throw invalid();data.put("title",title);data.with("metadata").put("titleAssigned",true);}
            if(body.has("folderId")){var meta=data.with("metadata").put("folderAssigned",true);String folder=body.path("folderId").asText(null);if(folder==null||folder.isBlank())meta.remove("folderId");else meta.put("folderId",folder);}
            row.setPayloadJson(data.toString());repo.save(row);return safeWire(row,user);
        }catch(BusinessException e){throw e;}catch(Exception e){throw new IllegalStateException(e);}
    }
    @Transactional public void clearFolder(String user,String folder){for(var row:repo.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user))try{ObjectNode data=(ObjectNode)om.readTree(row.getPayloadJson());if(folder.equals(data.path("metadata").path("folderId").asText())){data.with("metadata").remove("folderId");row.setPayloadJson(data.toString());repo.save(row);}}catch(Exception e){throw new IllegalStateException(e);}}
    private JsonNode safeWire(IpSavedAsset row,String user){try{return wire(row,user);}catch(BusinessException e){try{ObjectNode data=(ObjectNode)om.readTree(row.getPayloadJson());data.put("id",row.getId()).put("createdAt",row.getCreatedAt().toString()).put("updatedAt",row.getCreatedAt().toString());readableTitle(data);data.with("metadata").put("unavailable",true);data.with("data").put("url","").put("dataUrl","");return data;}catch(Exception ignored){throw e;}}}
    @Transactional public void remove(String user,String id) {
        lockOwner(user);
        var r=repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id,user).orElseThrow(() -> BusinessException.notFound("IP_ASSET_NOT_FOUND","这个素材不存在"));
        r.setDeletedAt(Instant.now());repo.save(r);
        // References are shared by documents and generation history: removing a saved entry never deletes the object.
    }
    private JsonNode wire(IpSavedAsset row,String user) {
        try {
            ObjectNode out=(ObjectNode)om.readTree(row.getPayloadJson());readableTitle(out);
            out.put("id",row.getId());out.put("createdAt",row.getCreatedAt().toString());out.put("updatedAt",row.getCreatedAt().toString());
            if(!"text".equals(out.path("kind").asText())) {
                String key=out.path("data").path("storageKey").asText();
                String url=projects.signOwnedKeys(user,List.of(key)).get(key);
                if(url==null || url.isBlank()) throw BusinessException.badRequest("IP_ASSET_UNAVAILABLE","素材地址暂时无法读取，请重试");
                ((ObjectNode)out.path("data")).put("image".equals(out.path("kind").asText())?"dataUrl":"url",url);
                if("image".equals(out.path("kind").asText())) out.put("coverUrl",url);
            }
            return out;
        } catch(BusinessException e) {throw e;}
        catch(Exception e) {throw new IllegalStateException("Saved asset payload is invalid",e);}
    }
    /** Only normalize this collector's machine fallback, never a title supplied by a user. */
    private static void readableTitle(ObjectNode out) {
        var meta=out.path("metadata");String run=meta.path("runId").asText(),title=out.path("title").asText();
        if(meta.path("titleAssigned").asBoolean()||!"AI 生成".equals(out.path("source").asText())||!run.startsWith("IPR-"))return;
        if(!title.matches("[a-z-]+ · "+java.util.regex.Pattern.quote(run)+"(?: · [0-9]+)?"))return;
        String label=switch(out.path("kind").asText()){case "image"->"生成图片";case "video"->"生成视频";case "audio"->"生成配音";default->"生成文本";};
        out.put("title",label+title.substring(title.indexOf(run)+run.length()));
    }
    private void lockOwner(String user) {
        users.findByIdForUpdate(user).orElseThrow(() -> BusinessException.notFound("USER_NOT_FOUND","账号不存在"));
    }
    private BusinessException invalid() {return BusinessException.badRequest("IP_ASSET_INVALID","请提供有效的图片、视频、音频或文本素材");}
}
