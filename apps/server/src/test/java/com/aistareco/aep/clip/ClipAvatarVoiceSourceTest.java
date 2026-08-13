package com.aistareco.aep.clip;

import com.aistareco.aep.clip.service.ClipAvatarService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 声音默认命名。
 *
 * 真机反馈：新建分身时界面出现两个完全同名的「我的声音」，分不出哪条是哪条。
 * 原因是两种来源各自写死一个常量，同一来源录两次必然重名。
 */
class ClipAvatarVoiceSourceTest {

    private String name(String kind, Instant at) throws Exception {
        Method m = ClipAvatarService.class.getDeclaredMethod("voiceDisplayName", String.class, Instant.class);
        m.setAccessible(true);
        return (String) m.invoke(null, kind, at);
    }

    @Test
    @DisplayName("默认名带来源与日期，两种来源不会重名")
    void namesCarrySourceAndDate() throws Exception {
        Instant at = Instant.parse("2026-08-13T02:00:00Z"); // 北京时间 8/13 10:00
        assertThat(name("seed", at)).isEqualTo("视频提取 · 8月13日");
        assertThat(name("clone", at)).isEqualTo("录音上传 · 8月13日");
        assertThat(name("seed", at)).isNotEqualTo(name("clone", at));
    }

    @Test
    @DisplayName("不同日期的同种来源也能区分")
    void differentDaysDiffer() throws Exception {
        String a = name("clone", Instant.parse("2026-08-11T02:00:00Z"));
        String b = name("clone", Instant.parse("2026-08-13T02:00:00Z"));
        assertThat(a).isNotEqualTo(b);
    }

    @Test
    @DisplayName("按东八区算日期，不用服务器时区")
    void usesShanghaiZone() throws Exception {
        // UTC 8/12 17:00 = 北京 8/13 01:00，应算 8月13日
        assertThat(name("seed", Instant.parse("2026-08-12T17:00:00Z"))).isEqualTo("视频提取 · 8月13日");
    }
}
