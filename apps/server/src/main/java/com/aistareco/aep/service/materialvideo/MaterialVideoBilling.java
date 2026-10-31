package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.billing.service.*;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import org.springframework.http.HttpStatus;

/** One server-owned video charge identity; no asset keys, prompts or credentials enter the price scope. */
public final class MaterialVideoBilling {
    static final String PAYLOAD_KEY="_model_charge";
    private static final ObjectMapper JSON=new ObjectMapper();
    private MaterialVideoBilling() {}

    static ModelChargeContext plan(String app,MaterialVideoModelClient.BillingRoute route,VideoGenSpec spec,
                                   String aspect,int duration,long cost,boolean callerPriced,Long approved) {
        if(MaterialVideoJobService.APP_DAP.equals(app))return ModelChargeContext.NONE; // The parent owns the charge.
        // Free use comes only from model grants: a zero list price would otherwise be unlimited free consumption.
        if(cost<=0)throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"MODEL_PRICE_NOT_CONFIGURED",
                "请先配置视频标准售价。想免费送用户体验，请发放模型赠款");
        boolean second=spec.isExplicit() || !callerPriced&&route.perSecondPrice();
        String unit=second?"second":"call";
        BigDecimal quantity=BigDecimal.valueOf(second?duration:1);
        BigDecimal rate;
        try {rate=BigDecimal.valueOf(cost).divide(quantity);}
        catch(ArithmeticException invalid){throw BusinessException.badRequest("VIDEO_PRICE_UNIT_INVALID","视频单价与计量单位不一致，请重新检查售价");}
        String product=MaterialVideoJobService.APP_IPSTUDIO.equals(app)?"aiavatar":MaterialVideoJobService.modelAppCode(app);
        return new ModelChargeContext(new ModelBillingTarget(product,"video",route.endpointId(),route.providerModel(),
                specification(spec,aspect,duration,unit),unit),new ModelBillingMath.Usage(quantity,null),rate,null,
                "video:"+app+":"+cost,false,approved==null?cost:approved,null);
    }

    /** Pricing-relevant input counts are retained, while the identity of each owned asset is excluded. */
    public static String specification(VideoGenSpec spec,String aspect,int duration,String unit) {
        String mode=spec.generationMode()==null?(spec.firstFrameKey()==null?"t2v":"i2v"):spec.generationMode();
        long image=spec.references().stream().filter(r->"image".equals(r.mediaType())).count();
        long video=spec.references().stream().filter(r->"video".equals(r.mediaType())).count();
        long audio=spec.references().stream().filter(r->"audio".equals(r.mediaType())).count();
        // Length prefixes prevent custom mode/tier/ratio separators from making two different specifications equal.
        String tier=spec.resolutionTier()==null?"default":spec.resolutionTier();
        String ratio=aspect==null||aspect.isBlank()?"9:16":aspect;
        return part(mode)+part(tier)+part(ratio)+"refs="+image+","+video+","+audio
                +("call".equals(unit)?";seconds="+duration:"");
    }
    private static String part(String value){return value.length()+":"+value+";";}

    static void store(MaterialVideoJob job,ModelChargeContext charge) {
        if(charge.target()==null)return;
        try {var payload=(ObjectNode)JSON.readTree(job.getPayloadJson());payload.set(PAYLOAD_KEY,JSON.valueToTree(charge));job.setPayloadJson(payload.toString());}
        catch(Exception invalid){throw new IllegalStateException("Cannot save video price context",invalid);}
    }
    static ModelChargeContext read(MaterialVideoJob job) {
        try {
            var payload=job.getPayloadJson()==null?null:JSON.readTree(job.getPayloadJson());
            if(payload==null||!payload.has(PAYLOAD_KEY))return null; // Only historical jobs lack the snapshot.
            var charge=JSON.treeToValue(payload.get(PAYLOAD_KEY),ModelChargeContext.class);
            if(charge==null||charge.target()==null)throw new IllegalStateException("Missing model target");
            return charge;
        }catch(Exception invalid){throw new IllegalStateException("Invalid video price context: "+job.getId(),invalid);}
    }
    static void requireRoute(MaterialVideoJob job,MaterialVideoModelClient.SubmitResult route) {
        var charge=read(job);
        if(charge!=null&&(!charge.target().endpointId().equals(route.endpointId())
                ||!charge.target().providerModel().equals(route.modelUsed())
                ||!java.util.Objects.equals(job.getUpstreamBaseUrlSnapshot(),route.baseUrlSnapshot())
                ||!java.util.Objects.equals(job.getVideoRequestSpecSnapshotJson(),route.requestSpecSnapshotJson())))
            throw new BusinessException(HttpStatus.CONFLICT,"MODEL_BILLING_ROUTE_CHANGED","视频模型渠道已变更，请重新确认后再生成");
    }
}
