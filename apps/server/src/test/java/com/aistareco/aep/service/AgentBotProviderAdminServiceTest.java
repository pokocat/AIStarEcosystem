package com.aistareco.aep.service;

import com.aistareco.aep.dto.AgentBotProviderDto;
import com.aistareco.aep.dto.AgentBotProviderUpsertDto;
import com.aistareco.aep.model.AgentBotProvider;
import com.aistareco.aep.repository.AgentBotProviderRepository;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AgentBotProviderAdminService：token 加密落库 + DTO 出口脱敏 + sceneKey 唯一。
 */
class AgentBotProviderAdminServiceTest {

    private static AgentBotProviderUpsertDto sample(String sceneKey) {
        return new AgentBotProviderUpsertDto(
                null, "形象锻造 bot", "coze", sceneKey,
                "https://api.coze.cn", "pat_secret_token_123", "bot-001",
                "aep-producer-", 120000, null, true);
    }

    @Test
    void createEncryptsTokenAndReturnsMasked() {
        AgentBotProviderRepository repo = mock(AgentBotProviderRepository.class);
        when(repo.findBySceneKey("appearance-forge")).thenReturn(Optional.empty());
        when(repo.existsById(any())).thenReturn(false);
        when(repo.save(any(AgentBotProvider.class))).thenAnswer(inv -> inv.getArgument(0));

        AgentBotProviderDto dto = new AgentBotProviderAdminService(repo).create(sample("appearance-forge"));

        assertEquals("appearance-forge", dto.sceneKey());
        assertEquals("coze", dto.platform());
        assertEquals("bot-001", dto.botId());
        assertNotEquals("pat_secret_token_123", dto.tokenMasked(), "明文不应出现在 DTO");
        assertTrue(dto.tokenMasked().startsWith("pat") && dto.tokenMasked().contains("..."),
                "token 应脱敏: " + dto.tokenMasked());

        ArgumentCaptor<AgentBotProvider> cap = ArgumentCaptor.forClass(AgentBotProvider.class);
        verify(repo).save(cap.capture());
        assertNotNull(cap.getValue().getTokenEncrypted());
        assertNotEquals("pat_secret_token_123", cap.getValue().getTokenEncrypted(), "落库必须是密文");
    }

    @Test
    void createRejectsDuplicateScene() {
        AgentBotProviderRepository repo = mock(AgentBotProviderRepository.class);
        when(repo.findBySceneKey("appearance-forge")).thenReturn(
                Optional.of(AgentBotProvider.builder().id("existing").sceneKey("appearance-forge").build()));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> new AgentBotProviderAdminService(repo).create(sample("appearance-forge")));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("SCENE_DUPLICATE", ex.getCode());
    }

    @Test
    void listScenesContainsAppearanceForge() {
        AgentBotProviderRepository repo = mock(AgentBotProviderRepository.class);
        var scenes = new AgentBotProviderAdminService(repo).listScenes();
        assertTrue(scenes.stream().anyMatch(s -> "appearance-forge".equals(s.key())));
    }
}
