package com.aistareco.aep.dap;

import com.aistareco.aep.config.DapBuiltinPublicAvatarSeeder;
import com.aistareco.aep.dap.model.DapPublicAvatar;
import com.aistareco.aep.dap.repository.DapPublicAvatarRepository;
import com.aistareco.aep.dap.service.DapCatalogService;
import com.aistareco.aep.dap.service.DapPublicAvatarService;
import com.aistareco.aep.ipstudio.service.StudioIpAssetService;
import com.aistareco.aep.dap.repository.*;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 官方形象：免费的图所有人可用于生成，需授权的不放行；只认登记过、在官方分类下的图。内置 10 个入库一次、标免费。 */
class DapOfficialAvatarAccessTest {
    private final DapPublicAvatarRepository repo = mock(DapPublicAvatarRepository.class);
    private final FileStorageService storage = mock(FileStorageService.class);
    private final DapPublicAvatarService service = new DapPublicAvatarService(repo, storage);

    DapOfficialAvatarAccessTest() {
        when(storage.allocateKey(eq(DapPublicAvatarService.CATEGORY), isNull(), anyString())).thenReturn("dap_plaza/probe.png");
    }

    private DapPublicAvatar avatar(String id, String access, String front) {
        return DapPublicAvatar.builder().id(id).name(id).access(access).frontKey(front).cat("pro").build();
    }

    @Test
    void freeOfficialImagesAreUsableByAnyone() {
        when(repo.findByImageKey("dap_plaza/free.jpg")).thenReturn(List.of(avatar("PA-01", "free", "dap_plaza/free.jpg")));
        assertTrue(service.usableImageKey("someone", "dap_plaza/free.jpg"));
    }

    @Test
    void licensedOrUnknownOrOutsideTheCategoryIsRejected() {
        when(repo.findByImageKey("dap_plaza/paid.jpg")).thenReturn(List.of(avatar("PA-x", "license", "dap_plaza/paid.jpg")));
        when(repo.findByImageKey("dap_plaza/legacy.jpg")).thenReturn(List.of(avatar("PA-y", null, "dap_plaza/legacy.jpg")));
        assertFalse(service.usableImageKey("u", "dap_plaza/paid.jpg"));
        assertFalse(service.usableImageKey("u", "dap_plaza/legacy.jpg"), "V81 之前的行按需授权处理");
        assertFalse(service.usableImageKey("u", "dap_plaza/not-registered.jpg"));
        // 运营后台能手填 key：别人的私有图即便登记成免费也不放行
        when(repo.findByImageKey("ipstudio_source/other/private.png")).thenReturn(List.of(avatar("PA-z", "free", "ipstudio_source/other/private.png")));
        assertFalse(service.usableImageKey("u", "ipstudio_source/other/private.png"));
        verify(repo, never()).findByImageKey("ipstudio_source/other/private.png");
        assertFalse(service.usableImageKey(null, "dap_plaza/paid.jpg"));
    }

    @Test
    void studioOfficialLibraryListsEveryOfficialAvatarWithItsAccess() {
        var library = new StudioIpAssetService(mock(DapAvatarRepository.class), mock(DapAvatarVersionRepository.class), storage, mock(DapLookRepository.class));
        ReflectionTestUtils.setField(library, "publicAvatars", repo);
        ReflectionTestUtils.setField(library, "publicAvatarService", service);
        var free = avatar("PA-01", "free", "dap_plaza/a.jpg"); free.setRightKey("dap_plaza/a-r.jpg");
        when(repo.findAllByOrderBySortOrderAscCreatedAtDesc()).thenReturn(List.of(free, avatar("PA-02", "license", "dap_plaza/b.jpg"), avatar("PA-03", "free", null)));
        var assets = library.officialAssets();
        assertEquals(3, assets.size(), "没有图的不列；需授权的列出来但标 license");
        assertEquals("official:PA-01", assets.get(0).avatarId());
        assertEquals("main", assets.get(0).assetRole());
        assertEquals("free", assets.get(0).access());
        assertEquals("pro", assets.get(0).category());
        assertEquals("side", assets.get(1).assetRole());
        assertEquals("license", assets.get(2).access());
        assertEquals("official", assets.get(2).librarySource());
    }

    @Test
    void builtinAvatarsAreStoredOnceAndMarkedFree() throws Exception {
        var configs = mock(PlatformConfigService.class);
        when(configs.findByKey(DapBuiltinPublicAvatarSeeder.MARKER)).thenReturn(Optional.empty());
        when(storage.store(any(byte[].class), eq(DapPublicAvatarService.CATEGORY), isNull(), eq("jpg"), eq("image/jpeg")))
                .thenAnswer(i -> new FileStorageService.StoredFile("dap_plaza/" + UUID.randomUUID() + ".jpg", null, null, null, 1, "image/jpeg"));
        var catalog = new DapCatalogService();
        var saved = new ArrayList<DapPublicAvatar>();
        when(repo.existsById("PA-01")).thenReturn(true); // 已在库里的不重复写
        when(repo.save(any())).thenAnswer(i -> { saved.add(i.getArgument(0)); return i.getArgument(0); });

        var created = new DapBuiltinPublicAvatarSeeder(catalog, repo, storage, configs, new ObjectMapper()).seed();

        assertEquals(9, created.size());
        assertFalse(created.contains("PA-01"));
        assertTrue(saved.stream().allMatch(a -> "free".equals(a.getAccess()) && a.getFrontKey() != null && a.getRightKey() != null && a.getLeftKey() != null));
        verify(configs).seedIfAbsent(eq(DapBuiltinPublicAvatarSeeder.MARKER), any(), anyString());

        when(configs.findByKey(DapBuiltinPublicAvatarSeeder.MARKER)).thenReturn(Optional.of(new com.aistareco.aep.dto.PlatformConfigDto(DapBuiltinPublicAvatarSeeder.MARKER, null, 1, null, null, null)));
        assertTrue(new DapBuiltinPublicAvatarSeeder(catalog, repo, storage, configs, new ObjectMapper()).seed().isEmpty(), "做过一次就不再写");
    }

    @Test
    void deletingAUsersAvatarNeverDeletesTheSharedOfficialImage() {
        var trash = new com.aistareco.aep.dap.service.DapTrashService(mock(DapAvatarRepository.class), mock(DapAvatarVersionRepository.class), mock(DapLookRepository.class),
                mock(DapDerivativeRepository.class), mock(DapPhotoRepository.class), mock(DapCaptureRepository.class), mock(DapLicenseRepository.class), mock(DapJobRepository.class),
                storage, mock(com.aistareco.aep.dap.config.DapProperties.class));
        // 「另存为我的数字人」后，用户的数字人直接引用官方图。
        var copy = com.aistareco.aep.dap.model.DapAvatar.builder().id("DH-1").ownerUserId("u").imageKey("dap_plaza/a.jpg")
                .shotKeys(new LinkedHashMap<>(Map.of("right", "media/dap_plaza/a-r.jpg", "mine", "ipstudio_gen/u/own.png"))).build();
        trash.hardDelete(copy);
        verify(storage, never()).delete("dap_plaza/a.jpg");
        verify(storage, never()).delete("media/dap_plaza/a-r.jpg");
        verify(storage).delete("ipstudio_gen/u/own.png");
    }
}
