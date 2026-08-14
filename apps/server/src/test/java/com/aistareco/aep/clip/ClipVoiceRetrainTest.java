package com.aistareco.aep.clip;

import com.aistareco.aep.clip.service.shiliu.MockShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuGateway;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 重录声音必须优先走 recreate。
 *
 * 每条 speaker 官方给 4 次重训且**不消耗克隆权益**；此前每次重录都 /speaker/create 新建，
 * 把账户 availableSpeaker 烧到 0（2026-08-13 实测）。这里钉住额度判定这一段纯逻辑。
 */
class ClipVoiceRetrainTest {

    /** 与 ClipAvatarService.retrainVoice 中的判定同构；改一处必须同步改另一处。 */
    private boolean exhausted(ShiliuGateway.RecreateQuota q) {
        return q.available() && q.used() != null && q.total() != null && q.used() >= q.total();
    }

    @Test
    @DisplayName("还有次数就判为可重训")
    void hasQuotaLeft() {
        assertThat(exhausted(new ShiliuGateway.RecreateQuota(1, 4, true))).isFalse();
        assertThat(exhausted(new ShiliuGateway.RecreateQuota(3, 4, true))).isFalse();
    }

    @Test
    @DisplayName("次数用尽才回落新建")
    void exhaustedFallsBack() {
        assertThat(exhausted(new ShiliuGateway.RecreateQuota(4, 4, true))).isTrue();
        assertThat(exhausted(new ShiliuGateway.RecreateQuota(5, 4, true))).isTrue();
    }

    @Test
    @DisplayName("额度读不到时按「可以试」处理，不能当成已用尽")
    void unknownQuotaStillTriesRecreate() {
        // 读失败置 null。若把未知当成用尽，就会白白新建、白白消耗一份克隆权益 ——
        // 宁可试一次 recreate，失败了再回落（回落路径有日志可追）。
        assertThat(exhausted(new ShiliuGateway.RecreateQuota(null, null, false))).isFalse();
        assertThat(exhausted(new ShiliuGateway.RecreateQuota(null, 4, true))).isFalse();
    }

    @Test
    @DisplayName("mock 的重训复用同一个 speakerId，新建则不会")
    void mockRecreateKeepsSameId() {
        MockShiliuGateway mock = new MockShiliuGateway();
        assertThat(mock.recreateVoice("owner-1", "1873405707094174", "clip/a.m4a").outputRef())
                .isEqualTo("1873405707094174");
        assertThat(mock.cloneVoice("owner-1", "clip/a.m4a").outputRef())
                .isNotEqualTo("1873405707094174");
    }

    @Test
    @DisplayName("mock 给的是中间态额度，避免端上只在两端被验到")
    void mockQuotaIsMidState() {
        ShiliuGateway.RecreateQuota q = new MockShiliuGateway().recreateQuota("1873405707094174");
        assertThat(q.used()).isEqualTo(1);
        assertThat(q.total()).isEqualTo(4);
        assertThat(exhausted(q)).isFalse();
    }
}
