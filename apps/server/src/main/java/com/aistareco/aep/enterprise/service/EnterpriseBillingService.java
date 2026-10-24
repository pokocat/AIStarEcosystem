package com.aistareco.aep.enterprise.service;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.enterprise.model.*;
import com.aistareco.aep.enterprise.repository.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/** A job owns its original payer for its entire lifetime, independently of later membership changes. */
@Service
public class EnterpriseBillingService {
    public record BillingAccount(String walletId,String enterpriseId,String membershipId,String billingAuthorizationId) {}
    private final EnterpriseRepository enterprises;
    private final EnterprisePolicyRepository policies;
    private final EnterpriseBillingAuthorizationRepository authorizations;
    private final EnterpriseAccessService access;
    private final WalletRepository wallets;
    private final CreditHoldRepository holds;
    private final CreditService credits;
    private final ObjectMapper mapper;
    private final EntityManager em;
    private final boolean enabled;
    @Value("${aep.enterprise.allowed-ids:}") private String allowedIds="";
    public EnterpriseBillingService(EnterpriseRepository enterprises,EnterprisePolicyRepository policies,
            EnterpriseBillingAuthorizationRepository authorizations,EnterpriseAccessService access,WalletRepository wallets,
            CreditHoldRepository holds,CreditService credits,ObjectMapper mapper,EntityManager em,
            @Value("${aep.enterprise.enabled:false}")boolean enabled) {
        this.enterprises=enterprises;this.policies=policies;this.authorizations=authorizations;this.access=access;
        this.wallets=wallets;this.holds=holds;this.credits=credits;this.mapper=mapper;this.em=em;this.enabled=enabled;
    }
    public static boolean enterprise(BillingSelection selection){return selection!=null&&"enterprise".equals(selection.mode());}
    public static BillingSelection normalize(BillingSelection selection) {
        if(selection==null)return new BillingSelection("personal",null);
        if("personal".equals(selection.mode())&&(selection.enterpriseId()==null||selection.enterpriseId().isBlank()))return new BillingSelection("personal",null);
        if("enterprise".equals(selection.mode())&&selection.enterpriseId()!=null&&!selection.enterpriseId().isBlank()&&selection.enterpriseId().length()<=64)
            return new BillingSelection("enterprise",selection.enterpriseId().trim());
        throw BusinessException.badRequest("BILLING_SELECTION_INVALID","请选择个人积分或当前企业积分");
    }
    @Transactional
    public BillingAccount reserve(String actor,BillingSelection selection,String referenceType,String referenceId,
            String endpointId,long amount,String description) {
        var payer=normalize(selection);
        if(amount<0||amount>9_007_199_254_740_991L)throw BusinessException.badRequest("BILLING_AMOUNT_INVALID","积分金额无效");
        var existing=authorizations.findByReferenceTypeAndReferenceId(referenceType,referenceId);
        if("personal".equals(payer.mode())) {
            if(existing.isPresent())throw conflict("BILLING_SELECTION_CONFLICT","此任务已固定使用企业积分，不能切换付款账户");
            if(amount>0)credits.hold(actor,amount,referenceType,referenceId,description);
            return new BillingAccount(credits.getOrCreateWallet(actor).getId(),null,null,null);
        }
        if(!enabled)throw denied("ENTERPRISE_BILLING_DISABLED","企业积分付款尚未开放");
        if(!Set.of("ip-run","material_video_job").contains(referenceType))throw BusinessException.badRequest("ENTERPRISE_BILLING_SCOPE_INVALID","企业积分只用于工作台创作");
        if(!allowedIds.isBlank()&&Arrays.stream(allowedIds.split(",")).map(String::trim).noneMatch(payer.enterpriseId()::equals))
            throw denied("ENTERPRISE_BILLING_NOT_ENABLED","此企业尚未开放企业积分付款，请联系平台管理员");
        var enterprise=lockEnterprise(payer.enterpriseId());
        var member=access.memberForUpdate(actor,enterprise.getId());
        var prior=authorizations.lockByReference(referenceType,referenceId);
        if(prior.isPresent()) {
            var authorization=prior.get();em.refresh(authorization,LockModeType.PESSIMISTIC_WRITE);
            if(!actor.equals(authorization.getActorUserId())||!enterprise.getId().equals(authorization.getEnterpriseId())
                    ||!member.getId().equals(authorization.getMembershipId())||amount!=authorization.getAmount()
                    ||!Objects.equals(endpointId,authorization.getEndpointId()))
                throw conflict("BILLING_SELECTION_CONFLICT","任务付款账户、模型或价格已固定，不能更改");
            return account(authorization);
        }
        var policy=currentPolicy(enterprise.getId());
        requireAllowed(policy,endpointId,amount);
        // A job's added holds (reference "<job>#n", reserveExtension) belong to that job, not to new jobs.
        long active=authorizations.activeInEnterprise(enterprise.getId()).stream().filter(a->actor.equals(a.getActorUserId())&&!isExtension(a)).count();
        if(active>=policy.getMaxActiveJobs())throw conflict("ENTERPRISE_ACTIVE_JOB_LIMIT","已达到企业设定的在途任务上限，请等待已有任务完成");
        var wallet=wallets.findByAccountKey("enterprise_member:"+enterprise.getId()+":"+actor)
                .orElseThrow(()->conflict("ENTERPRISE_WALLET_MISSING","成员企业账户不存在，请联系管理员"));
        var authorization=new EnterpriseBillingAuthorization();authorization.setId(UUID.randomUUID().toString());
        authorization.setEnterpriseId(enterprise.getId());authorization.setActorUserId(actor);authorization.setMembershipId(member.getId());
        authorization.setWalletId(wallet.getId());authorization.setReferenceType(referenceType);authorization.setReferenceId(referenceId);
        authorization.setEndpointId(endpointId);authorization.setAmount(amount);authorization.setStatus("reserved");
        authorization.setCreatedAt(Instant.now());authorization.setUpdatedAt(authorization.getCreatedAt());authorizations.saveAndFlush(authorization);
        if(amount>0)credits.holdWallet(wallet.getId(),amount,referenceType,referenceId,description,actor,member.getId(),authorization.getId());
        return account(authorization);
    }
    /**
     * Another hold of a job that is already paid by an enterprise member (a Studio dialogue turn adding credits while it
     * works, docs/ip-studio-dialogue-no-continue.md §3): an authorization for {@code referenceId} with the parent's actor,
     * enterprise, membership, wallet and endpoint, and its hold on that same member wallet. Checked like a dispatch
     * (parent authorization alive, membership unchanged, model still allowed); not a new job for the active-job limit.
     * Null when the parent is not enterprise-paid (the caller then holds on the personal wallet, as the parent did).
     * Idempotent on {@code referenceId}.
     */
    @Transactional
    public BillingAccount reserveExtension(String referenceType,String parentReferenceId,String referenceId,long amount,String description) {
        if(amount<=0||amount>9_007_199_254_740_991L)throw BusinessException.badRequest("BILLING_AMOUNT_INVALID","积分金额无效");
        var snapshot=authorizations.findByReferenceTypeAndReferenceId(referenceType,parentReferenceId).orElse(null);
        if(snapshot==null)return null;
        lockEnterprise(snapshot.getEnterpriseId());
        var parent=authorizations.lockByReference(referenceType,parentReferenceId).orElseThrow();em.refresh(parent,LockModeType.PESSIMISTIC_WRITE);
        if(parent.getTerminalAt()!=null||parent.getRevokedAt()!=null)throw denied("ENTERPRISE_BILLING_REVOKED","企业积分付款已停止，这一轮先停在这里");
        EnterpriseMember member;
        try{member=access.memberForUpdate(parent.getActorUserId(),parent.getEnterpriseId());}
        catch(BusinessException e){throw denied("ENTERPRISE_BILLING_REVOKED","企业成员关系或产品开通已不可用，不能继续使用企业积分");}
        if(!member.getId().equals(parent.getMembershipId()))throw denied("ENTERPRISE_BILLING_REVOKED","企业成员关系已结束，不能继续使用企业积分");
        requireAllowed(currentPolicy(parent.getEnterpriseId()),parent.getEndpointId(),amount);
        var prior=authorizations.lockByReference(referenceType,referenceId);
        if(prior.isPresent())return account(prior.get());
        var authorization=new EnterpriseBillingAuthorization();authorization.setId(UUID.randomUUID().toString());
        authorization.setEnterpriseId(parent.getEnterpriseId());authorization.setActorUserId(parent.getActorUserId());authorization.setMembershipId(parent.getMembershipId());
        authorization.setWalletId(parent.getWalletId());authorization.setReferenceType(referenceType);authorization.setReferenceId(referenceId);
        authorization.setEndpointId(parent.getEndpointId());authorization.setAmount(amount);authorization.setStatus("dispatching");
        authorization.setCreatedAt(Instant.now());authorization.setUpdatedAt(authorization.getCreatedAt());authorization.setDispatchedAt(authorization.getCreatedAt());
        authorizations.saveAndFlush(authorization);
        credits.holdWallet(parent.getWalletId(),amount,referenceType,referenceId,description,parent.getActorUserId(),parent.getMembershipId(),authorization.getId());
        return account(authorization);
    }
    private static boolean isExtension(EnterpriseBillingAuthorization a){return a.getReferenceId()!=null&&a.getReferenceId().indexOf('#')>0;}
    /**
     * Available credits of the account this payer would freeze on, read without locks. Only a sizing hint (a Studio
     * dialogue holds min(its ceiling, this)); {@link #reserve} under its locks stays the decision.
     */
    public long availableBalance(String actor,BillingSelection selection) {
        var payer=normalize(selection);
        if("personal".equals(payer.mode()))return credits.getOrCreateWallet(actor).getTotalBalance();
        return wallets.findByAccountKey("enterprise_member:"+payer.enterpriseId()+":"+actor).map(Wallet::getTotalBalance).orElse(0L);
    }
    @Transactional
    public void requireDispatchAllowed(String referenceType,String referenceId){requireDispatchAllowed(referenceType,referenceId,null);}
    @Transactional
    public void requireDispatchAllowed(String referenceType,String referenceId,String endpointId) {
        var snapshot=authorizations.findByReferenceTypeAndReferenceId(referenceType,referenceId).orElse(null);
        if(snapshot==null)return;
        lockEnterprise(snapshot.getEnterpriseId());
        var authorization=authorizations.lockByReference(referenceType,referenceId).orElseThrow();em.refresh(authorization,LockModeType.PESSIMISTIC_WRITE);
        if(authorization.getTerminalAt()!=null||authorization.getRevokedAt()!=null)throw denied("ENTERPRISE_BILLING_REVOKED","此任务已取消或原成员已停用，不能重新提交");
        EnterpriseMember member;
        try{member=access.memberForUpdate(authorization.getActorUserId(),authorization.getEnterpriseId());}
        catch(BusinessException e){throw denied("ENTERPRISE_BILLING_REVOKED","原企业成员关系或产品开通已不可用，任务停止提交并退回未用积分");}
        if(!member.getId().equals(authorization.getMembershipId()))throw denied("ENTERPRISE_BILLING_REVOKED","原企业成员关系已结束，请重新发起任务");
        String actual=endpointId==null?authorization.getEndpointId():endpointId;
        if(!Objects.equals(actual,authorization.getEndpointId()))throw denied("ENTERPRISE_MODEL_NOT_ALLOWED","任务模型已固定，不能切换到其他模型");
        requireAllowed(currentPolicy(authorization.getEnterpriseId()),actual,authorization.getAmount());
        if("reserved".equals(authorization.getStatus())) {
            authorization.setStatus("dispatching");authorization.setDispatchedAt(Instant.now());authorization.setUpdatedAt(Instant.now());authorizations.saveAndFlush(authorization);
        }
    }
    @Transactional
    public void requireEndpointAllowed(String referenceType,String referenceId,String endpointId) {
        var a=authorizations.findByReferenceTypeAndReferenceId(referenceType,referenceId).orElse(null);if(a==null)return;
        lockEnterprise(a.getEnterpriseId());
        if(!Objects.equals(a.getEndpointId(),endpointId))throw denied("ENTERPRISE_MODEL_NOT_ALLOWED","实际模型与付款授权不一致");
        requireAllowed(currentPolicy(a.getEnterpriseId()),endpointId,a.getAmount());
    }
    /** Shared order for worker settlement, user cancellation and enterprise lifecycle operations. */
    @Transactional
    public void lockForSettlement(String referenceType,String referenceId) {
        var a=authorizations.findByReferenceTypeAndReferenceId(referenceType,referenceId).orElse(null);
        var h=holds.findByReferenceTypeAndReferenceId(referenceType,referenceId).orElse(null);
        String enterpriseId=a!=null?a.getEnterpriseId():h==null?null:h.getEnterpriseId();
        if(enterpriseId!=null) {
            lockEnterprise(enterpriseId);
            var rows=em.createQuery("select w from Wallet w where w.enterpriseId=:enterprise order by w.id",Wallet.class)
                    .setParameter("enterprise",enterpriseId).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
            rows.forEach(w->em.refresh(w,LockModeType.PESSIMISTIC_WRITE));
        } else if(h!=null)wallets.findByIdForUpdate(h.getWalletId()).ifPresent(w->em.refresh(w,LockModeType.PESSIMISTIC_WRITE));
        if(h!=null)holds.findByReferenceTypeAndReferenceIdForUpdate(referenceType,referenceId).ifPresent(x->em.refresh(x,LockModeType.PESSIMISTIC_WRITE));
    }
    @Transactional
    public void complete(String referenceType,String referenceId) {
        var snapshot=authorizations.findByReferenceTypeAndReferenceId(referenceType,referenceId).orElse(null);if(snapshot==null)return;
        lockForSettlement(referenceType,referenceId);
        var authorization=authorizations.lockByReference(referenceType,referenceId).orElseThrow();em.refresh(authorization,LockModeType.PESSIMISTIC_WRITE);
        if(authorization.getTerminalAt()!=null)return;
        var hold=holds.findByReferenceTypeAndReferenceIdForUpdate(referenceType,referenceId).orElse(null);
        if(hold!=null&&hold.getStatus()==CreditHold.Status.ACTIVE&&hold.getRemainingAmount()>0)
            throw conflict("ENTERPRISE_SETTLEMENT_PENDING","任务仍有冻结积分，不能提前完成结算");
        authorization.setStatus(hold!=null&&hold.getStatus()==CreditHold.Status.RELEASED?"released":"completed");
        authorization.setTerminalAt(Instant.now());authorization.setUpdatedAt(authorization.getTerminalAt());authorizations.saveAndFlush(authorization);
    }
    public BillingAccount account(EnterpriseBillingAuthorization authorization){return new BillingAccount(authorization.getWalletId(),authorization.getEnterpriseId(),authorization.getMembershipId(),authorization.getId());}
    private Enterprise lockEnterprise(String id) {
        var e=enterprises.lockById(id).orElseThrow(()->denied("ENTERPRISE_BILLING_REVOKED","企业不存在"));em.refresh(e,LockModeType.PESSIMISTIC_WRITE);return e;
    }
    private EnterprisePolicy currentPolicy(String id){var policy=policies.findById(id).orElseThrow();em.refresh(policy,LockModeType.PESSIMISTIC_WRITE);return policy;}
    private void requireAllowed(EnterprisePolicy policy,String endpointId,long amount) {
        // Only server-owned local/fixture operations have no provider endpoint. They still consume a slot.
        if(endpointId==null) {if(amount>0)throw denied("ENTERPRISE_MODEL_NOT_ALLOWED","计费模型未确定，不能冻结企业积分");return;}
        try {
            List<String> allowed=mapper.readValue(policy.getAllowedEndpointIdsJson(),new TypeReference<List<String>>(){});
            if(!allowed.contains(endpointId))throw denied("ENTERPRISE_MODEL_NOT_ALLOWED","企业未允许使用此模型，请联系主账号设置");
        }catch(BusinessException e){throw e;}catch(Exception e){throw new IllegalStateException("企业模型策略损坏",e);}
    }
    private static BusinessException denied(String code,String message){return new BusinessException(HttpStatus.FORBIDDEN,code,message);}
    private static BusinessException conflict(String code,String message){return new BusinessException(HttpStatus.CONFLICT,code,message);}
}
