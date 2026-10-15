package com.aistareco.aep.enterprise.service;

import com.aistareco.aep.enterprise.model.*;
import com.aistareco.aep.enterprise.repository.*;
import com.aistareco.aep.model.*;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigInteger;
import java.time.Instant;
import java.util.*;

/** All methods run after their wallet rows have been locked by CreditService/finance. */
@Service @Transactional
public class EnterpriseCreditLotService {
    private final EnterpriseCreditLotRepository lots;
    private final EnterpriseCreditLotHoldRepository holds;
    private final jakarta.persistence.EntityManager em;
    public EnterpriseCreditLotService(EnterpriseCreditLotRepository lots,EnterpriseCreditLotHoldRepository holds,jakarta.persistence.EntityManager em){this.lots=lots;this.holds=holds;this.em=em;}

    public void origin(Wallet wallet,String orderId,long amount) {
        if(amount<=0 || !"enterprise".equals(wallet.getAccountType()))throw new IllegalArgumentException("企业充值来源无效");
        if(lots.findByRechargeOrderIdAndWalletId(orderId,wallet.getId()).isPresent())throw conflict("充值来源已存在");
        var lot=newLot(wallet,orderId,Instant.now());lot.setAvailable(amount);lots.saveAndFlush(lot);
    }
    /** A null order means FIFO transfer; an explicit order is required for refund collection. */
    public void move(Wallet from,Wallet to,long amount,String orderId) {
        if(amount<=0)return;
        long remaining=amount;
        for(var source:lots.findByWalletIdOrderByCreatedAtAscIdAsc(from.getId())) {
            em.refresh(source,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            if(orderId!=null&&!orderId.equals(source.getRechargeOrderId()))continue;
            long take=Math.min(remaining,source.getAvailable());if(take<=0)continue;
            var target=lots.findByRechargeOrderIdAndWalletId(source.getRechargeOrderId(),to.getId())
                    .orElseGet(()->newLot(to,source.getRechargeOrderId(),source.getCreatedAt()));
            if(em.contains(target))em.refresh(target,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            source.setAvailable(source.getAvailable()-take);target.setAvailable(Math.addExact(target.getAvailable(),take));
            lots.save(source);lots.save(target);remaining-=take;if(remaining==0)break;
        }
        // Unattributed legacy/test recharge balances may move, but can never be refunded as an order.
        if(orderId!=null&&remaining!=0)throw conflict("原充值订单可回收积分已变化，请重新核对");
        lots.flush();
    }
    public void reserve(Wallet wallet,CreditHold hold) {
        if(wallet.getEnterpriseId()==null||hold.getFromRecharge()<=0)return;
        long remaining=hold.getFromRecharge();
        for(var lot:lots.findByWalletIdOrderByCreatedAtAscIdAsc(wallet.getId())) {
            em.refresh(lot,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            long take=Math.min(remaining,lot.getAvailable());if(take<=0)continue;
            lot.setAvailable(lot.getAvailable()-take);lot.setFrozen(Math.addExact(lot.getFrozen(),take));lots.save(lot);
            var allocation=new EnterpriseCreditLotHold();allocation.setId(UUID.randomUUID().toString());allocation.setHoldId(hold.getId());
            allocation.setLotId(lot.getId());allocation.setOriginalAmount(take);allocation.setFrozen(take);holds.save(allocation);
            remaining-=take;if(remaining==0)break;
        }
    }
    public void commit(CreditHold hold,long remainingAfter) {
        if(hold.getEnterpriseId()==null)return;
        var allocations=holds.findByHoldIdOrderByIdAsc(hold.getId());
        allocations.forEach(a->em.refresh(a,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE));
        long total=0,original=0;for(var a:allocations){total=Math.addExact(total,a.getFrozen());original=Math.addExact(original,a.getOriginalAmount());}
        long target=Math.min(original,remainingRecharge(hold,remainingAfter));
        long consume=total-target;
        if(consume<0)throw conflict("企业冻结来源与任务不一致");
        for(var a:allocations){long take=Math.min(consume,a.getFrozen());if(take==0)continue;var lot=lots.findById(a.getLotId()).orElseThrow();
            em.refresh(lot,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            if(lot.getFrozen()<take)throw conflict("企业冻结来源余额不足");
            lot.setFrozen(lot.getFrozen()-take);a.setFrozen(a.getFrozen()-take);lots.save(lot);holds.save(a);consume-=take;}
    }
    public void release(CreditHold hold) {
        if(hold.getEnterpriseId()==null)return;
        for(var a:holds.findByHoldIdOrderByIdAsc(hold.getId())) {
            em.refresh(a,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            long amount=a.getFrozen();if(amount==0)continue;var lot=lots.findById(a.getLotId()).orElseThrow();
            em.refresh(lot,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            if(lot.getFrozen()<amount)throw conflict("企业冻结来源余额不足");
            lot.setFrozen(lot.getFrozen()-amount);lot.setAvailable(Math.addExact(lot.getAvailable(),amount));a.setReleasedAmount(amount);a.setFrozen(0);lots.save(lot);holds.save(a);
        }
    }
    /** Released old-membership funds retain the exact recharge origins, even after the user rejoins. */
    public void moveReleased(Wallet from,Wallet to,CreditHold hold) {
        for(var allocation:holds.findByHoldIdOrderByIdAsc(hold.getId())) {
            if(allocation.getReleasedAmount()<=0)continue;
            var lot=lots.findById(allocation.getLotId()).orElseThrow();
            move(from,to,allocation.getReleasedAmount(),lot.getRechargeOrderId());
        }
    }
    public void reclaim(Wallet wallet,String orderId,long amount) {
        var lot=lots.findByRechargeOrderIdAndWalletId(orderId,wallet.getId()).orElseThrow(()->conflict("没有原订单积分可退款"));
        em.refresh(lot,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if(amount<=0||lot.getAvailable()<amount)throw conflict("原订单可退积分已变化");
        lot.setAvailable(lot.getAvailable()-amount);lots.saveAndFlush(lot);
    }
    /** Cumulative rounding keeps recharge <= original and monotonic as a hold is consumed. */
    public static long remainingRecharge(CreditHold hold,long remaining) {
        if(remaining<=0)return 0;
        long nonRecharge=Math.addExact(hold.getFromGift(),hold.getFromLicense());
        return remaining-BigInteger.valueOf(remaining).multiply(BigInteger.valueOf(nonRecharge)).divide(BigInteger.valueOf(hold.getAmount())).longValueExact();
    }
    private EnterpriseCreditLot newLot(Wallet wallet,String orderId,Instant createdAt) {
        var lot=new EnterpriseCreditLot();lot.setId(UUID.randomUUID().toString());lot.setEnterpriseId(wallet.getEnterpriseId());
        lot.setRechargeOrderId(orderId);lot.setWalletId(wallet.getId());lot.setCreatedAt(createdAt);return lot;
    }
    private static BusinessException conflict(String message){return new BusinessException(org.springframework.http.HttpStatus.CONFLICT,"ENTERPRISE_SOURCE_CONFLICT",message);}
}
