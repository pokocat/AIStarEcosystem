package com.aistareco.aep.clip.service;

import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapVoice;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 固化样例的**选取条件**测试。
 *
 * 这里不打供应商、不碰存储，只锁「哪些行该被 worker 选中」——
 * 因为线上出问题的方式基本都是选错：要么永远不选（用户看不到样例），
 * 要么一直选（对着一条坏素材无限重试、白烧点数）。
 */
class ClipDemoServiceTest {

    private final ClipDemoService service = new ClipDemoService(null, null, null, null, null);

    private static DapVoice voice() {
        DapVoice v = new DapVoice();
        v.setId("v_1");
        v.setOwnerUserId("owner_1");
        v.setEngineStatus("ready");
        v.setEngineRef("2001");
        v.setDemoAttempts(0);
        return v;
    }

    private static DapAvatar avatar() {
        DapAvatar a = new DapAvatar();
        a.setId("a_1");
        a.setOwnerUserId("owner_1");
        a.setEngineStatus("ready");
        a.setEngineRef("3001");
        a.setDemoAttempts(0);
        return a;
    }

    @Test
    void 训练好且还没有样例的声音才会被选中() {
        assertThat(service.voiceEligible(voice())).isTrue();
    }

    @Test
    void 还在训练的声音不选_否则会拿一个没就绪的_speakerId_去合成() {
        DapVoice v = voice();
        v.setEngineStatus("training");
        assertThat(service.voiceEligible(v)).isFalse();
    }

    @Test
    void 已经有样例的不重复生成_这是固化的全部意义() {
        DapVoice v = voice();
        v.setDemoAudioCdnKey("clip/voice-demo/owner_1/x.mp3");
        assertThat(service.voiceEligible(v)).isFalse();
    }

    @Test
    void 连续失败到上限后放弃_不对着坏素材无限重试() {
        DapVoice v = voice();
        v.setDemoAttempts(ClipDemoService.MAX_ATTEMPTS);
        assertThat(service.voiceEligible(v)).isFalse();
    }

    @Test
    void 软删除的行不选() {
        DapVoice v = voice();
        v.setDeletedAt(Instant.now());
        assertThat(service.voiceEligible(v)).isFalse();

        DapAvatar a = avatar();
        a.setDeletedAt(Instant.now());
        assertThat(service.avatarEligible(a)).isFalse();
    }

    @Test
    void 没有引擎引用的行不选_ready_但_engineRef_为空是脏数据() {
        DapVoice v = voice();
        v.setEngineRef("  ");
        assertThat(service.voiceEligible(v)).isFalse();

        DapAvatar a = avatar();
        a.setEngineRef(null);
        assertThat(service.avatarEligible(a)).isFalse();
    }

    @Test
    void attempts_为_null_的历史行按零处理_不能因为空值就永不生成() {
        DapVoice v = voice();
        v.setDemoAttempts(null);
        assertThat(service.voiceEligible(v)).isTrue();

        DapAvatar a = avatar();
        a.setDemoAttempts(null);
        assertThat(service.avatarEligible(a)).isTrue();
    }

    @Test
    void 形象与声音各自独立判定_一边有样例不影响另一边() {
        DapAvatar a = avatar();
        a.setDemoVideoCdnKey("clip/avatar-demo/owner_1/x.mp4");
        assertThat(service.avatarEligible(a)).isFalse();
        // 声音那条不受影响，仍该被选中 —— 这就是「解耦」的含义
        assertThat(service.voiceEligible(voice())).isTrue();
    }

    @Test
    void 有在途任务号的形象必须继续被选中_否则提交成功的片子没人去取() {
        // createByText 是异步的：提交只回 videoId，成片要下一轮 query() 才拿得到。
        // 如果这里按「次数已用满」把它排除掉，那条已经付过费的任务就永远没人去收成片。
        DapAvatar a = avatar();
        a.setDemoAttempts(ClipDemoService.MAX_ATTEMPTS);
        a.setDemoVideoTaskRef("video:8899");
        assertThat(service.avatarEligible(a)).isTrue();
    }

    @Test
    void 已经拿到样例短片的不再轮询_即便任务号还挂着() {
        DapAvatar a = avatar();
        a.setDemoVideoTaskRef("video:8899");
        a.setDemoVideoCdnKey("clip/segments/owner_1/x.mp4");
        assertThat(service.avatarEligible(a)).isFalse();
    }

    @Test
    void 放弃阈值必须大于一_否则一次网络抖动就永久放弃() {
        // MAX_ATTEMPTS=1 意味着任何一次瞬时失败（供应商抖动、我方存储超时）都会让这条声音
        // 永远拿不到样例，而用户完全不知道为什么别人有、自己没有。
        assertThat(ClipDemoService.MAX_ATTEMPTS).isGreaterThan(1);
    }

    @Test
    void 样例文案是共享常量_声音和形象必须用同一句才好横向比较() {
        assertThat(ClipDemoService.DEMO_TEXT).isNotBlank();
        assertThat(ClipDemoService.DEMO_TEXT.length()).isLessThanOrEqualTo(40);
    }
}
