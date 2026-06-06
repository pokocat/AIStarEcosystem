package com.aistareco.aep.service;

import com.aistareco.aep.dto.MixcutTemplateUpsertRequest;
import com.aistareco.aep.model.MixcutTemplate;
import com.aistareco.aep.repository.MixcutTemplateRepository;
import com.aistareco.aep.service.mixcut.MixcutTemplateService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class MixcutTemplateServiceTest {

    private final MixcutTemplateRepository repo = mock(MixcutTemplateRepository.class);
    private final MixcutTemplateService service = new MixcutTemplateService(repo, new ObjectMapper());

    @Test
    void upsertFactoryAlwaysWritesFactoryScope() {
        when(repo.findByTemplateIdAndOwnerScope("tpl-demo", MixcutTemplateService.FACTORY_SCOPE))
                .thenReturn(Optional.empty());
        when(repo.save(any(MixcutTemplate.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var saved = service.upsertFactory(new MixcutTemplateUpsertRequest(
                "tpl-demo",
                "公共模板",
                "1.0",
                null,
                null,
                "moderate",
                3,
                null,
                null
        ));

        assertEquals("tpl-demo::factory", saved.getId());
        assertEquals(MixcutTemplateService.FACTORY_SCOPE, saved.getOwnerScope());
        assertNull(saved.getOwnerUserId());
        assertTrue(saved.isFactory());
    }

    @Test
    void deleteFactoryDoesNotTouchUserCopies() {
        var factory = new MixcutTemplate();
        factory.setId("tpl-demo::factory");
        factory.setTemplateId("tpl-demo");
        factory.setOwnerScope(MixcutTemplateService.FACTORY_SCOPE);
        factory.setFactory(true);
        when(repo.findByTemplateIdAndOwnerScope("tpl-demo", MixcutTemplateService.FACTORY_SCOPE))
                .thenReturn(Optional.of(factory));

        assertTrue(service.deleteFactory("tpl-demo"));

        verify(repo).findByTemplateIdAndOwnerScope("tpl-demo", MixcutTemplateService.FACTORY_SCOPE);
        verify(repo).delete(factory);
        verifyNoMoreInteractions(repo);
    }
}
