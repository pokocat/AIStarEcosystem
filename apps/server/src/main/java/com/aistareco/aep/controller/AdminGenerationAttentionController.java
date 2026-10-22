package com.aistareco.aep.controller;

import com.aistareco.aep.repository.AiGenerationQueueRepository;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.List;

/** Read-only alerts from original task records. No provider calls or settlement writes. */
@RestController
@org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('SUPER_ADMIN', 'OPERATOR')")
@RequestMapping("/api/admin/ai-generation-attention")
public class AdminGenerationAttentionController {
    private final AiGenerationQueueRepository queue;
    private final MaterialVideoJobRepository videos;
    private final IpRunRepository runs;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper;
    public AdminGenerationAttentionController(AiGenerationQueueRepository queue, MaterialVideoJobRepository videos,
            IpRunRepository runs, com.fasterxml.jackson.databind.ObjectMapper mapper) {
        this.queue=queue;this.videos=videos;this.runs=runs;this.mapper=mapper;
    }
    public record Item(String taskType,String taskId,String endpointId,Instant createdAt,String status,String errorCode,String errorMessage,String logId) {}
    public record Inbox(List<Item> items,int page,long total,boolean hasMore) {}
    @GetMapping
    @org.springframework.transaction.annotation.Transactional(readOnly=true)
    public ApiResponse<Inbox> list(@RequestParam(defaultValue="0") int page) {
        var entries=queue.findNeedingAttention(PageRequest.of(Math.max(0,page),20));
        var items=entries.map(q->{
            String status=null,code=null,message=null,logId=null;
            if("material-video".equals(q.getTaskType())) {
                var job=videos.findById(q.getTaskId()).orElse(null);
                if(job!=null) {status=job.getStatus();code=job.getErrorCode();message=job.getErrorMessage();}
            } else {
                var run=runs.findById(q.getTaskId()).orElse(null);
                if(run!=null) {
                    status=run.getStatus();code=run.getErrorCode();message=run.getErrorMessage();
                    try {logId=mapper.readTree(run.getOutputJson()).path("logId").asText(null);}catch(Exception ignored){}
                }
            }
            if(logId==null && message!=null) {
                var match=java.util.regex.Pattern.compile("追查号\\s+([A-Z2-9]{12})").matcher(message);
                if(match.find())logId=match.group(1);
            }
            return new Item(q.getTaskType(),q.getTaskId(),q.getEndpointId(),q.getCreatedAt(),status,code,message,logId);
        }).getContent();
        return ApiResponse.of(new Inbox(items,entries.getNumber(),entries.getTotalElements(),entries.hasNext()));
    }
}
