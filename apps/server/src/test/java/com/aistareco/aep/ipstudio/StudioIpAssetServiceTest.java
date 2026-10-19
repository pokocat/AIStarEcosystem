package com.aistareco.aep.ipstudio;

import com.aistareco.aep.dap.model.*;
import com.aistareco.aep.dap.repository.*;
import com.aistareco.aep.ipstudio.service.StudioIpAssetService;
import com.aistareco.aep.service.storage.FileStorageService;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioIpAssetServiceTest {
    @Test void officialLibraryOnlyReadsPublishedPlatformCopiesAndDoesNotExposeSourceIdentity() {
        var storage=mock(FileStorageService.class);
        var library=new StudioIpAssetService(avatars,versions,storage,looks);
        var demos=mock(com.aistareco.aep.ipstudio.repository.IpDemoTemplateRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(library,"officialDemos",demos);
        String doc="""
            {"nodes":[
              {"id":"sheet","type":"image","title":"官方人物设定","metadata":{"storageKey":"ipstudio_demo/d/sheet.png","studio":{"kind":"ip","libraryAssetRole":"sheet","adoption":{"avatarId":"private-avatar"}}}},
              {"id":"private","type":"image","metadata":{"storageKey":"ipstudio_source/another-owner/private.png","studio":{"kind":"ip"}}},
              {"id":"scene","type":"image","metadata":{"storageKey":"ipstudio_demo/d/scene.png"}}
            ]}
            """;
        var official=com.aistareco.aep.ipstudio.model.IpDemoTemplate.builder().id("d").name("角色").visibility("official").enabled(true).docJson(doc).build();
        var personal=com.aistareco.aep.ipstudio.model.IpDemoTemplate.builder().id("personal").visibility("private").enabled(true).docJson(doc).build();
        when(demos.findByEnabledTrueOrderBySortOrderAscCreatedAtAsc()).thenReturn(List.of(official,personal));
        when(storage.allocateKey(com.aistareco.aep.ipstudio.service.IpDemoTemplateService.CATEGORY_DEMO,"d","probe.png")).thenReturn("ipstudio_demo/d/probe.png");
        when(storage.signedUrl("ipstudio_demo/d/sheet.png")).thenReturn("signed-copy");
        var result=library.officialAssets();assertEquals(1,result.size());
        assertEquals("official",result.get(0).librarySource());assertEquals("sheet",result.get(0).assetRole());
        assertTrue(result.get(0).avatarId().startsWith("official:d:"));assertFalse(result.get(0).avatarId().contains("private-avatar"));assertNull(result.get(0).ipId());
        verify(storage,never()).signedUrl("ipstudio_source/another-owner/private.png");
    }
    private final DapAvatarRepository avatars=mock(DapAvatarRepository.class);
    private final DapAvatarVersionRepository versions=mock(DapAvatarVersionRepository.class);
    private final DapLookRepository looks=mock(DapLookRepository.class);
    private final StudioIpAssetService service=new StudioIpAssetService(avatars,versions,mock(FileStorageService.class),looks);
    private final DapAvatar avatar=DapAvatar.builder().id("a").ownerUserId("owner").ipId("ip").versions(2).imageKey("new.jpg").build();
    @Test void updatingMainImageDoesNotInvalidateExplicitOldSnapshot() {
        when(versions.findByAvatarIdAndV("a",1)).thenReturn(Optional.of(DapAvatarVersion.builder().avatarId("a").v(1).imageKey("old.jpg").build()));
        assertTrue(service.matchesVersion(avatar,"old.jpg",1));
        assertFalse(service.matchesVersion(avatar,"new.jpg",1));
        assertFalse(service.matchesVersion(avatar,"old.jpg",null));
        assertTrue(service.matchesVersion(avatar,"new.jpg",2));
    }
    @Test void canvasKeysAndAnotherOwnersAssetDoNotGrantOwnership() {
        when(avatars.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc("owner")).thenReturn(List.of(avatar));
        when(versions.findByAvatarIdOrderByVDesc("a")).thenReturn(List.of());
        when(looks.findByAvatarIdOrderByCreatedAtDesc("a")).thenReturn(List.of(DapLook.builder().avatarId("a").ownerUserId("other").status("done").imageKey("stolen.jpg").build()));
        assertFalse(service.owns("owner","stolen.jpg"));
        assertFalse(service.owns("other","new.jpg"));
        assertTrue(service.owns("owner","new.jpg"));
    }
    @Test void lookReferenceMustMatchOwnerAvatarAndExactKey() {
        when(looks.findById("look")).thenReturn(Optional.of(DapLook.builder().avatarId("a").ownerUserId("owner").status("done").imageKey("look.jpg").build()));
        assertTrue(service.matchesLook(avatar,"look","look.jpg"));
        assertFalse(service.matchesLook(avatar,"look","new.jpg"));
        avatar.setOwnerUserId("other");assertFalse(service.matchesLook(avatar,"look","look.jpg"));
    }
    @Test void oldPublishedCharacterWithoutIpRemainsAvailableForExplicitAttachment() {
        avatar.setIpId(null);when(avatars.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc("owner")).thenReturn(List.of(avatar));
        when(versions.findByAvatarIdOrderByVDesc("a")).thenReturn(List.of());when(looks.findByAvatarIdOrderByCreatedAtDesc("a")).thenReturn(List.of());
        var asset=service.list("owner").get(0);assertNull(asset.ipId());assertEquals("a",asset.avatarId());assertEquals("new.jpg",asset.storageKey());
    }
    @Test void libraryKeepsPersonIdentityAndExactMediaRolesWithoutGuessingFromLabels() {
        avatar.setName("小紫");avatar.setPath("ai");avatar.setDef(Map.of("年龄","青年","性格",List.of("温柔"),"未知","—"));
        when(avatars.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc("owner")).thenReturn(List.of(avatar));
        when(versions.findByAvatarIdOrderByVDesc("a")).thenReturn(List.of(DapAvatarVersion.builder().avatarId("a").v(1).imageKey("old.jpg").build()));
        when(looks.findByAvatarIdOrderByCreatedAtDesc("a")).thenReturn(List.of(
                DapLook.builder().id("sheet").avatarId("a").ownerUserId("owner").label("完整设定").assetRole("sheet").status("done").imageKey("sheet.jpg").build(),
                DapLook.builder().id("legacy").avatarId("a").ownerUserId("owner").label("看似三视图但未分类").status("done").imageKey("look.jpg").build(),
                DapLook.builder().id("final").avatarId("a").ownerUserId("owner").source("final").status("done").imageKey("new.jpg").build()));
        var result=service.list("owner");assertEquals(4,result.size());
        assertEquals(List.of("main","history","sheet","look"),result.stream().map(a->a.assetRole()).toList());
        assertTrue(result.stream().allMatch(a->"小紫".equals(a.characterName())));
        assertEquals(Map.of("年龄","青年"),result.get(0).attributes());assertEquals("sheet.jpg",result.get(2).storageKey());
    }
    @Test void classifyingAnOwnedLookPreservesItsIdentityAndNeverChangesMainImage() {
        var look=DapLook.builder().id("l").avatarId("a").ownerUserId("owner").status("done").source("design").imageKey("look.jpg").build();
        when(avatars.lockOwned("a","owner")).thenReturn(Optional.of(avatar));when(looks.findById("l")).thenReturn(Optional.of(look));
        var updated=service.classify("owner","a","l","sheet");assertEquals("sheet",updated.assetRole());assertEquals("l",updated.lookId());assertEquals("look.jpg",updated.storageKey());assertEquals("new.jpg",avatar.getImageKey());assertEquals("design",look.getSource());
        look.setOwnerUserId("other");assertThrows(com.aistareco.common.BusinessException.class,()->service.classify("owner","a","l","detail"));
        verify(looks,times(1)).save(look);assertThrows(com.aistareco.common.BusinessException.class,()->service.classify("owner","a","l","main"));
    }
}
