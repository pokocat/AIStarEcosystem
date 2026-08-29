package com.aistareco.aep.service.music;

import com.aistareco.aep.dto.MusicGenJobDto;
import com.aistareco.aep.model.MusicGenJob;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.aep.repository.MusicGenJobRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 音乐生成任务编排：下单、查单、列表。真正的生成在 {@link MusicGenWorker}。
 *
 * <p><b>扣费顺序是这套模式的核心，不能改</b>：
 * <ol>
 *   <li>preflight（端点是否配置 / 参数是否合法）—— 失败在这里，什么都没建、没冻结；</li>
 *   <li>定价；</li>
 *   <li>{@code creditService.hold}（余额不足抛 402，整个事务回滚）；</li>
 *   <li>落库；</li>
 *   <li>{@code afterCommit} 才派发 worker —— worker 用新事务，commit 前它看不到这行。</li>
 * </ol>
 * 顺序颠倒就会出现「先冻结再退款」或「worker 找不到任务」。
 */
@Service
public class MusicGenJobService {

    private static final Logger log = LoggerFactory.getLogger(MusicGenJobService.class);

    public static final String CREDIT_REF_TYPE = "music_gen_job";

    private final MusicGenJobRepository jobRepo;
    private final DigitalIpRepository digitalIpRepo;
    private final MusicGenModelClient modelClient;
    private final MusicGenWorker worker;
    private final CreditService creditService;
    private final PromptService promptService;
    private final CdnUrlSigner signer;
    private final ObjectMapper mapper = new ObjectMapper();

    public MusicGenJobService(MusicGenJobRepository jobRepo,
                              DigitalIpRepository digitalIpRepo,
                              MusicGenModelClient modelClient,
                              MusicGenWorker worker,
                              CreditService creditService,
                              PromptService promptService,
                              CdnUrlSigner signer) {
        this.jobRepo = jobRepo;
        this.digitalIpRepo = digitalIpRepo;
        this.modelClient = modelClient;
        this.worker = worker;
        this.creditService = creditService;
        this.promptService = promptService;
        this.signer = signer;
    }

    /** 下单入参（controller 已剥离客户端定价覆盖字段）。 */
    public record CreateSpec(String clientRequestId, String artistId, String prompt, String lyrics,
                             String genre, String mood, String timbre, String gender,
                             boolean instrumental, int durationSec, String endpointId) {
    }

    @Transactional
    public MusicGenJobDto submit(CreateSpec spec, String ownerUserId) {
        if (ownerUserId == null || ownerUserId.isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录。");
        }

        // 幂等：同一 owner 重复提交同一 clientRequestId 直接返回已有任务，不重复扣费。
        if (spec.clientRequestId() != null && !spec.clientRequestId().isBlank()) {
            var existing = jobRepo.findByOwnerUserIdAndClientRequestId(ownerUserId, spec.clientRequestId());
            if (existing.isPresent()) {
                return MusicGenJobDto.from(existing.get(), signer);
            }
        }

        boolean hasPrompt = spec.prompt() != null && !spec.prompt().isBlank();
        boolean hasLyrics = spec.lyrics() != null && !spec.lyrics().isBlank();
        if (!hasPrompt && !hasLyrics) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "MUSIC_INPUT_REQUIRED",
                    "请填写创作灵感，或直接粘贴你的歌词。");
        }
        if (spec.instrumental() && hasLyrics) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "MUSIC_INPUT_CONFLICT",
                    "纯音乐不会演唱歌词。要保留歌词请关闭「纯音乐」。");
        }
        // 艺人可空（自由创作）；给了就必须是本人的。
        if (spec.artistId() != null && !spec.artistId().isBlank()) {
            var artist = digitalIpRepo.findById(spec.artistId())
                    .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ARTIST_NOT_FOUND", "艺人不存在。"));
            if (!ownerUserId.equals(artist.getOwnerUserId())) {
                throw new BusinessException(HttpStatus.FORBIDDEN, "ARTIST_NOT_OWNED", "该艺人不属于当前用户。");
            }
        }

        // ① preflight —— 全部在 hold 之前，失败不建单不冻结（§8.0）
        modelClient.ensureConfigured(spec.endpointId());
        modelClient.validateRequest(spec.endpointId(), spec.durationSec(), spec.instrumental());

        // ② 定价
        long cost = modelClient.resolveCreditCost(spec.endpointId(), spec.durationSec());

        String id = "mgj_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        OffsetDateTime now = OffsetDateTime.now();
        MusicGenJob job = MusicGenJob.builder()
                .id(id)
                .ownerUserId(ownerUserId)
                .clientRequestId(spec.clientRequestId())
                .artistId(blankToNull(spec.artistId()))
                .prompt(blankToNull(spec.prompt()))
                .lyrics(blankToNull(spec.lyrics()))
                .genre(blankToNull(spec.genre()))
                .mood(blankToNull(spec.mood()))
                .timbre(blankToNull(spec.timbre()))
                .gender(blankToNull(spec.gender()))
                .instrumental(spec.instrumental())
                .durationSec(spec.durationSec())
                .optionsJson(optionsJson(spec.endpointId()))
                .status("queued")
                .progress(0)
                .createdAt(now)
                .updatedAt(now)
                .heartbeatAt(now)
                .build();

        // ③ hold —— 余额不足抛 402，整个事务回滚，任务不落库
        if (cost > 0) {
            creditService.hold(ownerUserId, cost, CREDIT_REF_TYPE, id,
                    "音乐创作 · " + (spec.instrumental() ? "纯音乐" : "歌曲") + " " + spec.durationSec() + "s");
            job.setCreditsHeld(cost);
        }

        // ④ 落库
        jobRepo.save(job);

        // ⑤ 派发。有事务时必须等 afterCommit —— worker 用的是新事务，commit 前它读不到这一行。
        // 没有活动事务时（save 已各自提交）直接派发即可。
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    worker.generateAsync(id);
                }
            });
        } else {
            worker.generateAsync(id);
        }

        log.info("[music-gen] queued job={} owner={} duration={}s cost={} instrumental={}",
                id, ownerUserId, spec.durationSec(), cost, spec.instrumental());
        return MusicGenJobDto.from(job, signer);
    }

    public MusicGenJobDto getJob(String id, String ownerUserId) {
        return jobRepo.findById(id)
                .filter(j -> ownerUserId != null && ownerUserId.equals(j.getOwnerUserId()))
                .map(j -> MusicGenJobDto.from(j, signer))
                .orElse(null);
    }

    public List<MusicGenJobDto> listJobs(String ownerUserId) {
        return jobRepo.findByOwnerUserIdOrderByCreatedAtDesc(ownerUserId).stream()
                .map(j -> MusicGenJobDto.from(j, signer))
                .toList();
    }

    private String optionsJson(String endpointId) {
        try {
            ObjectNode n = mapper.createObjectNode();
            if (endpointId != null && !endpointId.isBlank()) n.put("endpoint_id", endpointId);
            return mapper.writeValueAsString(n);
        } catch (Exception e) {
            return "{}";
        }
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
