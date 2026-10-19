package com.aistareco.aep.enterprise.service;

import com.aistareco.aep.enterprise.dto.EnterpriseRechargeDtos.*;
import com.aistareco.aep.enterprise.model.*;
import com.aistareco.aep.enterprise.repository.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.*;
import com.aistareco.common.BusinessException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/** Product membership and platform finance are separate authorities; orders own their immutable target. */
@Service
public class EnterpriseRechargeService {
    private final EnterpriseRepository enterprises;
    private final EnterpriseMemberRepository members;
    private final EnterpriseAuditRepository audits;
    private final EnterpriseAccessService access;
    private final RechargeOrderRepository orders;
    private final WalletRepository wallets;
    private final AepUserRepository users;
    private final EnterpriseCashReceiptRepository receipts;
    private final EnterpriseCreditLotRepository lots;
    private final EnterpriseCreditLotService sources;
    private final RechargeService recharge;
    private final CreditService credits;
    private final EntityManager em;
    private final EnterprisePointsBatchRepository batches;
    private final EnterprisePointsTransferRepository transfers;
    public EnterpriseRechargeService(EnterpriseRepository enterprises,EnterpriseMemberRepository members,
            EnterpriseAuditRepository audits,EnterpriseAccessService access,RechargeOrderRepository orders,WalletRepository wallets,
            AepUserRepository users,EnterpriseCashReceiptRepository receipts,EnterpriseCreditLotRepository lots,
            EnterpriseCreditLotService sources,RechargeService recharge,CreditService credits,EntityManager em,
            EnterprisePointsBatchRepository batches,EnterprisePointsTransferRepository transfers) {
        this.enterprises=enterprises;this.members=members;this.audits=audits;this.access=access;this.orders=orders;this.wallets=wallets;
        this.users=users;this.receipts=receipts;this.lots=lots;this.sources=sources;this.recharge=recharge;this.credits=credits;this.em=em;this.batches=batches;this.transfers=transfers;
    }
    @Transactional
    public Order request(String actor,String enterpriseId,RechargeRequest request) {
        var enterprise=lockEnterprise(enterpriseId);access.require(actor,enterpriseId,"billing.request");
        if(request==null)throw bad("请填写充值申请");
        String key=text(request.clientRequestId(),64,"请求编号"),note=optional(request.note(),512);
        long amount=request.requestedPriceCents()==null?0:request.requestedPriceCents();
        if(amount<0||amount>9_007_199_254_740_991L)throw bad("申请金额超出允许范围");
        String fingerprint=hash(amount+"\n"+Objects.toString(note,""));
        var prior=orders.findByEnterpriseIdAndEnterpriseRequestId(enterpriseId,key);
        if(prior.isPresent()) {
            if(!actor.equals(prior.get().getUserId())||!fingerprint.equals(prior.get().getEnterpriseRequestFingerprint()))throw conflict("同一申请不能更改金额、备注或申请人");
            return Order.from(prior.get());
        }
        var person=users.findById(actor).orElseThrow();var wallet=wallets.findByAccountKey("enterprise:"+enterpriseId).orElseThrow();
        var order=RechargeOrder.builder().id("er-"+UUID.randomUUID()).userId(actor).username(person.getUsername()).displayName(person.getDisplayName())
                .enterpriseId(enterpriseId).enterpriseName(enterprise.getName()).targetWalletId(wallet.getId()).enterpriseRequestId(key)
                .enterpriseRequestFingerprint(fingerprint).requestedPriceCents(amount).priceCents(amount).credits(0).packageId("enterprise-manual")
                .packageTag("企业人工充值").sourceApp("aiavatar").userNote(note).createdAt(Instant.now()).updatedAt(Instant.now()).build();
        orders.saveAndFlush(order);audit(actor,enterpriseId,"recharge.request",order.getId(),"申请企业人工充值");return Order.from(order);
    }
    @Transactional(readOnly=true)
    public Page<Order> list(String actor,String enterpriseId,int page,int limit) {
        var member=access.readMember(actor,enterpriseId);var e=enterprises.findById(enterpriseId).orElseThrow();var pageable=paging(page,limit);
        return (access.permissions(e,member).contains("billing.read")?orders.findByEnterpriseIdOrderByCreatedAtDesc(enterpriseId,pageable)
                :orders.findByEnterpriseIdAndUserIdOrderByCreatedAtDesc(enterpriseId,actor,pageable)).map(Order::from);
    }
    @Transactional(readOnly=true)
    public Page<Order> adminList(String enterpriseId,String status,int page,int limit) {
        RechargeOrder.Status state=null;
        if(status!=null&&!status.isBlank()&&!"all".equals(status))try{state=RechargeOrder.Status.valueOf(status.toUpperCase(Locale.ROOT));}
        catch(IllegalArgumentException ex){throw bad("订单状态无效");}
        return orders.pageEnterprise(blankNull(enterpriseId),state,paging(page,limit)).map(Order::from);
    }
    @Transactional
    public Order confirm(String actor,String orderId,ConfirmRequest request) {
        var snapshot=enterpriseOrder(orderId);var enterprise=lockEnterprise(snapshot.getEnterpriseId());var order=lockOrder(orderId);
        if(!"active".equals(enterprise.getStatus()))throw conflict("企业当前不可充值");
        if(request==null)throw bad("请填写收款登记");
        String key=text(request.clientRequestId(),64,"请求编号"),receipt=text(request.receiptReference(),256,"收款凭据"),note=optional(request.note(),512);
        long price=positive(request.priceCents(),"实收金额"),amount=positive(request.credits(),"入账积分");
        String fingerprint=hash(price+"\n"+amount+"\n"+normalizeReceipt(receipt)+"\n"+Objects.toString(note,""));
        if(order.getStatus()!=RechargeOrder.Status.PENDING) {
            if(key.equals(order.getConfirmRequestId())&&fingerprint.equals(order.getConfirmFingerprint())&&order.getPaidAt()!=null)return Order.from(order);
            throw conflict("订单已处理，请刷新核对");
        }
        BigInteger outstanding=BigInteger.ZERO;
        for(var wallet:lockWallets(order.getEnterpriseId()).values())outstanding=outstanding.add(BigInteger.valueOf(wallet.getTotalBalance())).add(BigInteger.valueOf(wallet.getPendingBalance()));
        if(outstanding.add(BigInteger.valueOf(amount)).compareTo(BigInteger.valueOf(9_007_199_254_740_991L))>0)throw bad("企业积分总余额超出允许范围");
        claimReceipt(order,"in",receipt);
        order.setPriceCents(price);order.setCredits(amount);order.setReceiptReference(receipt);order.setConfirmRequestId(key);order.setConfirmFingerprint(fingerprint);
        order.setReviewNote(note);orders.saveAndFlush(order);
        recharge.settlePaidOrder(orderId,"manual",null,actor,note);
        order=enterpriseOrder(orderId);audit(actor,order.getEnterpriseId(),"recharge.confirm",orderId,"确认实收 "+price+" 分，入账 "+amount+" 积分");
        return Order.from(order);
    }
    @Transactional
    public Order reject(String actor,String orderId,String reason) {
        var snapshot=enterpriseOrder(orderId);lockEnterprise(snapshot.getEnterpriseId());var order=lockOrder(orderId);
        reason=text(reason,512,"驳回原因");
        if(order.getStatus()==RechargeOrder.Status.REJECTED)return Order.from(order);
        if(order.getStatus()!=RechargeOrder.Status.PENDING)throw conflict("仅待确认申请可驳回");
        Instant now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);order.setStatus(RechargeOrder.Status.REJECTED);order.setReviewerId(actor);order.setReviewNote(reason);order.setReviewedAt(now);order.setUpdatedAt(now);
        orders.saveAndFlush(order);audit(actor,order.getEnterpriseId(),"recharge.reject",orderId,reason);return Order.from(order);
    }
    @Transactional
    public RefundPreview refundPreview(String orderId) {
        var snapshot=enterpriseOrder(orderId);lockEnterprise(snapshot.getEnterpriseId());var order=lockOrder(orderId);
        requirePaid(order);return preview(order,lockWallets(order.getEnterpriseId()));
    }
    @Transactional
    public Order refund(String actor,String orderId,RefundRequest request) {
        var snapshot=enterpriseOrder(orderId);lockEnterprise(snapshot.getEnterpriseId());var order=lockOrder(orderId);
        if(request==null)throw bad("请填写退款记录");
        String key=text(request.clientRequestId(),64,"请求编号"),token=text(request.previewToken(),64,"退款核对信息"),
                reason=text(request.reason(),512,"退款原因"),receipt=text(request.receiptReference(),256,"退款凭据");
        String fingerprint=hash(token+"\n"+reason+"\n"+normalizeReceipt(receipt));
        if(order.getStatus()==RechargeOrder.Status.REFUNDED) {
            if(key.equals(order.getRefundRequestId())&&fingerprint.equals(order.getRefundFingerprint()))return Order.from(order);
            throw conflict("该订单已退款，请核对原退款记录");
        }
        requirePaid(order);var locked=lockWallets(order.getEnterpriseId());var preview=preview(order,locked);
        if(!preview.previewToken().equals(token))throw conflict("可退积分或金额已变化，请重新核对");
        if(preview.pendingCredits()>0)throw conflict("原充值积分仍有在途任务，请等待任务结算后重新核对退款");
        if(preview.reclaimableCredits()<=0||preview.refundPriceCents()<=0)throw conflict("没有可退的原订单积分或现金金额");
        claimReceipt(order,"out",receipt);
        var root=locked.get(order.getTargetWalletId());requireTarget(order,root);
        EnterprisePointsBatch batch=null;
        if(preview.memberRecallCredits()>0) {
            batch=new EnterprisePointsBatch();batch.setId(UUID.randomUUID().toString());batch.setEnterpriseId(order.getEnterpriseId());batch.setActorUserId(actor);
            batch.setClientRequestId("finance:"+orderId);batch.setDirection("reclaim");batch.setFingerprint(fingerprint);batch.setTotalAmount(preview.memberRecallCredits());batch.setCreatedAt(Instant.now());batches.saveAndFlush(batch);
        }
        for(var lot:lots.findByRechargeOrderIdOrderByWalletIdAsc(orderId)) {
            if(lot.getAvailable()==0||root.getId().equals(lot.getWalletId()))continue;
            Wallet from=locked.get(lot.getWalletId());
            var membership=em.createQuery("select m from EnterpriseMember m where m.enterpriseId=:enterpriseId and m.userId=:userId order by m.joinedAt desc",EnterpriseMember.class)
                    .setParameter("enterpriseId",order.getEnterpriseId()).setParameter("userId",from.getMemberUserId()).setMaxResults(1).getResultStream().findFirst().orElseThrow(()->conflict("退款来源成员关系缺失，请核对"));
            long amount=lot.getAvailable();String transferId=UUID.randomUUID().toString();
            var movement=credits.transferEnterpriseRechargeCredits(order.getEnterpriseId(),from.getId(),root.getId(),amount,actor,membership.getId(),
                    transferId,"原充值订单 "+orderId+" 退款回收",orderId);
            var transfer=new EnterprisePointsTransfer();transfer.setId(transferId);transfer.setBatchId(batch.getId());transfer.setMemberId(membership.getId());transfer.setFromWalletId(from.getId());transfer.setToWalletId(root.getId());
            transfer.setAmount(amount);transfer.setFromRecharge(amount);transfer.setFromGift(0);transfer.setFromLicense(0);transfer.setOutLedgerId(movement.outLedgerId());transfer.setInLedgerId(movement.inLedgerId());transfers.save(transfer);
        }
        // The original lots and wallet debit are atomic; a later recharge can never replace a spent original lot.
        sources.reclaim(root,orderId,preview.reclaimableCredits());
        var ledger=credits.refundCashReclaimWallet(root.getId(),preview.reclaimableCredits(),orderId,"企业人工退款记录："+reason);
        order.setStatus(RechargeOrder.Status.REFUNDED);order.setRefundedAt(Instant.now());order.setRefundedCredits(preview.reclaimableCredits());
        order.setRefundedPriceCents(preview.refundPriceCents());order.setRefundLedgerEntryId(ledger.id());order.setRefundReceiptReference(receipt);
        order.setRefundRequestId(key);order.setRefundFingerprint(fingerprint);order.setReviewerId(actor);order.setReviewNote(reason);order.setUpdatedAt(Instant.now());
        orders.saveAndFlush(order);audit(actor,order.getEnterpriseId(),"recharge.refund",orderId,"记录人工退款 "+preview.refundPriceCents()+" 分，回收 "+preview.reclaimableCredits()+" 积分"+(batch==null?"":"，回收批次 "+batch.getId()));
        return Order.from(order);
    }
    @Transactional(readOnly=true)
    public WalletSummary wallet(String actor,String enterpriseId) {
        requireFinanceRead(actor,enterpriseId);return adminWallet(enterpriseId);
    }
    @Transactional(readOnly=true)
    public WalletSummary adminWallet(String enterpriseId) {
        var enterprise=enterprises.findById(enterpriseId).orElseThrow(()->BusinessException.notFound("ENTERPRISE_NOT_FOUND","企业不存在"));
        long unallocated=0,allocated=0,pending=0;
        for(var w:enterpriseWallets(enterpriseId)){if("enterprise".equals(w.getAccountType()))unallocated=Math.addExact(unallocated,w.getTotalBalance());else allocated=Math.addExact(allocated,w.getTotalBalance());pending=Math.addExact(pending,w.getPendingBalance());}
        long spent=em.createQuery("select coalesce(sum(-e.amount),0) from LedgerEntry e where e.enterpriseId=:id and e.entryType=:type",Long.class)
                .setParameter("id",enterpriseId).setParameter("type",LedgerEntry.LedgerEntryType.SPEND).getSingleResult();
        return new WalletSummary(enterpriseId,enterprise.getName(),unallocated,allocated,pending,spent,Math.addExact(unallocated,allocated));
    }
    @Transactional(readOnly=true)
    public Page<MemberBalance> memberBalances(String actor,String enterpriseId,int page,int limit) {
        var self=access.readMember(actor,enterpriseId);var e=enterprises.findById(enterpriseId).orElseThrow();var permissions=access.permissions(e,self);var pageable=paging(page,limit);
        Page<EnterpriseMember> rows;
        if(permissions.contains("billing.read")||permissions.contains("points.manage"))rows=members.findByEnterpriseIdAndStatusNotOrderByJoinedAtAsc(enterpriseId,"removed",pageable);
        else rows=new PageImpl<>(page==0?List.of(self):List.of(),pageable,1);
        return projectBalances(enterpriseId,e,rows);
    }
    @Transactional(readOnly=true)
    public MemberBalance myBalance(String actor,String enterpriseId) {
        var member=access.readMember(actor,enterpriseId);var enterprise=enterprises.findById(enterpriseId).orElseThrow();
        return projectBalances(enterpriseId,enterprise,new PageImpl<>(List.of(member))).getContent().get(0);
    }
    @Transactional(readOnly=true)
    public Page<MemberBalance> adminMemberBalances(String enterpriseId,int page,int limit) {
        var enterprise=enterprises.findById(enterpriseId).orElseThrow(()->BusinessException.notFound("ENTERPRISE_NOT_FOUND","企业不存在"));
        return projectBalances(enterpriseId,enterprise,members.findByEnterpriseIdAndStatusNotOrderByJoinedAtAsc(enterpriseId,"removed",paging(page,limit)));
    }
    private Page<MemberBalance> projectBalances(String enterpriseId,Enterprise e,Page<EnterpriseMember> rows) {
        var balances=new HashMap<String,Wallet>();for(var w:enterpriseWallets(enterpriseId))if(w.getMemberUserId()!=null)balances.put(w.getMemberUserId(),w);
        var names=new HashMap<String,AepUser>();users.findAllById(rows.stream().map(EnterpriseMember::getUserId).toList()).forEach(u->names.put(u.getId(),u));
        return rows.map(m->{var w=balances.get(m.getUserId());var u=names.get(m.getUserId());String name=u==null?m.getUserId():u.getDisplayName();if(name==null||name.isBlank())name=u==null?m.getUserId():u.getUsername();if(name==null||name.isBlank())name=m.getUserId();return new MemberBalance(m.getId(),m.getUserId(),name,e.getOwnerUserId().equals(m.getUserId())?"owner":m.getRole(),m.getStatus(),w==null?null:w.getId(),w==null?0:w.getTotalBalance(),w==null?0:w.getPendingBalance(),w==null?0:w.getRechargeBalance(),w==null?0:w.getGiftBalance(),w==null?0:w.getLicenseBalance());});
    }
    private RefundPreview preview(RechargeOrder order,Map<String,Wallet> locked) {
        long available=0,frozen=0,member=0;var facts=new ArrayList<String>();
        for(var lot:lots.findByRechargeOrderIdOrderByWalletIdAsc(order.getId())) {
            em.refresh(lot,LockModeType.PESSIMISTIC_WRITE);
            var wallet=locked.get(lot.getWalletId());if(wallet==null||!order.getEnterpriseId().equals(lot.getEnterpriseId())||wallet.getRechargeBalance()<lot.getAvailable())throw conflict("原订单积分来源与钱包不一致，请对账");
            available=Math.addExact(available,lot.getAvailable());frozen=Math.addExact(frozen,lot.getFrozen());
            if(!wallet.getId().equals(order.getTargetWalletId()))member=Math.addExact(member,lot.getAvailable());
            facts.add(lot.getId()+":"+lot.getAvailable()+":"+lot.getFrozen()+":"+wallet.getRechargeBalance());
        }
        if(available>order.getCredits()||frozen>order.getCredits()-available)throw conflict("原订单积分来源超过入账金额，请对账");
        long price=BigInteger.valueOf(order.getPriceCents()).multiply(BigInteger.valueOf(available)).divide(BigInteger.valueOf(order.getCredits())).longValueExact();
        String token=hash(order.getId()+"\n"+order.getCredits()+"\n"+order.getPriceCents()+"\n"+String.join("\n",facts));
        return new RefundPreview(order.getId(),order.getEnterpriseId(),order.getCredits(),order.getPriceCents(),available,price,member,frozen,order.getCredits()-available-frozen,token);
    }
    private void requireFinanceRead(String actor,String enterpriseId) {
        var m=access.member(actor,enterpriseId);var e=enterprises.findById(enterpriseId).orElseThrow();var permissions=access.permissions(e,m);
        if(!permissions.contains("billing.read")&&!permissions.contains("points.manage"))throw new BusinessException(HttpStatus.FORBIDDEN,"ENTERPRISE_PERMISSION_DENIED","没有企业积分查询权限");
    }
    private Map<String,Wallet> lockWallets(String enterpriseId) {
        // This must be a current read: an earlier order lookup may have established a MySQL RR snapshot
        // before another member wallet was created and funded while we waited for the enterprise lock.
        var current=em.createQuery("select w from Wallet w where w.enterpriseId=:id order by w.id",Wallet.class)
                .setParameter("id",enterpriseId).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        var result=new LinkedHashMap<String,Wallet>();for(var wallet:current) {
            em.refresh(wallet,LockModeType.PESSIMISTIC_WRITE);result.put(wallet.getId(),wallet);
        }return result;
    }
    private List<Wallet> enterpriseWallets(String enterpriseId){return em.createQuery("select w from Wallet w where w.enterpriseId=:id order by w.id",Wallet.class).setParameter("id",enterpriseId).getResultList();}
    private Enterprise lockEnterprise(String id){return enterprises.lockById(id).orElseThrow(()->BusinessException.notFound("ENTERPRISE_NOT_FOUND","企业不存在"));}
    private RechargeOrder enterpriseOrder(String id){return orders.findById(id).filter(o->o.getEnterpriseId()!=null).orElseThrow(()->BusinessException.notFound("ORDER_NOT_FOUND","企业充值订单不存在"));}
    private RechargeOrder lockOrder(String id){var o=orders.lockById(id).filter(x->x.getEnterpriseId()!=null).orElseThrow(()->BusinessException.notFound("ORDER_NOT_FOUND","企业充值订单不存在"));em.refresh(o,LockModeType.PESSIMISTIC_WRITE);return o;}
    private void requirePaid(RechargeOrder order){if(order.getStatus()!=RechargeOrder.Status.PAID||order.getCredits()<=0)throw conflict("仅已入账订单可退款");}
    private void requireTarget(RechargeOrder o,Wallet w){if(w==null||!"enterprise".equals(w.getAccountType())||!o.getEnterpriseId().equals(w.getEnterpriseId()))throw conflict("订单目标企业钱包不一致");}
    private void claimReceipt(RechargeOrder order,String direction,String reference) {
        String id=direction+":"+hash(normalizeReceipt(reference));var prior=receipts.findById(id);
        if(prior.isPresent()){if(order.getId().equals(prior.get().getOrderId()))return;throw new BusinessException(HttpStatus.CONFLICT,"ENTERPRISE_RECEIPT_REVIEW_REQUIRED","收付款凭据已登记，请财务核对原订单");}
        var receipt=new EnterpriseCashReceipt();receipt.setId(id);receipt.setOrderId(order.getId());receipt.setDirection(direction);receipt.setReceiptReference(reference);receipt.setCreatedAt(Instant.now());
        try{receipts.saveAndFlush(receipt);}catch(org.springframework.dao.DataIntegrityViolationException ex){throw new BusinessException(HttpStatus.CONFLICT,"ENTERPRISE_RECEIPT_REVIEW_REQUIRED","收付款凭据已登记，请财务核对原订单");}
    }
    private void audit(String actor,String enterpriseId,String action,String target,String summary){var a=new EnterpriseAudit();a.setId(UUID.randomUUID().toString());a.setEnterpriseId(enterpriseId);a.setActorUserId(actor);a.setAction(action);a.setTargetId(target);a.setSummary(summary);a.setCreatedAt(Instant.now());audits.save(a);}
    private static String normalizeReceipt(String value){return value.trim().replaceAll("\\s+"," ").toLowerCase(Locale.ROOT);}
    private static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException ex){throw new IllegalStateException(ex);}}
    private static long positive(Long n,String label){if(n==null||n<=0||n>9_007_199_254_740_991L)throw bad(label+"必须为允许范围内的正整数");return n;}
    private static String text(String value,int max,String label){if(value==null||value.isBlank()||value.trim().length()>max)throw bad(label+"不能为空且最多 "+max+" 字符");return value.trim();}
    private static String optional(String value,int max){if(value==null||value.isBlank())return null;if(value.trim().length()>max)throw bad("备注最多 "+max+" 字符");return value.trim();}
    private static String blankNull(String value){return value==null||value.isBlank()?null:value.trim();}
    private static Pageable paging(int page,int limit){if(page<0||limit<1||limit>100)throw bad("分页参数无效");return PageRequest.of(page,limit);}
    private static BusinessException bad(String message){return BusinessException.badRequest("ENTERPRISE_RECHARGE_INVALID",message);}
    private static BusinessException conflict(String message){return new BusinessException(HttpStatus.CONFLICT,"ENTERPRISE_RECHARGE_CONFLICT",message);}
}
