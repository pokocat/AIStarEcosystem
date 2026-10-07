package com.aistareco.aep.ipstudio;
import com.aistareco.aep.ipstudio.model.IpSavedAsset;
import com.aistareco.aep.ipstudio.repository.IpSavedAssetRepository;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
class IpSavedAssetServiceTest {
    private final ObjectMapper om = new ObjectMapper();
    private final Map<String,IpSavedAsset> rows = new HashMap<>();
    private IpSavedAssetRepository repo;
    private IpProjectService projects;
    private IpSavedAssetService service;
    @BeforeEach void setup() {
        repo = mock(IpSavedAssetRepository.class); projects = mock(IpProjectService.class);
        var users = mock(AepUserRepository.class);
        when(users.findByIdForUpdate(anyString())).thenReturn(Optional.of(new AepUser()));
        when(repo.findById(anyString())).thenAnswer(i -> Optional.ofNullable(rows.get(i.getArgument(0))));
        when(repo.save(any())).thenAnswer(i -> { IpSavedAsset a=i.getArgument(0); rows.put(a.getId(),a); return a; });
        when(repo.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(anyString())).thenAnswer(i -> rows.values().stream().filter(a -> a.getOwnerUserId().equals(i.getArgument(0)) && a.getDeletedAt()==null).toList());
        when(repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(anyString(),anyString())).thenAnswer(i -> Optional.ofNullable(rows.get(i.getArgument(0))).filter(a -> a.getOwnerUserId().equals(i.getArgument(1)) && a.getDeletedAt()==null));
        when(projects.signOwnedKeys(anyString(),anyList())).thenAnswer(i -> Map.of(((List<String>)i.getArgument(1)).get(0), "https://cdn.test/fresh?signature=derived"));
        service = new IpSavedAssetService(repo,projects,om,users);
    }
    private JsonNode image() throws Exception { return om.readTree("{\"kind\":\"image\",\"title\":\"成图\",\"coverUrl\":\"https://expired\",\"data\":{\"storageKey\":\"ipstudio_gen/u/1.jpg\",\"dataUrl\":\"https://expired\",\"width\":768},\"metadata\":{\"prompt\":\"银发姑娘\"}}"); }
    @Test void savesCloudEntryAndResignsOnEveryRead() throws Exception {
        var saved=service.save("u",image());
        var row=rows.get(saved.path("id").asText());
        assertFalse(row.getPayloadJson().contains("https://"));
        assertEquals("银发姑娘",service.list("u").get(0).path("metadata").path("prompt").asText());
        assertTrue(service.list("u").get(0).path("data").path("dataUrl").asText().contains("fresh"));
        assertTrue(service.list("other").isEmpty());
    }
    @Test void sameImageIsIdempotentAndDeleteKeepsSourceRecoverable() throws Exception {
        var first=service.save("u",image()); var second=service.save("u",image());
        assertEquals(first.path("id"),second.path("id")); assertEquals(1,rows.size());
        String id=first.path("id").asText();
        assertThrows(BusinessException.class,() -> service.remove("other",id));
        service.remove("u",id); assertTrue(service.list("u").isEmpty());
        service.save("u",image()); assertEquals(1,service.list("u").size());
    }
    @Test void rejectsForeignKeyBeforePersisting() throws Exception {
        when(projects.requireOwnedAssetKey(eq("other"),anyString())).thenThrow(BusinessException.badRequest("IP_ASSET_NOT_OWNED","非本人"));
        assertThrows(BusinessException.class,() -> service.save("other",image()));
        verify(repo,never()).save(any());
    }
    @Test void rejectsMissingKeyAndOversizedText() throws Exception {
        assertThrows(BusinessException.class,() -> service.save("u",om.readTree("{\"kind\":\"image\",\"data\":{\"dataUrl\":\"https://unowned\"}}")));
        var text=om.createObjectNode().put("kind","text"); text.putObject("data").put("content","a".repeat(100001));
        assertThrows(BusinessException.class,() -> service.save("u",text));
    }
}
