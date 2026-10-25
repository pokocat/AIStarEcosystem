package com.aistareco.aep.billing.service;

import com.aistareco.aep.billing.model.ModelCharge;
import com.aistareco.aep.billing.repository.ModelChargeRepository;
import com.aistareco.aep.model.CreditHold;
import com.aistareco.aep.model.Wallet;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Objects;

/** Pricing and lot allocation under CreditService's wallet/hold locks. Never creates a second wallet. */
@Service
public class ModelChargeService {
    private final ModelPricingService pricing;
    private final ScopedCreditService scoped;
    private final ModelChargeRepository charges;
    private final ObjectMapper mapper;
    public ModelChargeService(ModelPricingService pricing,ScopedCreditService scoped,ModelChargeRepository charges,ObjectMapper mapper) {
        this.pricing=pricing;this.scoped=scoped;this.charges=charges;this.mapper=mapper;
    }
    public record Quote(ModelBillingTarget target,ModelBillingMath.Usage usage,long standardCredits,long discountCredits,
                        long payableCredits,long scopedCredits,long walletCredits,String discountName,String priceVersion,
                        java.util.List<ScopedCreditService.Allocation> grantAllocations,boolean freeOnly,boolean canAfford,String unavailableCode,String unavailableReason,
                        ModelBillingApproval approval) {}
    public record Amounts(long scopedCredits,long walletCredits) {
        Amounts plus(Amounts other){return new Amounts(Math.addExact(scopedCredits,other.scopedCredits),Math.addExact(walletCredits,other.walletCredits));}
        long total(){return Math.addExact(scopedCredits,walletCredits);}
    }
    public record Breakdown(Amounts spent,Amounts pending,Amounts released) {
        public long displayedCost(){return Math.addExact(spent.total(),pending.total());}
    }
    @Transactional(readOnly=true)
    public Breakdown breakdown(String referenceType,java.util.List<String> referenceIds) {
        if(referenceIds==null||referenceIds.isEmpty())return null;
        var ids=referenceIds.stream().distinct().toList();var rows=charges.amountsForReferences(referenceType,ids);
        // Old or mixed historical tasks have no complete model split; retain their original cost projection.
        if(rows.size()!=ids.size())return null;
        var spent=new Amounts(0,0);var pending=new Amounts(0,0);var released=new Amounts(0,0);
        for(var row:rows) {
            spent=spent.plus(new Amounts(row.getSettledScopedCredits(),row.getSettledWalletCredits()));
            var unused=new Amounts(Math.subtractExact(row.getScopedCredits(),row.getSettledScopedCredits()),Math.subtractExact(row.getWalletCredits(),row.getSettledWalletCredits()));
            if(row.getHoldStatus()==CreditHold.Status.ACTIVE)pending=pending.plus(unused);else released=released.plus(unused);
        }
        return new Breakdown(spent,pending,released);
    }
    public record Snapshot(ModelChargeContext request,ModelPricingService.Snapshot price) {}
    public record Settlement(long scoped,long ordinary,long ordinaryRemaining) {}

    public Quote quote(Wallet wallet,ModelChargeContext context) {return quote(wallet,context,1,false);}
    public Quote quoteRepeated(Wallet wallet,ModelChargeContext context,int count) {return quote(wallet,context,count,true);}
    private Quote quote(Wallet wallet,ModelChargeContext context,int count,boolean repeated) {
        requireCount(count);
        Objects.requireNonNull(context);Objects.requireNonNull(context.target());
        Instant now=Instant.now();var price=resolve(wallet,context,now);
        long standard=ModelBillingMath.credits(java.math.BigDecimal.valueOf(price.standard(context.usage())).multiply(java.math.BigDecimal.valueOf(count)));
        long payable=ModelBillingMath.credits(java.math.BigDecimal.valueOf(price.payable(context.usage())).multiply(java.math.BigDecimal.valueOf(count)));
        var usage=repeatedUsage(context.usage(),count);
        var allocation=scoped.preview(wallet.getId(),context.target(),payable,price.allowGrants(),now);
        long ordinary=payable-allocation.credits();
        boolean affordable=ordinary<=wallet.getTotalBalance() && (!context.freeOnly() || ordinary==0)
                && (context.maxWalletCredits()==null || ordinary<=context.maxWalletCredits());
        String code=null,reason=null;
        try{if(repeated)scoped.requireRepeatedPreviewCapacity(wallet.getId(),allocation,price.payable(context.usage()),context.usage().total(),now);
            else scoped.requirePreviewCapacity(wallet.getId(),allocation,context.usage().total(),now);}
        catch(BusinessException e){affordable=false;code=e.getCode();reason=e.getMessage();}
        if(code==null && !affordable) {
            code=context.freeOnly() && ordinary>0?"SCOPED_CREDITS_INSUFFICIENT"
                    :context.maxWalletCredits()!=null && ordinary>context.maxWalletCredits()?"MODEL_QUOTE_CHANGED":"MODEL_CREDITS_INSUFFICIENT";
            reason=context.freeOnly()?"模型赠款不够，你选了只用模型赠款":"本次普通积分不足或超过已确认的付款上限";
        }
        String version=repeated?repeatedVersion(price,context,count):decisionVersion(price);
        return new Quote(context.target(),usage,standard,standard-payable,payable,allocation.credits(),ordinary,
                price.discountName(),version,allocation.allocations(),context.freeOnly(),affordable,code,reason,
                new ModelBillingApproval(wallet.getId(),context.target(),usage,version,context.freeOnly(),context.freeOnly()?0:ordinary));
    }

    /** Convert one confirmed video batch into a per-job approval; the caller shares its remaining debit ceiling. */
    public ModelBillingApproval approveRepeated(Wallet wallet,ModelChargeContext context,int count,ModelBillingApproval approval) {
        requireCount(count);var price=resolve(wallet,context,Instant.now());
        if(approval==null||!wallet.getId().equals(approval.walletId())||!context.target().equals(approval.target())
                ||!repeatedUsage(context.usage(),count).equals(approval.usage())
                ||!repeatedVersion(price,context,count).equals(approval.priceVersion()))
            throw new BusinessException(HttpStatus.CONFLICT,"MODEL_QUOTE_CHANGED","视频数量、规格、账户或价格已变化，请重新确认报价");
        return new ModelBillingApproval(wallet.getId(),context.target(),context.usage(),decisionVersion(price),approval.freeOnly(),approval.maxWalletCredits());
    }
    private String repeatedVersion(ModelPricingService.Snapshot price,ModelChargeContext context,int count) {
        return decisionVersion(java.util.List.of(price,context.usage(),count));
    }
    private static ModelBillingMath.Usage repeatedUsage(ModelBillingMath.Usage usage,int count) {
        var n=java.math.BigDecimal.valueOf(count);return new ModelBillingMath.Usage(usage.quantity().multiply(n),usage.outputQuantity().multiply(n));
    }
    private static void requireCount(int count){if(count<1||count>100)throw BusinessException.badRequest("MODEL_BATCH_INVALID","本次生成数量无效");}

    /** Returns the ordinary credits to freeze. CreditHold.amount keeps the workers' base-price accounting. */
    @Transactional(propagation=Propagation.MANDATORY)
    public long reserve(Wallet wallet,CreditHold hold,ModelChargeContext context,Instant now,Extension inherited) {
        if(context.target()==null)return hold.getAmount();
        if(context.approval()!=null&&!wallet.getId().equals(context.approval().walletId()))
            throw new BusinessException(HttpStatus.CONFLICT,"MODEL_QUOTE_CHANGED","付款账户已变化，请重新确认报价");
        var price=inherited==null?resolve(wallet,context,now):inherited.accepted().price();
        if(context.approval()!=null&&!decisionVersion(price).equals(context.approval().priceVersion()))
            throw new BusinessException(HttpStatus.CONFLICT,"MODEL_QUOTE_CHANGED","价格或优惠已变化，请重新确认报价");
        long payable=price.payable(context.usage());
        if(inherited!=null)payable=price.payable(new ModelBillingMath.Usage(java.math.BigDecimal.valueOf(Math.addExact(inherited.reservedBase(),hold.getAmount())),null))-inherited.reservedPayable();
        var allocation=scoped.reserve(wallet,hold,context.target(),payable,context.usage().total(),price.allowGrants(),now);
        long ordinary=payable-allocation.credits();
        if(context.freeOnly() && ordinary>0)throw new BusinessException(HttpStatus.PAYMENT_REQUIRED,"SCOPED_CREDITS_INSUFFICIENT","模型赠款不够，你选了只用模型赠款");
        long approved=context.maxWalletCredits()==null?hold.getAmount():context.maxWalletCredits();
        if(ordinary>approved)throw new BusinessException(HttpStatus.CONFLICT,"MODEL_QUOTE_CHANGED","本次需支付的积分已变化，请重新确认报价");
        if(ordinary>wallet.getTotalBalance())throw new BusinessException(HttpStatus.PAYMENT_REQUIRED,"MODEL_CREDITS_INSUFFICIENT","普通积分不足，请充值或减少生成数量");
        var row=new ModelCharge();row.setHoldId(hold.getId());row.setTargetJson(json(context.target()));row.setSnapshotJson(json(new Snapshot(context,price)));
        if("credit".equals(context.target().unit()))row.setParentHoldId(inherited==null?hold.getId():inherited.parentHoldId());
        row.setBaseCredits(hold.getAmount());row.setStandardCredits(price.standard(context.usage()));row.setPayableCredits(payable);
        row.setScopedCredits(allocation.credits());row.setWalletCredits(ordinary);row.setFreeOnly(context.freeOnly());row.setCreatedAt(now);charges.save(row);
        return ordinary;
    }

    /** Replays use their original price snapshot; only the submitted usage/route/approval must match. */
    public void verifyReplay(CreditHold hold,ModelChargeContext context) {
        var row=charges.findById(hold.getId()).orElse(null);
        if(row==null) {
            if(context.target()!=null)throw conflict();
            return;
        }
        Snapshot snapshot=snapshot(row);
        // JSON numeric normalization prevents 1 and 1.0 from becoming different requests.
        if(!mapper.valueToTree(snapshot.request()).equals(mapper.valueToTree(context)))throw conflict();
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public Settlement consume(Wallet wallet,CreditHold hold,long baseCredits,ModelBillingMath.Usage cumulativeUsage,Instant now) {
        var row=charges.findById(hold.getId()).orElse(null);
        if(row==null)return new Settlement(0,baseCredits,hold.getRemainingAmount()-baseCredits);
        var snapshot=snapshot(row);
        if(cumulativeUsage==null&&"credit".equals(snapshot.request().target().unit()))
            cumulativeUsage=new ModelBillingMath.Usage(java.math.BigDecimal.valueOf(Math.addExact(row.getSettledBaseCredits(),baseCredits)),null);
        if(cumulativeUsage==null || cumulativeUsage.quantity().compareTo(row.getSettledQuantity())<0
                || cumulativeUsage.outputQuantity().compareTo(row.getSettledOutputQuantity())<0
                || cumulativeUsage.quantity().compareTo(snapshot.request().usage().quantity())>0
                || cumulativeUsage.outputQuantity().compareTo(snapshot.request().usage().outputQuantity())>0)
            throw new BusinessException(HttpStatus.CONFLICT,"MODEL_SETTLEMENT_USAGE_INVALID","实际用量超出预占范围或低于已结算用量");
        long cumulativeBase=Math.addExact(row.getSettledBaseCredits(),baseCredits);
        if(baseCredits<0 || cumulativeBase>row.getBaseCredits())
            throw new BusinessException(HttpStatus.CONFLICT,"MODEL_SETTLEMENT_INVALID","结算超过原冻结范围");
        long cumulativePayable=snapshot.price().payable(cumulativeUsage);
        long cumulativeScoped=Math.min(cumulativePayable,row.getScopedCredits());
        long cumulativeWallet=cumulativePayable-cumulativeScoped;
        long scopedDelta=cumulativeScoped-row.getSettledScopedCredits();long walletDelta=cumulativeWallet-row.getSettledWalletCredits();
        scoped.consume(wallet,hold,scopedDelta,now);
        row.setSettledBaseCredits(cumulativeBase);row.setSettledPayableCredits(cumulativePayable);
        row.setSettledScopedCredits(cumulativeScoped);row.setSettledWalletCredits(cumulativeWallet);charges.save(row);
        row.setSettledQuantity(cumulativeUsage.quantity());row.setSettledOutputQuantity(cumulativeUsage.outputQuantity());
        return new Settlement(scopedDelta,walletDelta,row.getWalletCredits()-cumulativeWallet);
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public long release(Wallet wallet,CreditHold hold,Instant now) {
        var row=charges.findById(hold.getId()).orElse(null);
        if(row==null)return hold.getRemainingAmount();
        scoped.release(wallet,hold,now);return row.getWalletCredits()-row.getSettledWalletCredits();
    }
    public record Extension(ModelChargeContext context,Snapshot accepted,String parentHoldId,long reservedBase,long reservedPayable) {}
    public Extension extension(CreditHold parent,long amount) {
        var row=charges.findById(parent.getId()).orElse(null);
        if(row==null)return new Extension(ModelChargeContext.NONE,null,null,0,0);
        var accepted=snapshot(row);var original=accepted.request();
        if(!"credit".equals(original.target().unit()))throw new IllegalArgumentException("Only endpoint credit reservations can be extended by credits");
        String root=row.getParentHoldId()==null?row.getHoldId():row.getParentHoldId();
        var group=new java.util.ArrayList<>(charges.findByParentHoldIdOrderByCreatedAtAscHoldIdAsc(root));
        if(group.stream().noneMatch(r->r.getHoldId().equals(parent.getId())))group.add(row);
        if(group.stream().anyMatch(r->r.getSettledBaseCredits()!=0))throw conflict();
        long reserved=group.stream().mapToLong(ModelCharge::getBaseCredits).reduce(0,Math::addExact);
        long payable=group.stream().mapToLong(ModelCharge::getPayableCredits).reduce(0,Math::addExact);
        return new Extension(new ModelChargeContext(original.target(),new ModelBillingMath.Usage(java.math.BigDecimal.valueOf(amount),null),
                original.unitPrice(),original.outputUnitPrice(),original.priceVersion(),original.freeOnly(),original.freeOnly()?0L:amount,null),accepted,root,reserved,payable);
    }
    /** Spendable original credits, including matching grants and the applicable discount. Advisory under the wallet lock. */
    public long availableCredits(Wallet wallet,ModelBillingTarget target,Snapshot inherited,long reservedPayable,long reservedBase) {
        var price=inherited==null?pricing.resolve(target,new ModelPricingService.Payer(wallet.getId(),wallet.getUserId(),wallet.getEnterpriseId()),
                java.math.BigDecimal.ONE,null,"endpoint-credit-v1",Instant.now()):inherited.price();
        long grants=scoped.preview(wallet.getId(),target,ModelBillingMath.MAX_CREDITS,price.allowGrants(),Instant.now()).credits();
        var amount=java.math.BigDecimal.valueOf(wallet.getTotalBalance()).add(java.math.BigDecimal.valueOf(grants)).add(java.math.BigDecimal.valueOf(reservedPayable));
        return amount.divide(price.factor(),0,java.math.RoundingMode.DOWN).subtract(java.math.BigDecimal.valueOf(reservedBase)).max(java.math.BigDecimal.ZERO).min(java.math.BigDecimal.valueOf(ModelBillingMath.MAX_CREDITS)).longValueExact();
    }
    public record CreditSlice(CreditHold hold,long base,Settlement settlement) {}
    /** One terminal invoice, rounded once; rounding credits prefer already-reserved grant sources. */
    @Transactional(propagation=Propagation.MANDATORY)
    public java.util.List<CreditSlice> consumeCreditBatch(Wallet wallet,java.util.List<CreditHold> holds,long actual,Instant now) {
        var rows=new java.util.ArrayList<ModelCharge>();var snapshots=new java.util.ArrayList<Snapshot>();
        for(var hold:holds) {
            var row=charges.findById(hold.getId()).orElse(null);
            if(row==null||!"credit".equals(snapshot(row).request().target().unit()))return null;
            rows.add(row);snapshots.add(snapshot(row));
        }
        var price=snapshots.get(0).price();var target=snapshots.get(0).request().target();
        String root=rows.get(0).getParentHoldId()==null?rows.get(0).getHoldId():rows.get(0).getParentHoldId();
        var complete=new java.util.HashSet<>(charges.findByParentHoldIdOrderByCreatedAtAscHoldIdAsc(root).stream().map(ModelCharge::getHoldId).toList());
        complete.add(root);
        if(!complete.equals(new java.util.HashSet<>(rows.stream().map(ModelCharge::getHoldId).toList())))throw conflict();
        if(snapshots.stream().anyMatch(s->!target.endpointId().equals(s.request().target().endpointId())||!mapper.valueToTree(price).equals(mapper.valueToTree(s.price()))))
            throw conflict();
        long reserved=holds.stream().mapToLong(CreditHold::getAmount).reduce(0,Math::addExact);
        if(actual<0||actual>reserved)throw new IllegalArgumentException("Settlement exceeds reserved credits");
        boolean terminal=holds.stream().allMatch(h->h.getStatus()!=CreditHold.Status.ACTIVE);
        if(terminal) {
            if(rows.stream().mapToLong(ModelCharge::getSettledBaseCredits).sum()!=actual)throw conflict();
            return java.util.List.of();
        }
        if(holds.stream().anyMatch(h->h.getStatus()!=CreditHold.Status.ACTIVE||h.getRemainingAmount()!=h.getAmount())
                ||rows.stream().anyMatch(r->r.getSettledBaseCredits()!=0))throw conflict();
        long[] bases=new long[rows.size()],paid=new long[rows.size()];boolean[] fractional=new boolean[rows.size()];
        long left=actual,floors=0;
        for(int i=0;i<rows.size();i++) {
            bases[i]=Math.min(left,holds.get(i).getAmount());left-=bases[i];
            var exact=java.math.BigDecimal.valueOf(bases[i]).multiply(price.unitPrice()).multiply(price.factor());
            paid[i]=exact.setScale(0,java.math.RoundingMode.DOWN).longValueExact();floors=Math.addExact(floors,paid[i]);
            fractional[i]=exact.compareTo(java.math.BigDecimal.valueOf(paid[i]))>0;
        }
        long remainder=price.payable(new ModelBillingMath.Usage(java.math.BigDecimal.valueOf(actual),null))-floors;
        for(int pass=0;pass<2;pass++)for(int i=0;i<rows.size()&&remainder>0;i++) {
            if(fractional[i]&&paid[i]<rows.get(i).getPayableCredits()&&((rows.get(i).getScopedCredits()>paid[i])==(pass==0))) {paid[i]++;fractional[i]=false;remainder--;}
        }
        if(remainder!=0)throw new IllegalStateException("Unable to distribute invoice rounding");
        var result=new java.util.ArrayList<CreditSlice>();
        for(int i=0;i<rows.size();i++) {
            var row=rows.get(i);var hold=holds.get(i);
            if(paid[i]>row.getPayableCredits())throw conflict();
            long free=Math.min(paid[i],row.getScopedCredits()),ordinary=paid[i]-free;
            scoped.consume(wallet,hold,free,now);
            row.setSettledBaseCredits(bases[i]);row.setSettledPayableCredits(paid[i]);row.setSettledScopedCredits(free);row.setSettledWalletCredits(ordinary);
            row.setSettledQuantity(java.math.BigDecimal.valueOf(bases[i]));row.setSettledOutputQuantity(java.math.BigDecimal.ZERO);
            charges.save(row);
            result.add(new CreditSlice(hold,bases[i],new Settlement(free,ordinary,row.getWalletCredits()-ordinary)));
        }
        return result;
    }

    public boolean isModelCharge(String holdId){return charges.existsById(holdId);}
    /** True when the original reservation used a grant or a discount, so a later recovery cannot simply re-charge the list price. */
    public boolean usedPromotion(String holdId) {
        var row=charges.findById(holdId).orElse(null);
        return row!=null&&(row.getScopedCredits()>0||row.getPayableCredits()<row.getStandardCredits());
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void markDispatched(String holdId,Instant now){scoped.markDispatched(holdId,now);}
    @Transactional(propagation=Propagation.MANDATORY)
    public void finishResources(String holdId,java.math.BigDecimal measuredUsage,Instant now){scoped.finishResources(holdId,measuredUsage,now);}
    public long ordinaryTotal(CreditHold hold){return Math.addExact(Math.addExact(hold.getFromGift(),hold.getFromLicense()),hold.getFromRecharge());}
    private ModelPricingService.Snapshot resolve(Wallet wallet,ModelChargeContext context,Instant now) {
        return pricing.resolve(context.target(),new ModelPricingService.Payer(wallet.getId(),wallet.getUserId(),wallet.getEnterpriseId()),
                context.unitPrice(),context.outputUnitPrice(),context.priceVersion(),now);
    }
    public Snapshot snapshot(ModelCharge row){try{return mapper.readValue(row.getSnapshotJson(),Snapshot.class);}catch(Exception e){throw new IllegalStateException("Invalid charge snapshot "+row.getHoldId(),e);}}
    private String decisionVersion(Object price) {
        try{return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(json(price).getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}
    }
    private String json(Object value){try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
    private static BusinessException conflict(){return new BusinessException(HttpStatus.CONFLICT,"MODEL_BILLING_REPLAY_MISMATCH","此任务编号的模型、用量或付款选择不一致");}
}
