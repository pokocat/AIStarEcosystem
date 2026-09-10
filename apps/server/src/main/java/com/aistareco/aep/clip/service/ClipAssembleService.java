package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.dto.ClipDtos.AssembleResult;
import com.aistareco.aep.clip.model.*;
import com.aistareco.aep.clip.repository.*;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/**
 * 总装单独下单。**只把已有产物 + 素材段 + 封面 + 片尾接成一条片子，一个生成调用都不发。**
 *
 * <p>为什么要把它从 render worker 里拆出来：{@code ClipAssemblyService.assemble} 原本只是
 * 整片流水线的最后一个 stage（tts → avatar → broll → assemble），进不去也出不来。
 * 段级链路下用户是一镜一镜生成、一镜一镜付钱的，到最后只想为「接起来」这一步付一次钱，
 * 不该被逼着把整条流水线从头再跑一遍 —— 那会把已经生成好的镜头全部重跑重扣。
 *
 * <p>实现上不新开 worker：造一条 {@code stage=assemble} 的 {@link ClipRenderJob}，
 * 把各镜已落库的产物预先摆进 {@code segmentJobsJson}，剩下的交给现成的 render worker
 * —— 它那条 else 分支本来就只做总装。轮询也因此继续走 {@code /jobs/{id}}，端上不用学新东西。
 *
 * <p><b>这条单子的 mock 恒为 false</b>，哪怕引擎跑在 mock 网关下：总装消费的是**已经落库的真产物**
 * （产物本身是不是 mock 生成的与它无关）。走 {@code assembleMock} 会把这些产物丢掉重画一遍色块，
 * 那就不是「只接不生成」了。
 */
@Service
public class ClipAssembleService {
    private final ClipRenderJobRepository jobs; private final ClipShotJobRepository shotJobs; private final ClipProjectRepository projectRepo;
    private final ClipProjectService projects; private final ClipEstimateService estimates; private final ClipTtsPreviewRepository ttsPreviews;
    private final ClipTtsPreviewService ttsPreviewService; private final ClipAssetService assets;
    public ClipAssembleService(ClipRenderJobRepository jobs, ClipShotJobRepository shotJobs, ClipProjectRepository projectRepo,
                               ClipProjectService projects, ClipEstimateService estimates, ClipTtsPreviewRepository ttsPreviews,
                               ClipTtsPreviewService ttsPreviewService, ClipAssetService assets) {
        this.jobs=jobs; this.shotJobs=shotJobs; this.projectRepo=projectRepo; this.projects=projects;
        this.estimates=estimates; this.ttsPreviews=ttsPreviews; this.ttsPreviewService=ttsPreviewService; this.assets=assets;
    }

    @Transactional
    public AssembleResult assemble(String owner, String projectId, String clientRequestId, Integer expectedCredits) {
        if (clientRequestId == null || !clientRequestId.matches("[A-Za-z0-9:_-]{8,100}")) throw BusinessException.badRequest("CLIENT_REQUEST_ID_REQUIRED", "缺少合法的请求标识");
        ClipProject p = projects.required(owner, projectId);
        // 幂等先于报价：重复提交必须回同一单，不能因为中间调过价就把重试挡在门外又留下一条半拉子任务。
        ClipRenderJob prior = jobs.findByExternalOwnerIdAndClientRequestId(owner, clientRequestId).orElse(null);
        if (prior != null) {
            if (!projectId.equals(prior.getProjectId())) throw new BusinessException(HttpStatus.CONFLICT, "CLIP_RENDER_REQUEST_CONFLICT", "同一请求标识对应的出片内容不同");
            return new AssembleResult(prior.getId(), projectId, prior.getStatus());
        }
        List<Map<String,Object>> shots = ClipShotPlan.materialize(p.getPayloadJson());
        if (shots.isEmpty()) throw BusinessException.badRequest("CLIP_NO_SEGMENTS", "文案还是空的");
        Map<String,Object> state = collect(owner, p, shots);
        int quote = estimates.assembleQuote();
        if (expectedCredits == null || expectedCredits != quote) throw new BusinessException(HttpStatus.CONFLICT, "CLIP_QUOTE_CHANGED", "总装报价已变化，请重新确认", Map.of("expectedCredits", quote));

        Instant now = Instant.now();
        ClipRenderJob job = ClipRenderJob.builder().id("cj_"+UUID.randomUUID().toString().replace("-","").substring(0,16))
                .externalOwnerId(owner).projectId(projectId).clientRequestId(clientRequestId)
                .status("assembling").stage("assemble").progress(75).heartbeatAt(now)
                .creditsHeld(quote).segmentJobsJson(state).mock(false).createdAt(now).updatedAt(now).build();
        jobs.save(job);
        // 项目上记的是**这条片子到目前为止真的花掉的钱**：已成功的段级任务实扣之和 + 这次总装。
        // 只记总装那一档会让作品页把一条花了几十钻的片子显示成几钻。
        p.setStatus("generating"); p.setProgress(75); p.setCreditsHeld(spentOnShots(owner, projectId) + quote); p.setUpdatedAt(now); projectRepo.save(p);
        return new AssembleResult(job.getId(), projectId, job.getStatus());
    }

    /**
     * 把各镜已落库的产物摆成 {@code ClipAssemblyService.assemble} 认识的形状，
     * **顺手把缺产物的镜头全部点名挡在提交之前**。
     *
     * <p>一次报全部而不是遇到第一个就抛：用户缺三镜时应该一次看清是哪三镜，
     * 而不是补一镜、再提交、再被挡一次，来回三趟。
     */
    private Map<String,Object> collect(String owner, ClipProject p, List<Map<String,Object>> shots) {
        Map<Integer,String> audio = ttsAudio(owner, p);
        List<Map<String,Object>> rows = new ArrayList<>(); List<Map<String,Object>> missing = new ArrayList<>();
        for (Map<String,Object> shot : shots) {
            int no = number(shot.get("no")); String role = String.valueOf(shot.get("role"));
            Map<String,Object> row = new LinkedHashMap<>(); row.put("no", no); row.put("role", role);
            if ("avatar".equals(role)) {
                String key = text(ClipShotPlan.artifact(shot).get("cdnKey"));
                if (key.isBlank()) missing.add(Map.of("shotNo", no, "role", role, "reason", "还没有生成出镜画面"));
                else row.put("videoCdnKey", key);
            } else if ("broll".equals(role)) {
                String assetId = text(shot.get("assetId"));
                if (assetId.isBlank()) missing.add(Map.of("shotNo", no, "role", role, "reason", "还没有选择画面素材"));
                else assets.requiredVisible(owner, assetId);
                String key = text(audio.get(no));
                if (key.isBlank()) missing.add(Map.of("shotNo", no, "role", role, "reason", "还没有这一版文案的配音"));
                else row.put("audioCdnKey", key);
            }
            rows.add(row);
        }
        if (!missing.isEmpty()) throw new BusinessException(HttpStatus.CONFLICT, "CLIP_SHOT_ARTIFACT_MISSING",
                "还有 " + missing.size() + " 镜没有可用产物：第 " + missing.stream().map(row -> String.valueOf(row.get("shotNo"))).reduce((a,b) -> a + "、" + b).orElse("") + " 镜", Map.of("missing", missing));
        Map<String,Object> state = new LinkedHashMap<>(); state.put("strategy", "assemble-only-v1"); state.put("segments", rows); return state;
    }

    /**
     * 配画面段的配音只认**当前这一版文案**的预览结果（timelineHash 相同）。
     * 文案改过而预览没重跑时宁可判缺产物，也不能把上一版的声音接进这一版的画面里。
     */
    private Map<Integer,String> ttsAudio(String owner, ClipProject p) {
        ClipTtsPreview row = ttsPreviews.findByExternalOwnerIdAndProjectId(owner, p.getId()).orElse(null);
        if (row == null || !ttsPreviewService.timeline(p).hash().equals(row.getTimelineHash())) return Map.of();
        Map<Integer,String> result = new LinkedHashMap<>();
        for (Map<String,Object> item : ClipDtos.mapListValue(ClipDtos.safeMap(row.getSegmentsJson()).get("items"))) {
            String key = text(item.get("audioCdnKey")); if (!key.isBlank()) result.put(number(item.get("no")), key);
        }
        return result;
    }

    private int spentOnShots(String owner, String projectId) {
        return shotJobs.findByProjectId(projectId).stream()
                .filter(j -> owner.equals(j.getExternalOwnerId()) && "succeeded".equals(j.getStatus()))
                .mapToInt(ClipShotJob::getCredits).sum();
    }
    private static int number(Object value) { return value instanceof Number n ? n.intValue() : -1; }
    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
}
