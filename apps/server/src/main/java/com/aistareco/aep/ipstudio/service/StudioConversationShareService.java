package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.ipstudio.repository.*;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;

/** Free explicit text snapshots. Never serializes raw metadata, assets, execution requests or credentials. */
@Service
public class StudioConversationShareService {
    public record Share(String token,String path,Instant createdAt) {}
    public record Preview(JsonNode snapshot,String snapshotHash,Share share) {}
    public record PublicView(JsonNode snapshot,Instant createdAt) {}
    public record CreateRequest(String snapshotHash) {}
    public record CopyRequest(String clientRequestId) {}
    private final IpProjectService projects;
    private final IpConversationShareRepository shares;
    private final IpConversationCopyRepository copies;
    private final ObjectMapper om;
    private final SecureRandom random=new SecureRandom();
    public StudioConversationShareService(IpProjectService projects,IpConversationShareRepository shares,IpConversationCopyRepository copies,ObjectMapper om) {
        this.projects=projects;this.shares=shares;this.copies=copies;this.om=om;
    }
    @Transactional(readOnly=true)
    public Preview preview(String owner,String projectId,String nodeId) {
        var p=projects.required(owner,projectId);
        var snapshot=snapshot(projects.readDoc(p),nodeId);
        var active=shares.findByProjectIdAndNodeIdAndRevokedAtIsNullOrderByCreatedAtDesc(projectId,nodeId);
        return new Preview(snapshot,hash(snapshot),active.isEmpty()?null:wire(active.get(0)));
    }
    @Transactional
    public Share create(String owner,String projectId,String nodeId,CreateRequest request) {
        var p=projects.requiredForUpdate(owner,projectId);
        var snapshot=snapshot(projects.readDoc(p),nodeId);var hash=hash(snapshot);
        if(request==null||!hash.equals(request.snapshotHash()))throw new BusinessException(org.springframework.http.HttpStatus.CONFLICT,"STUDIO_SHARE_CHANGED","对话已有修改，请重新预览后创建链接");
        var active=shares.findByProjectIdAndNodeIdAndRevokedAtIsNullOrderByCreatedAtDesc(projectId,nodeId);
        // Replaying the same approved snapshot returns its original link, including after a transport timeout.
        if(!active.isEmpty()&&hash.equals(active.get(0).getSnapshotHash()))return wire(active.get(0));
        var now=Instant.now();active.forEach(s->s.setRevokedAt(now));shares.saveAll(active);
        byte[] bytes=new byte[24];random.nextBytes(bytes);
        var s=IpConversationShare.builder().token(Base64.getUrlEncoder().withoutPadding().encodeToString(bytes))
            .ownerUserId(owner).projectId(projectId).nodeId(nodeId).snapshotHash(hash).snapshotJson(write(snapshot)).createdAt(now).build();
        return wire(shares.save(s));
    }
    @Transactional
    public void revoke(String owner,String projectId,String nodeId,String token) {
        projects.requiredForUpdate(owner,projectId);
        var s=shares.lock(token).filter(v->owner.equals(v.getOwnerUserId())&&projectId.equals(v.getProjectId())&&nodeId.equals(v.getNodeId()))
            .orElseThrow(()->missing());
        if(s.getRevokedAt()==null){s.setRevokedAt(Instant.now());shares.save(s);}
    }
    @Transactional(readOnly=true)
    public PublicView read(String token) { var s=required(token,false);return new PublicView(parse(s.getSnapshotJson()),s.getCreatedAt()); }
    @Transactional
    public String copy(String owner,String token,CopyRequest request) {
        if(request==null||request.clientRequestId()==null||!request.clientRequestId().matches("[A-Za-z0-9_-]{8,128}"))
            throw BusinessException.badRequest("STUDIO_SHARE_COPY_INVALID","复制请求缺少有效标识，请刷新后重试");
        // A lock on the snapshot serializes copy/revoke and repeated copies of this exact link.
        var s=shares.lock(token).orElseThrow(()->missing());
        var prior=copies.findByOwnerUserIdAndClientRequestId(owner,request.clientRequestId());
        if(prior.isPresent()) {
            if(!token.equals(prior.get().getToken()))throw new BusinessException(org.springframework.http.HttpStatus.CONFLICT,"STUDIO_SHARE_COPY_CONFLICT","该请求已用于另一份对话");
            projects.required(owner,prior.get().getProjectId());return prior.get().getProjectId();
        }
        requireLive(s);
        var snapshot=parse(s.getSnapshotJson());
        var p=projects.create(owner,new IpCreateProjectRequest(snapshot.path("title").asText()+" · 继续创作",null));
        var doc=IpDocs.emptyDoc(om);var node=doc.withArray("nodes").addObject();
        node.put("id","conversation-"+UUID.randomUUID().toString().replace("-","").substring(0,16));node.put("type","text");node.put("title",snapshot.path("title").asText());
        node.putObject("position").put("x",80).put("y",80);node.put("width",420).put("height",300);
        var meta=node.putObject("metadata");meta.put("status","idle");meta.put("studioStart","assistant");
        var studio=meta.putObject("studio");studio.put("kind","assistant");
        var conversation=studio.putObject("conversation");conversation.set("mode",snapshot.path("mode"));conversation.set("turns",snapshot.path("turns"));
        if(snapshot.has("plan"))conversation.set("plan",snapshot.path("plan"));
        // No source key, media/node binding, request, run ID or model is copied. A later action needs new references and explicit confirmation.
        projects.update(owner,p.id(),new IpUpdateProjectRequest(null,doc));
        copies.save(IpConversationCopy.builder().id(UUID.randomUUID().toString().replace("-",""))
            .ownerUserId(owner).clientRequestId(request.clientRequestId()).token(token).projectId(p.id()).build());
        return p.id();
    }
    private IpConversationShare required(String token,boolean lock) {
        if(token==null||!token.matches("[A-Za-z0-9_-]{32}"))throw missing();
        var s=(lock?shares.lock(token):shares.findById(token)).orElseThrow(()->missing());requireLive(s);return s;
    }
    private void requireLive(IpConversationShare s) {
        if(s.getRevokedAt()!=null)throw missing();
        // Deleting the source canvas also closes access, even when the snapshot row still exists.
        try { projects.required(s.getOwnerUserId(),s.getProjectId()); }
        catch(BusinessException e) { if("IP_PROJECT_NOT_FOUND".equals(e.getCode()))throw missing();throw e; }
    }
    private static BusinessException missing(){return BusinessException.notFound("STUDIO_SHARE_NOT_FOUND","分享链接已失效，或分享者已撤销");}
    private Share wire(IpConversationShare s){return new Share(s.getToken(),"/shared/conversations/"+s.getToken(),s.getCreatedAt());}
    private String write(JsonNode json){try{return om.writeValueAsString(json);}catch(Exception e){throw new IllegalStateException(e);}}
    private JsonNode parse(String json){try{return om.readTree(json);}catch(Exception e){throw new IllegalStateException(e);}}
    private String hash(JsonNode json){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(write(json).getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    /** Only the visible text and authored suggestions cross the publication boundary. Bounds reject rather than silently truncate the approved content. */
    ObjectNode snapshot(JsonNode doc,String nodeId) {
        var node=IpDocs.node(doc,nodeId);var meta=node==null?om.createObjectNode():node.path("metadata");
        var c=meta.path("studio").path("conversation");var turns=c.path("turns");var mode=c.path("mode").asText();
        if(!"assistant".equals(meta.path("studio").path("kind").asText())||"loading".equals(meta.path("status").asText())||!Set.of("general","original","adapt","director").contains(mode)
            ||!turns.isArray()||turns.size()<2||turns.size()>16||!"assistant".equals(turns.get(turns.size()-1).path("role").asText()))
            throw BusinessException.badRequest("STUDIO_SHARE_NOT_READY","请先完成一轮对话，再分享");
        var out=om.createObjectNode();out.put("title",text(node,"title",128));out.put("mode",mode);var target=out.putArray("turns");
        boolean user=false;
        for(var t:turns){var role=t.path("role").asText();if(!Set.of("user","assistant").contains(role))throw invalid();user|="user".equals(role);target.addObject().put("role",role).put("content",text(t,"content",24000));}
        if(!user)throw invalid();
        var p=c.path("plan");if(p.isObject()) {
            var plan=out.putObject("plan");plan.put("summary",text(p,"summary",4000));texts(p,"notes",plan,8);texts(p,"questions",plan,8);
            var steps=p.path("steps");if(!steps.isArray()||steps.size()>12)throw invalid();var dest=plan.putArray("steps");int i=0;
            for(var step:steps){var op=step.path("operation").asText();if(!Set.of("script","storyboard","image","video").contains(op))throw invalid();
                var item=dest.addObject();item.put("id","shared-step-"+(++i));item.put("operation",op);item.put("title",text(step,"title",128));item.put("prompt",text(step,"prompt",4000));item.putArray("referenceNodeIds");
                // Source bindings cannot authorize assets in the recipient's account.
                var unresolved=item.putArray("unresolvedReferences");if(step.path("referenceNodeIds").size()>0||step.path("unresolvedReferences").size()>0)unresolved.add("请在自己的画布重新选择参考素材");
            }
        }
        if(write(out).getBytes(StandardCharsets.UTF_8).length>256*1024)throw invalid();return out;
    }
    private void texts(JsonNode src,String field,ObjectNode dst,int max) {
        var a=src.path(field);var out=dst.putArray(field);if(a.isMissingNode())return;
        if(!a.isArray()||a.size()>max)throw invalid();for(var t:a){if(!t.isTextual()||t.asText().length()>4000)throw invalid();out.add(t.asText());}
    }
    private String text(JsonNode src,String field,int max){var t=src.path(field);if(!t.isTextual()||t.asText().isBlank()||t.asText().length()>max)throw invalid();return t.asText();}
    private static BusinessException invalid(){return BusinessException.badRequest("STUDIO_SHARE_CONTENT_INVALID","对话内容无法分享，请检查完整性和长度后重试");}
}
