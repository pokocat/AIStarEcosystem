package com.aistareco.aep.service;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.materialvideo.MaterialVideoWorker;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.slf4j.*;

/** Re-dispatch durable waiting tickets, including after restart; accepted media only resume original jobs. */
@Service
public class AiGenerationQueueDispatcher {
    private static final Logger log=LoggerFactory.getLogger(AiGenerationQueueDispatcher.class);
    private final AiGenerationQueueService queue;
    private final IpRunRepository runs;
    private final MaterialVideoJobRepository videos;
    private final ObjectProvider<IpRunWorker> images;
    private final ObjectProvider<StudioWorkflowWorker> workflows;
    private final ObjectProvider<StudioSpeechWorker> speech;
    private final ObjectProvider<MaterialVideoWorker> videoWorker;
    @org.springframework.beans.factory.annotation.Autowired private com.fasterxml.jackson.databind.ObjectMapper mapper;
    public AiGenerationQueueDispatcher(AiGenerationQueueService queue,IpRunRepository runs,MaterialVideoJobRepository videos,
            ObjectProvider<IpRunWorker> images,ObjectProvider<StudioWorkflowWorker> workflows,
            ObjectProvider<StudioSpeechWorker> speech,ObjectProvider<MaterialVideoWorker> videoWorker) {
        this.queue=queue;this.runs=runs;this.videos=videos;this.images=images;this.workflows=workflows;this.speech=speech;this.videoWorker=videoWorker;
    }
    @Scheduled(fixedDelay=3_000,initialDelay=5_000)
    public void dispatch() {
        discoverCommittedTasks();
        for(var entry:queue.openEntries()) try {
            String type=entry.getTaskType(),id=entry.getTaskId();boolean waiting="waiting".equals(entry.getState());
            if(AiGenerationQueueService.SYNC.equals(type)) {
                if(entry.getDispatchAfter().isBefore(java.time.Instant.now()))queue.expireSynchronous(entry);
                continue; // synchronous HTTP callers own execution; never replay them after a restart
            }
            if(AiGenerationQueueService.VIDEO.equals(type)) {
                var job=videos.findById(id).orElse(null);
                if(job==null || (waiting && !"queued".equals(job.getStatus()))) {queue.finish(type,id);continue;}
                if(!waiting) {
                    if(queue.claimDispatch(entry,true))videoWorker.getObject().recoverQueuedGeneration(id);
                    continue;
                }
            } else {
                var run=runs.findById(id).orElse(null);
                if(run==null||!IpRun.STATUS_RUNNING.equals(run.getStatus())) {queue.finish(type,id);continue;}
                // Waiting is not execution time. Reaper and hold sweeper recognize the durable ticket.
                if(!waiting)continue;
            }
            if(queue.claimDispatch(entry,false))switch(type) {
                case AiGenerationQueueService.IMAGE -> images.getObject().execute(id);
                case AiGenerationQueueService.WORKFLOW -> workflows.getObject().execute(id);
                case AiGenerationQueueService.SPEECH -> speech.getObject().execute(id);
                case AiGenerationQueueService.VIDEO -> videoWorker.getObject().generateAsync(id);
                default -> log.error("Unknown generation queue type {}",type);
            }
        } catch(Exception error){log.warn("[generation-queue] dispatch deferred ticket={} reason={}",entry.getId(),error.getClass().getSimpleName());}
    }
    private void discoverCommittedTasks() {
        for(var run:runs.findByStatus(IpRun.STATUS_RUNNING)) try {
            String type;com.aistareco.aep.model.AiModelPurpose purpose;
            switch(run.getKind()) {
                case "generate" -> {type=AiGenerationQueueService.IMAGE;purpose=com.aistareco.aep.model.AiModelPurpose.DAP_IMAGE;}
                case "identity" -> {type=AiGenerationQueueService.IMAGE;purpose=com.aistareco.aep.model.AiModelPurpose.DAP_PERSONA;}
                case "studio-script","studio-storyboard","studio-assistant" -> {type=AiGenerationQueueService.WORKFLOW;purpose=com.aistareco.aep.model.AiModelPurpose.DAP_PERSONA;}
                case "studio-audio" -> {type=AiGenerationQueueService.SPEECH;purpose=com.aistareco.aep.model.AiModelPurpose.DAP_AUDIO;}
                case "studio-lip-sync" -> {type=AiGenerationQueueService.SPEECH;purpose=com.aistareco.aep.model.AiModelPurpose.DAP_LIP_SYNC;}
                default -> {continue;}
            }
            var exec=mapper.readTree(run.getInputJson()).path("_exec");
            boolean executing=run.getStartedAt()!=null&&!"endpoint.queued".equals(run.getStage());
            // Older speech runs don't have startedAt, but an accepted/uncertain submission still consumes capacity.
            if(AiGenerationQueueService.SPEECH.equals(type))
                executing=executing||!exec.path("jobId").asText("").isBlank()||exec.path("submitAttempts").asInt()>0;
            queue.register(type,run.getId(),queue.endpointFor(purpose,exec.path("endpointId").asText(null)),executing);
        } catch(Exception error){log.warn("[generation-queue] discovery deferred run={}",run.getId());}
        for(var job:videos.findByStatusIn(java.util.List.of("queued","submitting","generating"))) try {
            String selected=job.getVariantConfigJson()==null?null:mapper.readTree(job.getVariantConfigJson()).path("endpoint_id").asText(null);
            queue.register(AiGenerationQueueService.VIDEO,job.getId(),queue.endpointFor(com.aistareco.aep.model.AiModelPurpose.VIDEO_GENERATION,selected),!"queued".equals(job.getStatus()));
        } catch(Exception error){log.warn("[generation-queue] discovery deferred video={}",job.getId());}
    }
}
