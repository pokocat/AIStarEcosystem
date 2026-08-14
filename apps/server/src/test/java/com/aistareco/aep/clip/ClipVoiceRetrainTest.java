package com.aistareco.aep.clip;

import com.aistareco.aep.clip.service.ClipAvatarService;
import com.aistareco.aep.clip.service.shiliu.MockShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.aep.dap.model.DapVoice;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapConsentRepository;
import com.aistareco.aep.dap.repository.DapVoiceRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 重录已有声音 = 只能重训，或者报错。**不许回落成新建**。
 *
 * 每条 speaker 官方给 4 次重训且不消耗克隆权益；此前每次重录都 /speaker/create 新建，
 * 把账户 availableSpeaker 烧到 0（2026-08-13 实测）。
 *
 * 后来加了 recreate，但留了两条回落（额度用尽 / recreate 调用失败）都落到 startVoiceTraining。
 * 那比原来更糟：用户按「重训」的价付了钱、界面按「换掉现有音色」描述了结果，
 * 系统却新建了一条、多烧一份克隆权益 —— 三头对不上，而且全程静默。
 * 现在失败就是失败，由用户自己决定要不要花新建的钱。
 */
class ClipVoiceRetrainTest {

    private final DapAvatarRepository avatars = mock(DapAvatarRepository.class);
    private final DapVoiceRepository voices = mock(DapVoiceRepository.class);
    private final FileStorageService storage = mock(FileStorageService.class);
    private final ShiliuService shiliu = mock(ShiliuService.class);
    private final ShiliuGateway gateway = mock(ShiliuGateway.class);

    private ClipAvatarService service() {
        when(shiliu.required()).thenReturn(gateway);
        when(storage.store(any(org.springframework.web.multipart.MultipartFile.class), anyString(), anyString()))
                .thenReturn(new FileStorageService.StoredFile("clip/clone/voice/a.m4a", null, null, null, 2048, "audio/mp4"));
        when(voices.save(any(DapVoice.class))).thenAnswer(i -> i.getArgument(0));
        return new ClipAvatarService(avatars, voices, mock(DapConsentRepository.class),
                mock(com.aistareco.aep.clip.repository.ClipRenderJobRepository.class),
                storage, shiliu,
                mock(com.aistareco.aep.clip.service.ClipCapturePolicy.class),
                mock(com.aistareco.aep.clip.service.ClipVoiceSeedExtractor.class),
                mock(com.aistareco.aep.clip.service.ClipAvatarPreviewExtractor.class));
    }

    private MockMultipartFile upload() {
        return new MockMultipartFile("file", "voice.m4a", "audio/mp4", new byte[] { 1, 2, 3, 4 });
    }

    /** engineRef 必须是纯数字才是真实 speaker；mock 时代的记录形如 mock-voice-xxx。 */
    private DapVoice existingVoice(String engineRef) {
        DapVoice v = DapVoice.builder().id("VC-1").ownerUserId("owner-1").engine("shiliu")
                .engineRef(engineRef).engineStatus("ready").build();
        when(voices.findByIdAndOwnerUserId("VC-1", "owner-1")).thenReturn(Optional.of(v));
        return v;
    }

    private void retrain(ClipAvatarService service) {
        service.clone("owner-1", "voice", upload(), null, "VC-1", null, null);
    }

    @Test
    @DisplayName("额度用尽 → 报错，绝不新建一条")
    void exhaustedThrowsInsteadOfCreating() {
        existingVoice("1873405707094174");
        when(gateway.recreateQuota("1873405707094174")).thenReturn(new ShiliuGateway.RecreateQuota(4, 4, true));
        ClipAvatarService service = service();

        assertThatThrownBy(() -> retrain(service))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("已经用完");
        // 这一条是本用例的全部意义：不许有任何「悄悄换成新建」的路径。
        verify(gateway, never()).cloneVoice(anyString(), anyString());
    }

    @Test
    @DisplayName("recreate 调用失败 → 原样抛出，不吞掉也不改道")
    void recreateFailurePropagates() {
        existingVoice("1873405707094174");
        when(gateway.recreateQuota("1873405707094174")).thenReturn(new ShiliuGateway.RecreateQuota(1, 4, true));
        when(gateway.recreateVoice(anyString(), anyString(), anyString()))
                .thenThrow(BusinessException.badRequest("CLIP_ENGINE_FAILED", "供应商拒绝了这次重训"));
        ClipAvatarService service = service();

        assertThatThrownBy(() -> retrain(service))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("供应商拒绝了这次重训");
        verify(gateway, never()).cloneVoice(anyString(), anyString());
    }

    @Test
    @DisplayName("没有可重训的引擎记录 → 报错，而不是当成新建")
    void nonRetrainableRefThrows() {
        existingVoice("mock-voice-abc");
        ClipAvatarService service = service();

        assertThatThrownBy(() -> retrain(service))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("新建一条声音");
        verify(gateway, never()).cloneVoice(anyString(), anyString());
        verify(gateway, never()).recreateVoice(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("还有额度 → 就地重训同一条，不产生新的声音记录")
    void withQuotaRetrainsInPlace() {
        DapVoice target = existingVoice("1873405707094174");
        when(gateway.recreateQuota("1873405707094174")).thenReturn(new ShiliuGateway.RecreateQuota(1, 4, true));
        when(gateway.recreateVoice(anyString(), anyString(), anyString()))
                .thenReturn(new ShiliuGateway.Task("t-1", "processing", null, "1873405707094174", null));

        var result = service().clone("owner-1", "voice", upload(), null, "VC-1", null, null);

        assertThat(result.get("voiceId")).isEqualTo(target.getId());
        verify(gateway, never()).cloneVoice(anyString(), anyString());
    }

    @Test
    @DisplayName("额度读不到时按「可以试」处理，不能当成已用尽")
    void unknownQuotaStillTriesRecreate() {
        existingVoice("1873405707094174");
        // 读失败置 null。把未知当成用尽会让用户白白被挡；真失败了 recreate 自己会抛。
        when(gateway.recreateQuota("1873405707094174")).thenReturn(new ShiliuGateway.RecreateQuota(null, null, false));
        when(gateway.recreateVoice(anyString(), anyString(), anyString()))
                .thenReturn(new ShiliuGateway.Task("t-2", "processing", null, "1873405707094174", null));

        service().clone("owner-1", "voice", upload(), null, "VC-1", null, null);

        verify(gateway).recreateVoice(anyString(), eq("1873405707094174"), anyString());
        verify(gateway, never()).cloneVoice(anyString(), anyString());
    }

    @Test
    @DisplayName("没指定 voiceId 才是新建；这条路不受影响")
    void noVoiceIdStillCreates() {
        when(gateway.cloneVoice(anyString(), anyString()))
                .thenReturn(new ShiliuGateway.Task("t-3", "processing", null, "999", null));

        service().clone("owner-1", "voice", upload(), null, null, null, null);

        verify(gateway).cloneVoice(anyString(), anyString());
        verify(gateway, never()).recreateVoice(anyString(), anyString(), anyString());
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
    }
}
