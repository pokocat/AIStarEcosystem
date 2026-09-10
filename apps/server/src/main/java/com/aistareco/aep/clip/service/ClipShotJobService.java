package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.dto.ClipDtos.*;
import com.aistareco.aep.clip.dto.ClipRequests.GenerateShot;
import com.aistareco.aep.clip.model.*;
import com.aistareco.aep.clip.repository.ClipShotJobRepository;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/**
 * 段级（单镜头）生成的受理层。整片出片是 {@link ClipRenderService}，这里只管「第 N 镜重跑一次」。
 *
 * <p><b>钱的四条口径全部落在这个类里，每条都有对应代码，不是注释里的承诺</b>：
 * <ol>
 *   <li>指纹命中不重扣 —— 已有产物且 fingerprint 相同直接回 succeeded，连任务行都不建；</li>
 *   <li>重复请求不重扣 —— 同一 clientRequestId 回同一单（同 {@code ClipRenderService.render}）；</li>
 *   <li>报价对不上不下单 —— {@code expectedCredits} 与服务端算的不等就 409，钱和任务都不动；</li>
 *   <li>成功才扣 —— 建单时 {@code credits=0} 只写 {@code quotedCredits}，
 *       worker 落 succeeded 那一刻才把报价抄进 credits，失败/取消永远停在 0。</li>
 * </ol>
 *
 * <p><b>t2i / t2v / i2v 目前一律 503</b>：上游能力在 {@code aep/ipstudio}，但那条链的
 * service 层（{@code IpRunService}）绑死在**内网 userId + 钱包账本**上
 * （{@code IpProjectService.required(userId,…)}、{@code CreditService.hold(userId,…)}），
 * 而 clip 域是 Scheme A —— 只有军师的 externalOwnerId，钻石账本在军师那边，这里一分不碰。
 * 硬接等于给每个外部用户伪造一个内网用户和钱包，然后在两个账本上各扣一次。宁可明说没接。
 */
@Service
public class ClipShotJobService {
    /** 端上能点的四种生成方式。avatar 走石榴，其余三种走 ip studio（尚未接通）。 */
    private static final Set<String> MODELS = Set.of("avatar", "t2i", "t2v", "i2v");
    static final Set<String> TERMINAL = Set.of("succeeded", "failed", "cancelled");
    private final ClipShotJobRepository jobs; private final ClipProjectService projects; private final ClipEstimateService estimates;
    private final ShiliuService shiliu; private final ClipProperties props; private final FileStorageService storage;
    public ClipShotJobService(ClipShotJobRepository jobs, ClipProjectService projects, ClipEstimateService estimates,
                              ShiliuService shiliu, ClipProperties props, FileStorageService storage) {
        this.jobs=jobs; this.projects=projects; this.estimates=estimates; this.shiliu=shiliu; this.props=props; this.storage=storage;
    }

    @Transactional
    public ShotGenerateResult generate(String owner, String projectId, int shotNo, GenerateShot r) {
        if (r == null || r.clientRequestId() == null || !r.clientRequestId().matches("[A-Za-z0-9:_-]{8,100}")) throw BusinessException.badRequest("CLIENT_REQUEST_ID_REQUIRED", "缺少合法的请求标识");
        String model = text(r.model());
        if (!MODELS.contains(model)) throw BusinessException.badRequest("CLIP_SHOT_MODEL_INVALID", "不支持的分段生成模型");
        ClipProject p = projects.required(owner, projectId);
        Map<String,Object> shot = requiredShot(p, shotNo);
        String fingerprint = text(r.fingerprint());

        // ①指纹命中：这一镜已经有产物，而且端上算出来的内容指纹没变 —— 直接回，不重跑、不重扣。
        Map<String,Object> done = ClipShotPlan.artifact(shot);
        if (!fingerprint.isBlank() && fingerprint.equals(text(done.get("fingerprint"))) && !text(done.get("cdnKey")).isBlank()) {
            ClipShotJob origin = jobs.findFirstByExternalOwnerIdAndProjectIdAndShotNoAndFingerprintAndStatusOrderByCreatedAtDesc(owner, projectId, shotNo, fingerprint, "succeeded").orElse(null);
            return new ShotGenerateResult(origin == null ? null : origin.getId(), "succeeded", origin == null ? 0 : origin.getCredits(), shiliu.mockMode());
        }
        // ②幂等：同一个 clientRequestId 重复提交回同一单，绝不建第二单（同 ClipRenderService.render）。
        ClipShotJob prior = jobs.findByExternalOwnerIdAndClientRequestId(owner, r.clientRequestId()).orElse(null);
        if (prior != null) {
            if (!projectId.equals(prior.getProjectId()) || prior.getShotNo() != shotNo || !model.equals(prior.getModel())) throw new BusinessException(HttpStatus.CONFLICT, "CLIP_SHOT_REQUEST_CONFLICT", "同一请求标识对应的生成内容不同");
            return new ShotGenerateResult(prior.getId(), prior.getStatus(), prior.getCredits(), prior.isMock());
        }
        // ③引擎可用性先于报价：报价对不上是端上的口径问题，引擎没接是我们的问题，后者才是用户真正卡住的原因。
        if ("avatar".equals(model)) {
            if (ClipProjectService.seconds(shot) > props.getMaxAvatarSegmentSec()) throw BusinessException.badRequest("CLIP_SEGMENT_TOO_LONG", "单个出镜段超过引擎时长上限");
            shiliu.required();
        } else {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "CLIP_ENGINE_NOT_CONFIGURED", "文生图 / 文生视频 / 图生视频引擎尚未接入");
        }
        // ④报价核对。对不上就 409，钱和任务行都不动；details 带上服务端算出来的数，
        //   端上口径漂了能一眼对上，而不是抓瞎重试。
        int quote = estimates.shotQuote(model, shot);
        if (r.expectedCredits() == null || r.expectedCredits() != quote) throw new BusinessException(HttpStatus.CONFLICT, "CLIP_QUOTE_CHANGED", "这一段的报价已变化，请重新确认", Map.of("expectedCredits", quote));

        Instant now = Instant.now();
        // credits 建单时恒为 0：这是「成功才扣」的落点 —— 报价只写在 quotedCredits 上，
        // 由 worker 在落 succeeded 的同一个事务里抄过去。中途失败/取消，credits 永远是 0。
        ClipShotJob job = ClipShotJob.builder().id("csj_"+uuid()).externalOwnerId(owner).projectId(projectId).shotNo(shotNo)
                .clientRequestId(r.clientRequestId()).model(model).status("queued").progress(0).quotedCredits(quote).credits(0)
                .fingerprint(fingerprint.isBlank()?null:fingerprint).prompt(text(r.prompt()).isBlank()?null:text(r.prompt()))
                .mock(shiliu.mockMode()).heartbeatAt(now).createdAt(now).updatedAt(now).build();
        jobs.save(job);
        return new ShotGenerateResult(job.getId(), job.getStatus(), job.getCredits(), job.isMock());
    }

    /**
     * 这一镜现在什么状态。
     *
     * <p>没有任务行、这一镜也没有产物时回 {@code none} 而不是 404 —— 端上靠 none 判断
     * 「这一单没了，可以重新生成」，404 会被它的错误通道吃掉，用户看到的是一句报错。
     *
     * <p>没有任务行但**有产物**时回 succeeded：产物的真源是项目 payload，不是任务行。
     * 任务行会被清理，产物只要还在存储里就该拿得到 —— 这正是「换台手机产物还在」那条要求。
     */
    @Transactional(readOnly = true)
    public ShotGenerationDto generation(String owner, String projectId, int shotNo) {
        ClipProject p = projects.required(owner, projectId);
        Map<String,Object> shot = requiredShot(p, shotNo);
        ClipShotJob job = jobs.findFirstByExternalOwnerIdAndProjectIdAndShotNoOrderByCreatedAtDesc(owner, projectId, shotNo).orElse(null);
        if (job == null) {
            ShotArtifactDto stored = artifactOf(ClipShotPlan.artifact(shot));
            return stored == null ? ShotGenerationDto.none() : new ShotGenerationDto(null, "succeeded", 100, stored, 0, null, null);
        }
        return view(job, shot);
    }

    /** 取消在跑的那一单，不扣费（credits 本来就还是 0）。已经结束的直接回当前状态，不报错。 */
    @Transactional
    public ShotGenerationDto cancel(String owner, String projectId, int shotNo) {
        ClipProject p = projects.required(owner, projectId);
        Map<String,Object> shot = requiredShot(p, shotNo);
        ClipShotJob job = jobs.findFirstByExternalOwnerIdAndProjectIdAndShotNoOrderByCreatedAtDesc(owner, projectId, shotNo).orElse(null);
        if (job == null) return ShotGenerationDto.none();
        if (TERMINAL.contains(job.getStatus())) return view(job, shot);
        Instant now = Instant.now();
        job.setStatus("cancelled"); job.setErrorCode("CLIP_SHOT_CANCELLED"); job.setErrorMessage("用户已取消");
        job.setLeaseOwner(null); job.setLeaseUntil(null); job.setCompletedAt(now); job.setUpdatedAt(now);
        jobs.save(job);
        return view(job, shot);
    }

    /** {@code no} 是镜头序号（materialize 后的第几镜，从 1 开始），不是句号。 */
    public static Map<String,Object> requiredShot(ClipProject p, int shotNo) {
        List<Map<String,Object>> shots = ClipShotPlan.materialize(p.getPayloadJson());
        if (shotNo < 1 || shotNo > shots.size()) throw BusinessException.notFound("CLIP_SHOT_NOT_FOUND", "这一镜不存在（共 "+shots.size()+" 镜）");
        return shots.get(shotNo - 1);
    }

    /**
     * 有任务行时**只报这一单自己产出的东西**。失败/取消/还在跑的一律 {@code artifact:null}，
     * 哪怕这一镜身上还挂着上一版留下的产物 —— 把它挂在一条取消掉的单子上，
     * 端上会以为「取消了但还是出了东西」，指纹还对不上。上一版的产物端上从项目 payload 里本来就看得到。
     */
    private ShotGenerationDto view(ClipShotJob job, Map<String,Object> shot) {
        ShotArtifactDto artifact = job.getArtifactCdnKey() == null || job.getArtifactCdnKey().isBlank() ? null
                : new ShotArtifactDto(storage.signedUrl(job.getArtifactCdnKey()), job.getFingerprint(), job.getArtifactDurationSec(), storage.signedUrl(job.getArtifactPosterCdnKey()));
        // jobId 必须回出去：军师那边按它认领这一单的预扣（settleVideoJob 的键就是它）。
        // 不带的话终态到了也结算不了 —— 失败的段钱一直挂着，只能等对账扫描来救。
        return new ShotGenerationDto(job.getId(), job.getStatus(), job.getProgress(), artifact, job.getCredits(), job.getErrorCode(), job.getErrorMessage());
    }

    /** payload 里存的是存储 key，签名 URL 现签现给 —— 落库的签名几小时后必然 403。 */
    private ShotArtifactDto artifactOf(Map<String,Object> artifact) {
        String key = text(artifact.get("cdnKey"));
        if (key.isBlank()) return null;
        return new ShotArtifactDto(storage.signedUrl(key), text(artifact.get("fingerprint")).isBlank()?null:text(artifact.get("fingerprint")),
                artifact.get("durationSec") instanceof Number n ? n.doubleValue() : 0, storage.signedUrl(text(artifact.get("posterCdnKey"))));
    }

    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    private static String uuid() { return UUID.randomUUID().toString().replace("-", "").substring(0, 16); }
}
