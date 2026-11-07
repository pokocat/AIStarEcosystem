package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.IpLibraryDtos.LibraryCandidate;
import com.aistareco.aep.ipstudio.model.IpLibraryRecord;
import com.aistareco.aep.ipstudio.repository.IpLibraryRecordRepository;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 商品库（docs/ai-director-commerce-plan.md §3）：个人资产库多认一个 kind=product，能按它筛选，能删图但至少留一张。 */
class IpLibraryProductTest {
    private static final String USER = "u1";
    private final ObjectMapper om = new ObjectMapper();
    private final IpLibraryRecordRepository records = mock(IpLibraryRecordRepository.class);
    private IpLibraryService service;
    private IpLibraryRecord row;

    @BeforeEach void setUp() {
        AepUserRepository users = mock(AepUserRepository.class);
        when(users.findByIdForUpdate(USER)).thenReturn(Optional.of(mock(AepUser.class)));
        FileStorageService storage = mock(FileStorageService.class);
        when(storage.signedUrl(any())).thenAnswer(i -> "https://x/" + i.getArgument(0));
        when(records.findByIdAndOwnerUserIdAndDeletedAtIsNull(any(), eq(USER))).thenAnswer(i -> Optional.ofNullable(row));
        when(records.save(any())).thenAnswer(i -> { row = i.getArgument(0); return row; });
        when(records.findByOwnerUserIdAndRecordTypeAndDeletedAtIsNullOrderByCreatedAtDesc(eq(USER), eq("object"))).thenAnswer(i -> row == null ? List.of() : List.of(row));
        when(records.findByOwnerUserIdAndRecordTypeAndDeletedAtIsNullOrderByCreatedAtDesc(eq(USER), eq("folder"))).thenReturn(List.of());
        service = new IpLibraryService(records, mock(IpSavedAssetService.class), mock(IpProjectService.class), mock(IpRunRepository.class),
                mock(StudioWorkflowService.class), storage, om, users);
    }

    private void seed(String kind, String main, String... keys) throws Exception {
        var data = om.createObjectNode().put("kind", kind).put("name", "恒温保温杯").put("description", "").put("prompt", "");
        if (main != null) data.put("mainVersionId", main);
        data.putArray("sources");
        var versions = data.putArray("versions");
        for (String k : keys) versions.addObject().put("id", "v-" + k).put("storageKey", k).put("prompt", "").put("createdAt", "").put("mock", false);
        Instant now = Instant.now();
        row = IpLibraryRecord.builder().id("o1").ownerUserId(USER).recordType("object").payloadJson(data.toString()).createdAt(now).updatedAt(now).build();
    }

    private String edit(String json) throws Exception { return service.edit(USER, "o1", om.readTree(json)).mainVersionId(); }

    @Test void aProductCanBeCreatedAndListedByKind() throws Exception {
        var created = service.create(USER, new LibraryCandidate("k", "product", "恒温保温杯", "说明", "", null), null);
        assertEquals("product", created.kind());
        assertEquals(1, service.objects(USER, null, null, "all", "product", 0, null, null).items().size());
        assertEquals(0, service.objects(USER, null, null, "all", "prop", 0, null, null).items().size());
        assertThrows(BusinessException.class, () -> service.objects(USER, null, null, "all", "nonsense", 0, null, null));
    }

    @Test void removingTheMainImagePromotesTheFirstRemainingOne() throws Exception {
        seed("product", "v-a", "a", "b", "c");
        assertEquals("v-b", edit("{\"removeVersionId\":\"v-a\"}"));
        assertEquals(2, service.object(USER, "o1").versions().size());
    }

    @Test void removingAnotherImageKeepsTheMainOne() throws Exception {
        seed("product", "v-a", "a", "b");
        assertEquals("v-a", edit("{\"removeVersionId\":\"v-b\"}"));
    }

    @Test void theLastImageCannotBeRemoved() throws Exception {
        seed("product", "v-a", "a");
        assertEquals("IP_LIBRARY_INVALID", assertThrows(BusinessException.class, () -> edit("{\"removeVersionId\":\"v-a\"}")).getCode());
    }

    @Test void onlyProductsCanRemoveImages() throws Exception {
        seed("character", "v-a", "a", "b");
        assertThrows(BusinessException.class, () -> edit("{\"removeVersionId\":\"v-b\"}"));
    }

    @Test void aMissingImageIsAClearError() throws Exception {
        seed("product", "v-a", "a", "b");
        assertEquals("IP_LIBRARY_INVALID", assertThrows(BusinessException.class, () -> edit("{\"removeVersionId\":\"gone\"}")).getCode());
    }
}
