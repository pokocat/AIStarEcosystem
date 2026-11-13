package com.aistareco.ops;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Component;
import java.util.*;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.*;

/** Local deployment control; stops future claims without interrupting accepted work. */
@Component
public class DeploymentRuntime {
    private final AtomicBoolean quiescing=new AtomicBoolean();
    private final AtomicInteger requests=new AtomicInteger();
    private final ObjectProvider<ScheduledAnnotationBeanPostProcessor> scheduled;
    private final Map<String,ThreadPoolTaskExecutor> executors;
    private final Map<String,ThreadPoolTaskScheduler> schedulers;
    private final JdbcTemplate jdbc;
    public DeploymentRuntime(ObjectProvider<ScheduledAnnotationBeanPostProcessor> scheduled,
            Map<String,ThreadPoolTaskExecutor> executors,Map<String,ThreadPoolTaskScheduler> schedulers,JdbcTemplate jdbc) {
        this.scheduled=scheduled;this.executors=executors;this.schedulers=schedulers;this.jdbc=jdbc;
    }
    void entered(){requests.incrementAndGet();}
    void exited(){requests.decrementAndGet();}
    public boolean isQuiescing() { return quiescing.get(); }
    public boolean quiesce() {
        if(!quiescing.compareAndSet(false,true))return false;
        scheduled.orderedStream().forEach(processor->processor.getScheduledTasks().forEach(task->task.cancel(false)));
        return true;
    }
    public Map<String,Object> status() {
        int active=0,queued=0,scheduledActive=0;
        for(var executor:executors.values())try {var pool=executor.getThreadPoolExecutor();active+=pool.getActiveCount();queued+=pool.getQueue().size();}catch(IllegalStateException uninitialized) { /* No accepted work. */ }
        for(var scheduler:schedulers.values())try {scheduledActive+=scheduler.getScheduledThreadPoolExecutor().getActiveCount();}catch(IllegalStateException uninitialized) { }
        Map<String,Long> pending=new LinkedHashMap<>();
        for(String table:List.of("ip_run","material_video_job","aep_publish_jobs","clip_render_job","clip_shot_job","music_gen_job","video_studio_prompt_optimization")) {
            Long count=jdbc.queryForObject("SELECT count(*) FROM "+table+" WHERE status IS NULL OR lower(status) NOT IN ('done','failed','cancelled','canceled','succeeded','completed','success')",Long.class);
            pending.put(table,count==null?-1:count);
        }
        Long count=jdbc.queryForObject("SELECT count(*) FROM ai_generation_queue WHERE state IS NULL OR lower(state) NOT IN ('finished','failed','cancelled','canceled')",Long.class);pending.put("ai_generation_queue",count==null?-1:count);
        Long dialogue=jdbc.queryForObject("SELECT count(*) FROM ip_dialogue_message WHERE lower(status) IN ('running','streaming','generating')",Long.class);pending.put("ip_dialogue_message",dialogue==null?-1:dialogue);
        // Autonomous plans can be between child runs while all child-job counters are zero.
        Long plans=jdbc.queryForObject("SELECT count(*) FROM ip_plan_execution WHERE status IS NULL OR lower(status) = 'running'",Long.class);
        pending.put("ip_plan_execution",plans==null?-1:plans);
        // Vendor callbacks and accepted asset reviews must finish before switching databases.
        Long persons=jdbc.queryForObject("SELECT count(*) FROM video_asset_person WHERE status IS NULL OR (lower(status)='verifying' AND expires_at>CURRENT_TIMESTAMP)",Long.class);
        pending.put("video_asset_person",persons==null?-1:persons);
        Long portraits=jdbc.queryForObject("SELECT count(*) FROM video_asset_portrait WHERE status IS NULL OR lower(status) IN ('uploading','processing')",Long.class);
        pending.put("video_asset_portrait",portraits==null?-1:portraits);
        Long media=jdbc.queryForObject("SELECT count(*) FROM studio_media_job WHERE state IN ('receiving','queued','processing')",Long.class);
        pending.put("studio_media_job",media==null?-1:media);
        boolean drained=quiescing.get()&&requests.get()==0&&active==0&&queued==0&&scheduledActive==0&&pending.values().stream().allMatch(v->v==0);
        return Map.of("quiescing",quiescing.get(),"in_flight",requests.get(),"executor_active",active,"executor_queued",queued,"scheduled_active",scheduledActive,"pending_work",pending,"drained",drained);
    }
}
