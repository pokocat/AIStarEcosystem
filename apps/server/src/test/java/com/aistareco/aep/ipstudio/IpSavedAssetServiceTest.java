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
    @Test void measuredLibraryDurationSurvivesCollectionAndEnrichesAnOlderEntry() throws Exception {
        var input=(com.fasterxml.jackson.databind.node.ObjectNode)om.readTree("{\"kind\":\"video\",\"title\":\"原片\",\"data\":{\"storageKey\":\"ipstudio_source/u/v.mp4\"}}");
        service.saveAutomatic("u",input);
        input.with("data").put("durationSec",17.970794).put("width",720).put("height",1280).put("bytes",2888955);
        var wire=service.saveAutomatic("u",input);
        assertEquals(17.970794,wire.path("data").path("durationSec").asDouble(),.000001);
        assertEquals(720,wire.path("data").path("width").asInt());
        assertFalse(rows.get(wire.path("id").asText()).getPayloadJson().contains("signature="));
        input.with("data").put("storageKey","ipstudio_source/u/client.mp4");
        assertFalse(service.save("u",input).path("data").has("durationSec"),"client metadata is not a server measurement");
    }
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
    @Test void audioSharesCloudOwnershipAndNeverPersistsSignedUrls() throws Exception {
        var request=om.readTree("{\"kind\":\"audio\",\"title\":\"配音\",\"data\":{\"storageKey\":\"ipstudio_source/u/voice.wav\",\"url\":\"https://expired\",\"mimeType\":\"audio/wav\"}}");
        var saved=service.save("u",request);
        assertFalse(rows.get(saved.path("id").asText()).getPayloadJson().contains("https://"));
        assertTrue(saved.path("data").path("url").asText().contains("fresh"));
        verify(projects).requireOwnedAssetKey("u","ipstudio_source/u/voice.wav");
    }
    @Test void sourceFilterSeparatesGeneratedUploadsAndCanvasSaves() throws Exception {
        // 资产页「AI 生成」库只列自动收进来的生成结果，上传和画布手动存的不混进去（2026-10-31）。
        service.saveAutomatic("u",om.readTree("{\"kind\":\"image\",\"title\":\"出图\",\"source\":\"AI 生成\",\"data\":{\"storageKey\":\"ipstudio_gen/u/a.jpg\"}}"));
        service.saveAutomatic("u",om.readTree("{\"kind\":\"image\",\"title\":\"门头\",\"source\":\"用户上传\",\"data\":{\"storageKey\":\"ipstudio_source/u/b.jpg\"},\"metadata\":{\"folderId\":\"F1\"}}"));
        service.save("u",image());
        assertEquals(3,service.page("u","all",null,"all","all",0).total());
        var generated=service.page("u","unfiled",null,"all","generated",0);
        assertEquals(1,generated.total());assertEquals("出图",generated.items().get(0).path("title").asText());
        assertEquals("门头",service.page("u","all",null,"image","upload",0).items().get(0).path("title").asText());
        assertEquals(1,service.page("u","all",null,"all","canvas",0).total());
        assertEquals("IP_ASSET_INVALID",assertThrows(BusinessException.class,() -> service.page("u","all",null,"all","elsewhere",0)).getCode());
    }
    @Test void aMachineTitleIsReplacedButAUserTitleIsNot() throws Exception {
        String machine="{\"kind\":\"image\",\"title\":\"生成素材 · 1\",\"source\":\"AI 生成\",\"data\":{\"storageKey\":\"ipstudio_gen/u/a.jpg\"}}";
        String named="{\"kind\":\"image\",\"title\":\"林远 · 角色图\",\"source\":\"AI 生成\",\"data\":{\"storageKey\":\"ipstudio_gen/u/a.jpg\"},\"metadata\":{\"projectId\":\"DW-1\"}}";
        var first=service.saveAutomatic("u",om.readTree(machine));
        String id=first.path("id").asText();
        service.saveAutomatic("u",om.readTree(named));
        var row=om.readTree(rows.get(id).getPayloadJson());
        assertEquals("林远 · 角色图",row.path("title").asText());
        assertEquals("DW-1",row.path("metadata").path("projectId").asText());
        // 已经有意义的名字不会被下一次收录改掉；用户改过的名字也不会。
        service.saveAutomatic("u",om.readTree(named.replace("林远 · 角色图","别的名字")));
        assertEquals("林远 · 角色图",om.readTree(rows.get(id).getPayloadJson()).path("title").asText());
        var other=service.saveAutomatic("u",om.readTree(machine.replace("a.jpg","b.jpg")));
        service.edit("u",other.path("id").asText(),om.readTree("{\"title\":\"图片\"}"));
        service.saveAutomatic("u",om.readTree(named.replace("a.jpg","b.jpg")));
        assertEquals("图片",om.readTree(rows.get(other.path("id").asText()).getPayloadJson()).path("title").asText());
    }
    @Test void aDefaultNameReadsAsThePromptButAssignedAndNamedOnesStay() throws Exception {
        var wire=service.saveAutomatic("u",om.readTree("{\"kind\":\"image\",\"title\":\"图片 · 2\",\"source\":\"AI 生成\",\"data\":{\"storageKey\":\"ipstudio_gen/u/a.jpg\"},\"metadata\":{\"prompt\":\"## 一只橘猫坐在窗台上看雨，水彩风格，暖色调，竖版\"}}"));
        assertEquals("一只橘猫坐在窗台上看雨，水彩风格，暖… · 2",wire.path("title").asText());
        var named=service.saveAutomatic("u",om.readTree("{\"kind\":\"image\",\"title\":\"门头海报\",\"source\":\"AI 生成\",\"data\":{\"storageKey\":\"ipstudio_gen/u/b.jpg\"},\"metadata\":{\"prompt\":\"别的\"}}"));
        assertEquals("门头海报",named.path("title").asText());
        // 没有提示词就还是原来的名字。
        var bare=service.saveAutomatic("u",om.readTree("{\"kind\":\"video\",\"title\":\"视频\",\"source\":\"AI 生成\",\"data\":{\"storageKey\":\"ipstudio_gen/u/c.mp4\"}}"));
        assertEquals("视频",bare.path("title").asText());
    }
    @Test void materialsCanBeNarrowedToOneSource() throws Exception {
        service.saveAutomatic("u",om.readTree("{\"kind\":\"image\",\"title\":\"甲\",\"source\":\"AI 生成\",\"data\":{\"storageKey\":\"ipstudio_gen/u/a.jpg\"},\"metadata\":{\"projectId\":\"DW-1\"}}"));
        service.saveAutomatic("u",om.readTree("{\"kind\":\"image\",\"title\":\"乙\",\"source\":\"AI 生成\",\"data\":{\"storageKey\":\"ipstudio_gen/u/b.jpg\"},\"metadata\":{\"projectId\":\"IPP-2\"}}"));
        var page=service.page("u","all",null,"all","all","DW-1",0);
        assertEquals(1,page.total());assertEquals("甲",page.items().get(0).path("title").asText());
    }
}
