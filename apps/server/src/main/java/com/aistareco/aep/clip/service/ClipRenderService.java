package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos.*;
import com.aistareco.aep.clip.model.*;
import com.aistareco.aep.clip.repository.*;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
public class ClipRenderService {
    private final ClipRenderJobRepository jobs; private final ClipProjectRepository projectRepo; private final ClipProjectService projects; private final ClipEstimateService estimates; private final ShiliuService shiliu;
    public ClipRenderService(ClipRenderJobRepository jobs, ClipProjectRepository projectRepo, ClipProjectService projects, ClipEstimateService estimates, ShiliuService shiliu) { this.jobs=jobs; this.projectRepo=projectRepo; this.projects=projects; this.estimates=estimates; this.shiliu=shiliu; }

    @Transactional
    public RenderResult render(String owner,String projectId,String clientRequestId,Integer externalCreditsHeld) {
        if(clientRequestId==null||!clientRequestId.matches("[A-Za-z0-9:_-]{8,100}")) throw BusinessException.badRequest("CLIENT_REQUEST_ID_REQUIRED","缺少合法的请求标识");
        ClipProject p=projects.required(owner,projectId); EstimateDto quote=estimates.estimate(owner,projectId,null,null); estimates.preflight(owner,p); shiliu.required();
        if(externalCreditsHeld==null||externalCreditsHeld!=quote.total()) throw new BusinessException(HttpStatus.CONFLICT,"CLIP_QUOTE_CHANGED","出片报价已变化，请重新确认");
        ClipRenderJob existing=jobs.findByExternalOwnerIdAndClientRequestId(owner,clientRequestId).orElse(null);
        if(existing!=null){ if(!projectId.equals(existing.getProjectId())||externalCreditsHeld!=existing.getCreditsHeld()) throw new BusinessException(HttpStatus.CONFLICT,"CLIP_RENDER_REQUEST_CONFLICT","同一请求标识对应的出片内容不同"); return new RenderResult(existing.getId(),projectId,existing.getStatus(),existing.isMock()); }
        Instant now=Instant.now(); ClipRenderJob job=ClipRenderJob.builder().id("cj_"+uuid()).externalOwnerId(owner).projectId(projectId).clientRequestId(clientRequestId).status("queued").stage("tts").progress(0).heartbeatAt(now).creditsHeld(externalCreditsHeld).mock(shiliu.mockMode()).createdAt(now).updatedAt(now).build();
        jobs.save(job); p.setStatus("generating"); p.setProgress(0); p.setCreditsHeld(externalCreditsHeld); p.setUpdatedAt(now); projectRepo.save(p); return new RenderResult(job.getId(),projectId,job.getStatus(),job.isMock());
    }
    public JobDto get(String owner,String id){ return JobDto.from(required(owner,id)); }
    @Transactional public JobDto cancel(String owner,String id){ ClipRenderJob j=required(owner,id); if(Set.of("succeeded","failed","cancelled").contains(j.getStatus()))return JobDto.from(j); j.setStatus("cancelled");j.setErrorMessage("用户已取消");j.setLeaseOwner(null);j.setLeaseUntil(null);j.setCompletedAt(Instant.now());j.setUpdatedAt(Instant.now());jobs.save(j); failProject(j,"failed");return JobDto.from(j); }
    public ClipRenderJob required(String owner,String id){return jobs.findByIdAndExternalOwnerId(id,owner).orElseThrow(()->BusinessException.notFound("CLIP_JOB_NOT_FOUND","出片任务不存在或无权访问"));}
    /**
     * 出片没成时把项目**放回可编辑**。
     *
     * ClipProjectService.save 只放行 status=="draft"，而全仓从来没有任何一处把状态改回 draft。
     * 于是出片一旦失败或被取消，项目就永久锁死：用户想改一句话重出都不行，只能从头新建一个。
     * 出片失败本来就是我们这边的问题，不该由用户重做一遍全部工作来承担。
     *
     * 语义拆开看：项目的 status 表达的是「还能不能编辑」，任务的成败由 ClipRenderJob 自己记，
     * 所以这里回落到 draft 不会丢失任何失败信息。
     */
    @Transactional public void failProject(ClipRenderJob j,String status){ releaseProject(j); }

    /**
     * 出片没成时把项目**放回可编辑**。取消与 worker 失败两条路径都收口到这里。
     *
     * ⚠️ 活跃 job 守卫：一个项目可能先后下过多单（失败后重出就是）。如果一个**旧** job 现在才
     * 走到失败/取消，而项目已经被一个**新** job 重新占用（status=generating），
     * 这时把它重置成 draft 会让用户在新任务跑着的时候继续改内容，污染那一单。
     * 所以只有当项目当前不在生成中时才释放；正在生成说明有更新的一单在管它。
     */
    @Transactional public void releaseProject(ClipRenderJob j){
        projectRepo.findByIdAndExternalOwnerIdAndDeletedAtIsNull(j.getProjectId(),j.getExternalOwnerId()).ifPresent(p->{
            if(!"generating".equals(p.getStatus())) return;
            ClipRenderJob latest=jobs.findFirstByProjectIdAndExternalOwnerIdOrderByCreatedAtDesc(p.getId(),p.getExternalOwnerId()).orElse(null);
            if(latest!=null&&!latest.getId().equals(j.getId())) return;
            p.setStatus("draft");p.setProgress(0);p.setUpdatedAt(Instant.now());projectRepo.save(p);
        });
    }
    private static String uuid(){return UUID.randomUUID().toString().replace("-","").substring(0,16);}
}
