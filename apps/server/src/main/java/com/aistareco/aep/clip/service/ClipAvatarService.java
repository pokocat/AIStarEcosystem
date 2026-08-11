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
import org.springframework.web.multipart.MultipartFile;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Service
public class ClipAvatarService {
    private static final String ENGINE = "shiliu";
    private static final String AGREEMENT_VERSION = "clip-avatar-v1";
    private static final String AGREEMENT_TITLE = "数字分身本人授权书";
    private static final String AGREEMENT_TEXT = "本人授权平台仅为本人创建、训练和使用数字分身，并可随时撤回授权及删除分身。";
    private final DapAvatarRepository avatars; private final DapVoiceRepository voices; private final DapConsentRepository consents;
    private final ClipRenderJobRepository jobs; private final FileStorageService storage; private final ShiliuService shiliu;
    public ClipAvatarService(DapAvatarRepository avatars, DapVoiceRepository voices, DapConsentRepository consents,
                             ClipRenderJobRepository jobs, FileStorageService storage, ShiliuService shiliu) {
        this.avatars = avatars; this.voices = voices; this.consents = consents; this.jobs = jobs; this.storage = storage; this.shiliu = shiliu;
    }

    @Transactional
    public AvatarDto view(String owner) {
        DapAvatar a = avatars.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE).orElse(null);
        DapVoice v = voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE).orElse(null);
        if (a == null && v == null) return null;
        ShiliuGateway gateway = shiliu.required();
        if (v != null && "training".equals(v.getEngineStatus()) && v.getEngineRef() != null) {
            ShiliuGateway.Task task = gateway.query("speaker:" + v.getEngineRef());
            if ("succeeded".equals(task.status())) { v.setEngineStatus("ready"); v.setEngineTrainedAt(Instant.now()); voices.save(v); }
            else if ("failed".equals(task.status())) { v.setEngineStatus("failed"); voices.save(v); }
        }
        if (a != null && "waiting_voice".equals(a.getEngineStatus()) && v != null && "ready".equals(v.getEngineStatus())) {
            startAvatarTraining(owner, a, v, gateway);
        } else if (a != null && "training".equals(a.getEngineStatus()) && a.getEngineRef() != null) {
            ShiliuGateway.Task task = gateway.query("avatar:" + a.getEngineRef());
            if ("succeeded".equals(task.status())) { a.setEngineStatus("ready"); a.setEngineTrainedAt(Instant.now()); avatars.save(a); }
            else if ("failed".equals(task.status())) { a.setEngineStatus("failed"); avatars.save(a); }
        }
        return new AvatarDto(status(a == null ? null : a.getEngineStatus()), status(v == null ? null : v.getEngineStatus()),
                a == null || a.getEngineTrainedAt() == null ? null : a.getEngineTrainedAt().toString(),
                v == null || v.getEngineTrainedAt() == null ? null : v.getEngineTrainedAt().toString(), ENGINE, false);
    }

    @Transactional
    public ConsentDto startConsent(String owner, MultipartFile file, String spokenText) {
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("CLIP_CONSENT_VIDEO_REQUIRED", "请录制本人授权视频");
        if (spokenText == null || spokenText.isBlank()) throw BusinessException.badRequest("CLIP_CONSENT_TEXT_REQUIRED", "缺少授权口令");
        FileStorageService.StoredFile stored = storage.store(file, "clip/consent", owner);
        ShiliuGateway.Task task;
        try {
            task = shiliu.required().createAuthorizationVideo(owner, stored.key(), spokenText);
        } finally {
            // 上游提交完成即删除我方原始核验视频；只保留授权文本哈希和 authId。
            storage.delete(stored.key());
        }
        boolean verified = "succeeded".equals(task.status());
        if (!verified) return new ConsentDto(task.id(), "failed".equals(task.status()) ? "rejected" : "pending", false, task.outputRef());
        Instant now = Instant.now();
        DapConsent consent = DapConsent.builder().id("CS-" + uuid(12)).ownerUserId(owner)
                .captureId(task.outputRef()).agreementVersion(AGREEMENT_VERSION).agreementTitle(AGREEMENT_TITLE)
                .agreementHash(sha256(AGREEMENT_TEXT + "\n" + spokenText.trim())).agreementText(AGREEMENT_TEXT).scope("本人数字分身口播视频生成与四平台发布")
                .periodMonths(24).platforms(List.of("douyin", "kuaishou", "xiaohongshu", "shipinhao"))
                .processors(List.of("AIStarEcosystem", "shiliu")).acceptedAt(now).createdAt(now).build();
        consents.save(consent); return new ConsentDto(consent.getId(), "verified", true, null);
    }

    @Transactional
    public Map<String, Object> clone(String owner, String kind, MultipartFile file) {
        if (!Set.of("avatar", "voice").contains(kind)) throw BusinessException.badRequest("CLIP_CLONE_KIND_INVALID", "采集类型不支持");
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("CLIP_CLONE_FILE_REQUIRED", "未收到采集文件");
        consents.findFirstByOwnerUserIdOrderByAcceptedAtDesc(owner).orElseThrow(() -> new BusinessException(HttpStatus.FORBIDDEN, "CLIP_CONSENT_REQUIRED", "请先完成本人授权核验"));
        FileStorageService.StoredFile stored = storage.store(file, "clip/clone/" + kind, owner);
        ShiliuGateway gateway = shiliu.required();
        Instant now = Instant.now();
        if ("avatar".equals(kind)) {
            DapAvatar a = avatars.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(owner, ENGINE).orElseGet(() ->
                    DapAvatar.builder().id("DH-" + uuid(8)).ownerUserId(owner).name("我的数字分身").path("real").status("pending").engine(ENGINE).createdAt(now).build());
            a.setEngine(ENGINE); a.setEngineRef(null); a.setEngineSourceKey(stored.key()); a.setEngineStatus("waiting_voice");
            a.setEngineTrainedAt(null); a.setMock(gateway.mock()); a.setUpdatedAt(now); avatars.save(a);
            DapVoice readyVoice = voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE)
                    .filter(v -> "ready".equals(v.getEngineStatus())).orElse(null);
            if (readyVoice != null) startAvatarTraining(owner, a, readyVoice, gateway);
        } else {
            ShiliuGateway.Task task = gateway.cloneVoice(owner, stored.key());
            String state = "succeeded".equals(task.status()) ? "ready" : "failed".equals(task.status()) ? "failed" : "training";
            DapVoice v = voices.findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(owner, ENGINE).orElseGet(() ->
                    DapVoice.builder().id("VC-" + uuid(8)).ownerUserId(owner).name("我的声音").kind("clone").tone("本人声线").audioKey(stored.key()).bytes(stored.bytes()).createdAt(now).build());
            v.setEngine(ENGINE); v.setEngineRef(task.outputRef() == null ? task.id() : task.outputRef()); v.setEngineStatus(state);
            v.setEngineTrainedAt("ready".equals(state) ? now : null); v.setAudioKey(stored.key()); v.setBytes(stored.bytes()); voices.save(v);
        }
        return Map.of("ok", true, "kind", kind, "status", "training", "mock", gateway.mock());
    }

    public List<AuditDto> consentLogs(String owner) {
        return consents.findByOwnerUserIdOrderByAcceptedAtDesc(owner).stream().map(c -> new AuditDto(c.getId(), c.getAcceptedAt().toString(), null, c.getScope(), null, "verified")).toList();
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
    public boolean ready(String owner) { AvatarDto v = view(owner); return v != null && "ready".equals(v.imageStatus()) && "ready".equals(v.voiceStatus()); }
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
        DapConsent consent = consents.findFirstByOwnerUserIdOrderByAcceptedAtDesc(owner)
                .orElseThrow(() -> new BusinessException(HttpStatus.FORBIDDEN, "CLIP_CONSENT_REQUIRED", "请先完成本人授权核验"));
        ShiliuGateway.Task task = gateway.cloneAvatar(owner, avatar.getEngineSourceKey(), voice.getEngineRef(), consent.getCaptureId());
        avatar.setEngineRef(task.outputRef());
        avatar.setEngineStatus("failed".equals(task.status()) ? "failed" : "succeeded".equals(task.status()) ? "ready" : "training");
        avatar.setEngineTrainedAt("ready".equals(avatar.getEngineStatus()) ? Instant.now() : null);
        avatar.setUpdatedAt(Instant.now());
        avatars.save(avatar);
    }
    private static String status(String value) { return value == null ? "none" : "waiting_voice".equals(value) ? "training" : Set.of("training", "ready", "failed").contains(value) ? value : "none"; }
    private static String uuid(int n) { return UUID.randomUUID().toString().replace("-", "").substring(0, n); }
    private static String sha256(String value) { try { return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception e) { throw new IllegalStateException(e); } }
}
