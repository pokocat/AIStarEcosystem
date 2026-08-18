package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.service.shiliu.ShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapVoice;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapVoiceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * 训练完成后固化的两份「先看看」样例。
 *
 * <p>用户原话：做成片之前完全不知道效果，出来不好就白花钻石。这条链路上最不确定的两块是
 * <b>声音像不像本人</b>和<b>数字人口型/构图对不对</b>，它们都在扣费之前无从验证。
 *
 * <p>做法是<b>预生成 + 固化</b>，而不是用户点一次合成一次：
 * <ul>
 *   <li>即时 —— 端上点开就响，不用等三五秒；</li>
 *   <li>成本可预测 —— 每条声音/每个形象各一次，不必靠限流去防薅；</li>
 *   <li>口径一致 —— 所有人听到/看到的是同一句，好横向比较。</li>
 * </ul>
 * 按需合成仍然保留（用户想听自己那句难念的），两者并存，见 ClipScriptService.previewByVoice。
 *
 * <p>失败一律不阻断训练成功：样例是锦上添花，形象 ready 就是 ready。
 */
@Service
public class ClipDemoService {

    /**
     * 固定样例文案。选它有三个理由：口语、有场景感、约 6 秒——
     * 短到不浪费供应商点数，长到足以听出音色和看清口型。
     * <b>改这句话会让所有历史样例与新样例不一致</b>，要改就得连带把已固化的清掉重生成。
     */
    public static final String DEMO_TEXT = "早上七点，我把卷帘门拉起来，这条街就算醒了。";

    /** 放弃阈值。素材本身有问题时会稳定失败，没有它 worker 会一直重试下去，白烧点数。 */
    static final int MAX_ATTEMPTS = 3;

    private final DapVoiceRepository voices;
    private final DapAvatarRepository avatars;
    private final ShiliuService shiliu;
    private final ClipOutputStorage outputStorage;
    private final ClipDemoClaims claims;

    public ClipDemoService(DapVoiceRepository voices, DapAvatarRepository avatars,
                           ShiliuService shiliu, ClipOutputStorage outputStorage, ClipDemoClaims claims) {
        this.voices = voices;
        this.avatars = avatars;
        this.shiliu = shiliu;
        this.outputStorage = outputStorage;
        this.claims = claims;
    }

    /**
     * 给一条已训好的声音固化样例音频。
     *
     * <p>先 CAS 认领（attempts +1）再打供应商，两个目的：
     * 多实例下只有一台能抢到，不会重复烧点数；即便这一轮把进程打挂，计数也已经生效，
     * 重启后不会对同一条无限重试。
     */
    public boolean ensureVoiceDemo(String voiceId) {
        DapVoice voice = voices.findById(voiceId).orElse(null);
        if (!voiceEligible(voice)) return false;
        // 认领走独立事务：这一行必须在打供应商之前就落地，异常回滚不能把它带走。
        if (!claims.claimVoice(voiceId, attempts(voice.getDemoAttempts()))) return false;

        ShiliuGateway gateway = shiliu.required();
        ShiliuGateway.Task task = gateway.previewVoice(voice.getOwnerUserId(), voice.getEngineRef(), DEMO_TEXT);
        if (!"succeeded".equals(task.status()) || task.outputRef() == null || task.outputRef().isBlank()) {
            throw new IllegalStateException("样例试听合成失败" + (task.error() == null ? "" : "：" + task.error()));
        }
        // 石榴给的是时效 URL，必须镜像到我方存储 —— 否则几小时后端上播的就是 403。
        voice.setDemoAudioCdnKey(outputStorage.persistAudio(voice.getOwnerUserId(), task.outputRef()));
        voices.save(voice);
        return true;
    }

    /**
     * 给一个已训好的形象固化样例短片（带声音）。
     *
     * <p><b>两阶段</b>，因为石榴的 {@code /video/createByText} 是异步的 ——
     * 它只回 videoId，成片要另外轮询（HttpShiliuGateway 那条恒返回 processing/outputRef=null）。
     * 一阶段提交并把任务号存下来，二阶段轮询取成片。合成一步写的话，每一轮都会重新提交，
     * 白烧三份点数还永远拿不到片子。
     *
     * <p>attempts 只在**提交**时消耗；轮询不消耗，否则一条正常生成中的任务会被自己的轮询判死。
     */
    public boolean ensureAvatarDemo(String avatarId) {
        DapAvatar avatar = avatars.findById(avatarId).orElse(null);
        if (!avatarEligible(avatar)) return false;

        // 二阶段：已经有在途任务号，只管取结果。
        String pending = avatar.getDemoVideoTaskRef();
        if (notBlank(pending)) return collectAvatarDemo(avatar, pending);

        DapVoice voice = linkedReadyVoice(avatar);
        // 没有可用声音时**不消耗尝试次数**：这不是失败，是还没轮到它。
        // 用户之后补录或关联一条声音，下一轮 worker 自然会把样例补上。
        if (voice == null) return false;

        if (!claims.claimAvatar(avatarId, attempts(avatar.getDemoAttempts()))) return false;

        ShiliuGateway gateway = shiliu.required();
        ShiliuGateway.Task task = gateway.createVideoByText(
                avatar.getOwnerUserId(), avatar.getEngineRef(), voice.getEngineRef(), DEMO_TEXT);
        if ("failed".equals(task.status())) {
            throw new IllegalStateException("样例短片提交失败" + (task.error() == null ? "" : "：" + task.error()));
        }
        // 少数实现可能同步就把地址给回来了，那就直接收；否则记下任务号等下一轮。
        if ("succeeded".equals(task.status()) && notBlank(task.outputRef())) {
            return storeAvatarDemo(avatar, task.outputRef());
        }
        if (!notBlank(task.id())) {
            throw new IllegalStateException("样例短片提交后没有拿到任务号");
        }
        claims.rememberAvatarTask(avatarId, task.id());
        return false;
    }

    /** 轮询在途的样例短片任务。失败就把任务号清掉，让它下一轮重新提交（仍受 attempts 上限约束）。 */
    private boolean collectAvatarDemo(DapAvatar avatar, String taskRef) {
        ShiliuGateway.Task task = shiliu.required().query(taskRef);
        if ("failed".equals(task.status())) {
            claims.rememberAvatarTask(avatar.getId(), null);
            throw new IllegalStateException("样例短片生成失败" + (task.error() == null ? "" : "：" + task.error()));
        }
        if (!"succeeded".equals(task.status()) || !notBlank(task.outputRef())) return false;
        return storeAvatarDemo(avatar, task.outputRef());
    }

    @Transactional
    protected boolean storeAvatarDemo(DapAvatar avatar, String remoteUrl) {
        String key = outputStorage.persist(avatar.getOwnerUserId(), remoteUrl);
        DapAvatar fresh = avatars.findById(avatar.getId()).orElse(avatar);
        fresh.setDemoVideoCdnKey(key);
        fresh.setDemoVideoTaskRef(null);
        fresh.setUpdatedAt(Instant.now());
        avatars.save(fresh);
        return true;
    }

    /**
     * 素材变了就作废旧样例：重训声音、更换形象、改关联声音之后，旧样例已经不代表现在这个人了。
     *
     * <p>不清的话 key 仍非空，worker 认为「已经有了」而不再生成，用户就会一直听到旧音色、
     * 看到旧形象 —— 比没有样例更糟，因为它看起来是对的。
     */
    @Transactional
    public void invalidateVoiceDemo(DapVoice voice) {
        if (voice == null || !notBlank(voice.getDemoAudioCdnKey())) { resetVoiceAttempts(voice); return; }
        outputStorage.deleteQuietly(voice.getDemoAudioCdnKey());
        voice.setDemoAudioCdnKey(null);
        resetVoiceAttempts(voice);
    }

    @Transactional
    public void invalidateAvatarDemo(DapAvatar avatar) {
        if (avatar == null) return;
        if (notBlank(avatar.getDemoVideoCdnKey())) outputStorage.deleteQuietly(avatar.getDemoVideoCdnKey());
        avatar.setDemoVideoCdnKey(null);
        avatar.setDemoVideoTaskRef(null);
        avatar.setDemoAttempts(0);
    }

    private void resetVoiceAttempts(DapVoice voice) {
        if (voice == null) return;
        voice.setDemoAttempts(0);
    }

    /** 尝试次数用尽时记满，让 worker 不再选中它。 */
    @Transactional
    public void giveUpVoice(String voiceId) {
        voices.findById(voiceId).ifPresent(v -> { v.setDemoAttempts(MAX_ATTEMPTS); voices.save(v); });
    }

    @Transactional
    public void giveUpAvatar(String avatarId) {
        avatars.findById(avatarId).ifPresent(a -> { a.setDemoAttempts(MAX_ATTEMPTS); avatars.save(a); });
    }

    boolean voiceEligible(DapVoice voice) {
        return voice != null
                && voice.getDeletedAt() == null
                && "ready".equals(voice.getEngineStatus())
                && notBlank(voice.getEngineRef())
                && !notBlank(voice.getDemoAudioCdnKey())
                && attempts(voice.getDemoAttempts()) < MAX_ATTEMPTS;
    }

    boolean avatarEligible(DapAvatar avatar) {
        if (avatar == null || avatar.getDeletedAt() != null) return false;
        if (!"ready".equals(avatar.getEngineStatus()) || !notBlank(avatar.getEngineRef())) return false;
        if (notBlank(avatar.getDemoVideoCdnKey())) return false;
        // 有在途任务号的必须继续被选中 —— 那是二阶段轮询，不受 attempts 上限约束，
        // 否则一条提交成功的任务会因为「次数已用满」再也没人去取它的成片。
        if (notBlank(avatar.getDemoVideoTaskRef())) return true;
        return attempts(avatar.getDemoAttempts()) < MAX_ATTEMPTS;
    }

    /**
     * 找这个形象实际会用的那条声音。
     *
     * <p>⚠️ 关联关系的**真值在 {@code avatar.voiceName}**（存的是 voice id），不是 {@code voice.avatarId}。
     * 只看 voice.avatarId 的话，复用已有声音建的分身会被判成「没有可用声音」而永远拿不到样例 ——
     * 因为共享声音本来就不属于任何一个形象。voice.avatarId 只在「从形象视频提原声」那条路径上有值，
     * 所以留作次级回落，口径与 ClipAvatarService.linkedVoice 保持一致。
     */
    private DapVoice linkedReadyVoice(DapAvatar avatar) {
        String ref = avatar.getVoiceName();
        if (notBlank(ref)) {
            DapVoice exact = voices.findByIdAndOwnerUserId(ref, avatar.getOwnerUserId())
                    .filter(v -> v.getDeletedAt() == null && "ready".equals(v.getEngineStatus()) && notBlank(v.getEngineRef()))
                    .orElse(null);
            if (exact != null) return exact;
        }
        return voices.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(avatar.getOwnerUserId()).stream()
                .filter(v -> "ready".equals(v.getEngineStatus()) && notBlank(v.getEngineRef()))
                .filter(v -> avatar.getId().equals(v.getAvatarId()))
                .findFirst()
                .orElse(null);
    }

    private static int attempts(Integer value) { return value == null ? 0 : value; }
    private static boolean notBlank(String value) { return value != null && !value.isBlank(); }
}
