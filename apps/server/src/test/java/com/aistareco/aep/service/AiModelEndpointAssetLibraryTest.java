package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdminAiModelEndpointUpsertDto;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiVideoRequestSpec;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.service.materialvideo.VideoAssetPreparer;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AiModelEndpointAssetLibraryTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private final AiModelEndpointRepository repo = mock(AiModelEndpointRepository.class);
    private final VideoAssetPreparer preparer = mock(VideoAssetPreparer.class);
    private final AiModelEndpointAdminService service = new AiModelEndpointAdminService(repo, null, null);
    private AiModelEndpoint endpoint;

    @BeforeEach
    void setUp() {
        endpoint = AiModelEndpoint.builder().id("video").name("video").providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("https://vendor.example").model("seedance-2.5")
                .videoRequestSpecJson(spec("seedance").json()).build();
        when(repo.findById("video")).thenReturn(Optional.of(endpoint));
        when(repo.save(any(AiModelEndpoint.class))).thenAnswer(i -> i.getArgument(0));
        ReflectionTestUtils.setField(service, "assetPreparer", preparer);
    }

    private static AiVideoRequestSpec spec(String adapter) {
        return new AiVideoRequestSpec(adapter, VideoStudioService.contract(5, 15), "/tasks", "/tasks/{id}", Map.of(), "");
    }

    private void save(String json) throws Exception {
        service.update("video", MAPPER.readValue(json, AdminAiModelEndpointUpsertDto.class));
    }

    @Test
    void bindsKeepsAndClears() throws Exception {
        save("{\"assetLibraryId\":\"onetoken-main\"}");
        assertEquals("onetoken-main", endpoint.getAssetLibraryId());
        verify(preparer).requireUsable("onetoken-main");

        save("{\"name\":\"改个名字\"}");
        assertEquals("onetoken-main", endpoint.getAssetLibraryId(), "不带这个字段是不改");

        save("{\"assetLibraryId\":\"\"}");
        assertNull(endpoint.getAssetLibraryId(), "空字符串是清除");
    }

    @Test
    void anUnusableLibraryIsRefusedBeforeSaving() throws Exception {
        doThrow(BusinessException.badRequest("VIDEO_ASSET_LIBRARY_NOT_CONFIGURED", "x")).when(preparer).requireUsable("missing");
        var error = assertThrows(BusinessException.class, () -> save("{\"assetLibraryId\":\"missing\"}"));
        assertEquals("VIDEO_ASSET_LIBRARY_NOT_CONFIGURED", error.getCode());
        verify(repo, never()).save(any(AiModelEndpoint.class));
    }

    @Test
    void jusuanAndEndpointsWithoutASpecCannotUseALibrary() throws Exception {
        // 聚算的画布必须带 outputSizeCode，VideoStudioService.contract 给的通用合同没有。
        var jusuan = new VideoStudioContract(List.of(new VideoStudioModeSpec("t2v", false, false, null, null)),
                List.of(new VideoStudioTier("720p", List.of(new VideoStudioCanvas("16:9", 1280, 720, "16:9@720")))),
                4, 15, 2000, 4294967295L);
        endpoint.setVideoRequestSpecJson(new AiVideoRequestSpec("jusuan-media", jusuan,
                "/media/generations", "/jobs/{id}", Map.of(), "").json());
        assertEquals("VIDEO_ASSET_LIBRARY_INVALID",
                assertThrows(BusinessException.class, () -> save("{\"assetLibraryId\":\"onetoken-main\"}")).getCode());

        endpoint.setVideoRequestSpecJson(null);
        assertEquals("VIDEO_ASSET_LIBRARY_INVALID",
                assertThrows(BusinessException.class, () -> save("{\"assetLibraryId\":\"onetoken-main\"}")).getCode());
    }

    @Test
    void changingTheModelKeepsTheBindingBecauseTheLibraryBelongsToTheAccount() throws Exception {
        endpoint.setAssetLibraryId("onetoken-main");
        save("{\"model\":\"seedance-2.0\",\"videoRequestSpec\":" + spec("seedance").json() + "}");
        assertEquals("seedance-2.0", endpoint.getModel());
        assertEquals("onetoken-main", endpoint.getAssetLibraryId());
    }

    @Test
    void changingTheAddressMustSayWhetherToKeepTheBinding() throws Exception {
        endpoint.setAssetLibraryId("onetoken-main");
        String newAddress = "\"baseUrl\":\"https://other.example\",\"videoRequestSpec\":" + spec("seedance").json();

        var error = assertThrows(BusinessException.class, () -> save("{" + newAddress + "}"));
        assertEquals("VIDEO_ASSET_LIBRARY_INVALID", error.getCode());
        assertEquals("https://vendor.example", endpoint.getBaseUrl(), "拒绝时什么都不改");
        assertEquals("onetoken-main", endpoint.getAssetLibraryId());
        verify(repo, never()).save(any(AiModelEndpoint.class));

        save("{" + newAddress + ",\"assetLibraryId\":\"onetoken-main\"}");
        assertEquals("https://other.example", endpoint.getBaseUrl());
        assertEquals("onetoken-main", endpoint.getAssetLibraryId());

        save("{\"baseUrl\":\"https://third.example\",\"videoRequestSpec\":" + spec("seedance").json() + ",\"assetLibraryId\":\"\"}");
        assertEquals("https://third.example", endpoint.getBaseUrl());
        assertNull(endpoint.getAssetLibraryId());
    }

    @Test
    void changingTheSupplierWithoutANewSpecDropsTheSpecAndTheBindingTogether() throws Exception {
        endpoint.setAssetLibraryId("onetoken-main");
        save("{\"baseUrl\":\"https://other.example\"}");
        assertNull(endpoint.getVideoRequestSpecJson());
        assertNull(endpoint.getAssetLibraryId());
    }

    @Test
    void clearingTheVideoSpecDropsTheBinding() throws Exception {
        endpoint.setAssetLibraryId("onetoken-main");
        save("{\"clearVideoRequestSpec\":true}");
        assertNull(endpoint.getAssetLibraryId());
    }
}
