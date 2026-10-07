package com.aistareco.aep.service;

import com.aistareco.aep.clip.service.ClipAvatarService;
import com.aistareco.aep.clip.service.ClipOutputStorage;
import com.aistareco.aep.clip.service.shiliu.ShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.aep.model.DramaShort;
import com.aistareco.aep.repository.DramaShortRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

/**
 * 风格短片逐镜配音准备。复用平台已有石榴 V2 音色，不触碰视频生成。
 * 每条成功音频立即镜像到我方存储并在分镜上记录文本指纹；重试只补缺失/过期项，避免重复消耗。
 */
@Service
public class DramaShortAudioService {
    private static final Logger log = LoggerFactory.getLogger(DramaShortAudioService.class);
    private final DramaShortRepository repo;
    private final DramaShortService shorts;
    private final ClipAvatarService avatars;
    private final ShiliuService shiliu;
    private final ClipOutputStorage outputStorage;
    private final CdnUrlSigner signer;
    private final ObjectMapper om;

    public DramaShortAudioService(DramaShortRepository repo,
                                  DramaShortService shorts,
                                  ClipAvatarService avatars,
                                  ShiliuService shiliu,
                                  ClipOutputStorage outputStorage,
                                  CdnUrlSigner signer,
                                  ObjectMapper om) {
        this.repo = repo;
        this.shorts = shorts;
        this.avatars = avatars;
        this.shiliu = shiliu;
        this.outputStorage = outputStorage;
        this.signer = signer == null ? CdnUrlSigner.NOOP : signer;
        this.om = om;
    }

    /** 生成所有有台词且指纹未命中的镜头音频；无台词镜头由总装生成静音轨。 */
    public JsonNode prepare(String shortId, String userId) {
        DramaShort row = requireOwned(shortId, userId);
        ObjectNode data = readPayload(row);
        JsonNode shots = data.path("shots");
        if (!shots.isArray() || shots.isEmpty()) {
            throw BusinessException.badRequest("DRAMA_SHORT_AUDIO_NO_SHOTS", "还没有分镜，没法配音。");
        }
        String avatarId = text(data.path("characterAvatar"), "id");
        boolean hasDialogue = false;
        for (JsonNode shot : shots) if (!clean(shot.path("voText").asText("")).isBlank()) hasDialogue = true;
        if (hasDialogue && (avatarId == null || avatarId.isBlank())) {
            throw new BusinessException(HttpStatus.CONFLICT, "DRAMA_SHORT_VOICE_SOURCE_REQUIRED",
                    "请先绑定一位有声音的数字人，再生成配音。");
        }

        String voiceRef = hasDialogue ? avatars.requiredVoiceEngineRef(userId, avatarId, null) : null;
        ShiliuGateway gateway = hasDialogue ? shiliu.required() : null;
        if (gateway != null && gateway.mock()) {
            // 测试替身出不了真配音，也不许拿它冒充成品（§8.0）。给用户的话只说「还没开通」
            // （前端按错误码再换一次说法）；运营该去配什么写进 internalDetail —— 它随追查号落进
            // 后台错误日志，同时打一行 WARN，查这个报错时两处都能看到。
            String opsHint = "配音走石榴 V2 音色 TTS（ShiliuService），当前拿到的是测试替身：要么 AEP_CLIP_FORCE_MOCK=true，"
                    + "要么没配 AEP_CLIP_SHILIU_BASE_URL / AEP_CLIP_SHILIU_TOKEN 且 AEP_CLIP_ALLOW_MOCK=true。"
                    + "在 server.env 配齐这两项、把 AEP_CLIP_FORCE_MOCK 关掉，重启后可用。";
            log.warn("[drama-short-audio] tts not configured user={} short={} —— {}", userId, shortId, opsHint);
            throw BusinessException.wrapped(HttpStatus.SERVICE_UNAVAILABLE, "DRAMA_SHORT_TTS_NOT_CONFIGURED",
                    "配音功能还没开通，请联系平台开通后再用。", opsHint);
        }
        ArrayNode prepared = om.createArrayNode();
        int reused = 0;
        for (JsonNode raw : shots) {
            if (!(raw instanceof ObjectNode shot)) continue;
            String dialogue = clean(shot.path("voText").asText(""));
            if (dialogue.isBlank()) continue;
            String fingerprint = DramaShortContinuityService.fingerprint(dialogue);
            JsonNode existing = shot.path("audio");
            if (fingerprint.equals(existing.path("textFingerprint").asText(""))
                    && !clean(existing.path("cdnKey").asText("")).isBlank()) {
                reused++;
                prepared.add(wireShot(shot, existing));
                continue;
            }
            ShiliuGateway.Task task = gateway.previewVoice(userId, voiceRef, dialogue);
            if (!"succeeded".equals(task.status()) || task.outputRef() == null || task.outputRef().isBlank()) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "DRAMA_SHORT_TTS_FAILED",
                        "镜 " + shot.path("no").asInt() + " 的配音没生成出来。已配好的镜头会保留，再试一次只补没配好的。");
            }
            // HttpShiliuGateway 已把 base64 音频直接写入我方 FileStorage；优先复用该 key，
            // 避免再经签名 URL 下载一遍。旧/替代网关没返回 key 时才走安全镜像兼容路径。
            String key = task.outputCdnKey() != null && !task.outputCdnKey().isBlank()
                    ? task.outputCdnKey() : outputStorage.persistAudio(userId, task.outputRef());
            ObjectNode audio = om.createObjectNode();
            audio.put("cdnKey", key);
            audio.put("durationSec", task.durationSec() == null
                    ? Math.max(1, Math.round(dialogue.length() / 4f)) : task.durationSec());
            audio.put("textFingerprint", fingerprint);
            audio.put("providerTaskId", task.id());
            audio.put("at", OffsetDateTime.now().toString());
            shot.set("audio", audio);
            // 外部调用后立即 checkpoint；后续某镜失败时，重试不会再次生成已成功音频。
            // 只把这一镜的 audio merge 回**当前最新** payload（行锁内），不拿几秒前的旧快照整份覆盖，
            // 否则用户这期间的自动保存会被抹掉（lost update）。草稿已删则跳过（音频已镜像存储，孤儿对象无害）。
            String shotId = text(shot, "id");
            int shotNo = shot.path("no").asInt(-1);
            shorts.applyServerUpdate(shortId, userId, (r, current) -> {
                ObjectNode target = findShot(current, shotId, shotNo);
                if (target != null) target.set("audio", audio.deepCopy());
            });
            prepared.add(wireShot(shot, audio));
        }

        ObjectNode out = om.createObjectNode();
        out.put("preparedCount", prepared.size());
        out.put("reusedCount", reused);
        out.put("provider", "shiliu-v2-voice");
        out.set("shots", prepared);
        return out;
    }

    private ObjectNode wireShot(JsonNode shot, JsonNode audio) {
        ObjectNode out = om.createObjectNode();
        out.put("shotId", shot.path("id").asText());
        out.put("shotNo", shot.path("no").asInt());
        out.put("cdnKey", audio.path("cdnKey").asText());
        out.put("url", signer.signKey(audio.path("cdnKey").asText()));
        out.put("durationSec", audio.path("durationSec").asInt());
        out.put("textFingerprint", audio.path("textFingerprint").asText());
        return out;
    }

    private DramaShort requireOwned(String id, String userId) {
        return repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "DRAMA_SHORT_NOT_FOUND", "找不到这条短视频"));
    }

    private ObjectNode readPayload(DramaShort row) {
        try {
            JsonNode node = row.getPayloadJson() == null ? om.createObjectNode() : om.readTree(row.getPayloadJson());
            return node instanceof ObjectNode object ? object : om.createObjectNode();
        } catch (Exception e) {
            throw new IllegalStateException("read drama short payload", e);
        }
    }

    /** 在最新 payload 的 shots 里按 id（缺 id 退到镜号 no）定位这一镜，找不到返回 null（用户已删该镜）。 */
    private static ObjectNode findShot(ObjectNode data, String shotId, int shotNo) {
        JsonNode shots = data == null ? null : data.path("shots");
        if (shots == null || !shots.isArray()) return null;
        for (JsonNode raw : shots) {
            if (!(raw instanceof ObjectNode shot)) continue;
            if (shotId != null) {
                if (shotId.equals(text(shot, "id"))) return shot;
            } else if (shotNo >= 0 && shot.path("no").asInt(-1) == shotNo) {
                return shot;
            }
        }
        return null;
    }

    private static String text(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field)) return null;
        String value = node.path(field).asText(null);
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String clean(String value) { return value == null ? "" : value.trim(); }
}
