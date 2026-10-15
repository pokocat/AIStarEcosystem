package com.aistareco.aep.enterprise.service;

import com.aistareco.aep.enterprise.dto.EnterpriseDtos;
import com.aistareco.aep.enterprise.model.*;
import com.aistareco.aep.enterprise.repository.*;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;

@Service
public class EnterpriseService {
    private final EnterpriseRepository enterprises;
    private final EnterpriseMemberRepository members;
    private final EnterpriseCurrentMembershipRepository current;
    private final EnterpriseInvitationRepository invitations;
    private final EnterprisePolicyRepository policies;
    private final EnterpriseOwnershipTransferRepository transfers;
    private final EnterpriseAuditRepository audits;
    private final EnterpriseAccessService access;
    private final AepUserRepository users;
    private final AiModelEndpointRepository endpoints;
    private final CreditService credits;
    private final ObjectMapper mapper;
    private final jakarta.persistence.EntityManager entityManager;
    private final SecureRandom random=new SecureRandom();
    public EnterpriseService(EnterpriseRepository enterprises,EnterpriseMemberRepository members,
            EnterpriseCurrentMembershipRepository current,EnterpriseInvitationRepository invitations,
            EnterprisePolicyRepository policies,EnterpriseOwnershipTransferRepository transfers,
            EnterpriseAuditRepository audits,EnterpriseAccessService access,AepUserRepository users,
            AiModelEndpointRepository endpoints,CreditService credits,ObjectMapper mapper,jakarta.persistence.EntityManager entityManager) {
        this.enterprises=enterprises;this.members=members;this.current=current;this.invitations=invitations;
        this.policies=policies;this.transfers=transfers;this.audits=audits;this.access=access;this.users=users;
        this.endpoints=endpoints;this.credits=credits;this.mapper=mapper;this.entityManager=entityManager;
    }
    @Transactional
    public EnterpriseDtos.Context create(String actor,EnterpriseDtos.CreateRequest request) {
        access.requireUser(actor);
        String name=text(request==null?null:request.name(),128),key=text(request==null?null:request.clientRequestId(),64);
        // Lock the natural person's local row before any enterprise row in create/accept flows.
        users.findByIdForUpdate(actor).orElseThrow();
        var old=enterprises.findByCreatedByAndCreateRequestId(actor,key);
        if(old.isPresent()) {
            if(!name.equals(old.get().getName())) throw conflict("ENTERPRISE_REQUEST_CONFLICT","同一请求不能更改企业名称");
            return context(actor,old.get().getId());
        }
        if(current.findCurrentForUpdate(actor).isPresent())throw conflict("ENTERPRISE_ALREADY_JOINED","请先退出当前企业");
        var e=new Enterprise();e.setId(id());e.setName(name);e.setOwnerUserId(actor);e.setStatus("active");e.setCreateRequestId(key);e.setCreatedBy(actor);
        e.setCreatedAt(Instant.now());e.setUpdatedAt(e.getCreatedAt());enterprises.saveAndFlush(e);
        join(e,actor);
        var p=new EnterprisePolicy();p.setEnterpriseId(e.getId());p.setAllowedEndpointIdsJson("[]");p.setMaxActiveJobs(1);policies.save(p);
        credits.openEnterpriseWallet(e.getId(),null);
        audit(actor,e.getId(),"enterprise.create",e.getId(),"创建企业");
        return context(actor,e.getId());
    }
    @Transactional(readOnly=true)
    public List<EnterpriseDtos.Context> mine(String actor) {
        access.requireUser(actor);
        return current.findById(actor).map(c->List.of(context(actor,c.getEnterpriseId()))).orElse(List.of());
    }
    @Transactional(readOnly=true)
    public EnterpriseDtos.Context context(String actor,String enterpriseId) {
        var m=access.readMember(actor,enterpriseId);var e=enterprises.findById(enterpriseId).orElseThrow();
        return new EnterpriseDtos.Context(dto(e),dto(e,m),access.permissions(e,m));
    }
    @Transactional(readOnly=true)
    public Page<EnterpriseDtos.Member> members(String actor,String enterpriseId,int page,int limit) {
        access.require(actor,enterpriseId,"member.manage");var e=enterprises.findById(enterpriseId).orElseThrow();
        var rows=members.findByEnterpriseIdAndStatusNotOrderByJoinedAtAsc(enterpriseId,"removed",paging(page,limit));
        var names=new java.util.HashMap<String,com.aistareco.aep.model.AepUser>();
        users.findAllById(rows.stream().map(EnterpriseMember::getUserId).toList()).forEach(u->names.put(u.getId(),u));
        return rows.map(m->dto(e,m,names.get(m.getUserId())));
    }
    @Transactional
    public EnterpriseDtos.InvitationCreated invite(String actor,String enterpriseId,EnterpriseDtos.InvitationRequest request) {
        var e=lock(enterpriseId);access.require(actor,enterpriseId,"member.invite");
        String key=text(request==null?null:request.clientRequestId(),64);
        var old=invitations.findByEnterpriseIdAndCreatedByAndClientRequestId(enterpriseId,actor,key);
        if(old.isPresent())return new EnterpriseDtos.InvitationCreated(dto(old.get()),null);
        byte[] bytes=new byte[32];random.nextBytes(bytes);String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        var invite=new EnterpriseInvitation();invite.setId(id());invite.setEnterpriseId(e.getId());invite.setCreatedBy(actor);
        invite.setClientRequestId(key);invite.setTokenHash(hash(token));invite.setStatus("pending");
        invite.setCreatedAt(Instant.now());invite.setExpiresAt(invite.getCreatedAt().plus(Duration.ofDays(3)));invitations.save(invite);
        audit(actor,enterpriseId,"member.invite",invite.getId(),"创建成员邀请");
        return new EnterpriseDtos.InvitationCreated(dto(invite),token);
    }
    @Transactional
    public EnterpriseDtos.Context accept(String actor,EnterpriseDtos.AcceptRequest request) {
        access.requireUser(actor);String hash=hash(text(request==null?null:request.token(),256));
        users.findByIdForUpdate(actor).orElseThrow();
        var snapshot=invitations.findByTokenHash(hash).orElseThrow(()->invalidInvite());
        var e=lock(snapshot.getEnterpriseId());
        // Reload after the enterprise lock: a different user may have accepted or revoked this link.
        var invite=invitations.findByTokenHash(hash).orElseThrow(()->invalidInvite());
        entityManager.refresh(invite,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if("accepted".equals(invite.getStatus()) && actor.equals(invite.getAcceptedBy()))return context(actor,e.getId());
        if(!"pending".equals(invite.getStatus()) || !invite.getExpiresAt().isAfter(Instant.now()))throw invalidInvite();
        access.require(invite.getCreatedBy(),e.getId(),"member.invite");
        if(current.findCurrentForUpdate(actor).isPresent())throw conflict("ENTERPRISE_ALREADY_JOINED","请先退出当前企业");
        join(e,actor);invite.setStatus("accepted");invite.setAcceptedBy(actor);invitations.save(invite);
        audit(actor,e.getId(),"member.accept",invite.getId(),"接受企业邀请");
        return context(actor,e.getId());
    }
    @Transactional
    public EnterpriseDtos.Invitation revoke(String actor,String enterpriseId,String inviteId) {
        lock(enterpriseId);access.require(actor,enterpriseId,"member.invite");
        var invite=invitations.findById(inviteId).filter(i->enterpriseId.equals(i.getEnterpriseId())).orElseThrow(()->invalidInvite());
        if(!"pending".equals(invite.getStatus()) && !"revoked".equals(invite.getStatus()))throw conflict("ENTERPRISE_INVITATION_USED","邀请已被使用");
        invite.setStatus("revoked");invitations.save(invite);audit(actor,enterpriseId,"member.invite.revoke",inviteId,"撤销邀请");return dto(invite);
    }
    @Transactional
    public EnterpriseDtos.Member updateMember(String actor,String enterpriseId,String memberId,EnterpriseDtos.MemberUpdate request) {
        var e=lock(enterpriseId);access.require(actor,enterpriseId,"member.role.manage");
        var target=access.requireOrdinaryTarget(actor,enterpriseId,memberId);
        if(request==null || request.capabilities()==null || request.role()==null || !Set.of("manager","member").contains(request.role()))throw bad("角色或能力无效");
        if(target.getVersion()!=request.version())throw conflict("ENTERPRISE_VERSION_CONFLICT","成员权限已变化，请刷新");
        if("member".equals(request.role())&&(request.capabilities().pointsManage()||request.capabilities().billingRead()))throw bad("普通成员不能获得管理权限");
        String before=target.getRole()+":"+target.isPointsManage()+":"+target.isBillingRead()+":"+target.isRechargeRequest();
        target.setRole(request.role());target.setPointsManage(request.capabilities().pointsManage());
        target.setBillingRead(request.capabilities().billingRead());target.setRechargeRequest(request.capabilities().rechargeRequest());members.saveAndFlush(target);
        audit(actor,enterpriseId,"member.permissions",memberId,before+" -> "+target.getRole()+":"+target.isPointsManage()+":"+target.isBillingRead()+":"+target.isRechargeRequest());
        return dto(e,target);
    }
    @Transactional(readOnly=true)
    public EnterpriseDtos.Policy policy(String actor,String enterpriseId) {
        access.readMember(actor,enterpriseId);return dto(policies.findById(enterpriseId).orElseThrow());
    }
    @Transactional(readOnly=true)
    public Page<EnterpriseDtos.Invitation> invitations(String actor,String enterpriseId,int page,int limit) {
        access.require(actor,enterpriseId,"member.invite");return invitations.findByEnterpriseIdOrderByCreatedAtDesc(enterpriseId,paging(page,limit)).map(this::dto);
    }
    @Transactional(readOnly=true)
    public Page<EnterpriseDtos.OwnershipTransfer> ownershipTransfers(String actor,String enterpriseId,int page,int limit) {
        var self=access.readMember(actor,enterpriseId);var e=enterprises.findById(enterpriseId).orElseThrow();
        var result=transfers.findByEnterpriseIdOrderByExpiresAtDesc(enterpriseId,paging(page,limit));
        if(!actor.equals(e.getOwnerUserId())) {
            var own=entityManager.createQuery("select t from EnterpriseOwnershipTransfer t where t.enterpriseId=:enterprise and t.toUserId=:actor order by t.expiresAt desc",EnterpriseOwnershipTransfer.class)
                    .setParameter("enterprise",enterpriseId).setParameter("actor",actor).setFirstResult(Math.max(0,page)*Math.min(100,Math.max(1,limit))).setMaxResults(Math.min(100,Math.max(1,limit))).getResultList();
            long count=entityManager.createQuery("select count(t) from EnterpriseOwnershipTransfer t where t.enterpriseId=:enterprise and t.toUserId=:actor",Long.class).setParameter("enterprise",enterpriseId).setParameter("actor",actor).getSingleResult();
            result=new PageImpl<>(own,paging(page,limit),count);
        }
        return result.map(t->new EnterpriseDtos.OwnershipTransfer(t.getId(),t.getEnterpriseId(),t.getFromUserId(),t.getToUserId(),
                "pending".equals(t.getStatus())&&(!t.getExpiresAt().isAfter(Instant.now())||!e.getOwnerUserId().equals(t.getFromUserId())||e.getVersion()!=t.getFromOwnerVersion())?"expired":t.getStatus(),t.getExpiresAt()));
    }
    @Transactional
    public EnterpriseDtos.Policy updatePolicy(String actor,String enterpriseId,EnterpriseDtos.PolicyUpdate request) {
        lock(enterpriseId);access.require(actor,enterpriseId,"policy.manage");var p=policies.findById(enterpriseId).orElseThrow();
        if(request==null || request.allowedEndpointIds()==null || request.allowedEndpointIds().size()>100 || request.maxActiveJobs()<1 || request.maxActiveJobs()>100)throw bad("模型或在途上限无效");
        if(p.getVersion()!=request.version())throw conflict("ENTERPRISE_VERSION_CONFLICT","企业策略已变化，请刷新");
        var ids=request.allowedEndpointIds().stream().map(v->text(v,64)).distinct().sorted().toList();
        if(endpoints.findAllById(ids).size()!=ids.size())throw bad("所选模型不存在");
        var before=dto(p);p.setAllowedEndpointIdsJson(json(ids));p.setMaxActiveJobs(request.maxActiveJobs());policies.saveAndFlush(p);
        audit(actor,enterpriseId,"policy.update",enterpriseId,json(before)+" -> "+json(dto(p)));return dto(p);
    }
    @Transactional
    public EnterpriseDtos.OwnershipTransfer requestTransfer(String actor,String enterpriseId,EnterpriseDtos.OwnershipRequest request) {
        var e=lock(enterpriseId);access.require(actor,enterpriseId,"ownership.transfer");
        if(request==null)throw bad("请选择接收成员");String key=text(request.clientRequestId(),64);
        var target=members.findById(text(request.targetMemberId(),64)).filter(m->enterpriseId.equals(m.getEnterpriseId())&&"active".equals(m.getStatus())&&!actor.equals(m.getUserId()))
                .orElseThrow(()->bad("请选择当前企业的有效成员"));
        access.member(target.getUserId(),enterpriseId);
        var old=transfers.findByEnterpriseIdAndFromUserIdAndClientRequestId(enterpriseId,actor,key);
        if(old.isPresent()) {if(!old.get().getToUserId().equals(target.getUserId()))throw conflict("ENTERPRISE_REQUEST_CONFLICT","同一请求不能更改接收人");return dto(old.get());}
        var t=new EnterpriseOwnershipTransfer();t.setId(id());t.setEnterpriseId(enterpriseId);t.setFromUserId(e.getOwnerUserId());t.setFromOwnerVersion(e.getVersion());t.setToUserId(target.getUserId());t.setStatus("pending");t.setClientRequestId(key);t.setExpiresAt(Instant.now().plus(Duration.ofHours(24)));transfers.save(t);
        audit(actor,enterpriseId,"ownership.request",t.getId(),"发起主账号移交");return dto(t);
    }
    @Transactional
    public EnterpriseDtos.Context acceptTransfer(String actor,String enterpriseId,String transferId) {
        var e=lock(enterpriseId);access.member(actor,enterpriseId);
        var t=transfers.findById(transferId).filter(x->enterpriseId.equals(x.getEnterpriseId())&&actor.equals(x.getToUserId())).orElseThrow(()->EnterpriseAccessService.denied("ENTERPRISE_PERMISSION_DENIED","不能接受此移交"));
        if("accepted".equals(t.getStatus())&&actor.equals(e.getOwnerUserId()))return context(actor,enterpriseId);
        if(!"pending".equals(t.getStatus())||!t.getExpiresAt().isAfter(Instant.now())||!t.getFromUserId().equals(e.getOwnerUserId())||t.getFromOwnerVersion()!=e.getVersion())throw conflict("ENTERPRISE_TRANSFER_INVALID","移交已失效");
        var prior=access.member(t.getFromUserId(),enterpriseId);prior.setRole("manager");members.save(prior);
        e.setOwnerUserId(actor);e.setUpdatedAt(Instant.now());enterprises.saveAndFlush(e);t.setStatus("accepted");transfers.save(t);
        audit(actor,enterpriseId,"ownership.accept",transferId,"接受主账号移交");return context(actor,enterpriseId);
    }
    @Transactional(readOnly=true)
    public Page<EnterpriseDtos.Audit> auditPage(String actor,String enterpriseId,int page,int limit) {
        access.require(actor,enterpriseId,"member.manage");
        return audits.findByEnterpriseIdOrderByCreatedAtDesc(enterpriseId,paging(page,limit)).map(a->new EnterpriseDtos.Audit(a.getId(),a.getEnterpriseId(),a.getActorUserId(),a.getAction(),a.getTargetId(),a.getSummary(),a.getCreatedAt()));
    }
    private EnterpriseMember join(Enterprise e,String userId) {
        var m=new EnterpriseMember();m.setId(id());m.setEnterpriseId(e.getId());m.setUserId(userId);m.setRole("member");m.setStatus("active");m.setJoinedAt(Instant.now());members.saveAndFlush(m);
        var c=new EnterpriseCurrentMembership();c.setUserId(userId);c.setEnterpriseId(e.getId());c.setMemberId(m.getId());current.saveAndFlush(c);
        credits.openEnterpriseWallet(e.getId(),userId);return m;
    }
    private Enterprise lock(String id) {
        return enterprises.lockById(id).filter(e->"active".equals(e.getStatus())).orElseThrow(()->EnterpriseAccessService.denied("ENTERPRISE_ACCESS_DENIED","企业不可使用"));
    }
    private void audit(String actor,String enterpriseId,String action,String target,String summary) {
        var a=new EnterpriseAudit();a.setId(id());a.setActorUserId(actor);a.setEnterpriseId(enterpriseId);a.setAction(action);a.setTargetId(target);a.setSummary(summary);a.setCreatedAt(Instant.now());audits.save(a);
    }
    private EnterpriseDtos.Enterprise dto(Enterprise e){return new EnterpriseDtos.Enterprise(e.getId(),e.getName(),e.getOwnerUserId(),e.getStatus(),e.getVersion(),e.getCreatedAt(),e.getUpdatedAt());}
    private EnterpriseDtos.Member dto(Enterprise e,EnterpriseMember m){return dto(e,m,users.findById(m.getUserId()).orElse(null));}
    private EnterpriseDtos.Member dto(Enterprise e,EnterpriseMember m,com.aistareco.aep.model.AepUser user){
        String name=user==null?"企业成员":user.getDisplayName();
        if(name==null||name.isBlank())name=user==null?"企业成员":user.getUsername();
        return new EnterpriseDtos.Member(m.getId(),m.getEnterpriseId(),m.getUserId(),name,e.getOwnerUserId().equals(m.getUserId())?"owner":m.getRole(),m.getStatus(),new EnterpriseDtos.Capabilities(m.isPointsManage(),m.isBillingRead(),m.isRechargeRequest()),m.getVersion(),m.getJoinedAt());
    }
    private EnterpriseDtos.Invitation dto(EnterpriseInvitation i){return new EnterpriseDtos.Invitation(i.getId(),i.getEnterpriseId(),"pending".equals(i.getStatus())&&!i.getExpiresAt().isAfter(Instant.now())?"expired":i.getStatus(),i.getExpiresAt());}
    private EnterpriseDtos.OwnershipTransfer dto(EnterpriseOwnershipTransfer t){return new EnterpriseDtos.OwnershipTransfer(t.getId(),t.getEnterpriseId(),t.getFromUserId(),t.getToUserId(),t.getStatus(),t.getExpiresAt());}
    private EnterpriseDtos.Policy dto(EnterprisePolicy p){try{return new EnterpriseDtos.Policy(p.getEnterpriseId(),mapper.readValue(p.getAllowedEndpointIdsJson(),new TypeReference<List<String>>(){}),p.getMaxActiveJobs(),p.getVersion());}catch(Exception e){throw new IllegalStateException("企业模型策略损坏",e);}}
    private String json(Object value){try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
    static String text(String value,int limit){if(value==null||value.isBlank()||value.trim().length()>limit)throw bad("输入为空或超过长度限制");return value.trim();}
    private static String hash(String token){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
    private static String id(){return UUID.randomUUID().toString();}
    private static BusinessException bad(String message){return BusinessException.badRequest("ENTERPRISE_INPUT_INVALID",message);}
    private static BusinessException conflict(String code,String message){return new BusinessException(HttpStatus.CONFLICT,code,message);}
    private static BusinessException invalidInvite(){return conflict("ENTERPRISE_INVITATION_INVALID","邀请不可用或已过期");}
    private static Pageable paging(int page,int limit){return PageRequest.of(Math.max(0,page),Math.max(1,Math.min(100,limit)));}
}
