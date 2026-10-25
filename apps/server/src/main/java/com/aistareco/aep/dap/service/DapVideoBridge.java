package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapJob;
import com.aistareco.aep.dap.repository.DapJobRepository;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.LinkedHashMap;
import java.util.Objects;

/** DAP keeps its flat price; the existing durable media worker owns provider submission and OSS mirroring. */
@Service
public class DapVideoBridge {
    private static final String CHILD_KEY = "_mediaVideoJobId";
    private final MaterialVideoJobService videos;
    private final AiModelInvocationService models;
    private final DapJobRepository jobs;
    private final ObjectMapper mapper;
    public DapVideoBridge(MaterialVideoJobService videos, AiModelInvocationService models,
                          DapJobRepository jobs, ObjectMapper mapper) {
        this.videos=videos; this.models=models; this.jobs=jobs; this.mapper=mapper;
    }

    @Transactional
    public String start(DapJob job, DapAvatar avatar, String prompt) {
        if (!Objects.equals(job.getOwnerUserId(),avatar.getOwnerUserId()) ||
                !Objects.equals(job.getAvatarId(),avatar.getId()) || avatar.getImageKey()==null)
            throw BusinessException.badRequest("DAP_VIDEO_REFERENCE_INVALID","请先生成本人形象的定妆图");
        var payload=new LinkedHashMap<String,Object>(job.getPayload()==null?java.util.Map.of():job.getPayload());
        // Retry/recovery reattaches the accepted child. Never repost an uncertain or already accepted supplier job.
        if (payload.get(CHILD_KEY) instanceof String existing && !existing.isBlank()) {
            var status=videos.getJob(existing,job.getOwnerUserId(),MaterialVideoJobService.APP_DAP);
            boolean uncertain=java.util.Set.of("VIDEO_SUBMISSION_UNKNOWN","VIDEO_RECONCILIATION_PENDING").contains(status.path("error_code").asText());
            int attempt=((Number)payload.getOrDefault("_mediaVideoRetry",0)).intValue();
            if(!"failed".equals(status.path("status").asText()) || uncertain || job.getRetryCount()<=attempt)return existing;
        }
        var billing=DapModelBilling.current();
        var endpoint=(billing==null?models.resolveDefaultEndpoint(AiModelPurpose.DAP_VIDEO,"aiavatar")
                :models.resolveAcceptedEndpoint(AiModelPurpose.DAP_VIDEO,billing.endpointId(AiModelPurpose.DAP_VIDEO),"aiavatar").map(AiModelInvocationService.ResolvedEndpoint::endpoint))
                .orElseThrow(()->BusinessException.badRequest("DAP_VIDEO_NOT_CONFIGURED","运镜视频模型未配置"));
        if(billing!=null)billing.requireRoute(AiModelPurpose.DAP_VIDEO,endpoint);
        var item=mapper.createObjectNode();
        item.put("kind","dap-camera"); item.put("name",job.getKind()); item.put("prompt",prompt);
        item.put("duration_sec",5); item.put("aspect_ratio","9:16");
        item.put("credit_cost",0); // Parent DapJob holds/commits dap.derive-video (including free idle loop).
        var config=item.putObject("variant_config"); config.put("endpoint_id",endpoint.getId());
        config.put("first_frame_key",avatar.getImageKey());
        var body=mapper.createObjectNode(); body.putArray("items").add(item);
        String id=videos.submit(body,job.getOwnerUserId(),MaterialVideoJobService.APP_DAP).get(0).path("id").asText();
        if(id.isBlank())throw new IllegalStateException("media job id missing");
        payload.put(CHILD_KEY,id); payload.put("_mediaVideoRetry",job.getRetryCount()); job.setPayload(payload); jobs.save(job);
        // videos.submit joins this transaction; its worker is dispatched only after both rows commit.
        return id;
    }

    public JsonNode status(String id,String owner) {return videos.getJob(id,owner,MaterialVideoJobService.APP_DAP);}
}
