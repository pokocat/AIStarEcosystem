package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.model.*;
import com.aistareco.aep.clip.repository.*;
import com.aistareco.aep.clip.service.shiliu.*;
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
    private final ClipAssemblyService assembly;
    public ClipRenderWorkerState(ClipRenderJobRepository jobs, ClipProjectRepository projects, ShiliuService shiliu,
                                 ClipAvatarService avatars, ClipOutputStorage outputStorage, ClipAssemblyService assembly) {
        this.jobs=jobs; this.projects=projects; this.shiliu=shiliu; this.avatars=avatars;
        this.outputStorage=outputStorage; this.assembly=assembly;
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
        if(j.isMock()) {
            ClipProject p=null;
            if("assemble".equals(j.getStage())) {
                p=projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull(j.getProjectId(),j.getExternalOwnerId()).orElseThrow();
                ClipAssemblyService.Result result=assembly.assembleMock(j.getExternalOwnerId(),p);
                j.setOutputCdnKey(result.outputCdnKey());j.setThumbnailCdnKey(result.thumbnailCdnKey());j.setDurationSec(result.durationSec());
                j.setStatus("succeeded");j.setProgress(100);j.setCompletedAt(now);
            } else advanceMock(j, now);
            if("succeeded".equals(j.getStatus())) {
                if(p==null)p=projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull(j.getProjectId(),j.getExternalOwnerId()).orElseThrow();
                p.setDurationSec(j.getDurationSec());p.setStatus("done");p.setProgress(100);p.setUpdatedAt(now);projects.save(p);
            }
            j.setLeaseOwner(null);j.setLeaseUntil(null);jobs.save(j);
            return;
        }
        ClipProject p=projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull(j.getProjectId(),j.getExternalOwnerId()).orElseThrow();
        Map<String,Object> state=j.getSegmentJobsJson()==null?new LinkedHashMap<>():new LinkedHashMap<>(j.getSegmentJobsJson());
        List<Map<String,Object>> segments=ClipDtos.mapListValue(p.getPayloadJson().get("segments"));
        List<Map<String,Object>> rows=stateRows(state,segments);
        if("tts".equals(j.getStage())){
            int total=(int)rows.stream().filter(row->"broll".equals(String.valueOf(row.get("role")))).count();
            Optional<Map<String,Object>> pending=rows.stream()
                    .filter(row->"broll".equals(String.valueOf(row.get("role"))))
                    .filter(row->text(row.get("audioCdnKey")).isBlank()).findFirst();
            if(pending.isPresent()){
                ShiliuGateway gateway=shiliu.required();
                String voiceRef=avatars.requiredVoiceEngineRef(j.getExternalOwnerId());
                Map<String,Object> row=pending.get();
                Map<String,Object> source=segmentByNo(segments,number(row.get("no")));
                ShiliuGateway.Task task=gateway.previewVoice(j.getExternalOwnerId(),voiceRef,text(source.get("text")));
                if(!"succeeded".equals(task.status())||task.outputRef()==null)throw new IllegalStateException("配音生成失败"+(task.error()==null?"":"："+task.error()));
                row.put("audioCdnKey",outputStorage.persistAudio(j.getExternalOwnerId(),task.outputRef()));
                row.put("actualDurationSec",task.durationSec()==null?ClipProjectService.seconds(source):task.durationSec());
                row.put("status","succeeded");
            }
            int done=(int)rows.stream().filter(row->"broll".equals(String.valueOf(row.get("role"))))
                    .filter(row->!text(row.get("audioCdnKey")).isBlank()).count();
            state.put("strategy","segment-text");state.put("segments",rows);j.setSegmentJobsJson(state);
            j.setStatus("generating");j.setStage(done==total?"avatar":"tts");
            j.setProgress(total==0?20:Math.min(20,5+(15*done/total)));
        } else if("avatar".equals(j.getStage())) {
            int total=(int)rows.stream().filter(row->"avatar".equals(String.valueOf(row.get("role")))).count();
            Optional<Map<String,Object>> pending=rows.stream()
                    .filter(row->"avatar".equals(String.valueOf(row.get("role"))))
                    .filter(row->text(row.get("taskId")).isBlank()).findFirst();
            if(pending.isEmpty())pending=rows.stream()
                    .filter(row->"avatar".equals(String.valueOf(row.get("role"))))
                    .filter(row->text(row.get("videoCdnKey")).isBlank()).findFirst();
            if(pending.isPresent()){
                ShiliuGateway gateway=shiliu.required();
                String avatarRef=avatars.requiredAvatarEngineRef(j.getExternalOwnerId());
                String voiceRef=avatars.requiredVoiceEngineRef(j.getExternalOwnerId());
                Map<String,Object> row=pending.get();
                int no=number(row.get("no"));Map<String,Object> source=segmentByNo(segments,no);
                String taskId=text(row.get("taskId"));
                ShiliuGateway.Task task=taskId.isBlank()
                        ?gateway.createVideoByText(j.getExternalOwnerId(),avatarRef,voiceRef,text(source.get("text")))
                        :gateway.query(taskId);
                if("failed".equals(task.status()))throw new IllegalStateException(task.error()==null?"分身出镜段生成失败":task.error());
                row.put("taskId",task.id());row.put("status",task.status());
                if("succeeded".equals(task.status())){
                    if(task.outputRef()==null||task.outputRef().isBlank())throw new IllegalStateException("分身出镜段没有返回视频");
                    row.put("videoCdnKey",outputStorage.persist(j.getExternalOwnerId(),task.outputRef()));
                    row.put("actualDurationSec",task.durationSec()==null?ClipProjectService.seconds(source):task.durationSec());
                }
            }
            int done=(int)rows.stream().filter(row->"avatar".equals(String.valueOf(row.get("role"))))
                    .filter(row->!text(row.get("videoCdnKey")).isBlank()).count();
            state.put("segments",rows);j.setSegmentJobsJson(state);
            if(done==total){j.setStage("broll");j.setProgress(60);}else j.setProgress(Math.max(25,25+(total==0?30:30*done/total)));
        } else if("broll".equals(j.getStage())) {
            boolean ready=rows.stream().filter(row->"broll".equals(String.valueOf(row.get("role"))))
                    .allMatch(row->!text(row.get("audioCdnKey")).isBlank());
            if(!ready)throw new IllegalStateException("配画面段的配音尚未完成");
            j.setStage("assemble");j.setStatus("assembling");j.setProgress(75);
        } else {
            ClipAssemblyService.Result result=assembly.assemble(j.getExternalOwnerId(),p,state);
            j.setOutputCdnKey(result.outputCdnKey());j.setThumbnailCdnKey(result.thumbnailCdnKey());j.setDurationSec(result.durationSec());
            j.setStatus("succeeded");j.setProgress(100);j.setCompletedAt(now);
            p.setDurationSec(result.durationSec());p.setStatus("done");p.setProgress(100);p.setUpdatedAt(now);projects.save(p);
        }
        j.setLeaseOwner(null);j.setLeaseUntil(null);jobs.save(j);
    }

    @Transactional
    public void fail(String id,String message) {
        ClipRenderJob j=jobs.findById(id).orElse(null);if(j==null||Set.of("succeeded","failed","cancelled").contains(j.getStatus()))return;
        Instant now=Instant.now();j.setStatus("failed");j.setErrorMessage(message);j.setCompletedAt(now);j.setUpdatedAt(now);j.setLeaseOwner(null);j.setLeaseUntil(null);jobs.save(j);
        projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull(j.getProjectId(),j.getExternalOwnerId()).ifPresent(p->{p.setStatus("failed");p.setProgress(j.getProgress());p.setUpdatedAt(now);projects.save(p);});
    }

    private static void advanceMock(ClipRenderJob j,Instant now){
        if("tts".equals(j.getStage())){j.setStatus("generating");j.setStage("avatar");j.setProgress(20);}
        else if("avatar".equals(j.getStage())){j.setStage("broll");j.setProgress(60);}
        else if("broll".equals(j.getStage())){j.setStatus("assembling");j.setStage("assemble");j.setProgress(80);}
        else{j.setStatus("succeeded");j.setProgress(100);j.setCompletedAt(now);}
    }

    private static List<Map<String,Object>> stateRows(Map<String,Object> state,List<Map<String,Object>> segments){
        Map<Integer,Map<String,Object>> existing=new LinkedHashMap<>();
        for(Map<String,Object> row:ClipDtos.mapListValue(state.get("segments")))existing.put(number(row.get("no")),row);
        List<Map<String,Object>> rows=new ArrayList<>();
        for(Map<String,Object> segment:segments){
            int no=number(segment.get("no"));Map<String,Object> row=new LinkedHashMap<>(existing.getOrDefault(no,Map.of()));
            row.put("no",no);row.put("role",String.valueOf(segment.get("role")));rows.add(row);
        }
        return rows;
    }
    private static Map<String,Object> segmentByNo(List<Map<String,Object>> segments,int no){
        return segments.stream().filter(row->number(row.get("no"))==no).findFirst().orElseThrow();
    }
    private static int number(Object value){return value instanceof Number n?n.intValue():Integer.parseInt(String.valueOf(value));}
    private static String text(Object value){return value==null?"":String.valueOf(value).trim();}
}
