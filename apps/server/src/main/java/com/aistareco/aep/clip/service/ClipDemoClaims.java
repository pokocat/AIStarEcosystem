package com.aistareco.aep.clip.service;

import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapVoiceRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 样例生成的「认领」动作，单独成 bean 只为一件事：<b>用 REQUIRES_NEW 让计数独立提交</b>。
 *
 * <p>如果认领和供应商调用在同一个事务里，供应商抛异常会把 attempts+1 一起回滚 ——
 * 于是下一轮又从原次数开始，对着一条坏素材无限重试，而且「上游其实已经受理、我方回滚了」
 * 的那份成本谁也看不见。计数必须先于供应商调用**落地**，才是真正的退避。
 *
 * <p>放在独立 bean 而不是同类方法：Spring 的事务是代理织入的，类内自调用不会走代理，
 * 写成私有方法加 @Transactional 等于没加。
 */
@Component
public class ClipDemoClaims {

    private final DapVoiceRepository voices;
    private final DapAvatarRepository avatars;

    public ClipDemoClaims(DapVoiceRepository voices, DapAvatarRepository avatars) {
        this.voices = voices;
        this.avatars = avatars;
    }

    /** @return true = 抢到了，可以去打供应商；false = 别人抢走了或状态已变，本轮跳过。 */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean claimVoice(String voiceId, int expected) {
        return voices.claimDemo(voiceId, expected, expected + 1) > 0;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean claimAvatar(String avatarId, int expected) {
        return avatars.claimDemo(avatarId, expected, expected + 1) > 0;
    }

    /** 记下在途任务号。同样要独立提交：进程在轮询前被杀，任务号也不能丢。 */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void rememberAvatarTask(String avatarId, String taskRef) {
        avatars.findById(avatarId).ifPresent(a -> { a.setDemoVideoTaskRef(taskRef); avatars.save(a); });
    }
}
