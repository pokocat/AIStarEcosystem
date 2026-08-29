package com.aistareco.aep.service;

import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.service.DapAvatarRefResolver;
import com.aistareco.aep.dto.DigitalIpDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.DigitalIp;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.aep.repository.StudioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 工作室惰性补建（2026-08-29）：账号缺 Studio 行时（历史注册路径漏建，
 * 线上审计 17 用户中 6 个缺行），孵化/引入数字人不再 409，而是按
 * 「一号一 Studio」约定自动补建。
 */
class DigitalIpServiceTest {

    private DigitalIpRepository ipRepo;
    private AepUserRepository userRepo;
    private StudioRepository studioRepo;
    private CreditService creditService;
    private PlatformConfigService platformConfigService;
    private DapAvatarRefResolver dapRefResolver;
    private DigitalIpService service;

    private static final String OWNER = "user-1";

    @BeforeEach
    void setUp() {
        ipRepo = mock(DigitalIpRepository.class);
        userRepo = mock(AepUserRepository.class);
        studioRepo = mock(StudioRepository.class);
        creditService = mock(CreditService.class);
        platformConfigService = mock(PlatformConfigService.class);
        dapRefResolver = mock(DapAvatarRefResolver.class);
        service = new DigitalIpService(ipRepo, userRepo, studioRepo,
                creditService, platformConfigService, dapRefResolver);

        when(ipRepo.save(any(DigitalIp.class))).thenAnswer(inv -> inv.getArgument(0));
        when(studioRepo.save(any(Studio.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private AepUser owner() {
        return AepUser.builder()
                .id(OWNER)
                .username("phone_18800000000")
                .displayName("小李")
                .phone("18800000000")
                .build();
    }

    private DapAvatar avatar() {
        return DapAvatar.builder()
                .id("DH-1")
                .ownerUserId(OWNER)
                .name("测试分身")
                .build();
    }

    @Test
    void importFromAvatar_withoutStudio_autoCreatesStudio() {
        when(dapRefResolver.requireUsable(OWNER, "DH-1")).thenReturn(avatar());
        when(dapRefResolver.resolve(anyString(), any()))
                .thenReturn(new DapAvatarRefResolver.View("测试分身", null));
        when(ipRepo.findFirstByOwnerUserIdAndDapAvatarIdAndKind(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(studioRepo.findByOwnerUserId(OWNER)).thenReturn(Optional.empty());
        when(userRepo.findById(OWNER)).thenReturn(Optional.of(owner()));

        DigitalIpDto dto = service.importFromAvatar(Map.of("dapAvatarId", "DH-1"), OWNER);

        ArgumentCaptor<Studio> studioCap = ArgumentCaptor.forClass(Studio.class);
        verify(studioRepo).save(studioCap.capture());
        Studio created = studioCap.getValue();
        assertEquals(OWNER, created.getOwnerUserId());
        assertEquals("小李的工作室", created.getName());
        assertEquals(Studio.StudioKind.PERSONAL_CREATOR, created.getKind());
        assertNotNull(dto);
        assertEquals(created.getId(), dto.studioId());
    }

    @Test
    void importFromAvatar_withExistingStudio_reusesIt() {
        Studio existing = Studio.builder()
                .id("studio-1").ownerUserId(OWNER).name("既有工作室")
                .kind(Studio.StudioKind.MUSIC_STUDIO).status(Studio.StudioStatus.ACTIVE)
                .build();
        when(dapRefResolver.requireUsable(OWNER, "DH-1")).thenReturn(avatar());
        when(dapRefResolver.resolve(anyString(), any()))
                .thenReturn(new DapAvatarRefResolver.View("测试分身", null));
        when(ipRepo.findFirstByOwnerUserIdAndDapAvatarIdAndKind(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(studioRepo.findByOwnerUserId(OWNER)).thenReturn(Optional.of(existing));

        DigitalIpDto dto = service.importFromAvatar(Map.of("dapAvatarId", "DH-1"), OWNER);

        verify(studioRepo, never()).save(any());
        assertEquals("studio-1", dto.studioId());
    }

    @Test
    void create_withoutStudio_autoCreatesStudio() {
        when(userRepo.existsById(OWNER)).thenReturn(true);
        when(studioRepo.findByOwnerUserId(OWNER)).thenReturn(Optional.empty());
        when(userRepo.findById(OWNER)).thenReturn(Optional.of(owner()));
        when(platformConfigService.getLong(anyString(), org.mockito.ArgumentMatchers.anyLong())).thenReturn(0L);

        DigitalIpDto dto = service.create(Map.of("name", "新艺人"), OWNER);

        ArgumentCaptor<Studio> studioCap = ArgumentCaptor.forClass(Studio.class);
        verify(studioRepo).save(studioCap.capture());
        assertEquals(OWNER, studioCap.getValue().getOwnerUserId());
        assertEquals(studioCap.getValue().getId(), dto.studioId());
    }
}
