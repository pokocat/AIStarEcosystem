package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.model.ClipRenderJob;
import com.aistareco.aep.clip.repository.ClipRenderJobRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.*;

@Component
public class ClipRenderWorker {
    private static final List<String> ACTIVE=List.of("queued","generating","assembling");
    private final String workerId="clip-worker-"+UUID.randomUUID().toString().substring(0,8);
    private final ClipRenderJobRepository jobs;private final ClipRenderWorkerState state;private final ClipProperties props;
    public ClipRenderWorker(ClipRenderJobRepository jobs,ClipRenderWorkerState state,ClipProperties props){this.jobs=jobs;this.state=state;this.props=props;}

    @Scheduled(fixedDelayString="${aep.clip.worker-delay-ms:2000}")
    public void tick(){
        for(ClipRenderJob row:jobs.findTop20ByStatusInOrderByCreatedAtAsc(ACTIVE)){
            try{
                if(state.acquire(row.getId(),workerId,ACTIVE)==0)continue;
                state.advance(row.getId(),workerId);
            }catch(Exception e){state.fail(row.getId(),errorCode(e),"视频生成失败："+safe(e.getMessage()));}
        }
    }

    /** 与普通 worker 独立的 stale reaper：重启/崩溃后非终态不会永久卡住。 */
    @Scheduled(fixedDelayString="${aep.clip.reaper-delay-ms:60000}")
    public void reap(){Instant cutoff=Instant.now().minusMillis(Math.max(60_000,props.getStaleMs()));for(ClipRenderJob j:jobs.findTop100ByStatusInAndHeartbeatAtBefore(ACTIVE,cutoff))state.fail(j.getId(),"CLIP_RENDER_TIMEOUT","任务长时间无心跳，已自动终止");}
    /** 段级状态要的是一个稳定可判的码，不是一句话。业务异常自带码，其余一律算引擎调用失败。 */
    private static String errorCode(Exception e){
        return e instanceof com.aistareco.common.BusinessException be&&be.getCode()!=null&&!be.getCode().isBlank()
                ?be.getCode():"CLIP_ENGINE_CALL_FAILED";
    }
    private static String safe(String s){if(s==null||s.isBlank())return"未知错误";return s.substring(0,Math.min(160,s.length()));}
}
