package com.aistareco.aep.clip.service;

import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapVoice;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapVoiceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 把训练完成的声音/形象补上「先看看」样例。
 *
 * <p>为什么是后台补齐而不是在训练完成那一刻直接生成：engineStatus 变成 ready 的地方有五处
 * （形象刷新、声音刷新、克隆回调、重训回调…），逐个挂钩必漏一个，而漏掉的那条路径上的用户
 * 就永远看不到样例。扫表补齐只有一个入口，天然幂等，失败下一轮还能再来，也不拖慢任何请求路径。
 *
 * <p>每轮只取少量：样例是背景任务，绝不能和用户正在等的出片抢供应商配额。
 */
@Component
public class ClipDemoWorker {
    private static final Logger log = LoggerFactory.getLogger(ClipDemoWorker.class);
    /** 每轮处理上限。宁可补得慢一点，也不要一次把石榴打满而让正在出片的用户排队。 */
    private static final int BATCH = 3;

    private final DapVoiceRepository voices;
    private final DapAvatarRepository avatars;
    private final ClipDemoService demos;

    public ClipDemoWorker(DapVoiceRepository voices, DapAvatarRepository avatars, ClipDemoService demos) {
        this.voices = voices;
        this.avatars = avatars;
        this.demos = demos;
    }

    @Scheduled(fixedDelayString = "${aep.clip.demo-delay-ms:30000}")
    public void tick() {
        pendingVoices().forEach(this::runVoice);
        pendingAvatars().forEach(this::runAvatar);
    }

    private void runVoice(DapVoice voice) {
        try {
            demos.ensureVoiceDemo(voice.getId());
        } catch (Exception e) {
            // ensureVoiceDemo 已经先把 attempts 落库了，所以这里不需要再计数，只记日志。
            // 连续失败 MAX_ATTEMPTS 次后它就不再被选中 —— 用户仍能用按需试听，只是没有零等待的那一条。
            log.warn("[clip-demo] voice {} 样例生成失败（第 {} 次）：{}",
                    voice.getId(), safeAttempts(voice.getDemoAttempts()) + 1, safe(e.getMessage()));
        }
    }

    private void runAvatar(DapAvatar avatar) {
        try {
            demos.ensureAvatarDemo(avatar.getId());
        } catch (Exception e) {
            log.warn("[clip-demo] avatar {} 样例短片生成失败（第 {} 次）：{}",
                    avatar.getId(), safeAttempts(avatar.getDemoAttempts()) + 1, safe(e.getMessage()));
        }
    }

    /**
     * 候选筛选放在内存里做，不写 native query：DapVoice/DapAvatar 的既有 finder 都是按 owner 的，
     * 而这里要跨 owner 扫。用 engine 维度的全量 finder（对账链路已有）再过滤，行数量级可控；
     * 真的涨起来了再换成带索引的派生查询（迁移里已经建好对应的部分索引）。
     */
    private List<DapVoice> pendingVoices() {
        return voices.findByEngineAndDeletedAtIsNull("shiliu").stream()
                .filter(demos::voiceEligible)
                .limit(BATCH)
                .toList();
    }

    private List<DapAvatar> pendingAvatars() {
        return avatars.findByEngineAndDeletedAtIsNull("shiliu").stream()
                .filter(demos::avatarEligible)
                .limit(BATCH)
                .toList();
    }

    private static int safeAttempts(Integer value) { return value == null ? 0 : value; }

    private static String safe(String message) {
        if (message == null || message.isBlank()) return "未知错误";
        return message.substring(0, Math.min(160, message.length()));
    }
}
