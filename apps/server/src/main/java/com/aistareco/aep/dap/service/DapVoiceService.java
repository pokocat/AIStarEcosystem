package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.dto.DapDtos.VoiceDto;
import com.aistareco.aep.dap.model.DapVoice;
import com.aistareco.aep.dap.repository.DapVoiceRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 我的声线：克隆登记（原始采样落库，试听 = 采样回放）+ 内置 AI 音色目录。
 * 说明：Agnes 暂无 TTS API —— 内置音色试听返回提示文案；克隆声线试听播放原始采样（诚实降级）。
 */
@Service
public class DapVoiceService {

    private static final SecureRandom RND = new SecureRandom();

    private final DapVoiceRepository voiceRepo;
    private final FileStorageService storage;
    private final DapCatalogService catalog;
    private final CreditService creditService;
    private final DapAccountService accountService;
    private final DapProperties props;
    private final DapSupport support;

    public DapVoiceService(DapVoiceRepository voiceRepo,
                           FileStorageService storage,
                           DapCatalogService catalog,
                           CreditService creditService,
                           DapAccountService accountService,
                           DapProperties props,
                           DapSupport support) {
        this.voiceRepo = voiceRepo;
        this.storage = storage;
        this.catalog = catalog;
        this.creditService = creditService;
        this.accountService = accountService;
        this.props = props;
        this.support = support;
    }

    public List<Map<String, Object>> mine(String userId) {
        return voiceRepo.findByOwnerUserIdOrderByCreatedAtDesc(userId).stream()
                .map(v -> VoiceDto.from(v, storage::signedUrl).toWire())
                .toList();
    }

    @Transactional
    public Map<String, Object> clone(String userId, MultipartFile audio, String name,
                                     String avatarId, String gender) {
        if (audio == null || audio.isEmpty()) {
            throw BusinessException.badRequest("DAP_NO_AUDIO", "未收到声音采样文件");
        }
        accountService.ensureMonthlyGrant(userId);
        long price = props.getPricing().getVoiceClone();
        FileStorageService.StoredFile stored = storage.store(audio, "dap/voice", userId);

        // 展示波形（确定性伪随机，按文件大小播种）
        List<String> wave = new ArrayList<>();
        long seed = stored.bytes();
        for (int i = 0; i < 20; i++) {
            seed = seed * 6364136223846793005L + 1442695040888963407L;
            wave.add(String.valueOf(4 + Math.floorMod(seed, 18)));
        }

        String voiceName = name == null || name.isBlank() ? "我的声音 " + (10 + RND.nextInt(89)) : name.trim();
        DapVoice v = DapVoice.builder()
                .id(uniqueId())
                .ownerUserId(userId)
                .name(voiceName)
                .avatarId(avatarId)
                .kind("clone")
                .gender(gender == null || gender.isBlank() ? "—" : gender)
                .tone("本人声线")
                .dur(estimateDur(stored.bytes()))
                .wave(wave)
                .audioKey(stored.key())
                .bytes(stored.bytes())
                .createdAt(Instant.now())
                .build();
        voiceRepo.save(v);

        if (price > 0) {
            creditService.debit(userId, price, "dap-voice", v.getId(), "声音克隆 · " + voiceName);
        }
        return VoiceDto.from(v, storage::signedUrl).toWire();
    }

    /** 试听：克隆声线 → 原始采样 URL；内置音色 → 暂无 TTS，返回说明。 */
    public Map<String, Object> preview(String userId, String voiceId) {
        if (voiceId != null) {
            DapVoice mine = voiceRepo.findByIdAndOwnerUserId(voiceId, userId).orElse(null);
            if (mine != null && mine.getAudioKey() != null) {
                return Map.of("audioUrl", storage.signedUrl(mine.getAudioKey()), "kind", "sample");
            }
            boolean builtin = catalog.builtinVoices().stream().anyMatch(v -> v.get("id").equals(voiceId));
            if (builtin) {
                return Map.of("kind", "builtin",
                        "message", "内置音色为合成声线，配音时按音色描述实时合成；在线试听即将上线");
            }
        }
        throw BusinessException.notFound("DAP_VOICE_NOT_FOUND", "音色不存在");
    }

    @Transactional
    public void toggleFav(String userId, String voiceId, boolean fav) {
        DapVoice v = voiceRepo.findByIdAndOwnerUserId(voiceId, userId)
                .orElseThrow(() -> BusinessException.notFound("DAP_VOICE_NOT_FOUND", "音色不存在"));
        v.setFav(fav);
        voiceRepo.save(v);
    }

    private static String estimateDur(long bytes) {
        long secs = Math.max(3, Math.min(120, bytes / 32_000)); // 粗估（~256kbps）
        return String.format("%02d:%02d", secs / 60, secs % 60);
    }

    private String uniqueId() {
        for (int i = 0; i < 20; i++) {
            String id = support.newId("VC");
            if (!voiceRepo.existsById(id)) return id;
        }
        return "VC-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
