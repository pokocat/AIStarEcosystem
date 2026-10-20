package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdminAiModelEndpointUpsertDto;
import com.aistareco.aep.model.AiImageRequestSpec;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiVideoRequestSpec;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.common.BusinessException;
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

    @Test void videoContractRequiresSupplierModelBeforeSave() throws Exception {
        var spec = new AiVideoRequestSpec("seedance", VideoStudioService.contract(5, 15),
                "/tasks", "/tasks/{id}", Map.of(), "");
        var endpoint = AiModelEndpoint.builder().id("video").name("video")
                .providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("https://vendor.example/v1").build();
        var repo = mock(AiModelEndpointRepository.class);
        when(repo.findById("video")).thenReturn(Optional.of(endpoint));
        var service = new AiModelEndpointAdminService(repo, null, null);

        var save = MAPPER.readValue("{\"videoRequestSpec\":"+spec.json()+"}",AdminAiModelEndpointUpsertDto.class);
        BusinessException error = assertThrows(BusinessException.class, () -> service.update("video",save));
        assertEquals("VIDEO_REQUEST_SPEC_INVALID", error.getCode());
        verify(repo, never()).save(any(AiModelEndpoint.class));
    }

    @Test void customVideoContractWithoutModelVariableSavesWithoutSupplierModel() throws Exception {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720)))),
                4, 15, 2000, 4294967295L);
        var spec = new AiVideoRequestSpec("json-template", contract, "/tasks", "/tasks/{id}", Map.of(),
                null, null, Map.of("t2v", Map.of("prompt", "${prompt}")));
        var endpoint = AiModelEndpoint.builder().id("custom-video").name("video")
                .providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("https://vendor.example/v1").build();
        var repo = mock(AiModelEndpointRepository.class);
        when(repo.findById("custom-video")).thenReturn(Optional.of(endpoint));
        when(repo.save(any(AiModelEndpoint.class))).thenAnswer(call -> call.getArgument(0));
        var service = new AiModelEndpointAdminService(repo, null, null);

        var save = MAPPER.readValue("{\"videoRequestSpec\":" + spec.json() + "}", AdminAiModelEndpointUpsertDto.class);
        service.update("custom-video", save);
        assertNull(endpoint.getModel());
        assertEquals(spec, AiVideoRequestSpec.read(endpoint.getVideoRequestSpecJson()));
    }

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
        var capability=com.aistareco.aep.dto.EndpointCapabilityDto.image(null,spec);
        assertEquals(2048,capability.imagePromptMaxChars());
        assertEquals(0,capability.maxRefImages());
        assertEquals(List.of(new com.aistareco.aep.dto.EndpointCapabilityDto.ImageSize("1024x1024","1:1")),capability.imageSizes());

        var legacyCapability=com.aistareco.aep.dto.EndpointCapabilityDto.image(null,null);
        assertNull(legacyCapability.maxRefImages());

        var changeModel = MAPPER.readValue("{\"model\":\"other-image\"}",AdminAiModelEndpointUpsertDto.class);
        service.update("ernie",changeModel);
        assertNull(endpoint.getImageRequestSpecJson());
    }
}
