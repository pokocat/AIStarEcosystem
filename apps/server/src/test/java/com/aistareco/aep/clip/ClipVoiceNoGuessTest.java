package com.aistareco.aep.clip;

import com.aistareco.aep.clip.service.ClipAvatarService;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapVoice;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapConsentRepository;
import com.aistareco.aep.dap.repository.DapVoiceRepository;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 绝不替用户挑声音。
 *
 * 真机事故：新建形象选「视频原声」，因为新形象还没有自己的声音，
 * linkedVoice 的第三级回退抓来了「该用户最近创建的任意一条声音」——
 * 那是给另一个形象录的，成片里男声女声完全错位，而用户毫不知情。
 * 「没配声音」是需要用户决定的状态，不是可以静默补全的缺省值。
 */
class ClipVoiceNoGuessTest {

    private final DapAvatarRepository avatars = mock(DapAvatarRepository.class);
    private final DapVoiceRepository voices = mock(DapVoiceRepository.class);

    private ClipAvatarService service() {
        return new ClipAvatarService(avatars, voices, mock(DapConsentRepository.class),
                mock(com.aistareco.aep.clip.repository.ClipRenderJobRepository.class),
                mock(com.aistareco.aep.service.storage.FileStorageService.class),
                mock(ShiliuService.class),
                mock(com.aistareco.aep.clip.service.ClipCapturePolicy.class),
                mock(com.aistareco.aep.clip.service.ClipVoiceSeedExtractor.class),
                mock(com.aistareco.aep.clip.service.ClipAvatarPreviewExtractor.class));
    }

    private DapAvatar avatar(String id, String voiceName) {
        return DapAvatar.builder().id(id).ownerUserId("owner-1").engine("shiliu")
                .voiceName(voiceName).engineStatus("ready").build();
    }

    private DapVoice voice(String id, String avatarId) {
        return DapVoice.builder().id(id).ownerUserId("owner-1").engine("shiliu")
                .avatarId(avatarId).engineRef("1873405707094174").engineStatus("ready").build();
    }

    @Test
    @DisplayName("形象没有自己的声音时，不得挪用别的形象的声音")
    void doesNotBorrowAnotherAvatarsVoice() {
        DapAvatar target = avatar("DH-new", null);
        DapVoice othersVoice = voice("VC-other", "DH-someone-else");
        when(avatars.findByIdAndOwnerUserId("DH-new", "owner-1")).thenReturn(Optional.of(target));
        when(voices.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc("owner-1", "shiliu"))
                .thenReturn(List.of(othersVoice));

        assertThatThrownBy(() -> service().requiredVoiceEngineRef("owner-1", "DH-new", null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("还没有关联声音");
    }

    @Test
    @DisplayName("完全没有任何声音时也报错，而不是静默放行")
    void noVoiceAtAllStillErrors() {
        when(avatars.findByIdAndOwnerUserId("DH-new", "owner-1")).thenReturn(Optional.of(avatar("DH-new", null)));
        when(voices.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc("owner-1", "shiliu"))
                .thenReturn(List.of());

        assertThatThrownBy(() -> service().requiredVoiceEngineRef("owner-1", "DH-new", null))
                .isInstanceOf(BusinessException.class);
        // 关键：绝不能因为"库里就一条"就拿来用
        verify(voices, never()).findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(anyString(), anyString());
    }

    @Test
    @DisplayName("形象明确关联的声音仍然正常取到")
    void explicitlyLinkedVoiceStillResolves() {
        DapVoice own = voice("VC-own", "DH-new");
        when(avatars.findByIdAndOwnerUserId("DH-new", "owner-1")).thenReturn(Optional.of(avatar("DH-new", "VC-own")));
        when(voices.findByIdAndOwnerUserId("VC-own", "owner-1")).thenReturn(Optional.of(own));

        assertThat(service().requiredVoiceEngineRef("owner-1", "DH-new", null)).isEqualTo("1873405707094174");
    }

    @Test
    @DisplayName("声音自己记录了 avatarId 也算明确属于该形象")
    void voiceTaggedWithAvatarIdResolves() {
        when(avatars.findByIdAndOwnerUserId("DH-new", "owner-1")).thenReturn(Optional.of(avatar("DH-new", null)));
        when(voices.findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc("owner-1", "shiliu"))
                .thenReturn(List.of(voice("VC-tagged", "DH-new")));

        assertThat(service().requiredVoiceEngineRef("owner-1", "DH-new", null)).isEqualTo("1873405707094174");
    }

    @Test
    @DisplayName("用户显式指定 voiceId 时按指定的来")
    void explicitVoiceIdWins() {
        DapVoice picked = voice("VC-picked", null);
        when(voices.findByIdAndOwnerUserId("VC-picked", "owner-1")).thenReturn(Optional.of(picked));

        assertThat(service().requiredVoiceEngineRef("owner-1", null, "VC-picked")).isEqualTo("1873405707094174");
    }
}
