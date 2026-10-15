package com.aistareco.aep.enterprise.service;

import com.aistareco.aep.enterprise.model.*;
import com.aistareco.aep.enterprise.repository.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.CreditService;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;

/** All automatic returns produce the same linked double-sided transfer records as an explicit reclaim. */
@Service
public class EnterpriseFundRecoveryService {
    private final EnterpriseRepository enterprises;
    private final EnterpriseCurrentMembershipRepository current;
    private final EnterpriseMemberRepository members;
    private final EnterpriseBillingAuthorizationRepository authorizations;
    private final EnterprisePointsBatchRepository batches;
    private final EnterprisePointsTransferRepository transfers;
    private final EnterpriseAuditRepository audits;
    private final WalletRepository wallets;
    private final CreditService credits;
    private final EntityManager em;
    public EnterpriseFundRecoveryService(EnterpriseRepository enterprises,EnterpriseCurrentMembershipRepository current,
            EnterpriseMemberRepository members,EnterpriseBillingAuthorizationRepository authorizations,
            EnterprisePointsBatchRepository batches,EnterprisePointsTransferRepository transfers,EnterpriseAuditRepository audits,
            WalletRepository wallets,CreditService credits,EntityManager em) {
        this.enterprises=enterprises;this.current=current;this.members=members;this.authorizations=authorizations;
        this.batches=batches;this.transfers=transfers;this.audits=audits;this.wallets=wallets;this.credits=credits;this.em=em;
    }
    @Transactional
    public long collectAvailable(String enterpriseId,EnterpriseMember member,String actor,String requestKey,String description) {
        enterprises.lockById(enterpriseId).orElseThrow();
        var from=wallets.findByAccountKey("enterprise_member:"+enterpriseId+":"+member.getUserId()).orElseThrow();
        var root=wallets.findByAccountKey("enterprise:"+enterpriseId).orElseThrow();lockPair(from,root);
        long amount=from.getTotalBalance();if(amount==0)return 0;
        String transferId=UUID.randomUUID().toString();
        var moved=credits.transferEnterpriseCredits(enterpriseId,from.getId(),root.getId(),amount,actor,member.getId(),transferId,description);
        record(enterpriseId,member.getId(),actor,requestKey,description,from.getId(),root.getId(),amount,transferId,moved);
        return amount;
    }
    @Transactional
    public void afterRelease(CreditHold hold,long amount,long gift,long license,long recharge) {
        if(hold.getEnterpriseId()==null||amount==0)return;
        boolean recover=false;
        var auth=authorizations.findById(Objects.toString(hold.getBillingAuthorizationId(),""));
        if(auth.isPresent()){em.refresh(auth.get(),LockModeType.PESSIMISTIC_WRITE);recover=auth.get().getRevokedAt()!=null;}
        var relation=current.findCurrentForUpdate(hold.getActorUserId());
        if(relation.isEmpty()||!Objects.equals(hold.getMembershipId(),relation.get().getMemberId())||!hold.getEnterpriseId().equals(relation.get().getEnterpriseId()))recover=true;
        var member=members.findById(Objects.toString(hold.getMembershipId(),""));
        if(member.isEmpty())recover=true;else{em.refresh(member.get(),LockModeType.PESSIMISTIC_WRITE);if(!"active".equals(member.get().getStatus()))recover=true;}
        if(!recover)return;
        var root=wallets.findByAccountKey("enterprise:"+hold.getEnterpriseId()).orElseThrow();
        String key="system:release:"+hold.getId();
        if(batches.findByEnterpriseIdAndClientRequestId(hold.getEnterpriseId(),key).isPresent())return;
        String actor=Objects.toString(hold.getActorUserId(),"system"),transferId=UUID.randomUUID().toString();
        var moved=credits.transferEnterpriseReleasedCredits(hold,root.getId(),gift,license,recharge,actor,transferId,"原成员任务未用积分退回企业");
        record(hold.getEnterpriseId(),hold.getMembershipId(),actor,key,"原成员任务释放后归集："+hold.getReferenceType()+":"+hold.getReferenceId(),
                hold.getWalletId(),root.getId(),amount,transferId,moved);
    }
    private void lockPair(Wallet a,Wallet b) {for(String id:List.of(a.getId(),b.getId()).stream().sorted().toList())wallets.findByIdForUpdate(id).ifPresent(w->em.refresh(w,LockModeType.PESSIMISTIC_WRITE));}
    private void record(String enterpriseId,String memberId,String actor,String key,String description,String from,String to,long amount,
            String transferId,CreditService.EnterpriseCreditTransfer moved) {
        var batch=new EnterprisePointsBatch();batch.setId(UUID.randomUUID().toString());batch.setEnterpriseId(enterpriseId);batch.setActorUserId(actor);
        batch.setClientRequestId(key);batch.setFingerprint(hash(key));batch.setDirection("reclaim");batch.setTotalAmount(amount);batch.setCreatedAt(Instant.now());batches.saveAndFlush(batch);
        var t=new EnterprisePointsTransfer();t.setId(transferId);t.setBatchId(batch.getId());t.setMemberId(memberId);t.setFromWalletId(from);t.setToWalletId(to);t.setAmount(amount);
        t.setFromGift(moved.fromGift());t.setFromLicense(moved.fromLicense());t.setFromRecharge(moved.fromRecharge());t.setOutLedgerId(moved.outLedgerId());t.setInLedgerId(moved.inLedgerId());transfers.saveAndFlush(t);
        var a=new EnterpriseAudit();a.setId(UUID.randomUUID().toString());a.setEnterpriseId(enterpriseId);a.setActorUserId(actor);a.setAction("points.recovery");a.setTargetId(batch.getId());a.setSummary(description+"，积分 "+amount);a.setCreatedAt(Instant.now());audits.save(a);
    }
    private String hash(String key){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
}
