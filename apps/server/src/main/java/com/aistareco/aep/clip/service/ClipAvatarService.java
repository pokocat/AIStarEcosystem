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
    private final ClipVoiceSeedExtractor voiceSeedExtractor; private final ClipAvatarPreviewExtractor previewExtractor;
    public ClipAvatarService(DapAvatarRepository avatars, DapVoiceRepository voices, DapConsentRepository consents,
                             ClipRenderJobRepository jobs, FileStorageService storage, ShiliuService shiliu,
                             ClipCapturePolicy capturePolicy, ClipVoiceSeedExtractor voiceSeedExtractor,
                             ClipAvatarPreviewExtractor previewExtractor) {
        this.avatars = avatars; this.voices = voices; this.consents = consents; this.jobs = jobs; this.storage = storage; this.shiliu = shiliu; this.capturePolicy = capturePolicy;
        this.voiceSeedExtractor = voiceSeedExtractor; this.previewExtractor = previewExtractor;
    }

    public CaptureRequirementsDto requirements() { return capturePolicy.requirements(); }

    @Transactional
    public AvatarDto view(String owner) {
        DapAvatar a = avatars.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE).orElse(null);
        if (a != null) return viewResolved(owner, a);
        DapVoice voice = voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE).orElse(null);
        if (voice == null) return null;
        String voiceStatus = status(voice.getEngineStatus());
        return new AvatarDto("", "未创建形象", "none", voiceStatus, "seed".equals(voice.getKind()) ? "video" : "dedicated", null, null,
                voice.getEngineTrainedAt() == null ? null : voice.getEngineTrainedAt().toString(), 0, "ready".equals(voiceStatus) ? 100 : progress(voice.getEngineStatus()),
                null, null, ENGINE, false, voice.getId(), voice.getName());
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
                v == null ? null : v.getId(), v == null ? null : v.getName());
    }

    @Transactional
    public List<VoiceDto> voiceList(String owner) {
        return voices.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE).stream().map(v -> {
            String current = status(v.getEngineStatus()); int p = progress(v.getEngineStatus());
            if ("ready".equals(current)) p = 100;
            return new VoiceDto(v.getId(), v.getName(), current, "seed".equals(v.getKind()) ? "video" : "dedicated",
                    v.getEngineTrainedAt() == null ? null : v.getEngineTrainedAt().toString(), p);
        }).toList();
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
    public Map<String, Object> clone(String owner, String kind, MultipartFile file) { return clone(owner, kind, file, null, null, null); }

    @Transactional
    public Map<String, Object> clone(String owner, String kind, MultipartFile file, String avatarId, String voiceId, String name) {
        if (!Set.of("avatar", "voice").contains(kind)) throw BusinessException.badRequest("CLIP_CLONE_KIND_INVALID", "采集类型不支持");
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("CLIP_CLONE_FILE_REQUIRED", "未收到采集文件");
        FileStorageService.StoredFile stored = storage.store(file, "clip/clone/" + kind, owner);
        try { capturePolicy.validate(kind, file, stored); }
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
            a.setEngineTrainedAt(null); a.setMock(gateway.mock()); a.setImageKey(preview.key()); a.setImageBytes(preview.bytes()); a.setUpdatedAt(now); avatars.save(a);
            if (previousPreviewKey != null && !previousPreviewKey.equals(preview.key())) storage.delete(previousPreviewKey);
            DapVoice readyVoice = selectedVoice(owner, voiceId);
            if (readyVoice == null) readyVoice = linkedVoice(owner, a);
            if (readyVoice != null && !"ready".equals(readyVoice.getEngineStatus())) readyVoice = null;
            if (readyVoice != null) { a.setVoiceName(readyVoice.getId()); resultVoiceId = readyVoice.getId(); }
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
        } else {
            DapVoice created = startVoiceTraining(owner, stored, gateway, now, "clone", avatarId);
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

    @Transactional
    public void delete(String owner) {
        ShiliuGateway gateway = shiliu.required(); Instant now = Instant.now();
        // 用户可能多次“更换形象/提升声音”，同一 owner 下会保留多个历史有效版本。
        // 只删最新一条会让上一条立刻重新成为 view() 的当前记录，看起来像删除后又复活。
        for (DapAvatar a : avatars.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE)) {
            if (a.getEngineRef() != null) gateway.deleteAvatar(a.getEngineRef());
            storage.delete(a.getEngineSourceKey()); storage.delete(a.getImageKey());
            a.setDeletedAt(now); a.setEngineStatus("deleted"); avatars.save(a);
        }
        for (DapVoice v : voices.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE)) {
            if (v.getEngineRef() != null) gateway.deleteVoice(v.getEngineRef());
            storage.delete(v.getAudioKey());
            v.setDeletedAt(now); v.setEngineStatus("deleted"); voices.save(v);
        }
    }
    @Transactional
    public void delete(String owner, String avatarId) {
        DapAvatar a = requiredAvatar(owner, avatarId); ShiliuGateway gateway = shiliu.required(); Instant now = Instant.now();
        if (a.getEngineRef() != null) gateway.deleteAvatar(a.getEngineRef());
        storage.delete(a.getEngineSourceKey()); storage.delete(a.getImageKey());
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
    public String requiredVoiceEngineRef(String owner) { return requiredVoiceEngineRef(owner, null, null); }
    public String requiredVoiceEngineRef(String owner, String avatarId, String voiceId) {
        DapVoice selected = selectedVoice(owner, voiceId);
        if (selected == null && avatarId != null && !avatarId.isBlank()) selected = linkedVoice(owner, requiredAvatar(owner, avatarId));
        if (selected == null) selected = voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE).orElse(null);
        return Optional.ofNullable(selected)
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
    private DapVoice startVoiceTraining(String owner, FileStorageService.StoredFile stored, ShiliuGateway gateway, Instant now, String kind, String avatarId) {
        ShiliuGateway.Task task = gateway.cloneVoice(owner, stored.key());
        String state = "succeeded".equals(task.status()) ? "ready" : "failed".equals(task.status()) ? "failed" : "training";
        DapVoice v = DapVoice.builder().id("VC-" + uuid(8)).ownerUserId(owner).name("seed".equals(kind) ? "视频原声" : "我的声音")
                .avatarId(avatarId).kind(kind).tone("本人声线").audioKey(stored.key()).bytes(stored.bytes()).createdAt(now).build();
        v.setName("seed".equals(kind) ? "视频原声" : "我的声音"); v.setKind(kind);
        v.setEngine(ENGINE); v.setEngineRef(task.outputRef() == null ? task.id() : task.outputRef()); v.setEngineStatus(state);
        v.setEngineTrainedAt("ready".equals(state) ? now : null); v.setAudioKey(stored.key()); v.setBytes(stored.bytes()); voices.save(v); return v;
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
    private DapVoice linkedVoice(String owner, DapAvatar avatar) {
        if (avatar == null) return null;
        String ref = avatar.getVoiceName();
        if (ref != null && !ref.isBlank()) {
            DapVoice exact = voices.findByIdAndOwnerUserId(ref, owner).filter(v -> v.getDeletedAt() == null && ENGINE.equals(v.getEngine())).orElse(null);
            if (exact != null) return exact;
        }
        List<DapVoice> rows = voices.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE);
        if (rows == null || rows.isEmpty()) return voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE).orElse(null);
        DapVoice attached = rows.stream().filter(v -> avatar.getId().equals(v.getAvatarId())).findFirst().orElse(null);
        return attached != null ? attached : rows.stream().findFirst().orElse(null);
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
