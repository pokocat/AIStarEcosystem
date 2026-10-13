package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdminAiModelEndpointUpsertDto;
import com.aistareco.aep.model.AiImageRequestSpec;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AiModelEndpointImageSpecTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test void imageContractIsPersistedAndClearedWhenSupplierModelChanges() throws Exception {
        var spec = new AiImageRequestSpec(2048,0,0,"none",List.of(
                new AiImageRequestSpec.Output("1024x1024","1:1",Map.of("resolutionTier","hd","orientation","square"))));
        var endpoint = AiModelEndpoint.builder().id("ernie").name("image")
                .providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("https://api.jusuanhub.com/v1").model("ernie-Image").build();
        var repo = mock(AiModelEndpointRepository.class);
        when(repo.findById("ernie")).thenReturn(Optional.of(endpoint));
        when(repo.save(any(AiModelEndpoint.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var service = new AiModelEndpointAdminService(repo,null,null);

        var save = MAPPER.readValue("{\"imageRequestSpec\":"+spec.json()+"}",AdminAiModelEndpointUpsertDto.class);
        assertEquals("hd",service.update("ernie",save).imageRequestSpec().output("1024x1024").providerFields().get("resolutionTier"));
        assertEquals(spec, AiImageRequestSpec.read(endpoint.getImageRequestSpecJson()));

        var changeModel = MAPPER.readValue("{\"model\":\"other-image\"}",AdminAiModelEndpointUpsertDto.class);
        service.update("ernie",changeModel);
        assertNull(endpoint.getImageRequestSpecJson());
    }
}
