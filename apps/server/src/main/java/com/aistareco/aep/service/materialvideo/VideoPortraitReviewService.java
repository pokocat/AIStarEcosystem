package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.AiGenerationQueueService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;
import java.time.*;
import java.util.*;

/** Review only the exact inputs of an owner-scoped unaccepted video. Resume reuses the original task and hold. */
@Service
public class VideoPortraitReviewService {
    private final MaterialVideoJobRepository jobs;private final AiModelEndpointRepository endpoints;
    private final ArkPortraitLibrary portraits;private final AiGenerationQueueService queue;
    private static final ObjectMapper JSON=new ObjectMapper();
    public VideoPortraitReviewService(MaterialVideoJobRepository jobs,AiModelEndpointRepository endpoints,ArkPortraitLibrary portraits,AiGenerationQueueService queue){this.jobs=jobs;this.endpoints=endpoints;this.portraits=portraits;this.queue=queue;}
    @org.springframework.beans.factory.annotation.Autowired private com.aistareco.aep.service.AiModelAccessPolicyService access;
    public record Preparation(String libraryId,List<ArkPortraitLibrary.Item> items,List<String> candidateKeys){}
    public Preparation check(String owner,String model,List<String> keys) {
        if(model==null||keys==null||keys.isEmpty())return new Preparation(null,List.of(),List.of());
        if(keys.stream().anyMatch(x->x==null||x.isBlank()||x.length()>512))throw BusinessException.badRequest("VIDEO_ASSET_INPUT_INVALID","参考素材无效。");
        if(keys.size()>12)throw BusinessException.badRequest("VIDEO_ASSET_INPUT_INVALID","参考素材数量超出限制。");
        var endpoint=endpoints.findById(model).filter(x->x.getAssetLibraryId()!=null&&x.isEnabled()).orElse(null);
        if(endpoint==null||!portraits.isOfficialLibrary(endpoint.getAssetLibraryId())||!access.allows(model,"studio"))return new Preparation(null,List.of(),List.of());
        portraits.requireOwnedKeys(owner,keys);
        var known=portraits.itemsFor(owner,endpoint.getAssetLibraryId(),keys);
        var knownKeys=known.stream().map(ArkPortraitLibrary.Item::key).collect(java.util.stream.Collectors.toSet());
        return new Preparation(endpoint.getAssetLibraryId(),known.stream().filter(x->!"active".equals(x.status())).toList(),keys.stream().distinct().filter(x->!knownKeys.contains(x)).toList());
    }
    public record Review(String jobId,List<ArkPortraitLibrary.Item> items,boolean awaiting,boolean canContinue){}
    private MaterialVideoJob owned(String owner,String id){return jobs.findById(id).filter(j->owner.equals(j.getOwnerUserId())&&MaterialVideoJobService.APP_IPSTUDIO.equals(j.getApp())).orElseThrow(()->BusinessException.notFound("VIDEO_JOB_NOT_FOUND","视频任务不存在。"));}
    public Review get(String owner,String id) {return context(owner,owned(owner,id));}
    private Review context(String owner,MaterialVideoJob job) {
        String endpoint;
        try{endpoint=JSON.readTree(job.getVariantConfigJson()).path("endpoint_id").asText();}catch(Exception e){throw BusinessException.badRequest("VIDEO_ASSET_REVIEW_INVALID","该视频任务不需要人像核验。");}
        var model=endpoints.findById(endpoint).filter(x->x.getAssetLibraryId()!=null).orElseThrow(()->BusinessException.badRequest("VIDEO_ASSET_REVIEW_INVALID","该视频任务不需要人像核验。"));
        var spec=VideoGenSpec.fromVariantConfigJson(job.getVariantConfigJson());var keys=new ArrayList<String>();
        if(spec.firstFrameKey()!=null)keys.add(spec.firstFrameKey());if(spec.lastFrameKey()!=null)keys.add(spec.lastFrameKey());spec.references().forEach(x->keys.add(x.key()));
        var items=portraits.itemsFor(owner,model.getAssetLibraryId(),keys);
        boolean awaiting="queued".equals(job.getStatus())&&ArkPortraitLibrary.REVIEW_CODE.equals(job.getErrorCode())&&(job.getExternalTaskId()==null||job.getExternalTaskId().isBlank());
        boolean ready=!items.isEmpty()&&items.stream().allMatch(x->"active".equals(x.status()));
        if(ready)try{for(var item:items)portraits.reference(owner,model.getAssetLibraryId(),item.key());}catch(BusinessException unavailable){ready=false;}
        return new Review(job.getId(),items,awaiting,awaiting&&ready&&!MaterialVideoWorker.portraitReviewExpired(job));
    }
    @Transactional
    public Review resume(String owner,String id) {
        var job=owned(owner,id);var review=context(owner,job);
        if(!review.awaiting())return review; // A double click or a lost successful response never creates another request.
        if(!review.canContinue())throw BusinessException.badRequest("VIDEO_ASSET_REVIEW_NOT_READY","请完成所有人像核验及素材审核后继续。");
        if(jobs.resumePortraitReview(id,owner,OffsetDateTime.now())==1) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){queue.requeue(AiGenerationQueueService.VIDEO,id,Duration.ZERO);}});
        }
        return new Review(id,review.items(),false,false);
    }
}
