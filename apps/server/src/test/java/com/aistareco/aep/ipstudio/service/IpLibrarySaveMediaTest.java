package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.IpLibraryDtos.SaveMediaRequest;
import com.aistareco.aep.ipstudio.model.IpLibraryRecord;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.repository.IpLibraryRecordRepository;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 画布和资产页把一张已有的图存成角色、场景、道具：建和加图是同一个事务，重复提交不多建。 */
class IpLibrarySaveMediaTest {
    private static final String USER = "u1", KEY = "ipstudio_gen/u1/a.png";
    private final ObjectMapper om = new ObjectMapper();
    private final Map<String, IpLibraryRecord> rows = new LinkedHashMap<>();
    private final IpProjectService projects = mock(IpProjectService.class);
    private final IpSavedAssetService saved = mock(IpSavedAssetService.class);
    private final IpLibraryRecordRepository records = mock(IpLibraryRecordRepository.class);
    private IpLibraryService service;
    @TempDir Path dir;

    @BeforeEach void setUp() throws Exception {
        AepUserRepository users = mock(AepUserRepository.class);
        when(users.findByIdForUpdate(USER)).thenReturn(Optional.of(mock(AepUser.class)));
        when(records.findByIdAndOwnerUserIdAndDeletedAtIsNull(anyString(), eq(USER))).thenAnswer(i -> Optional.ofNullable(rows.get(i.getArgument(0))).filter(r -> r.getDeletedAt() == null));
        when(records.save(any())).thenAnswer(i -> { IpLibraryRecord r = i.getArgument(0); rows.put(r.getId(), r); return r; });
        FileStorageService storage = mock(FileStorageService.class);
        when(storage.signedUrl(any())).thenAnswer(i -> "https://x/" + i.getArgument(0));
        Path png = dir.resolve("a.png");
        Files.write(png, new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0});
        when(storage.openForRead(any())).thenReturn(png);
        when(projects.requireOwnedAssetKey(USER, KEY)).thenReturn(KEY);
        when(saved.promptOf(USER, "image", KEY)).thenReturn("一只橘猫");
        service = new IpLibraryService(records, saved, projects, mock(IpRunRepository.class), mock(StudioWorkflowService.class), storage, om, users);
    }

    @Test void depthControlIsReceiptedWithoutBecomingAUserLibraryVideo() {
        var run=com.aistareco.aep.ipstudio.model.IpRun.builder().id("IPR-depth").ownerUserId(USER).kind("studio-video-control").status("done").build();
        service.collect(run);
        verify(saved,never()).saveAutomatic(anyString(),any());
        verify(projects,never()).toRunDto(any());
        assertTrue(rows.containsKey("ILC-IPR-depth"));
    }

    private SaveMediaRequest newCard(String requestId) {
        return new SaveMediaRequest(requestId, KEY, null, "scene", "祖宅", "", null, null, null);
    }

    @Test void createsACardWithTheImageAsMain() {
        var card = service.saveMedia(USER, newCard("r1"));
        assertEquals("scene", card.kind());
        assertEquals(1, card.versions().size());
        assertEquals(card.versions().get(0).id(), card.mainVersionId());
        assertEquals("一只橘猫", card.versions().get(0).prompt());
        verify(saved).saveAutomatic(eq(USER), any());
    }

    @Test void aRepeatedRequestReturnsTheSameCard() {
        var first = service.saveMedia(USER, newCard("r1"));
        var second = service.saveMedia(USER, newCard("r1"));
        assertEquals(first.id(), second.id());
        assertEquals(1, rows.values().stream().filter(r -> "object".equals(r.getRecordType())).count());
    }

    @Test void addingToAnExistingCardKeepsItsMainImage() throws Exception {
        var existing = om.createObjectNode().put("kind", "character").put("name", "林远").put("description", "").put("prompt", "").put("mainVersionId", "v-old");
        existing.putArray("versions").addObject().put("id", "v-old").put("storageKey", "ipstudio_gen/u1/old.png");
        existing.putArray("sources");
        var now = java.time.Instant.now();
        rows.put("ILO-1", IpLibraryRecord.builder().id("ILO-1").ownerUserId(USER).recordType("object").payloadJson(existing.toString()).createdAt(now).updatedAt(now).build());
        var card = service.saveMedia(USER, new SaveMediaRequest("r2", KEY, "ILO-1", null, null, null, null, null, null));
        assertEquals("ILO-1", card.id());
        assertEquals(2, card.versions().size());
        assertEquals("v-old", card.mainVersionId());
    }

    @Test void aCanvasSourceIsRecorded() {
        IpProject project = new IpProject(); project.setId("IPP-1"); project.setName("废市");
        when(projects.required(USER, "IPP-1")).thenReturn(project);
        var card = service.saveMedia(USER, new SaveMediaRequest("r3", KEY, null, "prop", "钥匙", "", null, "IPP-1", "n1"));
        assertEquals("canvas", card.sources().get(0).origin());
        assertEquals("废市", card.sources().get(0).title());
        assertEquals("n1", card.sources().get(0).nodeId());
    }

    @Test void aForeignImageIsRejected() {
        when(projects.requireOwnedAssetKey(USER, "other/x.png")).thenThrow(BusinessException.badRequest("IP_ASSET_NOT_OWNED", "不是本人的素材"));
        var request = new SaveMediaRequest("r4", "other/x.png", null, "scene", "祖宅", "", null, null, null);
        assertEquals("IP_ASSET_NOT_OWNED", assertThrows(BusinessException.class, () -> service.saveMedia(USER, request)).getCode());
        assertTrue(rows.isEmpty());
    }

    @Test void anInvalidKindIsRejected() {
        var request = new SaveMediaRequest("r5", KEY, null, "nonsense", "祖宅", "", null, null, null);
        assertEquals("IP_LIBRARY_INVALID", assertThrows(BusinessException.class, () -> service.saveMedia(USER, request)).getCode());
    }

    private final org.springframework.web.multipart.MultipartFile file = mock(org.springframework.web.multipart.MultipartFile.class);

    @Test void aCanvasImageIsRegisteredInTheSameRequestAsItsUpload() {
        IpProject project = new IpProject(); project.setId("IPP-1"); project.setName("废市");
        when(projects.required(USER, "IPP-1")).thenReturn(project);
        when(projects.upload(USER, file)).thenReturn(new com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpUploadResultDto(KEY, "https://x/a", 300, 400, "a.png"));
        var result = service.uploadCanvasImage(USER, "IPP-1", file, "n1", "图片 · 裁剪", "一只橘猫");
        assertEquals(KEY, result.key());
        var captured = org.mockito.ArgumentCaptor.forClass(com.fasterxml.jackson.databind.JsonNode.class);
        verify(saved).saveAutomatic(eq(USER), captured.capture());
        var asset = captured.getValue();
        assertEquals("图片 · 裁剪", asset.path("title").asText());
        assertEquals("Canvas", asset.path("source").asText());
        assertEquals(KEY, asset.path("data").path("storageKey").asText());
        assertEquals(300, asset.path("data").path("width").asInt());
        assertEquals("IPP-1", asset.path("metadata").path("projectId").asText());
        assertEquals("n1", asset.path("metadata").path("nodeId").asText());
        assertEquals("一只橘猫", asset.path("metadata").path("prompt").asText());
    }

    @Test void aFailedRegistrationStillReturnsTheImage() {
        IpProject project = new IpProject(); project.setId("IPP-1");
        when(projects.required(USER, "IPP-1")).thenReturn(project);
        when(projects.upload(USER, file)).thenReturn(new com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpUploadResultDto(KEY, "https://x/a", 300, 400, "a.png"));
        when(saved.saveAutomatic(eq(USER), any())).thenThrow(new IllegalStateException("db down"));
        assertEquals(KEY, service.uploadCanvasImage(USER, "IPP-1", file, "n1", "裁剪", null).key());
    }

    @Test void someoneElsesCanvasStoresNothing() {
        when(projects.required(USER, "IPP-other")).thenThrow(BusinessException.notFound("IP_PROJECT_NOT_FOUND", "画布不存在或已删除"));
        assertEquals("IP_PROJECT_NOT_FOUND", assertThrows(BusinessException.class, () -> service.uploadCanvasImage(USER, "IPP-other", file, "n1", "裁剪", null)).getCode());
        verify(projects, never()).upload(any(), any());
        verify(saved, never()).saveAutomatic(any(), any());
    }

    @Test void directorLinksLeaveOutDeletedCards() {
        // 对账记录里记过的卡，用户删掉后不再算「已在资产库」。
        var marker = om.createObjectNode();
        marker.putObject("assets").putObject("as1").put("objectId", "ILO-1");
        marker.with("assets").putObject("as2").put("objectId", "ILO-2");
        var now = java.time.Instant.now();
        rows.put("ILW-DW-1", IpLibraryRecord.builder().id("ILW-DW-1").ownerUserId(USER).recordType("receipt").payloadJson(marker.toString()).createdAt(now).updatedAt(now).build());
        when(records.liveIds(any(), eq(USER))).thenReturn(List.of("ILO-1"));
        assertEquals(Map.of("as1", "ILO-1"), service.directorLinks(USER, "DW-1"));
        assertTrue(service.directorLinks(USER, "DW-none").isEmpty());
    }
}
