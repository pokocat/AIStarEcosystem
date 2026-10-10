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
    @Transactional public JsonNode save(String user,JsonNode request) {
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
        payload.set("tags",om.createArrayNode());payload.put("source","Canvas");payload.put("coverUrl","");
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
        String id;
        try {
            id="IPA-"+HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((user+"\0"+kind+"\0"+value).getBytes(StandardCharsets.UTF_8))).substring(0,28);
        } catch(Exception e) {throw new IllegalStateException(e);}
        lockOwner(user);
        var existing=repo.findById(id);
        var row=existing.orElseGet(() -> IpSavedAsset.builder().id(id).ownerUserId(user).createdAt(Instant.now()).build());
        // A deleted asset can be saved again. Existing identical content is idempotent.
        if(existing.isPresent() && row.getDeletedAt()==null) return wire(row,user);
        row.setDeletedAt(null);row.setPayloadJson(payload.toString());repo.save(row);
        return wire(row,user);
    }
    @Transactional public void remove(String user,String id) {
        lockOwner(user);
        var r=repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id,user).orElseThrow(() -> BusinessException.notFound("IP_ASSET_NOT_FOUND","这个素材不存在"));
        r.setDeletedAt(Instant.now());repo.save(r);
        // References are shared by documents and generation history: removing a saved entry never deletes the object.
    }
    private JsonNode wire(IpSavedAsset row,String user) {
        try {
            ObjectNode out=(ObjectNode)om.readTree(row.getPayloadJson());
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
    private void lockOwner(String user) {
        users.findByIdForUpdate(user).orElseThrow(() -> BusinessException.notFound("USER_NOT_FOUND","账号不存在"));
    }
    private BusinessException invalid() {return BusinessException.badRequest("IP_ASSET_INVALID","请提供有效的图片、视频、音频或文本素材");}
}
