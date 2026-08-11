package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.model.*;
import com.aistareco.aep.clip.repository.*;
import com.aistareco.aep.clip.service.shiliu.*;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/** Worker 的事务边界。独立 bean 避免 @Scheduled 类内部自调用导致 @Transactional 失效。 */
@Service
public class ClipRenderWorkerState {
    private final ClipRenderJobRepository jobs;
    private final ClipProjectRepository projects;
    private final ShiliuService shiliu;
    private final ClipAvatarService avatars;
    private final ClipOutputStorage outputStorage;
    public ClipRenderWorkerState(ClipRenderJobRepository jobs, ClipProjectRepository projects, ShiliuService shiliu, ClipAvatarService avatars, ClipOutputStorage outputStorage) {
        this.jobs=jobs; this.projects=projects; this.shiliu=shiliu; this.avatars=avatars; this.outputStorage=outputStorage;
    }

    @Transactional
    public int acquire(String id, String workerId, Collection<String> statuses) {
        Instant now=Instant.now();
        return jobs.acquire(id,workerId,now.plusSeconds(300),now,statuses);
    }

    @Transactional
    public void advance(String id,String workerId) {
        ClipRenderJob j=jobs.findById(id).orElse(null);
        if(j==null||!workerId.equals(j.getLeaseOwner())||Set.of("succeeded","failed","cancelled").contains(j.getStatus()))return;
        Instant now=Instant.now();j.setHeartbeatAt(now);j.setUpdatedAt(now);
        if("tts".equals(j.getStage())){
            j.setStatus("generating");j.setStage("avatar");j.setProgress(20);
        } else if("avatar".equals(j.getStage())) {
            ClipProject p=projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull(j.getProjectId(),j.getExternalOwnerId()).orElseThrow();
            Map<String,Object> state=j.getSegmentJobsJson()==null?new LinkedHashMap<>():new LinkedHashMap<>(j.getSegmentJobsJson());
            String taskId=String.valueOf(state.getOrDefault("mainTaskId",""));
            ShiliuGateway.Task task;
            if(taskId.isBlank()){
                String text=ClipDtos.mapListValue(p.getPayloadJson().get("segments")).stream().filter(s->!"tail".equals(String.valueOf(s.get("role")))).map(s->String.valueOf(s.getOrDefault("text",""))).reduce("",(a,b)->a+"\n"+b).trim();
                task=shiliu.required().createVideoByText(j.getExternalOwnerId(),avatars.requiredAvatarEngineRef(j.getExternalOwnerId()),avatars.requiredVoiceEngineRef(j.getExternalOwnerId()),text);
            } else task=shiliu.required().query(taskId);
            if("failed".equals(task.status()))throw new IllegalStateException(task.error());
            state.put("mainTaskId",task.id());state.put("status",task.status());state.put("outputRef",task.outputRef()==null?"":task.outputRef());j.setSegmentJobsJson(state);
            if("succeeded".equals(task.status())){j.setStage("broll");j.setProgress(55);}else j.setProgress(Math.max(25,j.getProgress()));
        } else if("broll".equals(j.getStage())) {
            j.setStage("assemble");j.setStatus("assembling");j.setProgress(80);
        } else {
            if(!j.isMock()){
                String upstream=String.valueOf((j.getSegmentJobsJson()==null?Map.of():j.getSegmentJobsJson()).getOrDefault("outputRef",""));
                if(upstream.isBlank())throw new BusinessException(HttpStatus.BAD_GATEWAY,"CLIP_ENGINE_OUTPUT_MISSING","数字人引擎没有返回成片地址");
                j.setOutputCdnKey(outputStorage.persist(j.getExternalOwnerId(),upstream));
            }
            j.setStatus("succeeded");j.setProgress(100);j.setCompletedAt(now);
            projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull(j.getProjectId(),j.getExternalOwnerId()).ifPresent(p->{j.setDurationSec(p.getDurationSec());p.setStatus("done");p.setProgress(100);p.setUpdatedAt(now);projects.save(p);});
        }
        j.setLeaseOwner(null);j.setLeaseUntil(null);jobs.save(j);
    }

    @Transactional
    public void fail(String id,String message) {
        ClipRenderJob j=jobs.findById(id).orElse(null);if(j==null||Set.of("succeeded","failed","cancelled").contains(j.getStatus()))return;
        Instant now=Instant.now();j.setStatus("failed");j.setErrorMessage(message);j.setCompletedAt(now);j.setUpdatedAt(now);j.setLeaseOwner(null);j.setLeaseUntil(null);jobs.save(j);
        projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull(j.getProjectId(),j.getExternalOwnerId()).ifPresent(p->{p.setStatus("failed");p.setProgress(j.getProgress());p.setUpdatedAt(now);projects.save(p);});
    }
}
