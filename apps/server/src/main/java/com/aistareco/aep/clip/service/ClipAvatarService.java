package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos.*;
import com.aistareco.aep.clip.repository.ClipRenderJobRepository;
import com.aistareco.aep.clip.service.shiliu.*;
import com.aistareco.aep.dap.model.*;
import com.aistareco.aep.dap.repository.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.multipart.MultipartFile;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Service
public class ClipAvatarService {
    private static final Logger log = LoggerFactory.getLogger(ClipAvatarService.class);
    private static final String ENGINE = "shiliu";
    /** 素材变了要作废旧样例。兼容构造里为 null（老测试不关心样例），所以每个调用点都要判空。 */
    private final ClipDemoService demos;
    private static final String AGREEMENT_VERSION = "clip-avatar-v2";
    private static final String AGREEMENT_TITLE = "数字分身本人授权书";
    private static final String AGREEMENT_TEXT = "本人授权军师参谋部使用本人主动提交的视频与声音资料，仅为本人的账号创建、训练和使用数字分身。本人可随时撤回授权并删除分身，删除后停止新的生成。";
    private final DapAvatarRepository avatars; private final DapVoiceRepository voices; private final DapConsentRepository consents;
    private final ClipRenderJobRepository jobs; private final FileStorageService storage; private final ShiliuService shiliu; private final ClipCapturePolicy capturePolicy;
    private final ClipVoiceSeedExtractor voiceSeedExtractor; private final ClipAvatarPreviewExtractor previewExtractor; private final ClipCaptureNormalizer captureNormalizer;
    @Autowired
    public ClipAvatarService(DapAvatarRepository avatars, DapVoiceRepository voices, DapConsentRepository consents,
                             ClipRenderJobRepository jobs, FileStorageService storage, ShiliuService shiliu,
                             ClipCapturePolicy capturePolicy, ClipVoiceSeedExtractor voiceSeedExtractor,
                             ClipAvatarPreviewExtractor previewExtractor, ClipCaptureNormalizer captureNormalizer,
                             ClipDemoService demos) {
        this.avatars = avatars; this.voices = voices; this.consents = consents; this.jobs = jobs; this.storage = storage; this.shiliu = shiliu; this.capturePolicy = capturePolicy;
        this.voiceSeedExtractor = voiceSeedExtractor; this.previewExtractor = previewExtractor; this.captureNormalizer = captureNormalizer;
        this.demos = demos;
    }

    /** 测试/旧调用兼容构造；Spring 明确使用上面的完整构造。 */
    public ClipAvatarService(DapAvatarRepository avatars, DapVoiceRepository voices, DapConsentRepository consents,
                             ClipRenderJobRepository jobs, FileStorageService storage, ShiliuService shiliu,
                             ClipCapturePolicy capturePolicy, ClipVoiceSeedExtractor voiceSeedExtractor,
                             ClipAvatarPreviewExtractor previewExtractor) {
        this(avatars, voices, consents, jobs, storage, shiliu, capturePolicy, voiceSeedExtractor, previewExtractor, null, null);
    }

    public CaptureRequirementsDto requirements() { return capturePolicy.requirements(); }

    @Transactional
    public AvatarDto view(String owner) {
        DapAvatar a = avatars.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE).orElse(null);
        if (a != null) return viewResolved(owner, a);
        DapVoice voice = voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE).orElse(null);
        if (voice == null) return null;
        VoiceRefresh refreshed = refreshVoice(voice);
        String voiceStatus = status(voice.getEngineStatus());
        return new AvatarDto("", "未创建形象", "none", voiceStatus, "seed".equals(voice.getKind()) ? "video" : "dedicated", null, null,
                voice.getEngineTrainedAt() == null ? null : voice.getEngineTrainedAt().toString(), 0, "ready".equals(voiceStatus) ? 100 : refreshed.progress(),
                null, refreshed.message(), ENGINE, false, voice.getId(), voice.getName(),
                null, demoUrl(voice.getDemoAudioCdnKey()));
    }

    @Transactional
    public List<AvatarDto> list(String owner) {
        return avatars.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE).stream()
                .map(a -> view(owner, a.getId())).filter(Objects::nonNull).toList();
    }

    @Transactional
    public AvatarDto view(String owner, String avatarId) {
        DapAvatar a = avatars.findByIdAndOwnerUserId(avatarId, owner).filter(row -> row.getDeletedAt() == null && ENGINE.equals(row.getEngine())).orElse(null);
        return a == null ? null : viewResolved(owner, a);
    }

    private AvatarDto viewResolved(String owner, DapAvatar a) {
        DapVoice v = linkedVoice(owner, a);
        ShiliuGateway gateway = shiliu.required();
        VoiceRefresh refreshed = refreshVoice(v);
        int voiceProgress = refreshed.progress();
        int imageProgress = progress(a == null ? null : a.getEngineStatus());
        String voiceMessage = refreshed.message();
        String imageMessage = null;
        if (a != null && "training".equals(a.getEngineStatus()) && a.getEngineRef() != null) {
            ShiliuGateway.Task task = gateway.query("avatar:" + a.getEngineRef());
            imageProgress = task.progress() == null ? imageProgress : task.progress();
            if ("succeeded".equals(task.status())) { a.setEngineStatus("ready"); a.setEngineTrainedAt(Instant.now()); avatars.save(a); }
            else if ("failed".equals(task.status())) { a.setEngineStatus("failed"); imageMessage = friendlyFailure(task.error(), "形象训练失败，请重新录制"); avatars.save(a); }
        }
        String imageStatus = status(a == null ? null : a.getEngineStatus());
        String voiceStatus = status(v == null ? null : v.getEngineStatus());
        // v0.121 前创建的数字人没有 imageKey；首次查看时从仍保留的训练视频补抽一帧，
        // 让存量用户无需重新上传也能看到自己的形象。补帧失败不影响既有训练状态。
        if (a != null && a.getImageKey() == null && a.getEngineSourceKey() != null) {
            try {
                FileStorageService.StoredFile preview = previewExtractor.extract(owner, a.getEngineSourceKey());
                a.setImageKey(preview.key()); a.setImageBytes(preview.bytes()); avatars.save(a);
            } catch (RuntimeException error) {
                log.warn("[clip-avatar] preview backfill skipped owner={}: {}", owner, error.getMessage());
            }
        }
        if ("ready".equals(imageStatus)) imageProgress = 100;
        if ("ready".equals(voiceStatus)) voiceProgress = 100;
        if ("failed".equals(imageStatus) && imageMessage == null) imageMessage = "形象训练失败，请重新采集";
        if ("failed".equals(voiceStatus) && voiceMessage == null) voiceMessage = "声音训练失败，请重新录制";
        String imagePreviewUrl = a == null || a.getImageKey() == null ? null : storage.signedUrl(a.getImageKey());
        String voiceSource = v == null ? null : "seed".equals(v.getKind()) ? "video" : "dedicated";
        return new AvatarDto(a.getId(), a.getName(), imageStatus, voiceStatus, voiceSource, imagePreviewUrl,
                a == null || a.getEngineTrainedAt() == null ? null : a.getEngineTrainedAt().toString(),
                v == null || v.getEngineTrainedAt() == null ? null : v.getEngineTrainedAt().toString(),
                imageProgress, voiceProgress, imageMessage, voiceMessage, ENGINE, false,
                v == null ? null : v.getId(), v == null ? null : v.getName(),
                a == null ? null : demoUrl(a.getDemoVideoCdnKey()),
                v == null ? null : demoUrl(v.getDemoAudioCdnKey()));
    }

    /** 一次刷新的产出：给端上看的进度，以及失败时的人话原因。状态本身已经写回 DapVoice。 */
    private record VoiceRefresh(int progress, String message) {}

    /**
     * 把一条在训声音的真实状态从石榴刷回本地。
     *
     * ★ 为什么必须独立成一步：在此之前，刷新只长在「形象视图」这一条路径上（viewResolved）。一条
     *   **没有关联形象**的独立声音永远走不到那里 —— 石榴早就 ready 了，本地却一直停在 training。
     *   连锁后果有三个：创建数字人时按 ready 过滤，这条声音选不到；下游（军师）拿不到终态，那笔
     *   预扣结算不了；最后被 6 小时超时兜底当成「训练失败」误退，形成「上游已出货、账却退款」。
     *   一条声音刷不刷得到状态，不该取决于它旁边有没有形象。
     *
     * 只碰 training 且有 engineRef 的：终态不再回查（白耗供应商配额），mock 时代的记录没有真实
     * speaker 也无从查起。查询失败**保留本地状态**并继续 —— 列表接口不能因为一条声音查不动就整个 500。
     */
    private VoiceRefresh refreshVoice(DapVoice v) {
        int local = progress(v == null ? null : v.getEngineStatus());
        if (v == null || !"training".equals(v.getEngineStatus()) || v.getEngineRef() == null) return new VoiceRefresh(local, null);
        ShiliuGateway.Task task;
        try { task = shiliu.required().query("speaker:" + v.getEngineRef()); }
        catch (RuntimeException e) {
            log.warn("[clip-avatar] 刷新声音状态失败 voice={} ref={}: {}", v.getId(), v.getEngineRef(), e.getMessage());
            return new VoiceRefresh(local, null);
        }
        int remote = task.progress() == null ? local : task.progress();
        if ("succeeded".equals(task.status())) {
            v.setEngineStatus("ready"); v.setEngineTrainedAt(Instant.now()); voices.save(v);
            return new VoiceRefresh(100, null);
        }
        if ("failed".equals(task.status())) {
            v.setEngineStatus("failed"); voices.save(v);
            return new VoiceRefresh(remote, friendlyFailure(task.error(), "声音训练失败，请重新录制"));
        }
        return new VoiceRefresh(remote, null);
    }

    /** 重命名声音。自动名已按来源+日期区分，这里让用户还能起自己记得住的名字。 */
    @Transactional public VoiceDto renameVoice(String owner, String id, String name) {
        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty() || clean.length() > 20) throw BusinessException.badRequest("CLIP_VOICE_NAME_INVALID", "名字请控制在 1~20 个字");
        DapVoice v = voices.findByIdAndOwnerUserId(id, owner).filter(x -> x.getDeletedAt() == null && ENGINE.equals(x.getEngine()))
                .orElseThrow(() -> BusinessException.notFound("CLIP_VOICE_NOT_FOUND", "声音不存在或无权使用"));
        v.setName(clean); voices.save(v); return voiceDto(v);
    }

    /**
     * 这条声音还剩几次免费重训。
     *
     * 官方每条 speaker 给 4 次 recreate，且**不消耗新的克隆权益**。额度用尽后 retrainVoice 会静默
     * 回落成新建（消耗一份克隆权益），用户却看不出差别 —— 所以要把余额透出去，让他在录之前就知道
     * 这次是「免费重训」还是「已经用完了」。
     *
     * 只在用户真的进到重训页时调一次，不塞进 voiceList：那是列表接口，每条声音都打一次供应商
     * 会把列表拖慢，也白白消耗对方配额。
     *
     * available=false 表示供应商没给出可用的额度信息（mock 记录、接口异常等）。
     * 这时**不许瞎猜成 0 或 4** —— 交给端上说「暂时查不到」，而不是给一个假数字。
     */
    public Map<String, Object> retrainQuota(String owner, String id) {
        DapVoice v = voices.findByIdAndOwnerUserId(id, owner).filter(x -> x.getDeletedAt() == null && ENGINE.equals(x.getEngine()))
                .orElseThrow(() -> BusinessException.notFound("CLIP_VOICE_NOT_FOUND", "声音不存在或无权使用"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("voiceId", v.getId());
        if (!deletableUpstream(v.getEngineRef())) {
            // mock 时代的记录没有真实 speaker，重训无从谈起：这类声音只能新建。
            out.put("available", false); out.put("retrainable", false);
            return out;
        }
        ShiliuGateway.RecreateQuota quota;
        try { quota = shiliu.required().recreateQuota(v.getEngineRef()); }
        catch (RuntimeException e) {
            log.warn("[clip-avatar] 查重训额度失败 ref={}: {}", v.getEngineRef(), e.getMessage());
            out.put("available", false); out.put("retrainable", true);
            return out;
        }
        boolean known = quota.available() && quota.used() != null && quota.total() != null;
        out.put("available", known);
        out.put("retrainable", true);
        if (known) {
            out.put("used", quota.used());
            out.put("total", quota.total());
            out.put("remaining", Math.max(0, quota.total() - quota.used()));
        }
        return out;
    }

    /**
     * 声音列表。**会顺手把在训的那几条刷成真实状态** —— 这是独立声音唯一的刷新入口，
     * 不刷就永远停在 training（见 refreshVoice）。终态的声音一条都不回查，所以正常情况下
     * 这里对供应商的调用次数 = 用户当前在训的声音数（通常 0~1），不会把列表拖慢。
     */
    @Transactional
    public List<VoiceDto> voiceList(String owner) {
        return voices.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE)
                .stream().map(v -> voiceDto(v, refreshVoice(v))).toList();
    }

    /** 单条声音。给下游按 voiceId 轮询用：只训了声音、没建形象时，这是唯一能拿到终态的窄接口。 */
    @Transactional
    public VoiceDto voiceView(String owner, String id) {
        DapVoice v = voices.findByIdAndOwnerUserId(id, owner).filter(x -> x.getDeletedAt() == null && ENGINE.equals(x.getEngine()))
                .orElseThrow(() -> BusinessException.notFound("CLIP_VOICE_NOT_FOUND", "声音不存在或无权使用"));
        return voiceDto(v, refreshVoice(v));
    }

    /** 列表与重命名共用同一转换口径，避免两处各写一份导致字段漂移。 */
    private VoiceDto voiceDto(DapVoice v) { return voiceDto(v, new VoiceRefresh(progress(v.getEngineStatus()), null)); }

    private VoiceDto voiceDto(DapVoice v, VoiceRefresh refreshed) {
        String current = status(v.getEngineStatus());
        int p = "ready".equals(current) ? 100 : refreshed.progress();
        return new VoiceDto(v.getId(), v.getName(), current, "seed".equals(v.getKind()) ? "video" : "dedicated",
                v.getEngineTrainedAt() == null ? null : v.getEngineTrainedAt().toString(), p,
                demoUrl(v.getDemoAudioCdnKey()));
    }

    /** 样例产物统一签短链。没生成好就是 null —— 端上据此回落到按需合成，不显示一个点不动的按钮。 */
    private String demoUrl(String cdnKey) {
        return cdnKey == null || cdnKey.isBlank() ? null : storage.signedUrl(cdnKey);
    }

    @Transactional
    public ConsentDto startConsent(String owner, MultipartFile file, String spokenText) {
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("CLIP_CONSENT_VIDEO_REQUIRED", "请录制本人授权视频");
        if (spokenText == null || spokenText.isBlank()) throw BusinessException.badRequest("CLIP_CONSENT_TEXT_REQUIRED", "缺少授权口令");
        if (!ClipCapturePolicy.CONSENT_TEXT.equals(spokenText.trim())) throw BusinessException.badRequest("CLIP_CONSENT_TEXT_MISMATCH", "授权文字已更新，请按页面显示的完整内容重新录制");
        FileStorageService.StoredFile stored = storage.store(file, "clip/consent", owner);
        ShiliuGateway.Task task;
        try {
            capturePolicy.validate("consent", file, stored);
            task = shiliu.required().createAuthorizationVideo(owner, stored.key(), spokenText);
        } finally {
            // 上游提交完成即删除我方原始核验视频；只保留授权文本哈希和 authId。
            storage.delete(stored.key());
        }
        boolean verified = "succeeded".equals(task.status());
        if (!verified) return new ConsentDto(task.id(), "rejected", false, false, task.outputRef());
        Instant now = Instant.now();
        DapConsent consent = DapConsent.builder().id("CS-" + uuid(12)).ownerUserId(owner)
                .captureId(task.outputRef()).agreementVersion(AGREEMENT_VERSION).agreementTitle(AGREEMENT_TITLE)
                .agreementHash(sha256(AGREEMENT_TEXT + "\n" + spokenText.trim())).agreementText(AGREEMENT_TEXT).scope("本人数字分身口播视频生成")
                .periodMonths(24).platforms(List.of("douyin", "kuaishou", "xiaohongshu", "shipinhao"))
                .processors(List.of("AIStarEcosystem", "shiliu")).acceptedAt(now).createdAt(now).build();
        consents.save(consent); return new ConsentDto(consent.getId(), "submitted", true, false, null);
    }

    @Transactional
    public Map<String, Object> clone(String owner, String kind, MultipartFile file) { return clone(owner, kind, file, null, null, null, null); }

    @Transactional
    public Map<String, Object> clone(String owner, String kind, MultipartFile file, String avatarId, String voiceId, String name) {
        return clone(owner, kind, file, avatarId, voiceId, name, null);
    }

    /**
     * @param voiceSource 声音来源的**显式意图**。"video" = 只从本次视频提取，绝不回退到该形象
     *   原先关联的声音；其余（含 null）保持历史行为（有 voiceId 用 voiceId，否则沿用已关联的）。
     *
     *   为什么要显式传：此前「用户明确选了视频原声」与「调用方没表达意见」在接口上都是空 voiceId，
     *   服务端无从分辨，于是一律回退到 linkedVoice —— 用户选了视频原声却拿到旧声音（男女都错），
     *   而且因为 readyVoice 已非空，下面真正的原声提取整段被跳过，等于选项完全失效。
     */
    @Transactional
    public Map<String, Object> clone(String owner, String kind, MultipartFile file, String avatarId, String voiceId, String name, String voiceSource) {
        if (!Set.of("avatar", "voice", ClipCapturePolicy.IMAGE_KIND).contains(kind)) throw BusinessException.badRequest("CLIP_CLONE_KIND_INVALID", "采集类型不支持");
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("CLIP_CLONE_FILE_REQUIRED", "未收到采集文件");
        FileStorageService.StoredFile stored = storage.store(file, "clip/clone/" + kind, owner);
        return cloneStored(owner, kind, file.getOriginalFilename(), file.getContentType(), stored, avatarId, voiceId, name, voiceSource);
    }

    /** 受限 OSS 直传后的业务入口；对象归属与大小已由 ClipUploadService 核对。 */
    @Transactional
    public Map<String, Object> cloneStored(String owner, String kind, String fileName, String contentType,
                                           FileStorageService.StoredFile uploaded, String avatarId, String voiceId,
                                           String name, String voiceSource) {
        if (!Set.of("avatar", "voice", ClipCapturePolicy.IMAGE_KIND).contains(kind)) throw BusinessException.badRequest("CLIP_CLONE_KIND_INVALID", "采集类型不支持");
        ClipCaptureNormalizer.Prepared prepared;
        try { prepared = captureNormalizer == null
                ? new ClipCaptureNormalizer.Prepared(fileName, contentType, uploaded, false)
                : captureNormalizer.prepare(owner, kind, fileName, contentType, uploaded); }
        catch (RuntimeException e) { storage.delete(uploaded.key()); throw e; }
        FileStorageService.StoredFile stored = prepared.stored();
        try { capturePolicy.validate(kind, prepared.fileName(), prepared.contentType(), stored); }
        catch (RuntimeException e) { storage.delete(stored.key()); throw e; }
        ShiliuGateway gateway = shiliu.required();
        Instant now = Instant.now();
        String resultAvatarId = null; String resultVoiceId = null;
        if ("avatar".equals(kind)) {
            FileStorageService.StoredFile preview;
            try { preview = previewExtractor.extract(owner, stored.key()); }
            catch (RuntimeException error) { storage.delete(stored.key()); throw error; }
            DapAvatar a = avatarId == null || avatarId.isBlank()
                    ? DapAvatar.builder().id("DH-" + uuid(8)).ownerUserId(owner).name(avatarName(owner, name)).path("real").status("pending").engine(ENGINE).createdAt(now).build()
                    : requiredAvatar(owner, avatarId);
            if (name != null && !name.isBlank()) a.setName(cleanName(name, a.getName()));
            resultAvatarId = a.getId();
            String previousPreviewKey = a.getImageKey();
            a.setEngine(ENGINE); a.setEngineRef(null); a.setEngineSourceKey(stored.key()); a.setEngineStatus("training");
            a.setEngineTrainedAt(null); a.setMock(gateway.mock()); a.setImageKey(preview.key()); a.setImageBytes(preview.bytes()); a.setUpdatedAt(now);
            // 换了形象，旧的出镜样例已经不是这个人了。不清的话 key 仍非空，worker 认为「已经有了」
            // 而不再生成，用户会一直看到上一个形象 —— 比没有样例更糟，因为它看起来是对的。
            if (demos != null) demos.invalidateAvatarDemo(a);
            avatars.save(a);
            if (previousPreviewKey != null && !previousPreviewKey.equals(preview.key())) storage.delete(previousPreviewKey);
            boolean fromVideo = "video".equals(voiceSource);
            DapVoice readyVoice = fromVideo ? null : selectedVoice(owner, voiceId);
            // 明确选了「视频原声」时不许回退旧声音；否则用户的选择等于没生效。
            if (readyVoice == null && !fromVideo) readyVoice = linkedVoice(owner, a);
            if (readyVoice != null && !"ready".equals(readyVoice.getEngineStatus())) readyVoice = null;
            if (readyVoice != null) {
                // 换了关联声音 = 样例里那个人的嗓子变了，同样要重生成
                if (demos != null && !readyVoice.getId().equals(a.getVoiceName())) demos.invalidateAvatarDemo(a);
                a.setVoiceName(readyVoice.getId()); resultVoiceId = readyVoice.getId();
            }
            // 官方 speakerId 是 Avatar 训练的选填 demo 参数：有就带，没有也立即开始形象训练。
            startAvatarTraining(owner, a, readyVoice, gateway);
            // 首次只上传一个视频时，尽力从视频原声生成基础音色。
            // 这是同一份素材的后台增强，不再要求用户先多录一段音频；失败不影响 Avatar 主任务。
            if (readyVoice == null) {
                voiceSeedExtractor.extract(owner, stored.key()).ifPresent(seed -> {
                    try { DapVoice created = startVoiceTraining(owner, seed, gateway, now, "seed", a.getId()); a.setVoiceName(created.getId()); avatars.save(a); }
                    catch (Exception error) { log.warn("[clip-avatar] video voice seed failed owner={}: {}", owner, error.getMessage()); }
                });
            }
        } else if (ClipCapturePolicy.IMAGE_KIND.equals(kind)) {
            // 图片训练与视频训练的根本差别：**一张照片里没有声音**。
            // 视频训练可以从原声里顺带提一条基础音色，图片没有这条退路，所以必须显式指定一条
            // 已训好的声音；否则会建出一个永远出不了片的分身（出片时才在 requiredVoiceEngineRef
            // 撞上 CLIP_VOICE_NOT_SELECTED），而用户已经付过钱了。
            DapVoice picked = selectedVoice(owner, voiceId);
            if (picked == null) {
                storage.delete(stored.key());
                throw BusinessException.badRequest("CLIP_IMAGE_AVATAR_VOICE_REQUIRED",
                        "用照片创建数字分身要先有一条声音：可以录一段或传一个音频来训练，也可以直接选一条已有的声音");
            }
            // 还在训练中的声音不能用来建分身：供应商侧 speakerId 尚未就绪，
            // 而且这一刻放行等于让用户为一个可能训练失败的声音先建分身、先付钱。
            if (!"ready".equals(picked.getEngineStatus())) {
                storage.delete(stored.key());
                throw BusinessException.badRequest("CLIP_IMAGE_AVATAR_VOICE_NOT_READY",
                        "这条声音还在训练中，等它训练好再用来创建数字分身");
            }
            DapAvatar a = avatarId == null || avatarId.isBlank()
                    ? DapAvatar.builder().id("DH-" + uuid(8)).ownerUserId(owner).name(avatarName(owner, name)).path("image").status("pending").engine(ENGINE).createdAt(now).build()
                    : requiredAvatar(owner, avatarId);
            if (name != null && !name.isBlank()) a.setName(cleanName(name, a.getName()));
            resultAvatarId = a.getId(); resultVoiceId = picked.getId();
            String previousPreviewKey = a.getImageKey();
            a.setEngine(ENGINE); a.setEngineRef(null); a.setEngineSourceKey(stored.key()); a.setEngineStatus("training");
            a.setEngineTrainedAt(null); a.setMock(gateway.mock()); a.setVoiceName(picked.getId());
            // 上传的这张图**本身就是预览图**，不需要像视频那样抽帧。
            a.setImageKey(stored.key()); a.setImageBytes(stored.bytes()); a.setUpdatedAt(now); avatars.save(a);
            if (previousPreviewKey != null && !previousPreviewKey.equals(stored.key())) storage.delete(previousPreviewKey);
            ShiliuGateway.Task task = gateway.cloneAvatarByImage(owner, stored.key(), picked.getEngineRef());
            a.setEngineRef(task.outputRef());
            a.setEngineStatus("failed".equals(task.status()) ? "failed" : "succeeded".equals(task.status()) ? "ready" : "training");
            a.setEngineTrainedAt("ready".equals(a.getEngineStatus()) ? now : null);
            a.setUpdatedAt(now); avatars.save(a);
        } else {
            // 重录优先走 recreate：每条 speaker 官方给 4 次重训，且**不消耗新的克隆权益**。
            // 此前每次重录都 /speaker/create 新建一条，把账户的 availableSpeaker 很快烧光
            // （2026-08-13 实测归零即由此而来）。只有没有可重训对象、或 4 次用尽时才新建。
            DapVoice reusable = voiceId == null || voiceId.isBlank() ? null : selectedVoice(owner, voiceId);
            // 指名了要重训哪一条 = 只能重训或失败。此前这里还额外判 deletableUpstream，不满足就静默
            // 落到新建 —— 又是一条「用户要 A、系统给了 B 还照 A 收费」的路径。判死的活交给 retrainVoice 报错。
            DapVoice created = reusable != null
                    ? retrainVoice(owner, reusable, stored, gateway, now)
                    : startVoiceTraining(owner, stored, gateway, now, "clone", avatarId);
            resultVoiceId = created.getId(); resultAvatarId = avatarId;
            if (avatarId != null && !avatarId.isBlank()) { DapAvatar target = requiredAvatar(owner, avatarId); target.setVoiceName(created.getId()); target.setUpdatedAt(now); avatars.save(target); }
        }
        Map<String,Object> result = new LinkedHashMap<>(); result.put("ok", true); result.put("kind", kind); result.put("status", "training"); result.put("mock", gateway.mock());
        if (resultAvatarId != null) result.put("avatarId", resultAvatarId); if (resultVoiceId != null) result.put("voiceId", resultVoiceId); return result;
    }

    public List<AuditDto> consentLogs(String owner) {
        return consents.findByOwnerUserIdOrderByAcceptedAtDesc(owner).stream().map(c -> new AuditDto(c.getId(), c.getAcceptedAt().toString(), null, c.getScope(), null, "submitted")).toList();
    }
    public List<AuditDto> usageLogs(String owner) {
        return jobs.findTop50ByExternalOwnerIdAndStatusInOrderByCreatedAtDesc(owner, List.of("succeeded", "failed", "cancelled")).stream()
                .map(j -> new AuditDto(j.getId(), j.getCreatedAt().toString(), null, null, "生成口播成片", j.getStatus())).toList();
    }

    /**
     * 上游 ref 是否可用于调供应商接口。
     *
     * mock 时代留下的记录 engineRef 形如 `mock-voice-xxx`，而网关删除前会校验 ref 必须是纯数字，
     * 于是批量删除撞到第一条 mock 记录就抛 CLIP_ENGINE_REF_INVALID 整个中止 —— 一条都删不掉。
     * 结果是：账户里只要有一条 mock 残留，用户就永远删不掉自己的分身（实测踩到）。
     * mock ref 本来就没有对应的上游对象，跳过上游删除、只清本地才是正确语义。
     */
    private static boolean deletableUpstream(String ref) {
        return ref != null && ref.matches("\\d{1,20}");
    }

    @Transactional
    public void delete(String owner) {
        ShiliuGateway gateway = shiliu.required(); Instant now = Instant.now();
        // 用户可能多次“更换形象/提升声音”，同一 owner 下会保留多个历史有效版本。
        // 只删最新一条会让上一条立刻重新成为 view() 的当前记录，看起来像删除后又复活。
        for (DapAvatar a : avatars.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE)) {
            if (deletableUpstream(a.getEngineRef())) gateway.deleteAvatar(a.getEngineRef());
            storage.delete(a.getEngineSourceKey()); storage.delete(a.getImageKey());
            // 样例短片也是用户本人的肖像+声音，删分身就该一起清干净，不能留在 OSS 里
            storage.delete(a.getDemoVideoCdnKey());
            a.setDeletedAt(now); a.setEngineStatus("deleted"); avatars.save(a);
        }
        for (DapVoice v : voices.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE)) {
            if (deletableUpstream(v.getEngineRef())) gateway.deleteVoice(v.getEngineRef());
            storage.delete(v.getAudioKey());
            // 固化的试听样例是用户本人的声音，删分身就要一起清干净，不能留在 OSS 里
            storage.delete(v.getDemoAudioCdnKey());
            v.setDeletedAt(now); v.setEngineStatus("deleted"); voices.save(v);
        }
    }
    @Transactional
    public void delete(String owner, String avatarId) {
        DapAvatar a = requiredAvatar(owner, avatarId); ShiliuGateway gateway = shiliu.required(); Instant now = Instant.now();
        if (deletableUpstream(a.getEngineRef())) gateway.deleteAvatar(a.getEngineRef());
        storage.delete(a.getEngineSourceKey()); storage.delete(a.getImageKey());
        // 同批量删除：样例短片带着本人肖像和声音，不清就等于删了分身还留着人像视频
        storage.delete(a.getDemoVideoCdnKey());
        a.setDeletedAt(now); a.setEngineStatus("deleted"); avatars.save(a);
    }
    public boolean ready(String owner) { AvatarDto v = view(owner); return v != null && "ready".equals(v.imageStatus()); }
    public boolean ready(String owner, String avatarId) { AvatarDto v = avatarId == null || avatarId.isBlank() ? view(owner) : view(owner, avatarId); return v != null && "ready".equals(v.imageStatus()); }
    public boolean voiceReady(String owner) { AvatarDto v = view(owner); return v != null && "ready".equals(v.voiceStatus()); }
    public boolean voiceReady(String owner, String avatarId, String voiceId) {
        DapVoice voice = selectedVoice(owner, voiceId);
        if (voice == null && avatarId != null && !avatarId.isBlank()) { DapAvatar a = requiredAvatar(owner, avatarId); voice = linkedVoice(owner, a); }
        return voice != null && "ready".equals(voice.getEngineStatus());
    }
    public String requiredAvatarEngineRef(String owner) { return requiredAvatarEngineRef(owner, null); }
    public String requiredAvatarEngineRef(String owner, String avatarId) {
        DapAvatar selected = avatarId == null || avatarId.isBlank()
                ? avatars.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE).orElse(null)
                : requiredAvatar(owner, avatarId);
        return Optional.ofNullable(selected)
                .filter(a -> "ready".equals(a.getEngineStatus()) && a.getEngineRef() != null && !a.getEngineRef().isBlank())
                .map(DapAvatar::getEngineRef)
                .orElseThrow(() -> new BusinessException(HttpStatus.CONFLICT, "CLIP_AVATAR_NOT_READY", "形象还没有训练完成"));
    }
    /**
     * 试听一条声音：给一段文字，让它念出来。
     *
     * 与 ClipScriptService.preview 的区别是**不需要 project** —— 那条路径的 speakerRef 是从
     * project 的 payload 里解析的，于是用户想听刚训好的声音，得先挑模板、建项目、进文案页
     * 才听得到，听到的还是那个项目绑定的声音。用户原话：「先听一下…以免做成片效果不好，浪费钻石」。
     *
     * 底下就是石榴的 POST /speaker/tts（同步返回 base64 音频），与出片 tts 阶段同一个接口。
     * 不产生任何计费对象：钻石的账在军师那边，这里只花石榴的 validPoint。
     */
    public VoicePreviewDto previewVoice(String owner, String voiceId, String text) {
        String value = text == null ? "" : text.trim();
        if (value.isEmpty()) throw BusinessException.badRequest("CLIP_PREVIEW_TEXT_REQUIRED", "先写一句想听的话");
        if (value.length() > 200) throw BusinessException.badRequest("CLIP_PREVIEW_TEXT_TOO_LONG", "试听最多 200 字");
        // 只按 voiceId 解析，不回退到「该用户最新的一条声音」——用户点的是哪一条就听哪一条，
        // 猜错会让他对着别的音色下判断。未就绪/不存在都由 requiredVoiceEngineRef 明确抛错。
        String voiceRef = requiredVoiceEngineRef(owner, null, voiceId);
        ShiliuGateway gateway = shiliu.required();
        ShiliuGateway.Task task = gateway.previewVoice(owner, voiceRef, value);
        if (!"succeeded".equals(task.status()) || task.outputRef() == null) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "CLIP_TTS_FAILED", "试听合成失败");
        }
        int duration = task.durationSec() == null ? Math.max(1, Math.round(value.length() / 4f)) : task.durationSec();
        return new VoicePreviewDto(voiceId, task.outputRef(), duration, value, shiliu.mockMode());
    }

    public String requiredVoiceEngineRef(String owner) { return requiredVoiceEngineRef(owner, null, null); }
    public String requiredVoiceEngineRef(String owner, String avatarId, String voiceId) {
        DapVoice selected = selectedVoice(owner, voiceId);
        if (selected == null && avatarId != null && !avatarId.isBlank()) selected = linkedVoice(owner, requiredAvatar(owner, avatarId));
        // 原先这里还有一层「都找不到就拿该用户最新的一条声音」——出片时用谁的嗓子近乎随机。
        // 已删除：没有明确关联的声音时必须让用户去选，不能替他决定。
        if (selected == null) {
            throw new BusinessException(HttpStatus.CONFLICT, "CLIP_VOICE_NOT_SELECTED",
                    "这个数字人还没有关联声音，请先选择或采集一个再出片");
        }
        return Optional.of(selected)
                .filter(v -> "ready".equals(v.getEngineStatus()) && v.getEngineRef() != null && !v.getEngineRef().isBlank())
                .map(DapVoice::getEngineRef)
                .orElseThrow(() -> new BusinessException(HttpStatus.CONFLICT, "CLIP_VOICE_NOT_READY", "声音还没有训练完成"));
    }
    private void startAvatarTraining(String owner, DapAvatar avatar, DapVoice voice, ShiliuGateway gateway) {
        // 石榴 Train Avatar Model 的 authId 是可选校验项：历史上做过授权视频的账号继续携带，
        // 新用户不再被我方硬闸拦截，也不会为了训练被迫多录一段授权视频。
        String optionalAuthId = consents.findFirstByOwnerUserIdOrderByAcceptedAtDesc(owner)
                .map(DapConsent::getCaptureId).filter(id -> !id.isBlank()).orElse(null);
        ShiliuGateway.Task task = gateway.cloneAvatar(owner, avatar.getEngineSourceKey(), voice == null ? null : voice.getEngineRef(), optionalAuthId);
        avatar.setEngineRef(task.outputRef());
        avatar.setEngineStatus("failed".equals(task.status()) ? "failed" : "succeeded".equals(task.status()) ? "ready" : "training");
        avatar.setEngineTrainedAt("ready".equals(avatar.getEngineStatus()) ? Instant.now() : null);
        avatar.setUpdatedAt(Instant.now());
        avatars.save(avatar);
    }
    /**
     * 在已有 speaker 上重新训练。额度用尽或上游拒绝时回落到新建 —— 回落要留日志，
     * 因为那意味着这次会真的吃掉一份克隆权益，是需要能追溯的成本事件。
     */
    /**
     * 重训指定的那条声音。**不回落**：做不到就报错，绝不悄悄改成新建一条。
     *
     * 曾经这里有两条回落（额度用尽 / recreate 调用失败），都回落到 startVoiceTraining。后果是
     * 三头对不上：用户按「重训」的价付钱、界面按「换掉现有音色」描述结果、账户却多烧了一份
     * 克隆权益并多出一条声音。失败就是失败 —— 让用户自己决定要不要花新建的钱去建一条。
     */
    private DapVoice retrainVoice(String owner, DapVoice target, FileStorageService.StoredFile stored,
                                  ShiliuGateway gateway, Instant now) {
        // 下面两道闸在调供应商之前就能判死，素材留着没有任何用处，按 capturePolicy 的既有口径清掉。
        if (!deletableUpstream(target.getEngineRef())) {
            storage.delete(stored.key());
            throw BusinessException.badRequest("CLIP_VOICE_NOT_RETRAINABLE",
                    "这条声音没有可重新训练的引擎记录，请新建一条声音");
        }
        ShiliuGateway.RecreateQuota quota = gateway.recreateQuota(target.getEngineRef());
        if (quota.available() && quota.used() != null && quota.total() != null && quota.used() >= quota.total()) {
            storage.delete(stored.key());
            throw new BusinessException(HttpStatus.CONFLICT, "CLIP_VOICE_RETRAIN_QUOTA_EXHAUSTED",
                    "这条声音的 " + quota.total() + " 次免费重新训练已经用完，请新建一条声音");
        }
        ShiliuGateway.Task task = gateway.recreateVoice(owner, target.getEngineRef(), stored.key());
        String state = "succeeded".equals(task.status()) ? "ready" : "failed".equals(task.status()) ? "failed" : "training";
        target.setEngineStatus(state);
        target.setEngineTrainedAt("ready".equals(state) ? now : null);
        target.setAudioKey(stored.key()); target.setBytes(stored.bytes());
        // 重训 = 换了嗓子，旧样例已经不是这条声音了。不清的话用户会一直听到重训前的音色，
        // 而且因为 key 非空，worker 不会去生成新的。
        if (demos != null) demos.invalidateVoiceDemo(target);
        // 用这条声音出镜的分身，样例里那个人的嗓子也变了，一并作废。
        if (demos != null) {
            for (DapAvatar linked : avatars.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE)) {
                if (target.getId().equals(linked.getVoiceName()) || linked.getId().equals(target.getAvatarId())) {
                    demos.invalidateAvatarDemo(linked);
                    avatars.save(linked);
                }
            }
        }
        voices.save(target);
        return target;
    }

    private DapVoice startVoiceTraining(String owner, FileStorageService.StoredFile stored, ShiliuGateway gateway, Instant now, String kind, String avatarId) {
        ShiliuGateway.Task task = gateway.cloneVoice(owner, stored.key());
        String state = "succeeded".equals(task.status()) ? "ready" : "failed".equals(task.status()) ? "failed" : "training";
        String displayName = voiceDisplayName(kind, now);
        DapVoice v = DapVoice.builder().id("VC-" + uuid(8)).ownerUserId(owner).name(displayName)
                .avatarId(avatarId).kind(kind).tone("本人声线").audioKey(stored.key()).bytes(stored.bytes()).createdAt(now).build();
        v.setName(displayName); v.setKind(kind);
        v.setEngine(ENGINE); v.setEngineRef(task.outputRef() == null ? task.id() : task.outputRef()); v.setEngineStatus(state);
        v.setEngineTrainedAt("ready".equals(state) ? now : null); v.setAudioKey(stored.key()); v.setBytes(stored.bytes()); voices.save(v); return v;
    }
    /**
     * 声音默认名 = 来源 + 日期。原先两种来源各自写死一个常量（「视频原声」「我的声音」），
     * 同一来源录两次就会出现两条完全同名的记录，界面上分不出哪条是哪条。
     */
    private static String voiceDisplayName(String kind, Instant now) {
        var date = now.atZone(java.time.ZoneId.of("Asia/Shanghai"));
        String stamp = date.getMonthValue() + "月" + date.getDayOfMonth() + "日";
        return ("seed".equals(kind) ? "视频提取 · " : "录音上传 · ") + stamp;
    }

    private DapAvatar requiredAvatar(String owner, String id) {
        return avatars.findByIdAndOwnerUserId(id, owner).filter(a -> a.getDeletedAt() == null && ENGINE.equals(a.getEngine()))
                .orElseThrow(() -> BusinessException.notFound("CLIP_AVATAR_NOT_FOUND", "数字分身不存在或无权使用"));
    }
    private DapVoice selectedVoice(String owner, String id) {
        if (id == null || id.isBlank()) return null;
        return voices.findByIdAndOwnerUserId(id, owner).filter(v -> v.getDeletedAt() == null && ENGINE.equals(v.getEngine()))
                .orElseThrow(() -> BusinessException.notFound("CLIP_VOICE_NOT_FOUND", "声音不存在或无权使用"));
    }
    /**
     * 取**明确属于这个形象**的声音。找不到就返回 null —— 绝不替用户挑一条。
     *
     * 原实现有三级回退，最后一级是 `rows.stream().findFirst()`，即「该用户最近创建的任意
     * 一条声音」，跟当前形象毫无关系。真机事故：新建形象选「视频原声」，因为新形象还没有
     * 自己的声音，就抓来了给另一个形象录的声音 —— 成片里男声女声完全错位，而用户毫不知情。
     *
     * 「没配声音」是一个需要用户决定的状态，不是可以静默补全的缺省值。宁可让调用方报错
     * 要求用户明确选择，也不能猜。
     */
    private DapVoice linkedVoice(String owner, DapAvatar avatar) {
        if (avatar == null) return null;
        String ref = avatar.getVoiceName();
        if (ref != null && !ref.isBlank()) {
            DapVoice exact = voices.findByIdAndOwnerUserId(ref, owner)
                    .filter(v -> v.getDeletedAt() == null && ENGINE.equals(v.getEngine())).orElse(null);
            if (exact != null) return exact;
        }
        // 次级：声音自己记录了 avatarId（采集时就绑定到该形象），这仍然是"明确属于它"
        return voices.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE)
                .stream().filter(v -> avatar.getId().equals(v.getAvatarId())).findFirst().orElse(null);
    }
    private String avatarName(String owner, String value) {
        if (value != null && !value.isBlank()) return cleanName(value, "数字分身");
        int count = avatars.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE).size();
        return count == 0 ? "我的数字分身" : "数字分身 " + (count + 1);
    }
    private static String cleanName(String value, String fallback) { String text = value == null ? fallback : value.trim(); return text.substring(0, Math.min(32, text.length())); }
    private static String status(String value) { return value == null ? "none" : Set.of("training", "ready", "failed").contains(value) ? value : "none"; }
    private static int progress(String value) { return "ready".equals(value) ? 100 : "training".equals(value) ? 5 : 0; }
    private static String friendlyFailure(String value, String fallback) { return value == null || value.isBlank() ? fallback : value; }
    private static String uuid(int n) { return UUID.randomUUID().toString().replace("-", "").substring(0, n); }
    private static String sha256(String value) { try { return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception e) { throw new IllegalStateException(e); } }
}
