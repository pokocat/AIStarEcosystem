package com.aistareco.aep.enterprise.service;

import com.aistareco.aep.enterprise.dto.EnterprisePointsDtos.*;
import com.aistareco.aep.enterprise.model.*;
import com.aistareco.aep.enterprise.repository.*;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.WalletRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;

/** Enterprise lock → sorted wallet locks → hold locks is the common mutation order. */
@Service
public class EnterprisePointsService {
    private final EnterpriseRepository enterprises;
    private final EnterpriseMemberRepository members;
    private final EnterpriseCurrentMembershipRepository current;
    private final EnterprisePointsBatchRepository batches;
    private final EnterprisePointsTransferRepository transfers;
    private final EnterpriseAuditRepository audits;
    private final EnterpriseAccessService access;
    private final WalletRepository wallets;
    private final CreditService credits;
    private final EntityManager em;
    private final ObjectMapper mapper;

    public EnterprisePointsService(EnterpriseRepository enterprises,EnterpriseMemberRepository members,
            EnterpriseCurrentMembershipRepository current,EnterprisePointsBatchRepository batches,
            EnterprisePointsTransferRepository transfers,EnterpriseAuditRepository audits,EnterpriseAccessService access,
            WalletRepository wallets,CreditService credits,EntityManager em,ObjectMapper mapper) {
        this.enterprises=enterprises;this.members=members;this.current=current;this.batches=batches;
        this.transfers=transfers;this.audits=audits;this.access=access;this.wallets=wallets;this.credits=credits;this.em=em;this.mapper=mapper;
    }

    @Transactional
    public Preview preview(String actor,String enterpriseId,String direction,PreviewRequest request) {
        Enterprise enterprise=lock(enterpriseId);access.require(actor,enterpriseId,"points.manage");
        var items=normalize(direction,request==null?null:request.items());
        Snapshot snapshot=snapshot(actor,enterprise,direction,items);
        requireFunds(snapshot,direction);
        return snapshot.preview();
    }

    @Transactional
    public Batch submit(String actor,String enterpriseId,String direction,SubmitRequest request) {
        Enterprise enterprise=lock(enterpriseId);access.require(actor,enterpriseId,"points.manage");
        if(request==null)throw invalid("请先预览积分变动");
        String key=EnterpriseService.text(request.clientRequestId(),64);
        if(key.startsWith("finance:")||key.startsWith("system:"))throw invalid("请求编号使用了系统保留前缀");
        String confirmation=EnterpriseService.text(request.confirmationFingerprint(),64);
        var items=normalize(direction,request.items());
        String bodyFingerprint=hash(List.of(actor,enterpriseId,direction,items,confirmation));
        // Enterprise lock serializes retries even under MySQL REPEATABLE READ. Check before recalculating balances.
        var existing=batches.findByEnterpriseIdAndClientRequestId(enterpriseId,key);
        if(existing.isPresent()) {
            if(!actor.equals(existing.get().getActorUserId()) || !bodyFingerprint.equals(existing.get().getFingerprint()))
                throw conflict("ENTERPRISE_REQUEST_CONFLICT","同一请求不能更改积分操作");
            return dto(existing.get());
        }
        Snapshot snapshot=snapshot(actor,enterprise,direction,items);
        if(!MessageDigest.isEqual(confirmation.getBytes(StandardCharsets.UTF_8),
                snapshot.preview().confirmationFingerprint().getBytes(StandardCharsets.UTF_8)))
            throw conflict("ENTERPRISE_POINTS_PREVIEW_STALE","余额或成员权限已变化，请重新预览并确认");
        requireFunds(snapshot,direction);
        var batch=new EnterprisePointsBatch();batch.setId(id());batch.setEnterpriseId(enterpriseId);batch.setActorUserId(actor);
        batch.setClientRequestId(key);batch.setDirection(direction);batch.setFingerprint(bodyFingerprint);
        batch.setTotalAmount(snapshot.preview().totalAmount());batch.setCreatedAt(Instant.now());batches.saveAndFlush(batch);
        for(var target:snapshot.targets()) {
            long amount=target.amount();
            // A zero reclaim is shown in preview but writes no zero-amount ledger entry.
            if(amount==0)continue;
            String transferId=id();boolean allocate="allocate".equals(direction);
            String from=allocate?snapshot.root().getId():target.wallet().getId();
            String to=allocate?target.wallet().getId():snapshot.root().getId();
            var moved=credits.transferEnterpriseCredits(enterpriseId,from,to,amount,actor,target.member().getId(),transferId,
                    allocate?"企业积分分配":"企业积分回收");
            var transfer=new EnterprisePointsTransfer();transfer.setId(transferId);transfer.setBatchId(batch.getId());
            transfer.setMemberId(target.member().getId());transfer.setFromWalletId(from);transfer.setToWalletId(to);transfer.setAmount(amount);
            transfer.setFromGift(moved.fromGift());transfer.setFromLicense(moved.fromLicense());transfer.setFromRecharge(moved.fromRecharge());
            transfer.setOutLedgerId(moved.outLedgerId());transfer.setInLedgerId(moved.inLedgerId());transfers.save(transfer);
        }
        var audit=new EnterpriseAudit();audit.setId(id());audit.setEnterpriseId(enterpriseId);audit.setActorUserId(actor);
        audit.setAction("points."+direction);audit.setTargetId(batch.getId());audit.setCreatedAt(batch.getCreatedAt());
        audit.setSummary(("allocate".equals(direction)?"分配":"回收")+"企业积分 "+batch.getTotalAmount()+"，成员 "+items.size()+" 人");audits.save(audit);
        return dto(batch);
    }

    @Transactional(readOnly=true)
    public Batch batch(String actor,String enterpriseId,String batchId) {
        access.require(actor,enterpriseId,"points.manage");
        return dto(batches.findById(batchId).filter(b->enterpriseId.equals(b.getEnterpriseId()))
                .orElseThrow(()->BusinessException.notFound("ENTERPRISE_POINTS_BATCH_NOT_FOUND","积分批次不存在")));
    }

    @Transactional(readOnly=true)
    public Page<Transfer> transfers(String actor,String enterpriseId,int page,int limit) {
        var member=access.readMember(actor,enterpriseId);var enterprise=enterprises.findById(enterpriseId).orElseThrow();
        var permissions=access.permissions(enterprise,member);
        String own=permissions.contains("points.manage")||permissions.contains("billing.read")?null:member.getId();
        return transferPage(enterpriseId,own,page,limit);
    }
    @Transactional(readOnly=true)
    public Page<Transfer> adminTransfers(String enterpriseId,int page,int limit) {return transferPage(enterpriseId,null,page,limit);}
    private Page<Transfer> transferPage(String enterpriseId,String own,int page,int limit) {
        var rows=transfers.listTransfers(enterpriseId,own,PageRequest.of(Math.max(0,page),Math.max(1,Math.min(100,limit))));
        Map<String,EnterprisePointsBatch> headers=new HashMap<>();
        batches.findAllById(rows.stream().map(EnterprisePointsTransfer::getBatchId).distinct().toList()).forEach(b->headers.put(b.getId(),b));
        return rows.map(t->transferDto(headers.get(t.getBatchId()),t));
    }

    private Snapshot snapshot(String actor,Enterprise e,String direction,List<Item> items) {
        boolean owner=e.getOwnerUserId().equals(actor),allocate="allocate".equals(direction);
        List<EnterpriseMember> targets=new ArrayList<>();
        List<String> walletIds=new ArrayList<>();
        Wallet root=wallets.findByAccountKey("enterprise:"+e.getId()).orElseThrow(()->invalid("企业账户不存在"));
        walletIds.add(root.getId());
        Map<String,Wallet> memberWallets=new HashMap<>();
        for(Item item:items) {
            var member=members.findById(item.memberId()).filter(m->e.getId().equals(m.getEnterpriseId())
                    && !"removed".equals(m.getStatus()) && (!allocate||"active".equals(m.getStatus())))
                    .orElseThrow(()->BusinessException.notFound("ENTERPRISE_MEMBER_NOT_FOUND","请选择当前企业的有效成员"));
            if(current.findById(member.getUserId()).filter(c->member.getId().equals(c.getMemberId())&&e.getId().equals(c.getEnterpriseId())).isEmpty())
                throw invalid("成员已退出企业");
            if(!owner&&(actor.equals(member.getUserId())||e.getOwnerUserId().equals(member.getUserId())||!"member".equals(member.getRole())))
                throw EnterpriseAccessService.denied("ENTERPRISE_PERMISSION_DENIED","管理员不能给自己、主账号或其他管理员分配或回收积分");
            Wallet wallet=wallets.findByAccountKey("enterprise_member:"+e.getId()+":"+member.getUserId())
                    .orElseThrow(()->invalid("成员企业账户不存在"));
            targets.add(member);memberWallets.put(member.getId(),wallet);walletIds.add(wallet.getId());
        }
        // Refresh managed snapshots after acquiring the row lock, including any concurrent hold/settlement.
        for(String walletId:walletIds.stream().distinct().sorted().toList()) {
            Wallet wallet=wallets.findByIdForUpdate(walletId).orElseThrow();em.refresh(wallet,LockModeType.PESSIMISTIC_WRITE);
        }
        List<Target> resolved=new ArrayList<>();List<PreviewItem> previewItems=new ArrayList<>();
        List<Object> state=new ArrayList<>();state.add(List.of(actor,e.getId(),direction,e.getOwnerUserId(),e.getVersion(),items));
        state.add(walletState(root));long total=0;
        try {
            for(int i=0;i<targets.size();i++) {
                var member=targets.get(i);var wallet=memberWallets.get(member.getId());
                long amount=items.get(i).amount()==null?wallet.getTotalBalance():items.get(i).amount();
                total=Math.addExact(total,amount);
                long after=allocate?Math.addExact(wallet.getTotalBalance(),amount):Math.subtractExact(wallet.getTotalBalance(),amount);
                resolved.add(new Target(member,wallet,amount));
                previewItems.add(new PreviewItem(member.getId(),amount,wallet.getTotalBalance(),after,wallet.getPendingBalance()));
                state.add(List.of(member.getId(),member.getRole(),member.getStatus(),member.getVersion(),amount,walletState(wallet)));
            }
            long rootAfter=allocate?Math.subtractExact(root.getTotalBalance(),total):Math.addExact(root.getTotalBalance(),total);
            return new Snapshot(root,resolved,new Preview(e.getId(),direction,items.size(),total,root.getTotalBalance(),rootAfter,hash(state),previewItems));
        } catch(ArithmeticException ex) {throw invalid("积分总额超过上限");}
    }

    private void requireFunds(Snapshot snapshot,String direction) {
        if(snapshot.preview().totalAmount()<=0)throw invalid("没有可回收的企业积分");
        if(snapshot.preview().totalAmount()>9_007_199_254_740_991L)throw invalid("单批积分总额超过上限");
        if(("allocate".equals(direction)&&snapshot.preview().rootAvailableAfter()<0)
                || snapshot.preview().items().stream().anyMatch(i->i.availableAfter()<0))
            throw new BusinessException(HttpStatus.PAYMENT_REQUIRED,"ENTERPRISE_POINTS_INSUFFICIENT","可用企业积分不足，冻结积分不可分配或回收");
    }

    private List<Item> normalize(String direction,List<Item> items) {
        if(!Set.of("allocate","reclaim").contains(direction)||items==null||items.isEmpty()||items.size()>100)
            throw invalid("请选择 1–100 位成员");
        Set<String> seen=new HashSet<>();List<Item> out=new ArrayList<>();
        for(var item:items) {
            if(item==null)throw invalid("积分条目无效");
            String member=EnterpriseService.text(item.memberId(),64);
            if(!seen.add(member))throw invalid("成员不能重复");
            if((item.amount()==null&&"allocate".equals(direction)) || (item.amount()!=null&&(item.amount()<=0||item.amount()>9_007_199_254_740_991L)))
                throw invalid("积分必须为正整数，回收全部可用积分时可不填金额");
            out.add(new Item(member,item.amount()));
        }
        return out.stream().sorted(Comparator.comparing(Item::memberId)).toList();
    }
    private Enterprise lock(String enterpriseId) {
        return enterprises.lockById(enterpriseId).filter(e->"active".equals(e.getStatus()))
                .orElseThrow(()->EnterpriseAccessService.denied("ENTERPRISE_ACCESS_DENIED","企业不可使用"));
    }
    private List<Object> walletState(Wallet w) {return List.of(w.getId(),w.getTotalBalance(),w.getGiftBalance(),w.getLicenseBalance(),w.getRechargeBalance(),w.getPendingBalance());}
    private Batch dto(EnterprisePointsBatch batch) {
        var rows=transfers.findByBatchIdOrderByMemberIdAsc(batch.getId()).stream().map(t->transferDto(batch,t)).toList();
        return new Batch(batch.getId(),batch.getEnterpriseId(),batch.getDirection(),batch.getTotalAmount(),rows,batch.getCreatedAt());
    }
    private Transfer transferDto(EnterprisePointsBatch batch,EnterprisePointsTransfer t) {
        var names=em.createQuery("select u.displayName from AepUser u,EnterpriseMember m where m.id=:id and m.userId=u.id",String.class).setParameter("id",t.getMemberId()).getResultList();
        String name=names.isEmpty()||names.get(0)==null||names.get(0).isBlank()?"企业成员":names.get(0);
        return new Transfer(t.getId(),batch.getId(),batch.getEnterpriseId(),t.getMemberId(),name,batch.getDirection(),t.getAmount(),"done",batch.getCreatedAt(),t.getFromWalletId(),t.getToWalletId(),t.getFromGift(),t.getFromLicense(),t.getFromRecharge(),t.getOutLedgerId(),t.getInLedgerId());
    }
    private String hash(Object value) {
        try {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(value)));}
        catch(Exception e){throw new IllegalStateException(e);}
    }
    private record Target(EnterpriseMember member,Wallet wallet,long amount) {}
    private record Snapshot(Wallet root,List<Target> targets,Preview preview) {}
    private static String id(){return UUID.randomUUID().toString();}
    private static BusinessException invalid(String message){return BusinessException.badRequest("ENTERPRISE_POINTS_INPUT_INVALID",message);}
    private static BusinessException conflict(String code,String message){return new BusinessException(HttpStatus.CONFLICT,code,message);}
}
