package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.model.ClipShotJob;
import com.aistareco.aep.clip.repository.ClipShotJobRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.*;

/** 段级生成的调度环。形制照 {@link ClipRenderWorker}：租约 + 心跳 + 独立 reaper。 */
@Component
public class ClipShotJobWorker {
    private static final List<String> ACTIVE=List.of("queued","running");
    private final String workerId="clip-shot-worker-"+UUID.randomUUID().toString().substring(0,8);
    private final ClipShotJobRepository jobs;private final ClipShotJobWorkerState state;private final ClipProperties props;
    public ClipShotJobWorker(ClipShotJobRepository jobs,ClipShotJobWorkerState state,ClipProperties props){this.jobs=jobs;this.state=state;this.props=props;}

    @Scheduled(fixedDelayString="${aep.clip.shot-worker-delay-ms:2000}")
    public void tick(){
        for(ClipShotJob row:jobs.findTop20ByStatusInOrderByCreatedAtAsc(ACTIVE)){
            try{
                if(state.acquire(row.getId(),workerId,ACTIVE)==0)continue;
                state.advance(row.getId(),workerId);
            }catch(Exception e){state.fail(row.getId(),errorCode(e),"这一镜生成失败："+safe(e.getMessage()));}
        }
    }

    /** 重启/崩溃后非终态不会永久卡住。卡死的单子也一分不扣 —— credits 从头到尾没被写过。 */
    @Scheduled(fixedDelayString="${aep.clip.shot-reaper-delay-ms:60000}")
    public void reap(){Instant cutoff=Instant.now().minusMillis(Math.max(60_000,props.getStaleMs()));for(ClipShotJob j:jobs.findTop100ByStatusInAndHeartbeatAtBefore(ACTIVE,cutoff))state.fail(j.getId(),"CLIP_SHOT_TIMEOUT","这一镜长时间无心跳，已自动终止");}
    /** 端上要的是一个稳定可判的码，不是一句话。业务异常自带码，其余一律算引擎调用失败。 */
    private static String errorCode(Exception e){
        return e instanceof com.aistareco.common.BusinessException be&&be.getCode()!=null&&!be.getCode().isBlank()
                ?be.getCode():"CLIP_ENGINE_CALL_FAILED";
    }
    private static String safe(String s){if(s==null||s.isBlank())return"未知错误";return s.substring(0,Math.min(160,s.length()));}
}
