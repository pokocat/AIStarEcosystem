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
    private static final String AGREEMENT_VERSION = "clip-avatar-v2";
    private static final String AGREEMENT_TITLE = "数字分身本人授权书";
    private static final String AGREEMENT_TEXT = "本人授权军师参谋部使用本人主动提交的视频与声音资料，仅为本人的账号创建、训练和使用数字分身。本人可随时撤回授权并删除分身，删除后停止新的生成。";
    private final DapAvatarRepository avatars; private final DapVoiceRepository voices; private final DapConsentRepository consents;
    private final ClipRenderJobRepository jobs; private final FileStorageService storage; private final ShiliuService shiliu; private final ClipCapturePolicy capturePolicy;
    private final ClipVoiceSeedExtractor voiceSeedExtractor;
    public ClipAvatarService(DapAvatarRepository avatars, DapVoiceRepository voices, DapConsentRepository consents,
                             ClipRenderJobRepository jobs, FileStorageService storage, ShiliuService shiliu,
                             ClipCapturePolicy capturePolicy, ClipVoiceSeedExtractor voiceSeedExtractor) {
        this.avatars = avatars; this.voices = voices; this.consents = consents; this.jobs = jobs; this.storage = storage; this.shiliu = shiliu; this.capturePolicy = capturePolicy;
        this.voiceSeedExtractor = voiceSeedExtractor;
    }

    public CaptureRequirementsDto requirements() { return capturePolicy.requirements(); }

    @Transactional
    public AvatarDto view(String owner) {
        DapAvatar a = avatars.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE).orElse(null);
        DapVoice v = voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE).orElse(null);
        if (a == null && v == null) return null;
        ShiliuGateway gateway = shiliu.required();
        int voiceProgress = progress(v == null ? null : v.getEngineStatus());
        int imageProgress = progress(a == null ? null : a.getEngineStatus());
        String voiceMessage = null;
        String imageMessage = null;
        if (v != null && "training".equals(v.getEngineStatus()) && v.getEngineRef() != null) {
            ShiliuGateway.Task task = gateway.query("speaker:" + v.getEngineRef());
            voiceProgress = task.progress() == null ? voiceProgress : task.progress();
            if ("succeeded".equals(task.status())) { v.setEngineStatus("ready"); v.setEngineTrainedAt(Instant.now()); voices.save(v); }
            else if ("failed".equals(task.status())) { v.setEngineStatus("failed"); voiceMessage = friendlyFailure(task.error(), "声音训练失败，请重新录制"); voices.save(v); }
        }
        if (a != null && "training".equals(a.getEngineStatus()) && a.getEngineRef() != null) {
            ShiliuGateway.Task task = gateway.query("avatar:" + a.getEngineRef());
            imageProgress = task.progress() == null ? imageProgress : task.progress();
            if ("succeeded".equals(task.status())) { a.setEngineStatus("ready"); a.setEngineTrainedAt(Instant.now()); avatars.save(a); }
            else if ("failed".equals(task.status())) { a.setEngineStatus("failed"); imageMessage = friendlyFailure(task.error(), "形象训练失败，请重新录制"); avatars.save(a); }
        }
        String imageStatus = status(a == null ? null : a.getEngineStatus());
        String voiceStatus = status(v == null ? null : v.getEngineStatus());
        if ("ready".equals(imageStatus)) imageProgress = 100;
        if ("ready".equals(voiceStatus)) voiceProgress = 100;
        if ("failed".equals(imageStatus) && imageMessage == null) imageMessage = "形象训练失败，请重新采集";
        if ("failed".equals(voiceStatus) && voiceMessage == null) voiceMessage = "声音训练失败，请重新录制";
        return new AvatarDto(imageStatus, voiceStatus,
                a == null || a.getEngineTrainedAt() == null ? null : a.getEngineTrainedAt().toString(),
                v == null || v.getEngineTrainedAt() == null ? null : v.getEngineTrainedAt().toString(),
                imageProgress, voiceProgress, imageMessage, voiceMessage, ENGINE, false);
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
    public Map<String, Object> clone(String owner, String kind, MultipartFile file) {
        if (!Set.of("avatar", "voice").contains(kind)) throw BusinessException.badRequest("CLIP_CLONE_KIND_INVALID", "采集类型不支持");
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("CLIP_CLONE_FILE_REQUIRED", "未收到采集文件");
        FileStorageService.StoredFile stored = storage.store(file, "clip/clone/" + kind, owner);
        try { capturePolicy.validate(kind, file, stored); }
        catch (RuntimeException e) { storage.delete(stored.key()); throw e; }
        ShiliuGateway gateway = shiliu.required();
        Instant now = Instant.now();
        if ("avatar".equals(kind)) {
            DapAvatar a = avatars.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE).orElseGet(() ->
                    DapAvatar.builder().id("DH-" + uuid(8)).ownerUserId(owner).name("我的数字分身").path("real").status("pending").engine(ENGINE).createdAt(now).build());
            a.setEngine(ENGINE); a.setEngineRef(null); a.setEngineSourceKey(stored.key()); a.setEngineStatus("training");
            a.setEngineTrainedAt(null); a.setMock(gateway.mock()); a.setUpdatedAt(now); avatars.save(a);
            DapVoice readyVoice = voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE)
                    .filter(v -> "ready".equals(v.getEngineStatus())).orElse(null);
            // 官方 speakerId 是 Avatar 训练的选填 demo 参数：有就带，没有也立即开始形象训练。
            startAvatarTraining(owner, a, readyVoice, gateway);
            // 首次只上传一个视频时，尽力从视频原声生成基础音色。
            // 这是同一份素材的后台增强，不再要求用户先多录一段音频；失败不影响 Avatar 主任务。
            if (readyVoice == null) {
                voiceSeedExtractor.extract(owner, stored.key()).ifPresent(seed -> {
                    try { startVoiceTraining(owner, seed, gateway, now, "seed"); }
                    catch (Exception error) { log.warn("[clip-avatar] video voice seed failed owner={}: {}", owner, error.getMessage()); }
                });
            }
        } else {
            startVoiceTraining(owner, stored, gateway, now, "clone");
        }
        return Map.of("ok", true, "kind", kind, "status", "training", "mock", gateway.mock());
    }

    public List<AuditDto> consentLogs(String owner) {
        return consents.findByOwnerUserIdOrderByAcceptedAtDesc(owner).stream().map(c -> new AuditDto(c.getId(), c.getAcceptedAt().toString(), null, c.getScope(), null, "submitted")).toList();
    }
    public List<AuditDto> usageLogs(String owner) {
        return jobs.findTop50ByExternalOwnerIdAndStatusInOrderByCreatedAtDesc(owner, List.of("succeeded", "failed", "cancelled")).stream()
                .map(j -> new AuditDto(j.getId(), j.getCreatedAt().toString(), null, null, "生成口播成片", j.getStatus())).toList();
    }

    @Transactional
    public void delete(String owner) {
        ShiliuGateway gateway = shiliu.required(); Instant now = Instant.now();
        avatars.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE).ifPresent(a -> { if (a.getEngineRef() != null) gateway.deleteAvatar(a.getEngineRef()); storage.delete(a.getEngineSourceKey()); a.setDeletedAt(now); a.setEngineStatus("deleted"); avatars.save(a); });
        voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE).ifPresent(v -> { if (v.getEngineRef() != null) gateway.deleteVoice(v.getEngineRef()); storage.delete(v.getAudioKey()); v.setDeletedAt(now); v.setEngineStatus("deleted"); voices.save(v); });
    }
    public boolean ready(String owner) { AvatarDto v = view(owner); return v != null && "ready".equals(v.imageStatus()); }
    public boolean voiceReady(String owner) { AvatarDto v = view(owner); return v != null && "ready".equals(v.voiceStatus()); }
    public String requiredAvatarEngineRef(String owner) {
        return avatars.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE)
                .filter(a -> "ready".equals(a.getEngineStatus()) && a.getEngineRef() != null && !a.getEngineRef().isBlank())
                .map(DapAvatar::getEngineRef)
                .orElseThrow(() -> new BusinessException(HttpStatus.CONFLICT, "CLIP_AVATAR_NOT_READY", "形象还没有训练完成"));
    }
    public String requiredVoiceEngineRef(String owner) {
        return voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE)
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
    private void startVoiceTraining(String owner, FileStorageService.StoredFile stored, ShiliuGateway gateway, Instant now, String kind) {
        ShiliuGateway.Task task = gateway.cloneVoice(owner, stored.key());
        String state = "succeeded".equals(task.status()) ? "ready" : "failed".equals(task.status()) ? "failed" : "training";
        DapVoice latest = voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE).orElse(null);
        // 视频原声不能覆盖用户正在训练的专属录音；专属录音则可以主动替换此前的基础声音。
        DapVoice v = latest != null && ("clone".equals(kind) || kind.equals(latest.getKind())) ? latest :
                DapVoice.builder().id("VC-" + uuid(8)).ownerUserId(owner).name("seed".equals(kind) ? "视频原声" : "我的声音")
                        .kind(kind).tone("本人声线").audioKey(stored.key()).bytes(stored.bytes()).createdAt(now).build();
        v.setName("seed".equals(kind) ? "视频原声" : "我的声音"); v.setKind(kind);
        v.setEngine(ENGINE); v.setEngineRef(task.outputRef() == null ? task.id() : task.outputRef()); v.setEngineStatus(state);
        v.setEngineTrainedAt("ready".equals(state) ? now : null); v.setAudioKey(stored.key()); v.setBytes(stored.bytes()); voices.save(v);
    }
    private static String status(String value) { return value == null ? "none" : Set.of("training", "ready", "failed").contains(value) ? value : "none"; }
    private static int progress(String value) { return "ready".equals(value) ? 100 : "training".equals(value) ? 5 : 0; }
    private static String friendlyFailure(String value, String fallback) { return value == null || value.isBlank() ? fallback : value; }
    private static String uuid(int n) { return UUID.randomUUID().toString().replace("-", "").substring(0, n); }
    private static String sha256(String value) { try { return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception e) { throw new IllegalStateException(e); } }
}
