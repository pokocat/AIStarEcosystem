package com.aistareco.aep.billing.service;

import com.aistareco.aep.billing.model.*;
import com.aistareco.aep.billing.repository.*;
import com.aistareco.aep.model.CreditHold;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.WalletRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;

/** Restricted lots never mutate Wallet. Caller locks enterprise/wallet/hold before settlement. */
@Service
public class ScopedCreditService {
    private final CreditCampaignRepository campaigns;
    private final CreditGrantRepository grants;
    private final CreditGrantHoldRepository allocations;
    private final CreditResourceReservationRepository resources;
    private final WalletRepository wallets;
    private final LedgerEntryRepository ledger;
    private final EntityManager em;
    private final ObjectMapper mapper;

    public ScopedCreditService(CreditCampaignRepository campaigns,CreditGrantRepository grants,
            CreditGrantHoldRepository allocations,CreditResourceReservationRepository resources,
            WalletRepository wallets,LedgerEntryRepository ledger,EntityManager em,ObjectMapper mapper) {
        this.campaigns=campaigns;this.grants=grants;this.allocations=allocations;this.resources=resources;
        this.wallets=wallets;this.ledger=ledger;this.em=em;this.mapper=mapper;
    }

    public record Allocation(String grantId,String campaignId,long credits) {}
    public record Plan(long credits,List<Allocation> allocations) {}

    /**
     * Used by the approval service. Wallet/campaign locks serialize quotas and the unique source prevents duplicates.
     * READ_COMMITTED avoids MySQL next-key locks on absent grants deadlocking independent campaigns.
     * Callers joining this transaction must choose the same isolation (including future enrollment adapters).
     */
    @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public CreditGrant grant(String walletId,String campaignId,long amount,Instant expiresAt,
                             String source,String sourceReference,String reason,String actor) {
        text(source,64);text(sourceReference,128);text(reason,512);text(actor,64);
        if(amount<=0 || amount>ModelBillingMath.MAX_CREDITS || expiresAt==null)
            throw bad("SCOPED_GRANT_INVALID","请填写有效的赠送额度和有效期");
        expiresAt=expiresAt.truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        Wallet wallet=lockWallet(walletId);
        if("enterprise".equals(wallet.getAccountType()))
            throw bad("SCOPED_GRANT_WALLET_INVALID","请发放到个人或企业成员的消费账户");
        CreditCampaign campaign=lockCampaign(campaignId);
        var existing=grants.lockBySourceAndSourceReference(source,sourceReference).orElse(null);
        if(existing!=null) {
            if(!existing.getWalletId().equals(walletId) || !existing.getCampaignId().equals(campaignId)
                    || existing.getAmount()!=amount || !existing.getExpiresAt().equals(expiresAt)
                    || !existing.getReason().equals(reason) || !existing.getCreatedBy().equals(actor))
                throw conflict("SCOPED_GRANT_REPLAY_MISMATCH","这次发放编号已用于其他内容");
            return existing;
        }
        Instant now=Instant.now();
        requireIssuance(campaign,walletId,amount,expiresAt,now);
        var grant=new CreditGrant();grant.setId(UUID.randomUUID().toString());grant.setWalletId(walletId);
        grant.setCampaignId(campaignId);grant.setAmount(amount);grant.setAvailable(amount);
        grant.setSource(source);grant.setSourceReference(sourceReference);grant.setReason(reason);grant.setCreatedBy(actor);
        grant.setExpiresAt(expiresAt);grant.setCreatedAt(now);
        campaign.setIssued(Math.addExact(campaign.getIssued(),amount));campaign.setUpdatedAt(now);
        campaigns.save(campaign);grants.saveAndFlush(grant);
        entry(wallet,grant,null,LedgerEntry.LedgerEntryType.SCOPED_GRANT,amount,reason,actor,now);
        return grant;
    }

    /** Validate pending operations without issuing; approval repeats the current limits. */
    @Transactional
    public Wallet validateGrant(String walletId,String campaignId,long amount,Instant expiresAt) {
        if(amount<=0 || amount>ModelBillingMath.MAX_CREDITS || expiresAt==null)
            throw bad("SCOPED_GRANT_INVALID","请填写有效的赠送额度和有效期");
        Wallet wallet=lockWallet(walletId);
        if(!Set.of("personal","enterprise_member").contains(wallet.getAccountType()))
            throw bad("SCOPED_GRANT_WALLET_INVALID","请发放到个人或企业成员的消费账户");
        requireIssuance(lockCampaign(campaignId),walletId,amount,expiresAt,Instant.now());
        return wallet;
    }

    private void requireIssuance(CreditCampaign campaign,String walletId,long amount,Instant expiresAt,Instant now) {
        if(!active(campaign,now) || !expiresAt.isAfter(now) || expiresAt.isAfter(campaign.getExpiresAt()))
            throw bad("SCOPED_GRANT_WINDOW_INVALID","赠送有效期应在活动有效期内");
        // Use current reads: an earlier read in the outer approval transaction may have opened a MySQL snapshot.
        var issued=grants.lockIssuedToWallet(walletId,campaign.getId());
        issued.forEach(g->em.refresh(g,LockModeType.PESSIMISTIC_WRITE));
        long walletIssued=issued.stream().mapToLong(CreditGrant::getAmount).reduce(0,Math::addExact);
        if(amount>campaign.getTotalIssueLimit()-campaign.getIssued()
                || amount>campaign.getPerWalletIssueLimit()-walletIssued)
            throw conflict("SCOPED_GRANT_LIMIT","已达到活动或该账户的发放上限");
    }

    public Instant campaignExpiry(String campaignId) {
        return campaigns.expiryOf(campaignId).orElseThrow(()->bad("SCOPED_CAMPAIGN_NOT_FOUND","赠款活动不存在"));
    }

    public List<CreditGrant> list(String walletId) { return grants.findByWalletIdOrderByExpiresAtAscIdAsc(walletId); }

    public Plan preview(String walletId,ModelBillingTarget target,long payable,boolean allowGrants,Instant now) {
        if(!allowGrants || payable<=0)return new Plan(0,List.of());
        return plan(grants.findByWalletIdOrderByExpiresAtAscIdAsc(walletId),target,payable,now);
    }

    /** Advisory only: reserve repeats these checks under wallet/campaign locks. No paid fallback on exhaustion. */
    public void requirePreviewCapacity(String walletId,Plan plan,BigDecimal units,Instant now) {
        var day=now.atZone(ZoneOffset.UTC).toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant();
        for(String id:plan.allocations().stream().map(Allocation::campaignId).distinct().toList()) {
            var campaign=campaigns.findById(id).orElseThrow();
            if(!"credit".equals(campaign.getResourceUnit()))requireCapacity(campaign,resources.previewUsage(id,walletId,day),units,day,1);
        }
    }

    /** Match resource reservations to the candidate jobs that actually receive a grant allocation. */
    public void requireRepeatedPreviewCapacity(String walletId,Plan plan,long itemCredits,BigDecimal itemUnits,Instant now) {
        if(itemCredits<=0||plan.credits()==0)return;
        var touched=new java.util.LinkedHashMap<String,java.util.Set<Long>>();long cursor=0;
        for(var allocation:plan.allocations()) {
            long end=Math.addExact(cursor,allocation.credits());
            var jobs=touched.computeIfAbsent(allocation.campaignId(),key->new java.util.HashSet<>());
            for(long job=cursor/itemCredits;job<=(end-1)/itemCredits;job++)jobs.add(job);
            cursor=end;
        }
        var day=now.atZone(ZoneOffset.UTC).toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant();
        touched.forEach((id,jobs)->{
            var campaign=campaigns.findById(id).orElseThrow();
            if(!"credit".equals(campaign.getResourceUnit()))requireCapacity(campaign,resources.previewUsage(id,walletId,day),
                itemUnits.multiply(BigDecimal.valueOf(jobs.size())),day,jobs.size());
        });
    }

    /** Wallet and hold must already be locked. All participating campaigns are locked in ID order. */
    @Transactional(propagation=Propagation.MANDATORY)
    public Plan reserve(Wallet wallet,CreditHold hold,ModelBillingTarget target,long payable,
                        BigDecimal resourceUnits,boolean allowGrants,Instant now) {
        if(!allowGrants || payable<=0)return new Plan(0,List.of());
        resourceUnits=ModelBillingMath.decimal(resourceUnits,"资源用量");
        if(resourceUnits.signum()<=0)throw bad("SCOPED_RESOURCE_REQUIRED","使用模型赠款必须明确用量");
        // Only this endpoint's spendable lots take part; the caller's wallet lock already serializes them. A campaign row is
        // shared by every recipient, so it is locked only when it keeps a resource counter (never for credit campaigns).
        // Lock metered campaigns before reading any campaign entity (see CreditCampaignRepository#meteredIds).
        List<CreditGrant> spendable=grants.findSpendable(wallet.getId(),now);
        lockMetered(spendable.stream().map(CreditGrant::getCampaignId).toList());
        List<CreditGrant> candidates=spendable.stream().filter(g->eligible(g,target,now)).toList();
        candidates.forEach(g->em.refresh(g,LockModeType.PESSIMISTIC_WRITE));
        Plan plan=plan(candidates,target,payable,now);
        for(String campaignId:plan.allocations().stream().map(Allocation::campaignId).distinct().sorted().toList()) {
            CreditCampaign campaign=campaigns.findById(campaignId).orElseThrow();
            if(!"credit".equals(campaign.getResourceUnit()))reserveResources(wallet,hold,campaign,resourceUnits,now);
        }
        int order=0;
        for(Allocation a:plan.allocations()) {
            CreditGrant grant=grants.findById(a.grantId()).orElseThrow();
            grant.setAvailable(grant.getAvailable()-a.credits());grant.setFrozen(Math.addExact(grant.getFrozen(),a.credits()));
            grants.save(grant);
            var row=new CreditGrantHold();row.setId(UUID.randomUUID().toString());row.setHoldId(hold.getId());
            row.setGrantId(grant.getId());row.setOriginalAmount(a.credits());row.setFrozen(a.credits());row.setAllocationOrder(order++);
            allocations.save(row);
            entry(wallet,grant,hold,LedgerEntry.LedgerEntryType.SCOPED_FREEZE,-a.credits(),hold.getDescription(),hold.getActorUserId(),now);
        }
        return plan;
    }

    private boolean eligible(CreditGrant grant,ModelBillingTarget target,Instant now) {
        var campaign=campaigns.findById(grant.getCampaignId()).orElseThrow();
        return active(campaign,now)&&targets(campaign).stream().anyMatch(scope->scope.matches(target));
    }
    /** Resource-metered campaigns update shared counters on reserve/finish; credit campaigns are never modified here. */
    private void lockMetered(java.util.Collection<String> campaignIds) {
        var ids=campaignIds.stream().distinct().toList();
        if(!ids.isEmpty())campaigns.meteredIds(ids).forEach(this::lockCampaign);
    }

    private Plan plan(List<CreditGrant> candidates,ModelBillingTarget target,long payable,Instant now) {
        long remaining=payable;List<Allocation> result=new ArrayList<>();
        for(CreditGrant grant:candidates) {
            if(grant.getAvailable()<=0 || !now.isBefore(grant.getExpiresAt()))continue;
            var campaign=campaigns.findById(grant.getCampaignId()).orElseThrow();
            if(!active(campaign,now) || targets(campaign).stream().noneMatch(scope->scope.matches(target)))continue;
            long take=Math.min(remaining,grant.getAvailable());
            result.add(new Allocation(grant.getId(),campaign.getId(),take));remaining-=take;
            if(remaining==0)break;
        }
        return new Plan(payable-remaining,List.copyOf(result));
    }

    private void reserveResources(Wallet wallet,CreditHold hold,CreditCampaign campaign,BigDecimal units,Instant now) {
        var day=now.atZone(ZoneOffset.UTC).toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant();
        // Current locking reads, not a possibly stale MySQL REPEATABLE READ aggregate from the outer transaction.
        var usage=resources.lockUsage(campaign.getId(),wallet.getId(),day);
        usage.forEach(r->em.refresh(r,LockModeType.PESSIMISTIC_WRITE));
        requireCapacity(campaign,usage,units,day,1);
        campaign.setResourceReserved(campaign.getResourceReserved().add(units));campaigns.save(campaign);
        var row=new CreditResourceReservation();row.setId(UUID.randomUUID().toString());row.setHoldId(hold.getId());
        row.setWalletId(wallet.getId());row.setCampaignId(campaign.getId());row.setOriginalUnits(units);row.setReserved(units);row.setCreatedAt(now);
        resources.save(row);
    }

    private static void requireCapacity(CreditCampaign campaign,List<CreditResourceReservation> usage,BigDecimal units,Instant day,int jobs) {
        BigDecimal daily=usage.stream().filter(r->!r.getCreatedAt().isBefore(day))
                .map(r->r.getReserved().add(r.getUsed())).reduce(BigDecimal.ZERO,BigDecimal::add);
        if(campaign.getResourceUsed().add(campaign.getResourceReserved()).add(units).compareTo(campaign.getResourceLimit())>0
                || daily.add(units).compareTo(campaign.getPerWalletDailyResourceLimit())>0)
            throw conflict("SCOPED_RESOURCE_LIMIT","这个赠款活动的额度已用完，请稍后再试或选择其他模型");
        if(usage.stream().filter(r->r.getCompletedAt()==null).count()+jobs>campaign.getMaxConcurrentPerWallet())
            throw conflict("SCOPED_CONCURRENT_LIMIT","这个赠款活动已有任务在进行，请等它完成后再试");
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void consume(Wallet wallet,CreditHold hold,long amount,Instant now) {
        if(amount<0)throw bad("SCOPED_SETTLEMENT_INVALID","模型赠款结算金额无效");
        var rows=lockAllocations(hold.getId());long remaining=amount;
        for(var row:rows) {
            long take=Math.min(remaining,row.getFrozen());if(take==0)continue;
            var grant=grants.findById(row.getGrantId()).orElseThrow();
            if(grant.getFrozen()<take)throw conflict("SCOPED_BALANCE_MISMATCH","模型赠款冻结记录不一致");
            grant.setFrozen(grant.getFrozen()-take);grant.setSpent(Math.addExact(grant.getSpent(),take));
            row.setFrozen(row.getFrozen()-take);row.setConsumed(Math.addExact(row.getConsumed(),take));
            grants.save(grant);allocations.save(row);remaining-=take;
            entry(wallet,grant,hold,LedgerEntry.LedgerEntryType.SCOPED_SPEND,-take,hold.getDescription(),hold.getActorUserId(),now);
        }
        if(remaining!=0)throw conflict("SCOPED_BALANCE_MISMATCH","模型赠款冻结余额不足");
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void release(Wallet wallet,CreditHold hold,Instant now) {
        for(var row:lockAllocations(hold.getId())) {
            long amount=row.getFrozen();if(amount==0)continue;
            var grant=grants.findById(row.getGrantId()).orElseThrow();
            if(grant.getFrozen()<amount)throw conflict("SCOPED_BALANCE_MISMATCH","模型赠款冻结记录不一致");
            grant.setFrozen(grant.getFrozen()-amount);grant.setAvailable(Math.addExact(grant.getAvailable(),amount));
            row.setFrozen(0);row.setReleased(Math.addExact(row.getReleased(),amount));
            entry(wallet,grant,hold,LedgerEntry.LedgerEntryType.SCOPED_RELEASE,amount,hold.getDescription(),hold.getActorUserId(),now);
            expire(wallet,grant,now);grants.save(grant);allocations.save(row);
        }
    }

    /** Call before attempting the provider request. A transport timeout cannot prove resources unused. */
    @Transactional(propagation=Propagation.MANDATORY)
    public void markDispatched(String holdId,Instant now) {
        for(var row:lockResources(holdId)) {
            if(row.getCompletedAt()!=null)throw conflict("SCOPED_RESOURCE_CLOSED","已结束的资源预占不能再次派发");
            if(row.getDispatchedAt()==null){row.setDispatchedAt(now);resources.save(row);}
        }
    }

    /** Unknown provider usage consumes the reservation conservatively; customer refunds are independent. */
    @Transactional(propagation=Propagation.MANDATORY)
    public void finishResources(String holdId,BigDecimal measuredUsage,Instant now) {
        if(measuredUsage!=null)measuredUsage=ModelBillingMath.decimal(measuredUsage,"真实资源用量");
        for(var row:lockResources(holdId)) {
            if(row.getCompletedAt()!=null)continue;
            BigDecimal used=measuredUsage!=null?measuredUsage:row.getDispatchedAt()==null?BigDecimal.ZERO:row.getOriginalUnits();
            if(used.compareTo(row.getOriginalUnits())>0)throw conflict("SCOPED_RESOURCE_OVERRUN","供应商实际用量超过预占，需要核对");
            var campaign=campaigns.findById(row.getCampaignId()).orElseThrow();
            campaign.setResourceReserved(campaign.getResourceReserved().subtract(row.getReserved()));
            campaign.setResourceUsed(campaign.getResourceUsed().add(used));campaigns.save(campaign);
            row.setUsed(used);row.setReleased(row.getOriginalUnits().subtract(used));row.setReserved(BigDecimal.ZERO);row.setCompletedAt(now);resources.save(row);
        }
    }

    @Transactional
    public void expireWallet(String walletId,Instant now) {
        Wallet wallet=lockWallet(walletId);
        // Expiry only touches this wallet's lots (serialized by the wallet lock); campaign rows stay unlocked.
        var rows=grants.findByWalletIdOrderByExpiresAtAscIdAsc(walletId).stream()
                .filter(g->g.getAvailable()>0&&!now.isBefore(g.getExpiresAt())).toList();
        for(var grant:rows){em.refresh(grant,LockModeType.PESSIMISTIC_WRITE);expire(wallet,grant,now);grants.save(grant);}
    }

    private void expire(Wallet wallet,CreditGrant grant,Instant now) {
        if(now.isBefore(grant.getExpiresAt()) || grant.getAvailable()==0)return;
        long amount=grant.getAvailable();grant.setAvailable(0);grant.setExpired(Math.addExact(grant.getExpired(),amount));
        entry(wallet,grant,null,LedgerEntry.LedgerEntryType.SCOPED_EXPIRE,-amount,"模型赠款到期",null,now);
    }

    private List<CreditGrantHold> lockAllocations(String holdId) {
        var rows=allocations.findByHoldIdOrderByAllocationOrderAsc(holdId);
        var ids=rows.stream().map(CreditGrantHold::getGrantId).distinct().toList();
        lockMetered(ids.stream().map(id->grants.findById(id).orElseThrow().getCampaignId()).toList());
        ids.stream().sorted().forEach(id->grants.lockById(id).ifPresent(g->em.refresh(g,LockModeType.PESSIMISTIC_WRITE)));
        rows.forEach(r->em.refresh(r,LockModeType.PESSIMISTIC_WRITE));return rows;
    }
    private List<CreditResourceReservation> lockResources(String holdId) {
        var rows=resources.findByHoldIdOrderByCampaignIdAsc(holdId);
        rows.stream().map(CreditResourceReservation::getCampaignId).distinct().sorted().forEach(this::lockCampaign);
        rows.forEach(r->em.refresh(r,LockModeType.PESSIMISTIC_WRITE));return rows;
    }
    private Wallet lockWallet(String id) {
        Wallet wallet=wallets.findByIdForUpdate(id).orElseThrow(()->bad("SCOPED_WALLET_NOT_FOUND","消费账户不存在"));
        em.refresh(wallet,LockModeType.PESSIMISTIC_WRITE);return wallet;
    }
    private CreditCampaign lockCampaign(String id) {
        var campaign=campaigns.lockById(id).orElseThrow(()->bad("SCOPED_CAMPAIGN_NOT_FOUND","赠款活动不存在"));
        em.refresh(campaign,LockModeType.PESSIMISTIC_WRITE);return campaign;
    }
    public List<ModelBillingTarget> targets(CreditCampaign campaign) {
        try{return mapper.readValue(campaign.getTargetsJson(),new TypeReference<List<ModelBillingTarget>>(){});}
        catch(Exception e){throw new IllegalStateException("Invalid scoped campaign targets: "+campaign.getId(),e);}
    }
    private static boolean active(CreditCampaign campaign,Instant now) {
        return campaign.isActive() && !now.isBefore(campaign.getStartsAt()) && now.isBefore(campaign.getExpiresAt());
    }
    private void entry(Wallet wallet,CreditGrant grant,CreditHold hold,LedgerEntry.LedgerEntryType type,
                       long amount,String description,String actor,Instant now) {
        ledger.save(LedgerEntry.builder().id(UUID.randomUUID().toString()).walletId(wallet.getId()).userId(wallet.getUserId())
                .enterpriseId(wallet.getEnterpriseId()).actorUserId(actor).grantId(grant.getId())
                .membershipId(hold==null?null:hold.getMembershipId()).billingAuthorizationId(hold==null?null:hold.getBillingAuthorizationId())
                .entryType(type).amount(amount).balanceAfter(grant.getAvailable()).description(description)
                .referenceType(hold==null?"scoped_grant":hold.getReferenceType()).referenceId(hold==null?grant.getId():hold.getReferenceId()).createdAt(now).build());
    }
    private static void text(String value,int max) {
        if(value==null || value.isBlank() || value.length()>max)throw bad("SCOPED_GRANT_INVALID","发放原因、编号和操作人不能为空或超长");
    }
    private static BusinessException bad(String code,String message){return BusinessException.badRequest(code,message);}
    private static BusinessException conflict(String code,String message){return new BusinessException(HttpStatus.CONFLICT,code,message);}
}
